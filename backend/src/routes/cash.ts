import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

export async function cashRoutes(app: FastifyInstance) {
  const openSchema = z.object({ warehouseId: z.string(), openingAmount: z.string().optional() });
  app.post('/cash/open', {
    schema: {
      summary: 'Abrir caja',
      tags: ['cash'],
      body: { type: 'object', required: ['warehouseId'], properties: { warehouseId: { type: 'string' }, openingAmount: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { id: { type: 'string' }, openedAt: { type: 'string' } } } },
    },
  }, async (request, reply) => {
    const parsed = openSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos' });
    const { warehouseId } = parsed.data;
    const openingAmount = (parsed.data.openingAmount ?? '0') as any;
    const userId = (request as any).user?.sub;

    const exists = await app.prisma.cashSession.findFirst({ where: { warehouseId, closedAt: null } });
    if (exists) return reply.code(400).send({ message: 'Ya hay una caja abierta' });

    const created = await app.prisma.cashSession.create({ data: { warehouseId, openingAmount, openedByUserId: userId || null } });
    return created;
  });

  // Cierre de caja profesional completo
  const closeSchema = z.object({ 
    warehouseId: z.string(), 
    closingAmount: z.string(),
    userEmail: z.string(),
    password: z.string(),
    notes: z.string().optional()
  });
  
  app.post('/cash/close', {
    schema: {
      summary: 'Cerrar caja con resumen completo',
      tags: ['cash'],
    },
  }, async (request, reply) => {
    const parsed = closeSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos' });
    
    const { warehouseId, closingAmount, userEmail: username, password, notes } = parsed.data;
    
    // Verificar credenciales del usuario
    const user = await app.prisma.user.findUnique({ where: { username } });
    if (!user) {
      return reply.code(401).send({ message: 'Usuario no encontrado' });
    }
    
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return reply.code(401).send({ message: 'Contraseña incorrecta' });
    }
    
    // Buscar sesión de caja abierta
    const session = await app.prisma.cashSession.findFirst({ 
      where: { warehouseId, closedAt: null }, 
      orderBy: { openedAt: 'desc' } 
    });
    
    if (!session) {
      return reply.code(400).send({ message: 'No hay caja abierta' });
    }
    
    // Verificar que el usuario sea el que abrió la caja o sea administrador
    if (session.openedByUserId && session.openedByUserId !== user.id && user.role !== 'admin') {
      // Buscar el nombre del usuario que abrió la caja
      const openedByUser = await app.prisma.user.findUnique({ 
        where: { id: session.openedByUserId },
        select: { name: true, username: true }
      });
      const openedByName = openedByUser?.name || openedByUser?.username || 'otro usuario';
      return reply.code(403).send({ 
        message: `Solo ${openedByName} o un administrador puede cerrar esta caja` 
      });
    }
    
    // Calcular resumen del periodo
    const sessionStart = session.openedAt;
    const sessionEnd = new Date();
    
    // Obtener ventas del periodo
    const sales = await app.prisma.sale.findMany({
      where: {
        createdAt: {
          gte: sessionStart,
          lte: sessionEnd
        },
        warehouseId
      },
      include: {
        items: { include: { product: true } }
      }
    });
    
    // Calcular totales de ventas
    let totalSales = 0;
    let totalCash = 0;
    let totalTransfer = 0;
    let totalCost = 0;
    
    for (const sale of sales) {
      const saleTotal = Number(sale.total);
      totalSales += saleTotal;
      
      // Por método de pago
      const method = sale.paymentMethod || 'efectivo';
      if (method === 'transferencia' || method === 'transfer') {
        totalTransfer += saleTotal;
      } else {
        totalCash += saleTotal;
      }
      
      // Calcular costo
      for (const item of sale.items) {
        totalCost += Number(item.product.cost) * Number(item.baseQuantity);
      }
    }
    
    // Fiados generados en el periodo
    const fiados = await app.prisma.order.findMany({
      where: {
        createdAt: {
          gte: sessionStart,
          lte: sessionEnd
        },
        warehouseId,
        status: 'PENDING'
      }
    });
    const totalFiados = fiados.reduce((sum, f) => sum + Number(f.total), 0);
    
    // Fiados cobrados en el periodo
    const fiadosCobrados = await app.prisma.order.findMany({
      where: {
        paidAt: {
          gte: sessionStart,
          lte: sessionEnd
        },
        warehouseId,
        status: 'PAID'
      }
    });
    const totalFiadosCobrados = fiadosCobrados.reduce((sum, f) => sum + Number(f.total), 0);
    
    // Compras/Pedidos a proveedores en el periodo
    const purchases = await app.prisma.purchase.findMany({
      where: {
        createdAt: {
          gte: sessionStart,
          lte: sessionEnd
        },
        warehouseId
      }
    });
    const totalPurchases = purchases.reduce((sum, p) => sum + Number(p.total), 0);
    
    // Gastos del periodo (usando createdAt para capturar gastos registrados durante la sesión)
    const expenses = await app.prisma.expense.findMany({
      where: {
        createdAt: {
          gte: sessionStart,
          lte: sessionEnd
        }
      }
    });
    // Solo gastos en efectivo afectan la caja
    const expensesCash = expenses.filter(e => !e.paymentMethod || e.paymentMethod === 'efectivo');
    const totalExpenses = expensesCash.reduce((sum, e) => sum + Number(e.amount), 0);
    
    // Calcular efectivo esperado
    const openingAmount = Number(session.openingAmount);
    const expectedCash = openingAmount + totalCash + totalFiadosCobrados - totalExpenses;
    const actualCash = Number(closingAmount);
    const cashDifference = actualCash - expectedCash;
    
    // Actualizar sesión con todos los datos del cierre
    const updated = await app.prisma.cashSession.update({ 
      where: { id: session.id }, 
      data: { 
        closedAt: sessionEnd, 
        closingAmount: closingAmount as any,
        closedByUserId: user.id,
        totalSales: totalSales as any,
        totalCash: totalCash as any,
        totalTransfer: totalTransfer as any,
        totalFiados: totalFiados as any,
        salesCount: sales.length,
        expectedCash: expectedCash as any,
        cashDifference: cashDifference as any,
        notes: notes || null
      } 
    });
    
    // Retornar resumen completo
    return {
      id: updated.id,
      closedAt: updated.closedAt,
      closedBy: user.name || user.username,
      period: {
        start: sessionStart,
        end: sessionEnd
      },
      summary: {
        openingAmount,
        totalSales,
        salesCount: sales.length,
        totalCash,
        totalTransfer,
        totalFiados,
        fiadosCount: fiados.length,
        totalFiadosCobrados,
        fiadosCobradosCount: fiadosCobrados.length,
        totalPurchases,
        purchasesCount: purchases.length,
        totalExpenses,
        expensesCount: expenses.length,
        totalCost,
        grossProfit: totalSales - totalCost,
        expectedCash,
        actualCash,
        cashDifference,
        differenceStatus: cashDifference === 0 ? 'CUADRADO' : cashDifference > 0 ? 'SOBRANTE' : 'FALTANTE'
      },
      notes: updated.notes
    };
  });

  // Obtener historial de cierres de caja
  app.get('/cash/closures', {
    schema: {
      summary: 'Historial de cierres de caja',
      tags: ['cash'],
    },
  }, async (request, reply) => {
    const { warehouseId, startDate, endDate, limit = '50', offset = '0' } = request.query as any;
    
    const where: any = {
      closedAt: { not: null }
    };
    
    if (warehouseId) {
      where.warehouseId = warehouseId;
    }
    
    if (startDate || endDate) {
      where.closedAt = {};
      if (startDate) where.closedAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.closedAt.lte = end;
      }
    }
    
    const [total, closures] = await Promise.all([
      app.prisma.cashSession.count({ where }),
      app.prisma.cashSession.findMany({
        where,
        orderBy: { closedAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: { 
          warehouse: true,
          closedBy: { select: { id: true, username: true, name: true } },
          openedBy: { select: { id: true, username: true, name: true } }
        }
      })
    ]);
    
    reply.header('X-Total-Count', String(total));
    
    return closures.map(c => ({
      id: c.id,
      warehouseId: c.warehouseId,
      warehouseName: c.warehouse.name,
      openedAt: c.openedAt,
      closedAt: c.closedAt,
      closedBy: c.closedBy?.name || c.closedBy?.username || null,
      openedBy: c.openedBy?.name || c.openedBy?.username || null,
      openingAmount: Number(c.openingAmount),
      closingAmount: Number(c.closingAmount),
      totalSales: Number(c.totalSales || 0),
      totalCash: Number(c.totalCash || 0),
      totalTransfer: Number(c.totalTransfer || 0),
      totalFiados: Number(c.totalFiados || 0),
      salesCount: c.salesCount || 0,
      expectedCash: Number(c.expectedCash || 0),
      cashDifference: Number(c.cashDifference || 0),
      notes: c.notes
    }));
  });

  // Obtener detalle de un cierre específico
  app.get('/cash/closures/:id', {
    schema: {
      summary: 'Detalle de cierre de caja',
      tags: ['cash'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const closure = await app.prisma.cashSession.findUnique({
      where: { id },
      include: { 
        warehouse: true,
        movements: true,
        closedBy: { select: { id: true, username: true, name: true } },
        openedBy: { select: { id: true, username: true, name: true } }
      }
    });
    
    if (!closure) {
      return reply.code(404).send({ message: 'Cierre no encontrado' });
    }
    
    // Obtener datos detallados del periodo
    const sessionStart = closure.openedAt;
    const sessionEnd = closure.closedAt || new Date();
    
    // Ventas del periodo
    const sales = await app.prisma.sale.findMany({
      where: {
        createdAt: { gte: sessionStart, lte: sessionEnd },
        warehouseId: closure.warehouseId
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    // Fiados del periodo
    const fiados = await app.prisma.order.findMany({
      where: {
        createdAt: { gte: sessionStart, lte: sessionEnd },
        warehouseId: closure.warehouseId,
        status: 'PENDING'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Compras del periodo
    const purchases = await app.prisma.purchase.findMany({
      where: {
        createdAt: { gte: sessionStart, lte: sessionEnd },
        warehouseId: closure.warehouseId
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' }
    });
    
    // Gastos del periodo
    const expenses = await app.prisma.expense.findMany({
      where: {
        createdAt: { gte: sessionStart, lte: sessionEnd }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return {
      closure: {
        id: closure.id,
        warehouseName: closure.warehouse.name,
        openedAt: closure.openedAt,
        closedAt: closure.closedAt,
        closedBy: closure.closedBy?.name || closure.closedBy?.username || null,
        openedBy: closure.openedBy?.name || closure.openedBy?.username || null,
        openingAmount: Number(closure.openingAmount),
        closingAmount: Number(closure.closingAmount),
        totalSales: Number(closure.totalSales || 0),
        totalCash: Number(closure.totalCash || 0),
        totalTransfer: Number(closure.totalTransfer || 0),
        totalFiados: Number(closure.totalFiados || 0),
        salesCount: closure.salesCount || 0,
        expectedCash: Number(closure.expectedCash || 0),
        cashDifference: Number(closure.cashDifference || 0),
        notes: closure.notes
      },
      details: {
        sales: sales.map(s => ({
          id: s.id,
          saleNumber: s.saleNumber,
          total: Number(s.total),
          paymentMethod: s.paymentMethod,
          createdAt: s.createdAt,
          itemsCount: s.items.length
        })),
        fiados: fiados.map(f => ({
          id: f.id,
          customerName: f.customerName,
          total: Number(f.total),
          createdAt: f.createdAt
        })),
        purchases: purchases.map(p => ({
          id: p.id,
          supplierName: p.supplierName,
          total: Number(p.total),
          createdAt: p.createdAt,
          itemsCount: p.items.length
        })),
        expenses: expenses.map(e => ({
          id: e.id,
          category: e.category,
          amount: Number(e.amount),
          notes: e.notes,
          date: e.date
        })),
        movements: closure.movements.map(m => ({
          id: m.id,
          type: m.type,
          amount: Number(m.amount),
          notes: m.notes,
          createdAt: m.createdAt
        }))
      }
    };
  });

  // Preview del cierre de caja (para mostrar resumen antes de cerrar)
  app.get('/cash/preview', {
    schema: {
      summary: 'Preview del cierre de caja actual',
      tags: ['cash'],
      querystring: { type: 'object', required: ['warehouseId'], properties: { warehouseId: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const warehouseId = (request.query as any)?.warehouseId as string;
    if (!warehouseId) return reply.code(400).send({ message: 'warehouseId requerido' });
    
    // Buscar sesión de caja abierta
    const session = await app.prisma.cashSession.findFirst({ 
      where: { warehouseId, closedAt: null }, 
      orderBy: { openedAt: 'desc' } 
    });
    
    if (!session) {
      return reply.code(400).send({ message: 'No hay caja abierta' });
    }
    
    const sessionStart = session.openedAt;
    const sessionEnd = new Date();
    
    // Obtener ventas del periodo
    const sales = await app.prisma.sale.findMany({
      where: {
        createdAt: { gte: sessionStart, lte: sessionEnd },
        warehouseId
      },
      include: { items: { include: { product: true } } }
    });
    
    // Calcular totales
    let totalSales = 0;
    let totalCash = 0;
    let totalTransfer = 0;
    
    for (const sale of sales) {
      const saleTotal = Number(sale.total);
      totalSales += saleTotal;
      const method = sale.paymentMethod || 'efectivo';
      if (method === 'transferencia' || method === 'transfer') {
        totalTransfer += saleTotal;
      } else {
        totalCash += saleTotal;
      }
    }
    
    // Fiados generados
    const fiados = await app.prisma.order.findMany({
      where: {
        createdAt: { gte: sessionStart, lte: sessionEnd },
        warehouseId,
        status: 'PENDING'
      }
    });
    const totalFiados = fiados.reduce((sum, f) => sum + Number(f.total), 0);
    
    // Fiados cobrados
    const fiadosCobrados = await app.prisma.order.findMany({
      where: {
        paidAt: { gte: sessionStart, lte: sessionEnd },
        warehouseId,
        status: 'PAID'
      }
    });
    const totalFiadosCobrados = fiadosCobrados.reduce((sum, f) => sum + Number(f.total), 0);
    
    // Gastos del periodo (usando createdAt para incluir gastos creados durante la sesión)
    // Usamos createdAt porque la fecha del gasto puede ser anterior pero se registró durante esta sesión
    const expenses = await app.prisma.expense.findMany({
      where: { 
        createdAt: { gte: sessionStart, lte: sessionEnd }
      },
      orderBy: { createdAt: 'desc' }
    });
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    
    // Gastos solo en efectivo
    const expensesCash = expenses.filter(e => !e.paymentMethod || e.paymentMethod === 'efectivo');
    const totalExpensesCash = expensesCash.reduce((sum, e) => sum + Number(e.amount), 0);
    
    // Compras a proveedores del periodo (RECEIVED = pagadas y recibidas)
    const purchases = await app.prisma.purchase.findMany({
      where: {
        createdAt: { gte: sessionStart, lte: sessionEnd },
        warehouseId,
        status: 'RECEIVED' // Solo compras ya recibidas/pagadas
      },
      include: { supplier: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    const totalPurchasesCash = purchases.reduce((sum, p) => sum + Number(p.total), 0);
    
    // Préstamos desembolsados en el periodo (asumimos efectivo)
    const loans = await app.prisma.loan.findMany({
      where: {
        disbursementDate: { gte: sessionStart, lte: sessionEnd },
        status: { not: 'CANCELLED' }
      },
      include: { employee: { select: { name: true } } },
      orderBy: { disbursementDate: 'desc' }
    });
    const totalLoansCash = loans.reduce((sum, l) => sum + Number(l.amount), 0);
    
    // Calcular total de egresos en efectivo (gastos + compras + préstamos)
    const totalEgresos = totalExpensesCash + totalPurchasesCash + totalLoansCash;
    
    // Calcular efectivo esperado
    const openingAmount = Number(session.openingAmount);
    const expectedCash = openingAmount + totalCash + totalFiadosCobrados - totalEgresos;
    
    // Preparar detalle de egresos para mostrar
    const egresosDetalle = [
      // Gastos en efectivo
      ...expensesCash.map(e => ({
        tipo: 'GASTO',
        descripcion: e.description || e.category,
        beneficiario: e.supplierName || '-',
        monto: Number(e.amount),
        fecha: e.createdAt,
        categoria: e.category,
        factura: e.invoiceNumber
      })),
      // Compras a proveedores
      ...purchases.map(p => ({
        tipo: 'COMPRA',
        descripcion: `Compra #${p.purchaseNumber}`,
        beneficiario: p.supplier?.name || p.supplierName || 'Proveedor',
        monto: Number(p.total),
        fecha: p.createdAt,
        categoria: 'Compra Mercancía',
        factura: p.invoiceNumber
      })),
      // Préstamos
      ...loans.map(l => ({
        tipo: 'PRESTAMO',
        descripcion: `Préstamo #${l.loanNumber}`,
        beneficiario: l.employee?.name || l.borrowerName,
        monto: Number(l.amount),
        fecha: l.disbursementDate,
        categoria: 'Préstamos',
        factura: null
      }))
    ].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    
    return {
      sessionId: session.id,
      openedAt: session.openedAt,
      openingAmount,
      summary: {
        totalSales,
        salesCount: sales.length,
        totalCash,
        totalTransfer,
        totalFiados,
        fiadosCount: fiados.length,
        totalFiadosCobrados,
        fiadosCobradosCount: fiadosCobrados.length,
        // Egresos detallados
        totalExpenses: totalExpensesCash,
        expensesCount: expensesCash.length,
        totalPurchasesCash,
        purchasesCount: purchases.length,
        totalLoansCash,
        loansCount: loans.length,
        totalEgresos,
        expectedCash
      },
      egresos: egresosDetalle
    };
  });

  app.get('/cash/session', {
    schema: {
      summary: 'Estado de caja actual',
      tags: ['cash'],
      querystring: { type: 'object', required: ['warehouseId'], properties: { warehouseId: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { session: { type: 'object', nullable: true }, totals: { type: 'object', properties: { opening: { type: 'number' }, income: { type: 'number' }, outflow: { type: 'number' }, expected: { type: 'number' } } } } } },
    },
  }, async (request, reply) => {
    const warehouseId = (request.query as any)?.warehouseId as string;
    if (!warehouseId) return reply.code(400).send({ message: 'warehouseId requerido' });
    const session = await app.prisma.cashSession.findFirst({ where: { warehouseId, closedAt: null }, orderBy: { openedAt: 'desc' } });
    if (!session) return { session: null };

    const [inSum, outSum] = await Promise.all([
      app.prisma.cashMovement.aggregate({ where: { sessionId: session.id, type: 'IN' }, _sum: { amount: true } }),
      app.prisma.cashMovement.aggregate({ where: { sessionId: session.id, type: 'OUT' }, _sum: { amount: true } }),
    ]);
    const income = Number(inSum._sum.amount ?? 0);
    const outflow = Number(outSum._sum.amount ?? 0);
    const opening = Number(session.openingAmount as any);
    const expected = opening + income - outflow;
    return { session, totals: { opening, income, outflow, expected } };
  });

  const mvSchema = z.object({ warehouseId: z.string(), type: z.enum(['IN', 'OUT']), amount: z.string(), notes: z.string().optional() });
  app.post('/cash/movements', {
    schema: {
      summary: 'Crear movimiento de caja',
      tags: ['cash'],
      body: { type: 'object', required: ['warehouseId', 'type', 'amount'], properties: { warehouseId: { type: 'string' }, type: { enum: ['IN', 'OUT'] }, amount: { type: 'string' }, notes: { type: 'string' } } },
      response: { 200: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' }, amount: { anyOf: [{ type: 'string' }, { type: 'number' }] } } } },
    },
  }, async (request, reply) => {
    const parsed = mvSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos' });
    const { warehouseId, type, amount, notes } = parsed.data;
    const session = await app.prisma.cashSession.findFirst({ where: { warehouseId, closedAt: null }, orderBy: { openedAt: 'desc' } });
    if (!session) return reply.code(400).send({ message: 'No hay caja abierta' });
    const mv = await app.prisma.cashMovement.create({ data: { sessionId: session.id, type: type as any, amount: amount as any, notes } });
    return mv;
  });

  app.get('/cash/movements', {
    schema: {
      summary: 'Listar movimientos de caja',
      tags: ['cash'],
      querystring: { type: 'object', required: ['warehouseId'], properties: { warehouseId: { type: 'string' } } },
      response: { 200: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'string' }, amount: { anyOf: [{ type: 'string' }, { type: 'number' }] } } } } },
    },
  }, async (request, reply) => {
    const warehouseId = (request.query as any)?.warehouseId as string;
    if (!warehouseId) return reply.code(400).send({ message: 'warehouseId requerido' });
    const session = await app.prisma.cashSession.findFirst({ where: { warehouseId, closedAt: null }, orderBy: { openedAt: 'desc' } });
    if (!session) return [];
    return app.prisma.cashMovement.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: 'desc' }, take: 200 });
  });
}


