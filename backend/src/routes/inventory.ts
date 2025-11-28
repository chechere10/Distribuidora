import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { applyMovement, transferStock } from '../lib/inventory';

export async function inventoryRoutes(app: FastifyInstance) {
  const movementSchema = z.object({
    productId: z.string().min(1),
    warehouseId: z.string().min(1),
    type: z.enum(['IN', 'OUT', 'ADJUST']),
    quantity: z.number().int().positive(),
    unitCost: z.string().optional(),
  });

  app.post('/inventory/movements', {
    schema: {
      summary: 'Aplicar movimiento de inventario',
      tags: ['inventory'],
      body: { type: 'object', required: ['productId', 'warehouseId', 'type', 'quantity'], properties: { productId: { type: 'string' }, warehouseId: { type: 'string' }, type: { enum: ['IN', 'OUT', 'ADJUST'] }, quantity: { type: 'integer' }, unitCost: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = movementSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos' });
    try {
      const mv = await applyMovement(app.prisma, parsed.data);
      return mv;
    } catch (e: any) {
      return reply.code(400).send({ message: e.message || 'Error' });
    }
  });

  const transferSchema = z.object({
    productId: z.string().min(1),
    fromWarehouseId: z.string().min(1),
    toWarehouseId: z.string().min(1),
    quantity: z.number().int().positive(),
  });

  app.post('/inventory/transfer', {
    schema: {
      summary: 'Transferir stock',
      tags: ['inventory'],
      body: { type: 'object', required: ['productId', 'fromWarehouseId', 'toWarehouseId', 'quantity'], properties: { productId: { type: 'string' }, fromWarehouseId: { type: 'string' }, toWarehouseId: { type: 'string' }, quantity: { type: 'integer' } } },
      response: { 200: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = transferSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos' });
    try {
      const mv = await transferStock(app.prisma, parsed.data);
      return mv;
    } catch (e: any) {
      return reply.code(400).send({ message: e.message || 'Error' });
    }
  });

  app.get('/stock', {
    schema: {
      summary: 'Listar stock por almacén',
      tags: ['inventory'],
      response: { 200: { type: 'array', items: { type: 'object', properties: { productId: { type: 'string' }, productName: { type: 'string' }, warehouseName: { type: 'string' }, onHand: { type: 'integer' }, minStock: { type: 'integer' } } } } },
    },
  }, async () => {
    const rows = await app.prisma.stockLevel.findMany({
      include: { product: true, warehouse: true },
      orderBy: [{ warehouseId: 'asc' }],
      take: 500,
    });
    return rows.map((r) => ({
      productId: r.productId,
      productName: r.product.name,
      warehouseId: r.warehouseId,
      warehouseName: r.warehouse.name,
      onHand: r.onHand,
      minStock: r.minStock,
    }));
  });

  // Endpoint de stock-levels usado por el frontend
  app.get('/inventory/stock-levels', {
    schema: {
      summary: 'Obtener niveles de stock',
      tags: ['inventory'],
      response: { 200: { type: 'array', items: { type: 'object', properties: { productId: { type: 'string' }, warehouseId: { type: 'string' }, onHand: { type: 'integer' }, minStock: { type: 'integer' } } } } },
    },
  }, async () => {
    const rows = await app.prisma.stockLevel.findMany({
      take: 1000,
    });
    return rows.map((r) => ({
      productId: r.productId,
      warehouseId: r.warehouseId,
      onHand: r.onHand,
      minStock: r.minStock,
    }));
  });

  app.get('/stock/low', {
    schema: {
      summary: 'Stock bajo (<= mínimo)',
      tags: ['inventory'],
      response: { 200: { type: 'array', items: { type: 'object', properties: { productId: { type: 'string' }, warehouseId: { type: 'string' }, onHand: { type: 'integer' }, minStock: { type: 'integer' } } } } },
    },
  }, async () => {
    const rows = await app.prisma.stockLevel.findMany({
      where: { OR: [{ onHand: { lte: 0 } }, { onHand: { gte: 0 }, minStock: { gt: 0 } }] },
      include: { product: true, warehouse: true },
      orderBy: [{ warehouseId: 'asc' }],
      take: 500,
    });
    return rows
      .filter((r) => r.onHand <= r.minStock)
      .map((r) => ({
        productId: r.productId,
        productName: r.product.name,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouse.name,
        onHand: r.onHand,
        minStock: r.minStock,
      }));
  });

  app.patch('/stock/min', {
    schema: {
      summary: 'Configurar stock mínimo',
      tags: ['inventory'],
      body: { type: 'object', required: ['productId', 'warehouseId', 'minStock'], properties: { productId: { type: 'string' }, warehouseId: { type: 'string' }, minStock: { type: 'integer' } } },
      response: { 200: { type: 'object', properties: { productId: { type: 'string' }, warehouseId: { type: 'string' }, minStock: { type: 'integer' } } } },
    },
  }, async (request, reply) => {
    const schema = z.object({ productId: z.string(), warehouseId: z.string(), minStock: z.number().int().nonnegative() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos' });
    const { productId, warehouseId, minStock } = parsed.data;
    const level = await app.prisma.stockLevel.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      update: { minStock },
      create: { productId, warehouseId, onHand: 0, minStock },
    });
    return level;
  });

  // Generar código de barras único
  app.get('/inventory/generate-barcode', {
    schema: {
      summary: 'Generar código de barras único',
      tags: ['inventory'],
      response: { 200: { type: 'object', properties: { barcode: { type: 'string' } } } },
    },
  }, async (_request, reply) => {
    const MAX_ATTEMPTS = 100;
    
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Generar código EAN-13 interno (empezando con 20 para uso interno)
      const prefix = '20';
      const random = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
      const partial = prefix + random;
      
      // Calcular dígito de verificación EAN-13
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(partial[i]) * (i % 2 === 0 ? 1 : 3);
      }
      const checkDigit = (10 - (sum % 10)) % 10;
      const barcode = partial + checkDigit;
      
      // Verificar que no exista en productos NI en presentaciones
      const existingProduct = await app.prisma.product.findUnique({ 
        where: { barcode },
        select: { id: true }
      });
      const existingPresentation = await app.prisma.productPresentation.findUnique({ 
        where: { barcode },
        select: { id: true }
      });
      
      if (!existingProduct && !existingPresentation) {
        return { barcode };
      }
    }
    
    return reply.code(500).send({ 
      message: 'No se pudo generar un código único. Por favor intente nuevamente.' 
    });
  });
}