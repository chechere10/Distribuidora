import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Pagination,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material';
import {
  Search,
  Receipt,
  TrendingUp,
  ShoppingCart,
  CalendarToday,
  Visibility,
  Delete
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { es } from 'date-fns/locale/es';
import { getToken } from '../api';
import ReceiptDialog from '../components/ReceiptDialog';

// Formato de números colombiano
const formatCOP = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  subtotal: number;
  product: {
    id: string;
    name: string;
    imageUrl?: string;
  };
  presentation?: {
    id: string;
    name: string;
  };
}

interface Sale {
  id: string;
  saleNumber?: number;
  total: number;
  createdAt: string;
  warehouseId: string;
  paymentMethod?: string;
  priceType?: string;
  cashReceived?: number | null;
  change?: number | null;
  warehouse?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    username: string;
    name: string | null;
  };
  items: SaleItem[];
}

export default function SalesHistory() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  
  // Detail dialog
  const [detailDialog, setDetailDialog] = useState<Sale | null>(null);
  
  // Receipt dialog
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  
  // Delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [deleting, setDeleting] = useState(false);
  
  // Filtros
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Stats
  const [todaySales, setTodaySales] = useState({ count: 0, total: 0 });

  const limit = 20;

  useEffect(() => {
    loadSales();
    loadTodayStats();
  }, [page, startDate, endDate]);

  const loadSales = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('limit', String(limit));
      params.append('offset', String((page - 1) * limit));

      const headers = {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      };

      const response = await fetch(`/api/sales?${params}`, { headers });
      const totalHeader = response.headers.get('X-Total-Count');
      setTotalCount(totalHeader ? parseInt(totalHeader) : 0);

      const data = await response.json();
      
      // Cargar detalles de cada venta
      const salesWithDetails = await Promise.all(
        data.map(async (sale: any) => {
          try {
            const detailRes = await fetch(`/api/sales/${sale.id}`, { headers });
            if (detailRes.ok) {
              return await detailRes.json();
            }
            return sale;
          } catch {
            return sale;
          }
        })
      );

      setSales(salesWithDetails.map((s: any) => ({
        ...s,
        total: Number(s.total),
        items: (s.items || []).map((item: any) => ({
          ...item,
          quantity: Number(item.quantity),
          baseQuantity: Number(item.baseQuantity),
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal)
        }))
      })));
    } catch (err) {
      setError('Error al cargar historial de ventas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTodayStats = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      };

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const params = new URLSearchParams();
      params.append('startDate', today.toISOString());

      const response = await fetch(`/api/accounting/summary?${params}`, { headers });
      const data = await response.json();
      
      setTodaySales({
        count: data.income?.sales?.count || 0,
        total: data.income?.sales?.total || 0
      });
    } catch (err) {
      console.error('Error loading today stats:', err);
    }
  };

  const handleDeleteClick = (sale: Sale, e: React.MouseEvent) => {
    e.stopPropagation();
    setSaleToDelete(sale);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!saleToDelete) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`/api/sales/${saleToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al eliminar');
      }

      // Recargar ventas
      loadSales();
      loadTodayStats();
      setDeleteDialogOpen(false);
      setSaleToDelete(null);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar la venta');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          📋 Historial de Ventas
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Ventas Hoy
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary.main">
                      {todaySales.count}
                    </Typography>
                  </Box>
                  <ShoppingCart sx={{ color: 'primary.main', fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Hoy
                    </Typography>
                    <Typography variant="h5" fontWeight="bold" color="success.main">
                      ${formatCOP(todaySales.total)}
                    </Typography>
                  </Box>
                  <TrendingUp sx={{ color: 'success.main', fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Registros
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {totalCount}
                    </Typography>
                  </Box>
                  <Receipt sx={{ color: 'text.secondary', fontSize: 40 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Buscar por producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <DatePicker
                label="Desde"
                value={startDate}
                onChange={setStartDate}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <DatePicker
                label="Hasta"
                value={endDate}
                onChange={setEndDate}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button 
                variant="outlined" 
                fullWidth
                onClick={() => {
                  setStartDate(null);
                  setEndDate(null);
                  setSearchTerm('');
                  setPage(1);
                  loadSales();
                }}
              >
                Limpiar
              </Button>
            </Grid>
          </Grid>
        </Paper>

        {/* Sales Table */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Paper>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'grey.100' }}>
                    <TableCell><strong>FECHA</strong></TableCell>
                    <TableCell><strong>N° VENTA</strong></TableCell>
                    <TableCell><strong>OPERADOR</strong></TableCell>
                    <TableCell align="center"><strong>TIPO</strong></TableCell>
                    <TableCell align="center"><strong>PAGO</strong></TableCell>
                    <TableCell align="center"><strong>PRODUCTOS</strong></TableCell>
                    <TableCell align="right"><strong>TOTAL</strong></TableCell>
                    <TableCell align="center"><strong>ACCIONES</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography color="text.secondary">
                          No hay ventas registradas
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => (
                      <TableRow 
                        key={sale.id} 
                        hover
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="body2">{formatDate(sale.createdAt)}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'primary.main' }}>
                            {sale.saleNumber ? String(sale.saleNumber).padStart(6, '0') : sale.id.slice(0, 8)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {sale.user?.name || sale.user?.username || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={sale.priceType === 'sanAlas' ? '🍗 San Alas' : '🏪 Público'} 
                            size="small" 
                            color={sale.priceType === 'sanAlas' ? 'success' : 'default'}
                            variant="filled"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={sale.paymentMethod === 'transferencia' ? '💳' : '💵'} 
                            size="small" 
                            variant="outlined"
                            title={sale.paymentMethod === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={`${sale.items?.length || 0}`} 
                            size="small" 
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            ${formatCOP(sale.total)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Ver detalles">
                            <IconButton
                              color="primary"
                              size="small"
                              onClick={() => setDetailDialog(sale)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar venta">
                            <IconButton
                              color="error"
                              size="small"
                              onClick={(e) => handleDeleteClick(sale, e)}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <Pagination 
                  count={totalPages} 
                  page={page} 
                  onChange={(_, p) => setPage(p)}
                  color="primary"
                />
              </Box>
            )}
          </Paper>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!detailDialog} onClose={() => setDetailDialog(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Receipt color="primary" />
            Detalle de Venta
          </DialogTitle>
          <DialogContent>
            {detailDialog && (
              <Box>
                {/* Info de la venta */}
                <Box sx={{ p: 2, mb: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">N° Venta</Typography>
                      <Typography fontWeight="bold" sx={{ fontFamily: 'monospace' }}>
                        {detailDialog.saleNumber ? String(detailDialog.saleNumber).padStart(6, '0') : detailDialog.id.slice(0, 8)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Fecha</Typography>
                      <Typography>{formatDate(detailDialog.createdAt)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Tipo de Precio</Typography>
                      <Chip 
                        label={detailDialog.priceType === 'sanAlas' ? '🍗 San Alas' : '🏪 Público'} 
                        size="small" 
                        color={detailDialog.priceType === 'sanAlas' ? 'success' : 'default'}
                        sx={{ fontWeight: 600 }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Método de Pago</Typography>
                      <Typography>
                        {detailDialog.paymentMethod === 'transferencia' ? '💳 Transferencia' : '💵 Efectivo'}
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="caption" color="text.secondary">Registrado por</Typography>
                      <Typography fontWeight="medium">
                        👤 {detailDialog.user?.name || detailDialog.user?.username || 'No registrado'}
                      </Typography>
                    </Grid>
                    {detailDialog.paymentMethod === 'efectivo' && detailDialog.cashReceived && (
                      <>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Efectivo Recibido</Typography>
                          <Typography>${formatCOP(detailDialog.cashReceived)}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Cambio</Typography>
                          <Typography color="success.main">${formatCOP(detailDialog.change || 0)}</Typography>
                        </Grid>
                      </>
                    )}
                  </Grid>
                </Box>

                {/* Productos */}
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  📦 Productos ({detailDialog.items?.length || 0})
                </Typography>
                <List dense disablePadding sx={{ bgcolor: '#fafafa', borderRadius: 1, mb: 2 }}>
                  {detailDialog.items?.map((item) => (
                    <ListItem key={item.id} sx={{ py: 1 }}>
                      <ListItemText
                        primary={
                          <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">
                              {item.quantity} x {item.product?.name || 'Producto'}
                              {item.presentation?.name && ` (${item.presentation.name})`}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              ${formatCOP(item.subtotal)}
                            </Typography>
                          </Box>
                        }
                        secondary={`$${formatCOP(item.unitPrice)} c/u`}
                      />
                    </ListItem>
                  ))}
                </List>

                <Divider sx={{ my: 2 }} />

                {/* Total */}
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Total:</Typography>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    ${formatCOP(detailDialog.total)}
                  </Typography>
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailDialog(null)}>Cerrar</Button>
            <Button 
              variant="contained" 
              onClick={() => {
                setSelectedSale(detailDialog);
                setShowReceiptDialog(true);
                setDetailDialog(null);
              }}
            >
              🧾 Ver Recibo
            </Button>
          </DialogActions>
        </Dialog>

        {/* Receipt Dialog */}
        <ReceiptDialog
          open={showReceiptDialog}
          onClose={() => {
            setShowReceiptDialog(false);
            setSelectedSale(null);
          }}
          sale={selectedSale}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setSaleToDelete(null);
          }}
        >
          <DialogTitle sx={{ color: 'error.main' }}>
            ⚠️ Confirmar Eliminación
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              ¿Estás seguro de eliminar la venta <strong>#{saleToDelete?.saleNumber ? String(saleToDelete.saleNumber).padStart(6, '0') : saleToDelete?.id.slice(0, 8)}</strong>?
              <br /><br />
              <strong>Total:</strong> ${saleToDelete ? formatCOP(saleToDelete.total) : '0'}
              <br /><br />
              Esta acción restaurará el stock de los productos y no se puede deshacer.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button 
              onClick={() => {
                setDeleteDialogOpen(false);
                setSaleToDelete(null);
              }}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disabled={deleting}
              startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <Delete />}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
