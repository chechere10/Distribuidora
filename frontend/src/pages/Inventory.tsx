import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Alert,
  Avatar,
  Tabs,
  Tab,
  Divider,
  Tooltip,
  CircularProgress,
  Snackbar,
  Paper,
  useTheme,
  alpha,
  Collapse,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  Download,
  Upload,
  Warning,
  CheckCircle,
  Inventory2,
  QrCode2,
  Image as ImageIcon,
  Category as CategoryIcon,
  AttachMoney,
  LocalOffer,
  ContentCopy,
  Refresh,
  Close,
  CloudUpload,
  ExpandMore,
  ExpandLess,
  AddCircleOutline,
  RemoveCircleOutline,
  FolderOpen,
  CameraAlt,
  RotateRight,
  RotateLeft,
  ZoomIn,
  ZoomOut,
} from '@mui/icons-material';
import { api } from '../api';

// ============ CONFIGURACIÓN ============
const API_BASE_URL = 'http://localhost:3001';

// ============ UTILIDADES DE FORMATO ============
// Construir URL completa para imágenes y recursos del backend
const getFullUrl = (path: string | undefined | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
};

// Formatear número con separadores de miles (formato colombiano: 1.000.000)
const formatNumber = (value: string | number): string => {
  const num = typeof value === 'string' ? value.replace(/\./g, '') : String(value);
  const cleanNum = num.replace(/[^\d]/g, '');
  if (!cleanNum) return '';
  return parseInt(cleanNum, 10).toLocaleString('es-CO');
};

// Obtener valor numérico sin formato
const parseNumber = (value: string): string => {
  return value.replace(/\./g, '').replace(/[^\d]/g, '');
};

// ============ INTERFACES ============
interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  isActive: boolean;
  _count?: { products: number };
}

interface PriceList {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isActive: boolean;
}

interface ProductPrice {
  id: string;
  priceListId: string;
  price: string;
  priceList: PriceList;
}

interface ProductPresentation {
  id?: string;
  name: string;
  quantity: string;
  price: string;
  priceSanAlas?: string;
  priceEmpleados?: string;
  barcode?: string;
  sortOrder?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  barcodeImageUrl?: string;
  barcodeImageRotation?: number;
  barcodeImageScale?: number;
  categoryId?: string;
  category?: Category;
  defaultPrice: string;
  priceSanAlas?: string | null;
  priceEmpleados?: string | null;
  cost: string;
  imageUrl?: string;
  baseUnit: string;
  baseStock: string;
  stockDisplay?: string;
  minStock: number;
  isActive: boolean;
  prices: ProductPrice[];
  presentations: ProductPresentation[];
  createdAt: string;
}

// ============ COMPONENTE PRINCIPAL ============
export default function Inventory() {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    results?: {
      created: number;
      updated: number;
      errors: Array<{ row: number; error: string }>;
    };
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const totalProducts = products.length;
  const inStock = products.filter(p => Number(p.baseStock) > 0).length;
  const lowStock = products.filter(p => Number(p.baseStock) > 0 && Number(p.baseStock) <= p.minStock).length;
  const outOfStock = products.filter(p => Number(p.baseStock) === 0).length;

  // ============ LOAD DATA ============
  const loadProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (selectedCategory) params.append('categoryId', selectedCategory);
      const data = await api.get<Product[]>(`/products?${params.toString()}`);
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }, [searchQuery, selectedCategory]);

  const loadCategories = async () => {
    try {
      const data = await api.get<Category[]>('/categories');
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadPriceLists = async () => {
    try {
      const data = await api.get<PriceList[]>('/price-lists');
      setPriceLists(data);
    } catch (error) {
      console.error('Error loading price lists:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadCategories(), loadPriceLists()]);
      await loadProducts();
      setLoading(false);
    };
    init();
  }, []);

  // Detectar parámetro newProduct=true para abrir diálogo automáticamente
  useEffect(() => {
    if (!loading && searchParams.get('newProduct') === 'true') {
      setDialogOpen(true);
      // Limpiar el parámetro de la URL
      searchParams.delete('newProduct');
      setSearchParams(searchParams, { replace: true });
    }
  }, [loading, searchParams, setSearchParams]);

  useEffect(() => {
    if (!loading) {
      loadProducts();
    }
  }, [searchQuery, selectedCategory, loadProducts]);

  // ============ HANDLERS ============
  const handleOpenDialog = (product?: Product) => {
    setEditingProduct(product || null);
    setDialogOpen(true);
  };

  // Ref para mantener la referencia actual
  const handleOpenDialogRef = useRef(handleOpenDialog);
  useEffect(() => {
    handleOpenDialogRef.current = handleOpenDialog;
  });

  // ============ ESCÁNER DE CÓDIGO DE BARRAS ============
  // Estado para controlar el código escaneado que se pasará al diálogo
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  const searchProductByBarcode = useCallback(async (barcode: string) => {
    console.log('🔍 Inventory - Código escaneado:', barcode, '| Diálogo abierto:', dialogOpen);
    
    if (dialogOpen) {
      // Si el diálogo está abierto, ASIGNAR el código al campo de barcode
      console.log('📝 Asignando código de barras al formulario:', barcode);
      setScannedBarcode(barcode);
      return;
    }
    
    // Si el diálogo está cerrado, BUSCAR el producto
    try {
      // Buscar producto por código de barras usando el endpoint específico
      const data = await api.get<Product>(`/products/barcode/${encodeURIComponent(barcode)}`);
      
      if (data) {
        // Abrir el producto encontrado para edición
        handleOpenDialogRef.current(data);
        setSnackbar({ 
          open: true, 
          message: `✅ Producto encontrado: ${data.name}`, 
          severity: 'success' 
        });
      } else {
        setSnackbar({ 
          open: true, 
          message: `Producto no encontrado: ${barcode}`, 
          severity: 'error' 
        });
      }
    } catch (error: any) {
      // El endpoint retorna 404 si no encuentra
      if (error.message?.includes('404') || error.response?.status === 404) {
        // Preguntar si quiere crear un nuevo producto con este código
        if (confirm(`Producto no encontrado con código: ${barcode}\n\n¿Desea crear un nuevo producto con este código?`)) {
          setScannedBarcode(barcode);
          handleOpenDialogRef.current(undefined); // Abrir diálogo para nuevo producto
        }
      } else {
        console.error('Error buscando producto:', error);
        setSnackbar({ 
          open: true, 
          message: 'Error al buscar producto', 
          severity: 'error' 
        });
      }
    }
  }, [dialogOpen]);

  // Hook del escáner de código de barras - SIEMPRE ACTIVO
  useBarcodeScanner({
    onScan: searchProductByBarcode,
    enabled: true, // Siempre activo
    allowInputFocus: true
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingProduct(null);
  };

  const handleSaveProduct = async (productData: Partial<Product>) => {
    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, productData);
        setSnackbar({ open: true, message: 'Producto actualizado correctamente', severity: 'success' });
      } else {
        await api.post('/products', productData);
        setSnackbar({ open: true, message: 'Producto creado correctamente', severity: 'success' });
      }
      handleCloseDialog();
      loadProducts();
    } catch (error: any) {
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.message || 'Error al guardar producto', 
        severity: 'error' 
      });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    try {
      await api.delete(`/products/${id}`);
      setSnackbar({ open: true, message: 'Producto eliminado', severity: 'success' });
      loadProducts();
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al eliminar producto', severity: 'error' });
    }
  };

  // ============ IMPORT/EXPORT HANDLERS ============
  const handleExportExcel = async () => {
    try {
      setSnackbar({ open: true, message: 'Generando archivo Excel...', severity: 'success' });
      const response = await fetch(`${API_BASE_URL}/api/products/export/excel`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Error al exportar');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `productos_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSnackbar({ open: true, message: 'Archivo Excel descargado', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al exportar productos', severity: 'error' });
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/template/excel`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (!response.ok) throw new Error('Error al descargar plantilla');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_productos.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setSnackbar({ open: true, message: 'Error al descargar plantilla', severity: 'error' });
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/api/products/import/excel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setImportResult({
          success: false,
          message: result.message || 'Error al importar',
        });
      } else {
        setImportResult(result);
        // Recargar productos después de importar
        loadProducts();
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        message: error.message || 'Error al importar archivo',
      });
    } finally {
      setImportLoading(false);
      // Limpiar el input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleOpenImportDialog = () => {
    setImportResult(null);
    setImportDialogOpen(true);
  };

  // ============ RENDER ============
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" color="primary">
            Inventario
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gestiona tus productos, precios y presentaciones
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Agregar Producto
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <Inventory2 />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold">{totalProducts}</Typography>
                <Typography variant="body2" color="text.secondary">Total Productos</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'success.main' }}>
                <CheckCircle />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold">{inStock}</Typography>
                <Typography variant="body2" color="text.secondary">En Stock</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'warning.main' }}>
                <Warning />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold">{lowStock}</Typography>
                <Typography variant="body2" color="text.secondary">Stock Bajo</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: alpha(theme.palette.error.main, 0.1) }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'error.main' }}>
                <Warning />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight="bold">{outOfStock}</Typography>
                <Typography variant="body2" color="text.secondary">Agotados</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={5}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por nombre, SKU, código de barras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Categoría</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Categoría"
              >
                <MenuItem value="">Todas</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <IconButton onClick={loadProducts}>
              <Refresh />
            </IconButton>
            <Button variant="outlined" startIcon={<Download />} onClick={handleExportExcel}>
              Exportar
            </Button>
            <Button variant="outlined" startIcon={<Upload />} onClick={handleOpenImportDialog}>
              Importar
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Products Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Producto</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Categoría</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Código</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Precio Base</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Costo</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Stock</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Presentaciones</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                  <Inventory2 sx={{ fontSize: 60, color: 'grey.400', mb: 1 }} />
                  <Typography color="text.secondary">No se encontraron productos</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Agrega tu primer producto
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={getFullUrl(product.imageUrl)}
                        variant="rounded"
                        sx={{ width: 50, height: 50, bgcolor: 'grey.200' }}
                      >
                        <ImageIcon />
                      </Avatar>
                      <Box>
                        <Typography fontWeight="medium">{product.name}</Typography>
                        {product.description && (
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                            {product.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {product.category ? (
                      <Chip 
                        label={product.category.name} 
                        size="small" 
                        sx={{ 
                          bgcolor: product.category.color || 'primary.main',
                          color: 'white',
                        }} 
                      />
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {product.barcode ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <QrCode2 fontSize="small" color="success" />
                        <Typography variant="body2" fontFamily="monospace">
                          {product.barcode}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">Sin código</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="medium">
                      ${Number(product.defaultPrice).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography color="text.secondary">
                      ${Number(product.cost).toLocaleString()}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography 
                        fontWeight="medium"
                        color={
                          Number(product.baseStock) === 0 
                            ? 'error.main' 
                            : Number(product.baseStock) <= product.minStock 
                              ? 'warning.main' 
                              : 'success.main'
                        }
                      >
                        {product.stockDisplay || `${product.baseStock} ${product.baseUnit}`}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {product.presentations && product.presentations.length > 0 ? (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {product.presentations.slice(0, 3).map((pres, idx) => (
                          <Chip
                            key={idx}
                            label={`${pres.name}: $${Number(pres.price).toLocaleString()}`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {product.presentations.length > 3 && (
                          <Chip label={`+${product.presentations.length - 3}`} size="small" />
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => handleOpenDialog(product)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteProduct(product.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Product Dialog */}
      <ProductDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveProduct}
        product={editingProduct}
        categories={categories}
        priceLists={priceLists}
        onNewCategory={() => {
          setEditingCategory(null);
          setCategoryDialogOpen(true);
        }}
        onEditCategory={(cat) => {
          setEditingCategory(cat);
          setCategoryDialogOpen(true);
        }}
        scannedBarcode={scannedBarcode}
        onClearScannedBarcode={() => setScannedBarcode(null)}
      />

      {/* Category Dialog */}
      <CategoryDialog
        open={categoryDialogOpen}
        onClose={() => {
          setCategoryDialogOpen(false);
          setEditingCategory(null);
        }}
        category={editingCategory}
        onSave={async (data) => {
          try {
            if (editingCategory) {
              await api.patch(`/categories/${editingCategory.id}`, data);
              setSnackbar({ open: true, message: 'Categoría actualizada', severity: 'success' });
            } else {
              await api.post('/categories', data);
              setSnackbar({ open: true, message: 'Categoría creada', severity: 'success' });
            }
            loadCategories();
            setCategoryDialogOpen(false);
            setEditingCategory(null);
          } catch (error) {
            setSnackbar({ open: true, message: 'Error al guardar categoría', severity: 'error' });
          }
        }}
      />

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Upload color="primary" />
            Importar Productos desde Excel
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Sube un archivo Excel (.xlsx) con tus productos. Puedes descargar la plantilla para ver el formato correcto.
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={handleDownloadTemplate}
                size="small"
              >
                Descargar Plantilla
              </Button>
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>Formato del archivo:</Typography>
            <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1, mb: 2, fontSize: '0.8rem' }}>
              <Typography variant="body2" component="div">
                <strong>Columnas requeridas:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li><code>Nombre</code> - Nombre del producto</li>
                  <li><code>Precio Público</code> - Precio de venta</li>
                </ul>
                <strong>Columnas opcionales:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li><code>Descripción</code></li>
                  <li><code>SKU</code></li>
                  <li><code>Código de Barras</code></li>
                  <li><code>Categoría ID</code> - ID de categoría existente</li>
                  <li><code>Costo</code></li>
                  <li><code>Unidad Base</code> - kg, unidad, litro, etc.</li>
                  <li><code>Stock</code></li>
                  <li><code>Stock Mínimo</code></li>
                  <li><code>Presentaciones</code> - JSON array (ver plantilla)</li>
                </ul>
              </Typography>
            </Box>

            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleImportFile}
              style={{ display: 'none' }}
              id="import-file-input"
            />
            <label htmlFor="import-file-input">
              <Button
                variant="contained"
                component="span"
                startIcon={importLoading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                disabled={importLoading}
                fullWidth
              >
                {importLoading ? 'Importando...' : 'Seleccionar archivo Excel'}
              </Button>
            </label>

            {importResult && (
              <Box sx={{ mt: 3 }}>
                <Alert severity={importResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                  {importResult.message}
                </Alert>
                
                {importResult.results && (
                  <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
                    <Grid container spacing={2}>
                      <Grid item xs={4}>
                        <Typography variant="h6" color="success.main">{importResult.results.created}</Typography>
                        <Typography variant="caption">Creados</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="h6" color="info.main">{importResult.results.updated}</Typography>
                        <Typography variant="caption">Actualizados</Typography>
                      </Grid>
                      <Grid item xs={4}>
                        <Typography variant="h6" color="error.main">{importResult.results.errors.length}</Typography>
                        <Typography variant="caption">Errores</Typography>
                      </Grid>
                    </Grid>
                    
                    {importResult.results.errors.length > 0 && (
                      <Box sx={{ mt: 2, maxHeight: 150, overflow: 'auto' }}>
                        <Typography variant="caption" color="error">Errores:</Typography>
                        {importResult.results.errors.slice(0, 10).map((err, idx) => (
                          <Typography key={idx} variant="body2" color="error" sx={{ fontSize: '0.75rem' }}>
                            Fila {err.row}: {err.error}
                          </Typography>
                        ))}
                        {importResult.results.errors.length > 10 && (
                          <Typography variant="caption" color="text.secondary">
                            ...y {importResult.results.errors.length - 10} errores más
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// ============ PRODUCT DIALOG ============
interface ProductDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Product>) => void;
  product: Product | null;
  categories: Category[];
  priceLists: PriceList[];
  onNewCategory: () => void;
  onEditCategory: (cat: Category) => void;
  scannedBarcode?: string | null;
  onClearScannedBarcode?: () => void;
}

// Default units list
const DEFAULT_UNITS = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'g', label: 'Gramos (g)' },
  { value: 'lb', label: 'Libras (lb)' },
  { value: 'litro', label: 'Litros' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'metro', label: 'Metros' },
  { value: 'cm', label: 'Centímetros' },
  { value: 'caja', label: 'Caja' },
  { value: 'paquete', label: 'Paquete' },
  { value: 'docena', label: 'Docena' },
  { value: 'bulto', label: 'Bulto' },
];

function ProductDialog({ open, onClose, onSave, product, categories, priceLists, onNewCategory, onEditCategory, scannedBarcode, onClearScannedBarcode }: ProductDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    categoryId: '',
    defaultPrice: '',
    priceSanAlas: '',
    priceEmpleados: '',
    cost: '',
    imageUrl: '',
    baseUnit: 'unidad',
    baseStock: '0',
    minStock: 0,
  });
  const [prices, setPrices] = useState<{ priceListId: string; price: string }[]>([]);
  const [presentations, setPresentations] = useState<ProductPresentation[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [showPresentations, setShowPresentations] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estado para modo de escaneo de código existente
  const [scanMode, setScanMode] = useState(false);
  
  // Estado para mensaje del escáner
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  
  // Custom units state
  const [customUnits, setCustomUnits] = useState<Array<{ value: string; label: string }>>([]);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<{ value: string; label: string } | null>(null);
  const [newUnitName, setNewUnitName] = useState('');

  // Load custom units from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('customUnits');
    if (saved) {
      setCustomUnits(JSON.parse(saved));
    }
  }, []);

  // Capturar código de barras escaneado desde el padre
  useEffect(() => {
    if (scannedBarcode && open) {
      // Asignar el código escaneado al campo barcode
      setFormData(prev => ({ ...prev, barcode: scannedBarcode }));
      setScannerMessage(`✓ Código de barras asociado: ${scannedBarcode}`);
      setScanMode(false); // Desactivar modo escaneo
      // Limpiar el código escaneado del padre
      onClearScannedBarcode?.();
      // Limpiar mensaje después de 4 segundos
      setTimeout(() => setScannerMessage(null), 4000);
    }
  }, [scannedBarcode, open, onClearScannedBarcode]);

  // All units = default + custom (custom overrides default with same value)
  const allUnits = [
    ...DEFAULT_UNITS.filter(du => !customUnits.some(cu => cu.value === du.value)),
    ...customUnits
  ];

  const handleSaveUnit = () => {
    if (!newUnitName.trim()) return;
    
    const unitLabel = newUnitName.trim();
    
    if (editingUnit) {
      // Check if editing a default unit
      const isDefaultUnit = DEFAULT_UNITS.some(du => du.value === editingUnit.value);
      
      if (isDefaultUnit) {
        // Override default unit by adding to custom with same value
        const existingCustom = customUnits.find(cu => cu.value === editingUnit.value);
        let updated;
        if (existingCustom) {
          updated = customUnits.map(u => 
            u.value === editingUnit.value ? { ...u, label: unitLabel } : u
          );
        } else {
          updated = [...customUnits, { value: editingUnit.value, label: unitLabel }];
        }
        setCustomUnits(updated);
        localStorage.setItem('customUnits', JSON.stringify(updated));
      } else {
        // Editing existing custom unit
        const unitValue = newUnitName.toLowerCase().replace(/\s+/g, '_');
        const updated = customUnits.map(u => 
          u.value === editingUnit.value ? { value: unitValue, label: unitLabel } : u
        );
        setCustomUnits(updated);
        localStorage.setItem('customUnits', JSON.stringify(updated));
        // Update formData if currently selected
        if (formData.baseUnit === editingUnit.value) {
          handleChange('baseUnit', unitValue);
        }
      }
    } else {
      // Creating new unit
      const unitValue = newUnitName.toLowerCase().replace(/\s+/g, '_');
      const newUnit = { value: unitValue, label: unitLabel };
      const updated = [...customUnits, newUnit];
      setCustomUnits(updated);
      localStorage.setItem('customUnits', JSON.stringify(updated));
      handleChange('baseUnit', unitValue);
    }
    
    setUnitDialogOpen(false);
    setEditingUnit(null);
    setNewUnitName('');
  };

  const handleDeleteUnit = (unit: { value: string; label: string }) => {
    const updated = customUnits.filter(u => u.value !== unit.value);
    setCustomUnits(updated);
    localStorage.setItem('customUnits', JSON.stringify(updated));
    if (formData.baseUnit === unit.value) {
      handleChange('baseUnit', 'unidad');
    }
  };

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        barcode: product.barcode || '',
        categoryId: product.categoryId || '',
        defaultPrice: product.defaultPrice,
        priceSanAlas: product.priceSanAlas || '',
        priceEmpleados: product.priceEmpleados || '',
        cost: product.cost,
        imageUrl: product.imageUrl || '',
        baseUnit: product.baseUnit || 'unidad',
        baseStock: product.baseStock || '0',
        minStock: product.minStock || 0,
      });
      setPrices(product.prices.map(p => ({ priceListId: p.priceListId, price: p.price })));
      setPresentations(product.presentations || []);
      setShowPresentations(product.presentations && product.presentations.length > 0);
      setScanMode(false);
    } else {
      setFormData({
        name: '',
        barcode: '',
        categoryId: '',
        defaultPrice: '',
        priceSanAlas: '',
        priceEmpleados: '',
        cost: '',
        imageUrl: '',
        baseUnit: 'unidad',
        baseStock: '0',
        minStock: 0,
      });
      // Inicializar precios con listas existentes
      setPrices(priceLists.map(pl => ({ priceListId: pl.id, price: '' })));
      setPresentations([]);
      setShowPresentations(false);
      setScanMode(false);
    }
  }, [product, priceLists, open]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePriceChange = (priceListId: string, price: string) => {
    setPrices(prev => {
      const existing = prev.find(p => p.priceListId === priceListId);
      if (existing) {
        return prev.map(p => p.priceListId === priceListId ? { ...p, price } : p);
      }
      return [...prev, { priceListId, price }];
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const data = await api.upload<{ url: string }>('/uploads/product-image', file);
      handleChange('imageUrl', data.url);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleGenerateBarcode = async () => {
    setGeneratingBarcode(true);
    try {
      const data = await api.get<{ barcode: string }>('/inventory/generate-barcode');
      handleChange('barcode', data.barcode);
    } catch (error) {
      console.error('Error generating barcode:', error);
    } finally {
      setGeneratingBarcode(false);
    }
  };

  // ============ PRESENTACIONES ============
  const addPresentation = () => {
    setPresentations(prev => [...prev, {
      name: '',
      quantity: '',
      price: '',
      barcode: '',
      isDefault: prev.length === 0,
    }]);
  };

  const updatePresentation = (index: number, field: string, value: any) => {
    setPresentations(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const removePresentation = (index: number) => {
    setPresentations(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const data: any = {
      ...formData,
      minStock: Number(formData.minStock),
      prices: prices.filter(p => p.price),
      presentations: presentations.filter(p => p.name && p.quantity && p.price),
    };
    onSave(data);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {product ? 'Editar Producto' : 'Nuevo Producto'}
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={3}>
          {/* Imagen */}
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                border: '2px dashed',
                borderColor: formData.imageUrl ? 'success.main' : 'grey.300',
                borderRadius: 2,
                p: 2,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                height: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: formData.imageUrl ? 'grey.50' : 'transparent',
                position: 'relative',
                overflow: 'hidden',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {formData.imageUrl ? (
                <>
                  <Box
                    component="img"
                    src={getFullUrl(formData.imageUrl)}
                    onError={(e: any) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                    sx={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain' }}
                  />
                  <Box sx={{ display: 'none', flexDirection: 'column', alignItems: 'center' }}>
                    <ImageIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                    <Typography variant="body2" color="success.main">Imagen cargada</Typography>
                    <Typography variant="caption" color="text.secondary">Click para cambiar</Typography>
                  </Box>
                </>
              ) : (
                <>
                  {uploading ? (
                    <>
                      <CircularProgress size={40} sx={{ mb: 1 }} />
                      <Typography variant="body2" color="text.secondary">Subiendo...</Typography>
                    </>
                  ) : (
                    <>
                      <ImageIcon sx={{ fontSize: 64, color: 'grey.300', mb: 1 }} />
                      <Typography variant="body2" color="text.secondary" fontWeight="medium">
                        Agregar imagen
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        Click o arrastra aquí
                      </Typography>
                    </>
                  )}
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={handleImageUpload}
              />
            </Box>
          </Grid>

          {/* Info básica */}
          <Grid item xs={12} md={8}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Nombre del Producto *"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Ej: Cemento Argos 50kg"
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <FormControl fullWidth>
                    <InputLabel>Categoría</InputLabel>
                    <Select
                      value={formData.categoryId}
                      onChange={(e) => handleChange('categoryId', e.target.value)}
                      label="Categoría"
                    >
                      <MenuItem value="">Sin categoría</MenuItem>
                      {categories.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                            <span>{cat.name}</span>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditCategory(cat);
                              }}
                              sx={{ ml: 1 }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={onNewCategory}
                    sx={{ minWidth: 'auto', px: 2, height: 56 }}
                  >
                    <Add />
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Grid>

          {/* Código de barras */}
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              <QrCode2 sx={{ verticalAlign: 'middle', mr: 1 }} />
              Código de Barras
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                {/* Mensaje del escáner */}
                {scannerMessage ? (
                  <Alert 
                    severity="success" 
                    sx={{ mb: 2 }}
                    onClose={() => setScannerMessage(null)}
                  >
                    {scannerMessage}
                  </Alert>
                ) : scanMode ? (
                  <Alert 
                    severity="warning" 
                    sx={{ mb: 2, animation: 'pulse 1.5s infinite' }}
                    icon={<QrCode2 />}
                  >
                    🔫 <strong>MODO ESCANEO ACTIVO</strong> - Apunta la pistola al empaque del producto y escanea el código de barras de fábrica.
                  </Alert>
                ) : null}
                
                <TextField
                  fullWidth
                  label="Código de Barras"
                  value={formData.barcode}
                  onChange={(e) => handleChange('barcode', e.target.value)}
                  placeholder="Escanea o escribe el código del producto"
                  helperText={formData.barcode ? "✓ Código asociado a este producto" : "Usa 'Generar Código' para uno nuevo o 'Asociar Código' para uno existente"}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <QrCode2 />
                      </InputAdornment>
                    ),
                    endAdornment: formData.barcode ? (
                      <InputAdornment position="end">
                        <Tooltip title="Eliminar código de barras">
                          <IconButton
                            size="small"
                            onClick={() => handleChange('barcode', '')}
                            sx={{ color: 'error.main' }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ) : null,
                  }}
                />
                
                {/* Imagen del código de barras generado - solo si hay código */}
                {formData.barcode && formData.barcode.trim() !== '' && (
                  <Box 
                    sx={{ 
                      mt: 2, 
                      p: 2, 
                      bgcolor: '#e8f5e9', 
                      borderRadius: 1, 
                      border: '2px solid',
                      borderColor: 'success.main',
                      textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    <Typography variant="caption" sx={{ 
                      position: 'absolute', 
                      top: -10, 
                      left: 10, 
                      bgcolor: '#e8f5e9', 
                      px: 1,
                      color: 'success.dark',
                      fontWeight: 'bold'
                    }}>
                      ✓ Código Asociado
                    </Typography>
                    <Box
                      component="img"
                      src={`${API_BASE_URL}/api/barcodes/image/${formData.barcode}`}
                      alt={`Código de barras: ${formData.barcode}`}
                      onError={(e: any) => {
                        e.target.style.display = 'none';
                      }}
                      sx={{ 
                        maxWidth: '100%', 
                        height: 80,
                        objectFit: 'contain',
                      }}
                    />
                    <Typography variant="body2" fontFamily="monospace" fontWeight="bold" sx={{ mt: 1 }}>
                      {formData.barcode}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      Este código será reconocido por el escáner
                    </Typography>
                    {/* Botón eliminar */}
                    <Tooltip title="Eliminar código">
                      <IconButton
                        size="small"
                        onClick={() => handleChange('barcode', '')}
                        sx={{ 
                          position: 'absolute', 
                          top: 4, 
                          right: 4,
                          bgcolor: 'error.light',
                          color: 'white',
                          width: 28,
                          height: 28,
                          '&:hover': { bgcolor: 'error.main' },
                        }}
                      >
                        <Delete sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
              
              {/* Botones de acción */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Tooltip title="Generar un código de barras único para este producto">
                  <Button
                    variant="outlined"
                    onClick={handleGenerateBarcode}
                    disabled={generatingBarcode}
                    startIcon={generatingBarcode ? <CircularProgress size={20} /> : <QrCode2 />}
                    sx={{ minWidth: 180, height: 48 }}
                  >
                    Generar Código
                  </Button>
                </Tooltip>
                <Tooltip title="Escanea el código de un producto de fábrica para asociarlo">
                  <Button
                    variant={scanMode ? "contained" : "outlined"}
                    color="warning"
                    onClick={() => setScanMode(!scanMode)}
                    startIcon={<CameraAlt />}
                    sx={{ 
                      minWidth: 180, 
                      height: 48,
                      animation: scanMode ? 'pulse 1.5s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(237, 108, 2, 0.4)' },
                        '70%': { boxShadow: '0 0 0 10px rgba(237, 108, 2, 0)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(237, 108, 2, 0)' },
                      },
                    }}
                  >
                    {scanMode ? '⏳ Esperando...' : 'Asociar Código'}
                  </Button>
                </Tooltip>
              </Box>
            </Box>
          </Grid>

          {/* Stock y Unidades */}
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
              <Inventory2 sx={{ verticalAlign: 'middle', mr: 1 }} />
              Stock y Unidades
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={2.4}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <FormControl fullWidth>
                    <InputLabel>Unidad Base</InputLabel>
                    <Select
                      value={formData.baseUnit}
                      onChange={(e) => handleChange('baseUnit', e.target.value)}
                      label="Unidad Base"
                    >
                      {allUnits.map((unit) => (
                        <MenuItem key={unit.value} value={unit.value}>
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                            <span>{unit.label}</span>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingUnit(unit);
                                setNewUnitName(unit.label);
                                setUnitDialogOpen(true);
                              }}
                              sx={{ ml: 1 }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setEditingUnit(null);
                      setNewUnitName('');
                      setUnitDialogOpen(true);
                    }}
                    sx={{ minWidth: 'auto', px: 2, height: 56 }}
                  >
                    <Add />
                  </Button>
                </Box>
              </Grid>
              <Grid item xs={12} sm={2.4}>
                <TextField
                  fullWidth
                  label="Cantidad"
                  type="number"
                  value={formData.baseStock}
                  onChange={(e) => handleChange('baseStock', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={2.4}>
                <TextField
                  fullWidth
                  label="Precio de Compra"
                  value={formatNumber(formData.cost)}
                  onChange={(e) => handleChange('cost', parseNumber(e.target.value))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  label="Precio Público *"
                  value={formatNumber(formData.defaultPrice)}
                  onChange={(e) => handleChange('defaultPrice', parseNumber(e.target.value))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  label="Precio San Alas"
                  value={formatNumber(formData.priceSanAlas)}
                  onChange={(e) => handleChange('priceSanAlas', parseNumber(e.target.value))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  fullWidth
                  label="Precio Empleados"
                  value={formatNumber(formData.priceEmpleados)}
                  onChange={(e) => handleChange('priceEmpleados', parseNumber(e.target.value))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                {priceLists.filter(pl => !pl.isDefault).map((pl) => (
                  <TextField
                    key={pl.id}
                    fullWidth
                    label={`Precio ${pl.name}`}
                    value={formatNumber(prices.find(p => p.priceListId === pl.id)?.price || '')}
                    onChange={(e) => handlePriceChange(pl.id, parseNumber(e.target.value))}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                ))}
              </Grid>
            </Grid>
            {/* Stock Mínimo */}
            <TextField
              sx={{ mt: 2 }}
              size="small"
              label="Stock Mínimo (alerta)"
              type="number"
              value={formData.minStock}
              onChange={(e) => handleChange('minStock', Number(e.target.value))}
              helperText="Recibirás alerta cuando el stock baje de este valor"
            />
          </Grid>

          {/* Sistema de Precios y Venta */}
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                <AttachMoney sx={{ verticalAlign: 'middle', mr: 1 }} />
                Sistema de Precios y Venta
              </Typography>
              <Button
                size="small"
                startIcon={<AddCircleOutline />}
                onClick={addPresentation}
                color="primary"
              >
                Nueva Etiqueta
              </Button>
            </Box>
            
            {/* Etiquetas/Presentaciones */}
            {presentations.map((pres, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                <TextField
                  size="small"
                  label={formData.baseUnit.toUpperCase()}
                  placeholder="Etiqueta"
                  value={pres.name}
                  onChange={(e) => updatePresentation(index, 'name', e.target.value)}
                  sx={{ flex: 1.5 }}
                />
                <TextField
                  size="small"
                  label="Cantidad"
                  type="number"
                  value={pres.quantity}
                  onChange={(e) => updatePresentation(index, 'quantity', e.target.value)}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Precio Público"
                  value={formatNumber(pres.price)}
                  onChange={(e) => updatePresentation(index, 'price', parseNumber(e.target.value))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Precio San Alas"
                  value={formatNumber(pres.priceSanAlas || '')}
                  onChange={(e) => updatePresentation(index, 'priceSanAlas', parseNumber(e.target.value))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  label="Precio Empleados"
                  value={formatNumber(pres.priceEmpleados || '')}
                  onChange={(e) => updatePresentation(index, 'priceEmpleados', parseNumber(e.target.value))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  sx={{ flex: 1 }}
                />
                <IconButton color="error" onClick={() => removePresentation(index)} size="small">
                  <RemoveCircleOutline />
                </IconButton>
              </Box>
            ))}
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!formData.name || !formData.defaultPrice}>
          {product ? 'Guardar Cambios' : 'Crear Producto'}
        </Button>
      </DialogActions>

      {/* Unit Dialog */}
      <Dialog open={unitDialogOpen} onClose={() => setUnitDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {editingUnit ? 'Editar Unidad' : 'Nueva Unidad'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Nombre de la unidad"
            placeholder="Ej: Galón, Rollo, Saco..."
            value={newUnitName}
            onChange={(e) => setNewUnitName(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setUnitDialogOpen(false);
            setEditingUnit(null);
            setNewUnitName('');
          }}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleSaveUnit} disabled={!newUnitName.trim()}>
            {editingUnit ? 'Guardar' : 'Crear'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

// ============ CATEGORY DIALOG ============
interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; color?: string }) => void;
  category?: Category | null;
}

function CategoryDialog({ open, onClose, onSave, category }: CategoryDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  useEffect(() => {
    if (category) {
      setName(category.name);
      setColor(category.color || '#3B82F6');
    } else {
      setName('');
      setColor('#3B82F6');
    }
  }, [category, open]);

  const handleSubmit = () => {
    if (!name) return;
    onSave({ name, color });
    setName('');
    setColor('#3B82F6');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{category ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="Nombre de la Categoría"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mt: 2, mb: 2 }}
        />
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Color</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {colors.map((c) => (
            <Box
              key={c}
              onClick={() => setColor(c)}
              sx={{
                width: 36,
                height: 36,
                bgcolor: c,
                borderRadius: 1,
                cursor: 'pointer',
                border: color === c ? '3px solid black' : 'none',
              }}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!name}>
          {category ? 'Guardar' : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
