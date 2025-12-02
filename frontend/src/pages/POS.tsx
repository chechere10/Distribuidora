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
  Divider,
} from '@mui/material';
import ReceiptDialog from '../components/ReceiptDialog';
import CashSession from '../components/CashSession';

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
  
  // Barcode scanner state
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  const [showScannerTest, setShowScannerTest] = useState(false);
  
  // Panel de productos colapsable
  const [showProductsPanel, setShowProductsPanel] = useState(false);
  
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

  // Actualizar precios del carrito cuando cambia el tipo de precio
  useEffect(() => {
    if (cartItems.length === 0) return;
    
    setCartItems(prevItems => 
      prevItems.map(item => {
        let newUnitPrice: number;
        
        if (item.presentation) {
          // Precio de presentación según tipo
          switch (priceType) {
            case 'sanAlas':
              newUnitPrice = Number(item.presentation.priceSanAlas || item.presentation.price);
              break;
            case 'empleados':
              newUnitPrice = Number(item.presentation.priceEmpleados || item.presentation.price);
              break;
            default:
              newUnitPrice = Number(item.presentation.price);
          }
        } else {
          // Precio base del producto según tipo
          switch (priceType) {
            case 'sanAlas':
              newUnitPrice = item.product.priceSanAlas 
                ? Number(item.product.priceSanAlas) 
                : Number(item.product.defaultPrice);
              break;
            case 'empleados':
              newUnitPrice = item.product.priceEmpleados 
                ? Number(item.product.priceEmpleados) 
                : Number(item.product.defaultPrice);
              break;
            default:
              newUnitPrice = Number(item.product.defaultPrice);
          }
        }
        
        return {
          ...item,
          unitPrice: newUnitPrice,
          priceType,
        };
      })
    );
  }, [priceType]);

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
      // Abrir caja registradora al confirmar venta
      try {
        await api.post('/sales/open-drawer');
      } catch (e) {
        console.warn('No se pudo abrir la caja registradora:', e);
      }
      
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



  return (
    <Box sx={{ 
      height: 'calc(100vh - 32px)', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header - Compacto */}
      <Box sx={{ py: 1, px: 2, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Punto de Venta
            </Typography>
            {/* Botón para mostrar/ocultar panel de productos */}
            <Tooltip title={showProductsPanel ? "Ocultar catálogo (modo escáner)" : "Mostrar catálogo manual"}>
              <IconButton
                onClick={() => setShowProductsPanel(!showProductsPanel)}
                sx={{
                  backgroundColor: showProductsPanel ? alpha(theme.palette.primary.main, 0.15) : 'grey.100',
                  border: '2px solid',
                  borderColor: showProductsPanel ? 'primary.main' : 'grey.300',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    backgroundColor: showProductsPanel ? alpha(theme.palette.primary.main, 0.25) : 'grey.200',
                    transform: 'scale(1.05)'
                  }
                }}
              >
                {showProductsPanel ? (
                  <span style={{ fontSize: '1.2rem' }}>📦</span>
                ) : (
                  <span style={{ fontSize: '1.2rem' }}>📷</span>
                )}
              </IconButton>
            </Tooltip>
            {/* Scanner message indicator */}
            {scannerMessage && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: scannerMessage.startsWith('✅') ? 'success.main' : 'error.main',
                  fontWeight: 600,
                }}
              >
                {scannerMessage}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            {/* Scanner Status Indicator */}
            <Tooltip title={showScannerTest ? "Cerrar prueba de escáner" : "Probar escáner"}>
              <Chip
                icon={scannerActive ? <span>📡</span> : <span>📷</span>}
                label={scannerActive ? `Leyendo: ${scannerBuffer}` : (lastScan ? `Último: ${lastScan}` : 'Escáner')}
                color={scannerActive ? 'warning' : (lastScan ? 'success' : 'default')}
                variant={scannerActive ? 'filled' : 'outlined'}
                onClick={() => setShowScannerTest(!showScannerTest)}
                size="small"
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
            <CashSession warehouseId={warehouseId} />
            <Chip 
              label={`${cartItems.length} productos`} 
              color="primary" 
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>
      </Box>

      <Grid container sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* Left Panel - Categories and Products (Colapsable) */}
        <Grid 
          item 
          xs={12} 
          md={showProductsPanel ? 5 : 0} 
          sx={{ 
            height: '100%', 
            display: showProductsPanel ? 'flex' : 'none', 
            flexDirection: 'column', 
            overflow: 'hidden',
            transition: 'all 0.3s ease'
          }}
        >
          {/* Barcode Search + Categories Selector */}
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
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
              sx={{ mb: 1 }}
              InputProps={{
                sx: { bgcolor: 'grey.50', py: 0 }
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
          <Box sx={{ flexGrow: 1, p: 1.5, overflow: 'auto', minHeight: 0 }}>
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
                    py: 0.5, 
                    textAlign: 'center', 
                    backgroundColor: isOutOfStock ? 'grey.200' : 'white',
                    borderTop: '1px solid',
                    borderColor: 'grey.200',
                    minHeight: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Typography 
                      sx={{ 
                        fontWeight: 600,
                        fontSize: '0.6rem',
                        lineHeight: 1.15,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        color: isOutOfStock ? 'text.disabled' : 'text.primary',
                        wordBreak: 'break-word',
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
        <Grid 
          item 
          xs={12} 
          md={showProductsPanel ? 7 : 12} 
          sx={{ 
            height: '100%', 
            borderLeft: showProductsPanel ? 1 : 0, 
            borderColor: 'divider', 
            overflow: 'hidden',
            transition: 'all 0.3s ease'
          }}
        >
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Cart Header - Ultra Compacto */}
            <Box sx={{ py: 0.5, px: 1, borderBottom: 1, borderColor: 'divider', backgroundColor: alpha(theme.palette.primary.main, 0.05), flexShrink: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    🛒 Carrito
                  </Typography>
                  <Chip 
                    label={priceType === 'publico' ? '💰 Público' : priceType === 'sanAlas' ? '� San Alas' : '👷 Empleados'} 
                    size="small" 
                    color={priceType === 'publico' ? 'primary' : priceType === 'sanAlas' ? 'success' : 'secondary'}
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {/* Barra de búsqueda compacta cuando el panel está oculto */}
                  {!showProductsPanel && (
                    <TextField
                      size="small"
                      placeholder="🔍 Código de barras..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const input = e.target as HTMLInputElement;
                          if (input.value.trim()) {
                            searchProductByBarcode(input.value.trim());
                            input.value = '';
                          }
                        }
                      }}
                      sx={{ width: 180 }}
                      InputProps={{
                        sx: { bgcolor: 'white', py: 0, height: 28, fontSize: '0.75rem' }
                      }}
                    />
                  )}
                  {cartItems.length > 0 && (
                    <Button variant="text" color="error" onClick={clearCart} size="small" sx={{ py: 0, minWidth: 'auto', fontSize: '0.7rem' }}>
                      LIMPIAR
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Cart Items - Scrollable - Más espacio */}
            <Box ref={cartScrollRef} sx={{ flexGrow: 1, overflow: 'auto', p: 1, minHeight: 0 }}>
              {cartItems.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ mb: 1 }}>🛒</Typography>
                  <Typography variant="h6" color="text.secondary">
                    Carrito Vacío
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {showProductsPanel 
                      ? 'Selecciona productos del catálogo o escanea un código de barras'
                      : 'Escanea un código de barras para agregar productos'}
                  </Typography>
                  {!showProductsPanel && (
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => setShowProductsPanel(true)}
                      startIcon={<span>📦</span>}
                      sx={{ fontWeight: 600 }}
                    >
                      Abrir catálogo manual
                    </Button>
                  )}
                </Box>
              ) : (
                <Box>
                  {/* Header row - Compacto */}
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 1fr 0.7fr 0.8fr 0.8fr 0.3fr', 
                    gap: 0.5, 
                    mb: 0.5, 
                    px: 1,
                    pb: 0.5,
                    borderBottom: '2px solid',
                    borderColor: 'primary.main',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'white',
                    zIndex: 1
                  }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', color: 'text.primary' }}>
                      PRODUCTO
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', textAlign: 'center', color: 'text.primary' }}>
                      PRESENTACIÓN
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', textAlign: 'center', color: 'text.primary' }}>
                      P/U
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', textAlign: 'center', color: 'text.primary' }}>
                      CANT
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem', textAlign: 'right', color: 'text.primary' }}>
                      TOTAL
                    </Typography>
                    <Box />
                  </Box>
                  
                  {/* Cart items - Filas compactas */}
                  {cartItems.map((item, idx) => (
                    <Box 
                      key={`${item.product.id}-${item.presentation?.id || 'base'}-${idx}`} 
                      sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: '2fr 1fr 0.7fr 0.8fr 0.8fr 0.3fr', 
                        gap: 0.5, 
                        alignItems: 'center',
                        py: 0.75,
                        px: 1,
                        borderBottom: '1px solid',
                        borderColor: 'grey.200',
                        '&:hover': { backgroundColor: 'grey.50' },
                        '&:nth-of-type(even)': { backgroundColor: 'grey.25' }
                      }}
                    >
                      {/* Product name + image */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                        <Avatar
                          src={getImageUrl(item.product.imageUrl) || undefined}
                          sx={{ width: 28, height: 28, borderRadius: 1, flexShrink: 0 }}
                        >
                          📦
                        </Avatar>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 600, 
                            fontSize: '0.8rem',
                            lineHeight: 1.2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'text.primary'
                          }}
                        >
                          {item.product.name}
                        </Typography>
                      </Box>
                      
                      {/* Presentation selector - Compacto */}
                      <Box>
                        {item.product.presentations && item.product.presentations.length > 0 ? (
                          <FormControl size="small" fullWidth>
                            <Select
                              value={item.presentation?.id || `base-${item.product.baseUnit}`}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value.startsWith('base-')) {
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
                                color: 'text.primary',
                                '& .MuiSelect-select': { py: 0.25, px: 0.5 }
                              }}
                            >
                              <MenuItem value={`base-${item.product.baseUnit}`} sx={{ fontSize: '0.75rem' }}>
                                Por {item.product.baseUnit || 'und'}
                              </MenuItem>
                              {item.product.presentations.map(pres => (
                                <MenuItem key={pres.id} value={pres.id} sx={{ fontSize: '0.75rem' }}>
                                  {pres.name}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        ) : (
                          <Typography variant="caption" sx={{ fontSize: '0.75rem', color: 'text.primary' }}>
                            Por {item.product.baseUnit || 'und'}
                          </Typography>
                        )}
                      </Box>
                      
                      {/* Price per unit */}
                      <Typography variant="body2" sx={{ textAlign: 'center', color: 'text.primary', fontSize: '0.8rem', fontWeight: 500 }}>
                        ${formatNumber(item.unitPrice)}
                      </Typography>
                      
                      {/* Quantity - Input editable */}
                      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <TextField
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 1;
                            if (newQty > 0) {
                              updateQuantity(idx, newQty);
                            }
                          }}
                          onFocus={(e) => e.target.select()}
                          size="small"
                          inputProps={{ 
                            min: 1, 
                            style: { 
                              textAlign: 'center', 
                              fontWeight: 'bold',
                              fontSize: '0.9rem',
                              padding: '4px 2px',
                              width: '40px',
                              MozAppearance: 'textfield'
                            } 
                          }}
                          sx={{ 
                            width: 50,
                            '& .MuiOutlinedInput-root': {
                              '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                                WebkitAppearance: 'none',
                                margin: 0,
                              },
                              '& input[type=number]': {
                                MozAppearance: 'textfield',
                              },
                            }
                          }}
                        />
                      </Box>
                      
                      {/* Total */}
                      <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main', fontSize: '0.85rem', textAlign: 'right' }}>
                        ${formatNumber(item.quantity * item.unitPrice)}
                      </Typography>
                      
                      {/* Delete button */}
                      <IconButton
                        size="small"
                        onClick={() => removeItem(idx)}
                        color="error"
                        sx={{ p: 0.25, width: 20, height: 20 }}
                      >
                        ✕
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* Payment and Total - Ultra Compacto */}
            <Box sx={{ 
              p: 1, 
              borderTop: 2, 
              borderColor: 'primary.main', 
              backgroundColor: '#fafafa',
              flexShrink: 0
            }}>
              {/* Row 1: Tipo de Venta + Método de Pago + Domicilio - Todo en una línea */}
              <Grid container spacing={0.5} sx={{ mb: 0.5 }}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600, fontSize: '0.6rem', mb: 0.25 }}>
                    TIPO VENTA
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
                        py: 0.25,
                        fontWeight: 700,
                        fontSize: '0.6rem',
                        borderWidth: 1,
                        '&.Mui-selected': { borderWidth: 1 }
                      }
                    }}
                  >
                    <ToggleButton value="publico" sx={{ '&.Mui-selected': { backgroundColor: alpha(theme.palette.primary.main, 0.15), borderColor: 'primary.main', color: 'primary.main' } }}>
                      🏪 PÚB
                    </ToggleButton>
                    <ToggleButton value="sanAlas" sx={{ '&.Mui-selected': { backgroundColor: alpha(theme.palette.success.main, 0.15), borderColor: 'success.main', color: 'success.main' } }}>
                      🍗 SA
                    </ToggleButton>
                    <ToggleButton value="empleados" sx={{ '&.Mui-selected': { backgroundColor: alpha(theme.palette.secondary.main, 0.15), borderColor: 'secondary.main', color: 'secondary.main' } }}>
                      👷 EMP
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                <Grid item xs={5}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600, fontSize: '0.6rem', mb: 0.25 }}>
                    MÉTODO PAGO
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
                        py: 0.25,
                        fontWeight: 700,
                        fontSize: '0.55rem',
                        borderWidth: 1
                      }
                    }}
                  >
                    <ToggleButton value="efectivo" sx={{ '&.Mui-selected': { backgroundColor: alpha(theme.palette.success.main, 0.15), borderColor: 'success.main', color: 'success.dark' } }}>
                      💵 EFECT
                    </ToggleButton>
                    <ToggleButton value="transferencia" sx={{ '&.Mui-selected': { backgroundColor: alpha(theme.palette.info.main, 0.15), borderColor: 'info.main', color: 'info.dark' } }}>
                      💳 TRANSF
                    </ToggleButton>
                    <ToggleButton value="fiado" sx={{ '&.Mui-selected': { backgroundColor: alpha(theme.palette.warning.main, 0.2), borderColor: 'warning.main', color: 'warning.dark' } }}>
                      📝 FIADO
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                <Grid item xs={3}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600, fontSize: '0.6rem', mb: 0.25 }}>
                    DOMICILIO
                  </Typography>
                  <ToggleButton
                    value="domicilio"
                    selected={includeDomicilio}
                    onChange={() => setIncludeDomicilio(!includeDomicilio)}
                    size="small"
                    fullWidth
                    sx={{ 
                      py: 0.25,
                      fontWeight: 700,
                      fontSize: '0.6rem',
                      borderWidth: 1,
                      borderColor: includeDomicilio ? 'warning.main' : 'grey.400',
                      backgroundColor: includeDomicilio ? alpha(theme.palette.warning.main, 0.15) : 'transparent',
                      color: includeDomicilio ? 'warning.dark' : 'text.secondary',
                    }}
                  >
                    🚚 +DOM
                  </ToggleButton>
                </Grid>
              </Grid>

              {/* Domicilio Price Input - Solo si está activo */}
              {includeDomicilio && (
                <TextField
                  fullWidth
                  size="small"
                  value={domicilioPrice}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setDomicilioPrice(formatNumber(value));
                  }}
                  placeholder="Precio domicilio"
                  sx={{ mb: 0.5 }}
                  InputProps={{
                    sx: { fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: 'white', py: 0 },
                    startAdornment: <Typography sx={{ mr: 0.5, color: 'warning.main', fontSize: '0.8rem' }}>🚚 $</Typography>
                  }}
                />
              )}

              {/* Row 2: Total + Efectivo + Botón */}
              <Grid container spacing={0.5} alignItems="stretch">
                {/* Total */}
                <Grid item xs={4}>
                  <Box sx={{ 
                    p: 0.75, 
                    backgroundColor: priceType === 'publico' 
                      ? alpha(theme.palette.primary.main, 0.1) 
                      : priceType === 'sanAlas' 
                        ? alpha(theme.palette.success.main, 0.1)
                        : alpha(theme.palette.secondary.main, 0.1),
                    borderRadius: 1,
                    border: '2px solid',
                    borderColor: priceType === 'publico' ? 'primary.main' : priceType === 'sanAlas' ? 'success.main' : 'secondary.main',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    {includeDomicilio && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.55rem' }}>Prod: ${formatNumber(productsSubtotal)}</Typography>
                        <Typography variant="caption" color="warning.dark" sx={{ fontSize: '0.55rem' }}>+Dom: ${formatNumber(parseNumber(domicilioPrice))}</Typography>
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>TOTAL</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: priceType === 'publico' ? 'primary.main' : priceType === 'sanAlas' ? 'success.main' : 'secondary.main', lineHeight: 1 }}>
                        ${formatNumber(total)}
                      </Typography>
                    </Box>
                  </Box>
                </Grid>

                {/* Efectivo - Campo grande solo si es efectivo */}
                {paymentMethod === 'efectivo' && (
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      size="small"
                      value={cashReceived}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setCashReceived(formatNumber(value));
                      }}
                      placeholder="Efectivo recibido"
                      InputProps={{
                        sx: { 
                          fontSize: '1.1rem', 
                          fontWeight: 'bold', 
                          backgroundColor: 'white', 
                          height: '100%',
                          '& input': { py: 1.5 }
                        },
                        startAdornment: <Typography sx={{ mr: 0.5, fontSize: '1rem', fontWeight: 'bold' }}>💵 $</Typography>
                      }}
                    />
                  </Grid>
                )}

                {/* Botón Procesar */}
                <Grid item xs={paymentMethod === 'efectivo' ? 4 : 8}>
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={!warehouseId || cartItems.length === 0 || (paymentMethod === 'efectivo' && cashReceivedNum < total)}
                    onClick={() => {
                      if (paymentMethod === 'fiado') {
                        setShowFiadoDialog(true);
                      } else {
                        setShowConfirmDialog(true);
                      }
                    }}
                    sx={{
                      height: '100%',
                      minHeight: 50,
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      borderRadius: 1,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      backgroundColor: paymentMethod === 'fiado' 
                        ? 'warning.main' 
                        : (priceType === 'publico' ? 'primary.main' : 'success.main'),
                      '&:hover': {
                        backgroundColor: paymentMethod === 'fiado' 
                          ? 'warning.dark' 
                          : (priceType === 'publico' ? 'primary.dark' : 'success.dark'),
                      }
                    }}
                  >
                    {paymentMethod === 'fiado' ? '📝 FIADO' : '💰 VENDER'}
                  </Button>
                </Grid>
              </Grid>
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
          sx: { borderRadius: 3, minWidth: 400 }
        }}
      >
        <DialogTitle sx={{ 
          py: 2, 
          backgroundColor: priceType === 'publico' ? 'primary.main' : priceType === 'sanAlas' ? 'success.main' : 'secondary.main',
          color: 'white',
          textAlign: 'center'
        }}>
          <Typography variant="h5" fontWeight="bold">
            ✅ CONFIRMAR VENTA
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 3, pb: 2 }}>
          {/* Info de venta compacta */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
            <Chip 
              label={priceType === 'publico' ? '🏪 PÚBLICO' : priceType === 'sanAlas' ? '🍗 SAN ALAS' : '👷 EMPLEADOS'} 
              color={priceType === 'publico' ? 'primary' : priceType === 'sanAlas' ? 'success' : 'secondary'}
              sx={{ fontWeight: 700 }}
            />
            <Chip 
              label={paymentMethod === 'efectivo' ? '💵 EFECTIVO' : '💳 TRANSFERENCIA'} 
              color={paymentMethod === 'efectivo' ? 'success' : 'info'}
              sx={{ fontWeight: 700 }}
            />
          </Box>

          {/* Lista de productos compacta */}
          <Box sx={{ 
            maxHeight: 120, 
            overflow: 'auto', 
            mb: 3,
            p: 1.5,
            backgroundColor: 'grey.50',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'grey.200'
          }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              PRODUCTOS ({cartItems.length}):
            </Typography>
            {cartItems.map((item, idx) => (
              <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
                <Typography variant="body2" color="text.primary">
                  {item.quantity}x {item.product.name} {item.presentation ? `(${item.presentation.name})` : ''}
                </Typography>
                <Typography variant="body2" fontWeight="bold" color="text.primary">
                  ${formatNumber(item.quantity * item.unitPrice)}
                </Typography>
              </Box>
            ))}
            {includeDomicilio && parseNumber(domicilioPrice) > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25, borderTop: '1px dashed', borderColor: 'grey.300', mt: 0.5, pt: 0.5 }}>
                <Typography variant="body2" color="warning.dark">🚚 Domicilio</Typography>
                <Typography variant="body2" fontWeight="bold" color="warning.dark">${formatNumber(parseNumber(domicilioPrice))}</Typography>
              </Box>
            )}
          </Box>

          {/* 3 CAMPOS PRINCIPALES - Diseño profesional */}
          <Grid container spacing={2}>
            {/* TOTAL A PAGAR */}
            <Grid item xs={12}>
              <Box sx={{ 
                p: 2, 
                backgroundColor: priceType === 'publico' 
                  ? alpha(theme.palette.primary.main, 0.1) 
                  : priceType === 'sanAlas'
                    ? alpha(theme.palette.success.main, 0.1)
                    : alpha(theme.palette.secondary.main, 0.1),
                borderRadius: 2,
                border: '3px solid',
                borderColor: priceType === 'publico' ? 'primary.main' : priceType === 'sanAlas' ? 'success.main' : 'secondary.main',
                textAlign: 'center'
              }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 2 }}>
                  TOTAL A PAGAR
                </Typography>
                <Typography 
                  variant="h3" 
                  sx={{ 
                    fontWeight: 900, 
                    color: priceType === 'publico' ? 'primary.main' : priceType === 'sanAlas' ? 'success.main' : 'secondary.main',
                    lineHeight: 1
                  }}
                >
                  ${formatNumber(total)}
                </Typography>
              </Box>
            </Grid>

            {/* EFECTIVO RECIBIDO - Solo si es efectivo */}
            {paymentMethod === 'efectivo' && (
              <Grid item xs={6}>
                <Box sx={{ 
                  p: 2, 
                  backgroundColor: alpha(theme.palette.info.main, 0.1),
                  borderRadius: 2,
                  border: '2px solid',
                  borderColor: 'info.main',
                  textAlign: 'center',
                  height: '100%'
                }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1 }}>
                    💵 EFECTIVO
                  </Typography>
                  <Typography 
                    variant="h4" 
                    sx={{ fontWeight: 800, color: 'info.main', lineHeight: 1 }}
                  >
                    ${formatNumber(cashReceivedNum)}
                  </Typography>
                </Box>
              </Grid>
            )}

            {/* CAMBIO - Solo si es efectivo */}
            {paymentMethod === 'efectivo' && (
              <Grid item xs={6}>
                <Box sx={{ 
                  p: 2, 
                  backgroundColor: alpha(theme.palette.success.main, 0.15),
                  borderRadius: 2,
                  border: '3px solid',
                  borderColor: 'success.main',
                  textAlign: 'center',
                  height: '100%'
                }}>
                  <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 600, letterSpacing: 1 }}>
                    💰 CAMBIO
                  </Typography>
                  <Typography 
                    variant="h4" 
                    sx={{ 
                      fontWeight: 900, 
                      color: 'success.main',
                      lineHeight: 1
                    }}
                  >
                    ${formatNumber(change)}
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
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

          {/* Selector de Tipo de Cliente */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Tipo de Cliente *</InputLabel>
            <Select
              value={priceType}
              label="Tipo de Cliente *"
              onChange={(e) => {
                const newPriceType = e.target.value as 'publico' | 'sanAlas' | 'empleados';
                setPriceType(newPriceType);
                // Actualizar precios del carrito según el nuevo tipo
                setCartItems(prev => prev.map(item => {
                  let newPrice = Number(item.product.defaultPrice) || 0;
                  if (item.presentation) {
                    if (newPriceType === 'sanAlas' && item.presentation.priceSanAlas) {
                      newPrice = Number(item.presentation.priceSanAlas);
                    } else if (newPriceType === 'empleados' && item.presentation.priceEmpleados) {
                      newPrice = Number(item.presentation.priceEmpleados);
                    } else {
                      newPrice = Number(item.presentation.price);
                    }
                  } else {
                    if (newPriceType === 'sanAlas' && item.product.priceSanAlas) {
                      newPrice = Number(item.product.priceSanAlas);
                    } else if (newPriceType === 'empleados' && item.product.priceEmpleados) {
                      newPrice = Number(item.product.priceEmpleados);
                    }
                  }
                  return { ...item, unitPrice: newPrice, priceType: newPriceType };
                }));
              }}
            >
              <MenuItem value="publico">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🏪 Público General
                </Box>
              </MenuItem>
              <MenuItem value="sanAlas">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  🍗 San Alas
                </Box>
              </MenuItem>
              <MenuItem value="empleados">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  👷 Empleado
                </Box>
              </MenuItem>
            </Select>
          </FormControl>

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


