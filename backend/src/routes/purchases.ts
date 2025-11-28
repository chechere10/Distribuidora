import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function purchaseRoutes(app: FastifyInstance) {
  
  // ============ SCHEMAS ============
  const purchaseItemSchema = z.object({
    productId: z.string(),
    productName: z.string(),
    presentationId: z.string().optional().nullable(),
    presentationName: z.string().optional().nullable(),
    quantity: z.number().positive(),
    baseQuantity: z.number().positive(),
    unitCost: z.number().nonnegative(),
    subtotal: z.number().nonnegative()
  });

  const createPurchaseSchema = z.object({
    supplierId: z.string().optional().nullable(),
    supplierName: z.string().optional(),
    warehouseId: z.string(),
    invoiceNumber: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(purchaseItemSchema).min(1),
    discount: z.number().optional().default(0),
    tax: z.number().optional().default(0)
  });

  // ============ LISTAR COMPRAS ============
  app.get('/purchases', {
    schema: {
      summary: 'Listar compras',
      tags: ['purchases'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          supplierId: { type: 'string' },
          status: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          limit: { type: 'integer' },
          offset: { type: 'integer' }
        }
      }
    }
  }, async (request, reply) => {
    const query = request.query as any;
    const limit = Math.min(query.limit || 50, 200);
    const offset = query.offset || 0;

    const where: any = {};

    if (query.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (query.search) {
      where.OR = [
        { supplierName: { contains: query.search, mode: 'insensitive' } },
        { invoiceNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    const [total, purchases] = await Promise.all([
      app.prisma.purchase.count({ where }),
      app.prisma.purchase.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          supplier: true,
          warehouse: true,
          user: { select: { id: true, username: true, name: true } },
          items: {
            include: {
              product: true
            }
          }
        }
      })
    ]);

    reply.header('X-Total-Count', String(total));
    
    return purchases.map(p => ({
      ...p,
      total: Number(p.total),
      subtotal: Number(p.subtotal),
      tax: p.tax ? Number(p.tax) : 0,
      discount: p.discount ? Number(p.discount) : 0,
      items: p.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        baseQuantity: Number(item.baseQuantity),
        unitCost: Number(item.unitCost),
        subtotal: Number(item.subtotal)
      }))
    }));
  });

  // ============ OBTENER COMPRA POR ID ============
  app.get('/purchases/:id', {
    schema: {
      summary: 'Obtener compra',
      tags: ['purchases'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const purchase = await app.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        user: { select: { id: true, username: true, name: true } },
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!purchase) {
      return reply.code(404).send({ message: 'Compra no encontrada' });
    }

    return {
      ...purchase,
      total: Number(purchase.total),
      subtotal: Number(purchase.subtotal),
      tax: purchase.tax ? Number(purchase.tax) : 0,
      discount: purchase.discount ? Number(purchase.discount) : 0,
      items: purchase.items.map(item => ({
        ...item,
        quantity: Number(item.quantity),
        baseQuantity: Number(item.baseQuantity),
        unitCost: Number(item.unitCost),
        subtotal: Number(item.subtotal)
      }))
    };
  });

  // ============ CREAR COMPRA ============
  app.post('/purchases', {
    schema: {
      summary: 'Crear compra',
      tags: ['purchases'],
      body: {
        type: 'object',
        required: ['warehouseId', 'items'],
        properties: {
          supplierId: { type: 'string', nullable: true },
          supplierName: { type: 'string' },
          warehouseId: { type: 'string' },
          invoiceNumber: { type: 'string' },
          notes: { type: 'string' },
          discount: { type: 'number' },
          tax: { type: 'number' },
          items: { type: 'array', minItems: 1 }
        }
      }
    }
  }, async (request, reply) => {
    const parsed = createPurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }

    const { supplierId, supplierName, warehouseId, invoiceNumber, notes, items, discount, tax } = parsed.data;
    const userId = (request as any).user?.sub;

    try {
      const result = await app.prisma.$transaction(async (tx) => {
        // Calcular totales
        const subtotal = items.reduce((acc, item) => acc + item.subtotal, 0);
        const total = subtotal + (tax || 0) - (discount || 0);

        // Obtener nombre del proveedor si tiene ID
        let finalSupplierName = supplierName;
        if (supplierId) {
          const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
          if (supplier) {
            finalSupplierName = supplier.name;
          }
        }

        // Crear compra
        const purchase = await tx.purchase.create({
          data: {
            supplierId: supplierId || null,
            supplierName: finalSupplierName || null,
            warehouseId,
            invoiceNumber: invoiceNumber || null,
            notes: notes || null,
            subtotal: subtotal.toFixed(2) as any,
            tax: (tax || 0).toFixed(2) as any,
            discount: (discount || 0).toFixed(2) as any,
            total: total.toFixed(2) as any,
            status: 'RECEIVED',
            userId: userId || null,
          }
        });

        // Crear items y actualizar inventario
        for (const item of items) {
          // Crear item de compra
          await tx.purchaseItem.create({
            data: {
              purchaseId: purchase.id,
              productId: item.productId,
              productName: item.productName,
              presentationId: item.presentationId || null,
              presentationName: item.presentationName || null,
              quantity: item.quantity,
              baseQuantity: item.baseQuantity,
              unitCost: item.unitCost.toFixed(2) as any,
              subtotal: item.subtotal.toFixed(2) as any
            }
          });

          // Obtener producto actual
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw new Error(`Producto ${item.productName} no encontrado`);

          // Calcular nuevo costo promedio
          const currentStock = Number(product.baseStock);
          const currentCost = Number(product.cost) || 0;
          const incomingQty = item.baseQuantity;
          const incomingCost = item.unitCost;
          const newStock = currentStock + incomingQty;
          const newCost = newStock > 0 
            ? ((currentStock * currentCost) + (incomingQty * incomingCost)) / newStock 
            : incomingCost;

          // Actualizar producto (stock y costo)
          await tx.product.update({
            where: { id: item.productId },
            data: {
              baseStock: { increment: item.baseQuantity },
              cost: newCost.toFixed(2) as any
            }
          });

          // Registrar movimiento de inventario
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              warehouseId,
              quantity: item.baseQuantity,
              type: 'IN',
              referenceId: purchase.id,
              unitCost: item.unitCost.toFixed(2) as any,
              notes: `Compra #${purchase.purchaseNumber}${finalSupplierName ? ` - ${finalSupplierName}` : ''}`,
              userId: userId || null,
            }
          });

          // Actualizar StockLevel
          await tx.stockLevel.upsert({
            where: { productId_warehouseId: { productId: item.productId, warehouseId } },
            update: { onHand: { increment: item.baseQuantity } },
            create: { productId: item.productId, warehouseId, onHand: item.baseQuantity, minStock: 0 }
          });
        }

        return purchase;
      });

      // Obtener compra completa
      const fullPurchase = await app.prisma.purchase.findUnique({
        where: { id: result.id },
        include: {
          supplier: true,
          items: { include: { product: true } }
        }
      });

      return {
        ...fullPurchase,
        total: Number(fullPurchase!.total),
        subtotal: Number(fullPurchase!.subtotal)
      };
    } catch (e: any) {
      return reply.code(400).send({ message: e.message || 'Error al crear compra' });
    }
  });

  // ============ ELIMINAR COMPRA ============
  app.delete('/purchases/:id', {
    schema: {
      summary: 'Eliminar compra (revierte inventario)',
      tags: ['purchases'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const purchase = await app.prisma.purchase.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!purchase) {
      return reply.code(404).send({ message: 'Compra no encontrada' });
    }

    try {
      await app.prisma.$transaction(async (tx) => {
        // Revertir stock de cada producto
        for (const item of purchase.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              baseStock: { decrement: Number(item.baseQuantity) }
            }
          });

          // Registrar movimiento de salida
          await tx.inventoryMovement.create({
            data: {
              productId: item.productId,
              warehouseId: purchase.warehouseId,
              quantity: -Number(item.baseQuantity),
              type: 'OUT',
              referenceId: `DELETE-${purchase.id}`,
              notes: `Eliminación de compra #${purchase.purchaseNumber}`
            }
          });

          // Actualizar StockLevel
          const level = await tx.stockLevel.findUnique({
            where: { productId_warehouseId: { productId: item.productId, warehouseId: purchase.warehouseId } }
          });
          if (level) {
            await tx.stockLevel.update({
              where: { productId_warehouseId: { productId: item.productId, warehouseId: purchase.warehouseId } },
              data: { onHand: { decrement: Number(item.baseQuantity) } }
            });
          }
        }

        // Eliminar items
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

        // Eliminar compra
        await tx.purchase.delete({ where: { id } });
      });

      return { success: true, message: 'Compra eliminada y stock revertido' };
    } catch (e: any) {
      return reply.code(400).send({ message: e.message || 'Error al eliminar compra' });
    }
  });

  // ============ ESTADÍSTICAS DE COMPRAS ============
  app.get('/purchases/stats/summary', {
    schema: {
      summary: 'Estadísticas de compras',
      tags: ['purchases'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const query = request.query as { startDate?: string; endDate?: string };

    const where: any = { status: 'RECEIVED' };

    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) {
        where.date.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    const [totalPurchases, totalAmount, supplierCount] = await Promise.all([
      app.prisma.purchase.count({ where }),
      app.prisma.purchase.aggregate({
        where,
        _sum: { total: true }
      }),
      app.prisma.supplier.count({ where: { isActive: true } })
    ]);

    // Compras de hoy
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPurchases = await app.prisma.purchase.aggregate({
      where: {
        ...where,
        date: { gte: today }
      },
      _sum: { total: true },
      _count: true
    });

    // Este mes
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthPurchases = await app.prisma.purchase.aggregate({
      where: {
        ...where,
        date: { gte: monthStart }
      },
      _sum: { total: true },
      _count: true
    });

    return {
      total: {
        count: totalPurchases,
        amount: Number(totalAmount._sum.total || 0)
      },
      today: {
        count: todayPurchases._count || 0,
        amount: Number(todayPurchases._sum.total || 0)
      },
      month: {
        count: monthPurchases._count || 0,
        amount: Number(monthPurchases._sum.total || 0)
      },
      supplierCount
    };
  });
}
