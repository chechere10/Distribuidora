import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Grid,
  Card,
  CardContent,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  AssignmentReturn as ReturnIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

interface Product {
  id: string;
  name: string;
  baseUnit: string;
  baseStock: number;
  defaultPrice: number;
  presentations?: Presentation[];
}

interface Presentation {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Warehouse {
  id: string;
  name: string;
}

interface Sale {
  id: string;
  saleNumber: number;
  total: number;
  createdAt: string;
  priceType: string;
  status: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    product: { id: string; name: string };
  }[];
}

interface ProductReturn {
  id: string;
  returnNumber: number;
  warehouseId: string;
  saleId: string | null;
  productId: string;
  presentationId: string | null;
  quantity: number;
  baseQuantity: number;
  unitPrice: number;
  total: number;
  reason: string;
  notes: string | null;
  createdAt: string;
  product: Product;
  warehouse: Warehouse;
  user?: { id: string; username: string; name: string | null };
}

interface ReturnSummary {
  totalReturns: number;
  totalAmount: number;
  byReason: { reason: string; count: number; total: number }[];
}

const RETURN_REASONS = [
  'Producto dañado',
  'Producto vencido',
  'Error en cantidad',
  'Error en producto',
  'Cliente insatisfecho',
  'Cambio de opinión',
  'Producto defectuoso',
  'Otro',
];

export default function Returns() {
  const { isAdmin } = useAuth();
  const [returns, setReturns] = useState<ProductReturn[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [summary, setSummary] = useState<ReturnSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleSearch, setSaleSearch] = useState<string>('');
  const [salesSearchResults, setSalesSearchResults] = useState<Sale[]>([]);
  const [quantity, setQuantity] = useState<string>('1');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Filters
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Buscar ventas cuando cambia el texto de búsqueda
  useEffect(() => {
    const searchSales = async () => {
      if (saleSearch.length < 2) {
        setSalesSearchResults([]);
        return;
      }
      try {
        const results = await api.get<Sale[]>(`/sales?search=${encodeURIComponent(saleSearch)}&limit=10`);
        // Solo mostrar ventas completadas (no devueltas)
        setSalesSearchResults(results.filter(s => s.status !== 'returned' && s.status !== 'cancelled'));
      } catch {
        setSalesSearchResults([]);
      }
    };
    const timeout = setTimeout(searchSales, 300);
    return () => clearTimeout(timeout);
  }, [saleSearch]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [returnsData, productsData, warehousesData, summaryData] = await Promise.all([
        api.get<ProductReturn[]>('/returns'),
        api.get<Product[]>('/products'),
        api.get<Warehouse[]>('/warehouses'),
        api.get<ReturnSummary>('/returns/summary'),
      ]);
      setReturns(returnsData);
      setProducts(productsData);
      setWarehouses(warehousesData);
      setSummary(summaryData);

      // Set default warehouse
      if (warehousesData.length > 0 && !selectedWarehouse) {
        setSelectedWarehouse(warehousesData[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadReturns = async () => {
    try {
      let url = '/returns';
      const params = new URLSearchParams();
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);
      if (params.toString()) url += `?${params.toString()}`;

      const [returnsData, summaryData] = await Promise.all([
        api.get<ProductReturn[]>(url),
        api.get<ReturnSummary>(`/returns/summary?${params.toString()}`),
      ]);
      setReturns(returnsData);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err.message || 'Error al cargar devoluciones');
    }
  };

  const handleProductChange = (product: Product | null) => {
    setSelectedProduct(product);
    setSelectedPresentation(null);
    if (product) {
      setUnitPrice(String(product.defaultPrice));
    } else {
      setUnitPrice('');
    }
  };

  const handlePresentationChange = (presentation: Presentation | null) => {
    setSelectedPresentation(presentation);
    if (presentation) {
      setUnitPrice(String(presentation.price));
    } else if (selectedProduct) {
      setUnitPrice(String(selectedProduct.defaultPrice));
    }
  };

  const calculateBaseQuantity = (): number => {
    const qty = parseFloat(quantity) || 0;
    if (selectedPresentation) {
      return qty * selectedPresentation.quantity;
    }
    return qty;
  };

  const calculateTotal = (): number => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    return qty * price;
  };

  const handleSubmit = async () => {
    if (!selectedProduct || !selectedWarehouse) {
      setError('Seleccione un producto y almacén');
      return;
    }

    const finalReason = reason === 'Otro' ? customReason : reason;
    if (!finalReason) {
      setError('Ingrese el motivo de la devolución');
      return;
    }

    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) {
      setError('Ingrese una cantidad válida');
      return;
    }

    const price = parseFloat(unitPrice);
    if (!price || price <= 0) {
      setError('Ingrese un precio válido');
      return;
    }

    try {
      // Abrir caja registradora para entregar el dinero de la devolución
      try {
        await api.post('/sales/open-drawer');
      } catch (e) {
        console.warn('No se pudo abrir la caja registradora:', e);
      }

      await api.post('/returns', {
        warehouseId: selectedWarehouse.id,
        saleId: selectedSale?.id || null,
        productId: selectedProduct.id,
        presentationId: selectedPresentation?.id || null,
        quantity: qty,
        baseQuantity: calculateBaseQuantity(),
        unitPrice: price,
        reason: finalReason,
        notes: notes || null,
      });

      setSuccess('Devolución registrada exitosamente');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setError(err.message || 'Error al registrar devolución');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta devolución? Se revertirán los cambios en inventario y caja.')) {
      return;
    }

    try {
      await api.delete(`/returns/${id}`);
      setSuccess('Devolución eliminada y cambios revertidos');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Error al eliminar devolución');
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setSelectedPresentation(null);
    setSelectedSale(null);
    setSaleSearch('');
    setSalesSearchResults([]);
    setQuantity('1');
    setUnitPrice('');
    setReason('');
    setCustomReason('');
    setNotes('');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReturnIcon sx={{ fontSize: 32, color: 'warning.main' }} />
          <Typography variant="h4">Devoluciones</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Filtros">
            <IconButton onClick={() => setShowFilters(!showFilters)} color={showFilters ? 'primary' : 'default'}>
              <FilterIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Actualizar">
            <IconButton onClick={loadData}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            color="warning"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            Nueva Devolución
          </Button>
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Filters */}
      {showFilters && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                label="Fecha inicio"
                type="date"
                fullWidth
                size="small"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Fecha fin"
                type="date"
                fullWidth
                size="small"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button variant="outlined" onClick={loadReturns} startIcon={<SearchIcon />}>
                Buscar
              </Button>
              <Button
                sx={{ ml: 1 }}
                onClick={() => {
                  setFilterStartDate('');
                  setFilterEndDate('');
                  loadData();
                }}
              >
                Limpiar
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Devoluciones
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {summary.totalReturns}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Monto Total Devuelto
                </Typography>
                <Typography variant="h4" color="error.main">
                  {formatCurrency(summary.totalAmount)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Principal Motivo
                </Typography>
                <Typography variant="h6">
                  {summary.byReason[0]?.reason || 'N/A'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {summary.byReason[0]?.count || 0} casos
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Returns Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>#</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell>Cantidad</TableCell>
              <TableCell>Precio Unit.</TableCell>
              <TableCell>Total</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell>Usuario</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {returns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography color="text.secondary" sx={{ py: 3 }}>
                    No hay devoluciones registradas
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              returns.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Chip label={`#${r.returnNumber}`} size="small" color="warning" variant="outlined" />
                  </TableCell>
                  <TableCell>{formatDate(r.createdAt)}</TableCell>
                  <TableCell>
                    <Typography fontWeight="medium">{r.product?.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.warehouse?.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {r.quantity} {r.product?.baseUnit}
                  </TableCell>
                  <TableCell>{formatCurrency(r.unitPrice)}</TableCell>
                  <TableCell>
                    <Typography color="error.main" fontWeight="bold">
                      {formatCurrency(r.total)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={r.reason} size="small" />
                  </TableCell>
                  <TableCell>{r.user?.name || r.user?.username || 'N/A'}</TableCell>
                  <TableCell>
                    {isAdmin && (
                      <Tooltip title="Eliminar y revertir">
                        <IconButton size="small" color="error" onClick={() => handleDelete(r.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* New Return Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReturnIcon color="warning" />
            Nueva Devolución
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Alert severity="info" icon={false}>
              Al registrar una devolución:
              <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                <li>El producto volverá al inventario</li>
                <li>El dinero se descontará de la caja</li>
                <li>La venta asociada se marcará como "Devuelta"</li>
              </ul>
            </Alert>

            <FormControl fullWidth>
              <InputLabel>Almacén</InputLabel>
              <Select
                value={selectedWarehouse?.id || ''}
                label="Almacén"
                onChange={(e) => {
                  const wh = warehouses.find((w) => w.id === e.target.value);
                  setSelectedWarehouse(wh || null);
                }}
              >
                {warehouses.map((wh) => (
                  <MenuItem key={wh.id} value={wh.id}>
                    {wh.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Buscar venta para asociar */}
            <Autocomplete
              freeSolo
              options={salesSearchResults}
              getOptionLabel={(option) => typeof option === 'string' ? option : `#${String(option.saleNumber).padStart(6, '0')} - ${formatCurrency(option.total)}`}
              value={selectedSale}
              inputValue={saleSearch}
              onInputChange={(_, value) => setSaleSearch(value)}
              onChange={(_, value) => {
                if (typeof value !== 'string' && value) {
                  setSelectedSale(value);
                  // Auto-seleccionar producto de la venta si hay uno solo
                  if (value.items.length === 1) {
                    const saleItem = value.items[0];
                    const prod = products.find(p => p.id === saleItem.productId);
                    if (prod) {
                      handleProductChange(prod);
                      setUnitPrice(String(saleItem.unitPrice));
                      setQuantity(String(saleItem.quantity));
                    }
                  }
                }
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  label="🔍 Buscar venta por N° o producto (opcional)"
                  placeholder="Ej: 000021"
                  helperText={selectedSale ? `Venta seleccionada: #${String(selectedSale.saleNumber).padStart(6, '0')}` : 'Busque una venta para asociar la devolución'}
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">
                      #{String(option.saleNumber).padStart(6, '0')} - {formatCurrency(option.total)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(option.createdAt).toLocaleDateString('es-CO')} | {option.items.length} producto(s)
                    </Typography>
                  </Box>
                </Box>
              )}
            />

            {selectedSale && (
              <Alert severity="success" onClose={() => { setSelectedSale(null); setSaleSearch(''); }}>
                <Typography variant="body2" fontWeight="bold">
                  Venta #{String(selectedSale.saleNumber).padStart(6, '0')} seleccionada
                </Typography>
                <Typography variant="caption">
                  Esta venta se marcará como "Devuelta" al registrar la devolución
                </Typography>
              </Alert>
            )}

            <Autocomplete
              options={products}
              getOptionLabel={(option) => option.name}
              value={selectedProduct}
              onChange={(_, value) => handleProductChange(value)}
              renderInput={(params) => <TextField {...params} label="Producto" required />}
            />

            {selectedProduct && selectedProduct.presentations && selectedProduct.presentations.length > 0 && (
              <Autocomplete
                options={selectedProduct.presentations}
                getOptionLabel={(option) => `${option.name} (${option.quantity} ${selectedProduct.baseUnit})`}
                value={selectedPresentation}
                onChange={(_, value) => handlePresentationChange(value)}
                renderInput={(params) => <TextField {...params} label="Presentación (opcional)" />}
              />
            )}

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Cantidad"
                  type="number"
                  fullWidth
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  inputProps={{ min: 0, step: 0.001 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        {selectedPresentation?.name || selectedProduct?.baseUnit || 'und'}
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Precio unitario"
                  type="number"
                  fullWidth
                  required
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  inputProps={{ min: 0 }}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography color="text.secondary">
                Stock base: {calculateBaseQuantity()} {selectedProduct?.baseUnit || 'und'}
              </Typography>
              <Typography variant="h6" color="error.main">
                Total a devolver: {formatCurrency(calculateTotal())}
              </Typography>
            </Box>

            <FormControl fullWidth required>
              <InputLabel>Motivo de devolución</InputLabel>
              <Select
                value={reason}
                label="Motivo de devolución"
                onChange={(e) => setReason(e.target.value)}
              >
                {RETURN_REASONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {reason === 'Otro' && (
              <TextField
                label="Especifique el motivo"
                fullWidth
                required
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            )}

            <TextField
              label="Notas adicionales"
              fullWidth
              multiline
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Cliente presentó el ticket de compra"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained" color="warning">
            Registrar Devolución
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
