import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function warehouseRoutes(app: FastifyInstance) {
  const bodySchema = z.object({ name: z.string().min(1) });

  app.get('/warehouses', {
    schema: {
      summary: 'Listar almacenes',
      tags: ['warehouses'],
      response: { 200: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } } },
    },
  }, async () => {
    return app.prisma.warehouse.findMany({ orderBy: { name: 'asc' } });
  });

  app.post('/warehouses', {
    schema: {
      summary: 'Crear almacén',
      tags: ['warehouses'],
      body: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos' });
    try {
      return await app.prisma.warehouse.create({ data: parsed.data });
    } catch (e) {
      return reply.code(400).send({ message: 'No se pudo crear' });
    }
  });
}


