import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';

export default async function ordersRoutes(fastify: FastifyInstance) {
  // Listar pedidos (fiados)
  fastify.get('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { status, search, page = '1', limit = '50' } = request.query as {
      status?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: Prisma.OrderWhereInput = {};

    if (status && status !== 'ALL') {
      where.status = status as 'PENDING' | 'PAID' | 'CANCELLED';
    }

    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [orders, totalCount] = await Promise.all([
      fastify.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: true
            }
          },
          warehouse: true,
          user: { select: { id: true, username: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      fastify.prisma.order.count({ where })
    ]);

    // Serializar decimales
    const serializedOrders = orders.map(order => ({
      ...order,
      total: order.total.toNumber(),
      items: order.items.map(item => ({
        ...item,
        quantity: item.quantity.toNumber(),
        baseQuantity: item.baseQuantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        subtotal: item.subtotal.toNumber()
      }))
    }));

    return { orders: serializedOrders, total: totalCount, page: parseInt(page), limit: parseInt(limit) };
  });

  // Obtener un pedido por ID
  fastify.get('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const order = await fastify.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true
          }
        },
        warehouse: true,
        user: { select: { id: true, username: true, name: true } }
      }
    });

    if (!order) {
      return reply.status(404).send({ error: 'Pedido no encontrado' });
    }

    return {
      ...order,
      total: order.total.toNumber(),
      items: order.items.map(item => ({
        ...item,
        quantity: item.quantity.toNumber(),
        baseQuantity: item.baseQuantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        subtotal: item.subtotal.toNumber()
      }))
    };
  });

  // Crear pedido (fiado)
  fastify.post('/', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const userId = (request as any).user?.sub;
    const { 
      customerName, 
      customerPhone, 
      notes,
      dueDate,
      warehouseId, 
      priceType,
      items 
    } = request.body as {
      customerName: string;
      customerPhone?: string;
      notes?: string;
      dueDate?: string;
      warehouseId: string;
      priceType: string;
      items: Array<{
        productId: string;
        productName: string;
        presentationId?: string;
        presentationName?: string;
        quantity: number;
        baseQuantity: number;
        unitPrice: number;
      }>;
    };

    if (!customerName || !items || items.length === 0) {
      return reply.status(400).send({ error: 'Nombre del cliente y items son requeridos' });
    }

    // Calcular total
    const total = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

    // Crear pedido con items
    const order = await fastify.prisma.order.create({
      data: {
        customerName,
        customerPhone,
        notes,
        dueDate: dueDate ? new Date(dueDate) : null,
        warehouseId,
        priceType,
        total,
        status: 'PENDING',
        userId: userId || null,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            presentationId: item.presentationId || null,
            presentationName: item.presentationName || null,
            quantity: item.quantity,
            baseQuantity: item.baseQuantity,
            unitPrice: item.unitPrice,
            subtotal: item.quantity * item.unitPrice
          }))
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Descontar del inventario (baseStock)
    for (const item of items) {
      await fastify.prisma.product.update({
        where: { id: item.productId },
        data: {
          baseStock: {
            decrement: item.baseQuantity
          }
        }
      });
    }

    return {
      ...order,
      total: order.total.toNumber(),
      items: order.items.map(item => ({
        ...item,
        quantity: item.quantity.toNumber(),
        baseQuantity: item.baseQuantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        subtotal: item.subtotal.toNumber()
      }))
    };
  });

  // Marcar como pagado
  fastify.post('/:id/pay', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { paymentMethod } = request.body as { paymentMethod: string };
    const userId = (request as any).user?.sub;

    const order = await fastify.prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return reply.status(404).send({ error: 'Pedido no encontrado' });
    }

    if (order.status === 'PAID') {
      return reply.status(400).send({ error: 'Este pedido ya está pagado' });
    }

    if (order.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'No se puede pagar un pedido cancelado' });
    }

    // Crear venta asociada
    const sale = await fastify.prisma.sale.create({
      data: {
        warehouseId: order.warehouseId,
        total: order.total,
        userId: userId || null,
        paymentMethod: paymentMethod,
        priceType: order.priceType || 'publico', // Mantener el tipo de precio del fiado
        items: {
          create: order.items.map(item => ({
            productId: item.productId,
            presentationId: item.presentationId,
            quantity: item.quantity,
            baseQuantity: item.baseQuantity,
            unitPrice: item.unitPrice,
            subtotal: item.subtotal
          }))
        }
      }
    });

    // Actualizar pedido como pagado
    const updatedOrder = await fastify.prisma.order.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
        paymentMethod,
        paidByUserId: userId || null,
        saleId: sale.id
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    return {
      ...updatedOrder,
      total: updatedOrder.total.toNumber(),
      items: updatedOrder.items.map(item => ({
        ...item,
        quantity: item.quantity.toNumber(),
        baseQuantity: item.baseQuantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        subtotal: item.subtotal.toNumber()
      }))
    };
  });

  // Cancelar pedido (devuelve stock)
  fastify.post('/:id/cancel', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const order = await fastify.prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return reply.status(404).send({ error: 'Pedido no encontrado' });
    }

    if (order.status === 'PAID') {
      return reply.status(400).send({ error: 'No se puede cancelar un pedido ya pagado' });
    }

    if (order.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Este pedido ya está cancelado' });
    }

    // Devolver stock
    for (const item of order.items) {
      await fastify.prisma.product.update({
        where: { id: item.productId },
        data: {
          baseStock: {
            increment: item.baseQuantity
          }
        }
      });
    }

    const updatedOrder = await fastify.prisma.order.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    return {
      ...updatedOrder,
      total: updatedOrder.total.toNumber(),
      items: updatedOrder.items.map(item => ({
        ...item,
        quantity: item.quantity.toNumber(),
        baseQuantity: item.baseQuantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        subtotal: item.subtotal.toNumber()
      }))
    };
  });

  // Eliminar pedido (cualquier estado)
  fastify.delete('/:id', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const order = await fastify.prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return reply.status(404).send({ error: 'Pedido no encontrado' });
    }

    // Si el fiado está pendiente, devolver stock al inventario
    if (order.status === 'PENDING') {
      const items = await fastify.prisma.orderItem.findMany({
        where: { orderId: id }
      });

      for (const item of items) {
        await fastify.prisma.product.update({
          where: { id: item.productId },
          data: {
            baseStock: { increment: item.baseQuantity }
          }
        });
      }
    }

    await fastify.prisma.orderItem.deleteMany({
      where: { orderId: id }
    });

    await fastify.prisma.order.delete({
      where: { id }
    });

    return { success: true };
  });

  // Estadísticas de fiados
  fastify.get('/stats/summary', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const [pending, paid, cancelled, returned] = await Promise.all([
      fastify.prisma.order.aggregate({
        where: { status: 'PENDING' },
        _sum: { total: true },
        _count: true
      }),
      fastify.prisma.order.aggregate({
        where: { status: 'PAID' },
        _sum: { total: true },
        _count: true
      }),
      fastify.prisma.order.aggregate({
        where: { status: 'CANCELLED' },
        _count: true
      }),
      fastify.prisma.order.aggregate({
        where: { status: 'RETURNED' },
        _sum: { total: true },
        _count: true
      })
    ]);

    return {
      pending: {
        count: pending._count,
        total: pending._sum.total?.toNumber() || 0
      },
      paid: {
        count: paid._count,
        total: paid._sum.total?.toNumber() || 0
      },
      cancelled: {
        count: cancelled._count
      },
      returned: {
        count: returned._count,
        total: returned._sum.total?.toNumber() || 0
      },
      totalPending: pending._sum.total?.toNumber() || 0
    };
  });
}
