import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Grid,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Divider
} from '@mui/material';
import {
  QrCode,
  Print,
  Download,
  Add,
  Search,
  Refresh,
  ContentCopy,
  CheckCircle
} from '@mui/icons-material';

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  defaultPrice: string;
}

interface BarcodeTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  fontSize: number;
  includePrice: boolean;
  includeName: boolean;
}

const barcodeTemplates: BarcodeTemplate[] = [
  { id: 'small', name: 'Pequeño (30x20mm)', width: 30, height: 20, fontSize: 8, includePrice: true, includeName: false },
  { id: 'medium', name: 'Mediano (40x30mm)', width: 40, height: 30, fontSize: 10, includePrice: true, includeName: true },
  { id: 'large', name: 'Grande (50x40mm)', width: 50, height: 40, fontSize: 12, includePrice: true, includeName: true },
];

export default function Barcodes() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('medium');
  const [openGenerateDialog, setOpenGenerateDialog] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState<string>('');
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);

  // Mock data
  useEffect(() => {
    const mockProducts: Product[] = [
      { id: 'prod1', name: 'Coca Cola 600ml', sku: 'COC001', barcode: '7702000001234', defaultPrice: '3500' },
      { id: 'prod2', name: 'Papas Margarita', sku: 'PAP001', barcode: '7702000005678', defaultPrice: '2500' },
      { id: 'prod3', name: 'Agua Cristal 500ml', sku: 'AGU001', barcode: '7702000009012', defaultPrice: '1500' },
      { id: 'prod4', name: 'Detergente Ariel 1kg', sku: 'DET001', barcode: '7702000003456', defaultPrice: '8500' },
      { id: 'prod5', name: 'Galletas Oreo', sku: 'GAL001', barcode: '7702000007890', defaultPrice: '4200' },
    ];
    setProducts(mockProducts);
  }, []);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (product.barcode && product.barcode.includes(searchTerm))
  );

  const handleSelectProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === filteredProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map(p => p.id));
    }
  };

  const generateBarcode = () => {
    // Generate a random 13-digit EAN-13 barcode
    const prefix = '770'; // Country code for Colombia
    const company = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const product = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const partial = prefix + company + product;
    
    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(partial[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    
    return partial + checkDigit;
  };

  const handleGenerateNewBarcode = () => {
    const barcode = generateBarcode();
    setNewBarcode(barcode);
  };

  const handleAssignBarcode = () => {
    if (selectedProductForBarcode && newBarcode) {
      setProducts(prev => prev.map(product =>
        product.id === selectedProductForBarcode
          ? { ...product, barcode: newBarcode }
          : product
      ));
      setOpenCreateDialog(false);
      setNewBarcode('');
      setSelectedProductForBarcode('');
    }
  };

  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard.writeText(barcode);
    setCopiedBarcode(barcode);
    setTimeout(() => setCopiedBarcode(null), 2000);
  };

  const handlePrintBarcodes = () => {
    setOpenGenerateDialog(true);
  };

  const handleGeneratePrintFile = () => {
    // Here you would generate a PDF or send to printer
    console.log('Generating print file for products:', selectedProducts);
    console.log('Using template:', selectedTemplate);
    setOpenGenerateDialog(false);
  };

  const getProductsWithoutBarcode = () => {
    return products.filter(p => !p.barcode);
  };

  const getProductsWithBarcode = () => {
    return products.filter(p => p.barcode);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Códigos de Barras
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Genera y gestiona códigos de barras para productos
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setOpenCreateDialog(true)}
          >
            Crear Código
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            onClick={handlePrintBarcodes}
            disabled={selectedProducts.length === 0}
          >
            Imprimir ({selectedProducts.length})
          </Button>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <QrCode sx={{ color: 'primary.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {products.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Productos
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CheckCircle sx={{ color: 'success.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {getProductsWithBarcode().length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Con Código
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <QrCode sx={{ color: 'warning.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {getProductsWithoutBarcode().length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Sin Código
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Print sx={{ color: 'info.main', fontSize: 32 }} />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {selectedProducts.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Seleccionados
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Alerts */}
      {getProductsWithoutBarcode().length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Tienes {getProductsWithoutBarcode().length} productos sin código de barras.
          <Button
            size="small"
            onClick={() => setOpenCreateDialog(true)}
            sx={{ ml: 2 }}
          >
            Crear Códigos
          </Button>
        </Alert>
      )}

      {/* Search and Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleSelectAll}
              >
                {selectedProducts.length === filteredProducts.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
              </Button>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Plantilla</InputLabel>
                <Select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  label="Plantilla"
                >
                  {barcodeTemplates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <Grid container spacing={2}>
        {filteredProducts.map((product) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
            <Card
              sx={{
                cursor: 'pointer',
                border: selectedProducts.includes(product.id) ? 2 : 1,
                borderColor: selectedProducts.includes(product.id) ? 'primary.main' : 'divider',
                '&:hover': { boxShadow: 3 }
              }}
              onClick={() => handleSelectProduct(product.id)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>
                      {product.name}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      SKU: {product.sku || 'N/A'}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Precio: ${Number(product.defaultPrice).toLocaleString()}
                    </Typography>
                  </Box>
                  {selectedProducts.includes(product.id) && (
                    <CheckCircle sx={{ color: 'primary.main' }} />
                  )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {product.barcode ? (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        Código de Barras
                      </Typography>
                      <Chip label="Asignado" color="success" size="small" />
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1 }}>
                        {product.barcode}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyBarcode(product.barcode!);
                        }}
                      >
                        <ContentCopy fontSize="small" />
                      </IconButton>
                    </Box>
                    {copiedBarcode === product.barcode && (
                      <Typography variant="caption" color="success.main">
                        ¡Copiado!
                      </Typography>
                    )}
                  </Box>
                ) : (
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="caption" color="textSecondary">
                        Código de Barras
                      </Typography>
                      <Chip label="Sin Asignar" color="warning" size="small" />
                    </Box>
                    <Typography variant="body2" color="textSecondary">
                      No asignado
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Generate Print Dialog */}
      <Dialog open={openGenerateDialog} onClose={() => setOpenGenerateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Imprimir Códigos de Barras</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Se imprimirán códigos de barras para {selectedProducts.length} productos seleccionados.
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Plantilla de Etiqueta</InputLabel>
            <Select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              label="Plantilla de Etiqueta"
            >
              {barcodeTemplates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  <Box>
                    <Typography variant="body1">{template.name}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {template.width}×{template.height}mm - 
                      {template.includeName ? ' Con nombre' : ' Sin nombre'} - 
                      {template.includePrice ? ' Con precio' : ' Sin precio'}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Paper sx={{ p: 2, backgroundColor: 'grey.50' }}>
            <Typography variant="subtitle2" gutterBottom>
              Vista Previa de la Etiqueta
            </Typography>
            <Box
              sx={{
                border: '1px dashed',
                borderColor: 'grey.400',
                p: 1,
                textAlign: 'center',
                fontSize: '10px',
                fontFamily: 'monospace'
              }}
            >
              {barcodeTemplates.find(t => t.id === selectedTemplate)?.includeName && (
                <div>Nombre del Producto</div>
              )}
              <div>||||| |||| |||||</div>
              <div>1234567890123</div>
              {barcodeTemplates.find(t => t.id === selectedTemplate)?.includePrice && (
                <div>$0,000</div>
              )}
            </Box>
          </Paper>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenGenerateDialog(false)}>Cancelar</Button>
          <Button onClick={handleGeneratePrintFile} variant="contained" startIcon={<Print />}>
            Generar e Imprimir
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Barcode Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Crear Código de Barras</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Producto</InputLabel>
                <Select
                  value={selectedProductForBarcode}
                  onChange={(e) => setSelectedProductForBarcode(e.target.value)}
                  label="Producto"
                >
                  {getProductsWithoutBarcode().map((product) => (
                    <MenuItem key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  label="Código de Barras"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  placeholder="Ingresa o genera un código"
                />
                <Button
                  variant="outlined"
                  onClick={handleGenerateNewBarcode}
                  startIcon={<Refresh />}
                >
                  Generar
                </Button>
              </Box>
            </Grid>
            {newBarcode && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: 'grey.50' }}>
                  <Typography variant="caption" color="textSecondary">
                    Vista Previa
                  </Typography>
                  <Box sx={{ fontFamily: 'monospace', fontSize: '14px', mt: 1 }}>
                    ||||| |||| |||||
                  </Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {newBarcode}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancelar</Button>
          <Button
            onClick={handleAssignBarcode}
            variant="contained"
            disabled={!selectedProductForBarcode || !newBarcode}
          >
            Asignar Código
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
