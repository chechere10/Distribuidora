import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { generateBarcode } from '../lib/barcode';
import * as XLSX from 'xlsx';

// Schema para presentaciones
const presentationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  quantity: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Cantidad inválida'),
  price: z.string().refine((v) => !isNaN(Number(v)), 'Precio inválido'),
  priceSanAlas: z.string().optional().nullable(),
  priceEmpleados: z.string().optional().nullable(),
  barcode: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function productRoutes(app: FastifyInstance) {
  const createSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    barcodeImageUrl: z.string().optional().nullable(),
    barcodeImageRotation: z.number().int().optional(), // Rotación de la imagen
    barcodeImageScale: z.number().optional(), // Escala de la imagen
    categoryId: z.string().optional(),
    defaultPrice: z.string().refine((v) => !isNaN(Number(v)), 'Precio inválido'),
    priceSanAlas: z.string().optional().nullable(),
    priceEmpleados: z.string().optional().nullable(),
    cost: z.string().optional(),
    imageUrl: z.string().optional(),
    baseUnit: z.string().optional(), // Unidad base: kg, litro, unidad
    baseStock: z.string().optional(), // Stock en unidad base
    minStock: z.number().int().optional(),
    isActive: z.boolean().optional(),
    // Precios especiales por lista
    prices: z.array(z.object({
      priceListId: z.string(),
      price: z.string(),
    })).optional(),
    // Presentaciones del producto
    presentations: z.array(presentationSchema).optional(),
  });

  // ============ LISTAR PRODUCTOS ============
  app.get('/products', {
    schema: {
      summary: 'Listar productos',
      tags: ['products'],
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          categoryId: { type: 'string' },
          lowStock: { type: 'boolean' },
          limit: { type: 'integer', minimum: 1, maximum: 10000 },
          offset: { type: 'integer', minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const qp = (request.query as any) ?? {};
    const q = qp.q as string | undefined;
    const categoryId = qp.categoryId as string | undefined;
    const lowStock = qp.lowStock === 'true' || qp.lowStock === true;
    const limit = Math.min(Math.max(Number(qp.limit ?? 1000), 1), 10000);
    const offset = Math.max(Number(qp.offset ?? 0), 0);
    
    const whereConditions: any[] = [
      { isActive: true }, // Solo productos activos
    ];
    
    if (q) {
      whereConditions.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
          { sku: { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
          { barcode: { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
          { description: { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
        ],
      });
    }
    
    if (categoryId) {
      whereConditions.push({ categoryId });
    }

    const where = { AND: whereConditions };

    const [total, rows] = await Promise.all([
      app.prisma.product.count({ where }),
      app.prisma.product.findMany({ 
        where, 
        include: {
          category: true,
          prices: {
            include: { priceList: true },
          },
          presentations: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: lowStock ? { baseStock: 'asc' } : { createdAt: 'desc' }, 
        take: limit, 
        skip: offset 
      }),
    ]);
    reply.header('X-Total-Count', String(total));
    reply.header('X-Limit', String(limit));
    reply.header('X-Offset', String(offset));
    
    // Convert Decimal fields to strings and add computed stock display
    let serializedRows = rows.map(row => {
      const stockDisplay = computeStockDisplay(
        Number(row.baseStock),
        row.baseUnit,
        row.presentations.map(p => ({
          name: p.name,
          quantity: Number(p.quantity),
        }))
      );
      
      return {
        ...row,
        defaultPrice: row.defaultPrice.toString(),
        priceSanAlas: row.priceSanAlas?.toString() || null,
        priceEmpleados: row.priceEmpleados?.toString() || null,
        cost: row.cost.toString(),
        baseStock: row.baseStock.toString(),
        stock: Number(row.baseStock), // Para compatibilidad con Dashboard
        stockDisplay, // Ej: "9 Bultos y 15 Kilos"
        prices: row.prices.map(p => ({
          ...p,
          price: p.price.toString(),
        })),
        presentations: row.presentations.map(p => ({
          ...p,
          quantity: p.quantity.toString(),
          price: p.price.toString(),
          priceSanAlas: p.priceSanAlas?.toString() || null,
          priceEmpleados: p.priceEmpleados?.toString() || null,
        })),
      };
    });
    
    // Filtrar productos con stock bajo (stock <= minStock)
    if (lowStock) {
      serializedRows = serializedRows.filter(p => Number(p.baseStock) <= p.minStock && p.minStock > 0);
    }
    
    return serializedRows;
  });

  // ============ OBTENER PRODUCTO ============
  app.get('/products/:id', {
    schema: {
      summary: 'Obtener producto',
      tags: ['products'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const id = (request.params as any).id as string;
    const product = await app.prisma.product.findUnique({ 
      where: { id },
      include: {
        category: true,
        prices: {
          include: { priceList: true },
        },
        presentations: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!product) return reply.code(404).send({ message: 'Not found' });
    
    const stockDisplay = computeStockDisplay(
      Number(product.baseStock),
      product.baseUnit,
      product.presentations.map(p => ({
        name: p.name,
        quantity: Number(p.quantity),
      }))
    );
    
    return {
      ...product,
      defaultPrice: product.defaultPrice.toString(),
      priceSanAlas: product.priceSanAlas?.toString() || null,
      priceEmpleados: product.priceEmpleados?.toString() || null,
      cost: product.cost.toString(),
      baseStock: product.baseStock.toString(),
      stockDisplay,
      prices: product.prices.map(p => ({
        ...p,
        price: p.price.toString(),
      })),
      presentations: product.presentations.map(p => ({
        ...p,
        quantity: p.quantity.toString(),
        price: p.price.toString(),
        priceSanAlas: p.priceSanAlas?.toString() || null,
        priceEmpleados: p.priceEmpleados?.toString() || null,
      })),
    };
  });

  // ============ BUSCAR POR CÓDIGO DE BARRAS ============
  app.get('/products/barcode/:code', {
    schema: {
      summary: 'Buscar por código de barras',
      tags: ['products'],
      params: { type: 'object', required: ['code'], properties: { code: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const code = (request.params as any).code as string;
    
    // Buscar primero en productos
    const product = await app.prisma.product.findUnique({ 
      where: { barcode: code },
      include: {
        category: true,
        prices: {
          include: { priceList: true },
        },
        presentations: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    
    if (product) {
      const stockDisplay = computeStockDisplay(
        Number(product.baseStock),
        product.baseUnit,
        product.presentations.map(p => ({
          name: p.name,
          quantity: Number(p.quantity),
        }))
      );
      
      return {
        ...product,
        defaultPrice: product.defaultPrice.toString(),
        priceSanAlas: product.priceSanAlas?.toString() || null,
        priceEmpleados: product.priceEmpleados?.toString() || null,
        cost: product.cost.toString(),
        baseStock: product.baseStock.toString(),
        stockDisplay,
        prices: product.prices.map(p => ({
          ...p,
          price: p.price.toString(),
        })),
        presentations: product.presentations.map(p => ({
          ...p,
          quantity: p.quantity.toString(),
          price: p.price.toString(),
          priceSanAlas: p.priceSanAlas?.toString() || null,
          priceEmpleados: p.priceEmpleados?.toString() || null,
        })),
      };
    }
    
    // Buscar en presentaciones (cada presentación puede tener su propio código)
    const presentation = await app.prisma.productPresentation.findUnique({
      where: { barcode: code },
      include: {
        product: {
          include: {
            category: true,
            prices: {
              include: { priceList: true },
            },
            presentations: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    
    if (presentation) {
      const prod = presentation.product;
      const stockDisplay = computeStockDisplay(
        Number(prod.baseStock),
        prod.baseUnit,
        prod.presentations.map(p => ({
          name: p.name,
          quantity: Number(p.quantity),
        }))
      );
      
      return {
        ...prod,
        defaultPrice: prod.defaultPrice.toString(),
        cost: prod.cost.toString(),
        baseStock: prod.baseStock.toString(),
        stockDisplay,
        prices: prod.prices.map(p => ({
          ...p,
          price: p.price.toString(),
        })),
        presentations: prod.presentations.map(p => ({
          ...p,
          quantity: p.quantity.toString(),
          price: p.price.toString(),
          priceSanAlas: p.priceSanAlas?.toString() || null,
          priceEmpleados: p.priceEmpleados?.toString() || null,
        })),
        // Indicar qué presentación fue escaneada
        scannedPresentation: {
          id: presentation.id,
          name: presentation.name,
          quantity: presentation.quantity.toString(),
          price: presentation.price.toString(),
          priceSanAlas: presentation.priceSanAlas?.toString() || null,
          priceEmpleados: presentation.priceEmpleados?.toString() || null,
        },
      };
    }
    
    return reply.code(404).send({ message: 'Not found' });
  });

  // ============ CREAR PRODUCTO ============
  app.post('/products', {
    schema: {
      summary: 'Crear producto',
      tags: ['products'],
      body: {
        type: 'object',
        required: ['name', 'defaultPrice'],
        properties: {
          name: { type: 'string' }, 
          description: { type: 'string' },
          sku: { type: 'string' }, 
          barcode: { type: 'string' }, 
          categoryId: { type: 'string' }, 
          defaultPrice: { type: 'string' }, 
          cost: { type: 'string' }, 
          imageUrl: { type: 'string' },
          baseUnit: { type: 'string' },
          baseStock: { type: 'string' },
          minStock: { type: 'integer' },
          isActive: { type: 'boolean' },
          prices: { type: 'array' },
          presentations: { type: 'array' },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    const data = parsed.data;
    
    // NO autogenerar código de barras - dejarlo null si no se proporciona
    // Los productos de fábrica ya tienen código, los demás se generan manualmente
    const productBarcode = data.barcode?.trim() || null;
    
    // Verificar si el código de barras ya está en uso
    if (productBarcode) {
      const existingProduct = await app.prisma.product.findUnique({
        where: { barcode: productBarcode },
        select: { id: true, name: true }
      });
      if (existingProduct) {
        return reply.code(400).send({ 
          message: `El código de barras "${productBarcode}" ya está asociado al producto "${existingProduct.name}". Cada código debe ser único.`
        });
      }
    }
    
    try {
      const created = await app.prisma.product.create({
        data: {
          name: data.name,
          description: data.description,
          sku: data.sku,
          barcode: productBarcode,
          barcodeImageUrl: data.barcodeImageUrl || null,
          barcodeImageRotation: data.barcodeImageRotation ?? 0,
          barcodeImageScale: data.barcodeImageScale ?? 1,
          categoryId: data.categoryId,
          defaultPrice: data.defaultPrice as any,
          cost: (data.cost ?? '0') as any,
          imageUrl: data.imageUrl,
          baseUnit: data.baseUnit ?? 'unidad',
          baseStock: (data.baseStock ?? '0') as any,
          minStock: data.minStock ?? 0,
          isActive: data.isActive ?? true,
          prices: data.prices && data.prices.length > 0 ? {
            create: data.prices.map(p => ({
            priceListId: p.priceListId,
            price: p.price as any,
          })),
        } : undefined,
        presentations: data.presentations && data.presentations.length > 0 ? {
          create: data.presentations.map((p, idx) => ({
            name: p.name,
            quantity: p.quantity as any,
            price: p.price as any,
            priceSanAlas: p.priceSanAlas ? (p.priceSanAlas as any) : null,
            priceEmpleados: p.priceEmpleados ? (p.priceEmpleados as any) : null,
            barcode: p.barcode?.trim() || null, // NO autogenerar - dejarlo null si no se proporciona
            sortOrder: p.sortOrder ?? idx,
            isDefault: p.isDefault ?? (idx === 0),
            isActive: p.isActive ?? true,
          })),
        } : undefined,
      },
      include: {
        category: true,
        prices: {
          include: { priceList: true },
        },
        presentations: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    
    const stockDisplay = computeStockDisplay(
      Number(created.baseStock),
      created.baseUnit,
      created.presentations.map(p => ({
        name: p.name,
        quantity: Number(p.quantity),
      }))
    );
    
    return {
      ...created,
      defaultPrice: created.defaultPrice.toString(),
      priceSanAlas: created.priceSanAlas?.toString() || null,
      priceEmpleados: created.priceEmpleados?.toString() || null,
      cost: created.cost.toString(),
      baseStock: created.baseStock.toString(),
      stockDisplay,
      prices: created.prices.map(p => ({
        ...p,
        price: p.price.toString(),
      })),
      presentations: created.presentations.map(p => ({
        ...p,
        quantity: p.quantity.toString(),
        price: p.price.toString(),
        priceSanAlas: p.priceSanAlas?.toString() || null,
        priceEmpleados: p.priceEmpleados?.toString() || null,
      })),
    };
    } catch (error: any) {
      console.error('Error creating product:', error);
      if (error.code === 'P2002') {
        return reply.code(400).send({ 
          message: `El código de barras ya está asociado a otro producto. Cada código debe ser único.`
        });
      }
      return reply.code(500).send({ message: 'Error al crear producto' });
    }
  });

  // ============ ACTUALIZAR PRODUCTO ============
  app.patch('/products/:id', {
    schema: {
      summary: 'Actualizar producto',
      tags: ['products'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object' },
    },
  }, async (request, reply) => {
    const id = (request.params as any).id as string;
    const body = request.body as any;
    
    try {
      // Actualizar precios si vienen en el body
      if (body.prices && Array.isArray(body.prices)) {
        for (const priceData of body.prices) {
          await app.prisma.productPrice.upsert({
            where: {
              productId_priceListId: {
                productId: id,
                priceListId: priceData.priceListId,
              },
            },
            update: { price: priceData.price as any },
            create: {
              productId: id,
              priceListId: priceData.priceListId,
              price: priceData.price as any,
            },
          });
        }
      }

      // Actualizar presentaciones si vienen en el body
      if (body.presentations && Array.isArray(body.presentations)) {
        // Obtener IDs existentes
        const existingPresentations = await app.prisma.productPresentation.findMany({
          where: { productId: id },
          select: { id: true },
        });
        const existingIds = new Set(existingPresentations.map(p => p.id));
        const incomingIds = new Set(body.presentations.filter((p: any) => p.id).map((p: any) => p.id));
        
        // Eliminar presentaciones que ya no están
        const toDelete = [...existingIds].filter(existId => !incomingIds.has(existId));
        if (toDelete.length > 0) {
          await app.prisma.productPresentation.deleteMany({
            where: { id: { in: toDelete } },
          });
        }
        
        // Crear o actualizar presentaciones
        for (let idx = 0; idx < body.presentations.length; idx++) {
          const p = body.presentations[idx];
          if (p.id && existingIds.has(p.id)) {
            // Actualizar existente
            await app.prisma.productPresentation.update({
              where: { id: p.id },
              data: {
                name: p.name,
                quantity: p.quantity as any,
                price: p.price as any,
                priceSanAlas: p.priceSanAlas ? (p.priceSanAlas as any) : null,
                priceEmpleados: p.priceEmpleados ? (p.priceEmpleados as any) : null,
                barcode: p.barcode?.trim() || null,
                sortOrder: p.sortOrder ?? idx,
                isDefault: p.isDefault ?? false,
                isActive: p.isActive ?? true,
              },
            });
          } else {
            // Crear nueva - NO autogenerar barcode, dejarlo null si no viene
            await app.prisma.productPresentation.create({
              data: {
                productId: id,
                name: p.name,
                quantity: p.quantity as any,
                price: p.price as any,
                priceSanAlas: p.priceSanAlas ? (p.priceSanAlas as any) : null,
                priceEmpleados: p.priceEmpleados ? (p.priceEmpleados as any) : null,
                barcode: p.barcode?.trim() || null,
                sortOrder: p.sortOrder ?? idx,
                isDefault: p.isDefault ?? false,
                isActive: p.isActive ?? true,
              },
            });
          }
        }
      }

      const updated = await app.prisma.product.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description,
          sku: body.sku,
          // Permitir eliminar código de barras (dejarlo en null)
          barcode: body.barcode === '' ? null : (body.barcode?.trim() || undefined),
          barcodeImageUrl: body.barcodeImageUrl === '' ? null : (body.barcodeImageUrl || undefined),
          barcodeImageRotation: body.barcodeImageRotation ?? undefined,
          barcodeImageScale: body.barcodeImageScale ?? undefined,
          categoryId: body.categoryId,
          defaultPrice: body.defaultPrice ? (body.defaultPrice as any) : undefined,
          cost: body.cost ? (body.cost as any) : undefined,
          imageUrl: body.imageUrl,
          baseUnit: body.baseUnit,
          baseStock: body.baseStock ? (body.baseStock as any) : undefined,
          minStock: body.minStock,
          isActive: body.isActive,
        },
        include: {
          category: true,
          prices: {
            include: { priceList: true },
          },
          presentations: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
      
      const stockDisplay = computeStockDisplay(
        Number(updated.baseStock),
        updated.baseUnit,
        updated.presentations.map(p => ({
          name: p.name,
          quantity: Number(p.quantity),
        }))
      );
      
      return {
        ...updated,
        defaultPrice: updated.defaultPrice.toString(),
        priceSanAlas: updated.priceSanAlas?.toString() || null,
        priceEmpleados: updated.priceEmpleados?.toString() || null,
        cost: updated.cost.toString(),
        baseStock: updated.baseStock.toString(),
        stockDisplay,
        prices: updated.prices.map(p => ({
          ...p,
          price: p.price.toString(),
        })),
        presentations: updated.presentations.map(p => ({
          ...p,
          quantity: p.quantity.toString(),
          price: p.price.toString(),
          priceSanAlas: p.priceSanAlas?.toString() || null,
          priceEmpleados: p.priceEmpleados?.toString() || null,
        })),
      };
    } catch (error: any) {
      console.error('Error updating product:', error);
      if (error.code === 'P2002') {
        return reply.code(400).send({ 
          message: `El código de barras ya está asociado a otro producto. Cada código debe ser único.`
        });
      }
      return reply.code(404).send({ message: 'Producto no encontrado' });
    }
  });

  // ============ ELIMINAR PRODUCTO ============
  app.delete('/products/:id', {
    schema: {
      summary: 'Eliminar producto',
      tags: ['products'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const id = (request.params as any).id as string;
    try {
      await app.prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      return { message: 'Producto eliminado' };
    } catch {
      return reply.code(404).send({ message: 'Not found' });
    }
  });

  // ============ AGREGAR STOCK ============
  app.post('/products/:id/add-stock', {
    schema: {
      summary: 'Agregar stock al producto',
      tags: ['products'],
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const id = (request.params as any).id as string;
    const { quantity, notes } = request.body as { quantity: string; notes?: string };
    
    const product = await app.prisma.product.findUnique({ where: { id } });
    if (!product) return reply.code(404).send({ message: 'Not found' });
    
    const newStock = Number(product.baseStock) + Number(quantity);
    
    await app.prisma.product.update({
      where: { id },
      data: { baseStock: newStock as any },
    });
    
    // Registrar movimiento
    const warehouse = await app.prisma.warehouse.findFirst();
    if (warehouse) {
      await app.prisma.inventoryMovement.create({
        data: {
          productId: id,
          warehouseId: warehouse.id,
          quantity: quantity as any,
          type: 'IN',
          notes: notes ?? 'Ingreso de stock',
        },
      });
    }
    
    return { message: 'Stock actualizado', newStock: newStock.toString() };
  });

  // ============ EXPORTAR PRODUCTOS A EXCEL ============
  app.get('/products/export/excel', {
    schema: {
      summary: 'Exportar productos a Excel',
      tags: ['products'],
    },
  }, async (request, reply) => {
    // Obtener todos los productos activos
    const products = await app.prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: true,
        presentations: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Preparar datos para Excel
    const data = products.map(p => ({
      'Nombre': p.name,
      'Descripción': p.description || '',
      'SKU': p.sku || '',
      'Código de Barras': p.barcode || '',
      'Categoría': p.category?.name || '',
      'Categoría ID': p.categoryId || '',
      'Precio Público': Number(p.defaultPrice),
      'Costo': Number(p.cost),
      'Unidad Base': p.baseUnit,
      'Stock': Number(p.baseStock),
      'Stock Mínimo': p.minStock,
      // Presentaciones como JSON string para reimportar
      'Presentaciones': p.presentations.length > 0 
        ? JSON.stringify(p.presentations.map(pr => ({
            name: pr.name,
            quantity: Number(pr.quantity),
            price: Number(pr.price),
            priceSanAlas: pr.priceSanAlas ? Number(pr.priceSanAlas) : null,
            barcode: pr.barcode || '',
          })))
        : '',
    }));

    // Crear workbook
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');

    // Ajustar anchos de columnas
    ws['!cols'] = [
      { wch: 40 },  // Nombre
      { wch: 30 },  // Descripción
      { wch: 15 },  // SKU
      { wch: 20 },  // Código de Barras
      { wch: 20 },  // Categoría
      { wch: 30 },  // Categoría ID
      { wch: 15 },  // Precio Público
      { wch: 12 },  // Costo
      { wch: 12 },  // Unidad Base
      { wch: 12 },  // Stock
      { wch: 12 },  // Stock Mínimo
      { wch: 60 },  // Presentaciones
    ];

    // Generar buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', `attachment; filename="productos_${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    return reply.send(buffer);
  });

  // ============ DESCARGAR PLANTILLA EXCEL ============
  app.get('/products/template/excel', {
    schema: {
      summary: 'Descargar plantilla Excel para importar productos',
      tags: ['products'],
    },
  }, async (request, reply) => {
    // Obtener categorías para referencia
    const categories = await app.prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // Crear hoja de productos (plantilla vacía con ejemplo)
    const templateData = [
      {
        'Nombre': 'Ejemplo: Arroz Diana 500g',
        'Descripción': 'Arroz blanco grano largo',
        'SKU': 'ARR-001',
        'Código de Barras': '7701234567890',
        'Categoría ID': categories[0]?.id || 'ID_DE_CATEGORIA',
        'Precio Público': 5500,
        'Costo': 4800,
        'Unidad Base': 'unidad',
        'Stock': 100,
        'Stock Mínimo': 10,
        'Presentaciones': '[{"name":"Bulto","quantity":24,"price":120000,"priceSanAlas":115000}]',
      },
    ];

    // Crear hoja de categorías para referencia
    const categoriesData = categories.map(c => ({
      'ID (usar este valor)': c.id,
      'Nombre': c.name,
      'Descripción': c.description || '',
    }));

    // Crear workbook
    const ws1 = XLSX.utils.json_to_sheet(templateData);
    const ws2 = XLSX.utils.json_to_sheet(categoriesData);
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Productos');
    XLSX.utils.book_append_sheet(wb, ws2, 'Categorías (Referencia)');

    // Ajustar anchos
    ws1['!cols'] = [
      { wch: 40 },  // Nombre
      { wch: 30 },  // Descripción
      { wch: 15 },  // SKU
      { wch: 20 },  // Código de Barras
      { wch: 30 },  // Categoría ID
      { wch: 15 },  // Precio Público
      { wch: 12 },  // Costo
      { wch: 12 },  // Unidad Base
      { wch: 12 },  // Stock
      { wch: 12 },  // Stock Mínimo
      { wch: 60 },  // Presentaciones
    ];

    ws2['!cols'] = [
      { wch: 30 },  // ID
      { wch: 30 },  // Nombre
      { wch: 40 },  // Descripción
    ];

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename="plantilla_productos.xlsx"');
    
    return reply.send(buffer);
  });

  // ============ IMPORTAR PRODUCTOS DESDE EXCEL ============
  app.post('/products/import/excel', {
    schema: {
      summary: 'Importar productos desde Excel',
      tags: ['products'],
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ message: 'No se recibió archivo' });
    }

    const buffer = await data.toBuffer();
    
    try {
      // Parsear Excel
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet) as any[];

      if (rows.length === 0) {
        return reply.code(400).send({ message: 'El archivo está vacío' });
      }

      const results = {
        created: 0,
        updated: 0,
        errors: [] as { row: number; error: string; data?: any }[],
      };

      // Obtener categorías existentes para validación
      const categories = await app.prisma.category.findMany({ where: { isActive: true } });
      const categoryIds = new Set(categories.map(c => c.id));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // +2 porque la fila 1 es encabezado

        try {
          // Validar campos requeridos
          const nombre = row['Nombre']?.toString().trim();
          if (!nombre) {
            results.errors.push({ row: rowNum, error: 'Nombre es requerido', data: row });
            continue;
          }

          const precioPublico = parseFloat(row['Precio Público']);
          if (isNaN(precioPublico) || precioPublico < 0) {
            results.errors.push({ row: rowNum, error: 'Precio Público inválido', data: row });
            continue;
          }

          // Validar categoría si se proporciona
          const categoryId = row['Categoría ID']?.toString().trim() || null;
          if (categoryId && !categoryIds.has(categoryId)) {
            results.errors.push({ row: rowNum, error: `Categoría ID "${categoryId}" no existe`, data: row });
            continue;
          }

          // Parsear presentaciones si existen
          let presentations: any[] = [];
          if (row['Presentaciones']) {
            try {
              presentations = JSON.parse(row['Presentaciones']);
              if (!Array.isArray(presentations)) presentations = [];
            } catch (e) {
              results.errors.push({ row: rowNum, error: 'Formato de Presentaciones inválido (debe ser JSON)', data: row });
              continue;
            }
          }

          const productData = {
            name: nombre,
            description: row['Descripción']?.toString().trim() || null,
            sku: row['SKU']?.toString().trim() || null,
            barcode: row['Código de Barras']?.toString().trim() || null,
            categoryId: categoryId,
            defaultPrice: precioPublico,
            cost: parseFloat(row['Costo']) || 0,
            baseUnit: row['Unidad Base']?.toString().trim() || 'unidad',
            baseStock: parseFloat(row['Stock']) || 0,
            minStock: parseInt(row['Stock Mínimo']) || 0,
            isActive: true,
          };

          // Verificar si existe por barcode o SKU
          let existingProduct = null;
          if (productData.barcode) {
            existingProduct = await app.prisma.product.findUnique({
              where: { barcode: productData.barcode },
            });
          }
          if (!existingProduct && productData.sku) {
            existingProduct = await app.prisma.product.findUnique({
              where: { sku: productData.sku },
            });
          }

          if (existingProduct) {
            // Actualizar producto existente
            await app.prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                name: productData.name,
                description: productData.description,
                categoryId: productData.categoryId,
                defaultPrice: productData.defaultPrice as any,
                cost: productData.cost as any,
                baseUnit: productData.baseUnit,
                baseStock: productData.baseStock as any,
                minStock: productData.minStock,
                isActive: true,
              },
            });

            // Actualizar presentaciones si se proporcionan
            if (presentations.length > 0) {
              // Eliminar existentes y crear nuevas
              await app.prisma.productPresentation.deleteMany({
                where: { productId: existingProduct.id },
              });
              
              for (let idx = 0; idx < presentations.length; idx++) {
                const p = presentations[idx];
                await app.prisma.productPresentation.create({
                  data: {
                    productId: existingProduct.id,
                    name: p.name,
                    quantity: p.quantity as any,
                    price: p.price as any,
                    priceSanAlas: p.priceSanAlas ? (p.priceSanAlas as any) : null,
                    barcode: p.barcode?.trim() || null,
                    sortOrder: idx,
                    isDefault: idx === 0,
                    isActive: true,
                  },
                });
              }
            }

            results.updated++;
          } else {
            // Crear nuevo producto
            const created = await app.prisma.product.create({
              data: {
                name: productData.name,
                description: productData.description,
                sku: productData.sku,
                barcode: productData.barcode,
                categoryId: productData.categoryId,
                defaultPrice: productData.defaultPrice as any,
                cost: productData.cost as any,
                baseUnit: productData.baseUnit,
                baseStock: productData.baseStock as any,
                minStock: productData.minStock,
                isActive: true,
              },
            });

            // Crear presentaciones
            for (let idx = 0; idx < presentations.length; idx++) {
              const p = presentations[idx];
              await app.prisma.productPresentation.create({
                data: {
                  productId: created.id,
                  name: p.name,
                  quantity: p.quantity as any,
                  price: p.price as any,
                  priceSanAlas: p.priceSanAlas ? (p.priceSanAlas as any) : null,
                  barcode: p.barcode?.trim() || null,
                  sortOrder: idx,
                  isDefault: idx === 0,
                  isActive: true,
                },
              });
            }

            results.created++;
          }
        } catch (error: any) {
          results.errors.push({ 
            row: rowNum, 
            error: error.message || 'Error desconocido',
            data: row,
          });
        }
      }

      return {
        success: true,
        message: `Importación completada: ${results.created} creados, ${results.updated} actualizados, ${results.errors.length} errores`,
        results,
      };
    } catch (error: any) {
      return reply.code(400).send({ 
        message: 'Error al procesar el archivo Excel',
        error: error.message,
      });
    }
  });
}

// ============ FUNCIÓN PARA CALCULAR DISPLAY DE STOCK ============
function computeStockDisplay(
  baseStock: number,
  baseUnit: string,
  presentations: Array<{ name: string; quantity: number }>
): string {
  if (presentations.length === 0) {
    return `${formatNumber(baseStock)} ${baseUnit}`;
  }
  
  // Ordenar presentaciones de mayor a menor cantidad
  const sorted = [...presentations].sort((a, b) => b.quantity - a.quantity);
  
  const parts: string[] = [];
  let remaining = baseStock;
  
  for (const pres of sorted) {
    if (remaining >= pres.quantity) {
      const count = Math.floor(remaining / pres.quantity);
      remaining = remaining % pres.quantity;
      parts.push(`${count} ${pres.name}${count !== 1 ? 's' : ''}`);
    }
  }
  
  // Agregar el sobrante en unidad base
  if (remaining > 0) {
    parts.push(`${formatNumber(remaining)} ${baseUnit}`);
  }
  
  return parts.length > 0 ? parts.join(' y ') : `0 ${baseUnit}`;
}

function formatNumber(num: number): string {
  // Si es entero, mostrar sin decimales
  if (Number.isInteger(num)) {
    return num.toString();
  }
  // Si tiene decimales, mostrar hasta 2
  return num.toFixed(2).replace(/\.?0+$/, '');
}


