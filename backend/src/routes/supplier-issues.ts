import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function supplierIssuesRoutes(app: FastifyInstance) {
  
  // ============ LISTAR PENDIENTES DE UN PROVEEDOR ============
  app.get('/suppliers/:supplierId/issues', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { supplierId } = request.params as { supplierId: string };
    const { resolved } = request.query as { resolved?: string };
    
    const where: any = { supplierId };
    if (resolved === 'true') {
      where.isResolved = true;
    } else if (resolved === 'false') {
      where.isResolved = false;
    }
    
    const issues = await app.prisma.supplierPendingIssue.findMany({
      where,
      orderBy: [
        { isResolved: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    return issues;
  });

  // ============ CREAR PENDIENTE ============
  app.post('/suppliers/:supplierId/issues', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { supplierId } = request.params as { supplierId: string };
    
    const schema = z.object({
      purchaseId: z.string().nullable().optional(),
      type: z.enum(['productos_malos', 'cambio_pendiente', 'productos_vencidos', 'faltante', 'devolucion', 'otro']),
      description: z.string().min(1, 'La descripción es requerida'),
      amount: z.union([z.string(), z.number(), z.null()]).optional()
    });
    
    const data = schema.parse(request.body);
    
    // Verificar que el proveedor existe
    const supplier = await app.prisma.supplier.findUnique({
      where: { id: supplierId }
    });
    
    if (!supplier) {
      return reply.status(404).send({ message: 'Proveedor no encontrado' });
    }
    
    // Parsear amount correctamente
    let parsedAmount: number | null = null;
    if (data.amount !== null && data.amount !== undefined && data.amount !== '') {
      const numAmount = typeof data.amount === 'number' ? data.amount : parseFloat(data.amount);
      if (!isNaN(numAmount) && numAmount > 0) {
        parsedAmount = numAmount;
      }
    }
    
    const issue = await app.prisma.supplierPendingIssue.create({
      data: {
        supplierId,
        purchaseId: data.purchaseId || null,
        type: data.type,
        description: data.description,
        amount: parsedAmount
      }
    });
    
    return issue;
  });

  // ============ MARCAR PENDIENTE COMO RESUELTO ============
  app.put('/supplier-issues/:id/resolve', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const schema = z.object({
      resolvedNotes: z.string().optional()
    });
    
    const data = schema.parse(request.body);
    
    const issue = await app.prisma.supplierPendingIssue.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedNotes: data.resolvedNotes || null
      }
    });
    
    return issue;
  });

  // ============ REABRIR PENDIENTE ============
  app.put('/supplier-issues/:id/reopen', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const issue = await app.prisma.supplierPendingIssue.update({
      where: { id },
      data: {
        isResolved: false,
        resolvedAt: null,
        resolvedNotes: null
      }
    });
    
    return issue;
  });

  // ============ ELIMINAR PENDIENTE ============
  app.delete('/supplier-issues/:id', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    await app.prisma.supplierPendingIssue.delete({
      where: { id }
    });
    
    return { success: true };
  });

  // ============ OBTENER TODOS LOS PENDIENTES NO RESUELTOS ============
  app.get('/supplier-issues/pending', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const issues = await app.prisma.supplierPendingIssue.findMany({
      where: { isResolved: false },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return issues;
  });

  // ============ ESTADÍSTICAS DE PENDIENTES ============
  app.get('/supplier-issues/stats', {
    preHandler: [app.authenticate]
  }, async (request, reply) => {
    const [total, pending, resolved, byType, suppliersWithPending] = await Promise.all([
      app.prisma.supplierPendingIssue.count(),
      app.prisma.supplierPendingIssue.count({ where: { isResolved: false } }),
      app.prisma.supplierPendingIssue.count({ where: { isResolved: true } }),
      app.prisma.supplierPendingIssue.groupBy({
        by: ['type'],
        where: { isResolved: false },
        _count: true
      }),
      app.prisma.supplier.findMany({
        where: {
          pendingIssues: {
            some: { isResolved: false }
          }
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              pendingIssues: {
                where: { isResolved: false }
              }
            }
          }
        }
      })
    ]);
    
    return {
      total,
      pending,
      resolved,
      byType: byType.map(t => ({ type: t.type, count: t._count })),
      suppliersWithPending: suppliersWithPending.map(s => ({
        id: s.id,
        name: s.name,
        pendingCount: s._count.pendingIssues
      }))
    };
  });
}
