import { FastifyInstance } from 'fastify';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(__dirname, '../../uploads/products');

// Crear directorio si no existe
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function uploadRoutes(app: FastifyInstance) {
  // Subir imagen de producto
  app.post('/uploads/product-image', {
    schema: {
      summary: 'Subir imagen de producto',
      tags: ['uploads'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            filename: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ message: 'No se encontró archivo' });
      }

      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.code(400).send({ 
          message: 'Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, WebP, GIF)' 
        });
      }

      // Generar nombre único
      const ext = path.extname(data.filename);
      const uniqueName = `${crypto.randomUUID()}${ext}`;
      const filePath = path.join(UPLOAD_DIR, uniqueName);

      // Guardar archivo
      await pipeline(data.file, createWriteStream(filePath));

      const url = `/uploads/products/${uniqueName}`;
      
      return { url, filename: uniqueName };
    } catch (error: any) {
      app.log.error(error);
      return reply.code(500).send({ message: 'Error al subir archivo' });
    }
  });

  // Generar código de barras único
  app.post('/uploads/generate-barcode', {
    schema: {
      summary: 'Generar código de barras único',
      tags: ['uploads'],
      body: {
        type: 'object',
        properties: {
          prefix: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            barcode: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const MAX_ATTEMPTS = 100;
    
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Generar código EAN-13 con prefijo 20 (uso interno)
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
