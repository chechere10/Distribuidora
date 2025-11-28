import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function supplierRoutes(app: FastifyInstance) {
  
  // Listar proveedores
  app.get('/suppliers', {
    schema: {
      summary: 'Listar proveedores',
      tags: ['suppliers'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string' },
          isActive: { type: 'boolean' },
          limit: { type: 'integer' },
          offset: { type: 'integer' }
        }
      }
    }
  }, async (request, reply) => {
    const query = request.query as { search?: string; isActive?: boolean; limit?: number; offset?: number };
    const limit = Math.min(query.limit || 50, 200);
    const offset = query.offset || 0;

    const where: any = {};
    
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { contactName: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { nit: { contains: query.search, mode: 'insensitive' } }
      ];
    }

    const [total, suppliers] = await Promise.all([
      app.prisma.supplier.count({ where }),
      app.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
        include: {
          _count: {
            select: { 
              purchases: true,
              pendingIssues: {
                where: { isResolved: false }
              }
            }
          }
        }
      })
    ]);

    reply.header('X-Total-Count', String(total));
    return suppliers;
  });

  // Obtener proveedor por ID
  app.get('/suppliers/:id', {
    schema: {
      summary: 'Obtener proveedor',
      tags: ['suppliers'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const supplier = await app.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            items: true
          }
        },
        _count: {
          select: { purchases: true }
        }
      }
    });

    if (!supplier) {
      return reply.code(404).send({ message: 'Proveedor no encontrado' });
    }

    return {
      ...supplier,
      purchases: supplier.purchases.map(p => ({
        ...p,
        total: Number(p.total),
        subtotal: Number(p.subtotal)
      }))
    };
  });

  // Crear proveedor
  app.post('/suppliers', {
    schema: {
      summary: 'Crear proveedor',
      tags: ['suppliers'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          contactName: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          nit: { type: 'string' },
          notes: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      contactName: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().or(z.literal('')),
      address: z.string().optional(),
      nit: z.string().optional(),
      notes: z.string().optional()
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }

    const supplier = await app.prisma.supplier.create({
      data: {
        ...parsed.data,
        email: parsed.data.email || null
      }
    });

    return supplier;
  });

  // Actualizar proveedor
  app.put('/suppliers/:id', {
    schema: {
      summary: 'Actualizar proveedor',
      tags: ['suppliers'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          contactName: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          nit: { type: 'string' },
          notes: { type: 'string' },
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const supplier = await app.prisma.supplier.update({
      where: { id },
      data: body
    });

    return supplier;
  });

  // Eliminar proveedor
  app.delete('/suppliers/:id', {
    schema: {
      summary: 'Eliminar proveedor',
      tags: ['suppliers'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verificar si tiene compras
    const purchaseCount = await app.prisma.purchase.count({
      where: { supplierId: id }
    });

    if (purchaseCount > 0) {
      // Solo desactivar si tiene compras
      await app.prisma.supplier.update({
        where: { id },
        data: { isActive: false }
      });
      return { success: true, message: 'Proveedor desactivado (tiene compras asociadas)' };
    }

    await app.prisma.supplier.delete({ where: { id } });
    return { success: true, message: 'Proveedor eliminado' };
  });
}