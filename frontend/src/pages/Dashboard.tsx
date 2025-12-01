import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Skeleton,
  Alert,
  Chip,
  Avatar,
  LinearProgress,
  IconButton,
  Tooltip,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  AttachMoney,
  ShoppingCart,
  Inventory,
  Warning,
  Store,
  People,
  Receipt,
  AccountBalance,
  LocalShipping,
  Refresh,
  ArrowUpward,
  ArrowDownward,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

// Types
interface AccountingSummary {
  income: {
    sales: { total: number; count: number; cost: number };
    grossProfit: number;
  };
  expenses: {
    total: number;
    returns: { total: number; count: number };
  };
  netProfit: number;
}

interface PriceTypeComparison {
  publico: { sales: number; count: number; profit: number };
  sanAlas: { sales: number; count: number; profit: number };
  empleados: { sales: number; count: number; profit: number };
}

interface ExpensesSummary {
  thisMonth: { total: number; count: number };
  byBusiness?: { business: string; total: number }[];
}

interface OrdersSummary {
  pending: { count: number; total: number };
  paid: { count: number; total: number };
  cancelled: { count: number };
  totalPending: number;
}

interface LowStockProduct {
  id: string;
  name: string;
  stock: number;
  baseStock: string;
  minStock: number;
}

interface RecentSale {
  id: string;
  invoiceNumber?: string;
  saleNumber?: number;
  total: number;
  priceType: string;
  createdAt: string;
}

// Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  subtitle?: string;
  loading?: boolean;
}> = ({ title, value, icon, color, trend, subtitle, loading }) => {
  const theme = useTheme();
  
  if (loading) {
    return (
      <Card sx={{ height: '100%', borderRadius: 3 }}>
        <CardContent>
          <Skeleton variant="circular" width={48} height={48} />
          <Skeleton variant="text" sx={{ mt: 2 }} width="60%" />
          <Skeleton variant="text" width="40%" height={40} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 3,
        background: `linear-gradient(135deg, ${alpha(color, 0.1)} 0%, ${alpha(color, 0.05)} 100%)`,
        border: `1px solid ${alpha(color, 0.2)}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(color, 0.25)}`,
        },
      }}
    >
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              background: `linear-gradient(135deg, ${color} 0%, ${alpha(color, 0.8)} 100%)`,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
          {trend !== undefined && (
            <Chip
              size="small"
              icon={trend >= 0 ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
              label={`${Math.abs(trend).toFixed(1)}%`}
              sx={{
                bgcolor: trend >= 0 ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.error.main, 0.1),
                color: trend >= 0 ? 'success.main' : 'error.main',
                fontWeight: 'bold',
              }}
            />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontWeight: 500 }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700, color }}>
          {typeof value === 'number' ? formatCurrency(value) : value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

// Helper Functions
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

const getPriceTypeLabel = (priceType: string): { label: string; color: string } => {
  switch (priceType) {
    case 'sanAlas':
      return { label: '🍗 San Alas', color: '#ff9800' };
    case 'empleados':
      return { label: '👷 Empleado', color: '#9c27b0' };
    default:
      return { label: '🏪 Público', color: '#2196f3' };
  }
};

// Dashboard Component
const Dashboard: React.FC = () => {
  const theme = useTheme();

  // Helper para obtener fechas del día
  const getTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { startOfDay: start.toISOString(), endOfDay: end.toISOString() };
  };

  // Queries for real data
  const { data: accountingSummary, isLoading: loadingAccounting, refetch: refetchAccounting } = useQuery({
    queryKey: ['dashboard-accounting'],
    queryFn: async () => {
      const { startOfDay, endOfDay } = getTodayRange();
      return api.get<AccountingSummary>(`/accounting/summary?startDate=${encodeURIComponent(startOfDay)}&endDate=${encodeURIComponent(endOfDay)}`);
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: priceTypeData, isLoading: loadingPriceTypes } = useQuery({
    queryKey: ['dashboard-price-types'],
    queryFn: async () => {
      const { startOfDay, endOfDay } = getTodayRange();
      return api.get<PriceTypeComparison>(`/accounting/compare-price-types?startDate=${encodeURIComponent(startOfDay)}&endDate=${encodeURIComponent(endOfDay)}`);
    },
    refetchInterval: 30000,
  });

  const { data: expensesSummary, isLoading: loadingExpenses } = useQuery({
    queryKey: ['dashboard-expenses'],
    queryFn: async () => {
      return api.get<ExpensesSummary>('/expenses/stats/summary');
    },
    refetchInterval: 30000,
  });

  const { data: ordersSummary, isLoading: loadingOrders } = useQuery({
    queryKey: ['dashboard-orders'],
    queryFn: async () => {
      return api.get<OrdersSummary>('/orders/stats/summary');
    },
    refetchInterval: 30000,
  });

  const { data: lowStockProducts, isLoading: loadingLowStock } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => {
      return api.get<LowStockProduct[]>('/products?lowStock=true&limit=10');
    },
    refetchInterval: 60000,
  });

  const { data: recentSales, isLoading: loadingRecentSales } = useQuery({
    queryKey: ['dashboard-recent-sales'],
    queryFn: async () => {
      return api.get<RecentSale[]>('/sales?limit=8');
    },
    refetchInterval: 15000,
  });

  const handleRefresh = () => {
    refetchAccounting();
  };

  const isLoading = loadingAccounting || loadingPriceTypes || loadingExpenses;

  // Calculate totals
  const getExpenseByBusiness = (business: string) => {
    if (!expensesSummary?.byBusiness) return 0;
    const found = expensesSummary.byBusiness.find((b: { business: string; total: number }) => b.business === business);
    return found?.total || 0;
  };

  const totalExpenses = accountingSummary?.expenses?.total || 0;

  const netProfit = accountingSummary?.netProfit || 0;

  return (
    <Box sx={{ p: 3, bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Resumen de operaciones del día - {new Date().toLocaleDateString('es-CO', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </Typography>
        </Box>
        <Tooltip title="Actualizar datos">
          <IconButton onClick={handleRefresh} color="primary" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Main Stats Row */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ventas Hoy"
            value={accountingSummary?.income?.sales?.total || 0}
            icon={<AttachMoney />}
            color="#4caf50"
            subtitle={`${accountingSummary?.income?.sales?.count || 0} transacciones`}
            loading={loadingAccounting}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ganancia Bruta"
            value={accountingSummary?.income?.grossProfit || 0}
            icon={<TrendingUp />}
            color="#2196f3"
            subtitle={`Costo: ${formatCurrency(accountingSummary?.income?.sales?.cost || 0)}`}
            loading={loadingAccounting}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Egresos del Día"
            value={totalExpenses}
            icon={<TrendingDown />}
            color="#f44336"
            loading={loadingAccounting}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ganancia Neta"
            value={netProfit}
            icon={<AccountBalance />}
            color={netProfit >= 0 ? '#009688' : '#f44336'}
            loading={isLoading}
          />
        </Grid>
      </Grid>

      {/* Price Type Breakdown */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              📊 Ventas por Tipo de Cliente
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            {loadingPriceTypes ? (
              <Box>
                <Skeleton variant="rectangular" height={80} sx={{ mb: 2, borderRadius: 2 }} />
                <Skeleton variant="rectangular" height={80} sx={{ mb: 2, borderRadius: 2 }} />
                <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />
              </Box>
            ) : (
              <Grid container spacing={2}>
                {/* Público */}
                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha('#2196f3', 0.1),
                      border: `1px solid ${alpha('#2196f3', 0.3)}`,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Store sx={{ color: '#2196f3' }} />
                      <Typography fontWeight="bold">Público</Typography>
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="#2196f3">
                      {formatCurrency(priceTypeData?.publico?.sales || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {priceTypeData?.publico?.count || 0} ventas
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      Ganancia: {formatCurrency(priceTypeData?.publico?.profit || 0)}
                    </Typography>
                  </Box>
                </Grid>

                {/* San Alas */}
                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha('#ff9800', 0.1),
                      border: `1px solid ${alpha('#ff9800', 0.3)}`,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Typography fontSize={20}>🍗</Typography>
                      <Typography fontWeight="bold">San Alas</Typography>
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="#ff9800">
                      {formatCurrency(priceTypeData?.sanAlas?.sales || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {priceTypeData?.sanAlas?.count || 0} ventas
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      Ganancia: {formatCurrency(priceTypeData?.sanAlas?.profit || 0)}
                    </Typography>
                  </Box>
                </Grid>

                {/* Empleados */}
                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha('#9c27b0', 0.1),
                      border: `1px solid ${alpha('#9c27b0', 0.3)}`,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <People sx={{ color: '#9c27b0' }} />
                      <Typography fontWeight="bold">Empleados</Typography>
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="#9c27b0">
                      {formatCurrency(priceTypeData?.empleados?.sales || 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {priceTypeData?.empleados?.count || 0} ventas
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      Ganancia: {formatCurrency(priceTypeData?.empleados?.profit || 0)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Paper>
        </Grid>

        {/* Fiados Pendientes */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, borderRadius: 3, height: '100%' }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              📋 Fiados
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            {loadingOrders ? (
              <Box>
                <Skeleton variant="rectangular" height={60} sx={{ mb: 2, borderRadius: 2 }} />
                <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
              </Box>
            ) : (
              <>
                <Box
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: 2,
                    bgcolor: alpha('#ff9800', 0.1),
                    border: `1px solid ${alpha('#ff9800', 0.3)}`,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">Pendientes</Typography>
                  <Typography variant="h5" fontWeight="bold" color="#ff9800">
                    {formatCurrency(ordersSummary?.pending?.total || 0)}
                  </Typography>
                  <Chip 
                    size="small" 
                    label={`${ordersSummary?.pending?.count || 0} fiados`}
                    sx={{ mt: 1, bgcolor: alpha('#ff9800', 0.2) }}
                  />
                </Box>
                
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: alpha('#4caf50', 0.1),
                    border: `1px solid ${alpha('#4caf50', 0.3)}`,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">Cobrados</Typography>
                  <Typography variant="h5" fontWeight="bold" color="#4caf50">
                    {formatCurrency(ordersSummary?.paid?.total || 0)}
                  </Typography>
                  <Chip 
                    size="small" 
                    label={`${ordersSummary?.paid?.count || 0} cobrados`}
                    sx={{ mt: 1, bgcolor: alpha('#4caf50', 0.2) }}
                  />
                </Box>
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Bottom Row */}
      <Grid container spacing={3}>
        {/* Recent Sales */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              🧾 Ventas Recientes
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {loadingRecentSales ? (
              <Box>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={50} sx={{ mb: 1, borderRadius: 1 }} />
                ))}
              </Box>
            ) : (
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {Array.isArray(recentSales) && recentSales.length > 0 ? (
                  recentSales.map((sale: RecentSale, index: number) => {
                    const priceInfo = getPriceTypeLabel(sale.priceType);
                    return (
                      <Box
                        key={sale.id}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: index % 2 === 0 ? 'transparent' : alpha(theme.palette.primary.main, 0.03),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                          },
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar sx={{ bgcolor: priceInfo.color, width: 36, height: 36 }}>
                            <Receipt fontSize="small" />
                          </Avatar>
                          <Box>
                            <Typography fontWeight="600" fontSize={14}>
                              {sale.invoiceNumber || `Venta #${sale.saleNumber || sale.id}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatTime(sale.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                        <Box textAlign="right">
                          <Typography fontWeight="bold" color="primary.main">
                            {formatCurrency(sale.total)}
                          </Typography>
                          <Chip 
                            size="small" 
                            label={priceInfo.label}
                            sx={{ 
                              fontSize: 10, 
                              height: 20,
                              bgcolor: alpha(priceInfo.color, 0.1),
                              color: priceInfo.color,
                            }}
                          />
                        </Box>
                      </Box>
                    );
                  })
                ) : (
                  <Box textAlign="center" py={4}>
                    <Receipt sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography color="text.secondary">No hay ventas hoy</Typography>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Low Stock Alert */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <Warning color="warning" />
              <Typography variant="h6" fontWeight="bold">
                Stock Bajo
              </Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            
            {loadingLowStock ? (
              <Box>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={50} sx={{ mb: 1, borderRadius: 1 }} />
                ))}
              </Box>
            ) : (
              <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                {Array.isArray(lowStockProducts) && lowStockProducts.length > 0 ? (
                  lowStockProducts.map((product: LowStockProduct) => {
                    const currentStock = product.stock || Number(product.baseStock) || 0;
                    const stockPercentage = (currentStock / (product.minStock * 2)) * 100;
                    const isVeryLow = currentStock <= product.minStock / 2;
                    
                    return (
                      <Box
                        key={product.id}
                        sx={{
                          p: 1.5,
                          mb: 1,
                          borderRadius: 2,
                          bgcolor: isVeryLow ? alpha('#f44336', 0.1) : alpha('#ff9800', 0.1),
                          border: `1px solid ${isVeryLow ? alpha('#f44336', 0.3) : alpha('#ff9800', 0.3)}`,
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography fontWeight="600" fontSize={14} noWrap sx={{ maxWidth: '60%' }}>
                            {product.name}
                          </Typography>
                          <Chip
                            size="small"
                            label={`${currentStock} uds`}
                            color={isVeryLow ? 'error' : 'warning'}
                            sx={{ fontWeight: 'bold' }}
                          />
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(stockPercentage, 100)}
                          color={isVeryLow ? 'error' : 'warning'}
                          sx={{ 
                            height: 6, 
                            borderRadius: 3,
                            bgcolor: alpha(isVeryLow ? '#f44336' : '#ff9800', 0.2),
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Mínimo requerido: {product.minStock}
                        </Typography>
                      </Box>
                    );
                  })
                ) : (
                  <Box textAlign="center" py={4}>
                    <Inventory sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography color="text.secondary">Todo el inventario está bien</Typography>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Expenses Breakdown */}
      <Grid container spacing={3} mt={1}>
        <Grid item xs={12}>
          <Paper sx={{ p: 3, borderRadius: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              💸 Resumen de Egresos del Día
            </Typography>
            <Divider sx={{ mb: 3 }} />
            
            {loadingExpenses ? (
              <Grid container spacing={2}>
                {[...Array(3)].map((_, i) => (
                  <Grid item xs={12} md={4} key={i}>
                    <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2 }} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha('#1976d2', 0.1),
                      border: `1px solid ${alpha('#1976d2', 0.3)}`,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <LocalShipping sx={{ color: '#1976d2' }} />
                      <Typography fontWeight="bold">Distribuidora</Typography>
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="#1976d2">
                      {formatCurrency(getExpenseByBusiness('distribuidora'))}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha('#ff9800', 0.1),
                      border: `1px solid ${alpha('#ff9800', 0.3)}`,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Typography fontSize={20}>🍗</Typography>
                      <Typography fontWeight="bold">San Alas</Typography>
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="#ff9800">
                      {formatCurrency(getExpenseByBusiness('sanAlas'))}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} md={4}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha('#9c27b0', 0.1),
                      border: `1px solid ${alpha('#9c27b0', 0.3)}`,
                    }}
                  >
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <People sx={{ color: '#9c27b0' }} />
                      <Typography fontWeight="bold">Empleados</Typography>
                    </Box>
                    <Typography variant="h5" fontWeight="bold" color="#9c27b0">
                      {formatCurrency(getExpenseByBusiness('empleados'))}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
