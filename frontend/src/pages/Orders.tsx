import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Tabs,
  Tab,
  Divider,
  Alert,
  Avatar,
  Tooltip,
  CircularProgress,
  Paper,
  InputAdornment,
  Autocomplete,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Collapse,
  useTheme,
  alpha,
  DialogContentText,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  Visibility,
  LocalShipping,
  Business,
  Phone,
  Email,
  LocationOn,
  Receipt,
  ShoppingCart,
  TrendingUp,
  ExpandMore,
  ExpandLess,
  Close,
  AddCircleOutline,
  RemoveCircleOutline,
  Inventory2,
  AttachMoney,
  CalendarToday,
  Person,
  Description,
  Save,
  QrCode2,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFnsV3';
import { es } from 'date-fns/locale/es';
import { api, getToken } from '../api';

// ============ CONFIGURACIÓN ============
const API_BASE_URL = 'http://localhost:3001';

// ============ UTILIDADES ============
const formatCOP = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatNumber = (value: string | number): string => {
  const num = typeof value === 'string' ? value.replace(/\./g, '') : String(value);
  const cleanNum = num.replace(/[^\d]/g, '');
  if (!cleanNum) return '';
  return parseInt(cleanNum, 10).toLocaleString('es-CO');
};

const parseNumber = (value: string): string => {
  return value.replace(/\./g, '').replace(/[^\d]/g, '');
};

const getFullUrl = (path: string | undefined | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${API_BASE_URL}${path}`;
};

// ============ INTERFACES ============
interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  nit?: string;
  notes?: string;
  isActive: boolean;
  _count?: { purchases: number; pendingIssues: number };
}

interface SupplierPendingIssue {
  id: string;
  supplierId: string;
  purchaseId?: string;
  type: string;
  description: string;
  amount?: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedNotes?: string;
  createdAt: string;
  supplier?: { id: string; name: string; phone?: string };
}

interface Category {
  id: string;
  name: string;
  color?: string;
}

interface Product {
  id: string;
  name: string;
  barcode?: string;
  defaultPrice: string;
  cost: string;
  imageUrl?: string;
  baseUnit: string;
  baseStock: string;
  categoryId?: string;
  presentations: ProductPresentation[];
}

interface ProductPresentation {
  id: string;
  name: string;
  quantity: string;
  price: string;
  priceSanAlas?: string;
  priceEmpleados?: string;
  barcode?: string;
}

interface PurchaseItem {
  id?: string;
  productId: string;
  productName: string;
  presentationId?: string | null;
  presentationName?: string | null;
  quantity: number;
  baseQuantity: number;
  unitCost: number;
  subtotal: number;
  product?: Product;
}

interface Purchase {
  id: string;
  purchaseNumber: number;
  date: string;
  supplierId?: string;
  supplierName?: string;
  supplier?: Supplier;
  warehouseId: string;
  warehouse?: { name: string };
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  invoiceNumber?: string;
  notes?: string;
  items: PurchaseItem[];
  createdAt: string;
}

interface Stats {
  total: { count: number; amount: number };
  today: { count: number; amount: number };
  month: { count: number; amount: number };
  supplierCount: number;
}

// ============ COMPONENTE PRINCIPAL ============
export default function Purchases() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Proveedores
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    nit: '',
    notes: ''
  });

  // Compras
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [viewPurchaseDialogOpen, setViewPurchaseDialogOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Productos para agregar a compra
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');

  // Formulario de nueva compra
  const [purchaseForm, setPurchaseForm] = useState({
    supplierId: '',
    supplierName: '',
    invoiceNumber: '',
    notes: '',
    items: [] as PurchaseItem[]
  });

  // Estadísticas
  const [stats, setStats] = useState<Stats | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'supplier' | 'purchase'; item: any } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Quick Supplier Dialog (desde compra)
  const [quickSupplierDialogOpen, setQuickSupplierDialogOpen] = useState(false);
  const [quickSupplierForm, setQuickSupplierForm] = useState({ name: '', phone: '', nit: '', email: '', address: '' });

  // Nuevo Producto Dialog (completo, desde compra)
  const [newProductDialogOpen, setNewProductDialogOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    barcode: '',
    categoryId: '',
    baseUnit: 'unidad',
    cost: '',
    defaultPrice: '',
    priceSanAlas: '',
    priceEmpleados: '',
    baseStock: '',
    minStock: '',
    imageUrl: ''
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [newProductPresentations, setNewProductPresentations] = useState<Array<{
    name: string;
    quantity: string;
    price: string;
    priceSanAlas: string;
    priceEmpleados: string;
    barcode: string;
  }>>([]);

  // Selección de presentación al agregar producto
  const [selectPresentationDialogOpen, setSelectPresentationDialogOpen] = useState(false);
  const [productToAdd, setProductToAdd] = useState<Product | null>(null);

  // Pendientes de proveedores
  const [pendingIssues, setPendingIssues] = useState<SupplierPendingIssue[]>([]);
  const [pendingIssueDialogOpen, setPendingIssueDialogOpen] = useState(false);
  const [pendingIssueForm, setPendingIssueForm] = useState({
    supplierId: '',
    purchaseId: '',
    type: 'otro' as string,
    description: '',
    amount: ''
  });
  const [viewPendingDialogOpen, setViewPendingDialogOpen] = useState(false);
  const [selectedSupplierForPending, setSelectedSupplierForPending] = useState<Supplier | null>(null);
  const [supplierPendingIssues, setSupplierPendingIssues] = useState<SupplierPendingIssue[]>([]);

  // Pendientes dentro de la compra actual
  const [purchasePendingIssues, setPurchasePendingIssues] = useState<Array<{
    type: string;
    description: string;
    amount: string;
  }>>([]);

  // Ref para mantener la función actual de agregar producto
  const handleAddProductRef = useRef<((product: Product) => void) | null>(null);

  // Estado para mensajes del escáner
  const [scannerMessage, setScannerMessage] = useState<string | null>(null);
  
  // Ref para scroll automático de la tabla de productos
  const purchaseTableRef = useRef<HTMLDivElement>(null);

  // Función para buscar producto por código de barras (escáner)
  const searchProductByBarcode = useCallback(async (barcode: string) => {
    if (!purchaseDialogOpen) return; // Solo funciona cuando el diálogo está abierto
    
    try {
      // Buscar en el backend por código de barras
      const response = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      
      if (response.ok) {
        const product = await response.json();
        
        // Verificar si tiene presentación escaneada
        if (product.scannedPresentation) {
          addProductToList(product, product.scannedPresentation);
          setScannerMessage(`✅ ${product.name} (${product.scannedPresentation.name}) agregado`);
        } else {
          // Agregar producto base
          addProductToList(product, null);
          setScannerMessage(`✅ ${product.name} agregado a la compra`);
        }
        setTimeout(() => setScannerMessage(null), 3000);
      } else {
        // No encontrado
        setScannerMessage(`❌ Producto no encontrado: ${barcode}`);
        setError(`Producto con código ${barcode} no encontrado. Puede agregarlo manualmente.`);
        setTimeout(() => setScannerMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error buscando producto:', err);
      setScannerMessage(`❌ Error buscando: ${barcode}`);
      setTimeout(() => setScannerMessage(null), 3000);
    }
  }, [purchaseDialogOpen]);

  // Hook del escáner de código de barras
  useBarcodeScanner({
    onScan: searchProductByBarcode,
    enabled: purchaseDialogOpen, // Solo activo cuando el diálogo está abierto
    allowInputFocus: true
  });

  // ============ CARGA INICIAL ============
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadSuppliers(),
        loadPurchases(),
        loadProducts(),
        loadStats(),
        loadCategories(),
        loadPendingIssues()
      ]);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const response = await fetch('/api/suppliers', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    }
  };

  const loadPurchases = async () => {
    try {
      const response = await fetch('/api/purchases?limit=100', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setPurchases(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading purchases:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/products?limit=200', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/purchases/stats/summary', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadPendingIssues = async () => {
    try {
      const response = await fetch('/api/supplier-issues/pending', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setPendingIssues(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading pending issues:', err);
    }
  };

  const loadSupplierPendingIssues = async (supplierId: string) => {
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/issues`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      setSupplierPendingIssues(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading supplier issues:', err);
    }
  };

  // ============ PENDIENTES ============
  const issueTypeLabels: Record<string, string> = {
    productos_malos: '🔴 Productos Malos',
    cambio_pendiente: '🔄 Cambio Pendiente',
    productos_vencidos: '⏰ Productos Vencidos',
    faltante: '📦 Faltante en Entrega',
    devolucion: '↩️ Devolución Pendiente',
    otro: '📝 Otro'
  };

  const handleOpenPendingIssueDialog = (supplierId?: string, purchaseId?: string) => {
    setPendingIssueForm({
      supplierId: supplierId || '',
      purchaseId: purchaseId || '',
      type: 'otro',
      description: '',
      amount: ''
    });
    setPendingIssueDialogOpen(true);
  };

  const handleSavePendingIssue = async () => {
    if (!pendingIssueForm.supplierId) {
      setError('Debe seleccionar un proveedor');
      return;
    }
    if (!pendingIssueForm.description.trim()) {
      setError('La descripción es requerida');
      return;
    }

    try {
      const response = await fetch(`/api/suppliers/${pendingIssueForm.supplierId}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          purchaseId: pendingIssueForm.purchaseId || null,
          type: pendingIssueForm.type,
          description: pendingIssueForm.description,
          amount: pendingIssueForm.amount || null
        })
      });

      if (!response.ok) throw new Error('Error al crear pendiente');

      setPendingIssueDialogOpen(false);
      setSuccess('Pendiente registrado correctamente');
      loadSuppliers();
      loadPendingIssues();
      if (selectedSupplierForPending) {
        loadSupplierPendingIssues(selectedSupplierForPending.id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResolvePendingIssue = async (issueId: string, notes?: string) => {
    try {
      const response = await fetch(`/api/supplier-issues/${issueId}/resolve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ resolvedNotes: notes || 'Resuelto' })
      });

      if (!response.ok) throw new Error('Error al resolver pendiente');

      setSuccess('Pendiente marcado como resuelto');
      loadSuppliers();
      loadPendingIssues();
      if (selectedSupplierForPending) {
        loadSupplierPendingIssues(selectedSupplierForPending.id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleViewSupplierPending = async (supplier: Supplier) => {
    setSelectedSupplierForPending(supplier);
    await loadSupplierPendingIssues(supplier.id);
    setViewPendingDialogOpen(true);
  };

  // ============ PROVEEDORES ============
  const handleOpenSupplierDialog = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setSupplierForm({
        name: supplier.name,
        contactName: supplier.contactName || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        address: supplier.address || '',
        nit: supplier.nit || '',
        notes: supplier.notes || ''
      });
    } else {
      setEditingSupplier(null);
      setSupplierForm({
        name: '',
        contactName: '',
        phone: '',
        email: '',
        address: '',
        nit: '',
        notes: ''
      });
    }
    setSupplierDialogOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) {
      setError('El nombre del proveedor es requerido');
      return;
    }

    try {
      const method = editingSupplier ? 'PUT' : 'POST';
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(supplierForm)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al guardar');
      }

      setSuccess(editingSupplier ? 'Proveedor actualizado' : 'Proveedor creado');
      setSupplierDialogOpen(false);
      loadSuppliers();
      loadStats();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ============ COMPRAS ============
  const handleOpenPurchaseDialog = () => {
    setPurchaseForm({
      supplierId: '',
      supplierName: '',
      invoiceNumber: '',
      notes: '',
      items: []
    });
    setPurchasePendingIssues([]);
    setPurchaseDialogOpen(true);
  };

  // Agregar pendiente a la compra actual
  const handleAddPurchasePendingIssue = () => {
    setPurchasePendingIssues(prev => [...prev, {
      type: 'otro',
      description: '',
      amount: ''
    }]);
  };

  const handleUpdatePurchasePendingIssue = (index: number, field: string, value: string) => {
    setPurchasePendingIssues(prev => prev.map((issue, i) => 
      i === index ? { ...issue, [field]: value } : issue
    ));
  };

  const handleRemovePurchasePendingIssue = (index: number) => {
    setPurchasePendingIssues(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddProduct = (product: Product) => {
    // Si el producto tiene presentaciones, mostrar diálogo para elegir
    if (product.presentations && product.presentations.length > 0) {
      setProductToAdd(product);
      setSelectPresentationDialogOpen(true);
      setProductSearch('');
      return;
    }

    // Si no tiene presentaciones, agregar directamente con unidad base
    addProductToList(product, null);
  };

  // Mantener el ref actualizado para el escáner
  useEffect(() => {
    handleAddProductRef.current = handleAddProduct;
  }, []);

  const addProductToList = (product: Product, presentation: any | null) => {
    // Verificar si ya existe con la misma presentación
    const existing = purchaseForm.items.find(i => 
      i.productId === product.id && 
      i.presentationId === (presentation?.id || null)
    );
    
    if (existing) {
      setError('Este producto/presentación ya está en la lista');
      return;
    }

    // Usar precio público: de la presentación si existe, o del producto base
    const unitCost = presentation 
      ? Number(presentation.price) || 0 
      : Number(product.defaultPrice) || 0;

    const newItem: PurchaseItem = {
      productId: product.id,
      productName: product.name,
      presentationId: presentation?.id || null,
      presentationName: presentation?.name || null,
      quantity: 1,
      baseQuantity: presentation ? Number(presentation.quantity) : 1,
      unitCost: unitCost,
      subtotal: unitCost,
      product
    };

    setPurchaseForm(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
    setProductSearch('');
    setSelectPresentationDialogOpen(false);
    setProductToAdd(null);
    
    // Auto-scroll al final de la tabla después de agregar
    setTimeout(() => {
      if (purchaseTableRef.current) {
        purchaseTableRef.current.scrollTop = purchaseTableRef.current.scrollHeight;
      }
    }, 50);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setPurchaseForm(prev => {
      const items = [...prev.items];
      const item = { ...items[index] };
      
      if (field === 'quantity') {
        item.quantity = Number(value) || 0;
        // Si tiene presentación, calcular baseQuantity correctamente
        if (item.presentationId && item.product?.presentations) {
          const pres = item.product.presentations.find(p => p.id === item.presentationId);
          item.baseQuantity = pres ? item.quantity * Number(pres.quantity) : item.quantity;
        } else {
          item.baseQuantity = item.quantity;
        }
        item.subtotal = item.quantity * item.unitCost;
      } else if (field === 'unitCost') {
        item.unitCost = Number(value) || 0;
        item.subtotal = item.quantity * item.unitCost;
      } else if (field === 'presentationId') {
        const product = item.product;
        if (product && value) {
          const pres = product.presentations?.find(p => p.id === value);
          if (pres) {
            item.presentationId = pres.id;
            item.presentationName = pres.name;
            item.baseQuantity = item.quantity * Number(pres.quantity);
            // Usar el precio público de la presentación como costo unitario
            item.unitCost = Number(pres.price) || 0;
            item.subtotal = item.quantity * item.unitCost;
          }
        } else {
          item.presentationId = null;
          item.presentationName = null;
          item.baseQuantity = item.quantity;
          // Volver al precio público del producto base
          item.unitCost = Number(product?.defaultPrice) || 0;
          item.subtotal = item.quantity * item.unitCost;
        }
      }
      
      items[index] = item;
      return { ...prev, items };
    });
  };

  const handleRemoveItem = (index: number) => {
    setPurchaseForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculatePurchaseTotal = () => {
    return purchaseForm.items.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const handleSavePurchase = async () => {
    if (purchaseForm.items.length === 0) {
      setError('Debe agregar al menos un producto');
      return;
    }

    try {
      // Obtener warehouse
      const warehouseRes = await fetch('/api/warehouses', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const warehouses = await warehouseRes.json();
      const warehouseId = warehouses[0]?.id;
      if (!warehouseId) {
        throw new Error('No hay almacén configurado');
      }

      const payload = {
        supplierId: purchaseForm.supplierId || null,
        supplierName: purchaseForm.supplierName || null,
        warehouseId,
        invoiceNumber: purchaseForm.invoiceNumber || null,
        notes: purchaseForm.notes || null,
        items: purchaseForm.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          presentationId: item.presentationId || null,
          presentationName: item.presentationName || null,
          quantity: item.quantity,
          baseQuantity: item.baseQuantity,
          unitCost: item.unitCost,
          subtotal: item.subtotal
        })),
        discount: 0,
        tax: 0
      };

      const response = await fetch('/api/purchases', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al crear compra');
      }

      const newPurchase = await response.json();

      // Guardar pendientes asociados a esta compra
      if (purchasePendingIssues.length > 0 && purchaseForm.supplierId) {
        for (const issue of purchasePendingIssues) {
          if (issue.description.trim()) {
            await fetch(`/api/suppliers/${purchaseForm.supplierId}/issues`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                purchaseId: newPurchase.id,
                type: issue.type,
                description: issue.description,
                amount: issue.amount || null
              })
            });
          }
        }
      }

      const pendingCount = purchasePendingIssues.filter(i => i.description.trim()).length;
      setSuccess(`Compra registrada exitosamente. Stock actualizado.${pendingCount > 0 ? ` Se registraron ${pendingCount} pendiente(s).` : ''}`);
      setPurchaseDialogOpen(false);
      setPurchasePendingIssues([]);
      loadPurchases();
      loadProducts();
      loadStats();
      loadSuppliers();
      loadPendingIssues();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ============ DELETE ============
  const handleDeleteClick = (type: 'supplier' | 'purchase', item: any) => {
    setItemToDelete({ type, item });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setDeleting(true);

    try {
      const url = itemToDelete.type === 'supplier' 
        ? `/api/suppliers/${itemToDelete.item.id}`
        : `/api/purchases/${itemToDelete.item.id}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al eliminar');
      }

      setSuccess(itemToDelete.type === 'supplier' ? 'Proveedor eliminado' : 'Compra eliminada y stock revertido');
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      
      if (itemToDelete.type === 'supplier') {
        loadSuppliers();
      } else {
        loadPurchases();
        loadProducts();
      }
      loadStats();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // ============ QUICK SUPPLIER (desde compra) ============
  const handleOpenQuickSupplier = () => {
    setQuickSupplierForm({ name: '', phone: '', nit: '', email: '', address: '' });
    setQuickSupplierDialogOpen(true);
  };

  const handleSaveQuickSupplier = async () => {
    if (!quickSupplierForm.name.trim()) {
      setError('El nombre del proveedor es requerido');
      return;
    }

    try {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(quickSupplierForm)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al crear proveedor');
      }

      const newSupplier = await response.json();
      
      // Actualizar lista y seleccionar el nuevo proveedor
      await loadSuppliers();
      setPurchaseForm(prev => ({
        ...prev,
        supplierId: newSupplier.id,
        supplierName: newSupplier.name
      }));
      
      setQuickSupplierDialogOpen(false);
      setSuccess('Proveedor creado exitosamente');
      loadStats();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ============ NUEVO PRODUCTO COMPLETO (desde compra) ============
  const handleOpenNewProduct = () => {
    setNewProductForm({
      name: '',
      barcode: '',
      categoryId: '',
      baseUnit: 'unidad',
      cost: '',
      defaultPrice: '',
      priceSanAlas: '',
      priceEmpleados: '',
      baseStock: '',
      minStock: '',
      imageUrl: ''
    });
    setNewProductPresentations([]);
    setNewProductDialogOpen(true);
  };

  const handleAddPresentation = () => {
    setNewProductPresentations(prev => [...prev, {
      name: '',
      quantity: '',
      price: '',
      priceSanAlas: '',
      priceEmpleados: '',
      barcode: ''
    }]);
  };

  const handleRemovePresentation = (index: number) => {
    setNewProductPresentations(prev => prev.filter((_, i) => i !== index));
  };

  const handlePresentationChange = (index: number, field: string, value: string) => {
    setNewProductPresentations(prev => prev.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ));
  };

  const handleSaveNewProduct = async () => {
    if (!newProductForm.name.trim()) {
      setError('El nombre del producto es requerido');
      return;
    }
    if (!newProductForm.cost) {
      setError('El costo del producto es requerido');
      return;
    }
    if (!newProductForm.defaultPrice) {
      setError('El precio público es requerido');
      return;
    }

    setSavingProduct(true);
    try {
      // Preparar precios para listas de precios
      const prices: { priceListId: string; price: string }[] = [];
      let sanAlasListId: string | null = null;
      
      // Buscar la lista San Alas
      const priceLists = await fetch('/api/price-lists', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      }).then(r => r.json());
      
      const sanAlasListItem = priceLists.find((pl: any) => 
        pl.name.toLowerCase().includes('san alas')
      );
      
      if (sanAlasListItem) {
        sanAlasListId = sanAlasListItem.id;
        if (newProductForm.priceSanAlas) {
          prices.push({
            priceListId: sanAlasListItem.id,
            price: newProductForm.priceSanAlas
          });
        }
      }

      // Preparar presentaciones
      const presentations = newProductPresentations
        .filter(p => p.name.trim() && p.quantity && p.price)
        .map((p, index) => ({
          name: p.name,
          quantity: p.quantity,
          price: p.price,
          priceSanAlas: p.priceSanAlas || null,
          priceEmpleados: p.priceEmpleados || null,
          barcode: p.barcode || null,
          sortOrder: index
        }));

      const payload = {
        name: newProductForm.name,
        barcode: newProductForm.barcode || null,
        categoryId: newProductForm.categoryId || null,
        baseUnit: newProductForm.baseUnit || 'unidad',
        cost: newProductForm.cost,
        defaultPrice: newProductForm.defaultPrice,
        baseStock: newProductForm.baseStock || '0',
        minStock: newProductForm.minStock || 0,
        imageUrl: newProductForm.imageUrl || null,
        prices: prices.length > 0 ? prices : undefined,
        presentations: presentations.length > 0 ? presentations : undefined
      };

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Error al crear producto');
      }

      const newProduct = await response.json();
      
      // Actualizar lista de productos
      await loadProducts();
      
      // Agregar automáticamente a la compra
      const productForPurchase: Product = {
        id: newProduct.id,
        name: newProduct.name,
        barcode: newProduct.barcode,
        defaultPrice: newProduct.defaultPrice,
        cost: newProduct.cost,
        imageUrl: newProduct.imageUrl,
        baseUnit: newProduct.baseUnit,
        baseStock: newProduct.baseStock,
        presentations: []
      };
      
      const newItem: PurchaseItem = {
        productId: newProduct.id,
        productName: newProduct.name,
        presentationId: null,
        presentationName: null,
        quantity: 1,
        baseQuantity: 1,
        unitCost: Number(newProduct.cost) || 0,
        subtotal: Number(newProduct.cost) || 0,
        product: productForPurchase
      };

      setPurchaseForm(prev => ({
        ...prev,
        items: [...prev.items, newItem]
      }));
      
      setNewProductDialogOpen(false);
      setSuccess('Producto creado y agregado a la compra');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  // ============ FILTROS ============
  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
    s.phone?.includes(supplierSearch) ||
    s.nit?.includes(supplierSearch)
  );

  const filteredPurchases = purchases.filter(p =>
    p.supplierName?.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
    p.invoiceNumber?.includes(purchaseSearch) ||
    String(p.purchaseNumber).includes(purchaseSearch)
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.barcode?.includes(productSearch)
  );

  // ============ RENDER ============
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold">
              📦 Compras y Proveedores
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Gestiona tus proveedores y registra compras de mercancía
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={tabValue === 0 ? handleOpenPurchaseDialog : () => handleOpenSupplierDialog()}
              sx={{ borderRadius: 2 }}
            >
              {tabValue === 0 ? 'NUEVA COMPRA' : 'NUEVO PROVEEDOR'}
            </Button>
          </Box>
        </Box>

        {/* Alerts */}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`, color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>Compras Hoy</Typography>
                    <Typography variant="h4" fontWeight="bold">${formatCOP(stats?.today.amount || 0)}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>{stats?.today.count || 0} compras</Typography>
                  </Box>
                  <ShoppingCart sx={{ fontSize: 50, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card sx={{ background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`, color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>Este Mes</Typography>
                    <Typography variant="h4" fontWeight="bold">${formatCOP(stats?.month.amount || 0)}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.8 }}>{stats?.month.count || 0} compras</Typography>
                  </Box>
                  <TrendingUp sx={{ fontSize: 50, opacity: 0.3 }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Total Compras</Typography>
                    <Typography variant="h4" fontWeight="bold">{stats?.total.count || 0}</Typography>
                  </Box>
                  <Receipt sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Proveedores</Typography>
                    <Typography variant="h4" fontWeight="bold">{stats?.supplierCount || 0}</Typography>
                  </Box>
                  <Business sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label="Compras" icon={<ShoppingCart />} iconPosition="start" />
            <Tab label="Proveedores" icon={<Business />} iconPosition="start" />
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  Pendientes
                  {pendingIssues.length > 0 && (
                    <Chip 
                      label={pendingIssues.length} 
                      size="small" 
                      color="error" 
                      sx={{ height: 20, minWidth: 20, fontSize: '0.75rem' }}
                    />
                  )}
                </Box>
              } 
              icon={<Description />} 
              iconPosition="start" 
            />
          </Tabs>
        </Paper>

        {/* Tab Content */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* ============ TAB COMPRAS ============ */}
            {tabValue === 0 && (
              <Paper>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <TextField
                    placeholder="Buscar por proveedor, factura o número..."
                    value={purchaseSearch}
                    onChange={(e) => setPurchaseSearch(e.target.value)}
                    size="small"
                    sx={{ width: 350 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><Search /></InputAdornment>
                    }}
                  />
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'grey.100' }}>
                        <TableCell width={50}></TableCell>
                        <TableCell><strong>N° COMPRA</strong></TableCell>
                        <TableCell><strong>FECHA</strong></TableCell>
                        <TableCell><strong>PROVEEDOR</strong></TableCell>
                        <TableCell><strong>FACTURA</strong></TableCell>
                        <TableCell align="center"><strong>PRODUCTOS</strong></TableCell>
                        <TableCell align="right"><strong>TOTAL</strong></TableCell>
                        <TableCell align="center"><strong>ACCIONES</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredPurchases.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">No hay compras registradas</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPurchases.map((purchase) => (
                          <React.Fragment key={purchase.id}>
                            <TableRow hover>
                              <TableCell>
                                <IconButton 
                                  size="small"
                                  onClick={() => setExpandedRows(prev => ({ ...prev, [purchase.id]: !prev[purchase.id] }))}
                                >
                                  {expandedRows[purchase.id] ? <ExpandLess /> : <ExpandMore />}
                                </IconButton>
                              </TableCell>
                              <TableCell>
                                <Typography fontWeight="bold" color="primary">
                                  CMP-{String(purchase.purchaseNumber).padStart(4, '0')}
                                </Typography>
                              </TableCell>
                              <TableCell>
                              <Box>
                                <Typography variant="body2">
                                  {new Date(purchase.date).toLocaleDateString('es-CO')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(purchase.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              </Box>
                            </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main' }}>
                                    <Business sx={{ fontSize: 16 }} />
                                  </Avatar>
                                  {purchase.supplierName || 'Sin proveedor'}
                                </Box>
                              </TableCell>
                              <TableCell>
                                {purchase.invoiceNumber || '-'}
                              </TableCell>
                              <TableCell align="center">
                                <Chip label={`${purchase.items.length} items`} size="small" color="primary" variant="outlined" />
                              </TableCell>
                              <TableCell align="right">
                                <Typography fontWeight="bold" color="success.main">
                                  ${formatCOP(purchase.total)}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title="Ver detalle">
                                  <IconButton 
                                    size="small" 
                                    color="primary"
                                    onClick={() => {
                                      setSelectedPurchase(purchase);
                                      setViewPurchaseDialogOpen(true);
                                    }}
                                  >
                                    <Visibility />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Eliminar">
                                  <IconButton 
                                    size="small" 
                                    color="error"
                                    onClick={() => handleDeleteClick('purchase', purchase)}
                                  >
                                    <Delete />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={8} sx={{ p: 0 }}>
                                <Collapse in={expandedRows[purchase.id]} timeout="auto" unmountOnExit>
                                  <Box sx={{ p: 2, backgroundColor: 'grey.50' }}>
                                    <Typography variant="subtitle2" gutterBottom>Detalle de productos:</Typography>
                                    <Table size="small">
                                      <TableHead>
                                        <TableRow>
                                          <TableCell>Producto</TableCell>
                                          <TableCell align="center">Cantidad</TableCell>
                                          <TableCell align="right">Costo Unit.</TableCell>
                                          <TableCell align="right">Subtotal</TableCell>
                                        </TableRow>
                                      </TableHead>
                                      <TableBody>
                                        {purchase.items.map((item, idx) => (
                                          <TableRow key={idx}>
                                            <TableCell>
                                              {item.productName}
                                              {item.presentationName && (
                                                <Typography variant="caption" color="text.secondary" display="block">
                                                  {item.presentationName}
                                                </Typography>
                                              )}
                                            </TableCell>
                                            <TableCell align="center">{item.quantity}</TableCell>
                                            <TableCell align="right">${formatCOP(item.unitCost)}</TableCell>
                                            <TableCell align="right">${formatCOP(item.subtotal)}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </Box>
                                </Collapse>
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {/* ============ TAB PROVEEDORES ============ */}
            {tabValue === 1 && (
              <Paper>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <TextField
                    placeholder="Buscar por nombre, teléfono o NIT..."
                    value={supplierSearch}
                    onChange={(e) => setSupplierSearch(e.target.value)}
                    size="small"
                    sx={{ width: 350 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><Search /></InputAdornment>
                    }}
                  />
                </Box>

                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'grey.100' }}>
                        <TableCell><strong>PROVEEDOR</strong></TableCell>
                        <TableCell><strong>CONTACTO</strong></TableCell>
                        <TableCell><strong>TELÉFONO</strong></TableCell>
                        <TableCell><strong>NIT</strong></TableCell>
                        <TableCell align="center"><strong>COMPRAS</strong></TableCell>
                        <TableCell align="center"><strong>PENDIENTES</strong></TableCell>
                        <TableCell align="center"><strong>ESTADO</strong></TableCell>
                        <TableCell align="center"><strong>ACCIONES</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredSuppliers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">No hay proveedores registrados</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSuppliers.map((supplier) => (
                          <TableRow 
                            key={supplier.id} 
                            hover
                          >
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Avatar sx={{ bgcolor: 'primary.main' }}>
                                  <Business />
                                </Avatar>
                                <Box>
                                  <Typography fontWeight="bold">{supplier.name}</Typography>
                                  {supplier.address && (
                                    <Typography variant="caption" color="text.secondary">
                                      <LocationOn sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                                      {supplier.address}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </TableCell>
                            <TableCell>{supplier.contactName || '-'}</TableCell>
                            <TableCell>
                              {supplier.phone ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  {supplier.phone}
                                </Box>
                              ) : '-'}
                            </TableCell>
                            <TableCell>{supplier.nit || '-'}</TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={supplier._count?.purchases || 0} 
                                size="small" 
                                color="primary" 
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell 
                              align="center"
                              sx={{
                                bgcolor: (supplier._count?.pendingIssues || 0) > 0 ? 'warning.light' : 'inherit'
                              }}
                            >
                              {(supplier._count?.pendingIssues || 0) > 0 ? (
                                <Chip 
                                  label={`⚠️ ${supplier._count?.pendingIssues}`} 
                                  size="small" 
                                  color="warning"
                                  onClick={() => handleViewSupplierPending(supplier)}
                                  sx={{ cursor: 'pointer' }}
                                />
                              ) : (
                                <Chip label="✓" size="small" color="success" variant="outlined" />
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={supplier.isActive ? 'Activo' : 'Inactivo'} 
                                size="small" 
                                color={supplier.isActive ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Ver Pendientes">
                                <IconButton 
                                  size="small" 
                                  color="warning"
                                  onClick={() => handleViewSupplierPending(supplier)}
                                >
                                  <Description />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Editar">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleOpenSupplierDialog(supplier)}
                                >
                                  <Edit />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton 
                                  size="small" 
                                  color="error"
                                  onClick={() => handleDeleteClick('supplier', supplier)}
                                >
                                  <Delete />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            )}

            {/* ============ TAB PENDIENTES ============ */}
            {tabValue === 2 && (
              <Paper>
                {pendingIssues.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Description sx={{ fontSize: 64, color: 'success.main', opacity: 0.5, mb: 2 }} />
                    <Typography variant="h6" color="success.main">
                      ✓ No hay pendientes con proveedores
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Todos los problemas han sido resueltos
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: 'error.light' }}>
                          <TableCell><strong>PROVEEDOR</strong></TableCell>
                          <TableCell><strong>FECHA Y HORA</strong></TableCell>
                          <TableCell><strong>TELÉFONO</strong></TableCell>
                          <TableCell><strong>DIRECCIÓN</strong></TableCell>
                          <TableCell align="center"><strong>PENDIENTES</strong></TableCell>
                          <TableCell align="center"><strong>DETALLES</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(() => {
                          // Agrupar por proveedor
                          const grouped = pendingIssues.reduce((acc, issue) => {
                            const supplierId = issue.supplierId;
                            if (!acc[supplierId]) {
                              acc[supplierId] = {
                                supplier: issue.supplier,
                                issues: [],
                                latestDate: issue.createdAt
                              };
                            }
                            acc[supplierId].issues.push(issue);
                            if (new Date(issue.createdAt) > new Date(acc[supplierId].latestDate)) {
                              acc[supplierId].latestDate = issue.createdAt;
                            }
                            return acc;
                          }, {} as Record<string, { supplier: any; issues: SupplierPendingIssue[]; latestDate: string }>);
                          
                          return Object.entries(grouped).map(([supplierId, data]) => (
                            <TableRow key={supplierId} hover>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                                    <Business />
                                  </Avatar>
                                  <Typography fontWeight="bold">
                                    {data.supplier?.name || 'Sin proveedor'}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">
                                  {new Date(data.latestDate).toLocaleDateString('es-CO')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {new Date(data.latestDate).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {data.supplier?.phone || '-'}
                              </TableCell>
                              <TableCell>
                                {data.supplier?.address || '-'}
                              </TableCell>
                              <TableCell align="center">
                                <Chip 
                                  label={`${data.issues.length} ${data.issues.map(i => issueTypeLabels[i.type]?.split(' ')[0] || i.type).join(', ')}`}
                                  color="error"
                                  size="small"
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Tooltip title="Ver Detalles">
                                  <IconButton 
                                    color="primary"
                                    onClick={() => {
                                      const supplier = suppliers.find(s => s.id === supplierId) || {
                                        id: supplierId,
                                        name: data.supplier?.name || 'Sin proveedor',
                                        phone: data.supplier?.phone,
                                        isActive: true
                                      };
                                      handleViewSupplierPending(supplier as Supplier);
                                    }}
                                  >
                                    <Visibility />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            )}
          </>
        )}

        {/* ============ DIALOG PROVEEDOR ============ */}
        <Dialog open={supplierDialogOpen} onClose={() => setSupplierDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  label="Nombre del Proveedor *"
                  fullWidth
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Nombre de Contacto"
                  fullWidth
                  value={supplierForm.contactName}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, contactName: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Person /></InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Teléfono"
                  fullWidth
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Phone /></InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Email"
                  fullWidth
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, email: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><Email /></InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="NIT / Documento"
                  fullWidth
                  value={supplierForm.nit}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, nit: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Dirección"
                  fullWidth
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, address: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><LocationOn /></InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Notas"
                  fullWidth
                  multiline
                  rows={2}
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm(prev => ({ ...prev, notes: e.target.value }))}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setSupplierDialogOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleSaveSupplier}>
              {editingSupplier ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ============ DIALOG NUEVA COMPRA ============ */}
        <Dialog open={purchaseDialogOpen} onClose={() => setPurchaseDialogOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Nueva Compra</Typography>
            <IconButton onClick={() => setPurchaseDialogOpen(false)}><Close /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={3}>
              {/* Info de compra */}
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 2, height: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Business /> Información de Compra
                    </Typography>
                    <Button 
                      size="small" 
                      onClick={handleOpenQuickSupplier}
                      sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                    >
                      + Nuevo Proveedor
                    </Button>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <Autocomplete
                      options={suppliers}
                      getOptionLabel={(option) => option.name}
                      value={suppliers.find(s => s.id === purchaseForm.supplierId) || null}
                      onChange={async (_, value) => {
                        setPurchaseForm(prev => ({
                          ...prev,
                          supplierId: value?.id || '',
                          supplierName: value?.name || ''
                        }));
                        // Cargar pendientes existentes del proveedor
                        if (value?.id) {
                          try {
                            const response = await fetch(`/api/suppliers/${value.id}/issues?resolved=false`, {
                              headers: { 'Authorization': `Bearer ${getToken()}` }
                            });
                            const existingIssues = await response.json();
                            if (Array.isArray(existingIssues) && existingIssues.length > 0) {
                              setSupplierPendingIssues(existingIssues);
                            } else {
                              setSupplierPendingIssues([]);
                            }
                          } catch (err) {
                            console.error('Error loading supplier issues:', err);
                            setSupplierPendingIssues([]);
                          }
                        } else {
                          setSupplierPendingIssues([]);
                        }
                      }}
                      renderInput={(params) => (
                        <TextField {...params} label="Proveedor" placeholder="Seleccionar proveedor" />
                      )}
                    />
                  </FormControl>

                  <TextField
                    label="N° Factura Proveedor"
                    fullWidth
                    sx={{ mb: 2 }}
                    value={purchaseForm.invoiceNumber}
                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><Receipt /></InputAdornment>
                    }}
                  />

                  <TextField
                    label="Notas"
                    fullWidth
                    multiline
                    rows={3}
                    value={purchaseForm.notes}
                    onChange={(e) => setPurchaseForm(prev => ({ ...prev, notes: e.target.value }))}
                  />

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white', borderRadius: 2, textAlign: 'center' }}>
                    <Typography variant="body2">Total Compra</Typography>
                    <Typography variant="h4" fontWeight="bold">
                      ${formatCOP(calculatePurchaseTotal())}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>

              {/* Productos */}
              <Grid item xs={12} md={8}>
                <Paper sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Inventory2 /> Agregar Productos
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<Add />}
                      onClick={handleOpenNewProduct}
                    >
                      Nuevo Producto
                    </Button>
                  </Box>
                  <Divider sx={{ mb: 2 }} />

                  {/* Mensaje del escáner */}
                  {scannerMessage && (
                    <Alert 
                      severity={scannerMessage.startsWith('✅') ? 'success' : 'error'}
                      sx={{ mb: 2 }}
                      onClose={() => setScannerMessage(null)}
                    >
                      {scannerMessage}
                    </Alert>
                  )}

                  {/* Indicador de escáner activo */}
                  <Alert severity="info" sx={{ mb: 2 }} icon={<QrCode2 />}>
                    📷 <strong>Escáner activo:</strong> Escanea el código de barras del producto para agregarlo automáticamente
                  </Alert>

                  <Autocomplete
                    options={filteredProducts}
                    getOptionLabel={(option) => `${option.name}${option.barcode ? ` (${option.barcode})` : ''}`}
                    inputValue={productSearch}
                    onInputChange={(_, value) => setProductSearch(value)}
                    onChange={(_, value) => value && handleAddProduct(value)}
                    renderInput={(params) => (
                      <TextField 
                        {...params} 
                        label="Buscar producto" 
                        placeholder="Nombre o código de barras..."
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: <InputAdornment position="start"><Search /></InputAdornment>
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar 
                            src={getFullUrl(option.imageUrl)} 
                            sx={{ width: 36, height: 36 }}
                          >
                            <Inventory2 />
                          </Avatar>
                          <Box>
                            <Typography>{option.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Stock: {option.baseStock} {option.baseUnit} | Costo: ${formatCOP(Number(option.cost))}
                            </Typography>
                          </Box>
                        </Box>
                      </li>
                    )}
                    sx={{ mb: 2 }}
                  />

                  {purchaseForm.items.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                      <ShoppingCart sx={{ fontSize: 48, opacity: 0.5, mb: 1 }} />
                      <Typography>Busca y agrega productos a la compra</Typography>
                    </Box>
                  ) : (
                    <TableContainer ref={purchaseTableRef} sx={{ maxHeight: 250, overflowY: 'auto' }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Producto</TableCell>
                            <TableCell width={120}>Cantidad</TableCell>
                            <TableCell width={140}>Costo Unit.</TableCell>
                            <TableCell align="right" width={100}>Subtotal</TableCell>
                            <TableCell width={50}></TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {purchaseForm.items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar 
                                    src={getFullUrl(item.product?.imageUrl)} 
                                    sx={{ width: 32, height: 32 }}
                                  >
                                    <Inventory2 sx={{ fontSize: 16 }} />
                                  </Avatar>
                                  <Box sx={{ minWidth: 150 }}>
                                    <Typography variant="body2">{item.productName}</Typography>
                                    {/* Selector de presentación si hay presentaciones */}
                                    {item.product?.presentations && item.product.presentations.length > 0 ? (
                                      <FormControl size="small" sx={{ minWidth: 140, mt: 0.5 }}>
                                        <Select
                                          value={item.presentationId || ''}
                                          onChange={(e) => handleUpdateItem(index, 'presentationId', e.target.value || null)}
                                          displayEmpty
                                          sx={{ 
                                            fontSize: '0.75rem',
                                            '& .MuiSelect-select': { py: 0.5 }
                                          }}
                                        >
                                          <MenuItem value="">
                                            <em>Por {item.product.baseUnit}</em>
                                          </MenuItem>
                                          {item.product.presentations.map(pres => (
                                            <MenuItem key={pres.id} value={pres.id}>
                                              {pres.name} ({pres.quantity} {item.product?.baseUnit})
                                            </MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                    ) : (
                                      <Typography variant="caption" color="text.secondary">
                                        {item.presentationName || item.product?.baseUnit}
                                      </Typography>
                                    )}
                                    {item.presentationName && item.baseQuantity > item.quantity && (
                                      <Typography variant="caption" sx={{ display: 'block', color: 'primary.main' }}>
                                        = {item.baseQuantity} {item.product?.baseUnit}
                                      </Typography>
                                    )}
                                  </Box>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(index, 'quantity', e.target.value)}
                                  inputProps={{ min: 1, step: 1 }}
                                  sx={{ width: 80 }}
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  value={formatNumber(item.unitCost)}
                                  onChange={(e) => handleUpdateItem(index, 'unitCost', parseNumber(e.target.value))}
                                  InputProps={{
                                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                                  }}
                                  sx={{ width: 120 }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Typography fontWeight="bold">${formatCOP(item.subtotal)}</Typography>
                              </TableCell>
                              <TableCell>
                                <IconButton 
                                  size="small" 
                                  color="error"
                                  onClick={() => handleRemoveItem(index)}
                                >
                                  <Delete />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}

                  {/* Sección de Pendientes vinculados a esta compra */}
                  {purchaseForm.supplierId && (
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2, border: '1px solid', borderColor: 'grey.300' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: 'text.primary' }}>
                          📋 Pendientes de esta Compra
                          {supplierPendingIssues.length > 0 && (
                            <Chip 
                              label={`${supplierPendingIssues.length} existente${supplierPendingIssues.length > 1 ? 's' : ''}`} 
                              size="small" 
                              color="warning" 
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Typography>
                        <Button
                          variant="outlined"
                          color="primary"
                          size="small"
                          startIcon={<Add />}
                          onClick={handleAddPurchasePendingIssue}
                        >
                          Agregar Pendiente
                        </Button>
                      </Box>
                      
                      {/* Pendientes existentes del proveedor */}
                      {supplierPendingIssues.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="warning.dark" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>
                            ⚠️ Pendientes anteriores con este proveedor:
                          </Typography>
                          {supplierPendingIssues.map((issue) => (
                            <Paper 
                              key={issue.id} 
                              sx={{ 
                                p: 1.5, 
                                mb: 1, 
                                bgcolor: 'warning.light',
                                border: '1px solid',
                                borderColor: 'warning.main'
                              }}
                            >
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                  <Typography variant="body2" fontWeight="bold">
                                    {issueTypeLabels[issue.type] || issue.type}
                                  </Typography>
                                  <Typography variant="body2">{issue.description}</Typography>
                                  {issue.amount && (
                                    <Typography variant="caption" color="error.main">
                                      💰 ${formatCOP(Number(issue.amount))}
                                    </Typography>
                                  )}
                                </Box>
                                <Button 
                                  size="small" 
                                  variant="contained" 
                                  color="success"
                                  onClick={() => handleResolvePendingIssue(issue.id, 'Resuelto')}
                                >
                                  ✓ Resolver
                                </Button>
                              </Box>
                            </Paper>
                          ))}
                        </Box>
                      )}

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Registra aquí cualquier problema al recibir este pedido
                      </Typography>

                      {purchasePendingIssues.length === 0 && supplierPendingIssues.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 1, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'grey.200' }}>
                          <Typography color="text.secondary" variant="body2">Sin pendientes</Typography>
                        </Box>
                      ) : purchasePendingIssues.length === 0 ? null : (
                        <>
                          <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ display: 'block', mb: 1 }}>
                            Nuevos pendientes de esta compra:
                          </Typography>
                          {purchasePendingIssues.map((issue, index) => (
                          <Paper key={index} variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'white' }}>
                            <Grid container spacing={1} alignItems="center">
                              <Grid item xs={12} sm={3}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Tipo</InputLabel>
                                  <Select
                                    value={issue.type}
                                    label="Tipo"
                                    onChange={(e) => handleUpdatePurchasePendingIssue(index, 'type', e.target.value)}
                                  >
                                    <MenuItem value="productos_malos">🔴 Productos Malos</MenuItem>
                                    <MenuItem value="cambio_pendiente">🔄 Cambio Pendiente</MenuItem>
                                    <MenuItem value="productos_vencidos">⏰ Vencidos</MenuItem>
                                    <MenuItem value="faltante">📦 Faltante</MenuItem>
                                    <MenuItem value="devolucion">↩️ Devolución</MenuItem>
                                    <MenuItem value="otro">📝 Otro</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} sm={5}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Descripción *"
                                  placeholder="Describe el problema..."
                                  value={issue.description}
                                  onChange={(e) => handleUpdatePurchasePendingIssue(index, 'description', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={10} sm={3}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Monto"
                                  type="number"
                                  value={issue.amount}
                                  onChange={(e) => handleUpdatePurchasePendingIssue(index, 'amount', e.target.value)}
                                  InputProps={{
                                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                                  }}
                                />
                              </Grid>
                              <Grid item xs={2} sm={1}>
                                <IconButton 
                                  size="small" 
                                  color="error"
                                  onClick={() => handleRemovePurchasePendingIssue(index)}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Grid>
                            </Grid>
                          </Paper>
                        ))}
                        </>
                      )}
                    </Box>
                  )}
                </Paper>

              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setPurchaseDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant="contained" 
              onClick={handleSavePurchase}
              disabled={purchaseForm.items.length === 0}
              startIcon={<LocalShipping />}
            >
              Registrar Compra
            </Button>
          </DialogActions>
        </Dialog>

        {/* ============ DIALOG VER COMPRA ============ */}
        <Dialog open={viewPurchaseDialogOpen} onClose={() => setViewPurchaseDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Detalle de Compra CMP-{String(selectedPurchase?.purchaseNumber).padStart(4, '0')}
          </DialogTitle>
          <DialogContent dividers>
            {selectedPurchase && (
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Proveedor</Typography>
                  <Typography variant="body1" fontWeight="bold">{selectedPurchase.supplierName || 'Sin proveedor'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Fecha</Typography>
                  <Typography variant="body1">{new Date(selectedPurchase.date).toLocaleDateString('es-CO', { dateStyle: 'full' })}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">N° Factura</Typography>
                  <Typography variant="body1">{selectedPurchase.invoiceNumber || '-'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Total</Typography>
                  <Typography variant="h5" color="primary" fontWeight="bold">${formatCOP(selectedPurchase.total)}</Typography>
                </Grid>
                {selectedPurchase.notes && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Notas</Typography>
                    <Typography variant="body1">{selectedPurchase.notes}</Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Productos ({selectedPurchase.items.length})</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell align="center">Cantidad</TableCell>
                          <TableCell align="right">Costo Unit.</TableCell>
                          <TableCell align="right">Subtotal</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedPurchase.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell align="center">{item.quantity}</TableCell>
                            <TableCell align="right">${formatCOP(item.unitCost)}</TableCell>
                            <TableCell align="right">${formatCOP(item.subtotal)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewPurchaseDialogOpen(false)}>Cerrar</Button>
          </DialogActions>
        </Dialog>

        {/* ============ DIALOG CONFIRMAR ELIMINACIÓN ============ */}
        <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
          <DialogTitle sx={{ color: 'error.main' }}>
            ⚠️ Confirmar Eliminación
          </DialogTitle>
          <DialogContent>
            <DialogContentText>
              {itemToDelete?.type === 'supplier' ? (
                <>¿Estás seguro de eliminar el proveedor <strong>{itemToDelete.item.name}</strong>?</>
              ) : (
                <>
                  ¿Estás seguro de eliminar la compra <strong>CMP-{String(itemToDelete?.item.purchaseNumber).padStart(4, '0')}</strong>?
                  <br /><br />
                  <strong>Total:</strong> ${itemToDelete ? formatCOP(itemToDelete.item.total) : '0'}
                  <br /><br />
                  ⚠️ <strong>Esta acción revertirá el stock de todos los productos asociados.</strong>
                </>
              )}
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
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

        {/* Diálogo de creación rápida de proveedor */}
        <Dialog 
          open={quickSupplierDialogOpen} 
          onClose={() => setQuickSupplierDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business color="primary" />
            Nuevo Proveedor Rápido
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  label="Nombre de la Empresa"
                  value={quickSupplierForm.name}
                  onChange={(e) => setQuickSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Teléfono"
                  value={quickSupplierForm.phone}
                  onChange={(e) => setQuickSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="NIT"
                  value={quickSupplierForm.nit}
                  onChange={(e) => setQuickSupplierForm(prev => ({ ...prev, nit: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Correo Electrónico"
                  type="email"
                  value={quickSupplierForm.email}
                  onChange={(e) => setQuickSupplierForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Dirección"
                  value={quickSupplierForm.address}
                  onChange={(e) => setQuickSupplierForm(prev => ({ ...prev, address: e.target.value }))}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setQuickSupplierDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant="contained" 
              onClick={handleSaveQuickSupplier}
              disabled={!quickSupplierForm.name.trim() || loading}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />}
            >
              Guardar y Seleccionar
            </Button>
          </DialogActions>
        </Dialog>

        {/* ============ DIALOG VER PENDIENTES DE PROVEEDOR ============ */}
        <Dialog 
          open={viewPendingDialogOpen} 
          onClose={() => setViewPendingDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Description color="warning" />
              Pendientes - {selectedSupplierForPending?.name}
            </Box>
            <Button 
              variant="contained" 
              color="warning" 
              size="small"
              startIcon={<Add />}
              onClick={() => {
                setPendingIssueForm({
                  supplierId: selectedSupplierForPending?.id || '',
                  purchaseId: '',
                  type: 'otro',
                  description: '',
                  amount: ''
                });
                setPendingIssueDialogOpen(true);
              }}
            >
              Nuevo Pendiente
            </Button>
          </DialogTitle>
          <DialogContent>
            {supplierPendingIssues.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color="text.secondary">No hay pendientes con este proveedor ✓</Typography>
              </Box>
            ) : (
              <List>
                {supplierPendingIssues.map((issue) => (
                  <Paper 
                    key={issue.id} 
                    sx={{ 
                      mb: 2, 
                      p: 2, 
                      bgcolor: issue.isResolved ? 'success.light' : 'warning.light',
                      border: '1px solid',
                      borderColor: issue.isResolved ? 'success.main' : 'warning.main'
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {issueTypeLabels[issue.type] || issue.type}
                        </Typography>
                        <Typography sx={{ mt: 1 }}>{issue.description}</Typography>
                        {issue.amount && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            <strong>Monto:</strong> ${formatCOP(Number(issue.amount))}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Creado: {new Date(issue.createdAt).toLocaleDateString('es-CO')}
                        </Typography>
                        {issue.isResolved && issue.resolvedNotes && (
                          <Typography variant="body2" color="success.dark" sx={{ mt: 1 }}>
                            ✓ Resuelto: {issue.resolvedNotes}
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        {!issue.isResolved && (
                          <Button 
                            size="small" 
                            variant="contained" 
                            color="success"
                            onClick={() => handleResolvePendingIssue(issue.id, 'Resuelto')}
                          >
                            Marcar Resuelto
                          </Button>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </List>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewPendingDialogOpen(false)}>Cerrar</Button>
          </DialogActions>
        </Dialog>

        {/* ============ DIALOG CREAR PENDIENTE ============ */}
        <Dialog 
          open={pendingIssueDialogOpen} 
          onClose={() => setPendingIssueDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Description color="warning" />
            Registrar Pendiente con Proveedor
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Proveedor</InputLabel>
                  <Select
                    value={pendingIssueForm.supplierId}
                    label="Proveedor"
                    onChange={(e) => setPendingIssueForm(prev => ({ ...prev, supplierId: e.target.value }))}
                  >
                    {suppliers.map((s) => (
                      <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Tipo de Pendiente</InputLabel>
                  <Select
                    value={pendingIssueForm.type}
                    label="Tipo de Pendiente"
                    onChange={(e) => setPendingIssueForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <MenuItem value="productos_malos">🔴 Productos Malos</MenuItem>
                    <MenuItem value="cambio_pendiente">🔄 Cambio Pendiente</MenuItem>
                    <MenuItem value="productos_vencidos">⏰ Productos Vencidos</MenuItem>
                    <MenuItem value="faltante">📦 Faltante en Entrega</MenuItem>
                    <MenuItem value="devolucion">↩️ Devolución Pendiente</MenuItem>
                    <MenuItem value="otro">📝 Otro</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  required
                  multiline
                  rows={3}
                  label="Descripción del Pendiente"
                  placeholder="Describe detalladamente el problema o pendiente..."
                  value={pendingIssueForm.description}
                  onChange={(e) => setPendingIssueForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Monto Involucrado (opcional)"
                  type="number"
                  value={pendingIssueForm.amount}
                  onChange={(e) => setPendingIssueForm(prev => ({ ...prev, amount: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setPendingIssueDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant="contained" 
              color="warning"
              onClick={handleSavePendingIssue}
              disabled={!pendingIssueForm.supplierId || !pendingIssueForm.description.trim()}
              startIcon={<Save />}
            >
              Registrar Pendiente
            </Button>
          </DialogActions>
        </Dialog>

        {/* ============ DIALOG NUEVO PRODUCTO COMPLETO ============ */}
        <Dialog 
          open={newProductDialogOpen} 
          onClose={() => setNewProductDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Inventory2 color="primary" />
            Nuevo Producto
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              Se guardará en inventario y se agregará a la compra
            </Typography>
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Nombre del Producto"
                  value={newProductForm.name}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Categoría</InputLabel>
                  <Select
                    value={newProductForm.categoryId}
                    label="Categoría"
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, categoryId: e.target.value as string }))}
                  >
                    <MenuItem value="">Sin categoría</MenuItem>
                    {categories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Código de Barras"
                  placeholder="Escanea o escribe el código"
                  value={newProductForm.barcode}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, barcode: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><QrCode2 /></InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Unidad Base</InputLabel>
                  <Select
                    value={newProductForm.baseUnit}
                    label="Unidad Base"
                    onChange={(e) => setNewProductForm(prev => ({ ...prev, baseUnit: e.target.value as string }))}
                  >
                    <MenuItem value="unidad">Unidad</MenuItem>
                    <MenuItem value="kg">Kilogramos (kg)</MenuItem>
                    <MenuItem value="g">Gramos (g)</MenuItem>
                    <MenuItem value="lb">Libras (lb)</MenuItem>
                    <MenuItem value="litro">Litros</MenuItem>
                    <MenuItem value="ml">Mililitros (ml)</MenuItem>
                    <MenuItem value="caja">Caja</MenuItem>
                    <MenuItem value="paquete">Paquete</MenuItem>
                    <MenuItem value="docena">Docena</MenuItem>
                    <MenuItem value="bulto">Bulto</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Divider><Chip label="Precios" size="small" /></Divider>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label="Costo de Compra"
                  type="number"
                  value={newProductForm.cost}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, cost: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label="Precio Público"
                  type="number"
                  value={newProductForm.defaultPrice}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, defaultPrice: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Precio San Alas"
                  type="number"
                  value={newProductForm.priceSanAlas}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, priceSanAlas: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                  helperText="Precio especial para distribuidores"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Precio Empleados"
                  type="number"
                  value={newProductForm.priceEmpleados}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, priceEmpleados: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>
                  }}
                  helperText="Precio especial para empleados"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider><Chip label="Inventario" size="small" /></Divider>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Stock Inicial"
                  type="number"
                  placeholder="0"
                  value={newProductForm.baseStock}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, baseStock: e.target.value }))}
                  helperText="Cantidad disponible al crear"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Stock Mínimo (alerta)"
                  type="number"
                  placeholder="0"
                  value={newProductForm.minStock}
                  onChange={(e) => setNewProductForm(prev => ({ ...prev, minStock: e.target.value }))}
                  helperText="Se notificará cuando baje de este valor"
                />
              </Grid>

              {/* Presentaciones / Etiquetas */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Divider sx={{ flexGrow: 1 }}><Chip label="Sistema de Precios y Venta" size="small" icon={<AttachMoney />} /></Divider>
                  <Button 
                    size="small" 
                    startIcon={<AddCircleOutline />}
                    onClick={handleAddPresentation}
                    sx={{ ml: 2 }}
                  >
                    Nueva Etiqueta
                  </Button>
                </Box>
              </Grid>

              {newProductPresentations.map((presentation, index) => (
                <Grid item xs={12} key={index}>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={2.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Nombre"
                          placeholder="Ej: Caja x12"
                          value={presentation.name}
                          onChange={(e) => handlePresentationChange(index, 'name', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={6} sm={1.5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Cantidad"
                          type="number"
                          placeholder="12"
                          value={presentation.quantity}
                          onChange={(e) => handlePresentationChange(index, 'quantity', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Precio Público"
                          type="number"
                          value={presentation.price}
                          onChange={(e) => handlePresentationChange(index, 'price', e.target.value)}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Precio San Alas"
                          type="number"
                          value={presentation.priceSanAlas}
                          onChange={(e) => handlePresentationChange(index, 'priceSanAlas', e.target.value)}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Precio Empleados"
                          type="number"
                          value={presentation.priceEmpleados}
                          onChange={(e) => handlePresentationChange(index, 'priceEmpleados', e.target.value)}
                          InputProps={{
                            startAdornment: <InputAdornment position="start">$</InputAdornment>
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={2}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Código de Barras"
                          value={presentation.barcode}
                          onChange={(e) => handlePresentationChange(index, 'barcode', e.target.value)}
                        />
                      </Grid>
                      <Grid item xs={12} sm={1}>
                        <IconButton 
                          color="error" 
                          onClick={() => handleRemovePresentation(index)}
                          size="small"
                        >
                          <RemoveCircleOutline />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ))}

              {newProductPresentations.length === 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                    Haz clic en "Nueva Etiqueta" para agregar nuevas variantes 
                  </Typography>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 1 }}>
            <Button onClick={() => setNewProductDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant="contained" 
              onClick={handleSaveNewProduct}
              disabled={!newProductForm.name.trim() || !newProductForm.cost || !newProductForm.defaultPrice || savingProduct}
              startIcon={savingProduct ? <CircularProgress size={16} color="inherit" /> : <Save />}
            >
              {savingProduct ? 'Guardando...' : 'Crear y Agregar a Compra'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ============ DIALOG SELECCIONAR PRESENTACIÓN ============ */}
        <Dialog 
          open={selectPresentationDialogOpen} 
          onClose={() => {
            setSelectPresentationDialogOpen(false);
            setProductToAdd(null);
          }}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Inventory2 color="primary" />
            Seleccionar Presentación
          </DialogTitle>
          <DialogContent>
            {productToAdd && (
              <Box>
                <Typography variant="h6" gutterBottom>
                  {productToAdd.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  ¿En qué presentación te llegó este producto del proveedor?
                </Typography>
                
                <Grid container spacing={2}>
                  {/* Opción: Unidad Base */}
                  <Grid item xs={12}>
                    <Paper 
                      variant="outlined" 
                      sx={{ 
                        p: 2, 
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onClick={() => addProductToList(productToAdd, null)}
                    >
                      <Box>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {productToAdd.baseUnit.charAt(0).toUpperCase() + productToAdd.baseUnit.slice(1)} (Unidad Base)
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          1 {productToAdd.baseUnit} = 1 unidad en inventario
                        </Typography>
                      </Box>
                      <Box textAlign="right">
                        <Typography variant="h6" color="primary">
                          ${formatCOP(Number(productToAdd.cost))}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          costo unitario
                        </Typography>
                      </Box>
                    </Paper>
                  </Grid>

                  {/* Presentaciones disponibles */}
                  {productToAdd.presentations?.map((pres) => (
                    <Grid item xs={12} key={pres.id}>
                      <Paper 
                        variant="outlined" 
                        sx={{ 
                          p: 2, 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' },
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onClick={() => addProductToList(productToAdd, pres)}
                      >
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {pres.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Contiene {pres.quantity} {productToAdd.baseUnit}(s)
                          </Typography>
                          {pres.barcode && (
                            <Typography variant="caption" color="text.secondary">
                              Código: {pres.barcode}
                            </Typography>
                          )}
                        </Box>
                        <Box textAlign="right">
                          <Typography variant="h6" color="primary">
                            ${formatCOP(Number(pres.price))}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            precio venta
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => {
              setSelectPresentationDialogOpen(false);
              setProductToAdd(null);
            }}>
              Cancelar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
}
