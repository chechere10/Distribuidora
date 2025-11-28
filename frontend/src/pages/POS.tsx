import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { api } from '../api';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { 
  Box, 
  Button, 
  Typography, 
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
  alpha,
  useTheme,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Tooltip,
  Divider
} from '@mui/material';
import ReceiptDialog from '../components/ReceiptDialog';

// Utility functions for number formatting
const formatNumber = (value: string | number): string => {
  if (!value && value !== 0) return '';
  const numStr = String(value).replace(/\D/g, '');
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

type Presentation = {
  id: string;
  name: string;
  quantity: string;
  price: string;
  priceSanAlas?: string;
  priceEmpleados?: string;
};

type Product = { 
  id: string; 
  name: string; 
  barcode?: string | null; 
  defaultPrice: string;
  priceSanAlas?: string | null;
  priceEmpleados?: string | null;
  cost?: string;
  imageUrl?: string | null;
  baseUnit?: string;
  baseStock?: string;
  categoryId?: string;
  category?: { id: string; name: string; color?: string };
  presentations?: Presentation[];
  prices?: Array<{ priceListId: string; price: string; priceList: { id: string; name: string; isDefault: boolean } }>;
};

type Category = {
  id: string;
  name: string;
  color?: string;
};

type CartItem = {
  product: Product;
  presentation?: Presentation;
  quantity: number;
  unitPrice: number;
  stockQuantity: number;
  priceType: 'publico' | 'sanAlas' | 'empleados';
};

export default function POS() {
  const theme = useTheme();
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'transferencia' | 'fiado'>('efectivo');
  
  // Fiado dialog state
  const [showFiadoDialog, setShowFiadoDialog] = useState(false);
  const [fiadoCustomerName, setFiadoCustomerName] = useState('');
  const [fiadoCustomerPhone, setFiadoCustomerPhone] = useState('');
  const [fiadoNotes, setFiadoNotes] = useState('');
  const [fiadoDueDate, setFiadoDueDate] = useState('');
  const [priceType, setPriceType] = useState<'publico' | 'sanAlas' | 'empleados'>('publico');
  
  // Payment state
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });
  
  // Domicilio state
  const [includeDomicilio, setIncludeDomicilio] = useState(false);
  const [domicilioPrice, setDomicilioPrice] = useState<string>('');
  
  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Receipt dialog state
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [completedSale, setCompletedSale] = useState<any>(null);
  
  // Stock alert state
  const [stockAlert, setStockAlert] = useState<{ show: boolean; message: string; severity: 'error' | 'warning' | 'info' }>({ show: false, message: '', severity: 'error' });
  
  // Cash closure state
  const [showCashCloseDialog, setShowCashCloseDialog] = useState(false);
  const [cashCloseEmail, setCashCloseEmail] = useState('');
  const [cashClosePassword, setCashClosePassword] = useState('');
  const [cashCloseBilletes, setCashCloseBilletes] = useState('');
  const [cashCloseMonedas, setCashCloseMonedas] = useState('');
  const [cashCloseNotes, setCashCloseNotes] = useState('');
  const [cashCloseError, setCashCloseError] = useState('');
  const [cashCloseSummary, setCashCloseSummary] = useState<any>(null);
  const [showCashCloseSummary, setShowCashCloseSummary] = useState(false);
  
  // Barcode scanner state
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const [showScannerTest, setShowScannerTest] = useState(false);
  
  // Ref para scroll automático del carrito
  const cartScrollRef = useRef<HTMLDivElement>(null);
  
  // Función para manejar el escaneo de código de barras
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    try {
      // Tipo extendido que puede incluir presentación escaneada
      type ProductWithScannedPresentation = Product & {
        scannedPresentation?: Presentation;
      };
      
      const product = await api.get<ProductWithScannedPresentation>(`/products/barcode/${barcode}`);
      
      if (product) {
        // Calcular precio según tipo seleccionado
        const basePrice = priceType === 'publico' 
          ? Number(product.defaultPrice) 
          : (product.prices?.find(p => !p.priceList.isDefault)?.price 
            ? Number(product.prices.find(p => !p.priceList.isDefault)!.price) 
            : Number(product.defaultPrice));
        
        // Verificar stock
        const availableStock = Number(product.baseStock || 0);
        if (availableStock <= 0) {
          setScannerMessage(`⚠️ "${product.name}" está AGOTADO`);
          setTimeout(() => setScannerMessage(null), 3000);
          return;
        }
        
        // Si se escaneó una presentación específica
        const presentation = product.scannedPresentation;
        
        // Agregar al carrito
        setCartItems(prev => {
          const existingIndex = prev.findIndex(item => {
            if (presentation) {
              return item.product.id === product.id && item.presentation?.id === presentation.id;
            }
            return item.product.id === product.id && !item.presentation;
          });

          if (existingIndex >= 0) {
            // Incrementar cantidad
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              quantity: updated[existingIndex].quantity + 1
            };
            return updated;
          } else {
            // Agregar nuevo item
            let unitPrice: number;
            let stockQuantity: number;

            if (presentation) {
              // Usar el precio según el tipo seleccionado
              switch (priceType) {
                case 'sanAlas':
                  unitPrice = Number(presentation.priceSanAlas || presentation.price);
                  break;
                case 'empleados':
                  unitPrice = Number(presentation.priceEmpleados || presentation.price);
                  break;
                default:
                  unitPrice = Number(presentation.price);
              }
              stockQuantity = Number(presentation.quantity);
            } else {
              unitPrice = basePrice;
              stockQuantity = 1;
            }

            return [...prev, {
              product,
              presentation,
              quantity: 1,
              unitPrice,
              stockQuantity,
              priceType
            }];
          }
        });
        
        // Mostrar mensaje de éxito
        const msg = presentation 
          ? `✅ ${product.name} (${presentation.name}) agregado`
          : `✅ ${product.name} agregado`;
        setScannerMessage(msg);
        setTimeout(() => setScannerMessage(null), 2000);
      }
    } catch (error: any) {
      console.error('❌ Error buscando producto:', error);
      setScannerMessage(`❌ Código ${barcode} no encontrado`);
      setTimeout(() => setScannerMessage(null), 3000);
    }
  }, [priceType]);

  // Hook del escáner de código de barras - SIEMPRE ACTIVO
  const { buffer: scannerBuffer, lastScan, scannerActive } = useBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: true,
    allowInputFocus: true, // Permitir escaneo incluso en inputs
  });

  useEffect(() => {
    api.get<Array<{ id: string; name: string }>>('/warehouses').then(ws => {
      setWarehouses(ws);
      if (ws[0]) setWarehouseId(ws[0].id);
    });
    loadCategories();
    loadProducts();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await api.get<Category[]>('/categories');
      setCategories(cats);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadProducts = async () => {
    try {
      const allProducts = await api.get<Product[]>('/products');
      setProducts(allProducts);
      setFilteredProducts(allProducts);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  useEffect(() => {
    if (selectedCategory) {
      const filtered = products.filter(product => 
        product.categoryId === selectedCategory || 
        product.category?.id === selectedCategory
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [selectedCategory, products]);

  const parseNumber = (value: string): number => {
    return Number(value.replace(/\./g, '')) || 0;
  };

  const total = useMemo(() => {
    const productsTotal = cartItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
    const domicilioNum = includeDomicilio ? parseNumber(domicilioPrice) : 0;
    return productsTotal + domicilioNum;
  }, [cartItems, includeDomicilio, domicilioPrice]);
  
  const productsSubtotal = useMemo(() => cartItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0), [cartItems]);

  const getImageUrl = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return null;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${location.origin.replace(':5173', ':3001')}${imageUrl}`;
  };

  const getSanAlasPrice = (product: Product): number => {
    // Primero intentar con el precio base de San Alas
    if (product.priceSanAlas) {
      return Number(product.priceSanAlas);
    }
    // Fallback a lista de precios
    const sanAlasPrice = product.prices?.find(p => !p.priceList.isDefault);
    return sanAlasPrice ? Number(sanAlasPrice.price) : Number(product.defaultPrice);
  };

  const getEmpleadosPrice = (product: Product): number => {
    // Primero intentar con el precio base de Empleados
    if (product.priceEmpleados) {
      return Number(product.priceEmpleados);
    }
    // Fallback a San Alas, luego a precio por defecto
    return getSanAlasPrice(product);
  };

  // Obtener precio según tipo de precio seleccionado
  const getPriceByType = (product: Product, presentation?: Presentation): number => {
    if (presentation) {
      switch (priceType) {
        case 'sanAlas':
          return Number(presentation.priceSanAlas || presentation.price);
        case 'empleados':
          return Number(presentation.priceEmpleados || presentation.price);
        default:
          return Number(presentation.price);
      }
    } else {
      switch (priceType) {
        case 'sanAlas':
          return getSanAlasPrice(product);
        case 'empleados':
          return getEmpleadosPrice(product);
        default:
          return Number(product.defaultPrice);
      }
    }
  };

  const handleProductClick = (product: Product) => {
    // Agregar directo al carrito con precio base
    addToCart(product);
  };

  // Función helper para mostrar alerta de stock
  const showStockAlert = (message: string, severity: 'error' | 'warning' | 'info' = 'error') => {
    setStockAlert({ show: true, message, severity });
  };

  // Verificar stock disponible de un producto
  const getAvailableStock = (product: Product): number => {
    return Number(product.baseStock || 0);
  };

  // Calcular cuánto stock se necesita para una cantidad
  const getRequiredStock = (product: Product, presentation: Presentation | undefined, quantity: number): number => {
    if (presentation) {
      return Number(presentation.quantity) * quantity;
    }
    return quantity;
  };

  // Verificar si hay stock suficiente
  const hasEnoughStock = (product: Product, presentation: Presentation | undefined, additionalQuantity: number = 1): boolean => {
    const availableStock = getAvailableStock(product);
    
    // Buscar si ya está en el carrito
    const existingItem = cartItems.find(item => {
      if (presentation) {
        return item.product.id === product.id && item.presentation?.id === presentation.id;
      }
      return item.product.id === product.id && !item.presentation;
    });
    
    const currentQuantityInCart = existingItem ? existingItem.quantity : 0;
    const totalQuantity = currentQuantityInCart + additionalQuantity;
    const requiredStock = getRequiredStock(product, presentation, totalQuantity);
    
    return availableStock >= requiredStock;
  };

  const addToCart = (product: Product, presentation?: Presentation) => {
    // Validar stock disponible
    const availableStock = getAvailableStock(product);
    
    if (availableStock <= 0) {
      showStockAlert(`⚠️ "${product.name}" está AGOTADO. Stock: 0 ${product.baseUnit || 'unidades'}`, 'error');
      return;
    }
    
    // Verificar si hay stock suficiente para agregar uno más
    if (!hasEnoughStock(product, presentation, 1)) {
      const existingItem = cartItems.find(item => {
        if (presentation) {
          return item.product.id === product.id && item.presentation?.id === presentation.id;
        }
        return item.product.id === product.id && !item.presentation;
      });
      const currentInCart = existingItem ? existingItem.quantity : 0;
      showStockAlert(
        `⚠️ Stock insuficiente para "${product.name}". Disponible: ${availableStock} ${product.baseUnit || 'unidades'}, En carrito: ${currentInCart}`,
        'warning'
      );
      return;
    }
    
    let unitPrice: number;
    let stockQuantity: number;

    if (presentation) {
      unitPrice = getPriceByType(product, presentation);
      stockQuantity = Number(presentation.quantity);
    } else {
      unitPrice = getPriceByType(product);
      stockQuantity = 1;
    }

    setCartItems(prev => {
      const existingIndex = prev.findIndex(item => {
        if (presentation) {
          return item.product.id === product.id && item.presentation?.id === presentation.id;
        }
        return item.product.id === product.id && !item.presentation;
      });

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 1
        };
        return updated;
      } else {
        return [...prev, {
          product,
          presentation,
          quantity: 1,
          unitPrice,
          stockQuantity,
          priceType
        }];
      }
    });
    
    // Auto-scroll al final del carrito después de agregar
    setTimeout(() => {
      if (cartScrollRef.current) {
        cartScrollRef.current.scrollTop = cartScrollRef.current.scrollHeight;
      }
    }, 50);
  };

  // Función para buscar producto por código de barras (para uso manual desde el input)
  const searchProductByBarcode = async (barcode: string) => {
    handleBarcodeScan(barcode);
  };

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(index);
    } else {
      // Validar stock antes de actualizar cantidad
      const item = cartItems[index];
      const requiredStock = getRequiredStock(item.product, item.presentation, newQuantity);
      const availableStock = getAvailableStock(item.product);
      
      if (requiredStock > availableStock) {
        showStockAlert(
          `⚠️ Stock insuficiente para "${item.product.name}". Disponible: ${availableStock} ${item.product.baseUnit || 'unidades'}`,
          'warning'
        );
        return;
      }
      
      setCartItems(prev => prev.map((item, i) => 
        i === index ? { ...item, quantity: newQuantity } : item
      ));
    }
  };

  const removeItem = (index: number) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCartItems([]);
    setCashReceived('');
    setIncludeDomicilio(false);
    setDomicilioPrice('');
    setShowConfirmDialog(false);
  };

  // Recalcular precios cuando cambia el tipo de precio (Público/San Alas/Empleados)
  useEffect(() => {
    if (cartItems.length === 0) return;
    
    setCartItems(prev => prev.map(item => {
      const newUnitPrice = getPriceByType(item.product, item.presentation);
      
      return {
        ...item,
        unitPrice: newUnitPrice,
        priceType
      };
    }));
  }, [priceType]);

  const cashReceivedNum = parseNumber(cashReceived);
  const change = cashReceivedNum - total;

  const checkout = async () => {
    if (!warehouseId || cartItems.length === 0) return;
    if (paymentMethod === 'efectivo' && cashReceivedNum < total) return;
    
    setIsProcessing(true);
    try {
      // Guardar datos del carrito antes de limpiar
      const saleItems = cartItems.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        presentationId: item.presentation?.id,
        presentationName: item.presentation?.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.quantity * item.unitPrice
      }));
      
      const domicilioNum = includeDomicilio ? parseNumber(domicilioPrice) : 0;
      
      const payload = { 
        warehouseId, 
        items: cartItems.map(item => ({ 
          productId: item.product.id, 
          presentationId: item.presentation?.id,
          quantity: item.quantity, 
          unitPrice: item.unitPrice.toFixed(2),
          stockQuantity: item.stockQuantity * item.quantity
        })),
        paymentMethod,
        priceType,
        cashReceived: paymentMethod === 'efectivo' ? cashReceivedNum : null,
        change: paymentMethod === 'efectivo' ? change : null,
        domicilioPrice: domicilioNum
      };
      
      const sale = await api.post<{ id: string; saleNumber: number; total: number }>('/sales', payload);
      
      // Crear objeto de venta completada para mostrar el recibo
      const completedSaleData = {
        id: sale.id,
        saleNumber: sale.saleNumber,
        total: total,
        subtotal: productsSubtotal,
        domicilio: domicilioNum > 0 ? domicilioNum : null,
        createdAt: new Date().toISOString(),
        paymentMethod,
        priceType,
        cashReceived: paymentMethod === 'efectivo' ? cashReceivedNum : null,
        change: paymentMethod === 'efectivo' ? change : null,
        items: saleItems,
        warehouse: warehouses.find(w => w.id === warehouseId)
      };
      
      setCompletedSale(completedSaleData);
      setShowReceiptDialog(true);
      clearCart();
    } catch (error) {
      console.error('Error processing sale:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const createFiado = async () => {
    if (!warehouseId || cartItems.length === 0 || !fiadoCustomerName.trim()) return;
    
    setIsProcessing(true);
    try {
      const payload = {
        warehouseId,
        customerName: fiadoCustomerName.trim(),
        customerPhone: fiadoCustomerPhone.trim() || undefined,
        notes: fiadoNotes.trim() || undefined,
        dueDate: fiadoDueDate || undefined,
        priceType,
        items: cartItems.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          presentationId: item.presentation?.id || undefined,
          presentationName: item.presentation?.name || undefined,
          quantity: item.quantity,
          baseQuantity: item.stockQuantity * item.quantity,
          unitPrice: item.unitPrice
        }))
      };
      
      await api.post('/orders', payload);
      
      // Refrescar productos para actualizar stock
      const fetchProducts = async () => {
        try {
          const res = await api.get<Product[]>('/products?includeStock=true');
          setProducts(res);
          setFilteredProducts(res);
        } catch (err) {
          console.error('Error refetching products:', err);
        }
      };
      await fetchProducts();
      
      clearCart();
      setShowFiadoDialog(false);
      setFiadoCustomerName('');
      setFiadoCustomerPhone('');
      setFiadoNotes('');
      setFiadoDueDate('');
      setSnackbar({ open: true, message: `✅ Fiado registrado para ${fiadoCustomerName}`, severity: 'success' });
    } catch (error: any) {
      console.error('Error creating fiado:', error);
      setSnackbar({ open: true, message: error.response?.data?.error || 'Error al crear el fiado', severity: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Función para cerrar caja
  const handleCashClose = async () => {
    const totalBilletes = parseNumber(cashCloseBilletes);
    const totalMonedas = parseNumber(cashCloseMonedas);
    const totalEfectivo = totalBilletes + totalMonedas;
    
    if (!cashCloseEmail || !cashClosePassword || totalEfectivo === 0) {
      setCashCloseError('Complete todos los campos requeridos (email, contraseña y conteo de efectivo)');
      return;
    }
    
    setIsProcessing(true);
    setCashCloseError('');
    
    try {
      const result = await api.post('/cash/close', {
        warehouseId,
        closingAmount: String(totalEfectivo),
        billetes: totalBilletes,
        monedas: totalMonedas,
        userEmail: cashCloseEmail,
        password: cashClosePassword,
        notes: cashCloseNotes || undefined
      });
      
      setCashCloseSummary({
        ...(result as object),
        billetes: totalBilletes,
        monedas: totalMonedas
      });
      setShowCashCloseDialog(false);
      setShowCashCloseSummary(true);
      
      // Limpiar formulario
      setCashCloseEmail('');
      setCashClosePassword('');
      setCashCloseBilletes('');
      setCashCloseMonedas('');
      setCashCloseNotes('');
    } catch (error: any) {
      console.error('Error closing cash:', error);
      setCashCloseError(error.response?.data?.message || 'Error al cerrar caja');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h5" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
              Punto de Venta
            </Typography>
            {/* Scanner message indicator */}
            {scannerMessage && (
              <Typography 
                variant="body2" 
                sx={{ 
                  textAlign: 'center', 
                  mt: 0.5,
                  color: scannerMessage.startsWith('✅') ? 'success.main' : 'error.main',
                  fontWeight: 600,
                  animation: 'fadeIn 0.3s ease-in'
                }}
              >
                {scannerMessage}
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, alignItems: 'center' }}>
            {/* Scanner Status Indicator */}
            <Tooltip title={showScannerTest ? "Cerrar prueba de escáner" : "Probar escáner"}>
              <Chip
                icon={scannerActive ? <span>📡</span> : <span>📷</span>}
                label={scannerActive ? `Leyendo: ${scannerBuffer}` : (lastScan ? `Último: ${lastScan}` : 'Escáner')}
                color={scannerActive ? 'warning' : (lastScan ? 'success' : 'default')}
                variant={scannerActive ? 'filled' : 'outlined'}
                onClick={() => setShowScannerTest(!showScannerTest)}
                sx={{ 
                  fontWeight: 'bold',
                  animation: scannerActive ? 'pulse 0.5s infinite' : 'none',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.6 },
                    '100%': { opacity: 1 },
                  }
                }}
              />
            </Tooltip>
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => setShowCashCloseDialog(true)}
              sx={{ fontWeight: 'bold' }}
            >
              🔒 CERRAR CAJA
            </Button>
            <Chip 
              label={`${cartItems.length} productos`} 
              color="primary" 
              variant="outlined" 
            />
          </Grid>
        </Grid>
      </Box>

      <Grid container sx={{ flexGrow: 1, height: 'calc(100vh - 80px)' }}>
        {/* Left Panel - Categories and Products */}
        <Grid item xs={12} md={5} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Barcode Search + Categories Selector */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            {/* Barcode manual search */}
            <TextField
              fullWidth
              size="small"
              placeholder="🔍 Escanea o escribe código de barras..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.target as HTMLInputElement;
                  if (input.value.trim()) {
                    searchProductByBarcode(input.value.trim());
                    input.value = '';
                  }
                }
              }}
              sx={{ mb: 1.5 }}
              InputProps={{
                sx: { bgcolor: 'grey.50' }
              }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Categoría</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Categoría"
              >
                <MenuItem value="">Todas las categorías</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Products Grid */}
          <Box sx={{ flexGrow: 1, p: 2, overflow: 'auto' }}>
            <Box 
              sx={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 2,
              }}
            >
              {filteredProducts.map((product) => {
                const stock = Number(product.baseStock || 0);
                const isOutOfStock = stock <= 0;
                const isLowStock = !isOutOfStock && stock <= 5;
                
                return (
                <Card 
                  key={product.id}
                  sx={{ 
                    cursor: isOutOfStock ? 'not-allowed' : 'pointer', 
                    aspectRatio: '1 / 1',
                    borderRadius: 2,
                    border: '2px solid',
                    borderColor: isOutOfStock ? 'error.main' : isLowStock ? 'warning.main' : 'grey.200',
                    transition: 'all 0.2s ease',
                    opacity: isOutOfStock ? 0.5 : 1,
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    '&:hover': isOutOfStock ? {} : { 
                      boxShadow: 4,
                      transform: 'translateY(-2px)',
                      borderColor: 'primary.main'
                    }
                  }}
                  onClick={() => handleProductClick(product)}
                >
                  {/* Icono de alerta pequeño en esquina */}
                  {(isOutOfStock || isLowStock) && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: isOutOfStock ? 'error.main' : 'warning.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2,
                        fontSize: '10px',
                      }}
                    >
                      ⚠️
                    </Box>
                  )}
                  
                  {/* Product Image - ocupa casi todo */}
                  <Box
                    sx={{
                      flex: 1,
                      backgroundColor: isOutOfStock ? 'grey.300' : 'grey.50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      minHeight: 0,
                    }}
                  >
                    {product.imageUrl ? (
                      <img
                        src={getImageUrl(product.imageUrl) || ''}
                        alt={product.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          filter: isOutOfStock ? 'grayscale(100%)' : 'none'
                        }}
                      />
                    ) : (
                      <Typography sx={{ fontSize: '3.5rem', filter: isOutOfStock ? 'grayscale(100%)' : 'none' }}>📦</Typography>
                    )}
                  </Box>
                  
                  {/* Nombre pequeño abajo */}
                  <Box sx={{ 
                    px: 0.5, 
                    py: 0.3, 
                    textAlign: 'center', 
                    backgroundColor: isOutOfStock ? 'grey.200' : 'white',
                    borderTop: '1px solid',
                    borderColor: 'grey.200'
                  }}>
                    <Typography 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.65rem',
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: isOutOfStock ? 'text.disabled' : 'text.primary',
                      }}
                    >
                      {product.name}
                    </Typography>
                  </Box>
                </Card>
              )})}
            </Box>
          </Box>
        </Grid>

        {/* Right Panel - Cart */}
        <Grid item xs={12} md={7} sx={{ height: '100%', borderLeft: 1, borderColor: 'divider' }}>
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Cart Header */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  🛒 Carrito de Venta
                </Typography>
                {cartItems.length > 0 && (
                  <Button variant="text" color="error" onClick={clearCart} size="small">
                    Limpiar
                  </Button>
                )}
              </Box>
              <Chip 
                label={priceType === 'publico' ? '💰 Precio Público' : priceType === 'sanAlas' ? '🏪 Precio San Alas' : '👷 Precio Empleados'} 
                size="small" 
                color={priceType === 'publico' ? 'primary' : priceType === 'sanAlas' ? 'success' : 'secondary'}
                sx={{ mt: 1 }}
              />
            </Box>

            {/* Cart Items */}
            <Box ref={cartScrollRef} sx={{ flexGrow: 1, overflow: 'auto', p: 1, maxHeight: 280 }}>
              {cartItems.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ mb: 1 }}>🛒</Typography>
                  <Typography variant="h6" color="text.secondary">
                    Carrito Vacío
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Selecciona productos para comenzar
                  </Typography>
                </Box>
              ) : (
                <Box>
                  {/* Header row */}
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1.5fr 1.2fr 0.8fr 0.8fr 1fr', 
                    gap: 1, 
                    mb: 1, 
                    px: 1,
                    pb: 1,
                    borderBottom: '1px solid',
                    borderColor: 'grey.300'
                  }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      PRODUCTO
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textAlign: 'center' }}>
                      PRESENTACIÓN
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textAlign: 'center' }}>
                      PRECIO/U
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textAlign: 'center' }}>
                      CANT
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textAlign: 'right' }}>
                      TOTAL
                    </Typography>
                  </Box>
                  
                  {/* Cart items */}
                  {cartItems.map((item, idx) => (
                    <Box 
                      key={`${item.product.id}-${item.presentation?.id || 'base'}-${idx}`} 
                      sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: '1.5fr 1.2fr 0.8fr 0.8fr 1fr', 
                        gap: 1, 
                        alignItems: 'center',
                        py: 1.5,
                        px: 1,
                        borderBottom: '1px solid',
                        borderColor: 'grey.100',
                        '&:hover': { backgroundColor: 'grey.50' }
                      }}
                    >
                      {/* Product name + image */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          src={getImageUrl(item.product.imageUrl) || undefined}
                          sx={{ width: 36, height: 36, borderRadius: 1 }}
                        >
                          📦
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                            {item.product.name}
                          </Typography>
                        </Box>
                      </Box>
                      
                      {/* Presentation selector */}
                      <Box>
                        {item.product.presentations && item.product.presentations.length > 0 ? (
                          <FormControl size="small" fullWidth>
                            <Select
                              value={item.presentation?.id || `base-${item.product.baseUnit}`}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value.startsWith('base-')) {
                                  // Venta por unidad base
                                  const newUnitPrice = getPriceByType(item.product);
                                  setCartItems(prev => prev.map((ci, i) => 
                                    i === idx ? { 
                                      ...ci, 
                                      presentation: undefined, 
                                      unitPrice: newUnitPrice,
                                      stockQuantity: 1
                                    } : ci
                                  ));
                                } else {
                                  // Venta por presentación
                                  const pres = item.product.presentations?.find(p => p.id === value);
                                  if (pres) {
                                    const newUnitPrice = getPriceByType(item.product, pres);
                                    setCartItems(prev => prev.map((ci, i) => 
                                      i === idx ? { 
                                        ...ci, 
                                        presentation: pres, 
                                        unitPrice: newUnitPrice,
                                        stockQuantity: Number(pres.quantity)
                                      } : ci
                                    ));
                                  }
                                }
                              }}
                              sx={{ 
                                fontSize: '0.75rem',
                                '& .MuiSelect-select': { py: 0.5 }
                              }}
                            >
                              <MenuItem value={`base-${item.product.baseUnit}`}>
                                Por {item.product.baseUnit || 'unidad'}
                              </MenuItem>
                              {item.product.presentations.map(pres => (
                                <MenuItem key={pres.id} value={pres.id}>
                                  {pres.name} ({pres.quantity} {item.product.baseUnit})
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Por {item.product.baseUnit || 'unidad'}
                          </Typography>
                        )}
                      </Box>
                      
                      {/* Price per unit */}
                      <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.secondary', fontSize: '0.8rem' }}>
                        ${formatNumber(item.unitPrice)}
                      </Typography>
                      
                      {/* Quantity controls */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.25 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => updateQuantity(idx, item.quantity - 1)}
                          sx={{ minWidth: 24, height: 24, p: 0, fontSize: '0.9rem' }}
                        >
                          -
                        </Button>
                        <Typography sx={{ fontWeight: 'bold', minWidth: 20, textAlign: 'center', fontSize: '0.85rem' }}>
                          {item.quantity}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => updateQuantity(idx, item.quantity + 1)}
                          sx={{ minWidth: 24, height: 24, p: 0, fontSize: '0.9rem' }}
                        >
                          +
                        </Button>
                      </Box>
                      
                      {/* Total + delete */}
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '0.85rem' }}>
                          ${formatNumber(item.quantity * item.unitPrice)}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => removeItem(idx)}
                          color="error"
                          sx={{ p: 0.25 }}
                        >
                          🗑️
                        </IconButton>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Payment and Total - Diseño Profesional */}
            <Box sx={{ 
              p: 2, 
              borderTop: 2, 
              borderColor: 'primary.main', 
              backgroundColor: '#fafafa'
            }}>
              {/* Row 1: Tipo de Venta + Domicilio */}
              <Grid container spacing={1} sx={{ mb: 1.5 }}>
                <Grid item xs={8}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                    TIPO DE VENTA
                  </Typography>
                  <ToggleButtonGroup
                    value={priceType}
                    exclusive
                    onChange={(_, newType) => {
                      if (newType !== null) setPriceType(newType);
                    }}
                    size="small"
                    fullWidth
                    sx={{ 
                      '& .MuiToggleButton-root': { 
                        py: 1,
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        borderWidth: 2,
                        '&.Mui-selected': {
                          borderWidth: 2
                        }
                      }
                    }}
                  >
                    <ToggleButton 
                      value="publico" 
                      sx={{ 
                        '&.Mui-selected': { 
                          backgroundColor: alpha(theme.palette.primary.main, 0.15),
                          borderColor: 'primary.main',
                          color: 'primary.main'
                        }
                      }}
                    >
                      🏪 PÚBLICO
                    </ToggleButton>
                    <ToggleButton 
                      value="sanAlas" 
                      sx={{ 
                        '&.Mui-selected': { 
                          backgroundColor: alpha(theme.palette.success.main, 0.15),
                          borderColor: 'success.main',
                          color: 'success.main'
                        }
                      }}
                    >
                      🍗 SAN ALAS
                    </ToggleButton>
                    <ToggleButton 
                      value="empleados" 
                      sx={{ 
                        '&.Mui-selected': { 
                          backgroundColor: alpha(theme.palette.secondary.main, 0.15),
                          borderColor: 'secondary.main',
                          color: 'secondary.main'
                        }
                      }}
                    >
                      👷 EMPLEADOS
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                    DOMICILIO
                  </Typography>
                  <ToggleButton
                    value="domicilio"
                    selected={includeDomicilio}
                    onChange={() => setIncludeDomicilio(!includeDomicilio)}
                    size="small"
                    fullWidth
                    sx={{ 
                      py: 1,
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      borderWidth: 2,
                      borderColor: includeDomicilio ? 'warning.main' : 'grey.400',
                      backgroundColor: includeDomicilio ? alpha(theme.palette.warning.main, 0.15) : 'transparent',
                      color: includeDomicilio ? 'warning.dark' : 'text.secondary',
                      '&:hover': {
                        backgroundColor: alpha(theme.palette.warning.main, 0.1)
                      }
                    }}
                  >
                    🚚 +DOMICILIO
                  </ToggleButton>
                </Grid>
              </Grid>

              {/* Domicilio Price Input */}
              {includeDomicilio && (
                <Box sx={{ mb: 1.5 }}>
                  <TextField
                    fullWidth
                    label="🚚 Precio del Domicilio"
                    value={domicilioPrice}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setDomicilioPrice(formatNumber(value));
                    }}
                    placeholder="Ej: 3.000"
                    size="small"
                    InputProps={{
                      sx: { fontSize: '1rem', fontWeight: 'bold', backgroundColor: 'white' },
                      startAdornment: <Typography sx={{ mr: 1, color: 'warning.main' }}>$</Typography>
                    }}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { borderColor: 'warning.main', borderWidth: 2 }
                      }
                    }}
                  />
                </Box>
              )}

              {/* Row 2: Método de Pago */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block', fontWeight: 600 }}>
                  MÉTODO DE PAGO
                </Typography>
                <ToggleButtonGroup
                  value={paymentMethod}
                  exclusive
                  onChange={(_, newPayment) => {
                    if (newPayment !== null) setPaymentMethod(newPayment);
                  }}
                  size="small"
                  fullWidth
                  sx={{ 
                    '& .MuiToggleButton-root': { 
                      py: 0.8,
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      borderWidth: 2
                    }
                  }}
                >
                  <ToggleButton 
                    value="efectivo" 
                    sx={{ 
                      '&.Mui-selected': { 
                        backgroundColor: alpha(theme.palette.success.main, 0.15),
                        borderColor: 'success.main',
                        color: 'success.dark'
                      }
                    }}
                  >
                    💵 EFECTIVO
                  </ToggleButton>
                  <ToggleButton 
                    value="transferencia"
                    sx={{ 
                      '&.Mui-selected': { 
                        backgroundColor: alpha(theme.palette.info.main, 0.15),
                        borderColor: 'info.main',
                        color: 'info.dark'
                      }
                    }}
                  >
                    💳 TRANSFERENCIA
                  </ToggleButton>
                  <ToggleButton 
                    value="fiado"
                    sx={{ 
                      '&.Mui-selected': { 
                        backgroundColor: alpha(theme.palette.warning.main, 0.2),
                        borderColor: 'warning.main',
                        color: 'warning.dark'
                      }
                    }}
                  >
                    📝 FIADO
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Total Box - Prominent */}
              <Box sx={{ 
                p: 1.5, 
                mb: 1.5, 
                backgroundColor: priceType === 'publico' 
                  ? alpha(theme.palette.primary.main, 0.1) 
                  : priceType === 'sanAlas' 
                    ? alpha(theme.palette.success.main, 0.1)
                    : alpha(theme.palette.secondary.main, 0.1),
                borderRadius: 2,
                border: '2px solid',
                borderColor: priceType === 'publico' ? 'primary.main' : priceType === 'sanAlas' ? 'success.main' : 'secondary.main'
              }}>
                {/* Subtotal productos */}
                {includeDomicilio && (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Subtotal productos:
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        ${formatNumber(productsSubtotal)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" color="warning.dark">
                        🚚 Domicilio:
                      </Typography>
                      <Typography variant="body2" color="warning.dark">
                        ${formatNumber(parseNumber(domicilioPrice))}
                      </Typography>
                    </Box>
                  </>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    TOTAL ({priceType === 'publico' ? 'Público' : priceType === 'sanAlas' ? 'San Alas' : 'Empleados'})
                  </Typography>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 800, 
                      color: priceType === 'publico' ? 'primary.main' : priceType === 'sanAlas' ? 'success.main' : 'secondary.main' 
                    }}
                  >
                    ${formatNumber(total)}
                  </Typography>
                </Box>
              </Box>

              {/* Efectivo Recibido - solo si es efectivo */}
              {paymentMethod === 'efectivo' && (
                <Box sx={{ mb: 1.5 }}>
                  <TextField
                    fullWidth
                    label="💵 Efectivo Recibido"
                    value={cashReceived}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setCashReceived(formatNumber(value));
                    }}
                    placeholder="Ingrese cantidad"
                    size="small"
                    InputProps={{
                      sx: { fontSize: '1.1rem', fontWeight: 'bold', backgroundColor: 'white' },
                      startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
                    }}
                  />
                  
                  {/* Cambio */}
                  {cashReceivedNum > 0 && (
                    <Box sx={{ 
                      mt: 1,
                      p: 1, 
                      backgroundColor: change >= 0 ? alpha(theme.palette.success.main, 0.15) : alpha(theme.palette.error.main, 0.15),
                      borderRadius: 1,
                      border: '2px solid',
                      borderColor: change >= 0 ? 'success.main' : 'error.main'
                    }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {change >= 0 ? '💰 CAMBIO:' : '⚠️ FALTA:'}
                        </Typography>
                        <Typography 
                          variant="h5" 
                          sx={{ fontWeight: 'bold', color: change >= 0 ? 'success.main' : 'error.main' }}
                        >
                          ${formatNumber(Math.abs(change))}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

              {/* Botón Procesar Venta */}
              <Button
                fullWidth
                variant="contained"
                size="large"
                disabled={!warehouseId || cartItems.length === 0 || (paymentMethod === 'efectivo' && cashReceivedNum < total)}
                onClick={() => {
                  if (paymentMethod === 'fiado') {
                    setShowFiadoDialog(true);
                  } else {
                    setShowConfirmDialog(true);
                  }
                }}
                sx={{
                  py: 1.5,
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderRadius: 2,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  backgroundColor: paymentMethod === 'fiado' 
                    ? 'warning.main' 
                    : (priceType === 'publico' ? 'primary.main' : 'success.main'),
                  '&:hover': {
                    backgroundColor: paymentMethod === 'fiado' 
                      ? 'warning.dark' 
                      : (priceType === 'publico' ? 'primary.dark' : 'success.dark'),
                    transform: 'scale(1.01)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                {paymentMethod === 'fiado' ? '📝 REGISTRAR FIADO' : '💰 PROCESAR VENTA'}
              </Button>
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Confirmation Dialog - Para verificar antes de procesar */}
      <Dialog 
        open={showConfirmDialog} 
        onClose={() => setShowConfirmDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle sx={{ 
          pb: 1, 
          backgroundColor: priceType === 'publico' ? 'primary.main' : 'success.main',
          color: 'white',
          textAlign: 'center'
        }}>
          <Typography variant="h5" fontWeight="bold">
            ⚠️ CONFIRMAR VENTA
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {/* Resumen de la venta */}
          <Box sx={{ 
            p: 2, 
            mb: 2, 
            backgroundColor: 'grey.100', 
            borderRadius: 2,
            border: '2px solid',
            borderColor: priceType === 'publico' ? 'primary.main' : priceType === 'sanAlas' ? 'success.main' : 'secondary.main'
          }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  TIPO DE VENTA
                </Typography>
                <Chip 
                  label={priceType === 'publico' ? '🏪 PÚBLICO' : priceType === 'sanAlas' ? '🍗 SAN ALAS' : '👷 EMPLEADOS'} 
                  color={priceType === 'publico' ? 'primary' : priceType === 'sanAlas' ? 'success' : 'secondary'}
                  sx={{ fontWeight: 700 }}
                />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  MÉTODO DE PAGO
                </Typography>
                <Chip 
                  label={paymentMethod === 'efectivo' ? '💵 EFECTIVO' : '💳 TRANSFERENCIA'} 
                  color={paymentMethod === 'efectivo' ? 'success' : 'info'}
                  sx={{ fontWeight: 700 }}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Lista de productos */}
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            PRODUCTOS ({cartItems.length}):
          </Typography>
          <Box sx={{ 
            maxHeight: 200, 
            overflow: 'auto', 
            mb: 2,
            p: 1,
            backgroundColor: 'grey.50',
            borderRadius: 1
          }}>
            {cartItems.map((item, idx) => (
              <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                <Typography variant="body2">
                  {item.quantity}x {item.product.name} {item.presentation ? `(${item.presentation.name})` : ''}
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  ${formatNumber(item.quantity * item.unitPrice)}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Domicilio si aplica */}
          {includeDomicilio && parseNumber(domicilioPrice) > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, p: 1, backgroundColor: 'warning.50', borderRadius: 1 }}>
              <Typography variant="body2" color="warning.dark">
                🚚 Domicilio
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="warning.dark">
                ${formatNumber(parseNumber(domicilioPrice))}
              </Typography>
            </Box>
          )}

          {/* Total destacado */}
          <Box sx={{ 
            p: 2, 
            backgroundColor: priceType === 'publico' 
              ? alpha(theme.palette.primary.main, 0.15) 
              : priceType === 'sanAlas'
                ? alpha(theme.palette.success.main, 0.15)
                : alpha(theme.palette.secondary.main, 0.15),
            borderRadius: 2,
            textAlign: 'center',
            border: '3px solid',
            borderColor: priceType === 'publico' ? 'primary.main' : priceType === 'sanAlas' ? 'success.main' : 'secondary.main'
          }}>
            <Typography variant="body2" color="text.secondary">
              TOTAL A PAGAR
            </Typography>
            <Typography 
              variant="h3" 
              fontWeight="bold" 
              color={priceType === 'publico' ? 'primary.main' : priceType === 'sanAlas' ? 'success.main' : 'secondary.main'}
            >
              ${formatNumber(total)}
            </Typography>
          </Box>

          {/* Cambio si es efectivo */}
          {paymentMethod === 'efectivo' && cashReceivedNum > 0 && (
            <Box sx={{ mt: 2, p: 1.5, backgroundColor: 'success.50', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Efectivo: ${formatNumber(cashReceivedNum)} → Cambio: 
                <strong style={{ color: '#2e7d32', marginLeft: 8 }}>
                  ${formatNumber(change)}
                </strong>
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button 
            onClick={() => setShowConfirmDialog(false)}
            color="error"
            variant="outlined"
            size="large"
            sx={{ flex: 1, fontWeight: 700, py: 1.5 }}
          >
            ❌ CANCELAR
          </Button>
          <Button
            variant="contained"
            color={priceType === 'publico' ? 'primary' : priceType === 'sanAlas' ? 'success' : 'secondary'}
            onClick={() => {
              setShowConfirmDialog(false);
              checkout();
            }}
            disabled={isProcessing}
            size="large"
            sx={{ flex: 1, fontWeight: 700, py: 1.5 }}
          >
            {isProcessing ? '⏳ PROCESANDO...' : '✅ CONFIRMAR VENTA'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fiado Dialog */}
      <Dialog open={showFiadoDialog} onClose={() => setShowFiadoDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          📝 Registrar Fiado
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            El inventario será descontado ahora. El pago quedará pendiente.
          </Alert>
          
          <Box sx={{ 
            p: 2, 
            mb: 2, 
            backgroundColor: 'grey.100', 
            borderRadius: 1,
            textAlign: 'center'
          }}>
            <Typography variant="h4" fontWeight="bold" color="warning.main">
              ${formatNumber(total)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {cartItems.length} producto(s) - {priceType === 'publico' ? 'Precio Público' : priceType === 'sanAlas' ? 'Precio San Alas' : 'Precio Empleados'}
            </Typography>
          </Box>

          <TextField
            fullWidth
            label="Nombre del Cliente *"
            value={fiadoCustomerName}
            onChange={(e) => setFiadoCustomerName(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Ej: Juan Pérez"
            autoFocus
          />
          
          <TextField
            fullWidth
            label="Teléfono (opcional)"
            value={fiadoCustomerPhone}
            onChange={(e) => setFiadoCustomerPhone(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="Ej: 300 123 4567"
          />
          
          <TextField
            fullWidth
            label="📅 Fecha compromiso de pago (opcional)"
            type="date"
            value={fiadoDueDate}
            onChange={(e) => setFiadoDueDate(e.target.value)}
            sx={{ mb: 2 }}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
            helperText="El sistema le recordará cuando llegue esta fecha"
          />
          
          <TextField
            fullWidth
            label="Notas (opcional)"
            value={fiadoNotes}
            onChange={(e) => setFiadoNotes(e.target.value)}
            multiline
            rows={2}
            placeholder="Ej: Paga el viernes"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button 
            onClick={() => setShowFiadoDialog(false)}
            color="inherit"
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={createFiado}
            disabled={!fiadoCustomerName.trim() || isProcessing}
            sx={{ fontWeight: 600 }}
          >
            {isProcessing ? '⏳ Procesando...' : '✅ Confirmar Fiado'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Receipt Dialog */}
      <ReceiptDialog
        open={showReceiptDialog}
        onClose={() => {
          setShowReceiptDialog(false);
          setCompletedSale(null);
        }}
        sale={completedSale}
      />

      {/* Stock Alert Snackbar */}
      <Snackbar
        open={stockAlert.show}
        autoHideDuration={4000}
        onClose={() => setStockAlert({ ...stockAlert, show: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setStockAlert({ ...stockAlert, show: false })} 
          severity={stockAlert.severity}
          variant="filled"
          sx={{ 
            width: '100%', 
            fontSize: '16px',
            fontWeight: 'bold',
            boxShadow: 4
          }}
        >
          {stockAlert.message}
        </Alert>
      </Snackbar>

      {/* Scanner Test Dialog */}
      <Dialog 
        open={showScannerTest} 
        onClose={() => setShowScannerTest(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: 'primary.main', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          📷 Prueba de Escáner de Código de Barras
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>¿Cómo funciona?</strong><br/>
              El escáner USB funciona como un teclado. Cuando escaneas un código, 
              envía los caracteres rápidamente y termina con Enter.
            </Typography>
          </Alert>
          
          <Box sx={{ 
            p: 3, 
            border: '2px dashed',
            borderColor: scannerActive ? 'warning.main' : 'grey.300',
            borderRadius: 2,
            textAlign: 'center',
            backgroundColor: scannerActive ? 'warning.light' : 'grey.50',
            transition: 'all 0.3s ease',
            mb: 3
          }}>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              {scannerActive ? '📡 Recibiendo datos...' : '⏳ Esperando escaneo...'}
            </Typography>
            
            {scannerBuffer && (
              <Typography 
                variant="h4" 
                sx={{ 
                  fontFamily: 'monospace', 
                  fontWeight: 'bold',
                  color: 'warning.dark',
                  animation: 'pulse 0.5s infinite',
                  '@keyframes pulse': {
                    '0%': { opacity: 1 },
                    '50%': { opacity: 0.6 },
                    '100%': { opacity: 1 },
                  }
                }}
              >
                {scannerBuffer}
              </Typography>
            )}
            
            {!scannerBuffer && !scannerActive && (
              <Typography variant="body2" color="text.secondary">
                Apunta el escáner a un código de barras
              </Typography>
            )}
          </Box>

          {lastScan && (
            <Alert severity="success" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>✅ Último código escaneado:</strong><br/>
                <code style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{lastScan}</code>
              </Typography>
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom>
            📋 Lista de verificación:
          </Typography>
          <Box component="ul" sx={{ pl: 2, mt: 1 }}>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              ✓ El escáner debe estar conectado por USB
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              ✓ Debe estar configurado en modo "Teclado" (keyboard wedge)
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              ✓ Debe enviar Enter o Tab al final del código
            </Typography>
            <Typography component="li" variant="body2">
              ✓ El navegador debe estar enfocado (esta ventana activa)
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowScannerTest(false)} variant="contained">
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cash Close Dialog */}
      <Dialog 
        open={showCashCloseDialog} 
        onClose={() => setShowCashCloseDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: 'error.main', color: 'white', fontWeight: 'bold' }}>
          🔒 Cerrar Caja
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Para cerrar la caja ingrese sus credenciales y el monto en efectivo actual.
          </Typography>
          
          {cashCloseError && (
            <Alert severity="error" sx={{ mb: 2 }}>{cashCloseError}</Alert>
          )}
          
          <TextField
            fullWidth
            label="Email de usuario"
            type="email"
            value={cashCloseEmail}
            onChange={(e) => setCashCloseEmail(e.target.value)}
            sx={{ mb: 2 }}
            autoFocus
          />
          
          <TextField
            fullWidth
            label="Contraseña"
            type="password"
            value={cashClosePassword}
            onChange={(e) => setCashClosePassword(e.target.value)}
            sx={{ mb: 3 }}
          />
          
          {/* Conteo de efectivo */}
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'primary.main' }}>
            💵 Conteo de Efectivo
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              label="Billetes"
              value={cashCloseBilletes}
              onChange={(e) => setCashCloseBilletes(formatNumber(e.target.value))}
              InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
              placeholder="0"
            />
            <TextField
              fullWidth
              label="Monedas"
              value={cashCloseMonedas}
              onChange={(e) => setCashCloseMonedas(formatNumber(e.target.value))}
              InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }}
              placeholder="0"
            />
          </Box>
          
          {/* Total calculado */}
          <Box sx={{ 
            p: 2, 
            mb: 2, 
            backgroundColor: 'success.50', 
            borderRadius: 2, 
            border: '2px solid',
            borderColor: 'success.main'
          }}>
            <Typography variant="body2" color="text.secondary">Total en Caja:</Typography>
            <Typography variant="h4" fontWeight="bold" color="success.main">
              ${formatNumber(parseNumber(cashCloseBilletes) + parseNumber(cashCloseMonedas))}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Billetes: ${formatNumber(parseNumber(cashCloseBilletes))}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Monedas: ${formatNumber(parseNumber(cashCloseMonedas))}
              </Typography>
            </Box>
          </Box>
          
          <TextField
            fullWidth
            label="Notas del cierre (opcional)"
            multiline
            rows={2}
            value={cashCloseNotes}
            onChange={(e) => setCashCloseNotes(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setShowCashCloseDialog(false)}
            disabled={isProcessing}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCashClose}
            disabled={!cashCloseEmail || !cashClosePassword || (parseNumber(cashCloseBilletes) + parseNumber(cashCloseMonedas) === 0) || isProcessing}
          >
            {isProcessing ? '⏳ Cerrando...' : '🔒 Cerrar Caja'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cash Close Summary Dialog */}
      <Dialog 
        open={showCashCloseSummary} 
        onClose={() => setShowCashCloseSummary(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: 'success.main', color: 'white', fontWeight: 'bold' }}>
          ✅ Cierre de Caja Completado
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {cashCloseSummary && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Cerrado por: {cashCloseSummary.closedBy}
              </Typography>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Fecha: {new Date(cashCloseSummary.closedAt).toLocaleString('es-CO')}
              </Typography>
              
              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid item xs={6} md={3}>
                  <Card sx={{ backgroundColor: 'primary.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="body2">Ventas Totales</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatNumber(cashCloseSummary.summary.totalSales)}
                      </Typography>
                      <Typography variant="caption">{cashCloseSummary.summary.salesCount} ventas</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ backgroundColor: 'success.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="body2">💵 Efectivo</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatNumber(cashCloseSummary.summary.totalCash)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ backgroundColor: 'info.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="body2">🏦 Transferencias</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatNumber(cashCloseSummary.summary.totalTransfer)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ backgroundColor: 'warning.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="body2">📝 Fiados</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatNumber(cashCloseSummary.summary.totalFiados)}
                      </Typography>
                      <Typography variant="caption">{cashCloseSummary.summary.fiadosCount} nuevos</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, p: 2, backgroundColor: 'grey.100', borderRadius: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">Apertura:</Typography>
                    <Typography variant="h6">${formatNumber(cashCloseSummary.summary.openingAmount)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">Efectivo esperado:</Typography>
                    <Typography variant="h6">${formatNumber(cashCloseSummary.summary.expectedCash)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">Billetes contados:</Typography>
                    <Typography variant="h6">${formatNumber(cashCloseSummary.billetes || 0)}</Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">Monedas contadas:</Typography>
                    <Typography variant="h6">${formatNumber(cashCloseSummary.monedas || 0)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Total contado:</Typography>
                    <Typography variant="h6" fontWeight="bold">${formatNumber(cashCloseSummary.summary.actualCash)}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Diferencia:</Typography>
                    <Typography 
                      variant="h6" 
                      color={
                        cashCloseSummary.summary.cashDifference === 0 ? 'success.main' : 
                        cashCloseSummary.summary.cashDifference > 0 ? 'info.main' : 'error.main'
                      }
                      fontWeight="bold"
                    >
                      ${formatNumber(Math.abs(cashCloseSummary.summary.cashDifference))}
                      {' '}
                      <Chip 
                        size="small" 
                        label={cashCloseSummary.summary.differenceStatus}
                        color={
                          cashCloseSummary.summary.differenceStatus === 'CUADRADO' ? 'success' :
                          cashCloseSummary.summary.differenceStatus === 'SOBRANTE' ? 'info' : 'error'
                        }
                      />
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              <Box sx={{ mt: 3, p: 2, backgroundColor: 'success.50', borderRadius: 2, border: '1px solid', borderColor: 'success.main' }}>
                <Typography variant="body2" color="text.secondary">Ganancia Bruta del Turno:</Typography>
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  ${formatNumber(cashCloseSummary.summary.grossProfit)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="contained"
            color="success"
            onClick={() => {
              setShowCashCloseSummary(false);
              setCashCloseSummary(null);
            }}
          >
            ✅ Entendido
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar para notificaciones */}
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
          sx={{ width: '100%', fontSize: '1rem' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}


