import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';

export async function accountingRoutes(app: FastifyInstance) {
  
  // Resumen general de contabilidad
  app.get('/accounting/summary', {
    schema: {
      summary: 'Resumen contable',
      tags: ['accounting'],
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          priceType: { type: 'string' } // 'publico', 'sanAlas', 'all'
        }
      }
    }
  }, async (request, reply) => {
    const { startDate, endDate, priceType = 'all' } = request.query as {
      startDate?: string;
      endDate?: string;
      priceType?: string;
    };

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const hasDateFilter = startDate || endDate;

    // Ventas - filtrar por tipo de precio si se especifica
    // Excluir ventas con status 'returned' o 'cancelled'
    const salesWhere: Prisma.SaleWhereInput = {
      status: { notIn: ['returned', 'cancelled'] }
    };
    if (hasDateFilter) {
      salesWhere.createdAt = dateFilter;
    }

    // Obtener ventas con items para calcular por método de pago
    const sales = await app.prisma.sale.findMany({
      where: salesWhere,
      include: {
        items: {
          include: {
            product: true
          }
        },
        order: true // Para saber si viene de un fiado y el priceType
      }
    });

    // Filtrar por priceType si es necesario
    let filteredSales = sales;
    if (priceType !== 'all') {
      filteredSales = sales.filter(sale => {
        // Usar el priceType directo de la venta
        return sale.priceType === priceType;
      });
    }

    // Calcular totales de ventas
    const salesTotal = filteredSales.reduce((sum, sale) => sum + Number(sale.total), 0);
    
    // Calcular costo de ventas (para ganancia)
    let salesCost = 0;
    for (const sale of filteredSales) {
      for (const item of sale.items) {
        const cost = Number(item.product.cost) || 0;
        const qty = Number(item.baseQuantity);
        salesCost += cost * qty;
      }
    }

    // Compras (egresos por inventario)
    const purchasesWhere: Prisma.PurchaseWhereInput = {};
    if (hasDateFilter) {
      purchasesWhere.createdAt = dateFilter;
    }
    const purchases = await app.prisma.purchase.aggregate({
      where: purchasesWhere,
      _sum: { total: true },
      _count: true
    });

    // Gastos operativos
    const expensesWhere: Prisma.ExpenseWhereInput = {};
    if (hasDateFilter) {
      expensesWhere.date = dateFilter;
    }
    const expenses = await app.prisma.expense.aggregate({
      where: expensesWhere,
      _sum: { amount: true },
      _count: true
    });

    // Gastos por categoría
    const expensesByCategory = await app.prisma.expense.groupBy({
      by: ['category'],
      where: expensesWhere,
      _sum: { amount: true },
      _count: true
    });

    // Fiados pendientes
    const pendingOrders = await app.prisma.order.aggregate({
      where: { 
        status: 'PENDING',
        ...(priceType !== 'all' ? { priceType } : {})
      },
      _sum: { total: true },
      _count: true
    });

    // Devoluciones del periodo
    const returnsWhere: Prisma.ProductReturnWhereInput = {};
    if (hasDateFilter) {
      returnsWhere.createdAt = dateFilter;
    }
    const returns = await app.prisma.productReturn.aggregate({
      where: returnsWhere,
      _sum: { total: true },
      _count: true
    });

    const purchasesTotal = Number(purchases._sum.total) || 0;
    const expensesTotal = Number(expenses._sum.amount) || 0;
    const returnsTotal = Number(returns._sum.total) || 0;
    const grossProfit = salesTotal - salesCost;
    
    // Utilidad Neta CORRECTA: Ganancia Bruta - Gastos Operativos - Devoluciones
    // Las compras de inventario NO son un gasto del P&L, son inversión en activo
    const netProfit = grossProfit - expensesTotal - returnsTotal;
    
    // Total de egresos de caja (flujo de efectivo): Compras + Gastos + Devoluciones
    const totalCashOut = purchasesTotal + expensesTotal + returnsTotal;

    return {
      period: {
        startDate: startDate || 'inicio',
        endDate: endDate || 'hoy'
      },
      priceType,
      income: {
        sales: {
          total: salesTotal,
          count: filteredSales.length,
          cost: salesCost
        },
        grossProfit,
        pendingOrders: {
          total: Number(pendingOrders._sum.total) || 0,
          count: pendingOrders._count
        }
      },
      expenses: {
        purchases: {
          total: purchasesTotal,
          count: purchases._count
        },
        operational: {
          total: expensesTotal,
          count: expenses._count,
          byCategory: expensesByCategory.map(e => ({
            category: e.category,
            total: Number(e._sum.amount) || 0,
            count: e._count
          }))
        },
        returns: {
          total: returnsTotal,
          count: returns._count
        },
        total: totalCashOut // Total de egresos de caja
      },
      netProfit, // Utilidad neta real (P&L)
      profitMargin: salesTotal > 0 ? ((grossProfit / salesTotal) * 100).toFixed(2) : '0'
    };
  });

  // Detalle de ventas con filtros
  app.get('/accounting/sales', {
    schema: {
      summary: 'Detalle de ventas',
      tags: ['accounting']
    }
  }, async (request, reply) => {
    const { startDate, endDate, priceType = 'all', paymentMethod, page = '1', limit = '50' } = request.query as {
      startDate?: string;
      endDate?: string;
      priceType?: string;
      paymentMethod?: string;
      page?: string;
      limit?: string;
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const where: Prisma.SaleWhereInput = {};
    if (startDate || endDate) {
      where.createdAt = dateFilter;
    }

    const sales = await app.prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
            presentation: true
          }
        },
        warehouse: true,
        order: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    });

    // Filtrar por priceType
    let filtered = sales;
    if (priceType !== 'all') {
      filtered = sales.filter(sale => {
        return sale.priceType === priceType;
      });
    }

    const total = await app.prisma.sale.count({ where });

    return {
      sales: filtered.map(sale => ({
        id: sale.id,
        total: Number(sale.total),
        createdAt: sale.createdAt,
        warehouse: sale.warehouse.name,
        priceType: sale.priceType,
        paymentMethod: sale.paymentMethod || 'efectivo',
        isFromOrder: !!sale.order,
        customerName: sale.order?.customerName,
        items: sale.items.map(item => ({
          productName: item.product.name,
          presentationName: item.presentation?.name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
          cost: Number(item.product.cost)
        }))
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  });

  // Ventas por día/semana/mes
  app.get('/accounting/sales-by-period', {
    schema: {
      summary: 'Ventas agrupadas por periodo',
      tags: ['accounting']
    }
  }, async (request, reply) => {
    const { startDate, endDate, groupBy = 'day', priceType = 'all' } = request.query as {
      startDate?: string;
      endDate?: string;
      groupBy?: 'day' | 'week' | 'month' | 'year';
      priceType?: string;
    };

    // Usar fecha de hace 30 días si no se especifica
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const sales = await app.prisma.sale.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      },
      include: {
        order: true,
        items: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Filtrar por priceType
    let filtered = sales;
    if (priceType !== 'all') {
      filtered = sales.filter(sale => {
        return sale.priceType === priceType;
      });
    }

    // Agrupar por periodo
    const grouped: Record<string, { sales: number; cost: number; count: number; cash: number; transfer: number }> = {};

    for (const sale of filtered) {
      const date = new Date(sale.createdAt);
      let key: string;

      switch (groupBy) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = String(date.getFullYear());
          break;
        default: // day
          key = date.toISOString().split('T')[0];
      }

      if (!grouped[key]) {
        grouped[key] = { sales: 0, cost: 0, count: 0, cash: 0, transfer: 0 };
      }

      const total = Number(sale.total);
      grouped[key].sales += total;
      grouped[key].count += 1;

      // Calcular costo
      for (const item of sale.items) {
        grouped[key].cost += Number(item.product.cost) * Number(item.baseQuantity);
      }

      // Por método de pago - usar paymentMethod de la venta directamente
      const method = sale.paymentMethod || 'efectivo';
      if (method === 'transferencia' || method === 'transfer') {
        grouped[key].transfer += total;
      } else {
        grouped[key].cash += total;
      }
    }

    // Convertir a array ordenado
    const result = Object.entries(grouped)
      .map(([period, data]) => ({
        period,
        ...data,
        profit: data.sales - data.cost
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      groupBy,
      priceType,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      data: result,
      totals: {
        sales: result.reduce((sum, r) => sum + r.sales, 0),
        cost: result.reduce((sum, r) => sum + r.cost, 0),
        profit: result.reduce((sum, r) => sum + r.profit, 0),
        cash: result.reduce((sum, r) => sum + r.cash, 0),
        transfer: result.reduce((sum, r) => sum + r.transfer, 0),
        count: result.reduce((sum, r) => sum + r.count, 0)
      }
    };
  });

  // Comparación Público vs San Alas vs Empleados
  app.get('/accounting/compare-price-types', {
    schema: {
      summary: 'Comparar ventas por tipo de precio',
      tags: ['accounting']
    }
  }, async (request, reply) => {
    const { startDate, endDate } = request.query as {
      startDate?: string;
      endDate?: string;
    };

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const sales = await app.prisma.sale.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        status: { notIn: ['returned', 'cancelled'] } // Excluir devueltas y canceladas
      },
      include: {
        order: true,
        items: {
          include: { product: true }
        }
      }
    });

    const publico = { sales: 0, cost: 0, count: 0, profit: 0 };
    const sanAlas = { sales: 0, cost: 0, count: 0, profit: 0 };
    const empleados = { sales: 0, cost: 0, count: 0, profit: 0 };

    for (const sale of sales) {
      const priceType = sale.priceType || 'publico';
      
      // Seleccionar el target correcto según el priceType
      let target;
      if (priceType === 'sanAlas') {
        target = sanAlas;
      } else if (priceType === 'empleados') {
        target = empleados;
      } else {
        target = publico;
      }
      
      target.sales += Number(sale.total);
      target.count += 1;

      for (const item of sale.items) {
        target.cost += Number(item.product.cost) * Number(item.baseQuantity);
      }
    }

    publico.profit = publico.sales - publico.cost;
    sanAlas.profit = sanAlas.sales - sanAlas.cost;
    empleados.profit = empleados.sales - empleados.cost;

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      publico: {
        ...publico,
        margin: publico.sales > 0 ? ((publico.profit / publico.sales) * 100).toFixed(2) : '0'
      },
      sanAlas: {
        ...sanAlas,
        margin: sanAlas.sales > 0 ? ((sanAlas.profit / sanAlas.sales) * 100).toFixed(2) : '0'
      },
      empleados: {
        ...empleados,
        margin: empleados.sales > 0 ? ((empleados.profit / empleados.sales) * 100).toFixed(2) : '0'
      },
      total: {
        sales: publico.sales + sanAlas.sales + empleados.sales,
        cost: publico.cost + sanAlas.cost + empleados.cost,
        profit: publico.profit + sanAlas.profit + empleados.profit,
        count: publico.count + sanAlas.count + empleados.count
      }
    };
  });

  // Detalle de gastos
  app.get('/accounting/expenses', {
    schema: {
      summary: 'Detalle de gastos',
      tags: ['accounting']
    }
  }, async (request, reply) => {
    const { startDate, endDate, category, page = '1', limit = '50' } = request.query as {
      startDate?: string;
      endDate?: string;
      category?: string;
      page?: string;
      limit?: string;
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: Prisma.ExpenseWhereInput = {};
    
    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (category) {
      where.category = category;
    }

    const [expenses, total] = await Promise.all([
      app.prisma.expense.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take
      }),
      app.prisma.expense.count({ where })
    ]);

    return {
      expenses: expenses.map(e => ({
        ...e,
        amount: Number(e.amount)
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    };
  });

  // Categorías de gastos disponibles
  app.get('/accounting/expense-categories', {
    schema: {
      summary: 'Categorías de gastos',
      tags: ['accounting']
    }
  }, async (request, reply) => {
    const categories = await app.prisma.expense.groupBy({
      by: ['category'],
      _count: true
    });

    return categories.map(c => c.category);
  });
}
