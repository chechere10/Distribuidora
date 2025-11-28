import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { config } from './config';
import prismaPlugin from './plugins/prisma';
import authPlugin from './plugins/auth';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { productRoutes } from './routes/products';
import { warehouseRoutes } from './routes/warehouses';
import { inventoryRoutes } from './routes/inventory';
import { salesRoutes } from './routes/sales';
import { expenseRoutes } from './routes/expenses';
import { purchaseRoutes } from './routes/purchases';
import { notificationRoutes } from './routes/notifications';
import { cashRoutes } from './routes/cash';
import { categoryRoutes } from './routes/categories';
import { priceListRoutes } from './routes/price-lists';
import { uploadRoutes } from './routes/uploads';
import ordersRoutes from './routes/orders';
import { accountingRoutes } from './routes/accounting';
import { barcodeRoutes } from './routes/barcodes';
import { supplierRoutes } from './routes/suppliers';
import { supplierIssuesRoutes } from './routes/supplier-issues';
import { backupRoutes } from './routes/backup';
import { systemRoutes } from './routes/system';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Función para ejecutar seed solo si la BD está vacía
async function runSeedIfNeeded() {
  const prisma = new PrismaClient();
  try {
    // Verificar si ya existe el usuario admin
    const existingAdmin = await prisma.user.findFirst();
    if (existingAdmin) {
      console.log('✅ Base de datos ya tiene datos, saltando seed...');
      return;
    }

    console.log('🌱 Base de datos vacía, ejecutando seed inicial...');
    
    // Admin user
    const passwordHash = await bcrypt.hash(config.adminPassword, 10);
    await prisma.user.upsert({
      where: { username: config.adminUsername },
      update: { passwordHash, isActive: true },
      create: { 
        username: config.adminUsername, 
        name: 'Administrador',
        passwordHash, 
        role: 'admin',
        isActive: true 
      },
    });
    console.log('✅ Usuario admin creado');

    // Default warehouse
    await prisma.warehouse.upsert({
      where: { name: 'Principal' },
      update: {},
      create: { name: 'Principal' },
    });
    console.log('✅ Almacén principal creado');

    // Default price list (Público General)
    await prisma.priceList.upsert({
      where: { name: 'Público General' },
      update: {},
      create: { 
        name: 'Público General', 
        description: 'Precios para clientes generales',
        isDefault: true,
        isActive: true,
      },
    });
    console.log('✅ Lista de precios "Público General" creada');

    // Price list for San Alas
    await prisma.priceList.upsert({
      where: { name: 'San Alas' },
      update: {},
      create: { 
        name: 'San Alas', 
        description: 'Precios especiales para negocio propio San Alas',
        isDefault: false,
        isActive: true,
      },
    });
    console.log('✅ Lista de precios "San Alas" creada');

    // Default categories
    const defaultCategories = [
      { name: 'Bebidas', description: 'Refrescos, jugos, agua', color: '#3B82F6' },
      { name: 'Snacks', description: 'Papas, galletas, dulces', color: '#F59E0B' },
      { name: 'Lácteos', description: 'Leche, queso, yogurt', color: '#10B981' },
      { name: 'Aseo', description: 'Productos de limpieza', color: '#8B5CF6' },
      { name: 'Comestibles', description: 'Alimentos en general', color: '#EF4444' },
      { name: 'Licores', description: 'Bebidas alcohólicas', color: '#EC4899' },
    ];

    for (const cat of defaultCategories) {
      await prisma.category.upsert({
        where: { name: cat.name },
        update: { description: cat.description, color: cat.color },
        create: cat,
      });
    }
    console.log('✅ Categorías por defecto creadas');

    // Auto-abrir caja si no existe
    const warehouse = await prisma.warehouse.findFirst({ where: { name: 'Principal' } });
    if (warehouse) {
      const openSession = await prisma.cashSession.findFirst({ 
        where: { warehouseId: warehouse.id, closedAt: null } 
      });
      if (!openSession) {
        await prisma.cashSession.create({
          data: { warehouseId: warehouse.id, openingAmount: 0 }
        });
        console.log('✅ Sesión de caja abierta automáticamente');
      }
    }

    console.log('🎉 Seed inicial completado');

  } catch (error) {
    console.error('❌ Error en seed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function start() {
  const app = Fastify({ logger: { transport: { target: 'pino-pretty' } } }).withTypeProvider<ZodTypeProvider>();

  await app.register(cors, { origin: true });
  await app.register(sensible);
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });
  await app.register(prismaPlugin);
  await app.register(authPlugin);

  await app.register(swagger, {
    openapi: {
      info: { title: 'Zora API', description: 'API local de distribuidora', version: '0.1.0' },
      servers: [{ url: 'http://localhost:3000' }],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.addHook('onRoute', (route) => {
    if (!route.url) return;
    if (!route.url.startsWith('/api')) return;
    const isPublic = route.url === '/api/health' || route.url === '/api/auth/login';
    route.schema = { ...(route.schema || {}), tags: (route.schema as any)?.tags || ['api'], security: isPublic ? [] : [{ bearerAuth: [] }] };
  });

  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(authRoutes, { prefix: '/api' });
  await app.register(productRoutes, { prefix: '/api' });
  await app.register(warehouseRoutes, { prefix: '/api' });
  await app.register(inventoryRoutes, { prefix: '/api' });
  await app.register(salesRoutes, { prefix: '/api' });
  await app.register(expenseRoutes, { prefix: '/api' });
  await app.register(purchaseRoutes, { prefix: '/api' });
  await app.register(notificationRoutes, { prefix: '/api' });
  await app.register(cashRoutes, { prefix: '/api' });
  await app.register(categoryRoutes, { prefix: '/api' });
  await app.register(priceListRoutes, { prefix: '/api' });
  await app.register(uploadRoutes, { prefix: '/api' });
  await app.register(ordersRoutes, { prefix: '/api/orders' });
  await app.register(accountingRoutes, { prefix: '/api' });
  await app.register(barcodeRoutes, { prefix: '/api' });
  await app.register(supplierRoutes, { prefix: '/api' });
  await app.register(supplierIssuesRoutes, { prefix: '/api' });
  await app.register(backupRoutes, { prefix: '/api' });
  await app.register(systemRoutes, { prefix: '/api' });

  app.addHook('onRequest', async (req, reply) => {
    // Public routes
    const publicPaths = ['/api/health', '/api/auth/login'];
    if (
      publicPaths.includes(req.url) || 
      req.url.startsWith('/docs') || 
      req.url.startsWith('/uploads') ||
      req.url.startsWith('/api/barcodes/image/') // Imágenes de códigos de barras públicas
    ) return;
    // Protected
    // @ts-ignore
    await app.authenticate(req, reply);
  });

  try {
    // Ejecutar seed solo si la BD está vacía (ANTES de levantar el servidor)
    await runSeedIfNeeded();
    
    // Auto-abrir caja si no hay ninguna abierta (cada vez que arranca)
    const warehouse = await app.prisma.warehouse.findFirst({ where: { name: 'Principal' } });
    if (warehouse) {
      const openSession = await app.prisma.cashSession.findFirst({ 
        where: { warehouseId: warehouse.id, closedAt: null } 
      });
      if (!openSession) {
        await app.prisma.cashSession.create({
          data: { warehouseId: warehouse.id, openingAmount: 0 }
        });
        app.log.info('📦 Sesión de caja abierta automáticamente');
      }
    }
    
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Server running on :${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();


