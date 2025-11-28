import { FastifyInstance } from 'fastify';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/notifications', {
    schema: {
      summary: 'Listar notificaciones',
      tags: ['notifications'],
      querystring: { type: 'object', properties: { onlyOpen: { type: 'string' }, limit: { type: 'integer' }, offset: { type: 'integer' } } },
      response: { 200: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' }, message: { type: 'string' }, resolvedAt: { type: 'string', nullable: true } } } } },
    },
  }, async (request, reply) => {
    const qp = (request.query as any) ?? {};
    const onlyOpen = ((qp.onlyOpen ?? 'true') === 'true');
    const limit = Math.min(Math.max(Number(qp.limit ?? 50), 1), 200);
    const offset = Math.max(Number(qp.offset ?? 0), 0);
    const where = onlyOpen ? { resolvedAt: null } : undefined;
    const [total, rows] = await Promise.all([
      app.prisma.notification.count({ where }),
      app.prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
    ]);
    reply.header('X-Total-Count', String(total));
    reply.header('X-Limit', String(limit));
    reply.header('X-Offset', String(offset));
    return rows;
  });

  app.patch('/notifications/:id/resolve', {
    schema: {
      summary: 'Resolver notificación',
      tags: ['notifications'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { id: { type: 'string' }, resolvedAt: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const id = (request.params as any).id as string;
    try {
      const updated = await app.prisma.notification.update({ where: { id }, data: { resolvedAt: new Date() } });
      return updated;
    } catch {
      return reply.code(404).send({ message: 'Not found' });
    }
  });
}


