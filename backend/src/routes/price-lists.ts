import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function priceListRoutes(app: FastifyInstance) {
  // Schema de validación
  const priceListSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    description: z.string().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });

  // Listar todas las listas de precios
  app.get('/price-lists', {
    schema: {
      summary: 'Listar listas de precios',
      tags: ['price-lists'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              isDefault: { type: 'boolean' },
              isActive: { type: 'boolean' },
            },
          },
        },
      },
    },
  }, async () => {
    const priceLists = await app.prisma.priceList.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return priceLists;
  });

  // Obtener lista de precios por ID
  app.get('/price-lists/:id', {
    schema: {
      summary: 'Obtener lista de precios',
      tags: ['price-lists'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const priceList = await app.prisma.priceList.findUnique({
      where: { id },
      include: {
        prices: {
          include: { product: true },
        },
      },
    });
    if (!priceList) {
      return reply.code(404).send({ message: 'Lista de precios no encontrada' });
    }
    return {
      ...priceList,
      prices: priceList.prices.map((p) => ({
        ...p,
        price: p.price.toString(),
      })),
    };
  });

  // Crear lista de precios
  app.post('/price-lists', {
    schema: {
      summary: 'Crear lista de precios',
      tags: ['price-lists'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          isDefault: { type: 'boolean' },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = priceListSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }

    // Si es default, quitar el default de las demás
    if (parsed.data.isDefault) {
      await app.prisma.priceList.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const priceList = await app.prisma.priceList.create({
      data: parsed.data,
    });
    return priceList;
  });

  // Actualizar lista de precios
  app.patch('/price-lists/:id', {
    schema: {
      summary: 'Actualizar lista de precios',
      tags: ['price-lists'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = priceListSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }

    // Si es default, quitar el default de las demás
    if (parsed.data.isDefault) {
      await app.prisma.priceList.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    try {
      const priceList = await app.prisma.priceList.update({
        where: { id },
        data: parsed.data,
      });
      return priceList;
    } catch (error) {
      return reply.code(404).send({ message: 'Lista de precios no encontrada' });
    }
  });

  // Establecer precio de producto en una lista
  app.post('/price-lists/:id/prices', {
    schema: {
      summary: 'Establecer precio de producto',
      tags: ['price-lists'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['productId', 'price'],
        properties: {
          productId: { type: 'string' },
          price: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { productId: string; price: string };

    const priceRecord = await app.prisma.productPrice.upsert({
      where: {
        productId_priceListId: {
          productId: body.productId,
          priceListId: id,
        },
      },
      update: { price: body.price as any },
      create: {
        productId: body.productId,
        priceListId: id,
        price: body.price as any,
      },
    });

    return {
      ...priceRecord,
      price: priceRecord.price.toString(),
    };
  });

  // Obtener precios de un producto en todas las listas
  app.get('/products/:productId/prices', {
    schema: {
      summary: 'Obtener precios de producto',
      tags: ['price-lists'],
      params: {
        type: 'object',
        required: ['productId'],
        properties: { productId: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { productId } = request.params as { productId: string };
    const prices = await app.prisma.productPrice.findMany({
      where: { productId },
      include: { priceList: true },
    });
    return prices.map((p) => ({
      ...p,
      price: p.price.toString(),
    }));
  });

  // Eliminar lista de precios (soft delete)
  app.delete('/price-lists/:id', {
    schema: {
      summary: 'Eliminar lista de precios',
      tags: ['price-lists'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // No permitir eliminar la lista por defecto
    const priceList = await app.prisma.priceList.findUnique({ where: { id } });
    if (priceList?.isDefault) {
      return reply.code(400).send({ message: 'No se puede eliminar la lista de precios por defecto' });
    }

    try {
      await app.prisma.priceList.update({
        where: { id },
        data: { isActive: false },
      });
      return { message: 'Lista de precios eliminada' };
    } catch (error) {
      return reply.code(404).send({ message: 'Lista de precios no encontrada' });
    }
  });
}
