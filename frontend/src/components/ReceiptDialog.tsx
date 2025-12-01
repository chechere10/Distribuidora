import { forwardRef, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import { Print, Close } from '@mui/icons-material';
import { api } from '../api';

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
  user?: {
    id: string;
    username: string;
    name: string | null;
  };
}

interface ReceiptDialogProps {
  open: boolean;
  onClose: () => void;
  sale: SaleData | null;
}

// Estilos CSS para impresión - se inyectarán en la ventana de impresión
const getPrintStyles = () => `
  @page {
    size: 80mm auto;
    margin: 0;
  }
  
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    width: 80mm;
    max-width: 80mm;
    background: white;
    color: black;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  
  .receipt {
    width: 100%;
    padding: 3mm;
  }
  
  .header {
    text-align: center;
    margin-bottom: 8px;
  }
  
  .logo {
    width: 50mm;
    height: auto;
    margin: 0 auto 5px;
    display: block;
  }
  
  .company-name {
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 2px;
  }
  
  .company-subtitle {
    font-size: 10px;
    color: #333;
  }
  
  .divider {
    border: none;
    border-top: 1px dashed #000;
    margin: 8px 0;
  }
  
  .divider-double {
    border: none;
    border-top: 2px solid #000;
    margin: 8px 0;
  }
  
  .info-section {
    margin-bottom: 8px;
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 3px;
    font-size: 11px;
  }
  
  .info-label {
    font-weight: normal;
  }
  
  .info-value {
    font-weight: bold;
    text-align: right;
  }
  
  .sale-number {
    font-size: 14px;
    font-weight: bold;
  }
  
  .items-header {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    font-size: 10px;
    font-weight: bold;
    background: #f5f5f5;
  }
  
  .items-header span:nth-child(1) { flex: 1; text-align: left; }
  .items-header span:nth-child(2) { width: 30px; text-align: center; }
  .items-header span:nth-child(3) { width: 55px; text-align: right; }
  .items-header span:nth-child(4) { width: 60px; text-align: right; }
  
  .item-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 4px 0;
    border-bottom: 1px dotted #ccc;
    font-size: 11px;
  }
  
  .item-row:last-child {
    border-bottom: none;
  }
  
  .item-name {
    flex: 1;
    font-weight: bold;
    text-transform: uppercase;
  }
  
  .item-presentation {
    font-size: 9px;
    color: #555;
    font-weight: normal;
  }
  
  .item-qty { width: 30px; text-align: center; }
  .item-price { width: 55px; text-align: right; }
  .item-total { width: 60px; text-align: right; font-weight: bold; }
  
  .totals-section {
    margin-top: 8px;
  }
  
  .total-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 3px;
    font-size: 11px;
  }
  
  .total-row.grand-total {
    font-size: 16px;
    font-weight: bold;
    padding: 8px 0;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    margin: 8px 0;
  }
  
  .payment-section {
    margin-top: 8px;
    padding: 5px;
    background: #f9f9f9;
    border-radius: 3px;
  }
  
  .footer {
    text-align: center;
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px dashed #000;
  }
  
  .footer-thanks {
    font-size: 13px;
    font-weight: bold;
    margin-bottom: 5px;
  }
  
  .footer-note {
    font-size: 9px;
    color: #555;
  }
  
  .footer-system {
    font-size: 8px;
    color: #999;
    margin-top: 8px;
  }
`;

// Componente de recibo para imprimir
const ReceiptContent = forwardRef<HTMLDivElement, { sale: SaleData; forPrint?: boolean }>(({ sale, forPrint = false }, ref) => {
  const [logoError, setLogoError] = useState(false);
  
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

  const productsSubtotal = sale.subtotal || sale.items.reduce((acc, item) => {
    return acc + (item.subtotal ?? (item.quantity * item.unitPrice));
  }, 0);

  const domicilio = sale.domicilio || 0;
  const saleNumberStr = sale.saleNumber ? String(sale.saleNumber).padStart(6, '0') : '------';
  const priceTypeLabel = sale.priceType === 'sanAlas' ? 'SAN ALAS' : sale.priceType === 'empleados' ? 'EMPLEADOS' : 'PÚBLICO';
  const paymentLabel = sale.paymentMethod === 'efectivo' ? 'EFECTIVO' : 
                       sale.paymentMethod === 'transferencia' ? 'TRANSFERENCIA' :
                       sale.paymentMethod === 'fiado' ? 'FIADO' : 
                       (sale.paymentMethod || 'N/A').toUpperCase();

  // Para impresión, usar HTML puro con clases CSS
  if (forPrint) {
    return (
      <div ref={ref} className="receipt">
        {/* Header con logo */}
        <div className="header">
          <img 
            src="/assets/logo.png" 
            alt="DISTRIZORA" 
            className="logo"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const fallback = document.getElementById('logo-fallback');
              if (fallback) fallback.style.display = 'block';
            }}
          />
          <div id="logo-fallback" style={{ display: 'none' }}>
            <div className="company-name">DISTRIZORA</div>
            <div className="company-subtitle">INSUMOS PARA COMIDAS RÁPIDAS</div>
          </div>
        </div>

        <hr className="divider-double" />

        {/* Información de la venta */}
        <div className="info-section">
          <div className="info-row">
            <span className="info-label">VENTA No:</span>
            <span className="info-value sale-number">{saleNumberStr}</span>
          </div>
          <div className="info-row">
            <span className="info-label">FECHA:</span>
            <span className="info-value">{formatDate(sale.createdAt)} {formatTime(sale.createdAt)}</span>
          </div>
          <div className="info-row">
            <span className="info-label">TIPO PRECIO:</span>
            <span className="info-value">{priceTypeLabel}</span>
          </div>
          <div className="info-row">
            <span className="info-label">VENDEDOR:</span>
            <span className="info-value">{sale.user?.name || sale.user?.username || 'N/A'}</span>
          </div>
        </div>

        <hr className="divider" />

        {/* Encabezado de productos */}
        <div className="items-header">
          <span>DESCRIPCIÓN</span>
          <span>CANT</span>
          <span>P.UNIT</span>
          <span>TOTAL</span>
        </div>

        {/* Lista de productos */}
        <div className="items-list">
          {sale.items.map((item, index) => {
            const name = item.product?.name || item.productName || 'Producto';
            const presentation = item.presentation?.name || item.presentationName;
            const subtotal = item.subtotal ?? (item.quantity * item.unitPrice);
            const displayName = name.length > 16 ? name.substring(0, 16) + '.' : name;
            
            return (
              <div key={index} className="item-row">
                <div className="item-name">
                  {displayName}
                  {presentation && <div className="item-presentation">({presentation})</div>}
                </div>
                <span className="item-qty">{item.quantity}</span>
                <span className="item-price">${formatCOP(item.unitPrice)}</span>
                <span className="item-total">${formatCOP(subtotal)}</span>
              </div>
            );
          })}
        </div>

        <hr className="divider" />

        {/* Totales */}
        <div className="totals-section">
          <div className="total-row">
            <span>SUBTOTAL:</span>
            <span>$ {formatCOP(productsSubtotal)}</span>
          </div>
          {domicilio > 0 && (
            <div className="total-row">
              <span>DOMICILIO:</span>
              <span>$ {formatCOP(domicilio)}</span>
            </div>
          )}
          <div className="total-row grand-total">
            <span>TOTAL:</span>
            <span>$ {formatCOP(sale.total)}</span>
          </div>
        </div>

        {/* Información de pago */}
        {sale.paymentMethod && (
          <div className="payment-section">
            <div className="total-row">
              <span>MÉTODO DE PAGO:</span>
              <span style={{ fontWeight: 'bold' }}>{paymentLabel}</span>
            </div>
            {sale.paymentMethod === 'efectivo' && sale.cashReceived != null && sale.cashReceived > 0 && (
              <>
                <div className="total-row">
                  <span>EFECTIVO RECIBIDO:</span>
                  <span>$ {formatCOP(sale.cashReceived)}</span>
                </div>
                <div className="total-row">
                  <span>CAMBIO:</span>
                  <span style={{ fontWeight: 'bold' }}>$ {formatCOP(sale.change || 0)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <div className="footer-thanks">¡GRACIAS POR SU COMPRA!</div>
          <div className="footer-note">Conserve este recibo como comprobante de pago</div>
          <div className="footer-system">DISTRIZORA POS • {formatDate(sale.createdAt)}</div>
        </div>
      </div>
    );
  }

  // Para vista previa en el diálogo (con MUI)
  return (
    <Box 
      ref={ref}
      sx={{ 
        width: '300px',
        p: 2,
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '11px',
        backgroundColor: 'white',
        color: 'black',
        lineHeight: 1.4,
      }}
    >
      {/* Header con logo */}
      <Box sx={{ textAlign: 'center', mb: 1.5 }}>
        {!logoError ? (
          <Box component="img"
            src="/assets/logo.png" 
            alt="DISTRIZORA"
            onError={() => setLogoError(true)}
            sx={{ width: '120px', height: 'auto', display: 'block', mx: 'auto', mb: 1 }}
          />
        ) : (
          <Box>
            <Typography sx={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '2px' }}>
              DISTRIZORA
            </Typography>
            <Typography sx={{ fontSize: '9px', color: '#333' }}>
              INSUMOS PARA COMIDAS RÁPIDAS
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ borderTop: '2px solid #000', mb: 1.5 }} />

      {/* Info de venta */}
      <Box sx={{ mb: 1.5 }}>
        {[
          { label: 'VENTA No:', value: saleNumberStr, bold: true, size: '13px' },
          { label: 'FECHA:', value: `${formatDate(sale.createdAt)} ${formatTime(sale.createdAt)}` },
          { label: 'TIPO PRECIO:', value: priceTypeLabel },
          { label: 'VENDEDOR:', value: sale.user?.name || sale.user?.username || 'N/A' },
        ].map((row, i) => (
          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: '11px', fontFamily: 'inherit' }}>{row.label}</Typography>
            <Typography sx={{ fontSize: row.size || '11px', fontFamily: 'inherit', fontWeight: row.bold ? 'bold' : 'normal' }}>
              {row.value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ borderTop: '1px dashed #000', mb: 1 }} />

      {/* Header de items */}
      <Box sx={{ 
        display: 'flex', 
        py: 0.5, 
        borderTop: '1px solid #000',
        borderBottom: '1px solid #000',
        bgcolor: '#f5f5f5',
        fontSize: '9px',
        fontWeight: 'bold'
      }}>
        <Box sx={{ flex: 1 }}>DESCRIPCIÓN</Box>
        <Box sx={{ width: '30px', textAlign: 'center' }}>CANT</Box>
        <Box sx={{ width: '50px', textAlign: 'right' }}>P.UNIT</Box>
        <Box sx={{ width: '55px', textAlign: 'right' }}>TOTAL</Box>
      </Box>

      {/* Items */}
      {sale.items.map((item, index) => {
        const name = item.product?.name || item.productName || 'Producto';
        const presentation = item.presentation?.name || item.presentationName;
        const subtotal = item.subtotal ?? (item.quantity * item.unitPrice);
        const displayName = name.length > 14 ? name.substring(0, 14) + '.' : name;
        
        return (
          <Box key={index} sx={{ 
            display: 'flex', 
            alignItems: 'flex-start',
            py: 0.5,
            borderBottom: '1px dotted #ccc',
            fontSize: '10px'
          }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase' }}>
                {displayName}
              </Typography>
              {presentation && (
                <Typography sx={{ fontSize: '8px', color: '#555' }}>({presentation})</Typography>
              )}
            </Box>
            <Box sx={{ width: '30px', textAlign: 'center' }}>{item.quantity}</Box>
            <Box sx={{ width: '50px', textAlign: 'right' }}>${formatCOP(item.unitPrice)}</Box>
            <Box sx={{ width: '55px', textAlign: 'right', fontWeight: 'bold' }}>${formatCOP(subtotal)}</Box>
          </Box>
        );
      })}

      <Box sx={{ borderTop: '1px dashed #000', mt: 1, mb: 1 }} />

      {/* Totales */}
      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3, fontSize: '11px' }}>
          <span>SUBTOTAL:</span>
          <span>$ {formatCOP(productsSubtotal)}</span>
        </Box>
        {domicilio > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3, fontSize: '11px' }}>
            <span>DOMICILIO:</span>
            <span>$ {formatCOP(domicilio)}</span>
          </Box>
        )}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          py: 1,
          my: 0.5,
          borderTop: '2px solid #000',
          borderBottom: '2px solid #000',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          <span>TOTAL:</span>
          <span>$ {formatCOP(sale.total)}</span>
        </Box>
      </Box>

      {/* Método de pago */}
      {sale.paymentMethod && (
        <Box sx={{ bgcolor: '#f9f9f9', p: 1, borderRadius: 1, mb: 1.5, fontSize: '10px' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
            <span>MÉTODO DE PAGO:</span>
            <strong>{paymentLabel}</strong>
          </Box>
          {sale.paymentMethod === 'efectivo' && sale.cashReceived != null && sale.cashReceived > 0 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                <span>EFECTIVO RECIBIDO:</span>
                <span>$ {formatCOP(sale.cashReceived)}</span>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>CAMBIO:</span>
                <strong>$ {formatCOP(sale.change || 0)}</strong>
              </Box>
            </>
          )}
        </Box>
      )}

      {/* Footer */}
      <Box sx={{ textAlign: 'center', pt: 1, borderTop: '1px dashed #000' }}>
        <Typography sx={{ fontWeight: 'bold', fontSize: '12px', mb: 0.5 }}>
          ¡GRACIAS POR SU COMPRA!
        </Typography>
        <Typography sx={{ fontSize: '8px', color: '#555' }}>
          Conserve este recibo como comprobante de pago
        </Typography>
        <Typography sx={{ fontSize: '7px', color: '#999', mt: 1 }}>
          DISTRIZORA POS • {formatDate(sale.createdAt)}
        </Typography>
      </Box>
    </Box>
  );
});

ReceiptContent.displayName = 'ReceiptContent';

export default function ReceiptDialog({ open, onClose, sale }: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printing, setPrinting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  // Imprimir directamente a la impresora POS via backend CUPS
  const handleDirectPrint = async () => {
    if (!sale) return;
    
    setPrinting(true);
    
    try {
      const result = await api.post<{ success: boolean; printer?: string; error?: string }>(`/sales/${sale.id}/print`);
      
      if (result.success) {
        setSnackbar({
          open: true,
          message: `✅ Impreso en: ${result.printer || 'impresora'}`,
          severity: 'success'
        });
      } else {
        throw new Error(result.error || 'Error desconocido');
      }
    } catch (err) {
      const error = err as Error;
      console.error('Error al imprimir:', error);
      setSnackbar({
        open: true,
        message: `❌ Error: ${error.message || 'No se pudo imprimir'}`,
        severity: 'error'
      });
    } finally {
      setPrinting(false);
    }
  };

  const handlePrint = () => {
    if (!sale) return;

    // Crear contenido HTML para impresión
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const formatTime = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const productsSubtotal = sale.subtotal || sale.items.reduce((acc, item) => 
      acc + (item.subtotal ?? (item.quantity * item.unitPrice)), 0);
    const domicilio = sale.domicilio || 0;
    const saleNumberStr = sale.saleNumber ? String(sale.saleNumber).padStart(6, '0') : '------';
    const priceTypeLabel = sale.priceType === 'sanAlas' ? 'SAN ALAS' : sale.priceType === 'empleados' ? 'EMPLEADOS' : 'PÚBLICO';
    const paymentLabel = sale.paymentMethod === 'efectivo' ? 'EFECTIVO' : 
                         sale.paymentMethod === 'transferencia' ? 'TRANSFERENCIA' :
                         sale.paymentMethod === 'fiado' ? 'FIADO' : 
                         (sale.paymentMethod || 'N/A').toUpperCase();

    // Generar HTML de los items
    const itemsHtml = sale.items.map((item) => {
      const name = item.product?.name || item.productName || 'Producto';
      const presentation = item.presentation?.name || item.presentationName;
      const subtotal = item.subtotal ?? (item.quantity * item.unitPrice);
      const displayName = name.length > 16 ? name.substring(0, 16) + '.' : name;
      
      return `
        <div class="item-row">
          <div class="item-name">
            ${displayName.toUpperCase()}
            ${presentation ? `<div class="item-presentation">(${presentation})</div>` : ''}
          </div>
          <span class="item-qty">${item.quantity}</span>
          <span class="item-price">$${formatCOP(item.unitPrice)}</span>
          <span class="item-total">$${formatCOP(subtotal)}</span>
        </div>
      `;
    }).join('');

    // Generar sección de pago
    let paymentHtml = '';
    if (sale.paymentMethod) {
      paymentHtml = `
        <div class="payment-section">
          <div class="total-row">
            <span>MÉTODO DE PAGO:</span>
            <span style="font-weight: bold;">${paymentLabel}</span>
          </div>
          ${sale.paymentMethod === 'efectivo' && sale.cashReceived != null && sale.cashReceived > 0 ? `
            <div class="total-row">
              <span>EFECTIVO RECIBIDO:</span>
              <span>$ ${formatCOP(sale.cashReceived)}</span>
            </div>
            <div class="total-row">
              <span>CAMBIO:</span>
              <span style="font-weight: bold;">$ ${formatCOP(sale.change || 0)}</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    const printWindow = window.open('', '_blank', 'width=400,height=700');
    
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Recibo #${saleNumberStr}</title>
          <meta charset="UTF-8">
          <style>${getPrintStyles()}</style>
        </head>
        <body>
          <div class="receipt">
            <!-- Header con logo -->
            <div class="header">
              <img 
                src="/assets/logo.png" 
                alt="DISTRIZORA" 
                class="logo"
                onerror="this.style.display='none'; document.getElementById('logo-fallback').style.display='block';"
              />
              <div id="logo-fallback" style="display: none;">
                <div class="company-name">DISTRIZORA</div>
                <div class="company-subtitle">INSUMOS PARA COMIDAS RÁPIDAS</div>
              </div>
            </div>

            <hr class="divider-double" />

            <!-- Información de la venta -->
            <div class="info-section">
              <div class="info-row">
                <span class="info-label">VENTA No:</span>
                <span class="info-value sale-number">${saleNumberStr}</span>
              </div>
              <div class="info-row">
                <span class="info-label">FECHA:</span>
                <span class="info-value">${formatDate(sale.createdAt)} ${formatTime(sale.createdAt)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">TIPO PRECIO:</span>
                <span class="info-value">${priceTypeLabel}</span>
              </div>
              <div class="info-row">
                <span class="info-label">VENDEDOR:</span>
                <span class="info-value">${sale.user?.name || sale.user?.username || 'N/A'}</span>
              </div>
            </div>

            <hr class="divider" />

            <!-- Encabezado de productos -->
            <div class="items-header">
              <span>DESCRIPCIÓN</span>
              <span>CANT</span>
              <span>P.UNIT</span>
              <span>TOTAL</span>
            </div>

            <!-- Lista de productos -->
            <div class="items-list">
              ${itemsHtml}
            </div>

            <hr class="divider" />

            <!-- Totales -->
            <div class="totals-section">
              <div class="total-row">
                <span>SUBTOTAL:</span>
                <span>$ ${formatCOP(productsSubtotal)}</span>
              </div>
              ${domicilio > 0 ? `
                <div class="total-row">
                  <span>DOMICILIO:</span>
                  <span>$ ${formatCOP(domicilio)}</span>
                </div>
              ` : ''}
              <div class="total-row grand-total">
                <span>TOTAL:</span>
                <span>$ ${formatCOP(sale.total)}</span>
              </div>
            </div>

            ${paymentHtml}

            <!-- Footer -->
            <div class="footer">
              <div class="footer-thanks">¡GRACIAS POR SU COMPRA!</div>
              <div class="footer-note">Conserve este recibo como comprobante de pago</div>
              <div class="footer-system">DISTRIZORA POS • ${formatDate(sale.createdAt)}</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 300);
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
          onClick={handleDirectPrint} 
          variant="contained" 
          color="primary"
          startIcon={printing ? <CircularProgress size={18} color="inherit" /> : <Print />}
          disabled={printing}
          sx={{ minWidth: 140 }}
        >
          {printing ? 'IMPRIMIENDO...' : 'IMPRIMIR'}
        </Button>
      </DialogActions>
      
      {/* Snackbar de notificación */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity} 
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}
