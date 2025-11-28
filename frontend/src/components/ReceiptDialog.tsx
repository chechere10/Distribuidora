import { forwardRef, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton
} from '@mui/material';
import { Print, Close } from '@mui/icons-material';

// Formato de números colombiano
const formatCOP = (value: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

interface SaleItem {
  id?: string;
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
  product?: {
    id: string;
    name: string;
  };
  presentation?: {
    id: string;
    name: string;
  } | null;
  presentationName?: string;
}

interface SaleData {
  id: string;
  saleNumber?: number;
  total: number;
  subtotal?: number;
  domicilio?: number | null;
  createdAt: string;
  paymentMethod?: string;
  priceType?: string;
  cashReceived?: number | null;
  change?: number | null;
  items: SaleItem[];
  warehouse?: {
    id: string;
    name: string;
  };
}

interface ReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  sale: SaleData | null;
}

// Componente de recibo para imprimir - optimizado para impresoras térmicas 80mm
const ReceiptContent = forwardRef<HTMLDivElement, { sale: SaleData }>(({ sale }, ref) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Calcular subtotal de productos si no viene
  const productsSubtotal = sale.subtotal || sale.items.reduce((acc, item) => {
    return acc + (item.subtotal ?? (item.quantity * item.unitPrice));
  }, 0);

  const domicilio = sale.domicilio || 0;

  // Generar línea de separación
  const dividerLine = '═'.repeat(42);
  const dottedLine = '─'.repeat(42);

  return (
    <Box 
      ref={ref}
      sx={{ 
        width: '302px',
        p: 1.5,
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '12px',
        backgroundColor: 'white',
        color: 'black',
        lineHeight: 1.3,
        '@media print': {
          width: '80mm',
          padding: '2mm',
          margin: 0,
        }
      }}
    >
      {/* ═══════════════ HEADER ═══════════════ */}
      <Box sx={{ textAlign: 'center', mb: 1 }}>
        <Typography sx={{ 
          fontWeight: 'bold', 
          fontSize: '24px', 
          fontFamily: 'inherit',
          letterSpacing: '4px',
          mb: 0
        }}>
          ZORA
        </Typography>
        <Typography sx={{ 
          fontSize: '11px', 
          fontFamily: 'inherit',
          letterSpacing: '3px',
          mb: 0.5
        }}>
          DISTRIBUIDORA
        </Typography>
        <Typography sx={{ 
          fontSize: '10px', 
          fontFamily: 'inherit',
          color: '#444'
        }}>
          NIT: 000.000.000-0
        </Typography>
      </Box>

      {/* Línea superior */}
      <Typography sx={{ 
        fontFamily: 'inherit', 
        fontSize: '12px', 
        textAlign: 'center',
        letterSpacing: '-1px'
      }}>
        {dividerLine}
      </Typography>

      {/* ═══════════════ INFO VENTA ═══════════════ */}
      <Box sx={{ py: 0.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '12px', fontFamily: 'inherit' }}>
            VENTA No:
          </Typography>
          <Typography sx={{ fontSize: '14px', fontFamily: 'inherit', fontWeight: 'bold' }}>
            {sale.saleNumber ? String(sale.saleNumber).padStart(6, '0') : '------'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
            FECHA:
          </Typography>
          <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
            {formatDate(sale.createdAt)} {formatTime(sale.createdAt)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
            TIPO:
          </Typography>
          <Typography sx={{ fontSize: '11px', fontFamily: 'inherit', fontWeight: 'bold' }}>
            {sale.priceType === 'sanAlas' ? '🍗 SAN ALAS' : sale.priceType === 'empleados' ? '👷 EMPLEADOS' : '🏪 PÚBLICO'}
          </Typography>
        </Box>
      </Box>

      {/* Línea divisoria */}
      <Typography sx={{ 
        fontFamily: 'inherit', 
        fontSize: '12px', 
        textAlign: 'center',
        letterSpacing: '-1px'
      }}>
        {dottedLine}
      </Typography>

      {/* ═══════════════ ENCABEZADO ITEMS ═══════════════ */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        py: 0.5,
        borderBottom: '1px solid #000'
      }}>
        <Typography sx={{ fontSize: '10px', fontFamily: 'inherit', fontWeight: 'bold', flex: 1 }}>
          DESCRIPCIÓN
        </Typography>
        <Typography sx={{ fontSize: '10px', fontFamily: 'inherit', fontWeight: 'bold', width: '35px', textAlign: 'center' }}>
          CANT
        </Typography>
        <Typography sx={{ fontSize: '10px', fontFamily: 'inherit', fontWeight: 'bold', width: '55px', textAlign: 'right' }}>
          P.UNIT
        </Typography>
        <Typography sx={{ fontSize: '10px', fontFamily: 'inherit', fontWeight: 'bold', width: '60px', textAlign: 'right' }}>
          TOTAL
        </Typography>
      </Box>

      {/* ═══════════════ ITEMS ═══════════════ */}
      <Box sx={{ py: 0.5 }}>
        {sale.items.map((item, index) => {
          const name = item.product?.name || item.productName || 'Producto';
          const presentation = item.presentation?.name || item.presentationName;
          const subtotal = item.subtotal ?? (item.quantity * item.unitPrice);
          
          // Nombre truncado si es muy largo
          const displayName = name.length > 18 ? name.substring(0, 18) + '.' : name;
          
          return (
            <Box key={index} sx={{ mb: 0.5 }}>
              {/* Línea del producto */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ 
                    fontSize: '11px', 
                    fontFamily: 'inherit',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    {displayName}
                  </Typography>
                  {presentation && (
                    <Typography sx={{ fontSize: '10px', fontFamily: 'inherit', color: '#555', pl: 0.5 }}>
                      └ {presentation}
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: '11px', fontFamily: 'inherit', width: '35px', textAlign: 'center' }}>
                  {item.quantity}
                </Typography>
                <Typography sx={{ fontSize: '11px', fontFamily: 'inherit', width: '55px', textAlign: 'right' }}>
                  {formatCOP(item.unitPrice)}
                </Typography>
                <Typography sx={{ fontSize: '11px', fontFamily: 'inherit', fontWeight: 'bold', width: '60px', textAlign: 'right' }}>
                  {formatCOP(subtotal)}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Línea divisoria */}
      <Typography sx={{ 
        fontFamily: 'inherit', 
        fontSize: '12px', 
        textAlign: 'center',
        letterSpacing: '-1px'
      }}>
        {dottedLine}
      </Typography>

      {/* ═══════════════ TOTALES ═══════════════ */}
      <Box sx={{ py: 0.5 }}>
        {/* Subtotal de productos (siempre mostrar) */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
          <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
            SUBTOTAL:
          </Typography>
          <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
            $ {formatCOP(productsSubtotal)}
          </Typography>
        </Box>

        {/* Domicilio */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
          <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
            DOMICILIO:
          </Typography>
          <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
            $ {domicilio > 0 ? formatCOP(domicilio) : '0'}
          </Typography>
        </Box>

        {/* Línea antes del total */}
        <Typography sx={{ 
          fontFamily: 'inherit', 
          fontSize: '12px', 
          textAlign: 'center',
          letterSpacing: '-1px',
          my: 0.5
        }}>
          {dividerLine}
        </Typography>

        {/* TOTAL GRANDE */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 0.5
        }}>
          <Typography sx={{ 
            fontSize: '16px', 
            fontFamily: 'inherit', 
            fontWeight: 'bold',
            letterSpacing: '2px'
          }}>
            TOTAL:
          </Typography>
          <Typography sx={{ 
            fontSize: '18px', 
            fontFamily: 'inherit', 
            fontWeight: 'bold'
          }}>
            $ {formatCOP(sale.total)}
          </Typography>
        </Box>

        {/* Línea después del total */}
        <Typography sx={{ 
          fontFamily: 'inherit', 
          fontSize: '12px', 
          textAlign: 'center',
          letterSpacing: '-1px'
        }}>
          {dividerLine}
        </Typography>
      </Box>

      {/* ═══════════════ MÉTODO DE PAGO ═══════════════ */}
      {sale.paymentMethod && (
        <Box sx={{ py: 0.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
            <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
              MÉTODO PAGO:
            </Typography>
            <Typography sx={{ fontSize: '11px', fontFamily: 'inherit', fontWeight: 'bold' }}>
              {sale.paymentMethod === 'efectivo' ? 'EFECTIVO' : 
               sale.paymentMethod === 'transferencia' ? 'TRANSFERENCIA' :
               sale.paymentMethod === 'fiado' ? 'FIADO' : 
               sale.paymentMethod.toUpperCase()}
            </Typography>
          </Box>
          
          {sale.paymentMethod === 'efectivo' && sale.cashReceived != null && sale.cashReceived > 0 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
                  RECIBIDO:
                </Typography>
                <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
                  $ {formatCOP(sale.cashReceived)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>
                  CAMBIO:
                </Typography>
                <Typography sx={{ fontSize: '12px', fontFamily: 'inherit', fontWeight: 'bold' }}>
                  $ {formatCOP(sale.change || 0)}
                </Typography>
              </Box>
            </>
          )}
        </Box>
      )}

      {/* ═══════════════ FOOTER ═══════════════ */}
      <Box sx={{ mt: 1.5, textAlign: 'center' }}>
        <Typography sx={{ 
          fontFamily: 'inherit', 
          fontSize: '12px', 
          textAlign: 'center',
          letterSpacing: '-1px',
          mb: 0.5
        }}>
          {dottedLine}
        </Typography>
        
        <Typography sx={{ 
          fontSize: '13px', 
          fontFamily: 'inherit',
          fontWeight: 'bold',
          mb: 0.5
        }}>
          ¡GRACIAS POR SU COMPRA!
        </Typography>
        
        <Typography sx={{ 
          fontSize: '10px', 
          fontFamily: 'inherit',
          color: '#555'
        }}>
          Conserve este recibo como comprobante
        </Typography>
        
        <Typography sx={{ 
          fontFamily: 'inherit', 
          fontSize: '12px', 
          textAlign: 'center',
          letterSpacing: '-1px',
          mt: 0.5
        }}>
          {dottedLine}
        </Typography>

        <Typography sx={{ 
          fontSize: '9px', 
          fontFamily: 'inherit',
          color: '#777',
          mt: 1
        }}>
          ZORA POS - {formatDate(sale.createdAt)}
        </Typography>
      </Box>
    </Box>
  );
});

ReceiptContent.displayName = 'ReceiptContent';

export default function ReceiptDialog({ open, onClose, sale }: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!receiptRef.current) return;

    const printContent = receiptRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Venta #${sale?.saleNumber ? String(sale.saleNumber).padStart(6, '0') : '------'}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            @media print {
              html, body {
                width: 80mm;
                margin: 0;
                padding: 0;
              }
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              padding: 2mm;
              width: 80mm;
              background: white;
              color: black;
              line-height: 1.3;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 100);
            };
          <\/script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  if (!sale) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="xs"
      PaperProps={{
        sx: { 
          maxWidth: '360px',
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
    >
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        px: 2,
        py: 1.5,
        borderBottom: '1px solid #e0e0e0',
        bgcolor: '#f5f5f5'
      }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '16px' }}>
          🧾 Recibo de Venta
        </Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </Box>
      
      <DialogContent sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        p: 2,
        bgcolor: '#fafafa'
      }}>
        <Box sx={{ 
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          borderRadius: 1,
          overflow: 'hidden'
        }}>
          <ReceiptContent ref={receiptRef} sale={sale} />
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ 
        justifyContent: 'center', 
        gap: 2, 
        py: 2,
        bgcolor: '#f5f5f5',
        borderTop: '1px solid #e0e0e0'
      }}>
        <Button 
          onClick={onClose} 
          variant="outlined"
          sx={{ minWidth: 100 }}
        >
          CERRAR
        </Button>
        <Button 
          onClick={handlePrint} 
          variant="contained" 
          color="primary"
          startIcon={<Print />}
          sx={{ minWidth: 140 }}
        >
          IMPRIMIR
        </Button>
      </DialogActions>
    </Dialog>
  );
}
