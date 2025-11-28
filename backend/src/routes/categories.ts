import { FastifyInstance } from 'fastify';
import { z } from 'zod';

export async function categoryRoutes(app: FastifyInstance) {
  // Schema de validación
  const categorySchema = z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    description: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  // Listar todas las categorías
  app.get('/categories', {
    schema: {
      summary: 'Listar categorías',
      tags: ['categories'],
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string', nullable: true },
              color: { type: 'string', nullable: true },
              icon: { type: 'string', nullable: true },
              isActive: { type: 'boolean' },
              _count: {
                type: 'object',
                properties: {
                  products: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  }, async () => {
    const categories = await app.prisma.category.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return categories;
  });

  // Obtener categoría por ID
  app.get('/categories/:id', {
    schema: {
      summary: 'Obtener categoría',
      tags: ['categories'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const category = await app.prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
    if (!category) {
      return reply.code(404).send({ message: 'Categoría no encontrada' });
    }
    return category;
  });

  // Crear categoría
  app.post('/categories', {
    schema: {
      summary: 'Crear categoría',
      tags: ['categories'],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'string' },
          icon: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = categorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }

    const existing = await app.prisma.category.findUnique({
      where: { name: parsed.data.name },
    });
    if (existing) {
      return reply.code(400).send({ message: 'Ya existe una categoría con ese nombre' });
    }

    const category = await app.prisma.category.create({
      data: parsed.data,
    });
    return category;
  });

  // Actualizar categoría
  app.patch('/categories/:id', {
    schema: {
      summary: 'Actualizar categoría',
      tags: ['categories'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          color: { type: 'string' },
          icon: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = categorySchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }

    try {
      const category = await app.prisma.category.update({
        where: { id },
        data: parsed.data,
      });
      return category;
    } catch (error) {
      return reply.code(404).send({ message: 'Categoría no encontrada' });
    }
  });

  // Eliminar categoría (soft delete)
  app.delete('/categories/:id', {
    schema: {
      summary: 'Eliminar categoría',
      tags: ['categories'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    // Verificar si tiene productos
    const productsCount = await app.prisma.product.count({
      where: { categoryId: id },
    });

    if (productsCount > 0) {
      return reply.code(400).send({
        message: `No se puede eliminar la categoría porque tiene ${productsCount} productos asociados`,
      });
    }

    try {
      await app.prisma.category.update({
        where: { id },
        data: { isActive: false },
      });
      return { message: 'Categoría eliminada' };
    } catch (error) {
      return reply.code(404).send({ message: 'Categoría no encontrada' });
    }
  });
}
