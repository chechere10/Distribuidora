import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');
  
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

  console.log('🎉 Seed completado exitosamente');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });


