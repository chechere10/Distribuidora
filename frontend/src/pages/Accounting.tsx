import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Skeleton,
  Chip,
  IconButton,
  Tooltip,
  Divider,
  useTheme,
  alpha,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Button,
  TextField,
  Stack,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  ShoppingCart,
  Warning,
  Store,
  People,
  AccountBalance,
  Refresh,
  CalendarMonth,
  ExpandMore,
  ExpandLess,
  LocalShipping,
  Receipt,
  MoneyOff,
  Assessment,
  FilterList,
  Download,
  Lock,
  ArrowForward,
  CheckCircle,
  Cancel,
  RestaurantMenu,
  Today,
  DateRange,
  CalendarViewMonth,
  Event,
  Close,
  AccessTime,
  Person,
  Inventory,
  CreditCard,
  PriceCheck,
  ErrorOutline,
  Info,
  Print,
  Visibility,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { es } from 'date-fns/locale/es';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// ============================================
// TIPOS
// ============================================

interface AccountingSummary {
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
    returns: { total: number; count: number };
    total: number;
  };
  netProfit: number;
  profitMargin: string;
}

interface PriceTypeComparison {
  startDate: string;
  endDate: string;
  publico: { sales: number; cost: number; count: number; profit: number; margin: string };
  sanAlas: { sales: number; cost: number; count: number; profit: number; margin: string };
  empleados: { sales: number; cost: number; count: number; profit: number; margin: string };
  total: { sales: number; cost: number; profit: number; count: number };
}

interface SalesByPeriod {
  groupBy: string;
  priceType: string;
  startDate: string;
  endDate: string;
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

interface CashSession {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  closingAmount?: number;
  totalSales?: number;
  totalCash?: number;
  totalTransfer?: number;
  totalFiados?: number;
  salesCount?: number;
  expectedCash?: number;
  cashDifference?: number;
  notes?: string;
  openedBy?: string;
  closedBy?: string;
}

// ============================================
// UTILIDADES
// ============================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number): string => {
  return `${value.toFixed(2)}%`;
};

const formatDate = (date: string): string => {
  return format(new Date(date), 'dd/MM/yyyy', { locale: es });
};

// ============================================
// COMPONENTES
// ============================================

// Tarjeta de KPI principal
const KPICard: React.FC<{
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  bgColor?: string;
  trend?: { value: number; label: string };
  loading?: boolean;
  fullWidth?: boolean;
}> = ({ title, value, subtitle, icon, color, bgColor, trend, loading, fullWidth }) => {
  const theme = useTheme();
  
  if (loading) {
    return (
      <Card sx={{ height: '100%', borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Skeleton variant="circular" width={48} height={48} />
          <Skeleton variant="text" sx={{ mt: 2 }} width="60%" />
          <Skeleton variant="text" width="80%" height={48} />
        </CardContent>
      </Card>
    );
  }

  const isNegative = value < 0;

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 3,
        background: bgColor || `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.85)} 100%)`,
        color: 'white',
        boxShadow: `0 8px 32px ${alpha(color, 0.35)}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 40px ${alpha(color, 0.45)}`,
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha('#fff', 0.2),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
          {trend && (
            <Chip
              size="small"
              icon={trend.value >= 0 ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
              label={`${trend.value >= 0 ? '+' : ''}${trend.value.toFixed(1)}%`}
              sx={{
                bgcolor: alpha('#fff', 0.2),
                color: 'white',
                fontWeight: 'bold',
                '& .MuiChip-icon': { color: 'white' },
              }}
            />
          )}
        </Box>
        <Typography variant="body2" sx={{ mt: 2, opacity: 0.9, fontWeight: 500 }}>
          {title}
        </Typography>
        <Typography 
          variant={fullWidth ? 'h3' : 'h4'} 
          sx={{ 
            mt: 0.5, 
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {isNegative && <TrendingDown />}
          {formatCurrency(Math.abs(value))}
        </Typography>
        {subtitle && (
          <Typography variant="caption" sx={{ opacity: 0.8, mt: 0.5, display: 'block' }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Componente de filtro por tipo de cliente
const ClientTypeFilter: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const theme = useTheme();
  
  const options = [
    { value: 'all', label: 'Todos', icon: <FilterList />, color: theme.palette.primary.main },
    { value: 'publico', label: 'Público', icon: <Store />, color: '#2196f3' },
    { value: 'sanAlas', label: 'San Alas', icon: <RestaurantMenu />, color: '#ff9800' },
    { value: 'empleados', label: 'Empleados', icon: <People />, color: '#9c27b0' },
  ];

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={(_, newValue) => newValue && onChange(newValue)}
      size="small"
      sx={{ 
        bgcolor: 'background.paper',
        '& .MuiToggleButton-root': {
          px: 2,
          py: 1,
          border: 'none',
          borderRadius: '8px !important',
          mx: 0.5,
          '&.Mui-selected': {
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            fontWeight: 'bold',
          },
        },
      }}
    >
      {options.map((opt) => (
        <ToggleButton key={opt.value} value={opt.value}>
          <Box display="flex" alignItems="center" gap={1}>
            {React.cloneElement(opt.icon as React.ReactElement, { 
              fontSize: 'small',
              sx: { color: value === opt.value ? opt.color : 'text.secondary' }
            })}
            <Typography variant="body2">{opt.label}</Typography>
          </Box>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};

// Sección colapsable
const CollapsibleSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: number;
  color?: string;
}> = ({ title, icon, defaultOpen = true, children, badge, color }) => {
  const [open, setOpen] = useState(defaultOpen);
  const theme = useTheme();

  return (
    <Paper sx={{ borderRadius: 3, overflow: 'hidden', mb: 3 }}>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          bgcolor: alpha(color || theme.palette.primary.main, 0.05),
          borderBottom: open ? `1px solid ${alpha(color || theme.palette.primary.main, 0.1)}` : 'none',
          '&:hover': {
            bgcolor: alpha(color || theme.palette.primary.main, 0.1),
          },
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Box sx={{ color: color || 'primary.main' }}>{icon}</Box>
          <Typography variant="h6" fontWeight="bold" color={color || 'primary.main'}>
            {title}
          </Typography>
          {badge !== undefined && (
            <Chip 
              label={badge} 
              size="small" 
              sx={{ 
                bgcolor: alpha(color || theme.palette.primary.main, 0.1),
                color: color || 'primary.main',
                fontWeight: 'bold',
              }} 
            />
          )}
        </Box>
        <IconButton size="small">
          {open ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      </Collapse>
    </Paper>
  );
};

// Tarjeta de tipo de cliente
const ClientTypeCard: React.FC<{
  type: 'publico' | 'sanAlas' | 'empleados';
  data: { sales: number; cost: number; count: number; profit: number; margin: string };
  totalSales: number;
  loading?: boolean;
}> = ({ type, data, totalSales, loading }) => {
  const theme = useTheme();
  
  const config = {
    publico: { 
      label: 'Público General', 
      icon: <Store />, 
      color: '#2196f3',
      emoji: '🏪'
    },
    sanAlas: { 
      label: 'San Alas', 
      icon: <RestaurantMenu />, 
      color: '#ff9800',
      emoji: '🍗'
    },
    empleados: { 
      label: 'Empleados', 
      icon: <People />, 
      color: '#9c27b0',
      emoji: '👷'
    },
  };

  const cfg = config[type];
  const percentage = totalSales > 0 ? (data.sales / totalSales) * 100 : 0;

  if (loading) {
    return (
      <Card sx={{ borderRadius: 3, height: '100%' }}>
        <CardContent>
          <Skeleton variant="rectangular" height={120} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        borderRadius: 3,
        height: '100%',
        border: `2px solid ${alpha(cfg.color, 0.2)}`,
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: cfg.color,
          boxShadow: `0 8px 24px ${alpha(cfg.color, 0.2)}`,
        },
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Typography fontSize={24}>{cfg.emoji}</Typography>
            <Typography variant="h6" fontWeight="bold">
              {cfg.label}
            </Typography>
          </Box>
          <Chip
            label={`${data.count} ventas`}
            size="small"
            sx={{
              bgcolor: alpha(cfg.color, 0.1),
              color: cfg.color,
              fontWeight: 'bold',
            }}
          />
        </Box>

        {/* Ventas */}
        <Typography variant="h4" fontWeight="bold" color={cfg.color} gutterBottom>
          {formatCurrency(data.sales)}
        </Typography>

        {/* Barra de progreso */}
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={percentage}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: alpha(cfg.color, 0.1),
              '& .MuiLinearProgress-bar': {
                bgcolor: cfg.color,
                borderRadius: 4,
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {percentage.toFixed(1)}% del total de ventas
          </Typography>
        </Box>

        {/* Detalles */}
        <Divider sx={{ my: 2 }} />
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Costo</Typography>
            <Typography variant="body1" fontWeight="600" color="error.main">
              {formatCurrency(data.cost)}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="caption" color="text.secondary">Ganancia</Typography>
            <Typography variant="body1" fontWeight="600" color="success.main">
              {formatCurrency(data.profit)}
            </Typography>
          </Grid>
        </Grid>

        {/* Margen */}
        <Box 
          sx={{ 
            mt: 2, 
            p: 1.5, 
            borderRadius: 2, 
            bgcolor: alpha(data.profit >= 0 ? '#4caf50' : '#f44336', 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="body2" fontWeight="500">
            Margen de Ganancia
          </Typography>
          <Typography 
            variant="h6" 
            fontWeight="bold" 
            color={parseFloat(data.margin) >= 0 ? 'success.main' : 'error.main'}
          >
            {data.margin}%
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

const Accounting: React.FC = () => {
  const theme = useTheme();

  // Estados de filtros
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('year');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [priceType, setPriceType] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
  const [customEndDate, setCustomEndDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [cashClosuresDialogOpen, setCashClosuresDialogOpen] = useState(false);
  const [selectedClosure, setSelectedClosure] = useState<CashSession | null>(null);

  // Calcular fechas según el periodo seleccionado
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    
    switch (period) {
      case 'today':
        return {
          startDate: startOfDay(now),
          endDate: endOfDay(now),
        };
      case 'week':
        return {
          startDate: startOfWeek(now, { weekStartsOn: 1 }),
          endDate: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case 'month':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };
      case 'year':
        return {
          startDate: startOfYear(now),
          endDate: endOfYear(now),
        };
      case 'custom':
        return {
          startDate: customStartDate || startOfMonth(now),
          endDate: customEndDate || endOfDay(now),
        };
      default:
        return {
          startDate: startOfYear(now),
          endDate: endOfDay(now),
        };
    }
  }, [period, customStartDate, customEndDate]);

  // Query: Resumen contable
  const { data: summary, isLoading: loadingSummary, refetch: refetchSummary } = useQuery({
    queryKey: ['accounting-summary', startDate, endDate, priceType],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        priceType,
      });
      return api.get<AccountingSummary>(`/accounting/summary?${params}`);
    },
  });

  // Query: Comparación por tipo de precio
  const { data: priceComparison, isLoading: loadingComparison, refetch: refetchComparison } = useQuery({
    queryKey: ['accounting-comparison', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      return api.get<PriceTypeComparison>(`/accounting/compare-price-types?${params}`);
    },
  });

  // Query: Ventas por periodo
  const { data: salesByPeriod, isLoading: loadingSalesByPeriod, refetch: refetchSales } = useQuery({
    queryKey: ['accounting-sales-period', startDate, endDate, groupBy, priceType],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy,
        priceType,
      });
      return api.get<SalesByPeriod>(`/accounting/sales-by-period?${params}`);
    },
  });

  // Query: Cierres de caja
  const { data: cashSessions, isLoading: loadingCashSessions } = useQuery({
    queryKey: ['cash-closures', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      return api.get<CashSession[]>(`/cash/closures?${params}`);
    },
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchComparison();
    refetchSales();
  };

  const isLoading = loadingSummary || loadingComparison || loadingSalesByPeriod;

  // Cálculos corregidos
  // La utilidad neta correcta: Ganancia Bruta - Gastos Operativos - Devoluciones
  // Las compras de inventario NO son un gasto del periodo, son inversión en activo
  const grossProfit = summary?.income?.grossProfit || 0;
  const operationalExpenses = summary?.expenses?.operational?.total || 0;
  const returns = summary?.expenses?.returns?.total || 0;
  
  // Utilidad neta real = Ganancia Bruta - Gastos Operativos - Devoluciones
  const realNetProfit = grossProfit - operationalExpenses - returns;
  
  // Total de egresos de caja (efectivo que sale): Compras + Gastos + Devoluciones
  const purchasesTotal = summary?.expenses?.purchases?.total || 0;
  const totalCashOut = purchasesTotal + operationalExpenses + returns;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={4}>
          <Box>
            <Box display="flex" alignItems="center" gap={2}>
              <AccountBalance sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="h4" fontWeight="bold">
                  Contabilidad
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Análisis financiero detallado del negocio
                </Typography>
              </Box>
            </Box>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Actualizar
          </Button>
        </Box>

        {/* Filtros principales */}
        <Paper sx={{ p: 3, mb: 4, borderRadius: 3 }}>
          <Grid container spacing={3} alignItems="center">
            {/* Selector de periodo */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                📅 PERÍODO
              </Typography>
              <ToggleButtonGroup
                value={period}
                exclusive
                onChange={(_, v) => v && setPeriod(v)}
                size="small"
                sx={{ flexWrap: 'wrap' }}
              >
                <ToggleButton value="today">
                  <Today fontSize="small" sx={{ mr: 0.5 }} /> Hoy
                </ToggleButton>
                <ToggleButton value="week">
                  <DateRange fontSize="small" sx={{ mr: 0.5 }} /> Semana
                </ToggleButton>
                <ToggleButton value="month">
                  <CalendarViewMonth fontSize="small" sx={{ mr: 0.5 }} /> Mes
                </ToggleButton>
                <ToggleButton value="year">
                  <Event fontSize="small" sx={{ mr: 0.5 }} /> Año
                </ToggleButton>
                <ToggleButton value="custom">
                  <CalendarMonth fontSize="small" sx={{ mr: 0.5 }} /> Custom
                </ToggleButton>
              </ToggleButtonGroup>

              {period === 'custom' && (
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <DatePicker
                    label="Desde"
                    value={customStartDate}
                    onChange={setCustomStartDate}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                  <DatePicker
                    label="Hasta"
                    value={customEndDate}
                    onChange={setCustomEndDate}
                    slotProps={{ textField: { size: 'small' } }}
                  />
                </Stack>
              )}
            </Grid>

            {/* Agrupación para tabla */}
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                📊 AGRUPAR POR
              </Typography>
              <ToggleButtonGroup
                value={groupBy}
                exclusive
                onChange={(_, v) => v && setGroupBy(v)}
                size="small"
              >
                <ToggleButton value="day">Día</ToggleButton>
                <ToggleButton value="week">Semana</ToggleButton>
                <ToggleButton value="month">Mes</ToggleButton>
              </ToggleButtonGroup>
            </Grid>

            {/* Cierres de caja */}
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Lock />}
                fullWidth
                onClick={() => setActiveTab(activeTab === 1 ? 0 : 1)}
                sx={{ height: 48 }}
              >
                Cierres de Caja
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* KPIs Principales */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <KPICard
              title="VENTAS TOTALES"
              value={summary?.income?.sales?.total || 0}
              subtitle={`${summary?.income?.sales?.count || 0} transacciones`}
              icon={<ShoppingCart />}
              color="#4caf50"
              loading={loadingSummary}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KPICard
              title="GANANCIA BRUTA"
              value={grossProfit}
              subtitle={`Margen: ${summary?.profitMargin || '0'}%`}
              icon={<TrendingUp />}
              color="#2196f3"
              loading={loadingSummary}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KPICard
              title="TOTAL EGRESOS"
              value={totalCashOut}
              subtitle="Compras + Gastos"
              icon={<TrendingDown />}
              color="#f44336"
              loading={loadingSummary}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <KPICard
              title={realNetProfit >= 0 ? "UTILIDAD NETA" : "PÉRDIDA NETA"}
              value={realNetProfit}
              subtitle={realNetProfit >= 0 ? "✅ Utilidad" : "⚠️ Pérdida"}
              icon={<AccountBalance />}
              color={realNetProfit >= 0 ? '#00897b' : '#d32f2f'}
              bgColor={realNetProfit >= 0 
                ? `linear-gradient(135deg, #00897b 0%, #004d40 100%)`
                : `linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)`
              }
              loading={loadingSummary}
            />
          </Grid>
        </Grid>

        {/* Alerta de estado financiero */}
        {!loadingSummary && (
          <Alert 
            severity={realNetProfit >= 0 ? 'success' : 'warning'}
            icon={realNetProfit >= 0 ? <CheckCircle /> : <Warning />}
            sx={{ mb: 4, borderRadius: 2 }}
          >
            <Typography variant="body1" fontWeight="500">
              {realNetProfit >= 0 
                ? `¡Excelente! Tu negocio tiene una utilidad neta de ${formatCurrency(realNetProfit)} en este período.`
                : `Atención: Tu negocio tiene una pérdida de ${formatCurrency(Math.abs(realNetProfit))}. Los gastos operativos (${formatCurrency(operationalExpenses)}) más las devoluciones (${formatCurrency(returns)}) superan la ganancia bruta (${formatCurrency(grossProfit)}).`
              }
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              📊 Fórmula: Utilidad Neta = Ventas ({formatCurrency(summary?.income?.sales?.total || 0)}) - Costo de Ventas ({formatCurrency(summary?.income?.sales?.cost || 0)}) - Gastos Operativos ({formatCurrency(operationalExpenses)}) - Devoluciones ({formatCurrency(returns)})
            </Typography>
          </Alert>
        )}

        {/* Tabs para cambiar entre vistas */}
        <Tabs 
          value={activeTab} 
          onChange={(_, v) => setActiveTab(v)} 
          sx={{ mb: 3 }}
        >
          <Tab label="📊 Resumen Financiero" />
          <Tab label="🔒 Cierres de Caja" />
        </Tabs>

        {activeTab === 0 && (
          <>
            {/* SECCIÓN: INGRESOS */}
            <CollapsibleSection
              title="INGRESOS"
              icon={<AttachMoney />}
              color="#4caf50"
              badge={summary?.income?.sales?.count}
            >
              {/* Filtro por tipo de cliente */}
              <Box mb={3}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  🎯 FILTRAR POR TIPO DE CLIENTE
                </Typography>
                <ClientTypeFilter value={priceType} onChange={setPriceType} />
              </Box>

              {/* Tarjetas por tipo de cliente */}
              {priceType === 'all' && (
                <Box mb={4}>
                  <Typography variant="h6" gutterBottom fontWeight="bold">
                    💰 Ventas por Tipo de Cliente
                  </Typography>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={4}>
                      <ClientTypeCard
                        type="publico"
                        data={priceComparison?.publico || { sales: 0, cost: 0, count: 0, profit: 0, margin: '0' }}
                        totalSales={priceComparison?.total?.sales || 0}
                        loading={loadingComparison}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <ClientTypeCard
                        type="sanAlas"
                        data={priceComparison?.sanAlas || { sales: 0, cost: 0, count: 0, profit: 0, margin: '0' }}
                        totalSales={priceComparison?.total?.sales || 0}
                        loading={loadingComparison}
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <ClientTypeCard
                        type="empleados"
                        data={priceComparison?.empleados || { sales: 0, cost: 0, count: 0, profit: 0, margin: '0' }}
                        totalSales={priceComparison?.total?.sales || 0}
                        loading={loadingComparison}
                      />
                    </Grid>
                  </Grid>
                </Box>
              )}

              {/* Resumen de ganancia bruta */}
              <Paper 
                sx={{ 
                  p: 3, 
                  borderRadius: 2, 
                  bgcolor: alpha('#4caf50', 0.05),
                  border: `2px solid ${alpha('#4caf50', 0.2)}`,
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" color="text.secondary">
                      GANANCIA BRUTA TOTAL
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      (Ventas - Costo de productos vendidos)
                    </Typography>
                  </Box>
                  <Typography variant="h3" fontWeight="bold" color="success.main">
                    {formatCurrency(grossProfit)}
                  </Typography>
                </Box>
              </Paper>
            </CollapsibleSection>

            {/* SECCIÓN: EGRESOS */}
            <CollapsibleSection
              title="EGRESOS"
              icon={<MoneyOff />}
              color="#f44336"
            >
              <Grid container spacing={3}>
                {/* Compras de Inventario */}
                <Grid item xs={12} md={4}>
                  <Paper
                    sx={{
                      p: 3,
                      borderRadius: 2,
                      bgcolor: alpha('#ff9800', 0.05),
                      border: `2px solid ${alpha('#ff9800', 0.2)}`,
                      height: '100%',
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <LocalShipping sx={{ color: '#ff9800' }} />
                      <Typography variant="h6" fontWeight="bold">
                        Compras de Inventario
                      </Typography>
                    </Box>
                    <Chip
                      label={`${summary?.expenses?.purchases?.count || 0} compras`}
                      size="small"
                      sx={{ mb: 2, bgcolor: alpha('#ff9800', 0.1) }}
                    />
                    <Typography variant="h4" fontWeight="bold" color="#ff9800">
                      {formatCurrency(purchasesTotal)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      💡 Las compras son inversión en inventario, no gasto directo
                    </Typography>
                  </Paper>
                </Grid>

                {/* Gastos Operativos */}
                <Grid item xs={12} md={4}>
                  <Paper
                    sx={{
                      p: 3,
                      borderRadius: 2,
                      bgcolor: alpha('#f44336', 0.05),
                      border: `2px solid ${alpha('#f44336', 0.2)}`,
                      height: '100%',
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <Receipt sx={{ color: '#f44336' }} />
                      <Typography variant="h6" fontWeight="bold">
                        Gastos Operativos
                      </Typography>
                    </Box>
                    <Chip
                      label={`${summary?.expenses?.operational?.count || 0} gastos`}
                      size="small"
                      sx={{ mb: 2, bgcolor: alpha('#f44336', 0.1) }}
                    />
                    <Typography variant="h4" fontWeight="bold" color="#f44336">
                      {formatCurrency(operationalExpenses)}
                    </Typography>
                    
                    {/* Desglose por categoría */}
                    {summary?.expenses?.operational?.byCategory && 
                     summary.expenses.operational.byCategory.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 2 }} />
                        {summary.expenses.operational.byCategory.map((cat) => (
                          <Box 
                            key={cat.category} 
                            display="flex" 
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ py: 0.5 }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              • {cat.category}
                            </Typography>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Chip label={cat.count} size="small" />
                              <Typography variant="body2" fontWeight="600">
                                {formatCurrency(cat.total)}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Paper>
                </Grid>

                {/* Devoluciones */}
                <Grid item xs={12} md={4}>
                  <Paper
                    sx={{
                      p: 3,
                      borderRadius: 2,
                      bgcolor: alpha('#9c27b0', 0.05),
                      border: `2px solid ${alpha('#9c27b0', 0.2)}`,
                      height: '100%',
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={2}>
                      <Cancel sx={{ color: '#9c27b0' }} />
                      <Typography variant="h6" fontWeight="bold">
                        Devoluciones
                      </Typography>
                    </Box>
                    <Chip
                      label={`${summary?.expenses?.returns?.count || 0} devoluciones`}
                      size="small"
                      sx={{ mb: 2, bgcolor: alpha('#9c27b0', 0.1) }}
                    />
                    <Typography variant="h4" fontWeight="bold" color="#9c27b0">
                      {formatCurrency(returns)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      Dinero devuelto a clientes
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* Total Egresos */}
              <Paper 
                sx={{ 
                  p: 3, 
                  mt: 3,
                  borderRadius: 2, 
                  bgcolor: alpha('#f44336', 0.1),
                  border: `2px solid ${alpha('#f44336', 0.3)}`,
                }}
              >
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="h6" color="text.secondary">
                    TOTAL EGRESOS DE CAJA
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="error.main">
                    {formatCurrency(totalCashOut)}
                  </Typography>
                </Box>
              </Paper>
            </CollapsibleSection>

            {/* SECCIÓN: VENTAS POR PERÍODO */}
            <CollapsibleSection
              title="Ventas por Período"
              icon={<Assessment />}
              color="#1976d2"
              badge={salesByPeriod?.data?.length}
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha('#1976d2', 0.05) }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Período</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ventas</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                        <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                          <AttachMoney fontSize="small" color="success" /> Efectivo
                        </Box>
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}>
                        <Box display="flex" alignItems="center" justifyContent="center" gap={0.5}>
                          📱 Transferencia
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Costo</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Ganancia</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold' }}># Ventas</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loadingSalesByPeriod ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton /></TableCell>
                          <TableCell><Skeleton /></TableCell>
                          <TableCell><Skeleton /></TableCell>
                          <TableCell><Skeleton /></TableCell>
                          <TableCell><Skeleton /></TableCell>
                          <TableCell><Skeleton /></TableCell>
                          <TableCell><Skeleton /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <>
                        {salesByPeriod?.data?.map((row) => (
                          <TableRow 
                            key={row.period}
                            sx={{ '&:hover': { bgcolor: alpha('#1976d2', 0.03) } }}
                          >
                            <TableCell>{row.period}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {formatCurrency(row.sales)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={formatCurrency(row.cash)} 
                                size="small"
                                icon={<AttachMoney />}
                                sx={{ bgcolor: alpha('#4caf50', 0.1), color: '#4caf50' }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={formatCurrency(row.transfer)} 
                                size="small"
                                sx={{ bgcolor: alpha('#2196f3', 0.1), color: '#2196f3' }}
                              />
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'error.main' }}>
                              {formatCurrency(row.cost)}
                            </TableCell>
                            <TableCell 
                              align="right" 
                              sx={{ 
                                color: row.profit >= 0 ? 'success.main' : 'error.main',
                                fontWeight: 600,
                              }}
                            >
                              {formatCurrency(row.profit)}
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={row.count} 
                                size="small" 
                                color="primary"
                                sx={{ fontWeight: 'bold' }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {/* Fila de totales */}
                        <TableRow sx={{ bgcolor: alpha('#1976d2', 0.1) }}>
                          <TableCell sx={{ fontWeight: 'bold' }}>TOTAL</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(salesByPeriod?.totals?.sales || 0)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={formatCurrency(salesByPeriod?.totals?.cash || 0)} 
                              size="small"
                              sx={{ bgcolor: '#4caf50', color: 'white', fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={formatCurrency(salesByPeriod?.totals?.transfer || 0)} 
                              size="small"
                              sx={{ bgcolor: '#2196f3', color: 'white', fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                            {formatCurrency(salesByPeriod?.totals?.cost || 0)}
                          </TableCell>
                          <TableCell 
                            align="right" 
                            sx={{ 
                              fontWeight: 'bold',
                              color: (salesByPeriod?.totals?.profit || 0) >= 0 ? 'success.main' : 'error.main',
                            }}
                          >
                            {formatCurrency(salesByPeriod?.totals?.profit || 0)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={salesByPeriod?.totals?.count || 0} 
                              size="small" 
                              color="primary"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CollapsibleSection>

            {/* SECCIÓN: RESULTADO FINAL */}
            <Paper 
              sx={{ 
                p: 4, 
                borderRadius: 3, 
                background: realNetProfit >= 0 
                  ? `linear-gradient(135deg, ${alpha('#00897b', 0.1)} 0%, ${alpha('#00897b', 0.05)} 100%)`
                  : `linear-gradient(135deg, ${alpha('#d32f2f', 0.1)} 0%, ${alpha('#d32f2f', 0.05)} 100%)`,
                border: `2px solid ${realNetProfit >= 0 ? alpha('#00897b', 0.3) : alpha('#d32f2f', 0.3)}`,
              }}
            >
              <Grid container spacing={4} alignItems="center">
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Ganancia Bruta
                  </Typography>
                  <Typography variant="h4" color="success.main" fontWeight="bold">
                    {formatCurrency(grossProfit)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={1} sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="text.secondary">−</Typography>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Gastos Operativos + Devoluciones
                  </Typography>
                  <Typography variant="h4" color="error.main" fontWeight="bold">
                    {formatCurrency(operationalExpenses + returns)}
                  </Typography>
                </Grid>
                
                <Grid item xs={12} md={1} sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" color="text.secondary">=</Typography>
                </Grid>
                
                <Grid item xs={12} md={4}>
                  <Paper
                    sx={{
                      p: 3,
                      borderRadius: 2,
                      bgcolor: realNetProfit >= 0 ? '#00897b' : '#d32f2f',
                      color: 'white',
                      textAlign: 'center',
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ opacity: 0.9 }}>
                      {realNetProfit >= 0 ? '🎉 UTILIDAD NETA' : '⚠️ PÉRDIDA NETA'}
                    </Typography>
                    <Typography variant="h3" fontWeight="bold">
                      {formatCurrency(Math.abs(realNetProfit))}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Paper>
          </>
        )}

        {/* TAB: Cierres de Caja */}
        {activeTab === 1 && (
          <Box>
            {/* Header del historial */}
            <Paper 
              sx={{ 
                p: 3, 
                mb: 3, 
                borderRadius: 3,
                background: `linear-gradient(135deg, ${alpha('#1976d2', 0.1)} 0%, ${alpha('#1976d2', 0.05)} 100%)`,
                border: `1px solid ${alpha('#1976d2', 0.2)}`,
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: '#1976d2', width: 56, height: 56 }}>
                    <Lock fontSize="large" />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      📋 Historial de Cierres de Caja
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Control y auditoría de operaciones de caja
                    </Typography>
                  </Box>
                </Box>
                <Box display="flex" gap={2}>
                  <Chip 
                    icon={<CalendarMonth />}
                    label={`${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`}
                    color="primary"
                    variant="outlined"
                  />
                  <Chip 
                    icon={<Receipt />}
                    label={`${cashSessions?.length || 0} cierres`}
                    color="primary"
                  />
                </Box>
              </Box>

              {/* Resumen rápido de cierres */}
              {cashSessions && cashSessions.length > 0 && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Total Ventas</Typography>
                      <Typography variant="h6" fontWeight="bold" color="success.main">
                        {formatCurrency(cashSessions.reduce((sum, s) => sum + (s.totalSales || 0), 0))}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Total Efectivo</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#4caf50">
                        {formatCurrency(cashSessions.reduce((sum, s) => sum + (s.totalCash || 0), 0))}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Total Transfer</Typography>
                      <Typography variant="h6" fontWeight="bold" color="#2196f3">
                        {formatCurrency(cashSessions.reduce((sum, s) => sum + (s.totalTransfer || 0), 0))}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                      <Typography variant="caption" color="text.secondary">Diferencia Total</Typography>
                      <Typography 
                        variant="h6" 
                        fontWeight="bold" 
                        color={cashSessions.reduce((sum, s) => sum + (s.cashDifference || 0), 0) >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(cashSessions.reduce((sum, s) => sum + (s.cashDifference || 0), 0))}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              )}
            </Paper>

            {/* Lista de cierres */}
            <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
              {loadingCashSessions ? (
                <Box sx={{ p: 3 }}>
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
                  ))}
                </Box>
              ) : cashSessions && cashSessions.length > 0 ? (
                <Box sx={{ maxHeight: 'calc(100vh - 450px)', overflow: 'auto' }}>
                  {cashSessions.map((session, index) => {
                    const difference = session.cashDifference || 0;
                    const isDifferenceOk = difference === 0;
                    const isPositive = difference > 0;
                    
                    return (
                      <Box
                        key={session.id}
                        sx={{
                          p: 3,
                          borderBottom: index < cashSessions.length - 1 ? '1px solid' : 'none',
                          borderColor: 'divider',
                          transition: 'all 0.2s',
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: alpha('#1976d2', 0.03),
                          },
                        }}
                        onClick={() => setSelectedClosure(session)}
                      >
                        <Grid container spacing={3} alignItems="center">
                          {/* Fecha y estado */}
                          <Grid item xs={12} md={3}>
                            <Box display="flex" alignItems="center" gap={2}>
                              <Avatar 
                                sx={{ 
                                  bgcolor: isDifferenceOk ? '#4caf50' : isPositive ? '#ff9800' : '#f44336',
                                  width: 48,
                                  height: 48,
                                }}
                              >
                                {isDifferenceOk ? <CheckCircle /> : isPositive ? <TrendingUp /> : <TrendingDown />}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle1" fontWeight="bold">
                                  {format(new Date(session.openedAt), 'EEEE dd/MM/yyyy', { locale: es })}
                                </Typography>
                                <Box display="flex" alignItems="center" gap={1}>
                                  <AccessTime fontSize="small" color="action" />
                                  <Typography variant="caption" color="text.secondary">
                                    {format(new Date(session.openedAt), 'HH:mm')} - {session.closedAt ? format(new Date(session.closedAt), 'HH:mm') : 'Abierta'}
                                  </Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                                  <Person fontSize="small" color="action" />
                                  <Typography variant="caption" color="text.secondary">
                                    {session.closedBy || session.openedBy || 'Sistema'}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          </Grid>

                          {/* Ventas */}
                          <Grid item xs={6} md={2}>
                            <Box textAlign="center">
                              <Typography variant="caption" color="text.secondary" display="block">
                                💰 Ventas
                              </Typography>
                              <Typography variant="h6" fontWeight="bold">
                                {formatCurrency(session.totalSales || 0)}
                              </Typography>
                              <Chip 
                                label={`${session.salesCount || 0} ventas`}
                                size="small"
                                sx={{ mt: 0.5, fontSize: 10 }}
                              />
                            </Box>
                          </Grid>

                          {/* Efectivo */}
                          <Grid item xs={6} md={2}>
                            <Box textAlign="center">
                              <Typography variant="caption" color="text.secondary" display="block">
                                💵 Efectivo
                              </Typography>
                              <Typography variant="h6" fontWeight="bold" color="#4caf50">
                                {formatCurrency(session.totalCash || 0)}
                              </Typography>
                            </Box>
                          </Grid>

                          {/* Transferencia */}
                          <Grid item xs={6} md={2}>
                            <Box textAlign="center">
                              <Typography variant="caption" color="text.secondary" display="block">
                                📱 Transferencia
                              </Typography>
                              <Typography variant="h6" fontWeight="bold" color="#2196f3">
                                {formatCurrency(session.totalTransfer || 0)}
                              </Typography>
                            </Box>
                          </Grid>

                          {/* Diferencia */}
                          <Grid item xs={6} md={2}>
                            <Box textAlign="center">
                              <Typography variant="caption" color="text.secondary" display="block">
                                📊 Diferencia
                              </Typography>
                              <Chip
                                icon={isDifferenceOk ? <CheckCircle /> : isPositive ? <TrendingUp /> : <TrendingDown />}
                                label={formatCurrency(difference)}
                                sx={{
                                  bgcolor: isDifferenceOk 
                                    ? alpha('#4caf50', 0.1) 
                                    : isPositive 
                                      ? alpha('#ff9800', 0.1) 
                                      : alpha('#f44336', 0.1),
                                  color: isDifferenceOk ? '#4caf50' : isPositive ? '#ff9800' : '#f44336',
                                  fontWeight: 'bold',
                                  fontSize: 14,
                                  height: 32,
                                }}
                              />
                              <Typography 
                                variant="caption" 
                                display="block" 
                                sx={{ 
                                  mt: 0.5,
                                  color: isDifferenceOk ? 'success.main' : isPositive ? 'warning.main' : 'error.main',
                                  fontWeight: 500,
                                }}
                              >
                                {isDifferenceOk ? '✓ Cuadrado' : isPositive ? '↑ Sobrante' : '↓ Faltante'}
                              </Typography>
                            </Box>
                          </Grid>

                          {/* Acciones */}
                          <Grid item xs={12} md={1}>
                            <Box display="flex" justifyContent="center">
                              <Tooltip title="Ver detalles">
                                <IconButton 
                                  color="primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedClosure(session);
                                  }}
                                >
                                  <Visibility />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Grid>
                        </Grid>

                        {/* Notas si existen */}
                        {session.notes && (
                          <Box 
                            sx={{ 
                              mt: 2, 
                              p: 2, 
                              bgcolor: alpha('#ff9800', 0.05), 
                              borderRadius: 2,
                              borderLeft: `4px solid #ff9800`,
                            }}
                          >
                            <Box display="flex" alignItems="center" gap={1}>
                              <Info color="warning" fontSize="small" />
                              <Typography variant="body2" color="text.secondary">
                                <strong>Nota:</strong> {session.notes}
                              </Typography>
                            </Box>
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box textAlign="center" py={8}>
                  <Lock sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No hay cierres de caja
                  </Typography>
                  <Typography variant="body2" color="text.disabled">
                    No se encontraron cierres de caja en el período seleccionado
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        )}

        {/* Dialog de detalle de cierre */}
        <Dialog 
          open={!!selectedClosure} 
          onClose={() => setSelectedClosure(null)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { borderRadius: 3, maxHeight: '90vh' }
          }}
        >
          {selectedClosure && (
            <>
              <DialogTitle sx={{ 
                bgcolor: alpha('#1976d2', 0.05), 
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar sx={{ bgcolor: '#1976d2' }}>
                      <Lock />
                    </Avatar>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        Detalle de Cierre de Caja
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {format(new Date(selectedClosure.openedAt), 'EEEE dd MMMM yyyy', { locale: es })}
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton onClick={() => setSelectedClosure(null)}>
                    <Close />
                  </IconButton>
                </Box>
              </DialogTitle>
              
              <DialogContent sx={{ p: 0 }}>
                <Box sx={{ p: 3 }}>
                  {/* Info del cierre */}
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, bgcolor: alpha('#1976d2', 0.05), borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">Bodega</Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {selectedClosure.warehouseName || 'Principal'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, bgcolor: alpha('#1976d2', 0.05), borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">Apertura</Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {format(new Date(selectedClosure.openedAt), 'HH:mm')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {selectedClosure.openedBy || 'Sistema'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, bgcolor: alpha('#1976d2', 0.05), borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">Cierre</Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {selectedClosure.closedAt ? format(new Date(selectedClosure.closedAt), 'HH:mm') : 'N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {selectedClosure.closedBy || 'Sistema'}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, bgcolor: alpha('#1976d2', 0.05), borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary"># Ventas</Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {selectedClosure.salesCount || 0}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  {/* Resumen financiero */}
                  <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ mt: 3 }}>
                    💰 Resumen Financiero
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 500 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <AttachMoney color="success" /> Monto de Apertura
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {formatCurrency(selectedClosure.openingAmount || 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: alpha('#4caf50', 0.05) }}>
                          <TableCell sx={{ fontWeight: 500 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <ShoppingCart color="success" /> Total Ventas
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                            {formatCurrency(selectedClosure.totalSales || 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 500, pl: 4 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              💵 En Efectivo
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#4caf50' }}>
                            {formatCurrency(selectedClosure.totalCash || 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 500, pl: 4 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              📱 Por Transferencia
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#2196f3' }}>
                            {formatCurrency(selectedClosure.totalTransfer || 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 500 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              📋 Fiados Generados
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ color: '#ff9800' }}>
                            {formatCurrency(selectedClosure.totalFiados || 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: alpha('#1976d2', 0.05) }}>
                          <TableCell sx={{ fontWeight: 600 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <PriceCheck color="primary" /> Efectivo Esperado
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                            {formatCurrency(selectedClosure.expectedCash || 0)}
                          </TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: alpha('#9c27b0', 0.05) }}>
                          <TableCell sx={{ fontWeight: 600 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Inventory color="secondary" /> Efectivo Contado
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold', color: 'secondary.main' }}>
                            {formatCurrency(selectedClosure.closingAmount || 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {/* Diferencia destacada */}
                  <Paper 
                    sx={{ 
                      p: 3, 
                      borderRadius: 2,
                      bgcolor: (selectedClosure.cashDifference || 0) === 0 
                        ? alpha('#4caf50', 0.1)
                        : (selectedClosure.cashDifference || 0) > 0 
                          ? alpha('#ff9800', 0.1)
                          : alpha('#f44336', 0.1),
                      border: `2px solid ${
                        (selectedClosure.cashDifference || 0) === 0 
                          ? '#4caf50'
                          : (selectedClosure.cashDifference || 0) > 0 
                            ? '#ff9800'
                            : '#f44336'
                      }`,
                    }}
                  >
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} md={8}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar 
                            sx={{ 
                              width: 56, 
                              height: 56,
                              bgcolor: (selectedClosure.cashDifference || 0) === 0 
                                ? '#4caf50'
                                : (selectedClosure.cashDifference || 0) > 0 
                                  ? '#ff9800'
                                  : '#f44336',
                            }}
                          >
                            {(selectedClosure.cashDifference || 0) === 0 
                              ? <CheckCircle fontSize="large" />
                              : (selectedClosure.cashDifference || 0) > 0 
                                ? <TrendingUp fontSize="large" />
                                : <ErrorOutline fontSize="large" />
                            }
                          </Avatar>
                          <Box>
                            <Typography variant="h6" fontWeight="bold">
                              {(selectedClosure.cashDifference || 0) === 0 
                                ? '✓ Caja Cuadrada'
                                : (selectedClosure.cashDifference || 0) > 0 
                                  ? '↑ Sobrante de Caja'
                                  : '↓ Faltante de Caja'
                              }
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Diferencia entre efectivo esperado y contado
                            </Typography>
                          </Box>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Typography 
                          variant="h3" 
                          fontWeight="bold" 
                          textAlign="right"
                          color={
                            (selectedClosure.cashDifference || 0) === 0 
                              ? '#4caf50'
                              : (selectedClosure.cashDifference || 0) > 0 
                                ? '#ff9800'
                                : '#f44336'
                          }
                        >
                          {formatCurrency(selectedClosure.cashDifference || 0)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Paper>

                  {/* Notas */}
                  {selectedClosure.notes && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        📝 Notas del Cierre
                      </Typography>
                      <Paper 
                        sx={{ 
                          p: 2, 
                          bgcolor: alpha('#ff9800', 0.05),
                          borderLeft: `4px solid #ff9800`,
                          borderRadius: 2,
                        }}
                      >
                        <Typography variant="body1">
                          {selectedClosure.notes}
                        </Typography>
                      </Paper>
                    </Box>
                  )}
                </Box>
              </DialogContent>
              
              <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Button onClick={() => setSelectedClosure(null)}>
                  Cerrar
                </Button>
                <Button 
                  variant="contained" 
                  startIcon={<Print />}
                  onClick={() => window.print()}
                >
                  Imprimir
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default Accounting;
