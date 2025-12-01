import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  InputAdornment,
  Alert,
  Divider,
  Avatar,
  LinearProgress,
  Fade,
  Collapse,
  Badge,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AttachMoney as MoneyIcon,
  AccountBalance as AccountBalanceIcon,
  Store as StoreIcon,
  Restaurant as RestaurantIcon,
  Person as PersonIcon,
  CreditCard as CreditCardIcon,
  Handshake as HandshakeIcon,
  Receipt as ReceiptIcon,
  CalendarMonth as CalendarIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  Payment as PaymentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { es } from 'date-fns/locale/es';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface Expense {
  id: string;
  date: string;
  business: string;
  category: string;
  subcategory?: string;
  supplierName?: string;
  description?: string;
  amount: string;
  paymentMethod?: string;
  invoiceNumber?: string;
  isRecurring: boolean;
  notes?: string;
}

interface Loan {
  id: string;
  loanNumber: number;
  type: string;
  employeeId?: string;
  borrowerName: string;
  borrowerPhone?: string;
  borrowerDocument?: string;
  business: string;
  amount: string;
  interestRate: string;
  totalAmount: string;
  paidAmount: string;
  balance: string;
  disbursementDate: string;
  dueDate?: string;
  status: string;
  notes?: string;
  payments: LoanPayment[];
  employee?: { name: string };
}

interface LoanPayment {
  id: string;
  amount: string;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
}

interface ExpenseStats {
  thisMonth: { total: number; count: number };
  lastMonth: { total: number };
  change: number;
  year: { total: number; count: number };
  byCategory: { category: string; total: number; count: number }[];
  byBusiness?: { business: string; total: number }[];
}

interface LoanStats {
  active: { count: number; totalLent: number; pendingBalance: number };
  paid: { count: number; totalRecovered: number };
  overdue: { count: number };
  byType: { type: string; count: number; balance: number }[];
}

const BUSINESS_CONFIG = {
  distribuidora: {
    name: 'Distribuidora',
    icon: StoreIcon,
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
  },
  sanAlas: {
    name: 'San Alas',
    icon: RestaurantIcon,
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  },
  empleados: {
    name: 'Empleados',
    icon: PersonIcon,
    color: '#F59E0B',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
  },
};

const PAYMENT_METHODS = [
  { id: 'efectivo', name: 'Efectivo', icon: '💵' },
  { id: 'transferencia', name: 'Transferencia', icon: '🏦' },
  { id: 'credito', name: 'Crédito', icon: '💳' },
];

export default function Expenses() {
  const theme = useTheme();
  const { isAdmin } = useAuth();
  const [mainTab, setMainTab] = useState(0); // 0: Gastos, 1: Préstamos
  const [businessTab, setBusinessTab] = useState(0); // 0: Distribuidora, 1: San Alas

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<{ distribuidora: Category[]; sanAlas: Category[]; empleados: Category[] }>({
    distribuidora: [],
    sanAlas: [],
    empleados: [],
  });
  const [expenseStats, setExpenseStats] = useState<ExpenseStats | null>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Loans state
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanStats, setLoanStats] = useState<LoanStats | null>(null);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  // Category management
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date | null>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date | null>(endOfMonth(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [loanTypeFilter, setLoanTypeFilter] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentBusiness = businessTab === 0 ? 'distribuidora' : businessTab === 1 ? 'sanAlas' : 'empleados';
  const businessConfig = BUSINESS_CONFIG[currentBusiness as keyof typeof BUSINESS_CONFIG];

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get<{ distribuidora: Category[]; sanAlas: Category[]; empleados: Category[] }>('/expenses/categories');
      setCategories(res);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  // Fetch expenses
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('business', currentBusiness);
      params.set('limit', '100');
      if (dateFrom) params.set('startDate', format(dateFrom, 'yyyy-MM-dd'));
      if (dateTo) params.set('endDate', format(dateTo, 'yyyy-MM-dd'));
      if (searchQuery) params.set('q', searchQuery);
      if (filterCategory) params.set('category', filterCategory);

      const res = await api.get<Expense[]>(`/expenses?${params.toString()}`);
      setExpenses(res);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setError('Error al cargar gastos');
    } finally {
      setLoading(false);
    }
  }, [currentBusiness, dateFrom, dateTo, searchQuery, filterCategory]);

  // Fetch expense stats
  const fetchExpenseStats = useCallback(async () => {
    try {
      const res = await api.get<ExpenseStats>(`/expenses/stats/summary?business=${currentBusiness}`);
      setExpenseStats(res);
    } catch (err) {
      console.error('Error fetching expense stats:', err);
    }
  }, [currentBusiness]);

  // Fetch loans
  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('business', currentBusiness);
      params.set('limit', '100');
      if (loanTypeFilter) params.set('type', loanTypeFilter);
      if (loanStatusFilter) params.set('status', loanStatusFilter);

      const res = await api.get<Loan[]>(`/loans?${params.toString()}`);
      setLoans(res);
    } catch (err) {
      console.error('Error fetching loans:', err);
      setError('Error al cargar préstamos');
    } finally {
      setLoading(false);
    }
  }, [currentBusiness, loanTypeFilter, loanStatusFilter]);

  // Fetch loan stats
  const fetchLoanStats = useCallback(async () => {
    try {
      const res = await api.get<LoanStats>(`/loans/stats/summary?business=${currentBusiness}`);
      setLoanStats(res);
    } catch (err) {
      console.error('Error fetching loan stats:', err);
    }
  }, [currentBusiness]);

  // Effects
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (mainTab === 0) {
      fetchExpenses();
      fetchExpenseStats();
    } else {
      fetchLoans();
      fetchLoanStats();
    }
  }, [mainTab, businessTab, fetchExpenses, fetchExpenseStats, fetchLoans, fetchLoanStats]);

  // Expense handlers
  const handleSaveExpense = async (data: any) => {
    try {
      if (editingExpense) {
        await api.patch(`/expenses/${editingExpense.id}`, data);
      } else {
        await api.post('/expenses', data);
      }
      setExpenseDialogOpen(false);
      setEditingExpense(null);
      fetchExpenses();
      fetchExpenseStats();
    } catch (err: any) {
      setError(err.message || 'Error al guardar gasto');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchExpenses();
      fetchExpenseStats();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar gasto');
    }
  };

  // Loan handlers
  const handleSaveLoan = async (data: any) => {
    try {
      if (editingLoan) {
        // For now, loans can't be edited
      } else {
        await api.post('/loans', data);
      }
      setLoanDialogOpen(false);
      setEditingLoan(null);
      fetchLoans();
      fetchLoanStats();
    } catch (err: any) {
      setError(err.message || 'Error al guardar préstamo');
    }
  };

  const handlePayment = async (loanId: string, data: any) => {
    try {
      await api.post(`/loans/${loanId}/payments`, data);
      setPaymentDialogOpen(false);
      setSelectedLoan(null);
      fetchLoans();
      fetchLoanStats();
    } catch (err: any) {
      setError(err.message || 'Error al registrar pago');
    }
  };

  const handleCancelLoan = async (loanId: string) => {
    if (!confirm('¿Está seguro de cancelar/condonar este préstamo?')) return;
    try {
      await api.patch(`/loans/${loanId}/cancel`, { reason: 'Cancelado manualmente' });
      fetchLoans();
      fetchLoanStats();
    } catch (err: any) {
      setError(err.message || 'Error al cancelar préstamo');
    }
  };

  // Category handlers
  const handleSaveCategory = async (data: any) => {
    try {
      if (editingCategory) {
        await api.patch(`/expenses/categories/${editingCategory.id}`, { ...data, business: currentBusiness });
      } else {
        await api.post('/expenses/categories', { ...data, business: currentBusiness });
      }
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Error al guardar categoría');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    try {
      await api.delete(`/expenses/categories/${id}`);
      fetchCategories();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar categoría');
    }
  };

  const getCategoryInfo = (categoryId: string): Category => {
    const cats = categories[currentBusiness as keyof typeof categories] || [];
    return cats.find((c) => c.id === categoryId) || { id: categoryId, name: categoryId, icon: 'help', color: '#6B7280' };
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
  };

  const getPaymentMethodLabel = (method?: string) => {
    const pm = PAYMENT_METHODS.find((p) => p.id === method);
    return pm ? `${pm.icon} ${pm.name}` : method || '-';
  };

  const getLoanStatusChip = (status: string) => {
    const statusConfig: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default'; icon: React.ReactNode }> = {
      ACTIVE: { label: 'Activo', color: 'warning', icon: <MoneyIcon fontSize="small" /> },
      PAID: { label: 'Pagado', color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
      DEFAULTED: { label: 'En Mora', color: 'error', icon: <WarningIcon fontSize="small" /> },
      CANCELLED: { label: 'Cancelado', color: 'default', icon: <CancelIcon fontSize="small" /> },
    };
    const config = statusConfig[status] || { label: status, color: 'default', icon: null };
    return <Chip size="small" label={config.label} color={config.color} icon={config.icon as any} />;
  };

  // Stats Cards Component
  const StatsCards = () => {
    if (mainTab === 0 && expenseStats) {
      return (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: businessConfig.gradient, color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>Este Mes</Typography>
                    <Typography variant="h5" fontWeight="bold">{formatCurrency(expenseStats.thisMonth.total)}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>{expenseStats.thisMonth.count} gastos</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                    <ReceiptIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Mes Anterior</Typography>
                    <Typography variant="h5" fontWeight="bold">{formatCurrency(expenseStats.lastMonth.total)}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {expenseStats.change > 0 ? (
                        <TrendingUpIcon color="error" fontSize="small" />
                      ) : (
                        <TrendingDownIcon color="success" fontSize="small" />
                      )}
                      <Typography variant="caption" color={expenseStats.change > 0 ? 'error' : 'success'}>
                        {Math.abs(expenseStats.change).toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
                    <CalendarIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Total Año</Typography>
                    <Typography variant="h5" fontWeight="bold">{formatCurrency(expenseStats.year.total)}</Typography>
                    <Typography variant="caption" color="text.secondary">{expenseStats.year.count} gastos</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: 'warning.main' }}>
                    <AccountBalanceIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>Top Categorías</Typography>
                {expenseStats.byCategory.slice(0, 3).map((cat) => {
                  const catInfo = getCategoryInfo(cat.category);
                  return (
                    <Box key={cat.category} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Chip
                        size="small"
                        label={catInfo.name}
                        sx={{ bgcolor: alpha(catInfo.color, 0.1), color: catInfo.color, fontSize: '0.7rem' }}
                      />
                      <Typography variant="caption" fontWeight="bold">{formatCurrency(cat.total)}</Typography>
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      );
    }

    if (mainTab === 1 && loanStats) {
      return (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>Préstamos Activos</Typography>
                    <Typography variant="h5" fontWeight="bold">{loanStats.active.count}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>
                      Saldo: {formatCurrency(loanStats.active.pendingBalance)}
                    </Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)' }}>
                    <HandshakeIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Total Prestado</Typography>
                    <Typography variant="h5" fontWeight="bold">{formatCurrency(loanStats.active.totalLent)}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: 'info.main' }}>
                    <MoneyIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Recuperado</Typography>
                    <Typography variant="h5" fontWeight="bold" color="success.main">
                      {formatCurrency(loanStats.paid.totalRecovered)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{loanStats.paid.count} pagados</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main' }}>
                    <CheckCircleIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ borderLeft: loanStats.overdue.count > 0 ? '4px solid' : 'none', borderColor: 'error.main' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">En Mora</Typography>
                    <Typography variant="h5" fontWeight="bold" color={loanStats.overdue.count > 0 ? 'error' : 'text.primary'}>
                      {loanStats.overdue.count}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">préstamos vencidos</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: loanStats.overdue.count > 0 ? alpha(theme.palette.error.main, 0.1) : 'grey.100', color: loanStats.overdue.count > 0 ? 'error.main' : 'text.secondary' }}>
                    <WarningIcon />
                  </Avatar>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      );
    }

    return null;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box sx={{ p: 2, height: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
          <Box>
            <Typography variant="h5" fontWeight="bold">Finanzas</Typography>
            <Typography variant="body2" color="text.secondary">
              Gestión de gastos y préstamos
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={() => { fetchExpenses(); fetchExpenseStats(); fetchLoans(); fetchLoanStats(); }}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 1, flexShrink: 0 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Business Tabs */}
        <Paper sx={{ mb: 2, flexShrink: 0 }}>
          <Tabs
            value={businessTab}
            onChange={(_, v) => setBusinessTab(v)}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': { py: 2 },
              '& .Mui-selected': { fontWeight: 'bold' },
            }}
          >
            <Tab
              icon={<StoreIcon />}
              label="Distribuidora"
              iconPosition="start"
              sx={{ color: businessTab === 0 ? BUSINESS_CONFIG.distribuidora.color : 'inherit' }}
            />
            <Tab
              icon={<RestaurantIcon />}
              label="San Alas"
              iconPosition="start"
              sx={{ color: businessTab === 1 ? BUSINESS_CONFIG.sanAlas.color : 'inherit' }}
            />
            <Tab
              icon={<PersonIcon />}
              label="Empleados"
              iconPosition="start"
              sx={{ color: businessTab === 2 ? BUSINESS_CONFIG.empleados.color : 'inherit' }}
            />
          </Tabs>
        </Paper>

        {/* Main Tabs */}
        <Paper sx={{ mb: 2, flexShrink: 0 }}>
          <Tabs
            value={mainTab}
            onChange={(_, v) => setMainTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab
              icon={<Badge badgeContent={expenses.length} color="primary"><ReceiptIcon /></Badge>}
              label="Gastos"
              iconPosition="start"
            />
            <Tab
              icon={<Badge badgeContent={loans.filter(l => l.status === 'ACTIVE').length} color="warning"><HandshakeIcon /></Badge>}
              label="Préstamos"
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {loading && <LinearProgress sx={{ mb: 1, flexShrink: 0 }} />}

        {/* Stats Cards */}
        <Box sx={{ flexShrink: 0 }}>
          <StatsCards />
        </Box>

        {/* Tab Content - Scrollable Area */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Expenses Tab */}
        <TabPanel value={mainTab} index={0}>
          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <DatePicker
                  label="Desde"
                  value={dateFrom}
                  onChange={(d) => setDateFrom(d)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <DatePicker
                  label="Hasta"
                  value={dateTo}
                  onChange={(d) => setDateTo(d)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Categoría</InputLabel>
                    <Select
                      value={filterCategory}
                      label="Categoría"
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <MenuItem value="">Todas</MenuItem>
                      {(categories[currentBusiness as keyof typeof categories] || []).map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {isAdmin && (
                    <Tooltip title="Gestionar Categorías">
                      <IconButton
                        color="primary"
                        onClick={() => { setEditingCategory(null); setCategoryDialogOpen(true); }}
                        sx={{ border: '1px solid', borderColor: 'primary.main' }}
                      >
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => { setEditingExpense(null); setExpenseDialogOpen(true); }}
                  sx={{ background: businessConfig.gradient }}
                >
                  Nuevo Gasto
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Expenses Table */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'grey.50' }}>
                  <TableCell>Fecha</TableCell>
                  <TableCell>Categoría</TableCell>
                  <TableCell>Descripción</TableCell>
                  <TableCell>Proveedor</TableCell>
                  <TableCell>Método Pago</TableCell>
                  <TableCell align="right">Monto</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                      <ReceiptIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                      <Typography color="text.secondary">No hay gastos registrados</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  expenses.map((expense) => {
                    const catInfo = getCategoryInfo(expense.category);
                    return (
                      <TableRow key={expense.id} hover>
                        <TableCell>
                          <Typography variant="body2">{format(new Date(expense.date), 'dd/MM/yyyy')}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={catInfo.name}
                            sx={{
                              bgcolor: alpha(catInfo.color, 0.1),
                              color: catInfo.color,
                              fontWeight: 500,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{expense.description || '-'}</Typography>
                          {expense.invoiceNumber && (
                            <Typography variant="caption" color="text.secondary">
                              Factura: {expense.invoiceNumber}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{expense.supplierName || '-'}</TableCell>
                        <TableCell>{getPaymentMethodLabel(expense.paymentMethod)}</TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="error">
                            {formatCurrency(expense.amount)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {isAdmin && (
                            <>
                              <Tooltip title="Editar">
                                <IconButton size="small" onClick={() => { setEditingExpense(expense); setExpenseDialogOpen(true); }}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton size="small" color="error" onClick={() => handleDeleteExpense(expense.id)}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Loans Tab */}
        <TabPanel value={mainTab} index={1}>
          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo</InputLabel>
                  <Select
                    value={loanTypeFilter}
                    label="Tipo"
                    onChange={(e) => setLoanTypeFilter(e.target.value)}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="employee">Empleado</MenuItem>
                    <MenuItem value="third_party">Tercero</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Estado</InputLabel>
                  <Select
                    value={loanStatusFilter}
                    label="Estado"
                    onChange={(e) => setLoanStatusFilter(e.target.value)}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="ACTIVE">Activo</MenuItem>
                    <MenuItem value="PAID">Pagado</MenuItem>
                    <MenuItem value="DEFAULTED">En Mora</MenuItem>
                    <MenuItem value="CANCELLED">Cancelado</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {isAdmin && (
                <Grid item xs={12} sm={4} md={3}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => { setEditingLoan(null); setLoanDialogOpen(true); }}
                    sx={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
                  >
                    Nuevo Préstamo
                  </Button>
                </Grid>
              )}
            </Grid>
          </Paper>

          {/* Loans List */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {loans.length === 0 ? (
              <Paper sx={{ p: 5, textAlign: 'center' }}>
                <HandshakeIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                <Typography color="text.secondary">No hay préstamos registrados</Typography>
              </Paper>
            ) : (
              loans.map((loan) => (
                <Paper key={loan.id} sx={{ overflow: 'hidden' }}>
                  <Box
                    sx={{
                      p: 2,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'grey.50' },
                    }}
                    onClick={() => setExpandedLoan(expandedLoan === loan.id ? null : loan.id)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: loan.type === 'employee' ? 'primary.main' : 'secondary.main' }}>
                        {loan.type === 'employee' ? <PersonIcon /> : <HandshakeIcon />}
                      </Avatar>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography fontWeight="bold">{loan.borrowerName}</Typography>
                          {getLoanStatusChip(loan.status)}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          #{loan.loanNumber} • {loan.type === 'employee' ? 'Empleado' : 'Tercero'} •{' '}
                          {format(new Date(loan.disbursementDate), 'dd/MM/yyyy')}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" color="text.secondary">Monto</Typography>
                        <Typography fontWeight="bold">{formatCurrency(loan.amount)}</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="body2" color="text.secondary">Saldo</Typography>
                        <Typography fontWeight="bold" color={parseFloat(loan.balance) > 0 ? 'warning.main' : 'success.main'}>
                          {formatCurrency(loan.balance)}
                        </Typography>
                      </Box>
                      <Box sx={{ width: 100 }}>
                        <LinearProgress
                          variant="determinate"
                          value={(parseFloat(loan.paidAmount) / parseFloat(loan.totalAmount)) * 100}
                          sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: 'grey.200',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: loan.status === 'PAID' ? 'success.main' : 'warning.main',
                            },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                          {((parseFloat(loan.paidAmount) / parseFloat(loan.totalAmount)) * 100).toFixed(0)}%
                        </Typography>
                      </Box>
                      {expandedLoan === loan.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </Box>
                  </Box>
                  <Collapse in={expandedLoan === loan.id}>
                    <Divider />
                    <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Detalles</Typography>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            {loan.borrowerPhone && (
                              <Typography variant="body2">📞 {loan.borrowerPhone}</Typography>
                            )}
                            {loan.borrowerDocument && (
                              <Typography variant="body2">🪪 {loan.borrowerDocument}</Typography>
                            )}
                            {loan.dueDate && (
                              <Typography variant="body2">📅 Vence: {format(new Date(loan.dueDate), 'dd/MM/yyyy')}</Typography>
                            )}
                            {parseFloat(loan.interestRate) > 0 && (
                              <Typography variant="body2">💰 Interés: {loan.interestRate}%</Typography>
                            )}
                            {loan.notes && (
                              <Typography variant="body2" color="text.secondary">📝 {loan.notes}</Typography>
                            )}
                          </Box>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Pagos ({loan.payments.length})</Typography>
                          {loan.payments.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">Sin pagos registrados</Typography>
                          ) : (
                            <Box sx={{ maxHeight: 150, overflowY: 'auto' }}>
                              {loan.payments.map((payment) => (
                                <Box key={payment.id} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                  <Typography variant="body2">
                                    {format(new Date(payment.createdAt), 'dd/MM/yyyy')} - {getPaymentMethodLabel(payment.paymentMethod)}
                                  </Typography>
                                  <Typography variant="body2" fontWeight="bold" color="success.main">
                                    +{formatCurrency(payment.amount)}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          )}
                        </Grid>
                      </Grid>
                      {loan.status === 'ACTIVE' && isAdmin && (
                        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                          <Button
                            variant="contained"
                            color="success"
                            startIcon={<PaymentIcon />}
                            onClick={(e) => { e.stopPropagation(); setSelectedLoan(loan); setPaymentDialogOpen(true); }}
                          >
                            Registrar Pago
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            startIcon={<CancelIcon />}
                            onClick={(e) => { e.stopPropagation(); handleCancelLoan(loan.id); }}
                          >
                            Cancelar/Condonar
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Paper>
              ))
            )}
          </Box>
        </TabPanel>

        {/* Expense Dialog */}
        <ExpenseDialog
          open={expenseDialogOpen}
          onClose={() => { setExpenseDialogOpen(false); setEditingExpense(null); }}
          onSave={handleSaveExpense}
          expense={editingExpense}
          business={currentBusiness}
          categories={categories[currentBusiness as keyof typeof categories] || []}
        />

        {/* Loan Dialog */}
        <LoanDialog
          open={loanDialogOpen}
          onClose={() => { setLoanDialogOpen(false); setEditingLoan(null); }}
          onSave={handleSaveLoan}
          business={currentBusiness}
        />

        {/* Payment Dialog */}
        <PaymentDialog
          open={paymentDialogOpen}
          onClose={() => { setPaymentDialogOpen(false); setSelectedLoan(null); }}
          onSave={(data) => selectedLoan && handlePayment(selectedLoan.id, data)}
          loan={selectedLoan}
        />

        </Box>

        {/* Category Dialog */}
        <CategoryDialog
          open={categoryDialogOpen}
          onClose={() => { setCategoryDialogOpen(false); setEditingCategory(null); }}
          onSave={handleSaveCategory}
          onDelete={handleDeleteCategory}
          onEdit={(cat) => setEditingCategory(cat)}
          category={editingCategory}
          categories={categories[currentBusiness as keyof typeof categories] || []}
          businessName={businessConfig.name}
        />
      </Box>
    </LocalizationProvider>
  );
}

// Expense Dialog Component
function ExpenseDialog({
  open,
  onClose,
  onSave,
  expense,
  business,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  expense: Expense | null;
  business: string;
  categories: Category[];
}) {
  // Función para formatear número con separador de miles
  const formatAmount = (value: string): string => {
    const num = value.replace(/\D/g, '');
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Función para parsear el número formateado a número real
  const parseAmount = (value: string): string => {
    return value.replace(/\./g, '');
  };

  const [formData, setFormData] = useState({
    date: new Date(),
    category: '',
    subcategory: '',
    supplierName: '',
    description: '',
    amount: '',
    paymentMethod: 'efectivo',
    invoiceNumber: '',
    isRecurring: false,
    notes: '',
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        date: new Date(expense.date),
        category: expense.category,
        subcategory: expense.subcategory || '',
        supplierName: expense.supplierName || '',
        description: expense.description || '',
        amount: formatAmount(expense.amount),
        paymentMethod: expense.paymentMethod || 'efectivo',
        invoiceNumber: expense.invoiceNumber || '',
        isRecurring: expense.isRecurring,
        notes: expense.notes || '',
      });
    } else {
      setFormData({
        date: new Date(),
        category: '',
        subcategory: '',
        supplierName: '',
        description: '',
        amount: '',
        paymentMethod: 'efectivo',
        invoiceNumber: '',
        isRecurring: false,
        notes: '',
      });
    }
  }, [expense, open]);

  const handleSubmit = () => {
    onSave({
      ...formData,
      amount: parseAmount(formData.amount), // Enviar sin formato
      date: format(formData.date, 'yyyy-MM-dd'),
      business,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {expense ? 'Editar Gasto' : 'Nuevo Gasto'}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Fecha"
                value={formData.date}
                onChange={(d) => setFormData({ ...formData, date: d || new Date() })}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Categoría *</InputLabel>
                <Select
                  value={formData.category}
                  label="Categoría *"
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: cat.color }} />
                        {cat.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Descripción"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Proveedor/Beneficiario"
                value={formData.supplierName}
                onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Monto *"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: formatAmount(e.target.value) })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                placeholder="0"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Método de Pago</InputLabel>
                <Select
                  value={formData.paymentMethod}
                  label="Método de Pago"
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <MenuItem key={pm.id} value={pm.id}>{pm.icon} {pm.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Notas"
                multiline
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </LocalizationProvider>
        
        {!expense && (
          <Alert severity="info" sx={{ mt: 2 }}>
            El número de factura se generará automáticamente al guardar.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!formData.category || !formData.amount}
        >
          {expense ? 'Guardar Cambios' : 'Registrar Gasto'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Loan Dialog Component
function LoanDialog({
  open,
  onClose,
  onSave,
  business,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  business: string;
}) {
  const [formData, setFormData] = useState({
    type: 'third_party',
    borrowerName: '',
    borrowerPhone: '',
    borrowerDocument: '',
    amount: '',
    interestRate: '0',
    disbursementDate: new Date(),
    dueDate: null as Date | null,
    notes: '',
  });

  useEffect(() => {
    if (open) {
      setFormData({
        type: 'third_party',
        borrowerName: '',
        borrowerPhone: '',
        borrowerDocument: '',
        amount: '',
        interestRate: '0',
        disbursementDate: new Date(),
        dueDate: null,
        notes: '',
      });
    }
  }, [open]);

  const handleSubmit = () => {
    onSave({
      ...formData,
      business,
      disbursementDate: format(formData.disbursementDate, 'yyyy-MM-dd'),
      dueDate: formData.dueDate ? format(formData.dueDate, 'yyyy-MM-dd') : undefined,
    });
  };

  const totalAmount = parseFloat(formData.amount || '0') * (1 + parseFloat(formData.interestRate || '0') / 100);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Nuevo Préstamo
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de Préstamo</InputLabel>
                <Select
                  value={formData.type}
                  label="Tipo de Préstamo"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <MenuItem value="employee">👤 Empleado</MenuItem>
                  <MenuItem value="third_party">🤝 Tercero</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Nombre del Prestatario *"
                value={formData.borrowerName}
                onChange={(e) => setFormData({ ...formData, borrowerName: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Teléfono"
                value={formData.borrowerPhone}
                onChange={(e) => setFormData({ ...formData, borrowerPhone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Cédula/Documento"
                value={formData.borrowerDocument}
                onChange={(e) => setFormData({ ...formData, borrowerDocument: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Monto *"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Tasa de Interés (%)"
                type="number"
                value={formData.interestRate}
                onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
              />
            </Grid>
            {formData.amount && parseFloat(formData.interestRate) > 0 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  Total a pagar con interés: <strong>${totalAmount.toLocaleString()}</strong>
                </Alert>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Fecha Desembolso"
                value={formData.disbursementDate}
                onChange={(d) => setFormData({ ...formData, disbursementDate: d || new Date() })}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Fecha Vencimiento"
                value={formData.dueDate}
                onChange={(d) => setFormData({ ...formData, dueDate: d })}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Notas"
                multiline
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          color="warning"
          onClick={handleSubmit}
          disabled={!formData.borrowerName || !formData.amount}
        >
          Crear Préstamo
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Payment Dialog Component
function PaymentDialog({
  open,
  onClose,
  onSave,
  loan,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  loan: Loan | null;
}) {
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'efectivo',
    notes: '',
  });

  useEffect(() => {
    if (open && loan) {
      setFormData({
        amount: loan.balance,
        paymentMethod: 'efectivo',
        notes: '',
      });
    }
  }, [open, loan]);

  const handleSubmit = () => {
    onSave(formData);
  };

  if (!loan) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Registrar Pago
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">Prestatario</Typography>
          <Typography fontWeight="bold">{loan.borrowerName}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Saldo Pendiente</Typography>
          <Typography variant="h6" fontWeight="bold" color="warning.main">
            ${parseFloat(loan.balance).toLocaleString()}
          </Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Monto del Pago *"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              required
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth size="small">
              <InputLabel>Método de Pago</InputLabel>
              <Select
                value={formData.paymentMethod}
                label="Método de Pago"
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              >
                {PAYMENT_METHODS.map((pm) => (
                  <MenuItem key={pm.id} value={pm.id}>{pm.icon} {pm.name}</MenuItem>
                ))}
                <MenuItem value="descuento_nomina">📋 Descuento Nómina</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Notas"
              multiline
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          color="success"
          onClick={handleSubmit}
          disabled={!formData.amount || parseFloat(formData.amount) <= 0}
        >
          Registrar Pago
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Category Management Dialog
const CATEGORY_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', 
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#6B7280', '#78716C', '#71717A'
];

function CategoryDialog({
  open,
  onClose,
  onSave,
  onDelete,
  onEdit,
  category,
  categories,
  businessName,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
  onEdit: (cat: Category) => void;
  category: Category | null;
  categories: Category[];
  businessName: string;
}) {
  const [formData, setFormData] = useState({
    name: '',
    color: '#3B82F6',
    icon: 'receipt',
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        color: category.color,
        icon: category.icon || 'receipt',
      });
      setShowForm(true);
    } else {
      setFormData({ name: '', color: '#3B82F6', icon: 'receipt' });
      setShowForm(false);
    }
  }, [category, open]);

  const handleSubmit = () => {
    onSave(formData);
    setShowForm(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CategoryIcon color="primary" />
        Categorías de Gastos - {businessName}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {!showForm ? (
          <>
            {/* Lista de categorías existentes */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Categorías existentes ({categories.length})
              </Typography>
              {categories.length === 0 ? (
                <Alert severity="info">No hay categorías creadas</Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {categories.map((cat) => (
                    <Paper
                      key={cat.id}
                      sx={{
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: '1px solid',
                        borderColor: 'grey.200',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            bgcolor: cat.color,
                          }}
                        />
                        <Typography fontWeight="medium">{cat.name}</Typography>
                      </Box>
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => onEdit(cat)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => onDelete(cat.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setFormData({ name: '', color: '#3B82F6', icon: 'receipt' });
                setShowForm(true);
              }}
            >
              Nueva Categoría
            </Button>
          </>
        ) : (
          <>
            {/* Formulario de categoría */}
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Nombre de la Categoría *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoFocus
                />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Color
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {CATEGORY_COLORS.map((color) => (
                    <Box
                      key={color}
                      onClick={() => setFormData({ ...formData, color })}
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        bgcolor: color,
                        cursor: 'pointer',
                        border: formData.color === color ? '3px solid black' : '2px solid transparent',
                        transition: 'transform 0.2s',
                        '&:hover': {
                          transform: 'scale(1.1)',
                        },
                      }}
                    />
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">Vista previa:</Typography>
                  <Chip
                    label={formData.name || 'Nueva Categoría'}
                    sx={{
                      bgcolor: `${formData.color}20`,
                      color: formData.color,
                      fontWeight: 500,
                    }}
                  />
                </Box>
              </Grid>
            </Grid>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {showForm ? (
          <>
            <Button onClick={() => { setShowForm(false); onClose(); }}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!formData.name.trim()}
            >
              {category ? 'Guardar Cambios' : 'Crear Categoría'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Cerrar</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
