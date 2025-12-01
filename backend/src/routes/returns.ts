import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function returnsRoutes(app: FastifyInstance) {
  // Schema para crear devolución
  const createReturnSchema = z.object({
    warehouseId: z.string(),
    saleId: z.string().optional().nullable(),
    productId: z.string(),
    presentationId: z.string().optional().nullable(),
    quantity: z.number().positive(),
    baseQuantity: z.number().positive(),
    unitPrice: z.number().positive(),
    reason: z.string().min(1),
    notes: z.string().optional().nullable(),
  });

  // Crear devolución
  app.post('/returns', {
    schema: {
      summary: 'Registrar devolución de producto',
      tags: ['returns'],
      body: {
        type: 'object',
        required: ['warehouseId', 'productId', 'quantity', 'baseQuantity', 'unitPrice', 'reason'],
        properties: {
          warehouseId: { type: 'string' },
          saleId: { type: 'string', nullable: true },
          productId: { type: 'string' },
          presentationId: { type: 'string', nullable: true },
          quantity: { type: 'number' },
          baseQuantity: { type: 'number' },
          unitPrice: { type: 'number' },
          reason: { type: 'string' },
          notes: { type: 'string', nullable: true },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createReturnSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }

    const data = parsed.data;
    const userId = (request as any).user?.sub;
    const total = data.quantity * data.unitPrice;

    try {
      // Usar transacción para asegurar integridad
      const result = await app.prisma.$transaction(async (tx) => {
        // 1. Crear el registro de devolución
        const productReturn = await tx.productReturn.create({
          data: {
            warehouseId: data.warehouseId,
            saleId: data.saleId || null,
            productId: data.productId,
            presentationId: data.presentationId || null,
            quantity: data.quantity,
            baseQuantity: data.baseQuantity,
            unitPrice: data.unitPrice,
            total: total,
            reason: data.reason,
            notes: data.notes || null,
            userId: userId || null,
          },
        });

        // 2. Devolver stock al inventario (incrementar)
        await tx.product.update({
          where: { id: data.productId },
          data: {
            baseStock: {
              increment: data.baseQuantity,
            },
          },
        });

        // 3. Registrar movimiento de inventario (entrada por devolución)
        await tx.inventoryMovement.create({
          data: {
            productId: data.productId,
            warehouseId: data.warehouseId,
            quantity: data.baseQuantity,
            type: 'IN',
            referenceId: `RETURN-${productReturn.id}`,
            notes: `Devolución: ${data.reason}`,
            userId: userId || null,
          },
        });

        // 4. Descontar dinero de la caja (egreso)
        const session = await tx.cashSession.findFirst({
          where: { warehouseId: data.warehouseId, closedAt: null },
          orderBy: { openedAt: 'desc' },
        });

        if (session) {
          await tx.cashMovement.create({
            data: {
              sessionId: session.id,
              type: 'OUT',
              amount: total,
              referenceType: 'RETURN',
              referenceId: productReturn.id,
              notes: `Devolución de producto: ${data.reason}`,
            },
          });
        }

        // 5. Si hay venta asociada, marcarla como devuelta
        if (data.saleId) {
          const sale = await tx.sale.update({
            where: { id: data.saleId },
            data: { status: 'returned' },
            include: { order: true },
          });

          // 6. Si la venta vino de un fiado (Order), marcarlo como devuelto también
          if (sale.order) {
            await tx.order.update({
              where: { id: sale.order.id },
              data: { status: 'RETURNED' },
            });
          }
        }

        return productReturn;
      });

      // Obtener el registro creado con relaciones
      const fullReturn = await app.prisma.productReturn.findUnique({
        where: { id: result.id },
        include: {
          product: true,
          warehouse: true,
          user: { select: { id: true, username: true, name: true } },
        },
      });

      return {
        ...fullReturn,
        quantity: Number(fullReturn!.quantity),
        baseQuantity: Number(fullReturn!.baseQuantity),
        unitPrice: Number(fullReturn!.unitPrice),
        total: Number(fullReturn!.total),
      };
    } catch (error: any) {
      return reply.code(500).send({ message: error.message || 'Error al procesar devolución' });
    }
  });

  // Listar devoluciones
  app.get('/returns', {
    schema: {
      summary: 'Listar devoluciones',
      tags: ['returns'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          productId: { type: 'string' },
          warehouseId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as any;
    const limit = Math.min(Math.max(Number(query.limit ?? 50), 1), 200);
    const offset = Math.max(Number(query.offset ?? 0), 0);

    // Construir filtros
    const where: any = {};

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const [total, returns] = await Promise.all([
      app.prisma.productReturn.count({ where }),
      app.prisma.productReturn.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          product: true,
          warehouse: true,
          user: { select: { id: true, username: true, name: true } },
        },
      }),
    ]);

    reply.header('X-Total-Count', String(total));
    reply.header('X-Limit', String(limit));
    reply.header('X-Offset', String(offset));

    return returns.map(r => ({
      ...r,
      quantity: Number(r.quantity),
      baseQuantity: Number(r.baseQuantity),
      unitPrice: Number(r.unitPrice),
      total: Number(r.total),
    }));
  });

  // Obtener devolución por ID
  app.get('/returns/:id', {
    schema: {
      summary: 'Obtener devolución por ID',
      tags: ['returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const productReturn = await app.prisma.productReturn.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            presentations: true,
          },
        },
        warehouse: true,
        user: { select: { id: true, username: true, name: true } },
      },
    });

    if (!productReturn) {
      return reply.code(404).send({ message: 'Devolución no encontrada' });
    }

    return {
      ...productReturn,
      quantity: Number(productReturn.quantity),
      baseQuantity: Number(productReturn.baseQuantity),
      unitPrice: Number(productReturn.unitPrice),
      total: Number(productReturn.total),
    };
  });

  // Obtener resumen de devoluciones para contabilidad
  app.get('/returns/summary', {
    schema: {
      summary: 'Resumen de devoluciones',
      tags: ['returns'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          warehouseId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const query = request.query as any;

    const where: any = {};

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const endDate = new Date(query.endDate);
        endDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDate;
      }
    }

    const [returns, aggregate] = await Promise.all([
      app.prisma.productReturn.findMany({
        where,
        include: { product: true },
      }),
      app.prisma.productReturn.aggregate({
        where,
        _sum: { total: true },
        _count: true,
      }),
    ]);

    // Agrupar por motivo
    const byReason: Record<string, { count: number; total: number }> = {};
    for (const r of returns) {
      const reason = r.reason || 'Sin motivo';
      if (!byReason[reason]) {
        byReason[reason] = { count: 0, total: 0 };
      }
      byReason[reason].count++;
      byReason[reason].total += Number(r.total);
    }

    return {
      totalReturns: aggregate._count,
      totalAmount: Number(aggregate._sum.total || 0),
      byReason: Object.entries(byReason).map(([reason, data]) => ({
        reason,
        count: data.count,
        total: data.total,
      })),
    };
  });

  // Eliminar devolución (solo admin, revierte cambios)
  app.delete('/returns/:id', {
    schema: {
      summary: 'Eliminar/Revertir devolución',
      tags: ['returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;

    // Verificar que sea admin
    if (user?.role !== 'admin') {
      return reply.code(403).send({ message: 'Solo administradores pueden eliminar devoluciones' });
    }

    const productReturn = await app.prisma.productReturn.findUnique({
      where: { id },
    });

    if (!productReturn) {
      return reply.code(404).send({ message: 'Devolución no encontrada' });
    }

    try {
      await app.prisma.$transaction(async (tx) => {
        // 1. Restar stock del inventario (revertir la devolución)
        await tx.product.update({
          where: { id: productReturn.productId },
          data: {
            baseStock: {
              decrement: Number(productReturn.baseQuantity),
            },
          },
        });

        // 2. Registrar movimiento de inventario inverso
        await tx.inventoryMovement.create({
          data: {
            productId: productReturn.productId,
            warehouseId: productReturn.warehouseId,
            quantity: Number(productReturn.baseQuantity),
            type: 'OUT',
            referenceId: `RETURN-CANCEL-${productReturn.id}`,
            notes: `Cancelación de devolución #${productReturn.returnNumber}`,
            userId: user?.sub || null,
          },
        });

        // 3. Eliminar movimiento de caja relacionado
        await tx.cashMovement.deleteMany({
          where: {
            referenceType: 'RETURN',
            referenceId: productReturn.id,
          },
        });

        // 4. Si había venta asociada, restaurar su status a completada
        if (productReturn.saleId) {
          const sale = await tx.sale.update({
            where: { id: productReturn.saleId },
            data: { status: 'completed' },
            include: { order: true },
          });

          // 5. Si la venta vino de un fiado, restaurar el fiado a PAID
          if (sale.order) {
            await tx.order.update({
              where: { id: sale.order.id },
              data: { status: 'PAID' },
            });
          }
        }

        // 6. Eliminar la devolución
        await tx.productReturn.delete({
          where: { id },
        });
      });

      return { success: true, message: 'Devolución eliminada y cambios revertidos' };
    } catch (error: any) {
      return reply.code(500).send({ message: error.message || 'Error al eliminar devolución' });
    }
  });
}
