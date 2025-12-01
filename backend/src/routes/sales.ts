import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createSale } from '../lib/inventory';
import PDFDocument from 'pdfkit';
import { formatCOP, toNumber } from '../lib/format';
import net from 'node:net';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config';
import { buildSaleTicketEscpos, buildSaleTicketText } from '../lib/escpos';

export async function salesRoutes(app: FastifyInstance) {
  const itemSchema = z.object({ 
    productId: z.string(), 
    quantity: z.number().positive(), 
    unitPrice: z.string().optional(),
    presentationId: z.string().optional(),
    stockQuantity: z.number().optional()
  });
  const saleSchema = z.object({ 
    warehouseId: z.string(), 
    items: z.array(itemSchema).min(1),
    paymentMethod: z.string().optional(),
    priceType: z.string().optional(),
    cashReceived: z.number().optional().nullable(),
    change: z.number().optional().nullable(),
    domicilioPrice: z.number().optional()
  });

  app.post('/sales', {
    schema: {
      summary: 'Crear venta',
      tags: ['sales'],
      body: {
        type: 'object',
        required: ['warehouseId', 'items'],
        properties: {
          warehouseId: { type: 'string' },
          items: {
            type: 'array', 
            minItems: 1, 
            items: { 
              type: 'object', 
              required: ['productId', 'quantity'], 
              properties: { 
                productId: { type: 'string' }, 
                quantity: { type: 'number' }, 
                unitPrice: { type: 'string' },
                presentationId: { type: 'string' },
                stockQuantity: { type: 'number' }
              } 
            },
          },
          paymentMethod: { type: 'string' },
          priceType: { type: 'string' },
          cashReceived: { type: 'number', nullable: true },
          change: { type: 'number', nullable: true },
          domicilioPrice: { type: 'number' }
        },
      },
    },
  }, async (request, reply) => {
    const parsed = saleSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos' });
    try {
      const userId = (request as any).user?.sub;
      const sale = await createSale(app.prisma, { ...parsed.data, userId });
      // Registrar ingreso de caja si hay sesión abierta
      const session = await app.prisma.cashSession.findFirst({ where: { warehouseId: sale.warehouseId, closedAt: null }, orderBy: { openedAt: 'desc' } });
      if (session) {
        await app.prisma.cashMovement.create({
          data: {
            sessionId: session.id,
            type: 'IN',
            amount: sale.total as any,
            referenceType: 'SALE',
            referenceId: sale.id,
          },
        });
      }
      return sale;
    } catch (e: any) {
      return reply.code(400).send({ message: e.message || 'Error' });
    }
  });

  app.get('/sales', {
    schema: {
      summary: 'Listar ventas',
      tags: ['sales'],
      querystring: { type: 'object', properties: { limit: { type: 'integer' }, offset: { type: 'integer' }, search: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const qp = (request.query as any) ?? {};
    const limit = Math.min(Math.max(Number(qp.limit ?? 50), 1), 200);
    const offset = Math.max(Number(qp.offset ?? 0), 0);
    const search = qp.search?.trim() || '';

    // Construir filtro de búsqueda
    let whereClause: any = {};
    if (search) {
      const saleNumberSearch = parseInt(search);
      whereClause = {
        OR: [
          // Búsqueda por número de venta
          ...(isNaN(saleNumberSearch) ? [] : [{ saleNumber: saleNumberSearch }]),
          // Búsqueda por nombre de producto
          {
            items: {
              some: {
                product: {
                  name: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              }
            }
          }
        ]
      };
    }

    const [total, rows] = await Promise.all([
      app.prisma.sale.count({ where: whereClause }),
      app.prisma.sale.findMany({ where: whereClause, orderBy: { createdAt: 'desc' }, take: limit, skip: offset, include: { items: { include: { product: true, presentation: true } }, user: { select: { id: true, username: true, name: true } } } }),
    ]);
    reply.header('X-Total-Count', String(total));
    reply.header('X-Limit', String(limit));
    reply.header('X-Offset', String(offset));
    // Convert Decimal to number for JSON serialization
    return rows.map(sale => ({
      ...sale,
      total: Number(sale.total),
      subtotal: sale.subtotal ? Number(sale.subtotal) : null,
      domicilio: sale.domicilio ? Number(sale.domicilio) : null,
      cashReceived: sale.cashReceived ? Number(sale.cashReceived) : null,
      change: sale.change ? Number(sale.change) : null,
      items: sale.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        baseQuantity: Number(item.baseQuantity),
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal)
      }))
    }));
  });

  // Obtener venta por ID con detalles
  app.get('/sales/:id', {
    schema: {
      summary: 'Obtener venta por ID',
      tags: ['sales'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const sale = await app.prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            presentation: true
          }
        },
        warehouse: true,
        user: { select: { id: true, username: true, name: true } }
      }
    });

    if (!sale) {
      return reply.code(404).send({ message: 'Venta no encontrada' });
    }

    return {
      ...sale,
      total: Number(sale.total),
      subtotal: sale.subtotal ? Number(sale.subtotal) : null,
      domicilio: sale.domicilio ? Number(sale.domicilio) : null,
      cashReceived: sale.cashReceived ? Number(sale.cashReceived) : null,
      change: sale.change ? Number(sale.change) : null,
      items: sale.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        baseQuantity: Number(item.baseQuantity),
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal)
      }))
    };
  });

  app.get('/sales/:id/receipt.pdf', {
    schema: {
      summary: 'Recibo PDF',
      tags: ['sales'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } } } },
    },
  }, async (request, reply) => {
    const id = (request.params as any).id as string;
    const sale = await app.prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, warehouse: true },
    });
    if (!sale) return reply.code(404).send({ message: 'Venta no encontrada' });

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `inline; filename="ticket-${id}.pdf"`);

    const width = 220; // ~58mm térmica
    const margin = 10;
    const doc = new PDFDocument({ size: [width, 600], margin });
    doc.pipe(reply.raw);

    const line = () => {
      doc.moveTo(margin, doc.y).lineTo(width - margin, doc.y).stroke();
    };

    // Encabezado
    doc.fontSize(12).text('Distribuidora Zora', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(8).text('Venta', { align: 'center' });
    doc.fontSize(8).text(`# ${sale.id.slice(-6).toUpperCase()}`, { align: 'center' });
    doc.fontSize(8).text(new Date(sale.createdAt).toLocaleString('es-CO'), { align: 'center' });
    doc.moveDown(0.5);
    line();

    // Items
    doc.moveDown(0.3);
    doc.fontSize(9).text('Detalle', { align: 'left' });
    doc.moveDown(0.2);

    let total = toNumber(sale.total as any);
    sale.items.forEach((it) => {
      const name = it.product?.name ?? it.productId;
      const qty = it.quantity;
      const price = toNumber(it.unitPrice as any);
      const subtotal = toNumber(it.subtotal as any);
      doc.fontSize(8).text(name, { width: width - margin * 2 });
      doc.fontSize(8).text(`${qty} x ${formatCOP(price)}  =  ${formatCOP(subtotal)}`, { align: 'right' });
      doc.moveDown(0.1);
    });

    doc.moveDown(0.3);
    line();
    doc.moveDown(0.2);

    // Totales
    doc.fontSize(10).text(`Total: ${formatCOP(total)}`, { align: 'right' });

    doc.moveDown(0.8);
    doc.fontSize(8).text('Gracias por su compra', { align: 'center' });
    doc.fontSize(7).text('Almacén: ' + (sale.warehouse?.name ?? ''), { align: 'center' });

    doc.end();
    return reply;
  });

  // Helper para imprimir con CUPS (texto plano)
  const execAsync = promisify(exec);
  const printWithCups = async (text: string, printerName: string): Promise<void> => {
    const tmpFile = path.join(os.tmpdir(), `ticket-${Date.now()}.txt`);
    await fs.promises.writeFile(tmpFile, text, 'utf-8');
    try {
      // Usar lp para imprimir texto sin márgenes
      await execAsync(`lp -d "${printerName}" -o page-top=0 -o page-bottom=0 -o page-left=0 "${tmpFile}"`);
    } finally {
      await fs.promises.unlink(tmpFile).catch(() => {});
    }
  };

  app.get('/sales/:id/receipt.escpos', {
    schema: {
      summary: 'Recibo ESC/POS',
      tags: ['sales'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } } },
    },
  }, async (request, reply) => {
    const id = (request.params as any).id as string;
    const sale = await app.prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, warehouse: true },
    });
    if (!sale) return reply.code(404).send({ message: 'Venta no encontrada' });

    const bytes = buildSaleTicketEscpos(sale);

    // 1. Impresora de red (socket TCP)
    if (config.printerHost) {
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        socket.on('error', reject);
        socket.connect(config.printerPort, config.printerHost as string, () => {
          socket.write(Buffer.from(bytes), (err) => {
            if (err) reject(err);
            socket.end();
            resolve();
          });
        });
      });
      return reply.send({ printed: true, method: 'network', host: config.printerHost, port: config.printerPort });
    }
    
    // 2. Impresora local CUPS (usar texto plano)
    if (config.printerName) {
      try {
        const textTicket = buildSaleTicketText(sale);
        await printWithCups(textTicket, config.printerName);
        return reply.send({ printed: true, method: 'cups', printer: config.printerName });
      } catch (err: any) {
        return reply.code(500).send({ printed: false, error: err.message });
      }
    }
    
    // 3. Descargar archivo
    reply.header('Content-Type', 'application/octet-stream');
    reply.header('Content-Disposition', `attachment; filename="ticket-${id}.escpos"`);
    return reply.send(Buffer.from(bytes));
  });

  // Nueva ruta: Imprimir recibo POST (para imprimir directamente)
  app.post('/sales/:id/print', {
    schema: {
      summary: 'Imprimir recibo directamente',
      tags: ['sales'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const id = (request.params as any).id as string;
    const sale = await app.prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true, presentation: true } }, warehouse: true, user: true },
    });
    if (!sale) return reply.code(404).send({ message: 'Venta no encontrada' });

    // Intentar imprimir
    if (config.printerHost) {
      // Impresora de red: usar ESC/POS binario
      const bytes = buildSaleTicketEscpos(sale);
      try {
        await new Promise<void>((resolve, reject) => {
          const socket = new net.Socket();
          socket.on('error', reject);
          socket.connect(config.printerPort, config.printerHost as string, () => {
            socket.write(Buffer.from(bytes), (err) => {
              if (err) reject(err);
              socket.end();
              resolve();
            });
          });
        });
        return reply.send({ success: true, method: 'network', printer: `${config.printerHost}:${config.printerPort}` });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
    
    if (config.printerName) {
      // Impresora CUPS: usar texto plano
      try {
        const textTicket = buildSaleTicketText(sale);
        await printWithCups(textTicket, config.printerName);
        return reply.send({ success: true, method: 'cups', printer: config.printerName });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
    
    return reply.code(400).send({ success: false, error: 'No hay impresora configurada. Configure PRINTER_NAME o PRINTER_HOST en las variables de entorno.' });
  });

  // Abrir caja registradora (cash drawer)
  app.post('/sales/open-drawer', {
    schema: {
      summary: 'Abrir caja registradora',
      tags: ['sales'],
    },
  }, async (request, reply) => {
    // Comando ESC/POS para abrir caja: ESC p m t1 t2
    // m = pin del cajón (0 o 1), t1 = tiempo pulso ON, t2 = tiempo pulso OFF
    const openDrawerCmd = Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]); // ESC p 0 25 250
    
    // 1. Intentar impresora de red
    if (config.printerHost) {
      try {
        await new Promise<void>((resolve, reject) => {
          const socket = new net.Socket();
          socket.on('error', reject);
          socket.connect(config.printerPort, config.printerHost as string, () => {
            socket.write(openDrawerCmd, (err) => {
              if (err) reject(err);
              socket.end();
              resolve();
            });
          });
        });
        return reply.send({ success: true, method: 'network' });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
    
    // 2. Intentar impresora CUPS (enviar comando binario directamente)
    if (config.printerName) {
      try {
        const tmpFile = path.join(os.tmpdir(), `drawer-${Date.now()}.bin`);
        await fs.promises.writeFile(tmpFile, openDrawerCmd);
        await execAsync(`lp -d "${config.printerName}" -o raw "${tmpFile}"`);
        await fs.promises.unlink(tmpFile).catch(() => {});
        return reply.send({ success: true, method: 'cups' });
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    }
    
    return reply.code(400).send({ success: false, error: 'No hay impresora configurada' });
  });

  // Eliminar venta
  app.delete('/sales/:id', {
    schema: {
      summary: 'Eliminar venta',
      tags: ['sales'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const sale = await app.prisma.sale.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!sale) {
      return reply.code(404).send({ message: 'Venta no encontrada' });
    }

    // Restaurar stock de cada producto
    for (const item of sale.items) {
      await app.prisma.product.update({
        where: { id: item.productId },
        data: {
          baseStock: {
            increment: Number(item.baseQuantity)
          }
        }
      });

      // Registrar movimiento de inventario inverso
      await app.prisma.inventoryMovement.create({
        data: {
          productId: item.productId,
          warehouseId: sale.warehouseId,
          quantity: Number(item.baseQuantity),
          type: 'IN',
          referenceId: `DELETE-${sale.id}`,
        },
      });
    }

    // Eliminar movimientos de caja relacionados
    await app.prisma.cashMovement.deleteMany({
      where: { referenceId: sale.id, referenceType: 'SALE' }
    });

    // Eliminar items de la venta
    await app.prisma.saleItem.deleteMany({
      where: { saleId: id }
    });

    // Eliminar la venta
    await app.prisma.sale.delete({
      where: { id }
    });

    return { success: true, message: 'Venta eliminada correctamente' };
  });
}


