import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  Search as SearchIcon,
  Payment as PaymentIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Phone as PhoneIcon,
  Person as PersonIcon,
  Receipt as ReceiptIcon,
  AttachMoney as MoneyIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  Event as EventIcon,
} from '@mui/icons-material';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  presentationName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone?: string;
  total: number;
  priceType: string;
  status: 'PENDING' | 'PAID' | 'CANCELLED' | 'RETURNED';
  notes?: string;
  dueDate?: string;
  createdAt: string;
  paidAt?: string;
  paymentMethod?: string;
  items: OrderItem[];
}

interface Stats {
  pending: { count: number; total: number };
  paid: { count: number; total: number };
  cancelled: { count: number };
  returned: { count: number; total: number };
  totalPending: number;
}

const formatNumber = (num: number): string => {
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function Fiados() {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  
  // Dialogs
  const [detailDialog, setDetailDialog] = useState<Order | null>(null);
  const [payDialog, setPayDialog] = useState<Order | null>(null);
  const [cancelDialog, setCancelDialog] = useState<Order | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('efectivo');
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  // Fiados que vencen hoy
  const dueTodayOrders = orders.filter(order => {
    if (order.status !== 'PENDING' || !order.dueDate) return false;
    const today = new Date().toISOString().split('T')[0];
    const dueDay = order.dueDate.split('T')[0];
    return dueDay === today;
  });

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (search) params.append('search', search);
      
      const queryString = params.toString();
      const url = queryString ? `/orders?${queryString}` : '/orders';
      const res = await api.get<{ orders: Order[]; total: number }>(url);
      setOrders(res.orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get<Stats>('/orders/stats/summary');
      setStats(res);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchOrders(), fetchStats()]);
      setLoading(false);
    };
    loadData();
  }, [statusFilter, search]);

  const handlePay = async () => {
    if (!payDialog) return;
    try {
      await api.post(`/orders/${payDialog.id}/pay`, { paymentMethod });
      setPayDialog(null);
      setSnackbar({ open: true, message: '✅ Pago registrado correctamente', severity: 'success' });
      fetchOrders();
      fetchStats();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || 'Error al procesar pago', severity: 'error' });
    }
  };

  const handleCancel = async () => {
    if (!cancelDialog) return;
    try {
      await api.post(`/orders/${cancelDialog.id}/cancel`);
      setCancelDialog(null);
      setSnackbar({ open: true, message: '✅ Fiado cancelado, stock devuelto', severity: 'success' });
      fetchOrders();
      fetchStats();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || 'Error al cancelar', severity: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      await api.delete(`/orders/${deleteDialog.id}`);
      setDeleteDialog(null);
      setSnackbar({ open: true, message: '✅ Fiado eliminado correctamente', severity: 'success' });
      fetchOrders();
      fetchStats();
    } catch (error: any) {
      setSnackbar({ open: true, message: error.message || 'Error al eliminar', severity: 'error' });
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Chip label="Pendiente" color="warning" size="small" />;
      case 'PAID':
        return <Chip label="Pagado" color="success" size="small" />;
      case 'CANCELLED':
        return <Chip label="Cancelado" color="error" size="small" />;
      case 'RETURNED':
        return <Chip label="🔄 Devuelto" color="info" size="small" sx={{ bgcolor: '#E3F2FD' }} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Fiados (Ventas a Crédito)
      </Typography>

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: '#FFF3E0' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <WarningIcon color="warning" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Pendientes
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold" color="warning.dark">
                  ${formatNumber(stats.totalPending)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.pending.count} fiados
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: '#E8F5E9' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <MoneyIcon color="success" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Cobrados
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold" color="success.dark">
                  ${formatNumber(stats.paid.total)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stats.paid.count} pagados
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: '#FFEBEE' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <CancelIcon color="error" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Cancelados
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight="bold" color="error.dark">
                  {stats.cancelled.count}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  fiados cancelados
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField
            size="small"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 280 }}
          />
          
          <ToggleButtonGroup
            value={statusFilter}
            exclusive
            onChange={(_, val) => val && setStatusFilter(val)}
            size="small"
          >
            <ToggleButton value="PENDING">Pendientes</ToggleButton>
            <ToggleButton value="PAID">Pagados</ToggleButton>
            <ToggleButton value="CANCELLED">Cancelados</ToggleButton>
            <ToggleButton value="RETURNED">Devueltos</ToggleButton>
            <ToggleButton value="ALL">Todos</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Orders Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f5f5f5' }}>
              <TableCell><strong>Cliente</strong></TableCell>
              <TableCell><strong>Teléfono</strong></TableCell>
              <TableCell><strong>Fecha</strong></TableCell>
              <TableCell><strong>Compromiso</strong></TableCell>
              <TableCell align="right"><strong>Total</strong></TableCell>
              <TableCell align="center"><strong>Estado</strong></TableCell>
              <TableCell align="center"><strong>Acciones</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No hay fiados {statusFilter !== 'ALL' ? 'con este estado' : ''}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => {
                const isDueToday = order.dueDate && order.status === 'PENDING' && 
                  order.dueDate.split('T')[0] === new Date().toISOString().split('T')[0];
                
                return (
                  <TableRow 
                    key={order.id}
                    hover
                    sx={{ 
                      bgcolor: isDueToday ? '#FFF3E0' : (order.status === 'PENDING' ? '#FFFDE7' : 'inherit')
                    }}
                  >
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <PersonIcon fontSize="small" color="action" />
                        <Box>
                          <Typography fontWeight="medium" variant="body2">{order.customerName}</Typography>
                          {order.notes && (
                            <Typography variant="caption" color="text.secondary">
                              {order.notes}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {order.customerPhone ? (
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <PhoneIcon fontSize="small" color="action" />
                          <Typography variant="body2">{order.customerPhone}</Typography>
                        </Box>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{formatDate(order.createdAt)}</Typography>
                    </TableCell>
                    <TableCell>
                      {order.dueDate ? (
                        <Chip 
                          icon={<EventIcon />}
                          label={new Date(order.dueDate).toLocaleDateString('es-CO')}
                          size="small"
                          color={isDueToday ? 'warning' : 'default'}
                          variant={isDueToday ? 'filled' : 'outlined'}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">
                        ${formatNumber(order.total)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {order.priceType === 'sanAlas' ? 'San Alas' : 'Público'}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {getStatusChip(order.status)}
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={0.5} justifyContent="center">
                        <IconButton
                          color="primary"
                          size="small"
                          onClick={() => setDetailDialog(order)}
                          title="Ver detalles"
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        {order.status === 'PENDING' && (
                          <>
                            <IconButton
                              color="success"
                              size="small"
                              onClick={() => setPayDialog(order)}
                              title="Marcar como pagado"
                            >
                              <PaymentIcon fontSize="small" />
                            </IconButton>
                            {isAdmin && (
                              <IconButton
                                color="warning"
                                size="small"
                                onClick={() => setCancelDialog(order)}
                                title="Cancelar fiado (devolver stock)"
                              >
                                <CancelIcon fontSize="small" />
                              </IconButton>
                            )}
                          </>
                        )}
                        {isAdmin && (
                          <IconButton
                            color="error"
                            size="small"
                            onClick={() => setDeleteDialog(order)}
                            title="Eliminar fiado"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Detail Dialog */}
      <Dialog open={!!detailDialog} onClose={() => setDetailDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon color="primary" />
          Detalle del Fiado
        </DialogTitle>
        <DialogContent>
          {detailDialog && (
            <Box>
              {/* Info del cliente */}
              <Box sx={{ p: 2, mb: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Cliente</Typography>
                    <Typography fontWeight="bold">{detailDialog.customerName}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Teléfono</Typography>
                    <Typography>{detailDialog.customerPhone || '-'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Fecha</Typography>
                    <Typography>{formatDate(detailDialog.createdAt)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">Compromiso de pago</Typography>
                    <Typography>
                      {detailDialog.dueDate 
                        ? new Date(detailDialog.dueDate).toLocaleDateString('es-CO')
                        : 'Sin fecha'}
                    </Typography>
                  </Grid>
                  {detailDialog.notes && (
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Notas</Typography>
                      <Typography>{detailDialog.notes}</Typography>
                    </Grid>
                  )}
                </Grid>
              </Box>

              {/* Productos */}
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                📦 Productos
              </Typography>
              <List dense disablePadding sx={{ bgcolor: '#fafafa', borderRadius: 1, mb: 2 }}>
                {detailDialog.items.map((item) => (
                  <ListItem key={item.id} sx={{ py: 1 }}>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between">
                          <Typography variant="body2">
                            {item.quantity} x {item.productName}
                            {item.presentationName && ` (${item.presentationName})`}
                          </Typography>
                          <Typography variant="body2" fontWeight="bold">
                            ${formatNumber(item.subtotal)}
                          </Typography>
                        </Box>
                      }
                      secondary={`$${formatNumber(item.unitPrice)} c/u`}
                    />
                  </ListItem>
                ))}
              </List>

              <Divider sx={{ my: 2 }} />

              {/* Total */}
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">Total:</Typography>
                <Typography variant="h5" fontWeight="bold" color="primary.main">
                  ${formatNumber(detailDialog.total)}
                </Typography>
              </Box>

              {/* Estado */}
              <Box mt={2} textAlign="center">
                {getStatusChip(detailDialog.status)}
                {detailDialog.paidAt && (
                  <Typography variant="caption" color="success.main" display="block" mt={1}>
                    Pagado: {formatDate(detailDialog.paidAt)}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(null)}>Cerrar</Button>
          {detailDialog?.status === 'PENDING' && (
            <Button 
              variant="contained" 
              color="success"
              onClick={() => {
                setPayDialog(detailDialog);
                setDetailDialog(null);
              }}
            >
              Registrar Pago
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Pay Dialog */}
      <Dialog open={!!payDialog} onClose={() => setPayDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Registrar Pago</DialogTitle>
        <DialogContent>
          {payDialog && (
            <Box sx={{ pt: 1 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                Cliente: <strong>{payDialog.customerName}</strong>
              </Alert>
              <Typography variant="h4" align="center" fontWeight="bold" color="success.main" gutterBottom>
                ${formatNumber(payDialog.total)}
              </Typography>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Método de Pago</InputLabel>
                <Select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  label="Método de Pago"
                >
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="transferencia">Transferencia</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayDialog(null)}>Cancelar</Button>
          <Button variant="contained" color="success" onClick={handlePay}>
            Confirmar Pago
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelDialog} onClose={() => setCancelDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancelar Fiado</DialogTitle>
        <DialogContent>
          {cancelDialog && (
            <Box sx={{ pt: 1 }}>
              <Alert severity="warning" sx={{ mb: 2 }}>
                ¿Estás seguro de cancelar este fiado? El stock será devuelto al inventario.
              </Alert>
              <Typography>
                Cliente: <strong>{cancelDialog.customerName}</strong>
              </Typography>
              <Typography>
                Total: <strong>${formatNumber(cancelDialog.total)}</strong>
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog(null)}>No, volver</Button>
          <Button variant="contained" color="warning" onClick={handleCancel}>
            Sí, cancelar fiado
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
          <DeleteIcon />
          Eliminar Fiado
        </DialogTitle>
        <DialogContent>
          {deleteDialog && (
            <Box sx={{ pt: 1 }}>
              <Alert severity="error" sx={{ mb: 2 }}>
                {deleteDialog.status === 'PENDING' 
                  ? '⚠️ Este fiado está PENDIENTE. Al eliminarlo se perderá el registro pero NO se devolverá el stock. ¿Estás seguro?'
                  : deleteDialog.status === 'CANCELLED'
                  ? 'Se eliminará permanentemente el registro del fiado cancelado.'
                  : 'Se eliminará permanentemente el registro del fiado pagado.'
                }
              </Alert>
              <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>Cliente:</strong> {deleteDialog.customerName}
                </Typography>
                <Typography variant="body2">
                  <strong>Total:</strong> ${formatNumber(deleteDialog.total)}
                </Typography>
                <Typography variant="body2">
                  <strong>Estado:</strong> {deleteDialog.status === 'PENDING' ? 'Pendiente' : deleteDialog.status === 'PAID' ? 'Pagado' : 'Cancelado'}
                </Typography>
                <Typography variant="body2">
                  <strong>Fecha:</strong> {formatDate(deleteDialog.createdAt)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteDialog(null)} variant="outlined">
            Cancelar
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} startIcon={<DeleteIcon />}>
            Sí, eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar de notificaciones */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Alerta de fiados que vencen hoy */}
      <Snackbar
        open={dueTodayOrders.length > 0 && statusFilter === 'PENDING'}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert 
          severity="warning"
          variant="filled"
          sx={{ width: '100%' }}
          icon={<EventIcon />}
        >
          <strong>¡{dueTodayOrders.length} fiado(s) vencen hoy!</strong>
          <Box sx={{ mt: 0.5 }}>
            {dueTodayOrders.slice(0, 3).map(o => (
              <Typography key={o.id} variant="caption" display="block">
                • {o.customerName}: ${formatNumber(o.total)}
              </Typography>
            ))}
            {dueTodayOrders.length > 3 && (
              <Typography variant="caption">...y {dueTodayOrders.length - 3} más</Typography>
            )}
          </Box>
        </Alert>
      </Snackbar>
    </Box>
  );
}
