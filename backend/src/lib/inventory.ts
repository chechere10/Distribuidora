import { PrismaClient, MovementType, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

type DB = PrismaClient | Prisma.TransactionClient;

async function withTx<T>(prisma: DB, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const maybeClient = prisma as PrismaClient & { $transaction?: any };
  if (typeof maybeClient.$transaction === 'function') {
    return maybeClient.$transaction(fn);
  }
  return fn(prisma as Prisma.TransactionClient);
}

export async function ensureStockLevel(
  prisma: Prisma.TransactionClient,
  productId: string,
  warehouseId: string
) {
  const existing = await prisma.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  if (existing) return existing;
  return prisma.stockLevel.create({
    data: { productId, warehouseId, onHand: 0, minStock: 0 },
  });
}

async function maybeCreateLowStockNotification(
  prisma: Prisma.TransactionClient,
  productId: string,
  warehouseId: string,
  onHand: number,
  minStock: number
) {
  if (onHand <= minStock) {
    await prisma.notification.create({
      data: {
        type: 'LOW_STOCK',
        message: `Producto ${productId} en almacén ${warehouseId} en nivel bajo (${onHand} <= min ${minStock})`,
        productId,
        warehouseId,
      },
    });
  }
}

export async function applyMovement(
  prisma: DB,
  args: {
    productId: string;
    warehouseId: string;
    quantity: number; // positive integer
    type: 'IN' | 'OUT' | 'ADJUST';
    unitCost?: string; // Decimal as string
    referenceId?: string;
  }
) {
  const { productId, warehouseId, unitCost, referenceId } = args;
  const quantityAbs = Math.abs(Math.trunc(args.quantity));
  if (quantityAbs <= 0) throw new Error('Quantity must be > 0');
  const type = args.type as MovementType;

  return withTx(prisma, async (tx) => {
    const level = await ensureStockLevel(tx, productId, warehouseId);
    let newOnHand = Number(level.onHand);

    if (type === 'IN') newOnHand = Number(level.onHand) + quantityAbs;
    else if (type === 'OUT') newOnHand = Number(level.onHand) - quantityAbs;
    else if (type === 'ADJUST') newOnHand = quantityAbs; // set absolute level

    if (newOnHand < 0) {
      throw new Error('Stock insuficiente: no se permite stock negativo');
    }

    const updated = await tx.stockLevel.update({
      where: { productId_warehouseId: { productId, warehouseId } },
      data: { onHand: newOnHand },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        warehouseId,
        quantity: type === 'OUT' ? -quantityAbs : quantityAbs,
        type,
        referenceId,
        unitCost: unitCost as any,
      },
    });

    await maybeCreateLowStockNotification(
      tx,
      productId,
      warehouseId,
      Number(updated.onHand),
      Number(updated.minStock)
    );

    return movement;
  });
}

export async function transferStock(
  prisma: DB,
  args: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number }
) {
  const ref = randomUUID();
  return withTx(prisma, async (tx) => {
    await applyMovement(tx, {
      productId: args.productId,
      warehouseId: args.fromWarehouseId,
      quantity: args.quantity,
      type: 'OUT',
      referenceId: ref,
    });
    const inMv = await applyMovement(tx, {
      productId: args.productId,
      warehouseId: args.toWarehouseId,
      quantity: args.quantity,
      type: 'IN',
      referenceId: ref,
    });
    return inMv;
  });
}

export async function createSale(
  prisma: DB,
  args: { 
    warehouseId: string; 
    items: Array<{ 
      productId: string; 
      quantity: number; 
      unitPrice?: string;
      presentationId?: string;
      stockQuantity?: number;
    }>;
    paymentMethod?: string;
    priceType?: string;
    cashReceived?: number | null;
    change?: number | null;
    domicilioPrice?: number;
    userId?: string;
  }
) {
  const { warehouseId, paymentMethod, priceType, cashReceived, change, domicilioPrice, userId } = args;
  if (!args.items || args.items.length === 0) throw new Error('Items requeridos');

  return withTx(prisma, async (tx) => {
    const detailed = [] as Array<{
      productId: string;
      presentationId: string | null;
      quantity: number;
      baseQuantity: number;
      unitPrice: string;
      subtotal: string;
    }>;

    // Primero validar que hay stock suficiente para todos los items
    for (const it of args.items) {
      const product = await tx.product.findUnique({ where: { id: it.productId } });
      if (!product) throw new Error(`Producto ${it.productId} no encontrado`);
      
      const unitPrice = (it.unitPrice ?? product.defaultPrice.toString());
      const quantity = it.quantity;
      
      // stockQuantity es la cantidad de unidad base por presentación (ej: Bulto = 50 kg)
      // Ya viene multiplicado desde el frontend: stockQuantity * quantity
      const baseQuantity = it.stockQuantity || quantity;
      
      // Validar stock disponible
      const currentStock = Number(product.baseStock);
      if (currentStock < baseQuantity) {
        throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${currentStock} ${product.baseUnit}, Requerido: ${baseQuantity} ${product.baseUnit}`);
      }
      
      const subtotal = (Number(unitPrice) * quantity).toFixed(2);
      
      detailed.push({ 
        productId: it.productId, 
        presentationId: it.presentationId || null,
        quantity,
        baseQuantity,
        unitPrice, 
        subtotal 
      });
    }

    const subtotal = detailed.reduce((acc, d) => acc + Number(d.subtotal), 0);
    const domicilio = domicilioPrice || 0;
    const total = (subtotal + domicilio).toFixed(2);

    const sale = await tx.sale.create({
      data: {
        warehouseId,
        userId: userId || null,
        subtotal: subtotal.toFixed(2) as any,
        domicilio: domicilio > 0 ? domicilio.toFixed(2) as any : null,
        total: total as any,
        paymentMethod: paymentMethod || null,
        priceType: priceType || 'publico',
        cashReceived: cashReceived ? cashReceived.toFixed(2) as any : null,
        change: change ? change.toFixed(2) as any : null,
      },
    });

    for (const d of detailed) {
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: d.productId,
          presentationId: d.presentationId,
          quantity: d.quantity,
          baseQuantity: d.baseQuantity,
          unitPrice: d.unitPrice as any,
          subtotal: d.subtotal as any,
        },
      });
      
      // Descontar del baseStock del producto directamente
      await tx.product.update({
        where: { id: d.productId },
        data: {
          baseStock: {
            decrement: d.baseQuantity
          }
        }
      });
      
      // Registrar movimiento de inventario
      await tx.inventoryMovement.create({
        data: {
          productId: d.productId,
          warehouseId,
          quantity: -d.baseQuantity,
          type: 'OUT',
          referenceId: sale.id,
          userId: userId || null,
        },
      });
    }

    return sale;
  });
}


