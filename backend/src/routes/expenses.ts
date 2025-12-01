import { FastifyInstance } from 'fastify';
import { z } from 'zod';

// Categorías de gastos por defecto (se usan si no hay categorías en BD)
const DEFAULT_CATEGORIES = {
  distribuidora: [
    { id: 'servicios', name: 'Servicios Públicos', icon: 'bolt', color: '#F59E0B' },
    { id: 'arriendo', name: 'Arriendo', icon: 'home', color: '#8B5CF6' },
    { id: 'nomina', name: 'Nómina', icon: 'people', color: '#3B82F6' },
    { id: 'transporte', name: 'Transporte/Fletes', icon: 'local_shipping', color: '#10B981' },
    { id: 'mantenimiento', name: 'Mantenimiento', icon: 'build', color: '#6366F1' },
    { id: 'impuestos', name: 'Impuestos', icon: 'account_balance', color: '#EF4444' },
    { id: 'seguros', name: 'Seguros', icon: 'security', color: '#14B8A6' },
    { id: 'suministros', name: 'Suministros/Papelería', icon: 'inventory_2', color: '#EC4899' },
    { id: 'publicidad', name: 'Publicidad/Marketing', icon: 'campaign', color: '#F97316' },
    { id: 'bancarios', name: 'Gastos Bancarios', icon: 'credit_card', color: '#64748B' },
    { id: 'otros', name: 'Otros Gastos', icon: 'more_horiz', color: '#94A3B8' },
  ],
  sanAlas: [
    { id: 'servicios', name: 'Servicios Públicos', icon: 'bolt', color: '#F59E0B' },
    { id: 'arriendo', name: 'Arriendo', icon: 'home', color: '#8B5CF6' },
    { id: 'nomina', name: 'Nómina', icon: 'people', color: '#3B82F6' },
    { id: 'insumos', name: 'Insumos/Materias Primas', icon: 'restaurant', color: '#10B981' },
    { id: 'mantenimiento', name: 'Mantenimiento', icon: 'build', color: '#6366F1' },
    { id: 'gas', name: 'Gas', icon: 'local_fire_department', color: '#EF4444' },
    { id: 'aseo', name: 'Aseo/Limpieza', icon: 'cleaning_services', color: '#14B8A6' },
    { id: 'impuestos', name: 'Impuestos', icon: 'account_balance', color: '#EC4899' },
    { id: 'otros', name: 'Otros Gastos', icon: 'more_horiz', color: '#94A3B8' },
  ],
  empleados: [
    { id: 'adelanto', name: 'Adelanto de Sueldo', icon: 'payments', color: '#3B82F6' },
    { id: 'prestamo', name: 'Préstamo Personal', icon: 'account_balance_wallet', color: '#10B981' },
    { id: 'bonificacion', name: 'Bonificación', icon: 'card_giftcard', color: '#F59E0B' },
    { id: 'uniformes', name: 'Uniformes/Dotación', icon: 'checkroom', color: '#8B5CF6' },
    { id: 'transporte', name: 'Auxilio Transporte', icon: 'directions_bus', color: '#14B8A6' },
    { id: 'alimentacion', name: 'Alimentación', icon: 'restaurant', color: '#EC4899' },
    { id: 'salud', name: 'Salud/Medicamentos', icon: 'local_hospital', color: '#EF4444' },
    { id: 'otros', name: 'Otros', icon: 'more_horiz', color: '#94A3B8' },
  ],
};

export async function expenseRoutes(app: FastifyInstance) {
  // ============ CATEGORÍAS ============
  app.get('/expenses/categories', {
    schema: {
      summary: 'Obtener categorías de gastos',
      tags: ['expenses'],
    },
  }, async () => {
    // Obtener categorías de la BD
    const dbCategories = await app.prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    if (dbCategories.length === 0) {
      // Si no hay categorías en BD, retornar las por defecto
      return DEFAULT_CATEGORIES;
    }

    // Agrupar por negocio
    const result: Record<string, any[]> = { distribuidora: [], sanAlas: [], empleados: [] };
    for (const cat of dbCategories) {
      const business = cat.business as keyof typeof result;
      if (result[business]) {
        result[business].push({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || 'receipt',
          color: cat.color,
        });
      }
    }

    // Si algún negocio no tiene categorías, usar las por defecto
    if (result.distribuidora.length === 0) result.distribuidora = DEFAULT_CATEGORIES.distribuidora;
    if (result.sanAlas.length === 0) result.sanAlas = DEFAULT_CATEGORIES.sanAlas;
    if (result.empleados.length === 0) result.empleados = DEFAULT_CATEGORIES.empleados;

    return result;
  });

  // Crear categoría
  const categorySchema = z.object({
    name: z.string().min(1),
    icon: z.string().optional(),
    color: z.string().default('#3B82F6'),
    business: z.enum(['distribuidora', 'sanAlas', 'empleados']),
  });

  app.post('/expenses/categories', {
    schema: {
      summary: 'Crear categoría de gastos',
      tags: ['expenses'],
    },
  }, async (request, reply) => {
    const parsed = categorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }

    try {
      const created = await app.prisma.expenseCategory.create({
        data: {
          name: parsed.data.name,
          icon: parsed.data.icon || 'receipt',
          color: parsed.data.color,
          business: parsed.data.business,
        },
      });
      return { id: created.id, name: created.name, icon: created.icon, color: created.color };
    } catch (error: any) {
      if (error.code === 'P2002') {
        return reply.code(400).send({ message: 'Ya existe una categoría con ese nombre' });
      }
      throw error;
    }
  });

  // Actualizar categoría
  app.patch('/expenses/categories/:id', {
    schema: {
      summary: 'Actualizar categoría de gastos',
      tags: ['expenses'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = categorySchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos' });
    }

    try {
      const updated = await app.prisma.expenseCategory.update({
        where: { id },
        data: parsed.data,
      });
      return { id: updated.id, name: updated.name, icon: updated.icon, color: updated.color };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.code(404).send({ message: 'Categoría no encontrada' });
      }
      throw error;
    }
  });

  // Eliminar categoría
  app.delete('/expenses/categories/:id', {
    schema: {
      summary: 'Eliminar categoría de gastos',
      tags: ['expenses'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await app.prisma.expenseCategory.update({
        where: { id },
        data: { isActive: false },
      });
      return { success: true };
    } catch (error: any) {
      if (error.code === 'P2025') {
        return reply.code(404).send({ message: 'Categoría no encontrada' });
      }
      throw error;
    }
  });

  // ============ CREAR GASTO ============
  const createSchema = z.object({
    date: z.string().optional(),
    business: z.enum(['distribuidora', 'sanAlas', 'empleados']),
    category: z.string().min(1),
    subcategory: z.string().optional(),
    supplierName: z.string().optional(),
    description: z.string().optional(),
    amount: z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0, 'Monto inválido'),
    paymentMethod: z.enum(['efectivo', 'transferencia', 'credito']).optional(),
    invoiceNumber: z.string().optional(),
    isRecurring: z.boolean().optional(),
    notes: z.string().optional(),
  });

  app.post('/expenses', {
    schema: {
      summary: 'Crear gasto',
      tags: ['expenses'],
    },
  }, async (request, reply) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', errors: parsed.error.errors });
    }
    const data = parsed.data;
    const userId = (request as any).user?.sub;
    
    // Generar número de factura automático si no se proporciona
    let invoiceNumber = data.invoiceNumber;
    if (!invoiceNumber) {
      const lastExpense = await app.prisma.expense.findFirst({
        where: { business: data.business },
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true },
      });
      
      // Extraer el número del último y sumar 1
      let nextNumber = 1;
      if (lastExpense?.invoiceNumber) {
        const match = lastExpense.invoiceNumber.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      
      // Prefijo según negocio
      const prefix = data.business === 'distribuidora' ? 'GD' : 
                     data.business === 'sanAlas' ? 'GS' : 'GE';
      invoiceNumber = `${prefix}-${nextNumber.toString().padStart(5, '0')}`;
    }
    
    const created = await app.prisma.expense.create({
      data: {
        date: data.date ? new Date(data.date) : new Date(),
        business: data.business,
        category: data.category,
        subcategory: data.subcategory,
        supplierName: data.supplierName,
        description: data.description,
        amount: data.amount as any,
        paymentMethod: data.paymentMethod,
        invoiceNumber: invoiceNumber,
        isRecurring: data.isRecurring ?? false,
        notes: data.notes,
        userId: userId || null,
      },
    });

    // Registrar egreso de caja si es efectivo y hay sesión abierta
    if (data.paymentMethod === 'efectivo') {
      const wh = await app.prisma.warehouse.findFirst({ orderBy: { createdAt: 'asc' } });
      if (wh) {
        const session = await app.prisma.cashSession.findFirst({
          where: { warehouseId: wh.id, closedAt: null },
          orderBy: { openedAt: 'desc' },
        });
        if (session) {
          await app.prisma.cashMovement.create({
            data: {
              sessionId: session.id,
              type: 'OUT',
              amount: created.amount as any,
              referenceType: 'EXPENSE',
              referenceId: created.id,
              notes: `Gasto: ${data.category}`,
            },
          });
        }
      }
    }

    return {
      ...created,
      amount: created.amount.toString(),
    };
  });

  // ============ LISTAR GASTOS ============
  app.get('/expenses', {
    schema: {
      summary: 'Listar gastos',
      tags: ['expenses'],
    },
  }, async (request, reply) => {
    const qp = (request.query as any) ?? {};
    const limit = Math.min(Math.max(Number(qp.limit ?? 50), 1), 200);
    const offset = Math.max(Number(qp.offset ?? 0), 0);
    const business = qp.business as string | undefined;
    const category = qp.category as string | undefined;
    const startDate = qp.startDate as string | undefined;
    const endDate = qp.endDate as string | undefined;
    const search = qp.q as string | undefined;

    const where: any = {};
    
    if (business) where.business = business;
    if (category) where.category = category;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59');
    }
    if (search) {
      where.OR = [
        { supplierName: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, rows] = await Promise.all([
      app.prisma.expense.count({ where }),
      app.prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: { select: { id: true, username: true, name: true } }
        }
      }),
    ]);

    reply.header('X-Total-Count', String(total));
    reply.header('X-Limit', String(limit));
    reply.header('X-Offset', String(offset));

    return rows.map(row => ({
      ...row,
      amount: row.amount.toString(),
    }));
  });

  // ============ OBTENER GASTO ============
  app.get('/expenses/:id', {
    schema: {
      summary: 'Obtener gasto',
      tags: ['expenses'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const expense = await app.prisma.expense.findUnique({ where: { id } });
    if (!expense) return reply.code(404).send({ message: 'Gasto no encontrado' });
    return {
      ...expense,
      amount: expense.amount.toString(),
    };
  });

  // ============ ACTUALIZAR GASTO ============
  app.patch('/expenses/:id', {
    schema: {
      summary: 'Actualizar gasto',
      tags: ['expenses'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const updated = await app.prisma.expense.update({
      where: { id },
      data: {
        date: body.date ? new Date(body.date) : undefined,
        business: body.business,
        category: body.category,
        subcategory: body.subcategory,
        supplierName: body.supplierName,
        description: body.description,
        amount: body.amount ? (body.amount as any) : undefined,
        paymentMethod: body.paymentMethod,
        invoiceNumber: body.invoiceNumber,
        isRecurring: body.isRecurring,
        notes: body.notes,
      },
    });

    return {
      ...updated,
      amount: updated.amount.toString(),
    };
  });

  // ============ ELIMINAR GASTO ============
  app.delete('/expenses/:id', {
    schema: {
      summary: 'Eliminar gasto',
      tags: ['expenses'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.prisma.expense.delete({ where: { id } });
    return { message: 'Gasto eliminado' };
  });

  // ============ ESTADÍSTICAS ============
  app.get('/expenses/stats/summary', {
    schema: {
      summary: 'Resumen de gastos',
      tags: ['expenses'],
    },
  }, async (request) => {
    const qp = (request.query as any) ?? {};
    const business = qp.business as string | undefined;
    const year = qp.year ? Number(qp.year) : new Date().getFullYear();
    const month = qp.month ? Number(qp.month) : new Date().getMonth() + 1;

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
    const startOfLastMonth = new Date(year, month - 2, 1);
    const endOfLastMonth = new Date(year, month - 1, 0, 23, 59, 59);
    const startOfYear = new Date(year, 0, 1);

    const whereBase: any = {};
    if (business) whereBase.business = business;

    // Gastos del mes actual
    const thisMonthExpenses = await app.prisma.expense.aggregate({
      where: {
        ...whereBase,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Gastos del mes anterior
    const lastMonthExpenses = await app.prisma.expense.aggregate({
      where: {
        ...whereBase,
        date: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
      _sum: { amount: true },
    });

    // Gastos del año
    const yearExpenses = await app.prisma.expense.aggregate({
      where: {
        ...whereBase,
        date: { gte: startOfYear },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Gastos por categoría este mes
    const byCategory = await app.prisma.expense.groupBy({
      by: ['category'],
      where: {
        ...whereBase,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Gastos por negocio este mes (si no se filtró)
    const byBusiness = !business ? await app.prisma.expense.groupBy({
      by: ['business'],
      where: {
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    }) : null;

    const thisMonth = Number(thisMonthExpenses._sum.amount || 0);
    const lastMonth = Number(lastMonthExpenses._sum.amount || 0);
    const change = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    return {
      thisMonth: {
        total: thisMonth,
        count: thisMonthExpenses._count,
      },
      lastMonth: {
        total: lastMonth,
      },
      change,
      year: {
        total: Number(yearExpenses._sum.amount || 0),
        count: yearExpenses._count,
      },
      byCategory: byCategory.map(c => ({
        category: c.category,
        total: Number(c._sum.amount || 0),
        count: c._count,
      })).sort((a, b) => b.total - a.total),
      byBusiness: byBusiness?.map(b => ({
        business: b.business,
        total: Number(b._sum.amount || 0),
      })),
    };
  });

  // ============ PRÉSTAMOS ============
  
  // Listar préstamos
  app.get('/loans', {
    schema: {
      summary: 'Listar préstamos',
      tags: ['loans'],
    },
  }, async (request, reply) => {
    const qp = (request.query as any) ?? {};
    const limit = Math.min(Math.max(Number(qp.limit ?? 50), 1), 200);
    const offset = Math.max(Number(qp.offset ?? 0), 0);
    const business = qp.business as string | undefined;
    const status = qp.status as string | undefined;
    const type = qp.type as string | undefined;

    const where: any = {};
    if (business) where.business = business;
    if (status) where.status = status;
    if (type) where.type = type;

    const [total, rows] = await Promise.all([
      app.prisma.loan.count({ where }),
      app.prisma.loan.findMany({
        where,
        include: {
          payments: {
            orderBy: { createdAt: 'desc' },
            include: {
              user: { select: { id: true, username: true, name: true } }
            }
          },
          employee: true,
          user: { select: { id: true, username: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    reply.header('X-Total-Count', String(total));

    return rows.map(row => ({
      ...row,
      amount: row.amount.toString(),
      totalAmount: row.totalAmount.toString(),
      paidAmount: row.paidAmount.toString(),
      balance: row.balance.toString(),
      interestRate: row.interestRate.toString(),
      payments: row.payments.map(p => ({
        ...p,
        amount: p.amount.toString(),
      })),
    }));
  });

  // Crear préstamo
  app.post('/loans', {
    schema: {
      summary: 'Crear préstamo',
      tags: ['loans'],
    },
  }, async (request, reply) => {
    const body = request.body as any;
    const userId = (request as any).user?.sub;
    
    const amount = Number(body.amount);
    const interestRate = Number(body.interestRate || 0);
    const totalAmount = amount * (1 + interestRate / 100);
    
    const created = await app.prisma.loan.create({
      data: {
        type: body.type || 'third_party',
        employeeId: body.employeeId,
        borrowerName: body.borrowerName,
        borrowerPhone: body.borrowerPhone,
        borrowerDocument: body.borrowerDocument,
        business: body.business || 'distribuidora',
        amount: amount as any,
        interestRate: interestRate as any,
        totalAmount: totalAmount as any,
        paidAmount: 0,
        balance: totalAmount as any,
        disbursementDate: body.disbursementDate ? new Date(body.disbursementDate) : new Date(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes,
        status: 'ACTIVE',
        userId: userId || null,
      },
    });

    // Registrar egreso de caja
    const wh = await app.prisma.warehouse.findFirst({ orderBy: { createdAt: 'asc' } });
    if (wh) {
      const session = await app.prisma.cashSession.findFirst({
        where: { warehouseId: wh.id, closedAt: null },
        orderBy: { openedAt: 'desc' },
      });
      if (session) {
        await app.prisma.cashMovement.create({
          data: {
            sessionId: session.id,
            type: 'OUT',
            amount: amount as any,
            referenceType: 'LOAN',
            referenceId: created.id,
            notes: `Préstamo a: ${body.borrowerName}`,
          },
        });
      }
    }

    return {
      ...created,
      amount: created.amount.toString(),
      totalAmount: created.totalAmount.toString(),
      balance: created.balance.toString(),
    };
  });

  // Obtener préstamo
  app.get('/loans/:id', {
    schema: {
      summary: 'Obtener préstamo',
      tags: ['loans'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const loan = await app.prisma.loan.findUnique({
      where: { id },
      include: {
        payments: { orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, username: true, name: true } } } },
        employee: true,
        user: { select: { id: true, username: true, name: true } }
      },
    });
    if (!loan) return reply.code(404).send({ message: 'Préstamo no encontrado' });
    
    return {
      ...loan,
      amount: loan.amount.toString(),
      totalAmount: loan.totalAmount.toString(),
      paidAmount: loan.paidAmount.toString(),
      balance: loan.balance.toString(),
      interestRate: loan.interestRate.toString(),
      payments: loan.payments.map(p => ({
        ...p,
        amount: p.amount.toString(),
      })),
    };
  });

  // Registrar pago de préstamo
  app.post('/loans/:id/payments', {
    schema: {
      summary: 'Registrar pago de préstamo',
      tags: ['loans'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const userId = (request as any).user?.sub;
    
    const loan = await app.prisma.loan.findUnique({ where: { id } });
    if (!loan) return reply.code(404).send({ message: 'Préstamo no encontrado' });
    
    const paymentAmount = Number(body.amount);
    const newPaidAmount = Number(loan.paidAmount) + paymentAmount;
    const newBalance = Number(loan.totalAmount) - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'PAID' : 'ACTIVE';

    // Crear pago
    const payment = await app.prisma.loanPayment.create({
      data: {
        loanId: id,
        amount: paymentAmount as any,
        paymentMethod: body.paymentMethod,
        notes: body.notes,
        userId: userId || null,
      },
    });

    // Actualizar préstamo
    await app.prisma.loan.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount as any,
        balance: Math.max(0, newBalance) as any,
        status: newStatus,
      },
    });

    // Registrar ingreso de caja
    const wh = await app.prisma.warehouse.findFirst({ orderBy: { createdAt: 'asc' } });
    if (wh) {
      const session = await app.prisma.cashSession.findFirst({
        where: { warehouseId: wh.id, closedAt: null },
        orderBy: { openedAt: 'desc' },
      });
      if (session) {
        await app.prisma.cashMovement.create({
          data: {
            sessionId: session.id,
            type: 'IN',
            amount: paymentAmount as any,
            referenceType: 'LOAN_PAYMENT',
            referenceId: payment.id,
            notes: `Pago préstamo: ${loan.borrowerName}`,
          },
        });
      }
    }

    return {
      ...payment,
      amount: payment.amount.toString(),
      newBalance: Math.max(0, newBalance),
      loanStatus: newStatus,
    };
  });

  // Cancelar/condonar préstamo
  app.patch('/loans/:id/cancel', {
    schema: {
      summary: 'Cancelar o condonar préstamo',
      tags: ['loans'],
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    const updated = await app.prisma.loan.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: body.reason ? `${body.reason}` : 'Condonado/Cancelado',
      },
    });

    return {
      ...updated,
      amount: updated.amount.toString(),
      balance: updated.balance.toString(),
    };
  });

  // Estadísticas de préstamos
  app.get('/loans/stats/summary', {
    schema: {
      summary: 'Resumen de préstamos',
      tags: ['loans'],
    },
  }, async (request) => {
    const qp = (request.query as any) ?? {};
    const business = qp.business as string | undefined;

    const whereBase: any = {};
    if (business) whereBase.business = business;

    // Total activos
    const activeLoans = await app.prisma.loan.aggregate({
      where: { ...whereBase, status: 'ACTIVE' },
      _sum: { balance: true, amount: true },
      _count: true,
    });

    // Total pagados
    const paidLoans = await app.prisma.loan.aggregate({
      where: { ...whereBase, status: 'PAID' },
      _sum: { totalAmount: true },
      _count: true,
    });

    // Por tipo
    const byType = await app.prisma.loan.groupBy({
      by: ['type'],
      where: { ...whereBase, status: 'ACTIVE' },
      _sum: { balance: true },
      _count: true,
    });

    // Préstamos vencidos
    const overdue = await app.prisma.loan.count({
      where: {
        ...whereBase,
        status: 'ACTIVE',
        dueDate: { lt: new Date() },
      },
    });

    return {
      active: {
        count: activeLoans._count,
        totalLent: Number(activeLoans._sum.amount || 0),
        pendingBalance: Number(activeLoans._sum.balance || 0),
      },
      paid: {
        count: paidLoans._count,
        totalRecovered: Number(paidLoans._sum.totalAmount || 0),
      },
      overdue: {
        count: overdue,
      },
      byType: byType.map(t => ({
        type: t.type,
        count: t._count,
        balance: Number(t._sum.balance || 0),
      })),
    };
  });
}
