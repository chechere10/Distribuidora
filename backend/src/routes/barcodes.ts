import { FastifyInstance } from 'fastify';
import { generateBarcode, barcodeToPng, isValidBarcode } from '../lib/barcode';

export async function barcodeRoutes(app: FastifyInstance) {
  
  // ============ GENERAR CÓDIGO DE BARRAS ============
  app.get('/barcodes/generate', {
    schema: {
      summary: 'Generar código de barras único',
      tags: ['barcodes'],
      querystring: {
        type: 'object',
        properties: {
          count: { type: 'integer', minimum: 1, maximum: 100, default: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            barcodes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { count = 1 } = request.query as { count?: number };
    const barcodes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      barcodes.push(generateBarcode());
    }
    
    return { barcodes };
  });

  // ============ OBTENER IMAGEN PNG DEL CÓDIGO ============
  app.get('/barcodes/image/:code', {
    schema: {
      summary: 'Obtener imagen PNG del código de barras',
      tags: ['barcodes'],
      params: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { code } = request.params as { code: string };
    
    if (!code || code.trim() === '') {
      return reply.code(400).send({ message: 'Código de barras requerido' });
    }
    
    try {
      const pngBuffer = await barcodeToPng(code);
      
      reply.header('Content-Type', 'image/png');
      reply.header('Content-Disposition', `inline; filename="barcode-${code}.png"`);
      reply.header('Cache-Control', 'public, max-age=86400'); // Cache 24h
      
      return reply.send(pngBuffer);
    } catch (error) {
      console.error('Error generando imagen de código de barras:', error);
      return reply.code(500).send({ message: 'Error generando imagen' });
    }
  });

  // ============ VALIDAR CÓDIGO DE BARRAS ============
  app.get('/barcodes/validate/:code', {
    schema: {
      summary: 'Validar formato de código de barras',
      tags: ['barcodes'],
      params: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            code: { type: 'string' },
            length: { type: 'integer' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { code } = request.params as { code: string };
    
    return {
      valid: isValidBarcode(code),
      code,
      length: code.length,
    };
  });

  // ============ BUSCAR PRODUCTO POR CÓDIGO ============
  app.get('/barcodes/lookup/:code', {
    schema: {
      summary: 'Buscar producto o presentación por código de barras',
      tags: ['barcodes'],
      params: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { code } = request.params as { code: string };
    
    // Buscar en productos
    const product = await app.prisma.product.findUnique({
      where: { barcode: code },
      include: {
        category: true,
        presentations: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    
    if (product) {
      return {
        type: 'product',
        product: {
          ...product,
          defaultPrice: product.defaultPrice.toString(),
          cost: product.cost.toString(),
          baseStock: product.baseStock.toString(),
          presentations: product.presentations.map(p => ({
            ...p,
            quantity: p.quantity.toString(),
            price: p.price.toString(),
            priceSanAlas: p.priceSanAlas?.toString() || null,
          })),
        },
      };
    }
    
    // Buscar en presentaciones
    const presentation = await app.prisma.productPresentation.findUnique({
      where: { barcode: code },
      include: {
        product: {
          include: {
            category: true,
            presentations: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    
    if (presentation) {
      return {
        type: 'presentation',
        presentation: {
          id: presentation.id,
          name: presentation.name,
          quantity: presentation.quantity.toString(),
          price: presentation.price.toString(),
          priceSanAlas: presentation.priceSanAlas?.toString() || null,
          barcode: presentation.barcode,
        },
        product: {
          ...presentation.product,
          defaultPrice: presentation.product.defaultPrice.toString(),
          cost: presentation.product.cost.toString(),
          baseStock: presentation.product.baseStock.toString(),
          presentations: presentation.product.presentations.map(p => ({
            ...p,
            quantity: p.quantity.toString(),
            price: p.price.toString(),
            priceSanAlas: p.priceSanAlas?.toString() || null,
          })),
        },
      };
    }
    
    return reply.code(404).send({ message: 'Código de barras no encontrado' });
  });

  // ============ GENERAR CÓDIGOS PARA PRODUCTOS SIN BARCODE ============
  app.post('/barcodes/generate-missing', {
    schema: {
      summary: 'Generar códigos de barras para productos que no tienen',
      tags: ['barcodes'],
      response: {
        200: {
          type: 'object',
          properties: {
            updated: { type: 'integer' },
            products: { type: 'array' },
          },
        },
      },
    },
  }, async (request, reply) => {
    // Buscar productos sin barcode
    const productsWithoutBarcode = await app.prisma.product.findMany({
      where: {
        OR: [
          { barcode: null },
          { barcode: '' },
        ],
      },
      select: { id: true, name: true },
    });
    
    const updated: { id: string; name: string; barcode: string }[] = [];
    
    for (const product of productsWithoutBarcode) {
      const newBarcode = generateBarcode();
      await app.prisma.product.update({
        where: { id: product.id },
        data: { barcode: newBarcode },
      });
      updated.push({ id: product.id, name: product.name, barcode: newBarcode });
    }
    
    // También para presentaciones sin barcode
    const presentationsWithoutBarcode = await app.prisma.productPresentation.findMany({
      where: {
        OR: [
          { barcode: null },
          { barcode: '' },
        ],
      },
      select: { id: true, name: true, productId: true },
    });
    
    for (const presentation of presentationsWithoutBarcode) {
      const newBarcode = generateBarcode();
      await app.prisma.productPresentation.update({
        where: { id: presentation.id },
        data: { barcode: newBarcode },
      });
    }
    
    return {
      updated: updated.length + presentationsWithoutBarcode.length,
      products: updated,
      presentationsCount: presentationsWithoutBarcode.length,
    };
  });
}
