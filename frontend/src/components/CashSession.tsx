import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  LockOpen,
  Lock,
  AttachMoney,
  CreditCard,
  Receipt,
  TrendingUp,
  Warning,
  CheckCircle,
  Cancel,
  AccessTime,
} from '@mui/icons-material';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

// Formato de números colombiano
const formatCOP = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Parsear número desde string formateado
const parseNumber = (value: string): number => {
  if (!value) return 0;
  return parseInt(value.replace(/[^0-9]/g, ''), 10) || 0;
};

// Formatear input de número
const formatNumberInput = (value: string): string => {
  const num = parseNumber(value);
  return num > 0 ? formatCOP(num) : '';
};

interface CashSession {
  id: string;
  openedAt: string;
  openingAmount: number;
  openedByUserId: string;
}

interface EgresoDetalle {
  tipo: string;
  descripcion: string;
  beneficiario: string;
  monto: number;
  fecha: string;
  categoria: string;
  factura: string | null;
}

interface CashPreview {
  sessionId: string;
  openedAt: string;
  openingAmount: number;
  summary: {
    totalSales: number;
    salesCount: number;
    totalCash: number;
    totalTransfer: number;
    totalFiados: number;
    fiadosCount: number;
    totalFiadosCobrados: number;
    fiadosCobradosCount: number;
    totalExpenses: number;
    expensesCount: number;
    totalPurchasesCash: number;
    purchasesCount: number;
    totalLoansCash: number;
    loansCount: number;
    totalEgresos: number;
    expectedCash: number;
  };
  egresos: EgresoDetalle[];
}

interface CashSessionProps {
  warehouseId: string;
  onSessionChange?: (isOpen: boolean) => void;
}

export default function CashSessionManager({ warehouseId, onSessionChange }: CashSessionProps) {
  const theme = useTheme();
  const { user } = useAuth();
  
  // Estados
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<CashSession | null>(null);
  const [preview, setPreview] = useState<CashPreview | null>(null);
  
  // Diálogo de apertura
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [openingBilletes, setOpeningBilletes] = useState('');
  const [openingMonedas, setOpeningMonedas] = useState('');
  const [openingError, setOpeningError] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  
  // Diálogo de cierre
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closePassword, setClosePassword] = useState('');
  const [closeBilletes, setCloseBilletes] = useState('');
  const [closeMonedas, setCloseMonedas] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [closeError, setCloseError] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  
  // Diálogo de resumen post-cierre
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [closeSummary, setCloseSummary] = useState<any>(null);

  // Verificar estado de caja al montar
  const checkSession = useCallback(async () => {
    if (!warehouseId) return;
    
    setLoading(true);
    try {
      const response = await api.get<{ session: CashSession | null }>(`/cash/session?warehouseId=${warehouseId}`);
      setSession(response.session);
      
      if (!response.session) {
        // No hay caja abierta - mostrar diálogo de apertura
        setShowOpenDialog(true);
      }
      
      onSessionChange?.(!!response.session);
    } catch (error) {
      console.error('Error checking cash session:', error);
    } finally {
      setLoading(false);
    }
  }, [warehouseId, onSessionChange]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Cargar preview para cierre
  const loadPreview = async () => {
    if (!warehouseId) return;
    
    setLoadingPreview(true);
    try {
      const response = await api.get<CashPreview>(`/cash/preview?warehouseId=${warehouseId}`);
      setPreview(response);
    } catch (error: any) {
      console.error('Error loading preview:', error);
      setCloseError(error.response?.data?.message || 'Error al cargar resumen');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Abrir caja
  const handleOpenCash = async () => {
    const billetes = parseNumber(openingBilletes);
    const monedas = parseNumber(openingMonedas);
    const totalAmount = billetes + monedas;
    
    setIsOpening(true);
    setOpeningError('');
    
    try {
      const response = await api.post<CashSession>('/cash/open', {
        warehouseId,
        openingAmount: String(totalAmount),
        billetes,
        monedas,
      });
      
      setSession(response);
      setShowOpenDialog(false);
      setOpeningBilletes('');
      setOpeningMonedas('');
      onSessionChange?.(true);
    } catch (error: any) {
      setOpeningError(error.response?.data?.message || 'Error al abrir caja');
    } finally {
      setIsOpening(false);
    }
  };

  // Abrir diálogo de cierre
  const handleOpenCloseDialog = () => {
    setShowCloseDialog(true);
    setCloseError('');
    setClosePassword('');
    setCloseBilletes('');
    setCloseMonedas('');
    setCloseNotes('');
    loadPreview();
  };

  // Cerrar caja
  const handleCloseCash = async () => {
    const billetes = parseNumber(closeBilletes);
    const monedas = parseNumber(closeMonedas);
    const totalContado = billetes + monedas;
    
    if (!closePassword) {
      setCloseError('Ingrese su contraseña para confirmar');
      return;
    }
    
    if (totalContado === 0) {
      setCloseError('Ingrese el conteo de efectivo');
      return;
    }
    
    setIsClosing(true);
    setCloseError('');
    
    try {
      const response = await api.post('/cash/close', {
        warehouseId,
        closingAmount: String(totalContado),
        billetes,
        monedas,
        userEmail: user?.username,
        password: closePassword,
        notes: closeNotes || undefined,
      });
      
      setCloseSummary({
        ...(response as object),
        billetes,
        monedas,
        totalContado,
      });
      setShowCloseDialog(false);
      setShowSummaryDialog(true);
      setSession(null);
      onSessionChange?.(false);
    } catch (error: any) {
      setCloseError(error.response?.data?.message || 'Error al cerrar caja');
    } finally {
      setIsClosing(false);
    }
  };

  // Cerrar resumen y verificar si necesita abrir nueva caja
  const handleCloseSummary = () => {
    setShowSummaryDialog(false);
    setCloseSummary(null);
    // Verificar estado - pedirá abrir nueva caja
    checkSession();
  };

  // Si está cargando, mostrar spinner
  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2">Verificando caja...</Typography>
      </Box>
    );
  }

  return (
    <>
      {/* Botón de estado de caja */}
      {session ? (
        <Button
          variant="outlined"
          color="error"
          size="small"
          startIcon={<Lock />}
          onClick={handleOpenCloseDialog}
          sx={{ fontWeight: 'bold' }}
        >
          CERRAR CAJA
        </Button>
      ) : (
        <Button
          variant="contained"
          color="success"
          size="small"
          startIcon={<LockOpen />}
          onClick={() => setShowOpenDialog(true)}
          sx={{ fontWeight: 'bold' }}
        >
          ABRIR CAJA
        </Button>
      )}

      {/* ==================== DIÁLOGO ABRIR CAJA ==================== */}
      <Dialog
        open={showOpenDialog}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={!session}
      >
        <DialogTitle sx={{ 
          bgcolor: 'success.main', 
          color: 'white', 
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <LockOpen /> Abrir Caja
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              ¡Bienvenido, {user?.name || user?.username}!
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Para comenzar a operar, debe abrir la caja registradora.
              Ingrese el monto de efectivo con el que inicia el día.
            </Typography>
          </Box>

          {openingError && (
            <Alert severity="error" sx={{ mb: 2 }}>{openingError}</Alert>
          )}

          <Box sx={{ 
            p: 3, 
            bgcolor: alpha(theme.palette.success.main, 0.05),
            borderRadius: 2,
            border: `2px solid ${theme.palette.success.main}`,
          }}>
            <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2, color: 'success.main' }}>
              💵 Conteo de Efectivo Inicial
            </Typography>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="💵 Billetes"
                  value={openingBilletes}
                  onChange={(e) => setOpeningBilletes(formatNumberInput(e.target.value))}
                  placeholder="0"
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1, fontWeight: 'bold' }}>$</Typography>,
                  }}
                  autoFocus
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="🪙 Monedas"
                  value={openingMonedas}
                  onChange={(e) => setOpeningMonedas(formatNumberInput(e.target.value))}
                  placeholder="0"
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1, fontWeight: 'bold' }}>$</Typography>,
                  }}
                />
              </Grid>
            </Grid>
            
            <Box sx={{ mt: 3, p: 2, bgcolor: 'white', borderRadius: 2, border: '2px solid', borderColor: 'success.main' }}>
              <Typography variant="caption" color="text.secondary" display="block" textAlign="center">Total Inicial en Caja:</Typography>
              <Typography variant="h3" fontWeight="bold" color="success.main" textAlign="center">
                ${formatCOP(parseNumber(openingBilletes) + parseNumber(openingMonedas))}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mt: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  💵 Billetes: ${formatCOP(parseNumber(openingBilletes))}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  🪙 Monedas: ${formatCOP(parseNumber(openingMonedas))}
                </Typography>
              </Box>
            </Box>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            <Typography variant="body2">
              <strong>Nota:</strong> Puede abrir con $0 si no tiene efectivo inicial.
              El sistema registrará todas las transacciones del día.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {session && (
            <Button onClick={() => setShowOpenDialog(false)} disabled={isOpening}>
              Cancelar
            </Button>
          )}
          <Button
            variant="contained"
            color="success"
            onClick={handleOpenCash}
            disabled={isOpening}
            startIcon={isOpening ? <CircularProgress size={20} /> : <LockOpen />}
            sx={{ fontWeight: 'bold' }}
          >
            {isOpening ? 'Abriendo...' : 'ABRIR CAJA'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== DIÁLOGO CERRAR CAJA ==================== */}
      <Dialog
        open={showCloseDialog}
        onClose={() => !isClosing && setShowCloseDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          bgcolor: 'error.main', 
          color: 'white', 
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <Lock /> Cerrar Caja
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {/* Resumen del período */}
          {loadingPreview ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : preview ? (
            <Box sx={{ mb: 3 }}>
              {/* Info de apertura */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AccessTime color="action" fontSize="small" />
                <Typography variant="body2" color="text.secondary">
                  Caja abierta: {new Date(preview.openedAt).toLocaleString('es-CO')}
                </Typography>
                <Chip 
                  label={`Apertura: $${formatCOP(preview.openingAmount)}`} 
                  size="small" 
                  color="success"
                  variant="outlined"
                />
              </Box>

              {/* Tarjetas de resumen */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} sm={3}>
                  <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>Ventas Totales</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(preview.summary.totalSales)}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {preview.summary.salesCount} ventas
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        <AttachMoney sx={{ fontSize: 14, verticalAlign: 'middle' }} /> Efectivo
                      </Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(preview.summary.totalCash)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        <CreditCard sx={{ fontSize: 14, verticalAlign: 'middle' }} /> Transferencias
                      </Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(preview.summary.totalTransfer)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        <Receipt sx={{ fontSize: 14, verticalAlign: 'middle' }} /> Fiados
                      </Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(preview.summary.totalFiados)}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        {preview.summary.fiadosCount} nuevos
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* EGRESOS DETALLADOS */}
              {preview.egresos && preview.egresos.length > 0 && (
                <Box sx={{ 
                  mt: 2, 
                  p: 2, 
                  bgcolor: alpha(theme.palette.error.main, 0.05), 
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                }}>
                  <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1, color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    📤 Egresos del Turno (Salidas de Caja)
                  </Typography>
                  
                  {/* Resumen de egresos por tipo */}
                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    {preview.summary.totalExpenses > 0 && (
                      <Grid item xs={4}>
                        <Box sx={{ p: 1, bgcolor: 'white', borderRadius: 1, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Gastos</Typography>
                          <Typography variant="body1" fontWeight="bold" color="error.main">
                            -${formatCOP(preview.summary.totalExpenses)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {preview.summary.expensesCount} items
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {preview.summary.totalPurchasesCash > 0 && (
                      <Grid item xs={4}>
                        <Box sx={{ p: 1, bgcolor: 'white', borderRadius: 1, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Compras</Typography>
                          <Typography variant="body1" fontWeight="bold" color="error.main">
                            -${formatCOP(preview.summary.totalPurchasesCash)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {preview.summary.purchasesCount} items
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                    {preview.summary.totalLoansCash > 0 && (
                      <Grid item xs={4}>
                        <Box sx={{ p: 1, bgcolor: 'white', borderRadius: 1, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">Préstamos</Typography>
                          <Typography variant="body1" fontWeight="bold" color="error.main">
                            -${formatCOP(preview.summary.totalLoansCash)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {preview.summary.loansCount} items
                          </Typography>
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                  
                  {/* Lista detallada de egresos */}
                  <Box sx={{ maxHeight: 150, overflow: 'auto' }}>
                    {preview.egresos.map((egreso, idx) => (
                      <Box 
                        key={idx} 
                        sx={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          py: 0.5,
                          px: 1,
                          mb: 0.5,
                          bgcolor: 'white',
                          borderRadius: 1,
                          borderLeft: '3px solid',
                          borderLeftColor: egreso.tipo === 'GASTO' ? 'warning.main' : 
                                          egreso.tipo === 'COMPRA' ? 'info.main' : 'secondary.main'
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight="medium">
                            {egreso.descripcion}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {egreso.beneficiario} • {egreso.tipo}
                          </Typography>
                        </Box>
                        <Typography variant="body2" fontWeight="bold" color="error.main">
                          -${formatCOP(egreso.monto)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  
                  {/* Total egresos */}
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" fontWeight="bold">
                      Total Egresos:
                    </Typography>
                    <Typography variant="h6" fontWeight="bold" color="error.main">
                      -${formatCOP(preview.summary.totalEgresos)}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Efectivo esperado */}
              <Box sx={{ 
                p: 2, 
                bgcolor: alpha(theme.palette.success.main, 0.1), 
                borderRadius: 2,
                border: `2px solid ${theme.palette.success.main}`,
                mt: 2,
                mb: 2
              }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Cálculo de efectivo esperado:
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      Apertura (${formatCOP(preview.openingAmount)}) + 
                      Efectivo ventas (${formatCOP(preview.summary.totalCash)}) + 
                      Fiados cobrados (${formatCOP(preview.summary.totalFiadosCobrados)}) - 
                      Egresos (${formatCOP(preview.summary.totalEgresos || preview.summary.totalExpenses)})
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary">
                      Efectivo esperado en caja:
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="success.main">
                      ${formatCOP(preview.summary.expectedCash)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ my: 2 }} />
            </Box>
          ) : null}

          {closeError && (
            <Alert severity="error" sx={{ mb: 2 }}>{closeError}</Alert>
          )}

          {/* Formulario de cierre */}
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
            🔐 Confirmación de Cierre
          </Typography>
          
          <Box sx={{ 
            p: 2, 
            mb: 3, 
            bgcolor: alpha(theme.palette.primary.main, 0.05),
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
          }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Cerrando caja como:
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="primary.main">
                  👤 {user?.name || user?.username}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  @{user?.username}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contraseña"
                  type="password"
                  value={closePassword}
                  onChange={(e) => setClosePassword(e.target.value)}
                  size="small"
                  placeholder="Ingrese su contraseña"
                  helperText="Confirme con su contraseña"
                  autoFocus
                />
              </Grid>
            </Grid>
          </Box>

          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
            💵 Conteo de Efectivo
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Billetes"
                value={closeBilletes}
                onChange={(e) => setCloseBilletes(formatNumberInput(e.target.value))}
                placeholder="0"
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Monedas"
                value={closeMonedas}
                onChange={(e) => setCloseMonedas(formatNumberInput(e.target.value))}
                placeholder="0"
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>,
                }}
                size="small"
              />
            </Grid>
          </Grid>

          {/* Total contado y diferencia */}
          <Box sx={{ 
            p: 2, 
            bgcolor: 'grey.100', 
            borderRadius: 2,
            mb: 2
          }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary">Total contado:</Typography>
                <Typography variant="h5" fontWeight="bold">
                  ${formatCOP(parseNumber(closeBilletes) + parseNumber(closeMonedas))}
                </Typography>
              </Grid>
              {preview && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">Diferencia:</Typography>
                  {(() => {
                    const totalContado = parseNumber(closeBilletes) + parseNumber(closeMonedas);
                    const diferencia = totalContado - preview.summary.expectedCash;
                    const color = diferencia === 0 ? 'success.main' : diferencia > 0 ? 'info.main' : 'error.main';
                    const icon = diferencia === 0 ? <CheckCircle /> : diferencia > 0 ? <TrendingUp /> : <Warning />;
                    const label = diferencia === 0 ? 'CUADRADO' : diferencia > 0 ? 'SOBRANTE' : 'FALTANTE';
                    
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h5" fontWeight="bold" color={color}>
                          ${formatCOP(Math.abs(diferencia))}
                        </Typography>
                        <Chip 
                          icon={icon} 
                          label={label} 
                          size="small" 
                          color={diferencia === 0 ? 'success' : diferencia > 0 ? 'info' : 'error'}
                        />
                      </Box>
                    );
                  })()}
                </Grid>
              )}
            </Grid>
          </Box>

          <TextField
            fullWidth
            label="Notas del cierre (opcional)"
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
            multiline
            rows={2}
            size="small"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setShowCloseDialog(false)} 
            disabled={isClosing}
          >
            CANCELAR
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCloseCash}
            disabled={isClosing || !closePassword || (parseNumber(closeBilletes) + parseNumber(closeMonedas)) === 0}
            startIcon={isClosing ? <CircularProgress size={20} /> : <Lock />}
            sx={{ fontWeight: 'bold' }}
          >
            {isClosing ? 'Cerrando...' : 'CERRAR CAJA'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ==================== DIÁLOGO RESUMEN POST-CIERRE ==================== */}
      <Dialog
        open={showSummaryDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          bgcolor: 'success.main', 
          color: 'white', 
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <CheckCircle /> Cierre de Caja Completado
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {closeSummary && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Cerrado por: <strong>{closeSummary.closedBy}</strong>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Fecha: {new Date(closeSummary.closedAt).toLocaleString('es-CO')}
                  </Typography>
                </Box>
              </Box>

              {/* Resumen de ventas */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} md={3}>
                  <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
                    <CardContent>
                      <Typography variant="caption">Ventas Totales</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(closeSummary.summary?.totalSales || 0)}
                      </Typography>
                      <Typography variant="caption">
                        {closeSummary.summary?.salesCount || 0} ventas
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
                    <CardContent>
                      <Typography variant="caption">Efectivo</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(closeSummary.summary?.totalCash || 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
                    <CardContent>
                      <Typography variant="caption">Transferencias</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(closeSummary.summary?.totalTransfer || 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} md={3}>
                  <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
                    <CardContent>
                      <Typography variant="caption">Fiados</Typography>
                      <Typography variant="h5" fontWeight="bold">
                        ${formatCOP(closeSummary.summary?.totalFiados || 0)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Detalles del conteo */}
              <Box sx={{ 
                p: 2, 
                bgcolor: 'grey.100', 
                borderRadius: 2,
                mb: 2
              }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Apertura:</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      ${formatCOP(closeSummary.summary?.openingAmount || 0)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Efectivo esperado:</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      ${formatCOP(closeSummary.summary?.expectedCash || 0)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Total contado:</Typography>
                    <Typography variant="h6" fontWeight="bold">
                      ${formatCOP(closeSummary.totalContado || closeSummary.summary?.actualCash || 0)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Billetes: ${formatCOP(closeSummary.billetes || 0)} | 
                      Monedas: ${formatCOP(closeSummary.monedas || 0)}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="body2" color="text.secondary">Diferencia:</Typography>
                    {(() => {
                      const diff = closeSummary.summary?.cashDifference || 0;
                      return (
                        <Box>
                          <Typography 
                            variant="h6" 
                            fontWeight="bold"
                            color={diff === 0 ? 'success.main' : diff > 0 ? 'info.main' : 'error.main'}
                          >
                            ${formatCOP(Math.abs(diff))}
                          </Typography>
                          <Chip 
                            size="small"
                            label={closeSummary.summary?.differenceStatus || 'CUADRADO'}
                            color={diff === 0 ? 'success' : diff > 0 ? 'info' : 'error'}
                          />
                        </Box>
                      );
                    })()}
                  </Grid>
                </Grid>
              </Box>

              {/* Ganancia */}
              {closeSummary.summary?.grossProfit !== undefined && (
                <Box sx={{ 
                  p: 2, 
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  borderRadius: 2,
                  border: `2px solid ${theme.palette.success.main}`,
                  textAlign: 'center'
                }}>
                  <Typography variant="body2" color="text.secondary">
                    Ganancia Bruta del Turno
                  </Typography>
                  <Typography variant="h4" fontWeight="bold" color="success.main">
                    ${formatCOP(closeSummary.summary.grossProfit)}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="contained"
            color="success"
            onClick={handleCloseSummary}
            startIcon={<CheckCircle />}
            sx={{ fontWeight: 'bold' }}
          >
            ENTENDIDO
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
