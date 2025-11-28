import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AccountBalance,
  ShoppingCart,
  Receipt,
  ExpandMore,
  ExpandLess,
  AttachMoney,
  CreditCard,
  Store,
  Restaurant,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { es } from 'date-fns/locale/es';
import { getToken } from '../api';

// Formato de números colombiano
const formatCOP = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface SummaryData {
  period: { startDate: string; endDate: string };
  priceType: string;
  income: {
    sales: { total: number; count: number; cost: number };
    grossProfit: number;
    pendingOrders: { total: number; count: number };
  };
  expenses: {
    purchases: { total: number; count: number };
    operational: {
      total: number;
      count: number;
      byCategory: Array<{ category: string; total: number; count: number }>;
    };
    total: number;
  };
  netProfit: number;
  profitMargin: string;
}

interface SalesByPeriod {
  groupBy: string;
  data: Array<{
    period: string;
    sales: number;
    cost: number;
    count: number;
    cash: number;
    transfer: number;
    profit: number;
  }>;
  totals: {
    sales: number;
    cost: number;
    profit: number;
    cash: number;
    transfer: number;
    count: number;
  };
}

interface CompareData {
  publico: { sales: number; cost: number; profit: number; count: number; margin: string };
  sanAlas: { sales: number; cost: number; profit: number; count: number; margin: string };
  total: { sales: number; cost: number; profit: number; count: number };
}

interface ExpenseItem {
  id: string;
  date: string;
  category: string;
  supplierName?: string;
  amount: number;
  notes?: string;
}

interface CashClosure {
  id: string;
  warehouseName: string;
  openedAt: string;
  closedAt: string;
  closedBy: string;
  openingAmount: number;
  closingAmount: number;
  totalSales: number;
  totalCash: number;
  totalTransfer: number;
  totalFiados: number;
  salesCount: number;
  expectedCash: number;
  cashDifference: number;
  notes?: string;
}

export default function Accounting() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filtros
  const [priceType, setPriceType] = useState<'all' | 'publico' | 'sanAlas'>('all');
  const [dateRange, setDateRange] = useState<'day' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [startDate, setStartDate] = useState<Date | null>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  
  // Tabs
  const [activeTab, setActiveTab] = useState(0);
  
  // Data
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [salesByPeriod, setSalesByPeriod] = useState<SalesByPeriod | null>(null);
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [cashClosures, setCashClosures] = useState<CashClosure[]>([]);
  const [selectedClosure, setSelectedClosure] = useState<any>(null);
  const [showClosureDetail, setShowClosureDetail] = useState(false);
  
  // Expandir secciones
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    expenses: true,
    sales: true
  });

  // Calcular fechas según el rango seleccionado
  useEffect(() => {
    const now = new Date();
    let start: Date;
    
    switch (dateRange) {
      case 'day':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      case 'year':
        start = new Date(now);
        start.setFullYear(now.getFullYear() - 1);
        break;
      case 'custom':
        return; // No cambiar las fechas
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 30);
    }
    
    setStartDate(start);
    setEndDate(now);
  }, [dateRange]);

  // Cargar datos
  useEffect(() => {
    loadData();
  }, [priceType, startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());
      params.append('priceType', priceType);
      params.append('groupBy', groupBy);

      const headers = {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      };

      const [summaryRes, salesPeriodRes, compareRes, expensesRes, categoriesRes, closuresRes] = await Promise.all([
        fetch(`/api/accounting/summary?${params}`, { headers }).then(r => r.json()),
        fetch(`/api/accounting/sales-by-period?${params}`, { headers }).then(r => r.json()),
        fetch(`/api/accounting/compare-price-types?${params}`, { headers }).then(r => r.json()),
        fetch(`/api/accounting/expenses?${params}`, { headers }).then(r => r.json()),
        fetch(`/api/accounting/expense-categories`, { headers }).then(r => r.json()),
        fetch(`/api/cash/closures?${params}`, { headers }).then(r => r.json()),
      ]);

      setSummary(summaryRes);
      setSalesByPeriod(salesPeriodRes);
      setCompareData(compareRes);
      setExpenses(expensesRes.expenses || []);
      setExpenseCategories(categoriesRes || []);
      setCashClosures(closuresRes || []);
    } catch (err) {
      setError('Error al cargar datos de contabilidad');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const StatCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    color = 'primary',
    trend 
  }: { 
    title: string; 
    value: number; 
    subtitle?: string; 
    icon: any; 
    color?: string;
    trend?: 'up' | 'down';
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" fontWeight="bold" color={color}>
              ${formatCOP(value)}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ 
            backgroundColor: `${color}.light`, 
            borderRadius: 2, 
            p: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Icon sx={{ color: `${color}.main` }} />
          </Box>
        </Box>
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            {trend === 'up' ? (
              <TrendingUp sx={{ color: 'success.main', fontSize: 16, mr: 0.5 }} />
            ) : (
              <TrendingDown sx={{ color: 'error.main', fontSize: 16, mr: 0.5 }} />
            )}
            <Typography variant="caption" color={trend === 'up' ? 'success.main' : 'error.main'}>
              vs periodo anterior
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  if (loading && !summary) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" fontWeight="bold">
            📊 Contabilidad
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* Filtros */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            {/* Tipo de Precio */}
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Tipo de Venta
              </Typography>
              <ToggleButtonGroup
                value={priceType}
                exclusive
                onChange={(_, v) => v && setPriceType(v)}
                size="small"
                fullWidth
              >
                <ToggleButton value="all">
                  Todo
                </ToggleButton>
                <ToggleButton value="publico">
                  <Store sx={{ mr: 0.5, fontSize: 18 }} />
                  Público
                </ToggleButton>
                <ToggleButton value="sanAlas">
                  <Restaurant sx={{ mr: 0.5, fontSize: 18 }} />
                  San Alas
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>

            {/* Rango de Fecha */}
            <Grid item xs={12} md={3}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Periodo
              </Typography>
              <ToggleButtonGroup
                value={dateRange}
                exclusive
                onChange={(_, v) => v && setDateRange(v)}
                size="small"
                fullWidth
              >
                <ToggleButton value="day">Hoy</ToggleButton>
                <ToggleButton value="week">Semana</ToggleButton>
                <ToggleButton value="month">Mes</ToggleButton>
                <ToggleButton value="year">Año</ToggleButton>
                <ToggleButton value="custom">Custom</ToggleButton>
              </ToggleButtonGroup>
            </Grid>

            {/* Fechas Custom */}
            {dateRange === 'custom' && (
              <>
                <Grid item xs={6} md={2}>
                  <DatePicker
                    label="Desde"
                    value={startDate}
                    onChange={setStartDate}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <DatePicker
                    label="Hasta"
                    value={endDate}
                    onChange={setEndDate}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Grid>
              </>
            )}

            {/* Agrupar por */}
            <Grid item xs={12} md={2}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Agrupar
              </Typography>
              <ToggleButtonGroup
                value={groupBy}
                exclusive
                onChange={(_, v) => v && setGroupBy(v)}
                size="small"
                fullWidth
              >
                <ToggleButton value="day">Día</ToggleButton>
                <ToggleButton value="week">Sem</ToggleButton>
                <ToggleButton value="month">Mes</ToggleButton>
              </ToggleButtonGroup>
            </Grid>
          </Grid>
        </Paper>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label="Resumen" />
            <Tab label="Comparación Público / San Alas" />
            <Tab label="Detalle Ventas" />
            <Tab label="Gastos" />
            <Tab label="🔒 Cierres de Caja" />
          </Tabs>
        </Paper>

        {/* Tab: Resumen */}
        {activeTab === 0 && summary && (
          <Box>
            {/* Cards principales */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Ventas Totales"
                  value={summary.income.sales.total}
                  subtitle={`${summary.income.sales.count} ventas`}
                  icon={ShoppingCart}
                  color="primary"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Ganancia Bruta"
                  value={summary.income.grossProfit}
                  subtitle={`Margen: ${summary.profitMargin}%`}
                  icon={TrendingUp}
                  color="success"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Gastos Totales"
                  value={summary.expenses.total}
                  subtitle={`Compras + Operativos`}
                  icon={Receipt}
                  color="warning"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <StatCard
                  title="Ganancia Neta"
                  value={summary.netProfit}
                  subtitle="Después de gastos"
                  icon={AccountBalance}
                  color={summary.netProfit >= 0 ? 'success' : 'error'}
                />
              </Grid>
            </Grid>

            {/* Fiados Pendientes */}
            {summary.income.pendingOrders.count > 0 && (
              <Alert severity="info" sx={{ mb: 3 }}>
                <strong>Fiados Pendientes:</strong> ${formatCOP(summary.income.pendingOrders.total)} ({summary.income.pendingOrders.count} pedidos)
              </Alert>
            )}

            {/* Desglose */}
            <Grid container spacing={3}>
              {/* Ingresos */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom sx={{ color: 'success.main' }}>
                    💰 Ingresos
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Ventas</Typography>
                    <Typography fontWeight="bold">${formatCOP(summary.income.sales.total)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, pl: 2 }}>
                    <Typography variant="body2" color="text.secondary">Costo de productos</Typography>
                    <Typography variant="body2" color="text.secondary">-${formatCOP(summary.income.sales.cost)}</Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography fontWeight="bold" color="success.main">Ganancia Bruta</Typography>
                    <Typography fontWeight="bold" color="success.main">${formatCOP(summary.income.grossProfit)}</Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Egresos */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ color: 'error.main' }}>
                      📤 Egresos
                    </Typography>
                    <IconButton size="small" onClick={() => toggleSection('expenses')}>
                      {expandedSections.expenses ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Compras (Inventario)</Typography>
                    <Typography fontWeight="bold">${formatCOP(summary.expenses.purchases.total)}</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>Gastos Operativos</Typography>
                    <Typography fontWeight="bold">${formatCOP(summary.expenses.operational.total)}</Typography>
                  </Box>

                  <Collapse in={expandedSections.expenses}>
                    {summary.expenses.operational.byCategory.map((cat, idx) => (
                      <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5, pl: 2 }}>
                        <Typography variant="body2" color="text.secondary">{cat.category}</Typography>
                        <Typography variant="body2" color="text.secondary">${formatCOP(cat.total)}</Typography>
                      </Box>
                    ))}
                  </Collapse>

                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography fontWeight="bold" color="error.main">Total Egresos</Typography>
                    <Typography fontWeight="bold" color="error.main">${formatCOP(summary.expenses.total)}</Typography>
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            {/* Tabla de ventas por periodo */}
            {salesByPeriod && salesByPeriod.data.length > 0 && (
              <Paper sx={{ mt: 3, p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  📈 Ventas por {groupBy === 'day' ? 'Día' : groupBy === 'week' ? 'Semana' : 'Mes'}
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Periodo</TableCell>
                        <TableCell align="right">Ventas</TableCell>
                        <TableCell align="right">Efectivo</TableCell>
                        <TableCell align="right">Transferencia</TableCell>
                        <TableCell align="right">Costo</TableCell>
                        <TableCell align="right">Ganancia</TableCell>
                        <TableCell align="center"># Ventas</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {salesByPeriod.data.map((row) => (
                        <TableRow key={row.period}>
                          <TableCell>{row.period}</TableCell>
                          <TableCell align="right">${formatCOP(row.sales)}</TableCell>
                          <TableCell align="right">
                            <Chip 
                              icon={<AttachMoney sx={{ fontSize: 14 }} />} 
                              label={`$${formatCOP(row.cash)}`} 
                              size="small" 
                              color="success"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Chip 
                              icon={<CreditCard sx={{ fontSize: 14 }} />} 
                              label={`$${formatCOP(row.transfer)}`} 
                              size="small" 
                              color="info"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>${formatCOP(row.cost)}</TableCell>
                          <TableCell align="right" sx={{ color: row.profit >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
                            ${formatCOP(row.profit)}
                          </TableCell>
                          <TableCell align="center">{row.count}</TableCell>
                        </TableRow>
                      ))}
                      {/* Totales */}
                      <TableRow sx={{ backgroundColor: 'action.hover' }}>
                        <TableCell><strong>TOTAL</strong></TableCell>
                        <TableCell align="right"><strong>${formatCOP(salesByPeriod.totals.sales)}</strong></TableCell>
                        <TableCell align="right"><strong>${formatCOP(salesByPeriod.totals.cash)}</strong></TableCell>
                        <TableCell align="right"><strong>${formatCOP(salesByPeriod.totals.transfer)}</strong></TableCell>
                        <TableCell align="right"><strong>${formatCOP(salesByPeriod.totals.cost)}</strong></TableCell>
                        <TableCell align="right" sx={{ color: 'success.main' }}><strong>${formatCOP(salesByPeriod.totals.profit)}</strong></TableCell>
                        <TableCell align="center"><strong>{salesByPeriod.totals.count}</strong></TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}
          </Box>
        )}

        {/* Tab: Comparación Público / San Alas */}
        {activeTab === 1 && compareData && (
          <Box>
            <Grid container spacing={3}>
              {/* Público */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderLeft: 4, borderColor: 'primary.main' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Store sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="h6">Público General</Typography>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Ventas</Typography>
                      <Typography variant="h5" fontWeight="bold">${formatCOP(compareData.publico.sales)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary"># Ventas</Typography>
                      <Typography variant="h5" fontWeight="bold">{compareData.publico.count}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Costo</Typography>
                      <Typography variant="h6" color="text.secondary">${formatCOP(compareData.publico.cost)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Ganancia</Typography>
                      <Typography variant="h6" color="success.main" fontWeight="bold">${formatCOP(compareData.publico.profit)}</Typography>
                    </Grid>
                  </Grid>
                  
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography>Margen de Ganancia</Typography>
                    <Chip label={`${compareData.publico.margin}%`} color="success" />
                  </Box>
                </Paper>
              </Grid>

              {/* San Alas */}
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 3, borderLeft: 4, borderColor: 'secondary.main' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Restaurant sx={{ mr: 1, color: 'secondary.main' }} />
                    <Typography variant="h6">San Alas</Typography>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Ventas</Typography>
                      <Typography variant="h5" fontWeight="bold">${formatCOP(compareData.sanAlas.sales)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary"># Ventas</Typography>
                      <Typography variant="h5" fontWeight="bold">{compareData.sanAlas.count}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Costo</Typography>
                      <Typography variant="h6" color="text.secondary">${formatCOP(compareData.sanAlas.cost)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Ganancia</Typography>
                      <Typography variant="h6" color="success.main" fontWeight="bold">${formatCOP(compareData.sanAlas.profit)}</Typography>
                    </Grid>
                  </Grid>
                  
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography>Margen de Ganancia</Typography>
                    <Chip label={`${compareData.sanAlas.margin}%`} color="secondary" />
                  </Box>
                </Paper>
              </Grid>

              {/* Total Combinado */}
              <Grid item xs={12}>
                <Paper sx={{ p: 3, backgroundColor: 'action.hover' }}>
                  <Typography variant="h6" gutterBottom>📊 Total Combinado</Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">Ventas Totales</Typography>
                      <Typography variant="h5" fontWeight="bold">${formatCOP(compareData.total.sales)}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">Costo Total</Typography>
                      <Typography variant="h5">${formatCOP(compareData.total.cost)}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">Ganancia Total</Typography>
                      <Typography variant="h5" fontWeight="bold" color="success.main">${formatCOP(compareData.total.profit)}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Typography variant="body2" color="text.secondary">Total Ventas</Typography>
                      <Typography variant="h5" fontWeight="bold">{compareData.total.count}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Tab: Detalle Ventas */}
        {activeTab === 2 && salesByPeriod && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>📋 Historial de Ventas</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell align="right">Ventas</TableCell>
                    <TableCell align="right">Efectivo</TableCell>
                    <TableCell align="right">Transferencia</TableCell>
                    <TableCell align="right">Ganancia</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {salesByPeriod.data.map((row) => (
                    <TableRow key={row.period} hover>
                      <TableCell>{row.period}</TableCell>
                      <TableCell align="right">${formatCOP(row.sales)}</TableCell>
                      <TableCell align="right">${formatCOP(row.cash)}</TableCell>
                      <TableCell align="right">${formatCOP(row.transfer)}</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main' }}>${formatCOP(row.profit)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {/* Tab: Gastos */}
        {activeTab === 3 && (
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>📤 Detalle de Gastos</Typography>
            {expenses.length === 0 ? (
              <Alert severity="info">No hay gastos registrados en este periodo</Alert>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Fecha</TableCell>
                      <TableCell>Categoría</TableCell>
                      <TableCell>Proveedor</TableCell>
                      <TableCell>Notas</TableCell>
                      <TableCell align="right">Monto</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id} hover>
                        <TableCell>{new Date(expense.date).toLocaleDateString('es-CO')}</TableCell>
                        <TableCell>
                          <Chip label={expense.category} size="small" />
                        </TableCell>
                        <TableCell>{expense.supplierName || '-'}</TableCell>
                        <TableCell>{expense.notes || '-'}</TableCell>
                        <TableCell align="right" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                          ${formatCOP(expense.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        )}

        {/* Tab: Cierres de Caja */}
        {activeTab === 4 && (
          <Box>
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>🔒 Historial de Cierres de Caja</Typography>
              {cashClosures.length === 0 ? (
                <Alert severity="info">No hay cierres de caja registrados en este periodo</Alert>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'grey.100' }}>
                        <TableCell><strong>Fecha Cierre</strong></TableCell>
                        <TableCell><strong>Usuario</strong></TableCell>
                        <TableCell align="right"><strong>Ventas</strong></TableCell>
                        <TableCell align="right"><strong>Efectivo</strong></TableCell>
                        <TableCell align="right"><strong>Transferencias</strong></TableCell>
                        <TableCell align="right"><strong>Fiados</strong></TableCell>
                        <TableCell align="center"><strong>Diferencia</strong></TableCell>
                        <TableCell align="center"><strong>Acciones</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cashClosures.map((closure) => (
                        <TableRow key={closure.id} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">
                              {new Date(closure.closedAt).toLocaleDateString('es-CO')}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(closure.closedAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                          </TableCell>
                          <TableCell>{closure.closedBy}</TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold">${formatCOP(closure.totalSales)}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {closure.salesCount} ventas
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'success.main' }}>
                            ${formatCOP(closure.totalCash)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'info.main' }}>
                            ${formatCOP(closure.totalTransfer)}
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'warning.main' }}>
                            ${formatCOP(closure.totalFiados)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              size="small"
                              label={
                                closure.cashDifference === 0 ? 'CUADRADO' :
                                closure.cashDifference > 0 ? `+$${formatCOP(closure.cashDifference)}` :
                                `-$${formatCOP(Math.abs(closure.cashDifference))}`
                              }
                              color={
                                closure.cashDifference === 0 ? 'success' :
                                closure.cashDifference > 0 ? 'info' : 'error'
                              }
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={async () => {
                                try {
                                  const headers = {
                                    'Authorization': `Bearer ${getToken()}`,
                                    'Content-Type': 'application/json'
                                  };
                                  const detail = await fetch(`/api/cash/closures/${closure.id}`, { headers }).then(r => r.json());
                                  setSelectedClosure(detail);
                                  setShowClosureDetail(true);
                                } catch (err) {
                                  console.error('Error loading closure detail:', err);
                                }
                              }}
                            >
                              <ExpandMore />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>

            {/* Resumen de cierres del periodo */}
            {cashClosures.length > 0 && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <Card sx={{ backgroundColor: 'primary.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="body2">Total Ventas (Periodo)</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(cashClosures.reduce((sum, c) => sum + c.totalSales, 0))}
                      </Typography>
                      <Typography variant="caption">
                        {cashClosures.reduce((sum, c) => sum + c.salesCount, 0)} ventas
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ backgroundColor: 'success.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="body2">Total Efectivo</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(cashClosures.reduce((sum, c) => sum + c.totalCash, 0))}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ backgroundColor: 'info.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="body2">Total Transferencias</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(cashClosures.reduce((sum, c) => sum + c.totalTransfer, 0))}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Card sx={{ backgroundColor: 'warning.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="body2">Total Fiados</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(cashClosures.reduce((sum, c) => sum + c.totalFiados, 0))}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}
          </Box>
        )}

        {/* Dialog: Detalle de Cierre */}
        {selectedClosure && (
          <Dialog 
            open={showClosureDetail} 
            onClose={() => setShowClosureDetail(false)}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle sx={{ backgroundColor: 'primary.main', color: 'white' }}>
              📋 Detalle de Cierre de Caja
            </DialogTitle>
            <DialogContent sx={{ pt: 3 }}>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Usuario:</Typography>
                  <Typography variant="h6">{selectedClosure.closure.closedBy}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">Fecha de cierre:</Typography>
                  <Typography variant="h6">
                    {new Date(selectedClosure.closure.closedAt).toLocaleString('es-CO')}
                  </Typography>
                </Grid>
              </Grid>

              {/* Resumen financiero */}
              <Paper sx={{ p: 2, mb: 3, backgroundColor: 'grey.50' }}>
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>💰 Resumen Financiero</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={2}>
                    <Typography variant="caption" color="text.secondary">Apertura</Typography>
                    <Typography variant="h6">${formatCOP(selectedClosure.closure.openingAmount)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <Typography variant="caption" color="text.secondary">Ventas</Typography>
                    <Typography variant="h6" color="primary">${formatCOP(selectedClosure.closure.totalSales)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <Typography variant="caption" color="text.secondary">Efectivo</Typography>
                    <Typography variant="h6" color="success.main">${formatCOP(selectedClosure.closure.totalCash)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <Typography variant="caption" color="text.secondary">Transferencia</Typography>
                    <Typography variant="h6" color="info.main">${formatCOP(selectedClosure.closure.totalTransfer)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <Typography variant="caption" color="text.secondary">Esperado</Typography>
                    <Typography variant="h6">${formatCOP(selectedClosure.closure.expectedCash)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <Typography variant="caption" color="text.secondary">Diferencia</Typography>
                    <Typography 
                      variant="h6" 
                      color={selectedClosure.closure.cashDifference === 0 ? 'success.main' : 
                             selectedClosure.closure.cashDifference > 0 ? 'info.main' : 'error.main'}
                    >
                      ${formatCOP(selectedClosure.closure.cashDifference)}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Ventas del turno */}
              {selectedClosure.details.sales.length > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    🛒 Ventas ({selectedClosure.details.sales.length})
                  </Typography>
                  <TableContainer sx={{ maxHeight: 200 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>N° Venta</TableCell>
                          <TableCell>Hora</TableCell>
                          <TableCell>Método</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedClosure.details.sales.map((sale: any) => (
                          <TableRow key={sale.id} hover>
                            <TableCell>{String(sale.saleNumber).padStart(6, '0')}</TableCell>
                            <TableCell>
                              {new Date(sale.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell>
                              <Chip 
                                size="small" 
                                label={sale.paymentMethod || 'efectivo'}
                                color={sale.paymentMethod === 'transferencia' ? 'info' : 'success'}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>${formatCOP(sale.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {/* Fiados del turno */}
              {selectedClosure.details.fiados.length > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    📝 Fiados Generados ({selectedClosure.details.fiados.length})
                  </Typography>
                  <TableContainer sx={{ maxHeight: 150 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Cliente</TableCell>
                          <TableCell>Hora</TableCell>
                          <TableCell align="right">Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedClosure.details.fiados.map((fiado: any) => (
                          <TableRow key={fiado.id} hover>
                            <TableCell>{fiado.customerName || 'Sin nombre'}</TableCell>
                            <TableCell>
                              {new Date(fiado.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'warning.main' }}>${formatCOP(fiado.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {/* Gastos del turno */}
              {selectedClosure.details.expenses.length > 0 && (
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    💸 Gastos ({selectedClosure.details.expenses.length})
                  </Typography>
                  <TableContainer sx={{ maxHeight: 150 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Categoría</TableCell>
                          <TableCell>Notas</TableCell>
                          <TableCell align="right">Monto</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedClosure.details.expenses.map((exp: any) => (
                          <TableRow key={exp.id} hover>
                            <TableCell><Chip size="small" label={exp.category} /></TableCell>
                            <TableCell>{exp.notes || '-'}</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>${formatCOP(exp.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {/* Notas del cierre */}
              {selectedClosure.closure.notes && (
                <Paper sx={{ p: 2, mt: 2, backgroundColor: 'warning.50', border: '1px solid', borderColor: 'warning.main' }}>
                  <Typography variant="subtitle2" fontWeight="bold">📝 Notas del cierre:</Typography>
                  <Typography>{selectedClosure.closure.notes}</Typography>
                </Paper>
              )}
            </DialogContent>
            <DialogActions>
              <Button variant="contained" onClick={() => setShowClosureDetail(false)}>
                Cerrar
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </Box>
    </LocalizationProvider>
  );
}
