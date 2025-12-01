import { formatCOP, toNumber } from './format';
import iconv from 'iconv-lite';

function esc(...codes: number[]) {
  return Buffer.from(codes);
}

function txt(s: string) {
  // Usar CP437 para compatibilidad básica
  return iconv.encode(s + '\n', 'cp437');
}

// Función para centrar texto en un ancho dado
function centerText(text: string, width: number = 42): string {
  if (text.length >= width) return text.substring(0, width);
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(padding) + text;
}

function rightAlign(text: string, width: number = 42): string {
  if (text.length >= width) return text.substring(0, width);
  const padding = width - text.length;
  return ' '.repeat(padding) + text;
}

function padBetween(left: string, right: string, width: number = 42): string {
  const space = width - left.length - right.length;
  if (space <= 0) return left.substring(0, width - right.length - 1) + ' ' + right;
  return left + ' '.repeat(space) + right;
}

// Versión TEXTO PLANO para impresoras POS 80mm via CUPS
export function buildSaleTicketText(sale: any): string {
  const lines: string[] = [];
  const WIDTH = 42; // Ancho típico para impresora térmica 80mm
  const LINE_DOUBLE = '='.repeat(WIDTH);
  const LINE_SINGLE = '-'.repeat(WIDTH);
  const LINE_DOT = '.'.repeat(WIDTH);
  
  // Formatear fecha y hora
  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
  
  // Número de venta
  const saleNumber = sale.saleNumber ? String(sale.saleNumber).padStart(6, '0') : String(sale.id).slice(-6).toUpperCase();
  
  // Tipo de precio
  const priceType = sale.priceType === 'sanAlas' ? 'SAN ALAS' : 
                    sale.priceType === 'empleados' ? 'EMPLEADOS' : 'PUBLICO';
  
  // Método de pago
  const paymentMethod = sale.paymentMethod === 'efectivo' ? 'EFECTIVO' : 
                        sale.paymentMethod === 'transferencia' ? 'TRANSFERENCIA' :
                        sale.paymentMethod === 'fiado' ? 'FIADO' : 
                        (sale.paymentMethod || 'N/A').toUpperCase();

  // ========== HEADER ==========
  lines.push(centerText('*** DISTRIZORA ***', WIDTH));
  lines.push(centerText('Insumos para comidas rapidas', WIDTH));
  lines.push(LINE_DOUBLE);
  
  // ========== INFO DE VENTA ==========
  lines.push(padBetween('VENTA No:', saleNumber, WIDTH));
  lines.push(padBetween('FECHA:', `${dateStr} ${timeStr}`, WIDTH));
  lines.push(padBetween('TIPO PRECIO:', priceType, WIDTH));
  lines.push(padBetween('VENDEDOR:', sale.user?.name || sale.user?.username || 'N/A', WIDTH));
  lines.push(LINE_SINGLE);
  
  // ========== ENCABEZADO DE PRODUCTOS ==========
  // DESCRIPCION         CANT   P.UNIT    TOTAL
  lines.push('DESCRIPCION              CANT  P.UNIT   TOTAL');
  lines.push(LINE_SINGLE);

  // ========== PRODUCTOS ==========
  let subtotal = 0;
  for (const it of sale.items || []) {
    const name = (it.product?.name ?? 'Producto').toUpperCase();
    const qty = Number(it.quantity);
    const price = toNumber(it.unitPrice as any);
    const itemSubtotal = toNumber(it.subtotal as any) || (qty * price);
    subtotal += itemSubtotal;
    
    // Nombre del producto (máximo 24 caracteres)
    const displayName = name.length > 24 ? name.substring(0, 23) + '.' : name;
    lines.push(displayName);
    
    // Presentación si existe
    if (it.presentation?.name) {
      lines.push(`  (${it.presentation.name})`);
    }
    
    // Cantidad, precio unitario y total alineados a la derecha
    const qtyStr = String(qty);
    const priceStr = '$' + formatCOP(price);
    const totalStr = '$' + formatCOP(itemSubtotal);
    
    // Formato: espacios + CANT + espacios + PRECIO + espacios + TOTAL
    const detailLine = rightAlign(`${qtyStr}    ${priceStr}    ${totalStr}`, WIDTH);
    lines.push(detailLine);
  }
  
  lines.push(LINE_SINGLE);
  
  // ========== TOTALES ==========
  lines.push(padBetween('SUBTOTAL:', '$ ' + formatCOP(subtotal), WIDTH));
  
  // Domicilio si existe
  const domicilio = toNumber(sale.domicilio || 0);
  if (domicilio > 0) {
    lines.push(padBetween('DOMICILIO:', '$ ' + formatCOP(domicilio), WIDTH));
  }
  
  lines.push(LINE_DOUBLE);
  const total = toNumber(sale.total as any);
  lines.push(padBetween('TOTAL:', '$ ' + formatCOP(total), WIDTH));
  lines.push(LINE_DOUBLE);
  
  // ========== INFO DE PAGO ==========
  lines.push(padBetween('METODO DE PAGO:', paymentMethod, WIDTH));
  
  if (sale.paymentMethod === 'efectivo' && sale.cashReceived) {
    const cashReceived = toNumber(sale.cashReceived);
    const change = toNumber(sale.change || 0);
    if (cashReceived > 0) {
      lines.push(padBetween('EFECTIVO RECIBIDO:', '$ ' + formatCOP(cashReceived), WIDTH));
      lines.push(padBetween('CAMBIO:', '$ ' + formatCOP(change), WIDTH));
    }
  }
  
  lines.push(LINE_SINGLE);
  
  // ========== FOOTER ==========
  lines.push('');
  lines.push(centerText('*** GRACIAS POR SU COMPRA! ***', WIDTH));
  lines.push('');
  lines.push(centerText('Conserve este recibo como', WIDTH));
  lines.push(centerText('comprobante de pago', WIDTH));
  lines.push('');
  lines.push(centerText(`DISTRIZORA POS - ${dateStr}`, WIDTH));
  
  // Líneas extra al final para que no corte el mensaje
  lines.push('');
  lines.push('');
  lines.push('');
  lines.push('');
  lines.push('');
  lines.push('');  // 6 líneas extra para avance de papel
  
  return lines.join('\n');
}

export function buildSaleTicketEscpos(sale: any): Uint8Array {
  const out: Buffer[] = [];
  // Initialize, codepage cp437
  out.push(esc(0x1B, 0x40)); // ESC @
  out.push(esc(0x1B, 0x74, 0x00)); // ESC t 0 (cp437)

  // Center + bold title
  out.push(esc(0x1B, 0x61, 0x01)); // ESC a 1 (center)
  out.push(esc(0x1B, 0x45, 0x01)); // ESC E 1 (bold on)
  out.push(txt('Distribuidora Zora'));
  out.push(esc(0x1B, 0x45, 0x00)); // bold off
  out.push(txt('Venta'));
  out.push(txt(`# ${String(sale.id).slice(-6).toUpperCase()}`));
  out.push(txt(new Date(sale.createdAt).toLocaleString('es-CO')));
  out.push(txt(''));

  // Rule
  out.push(esc(0x1B, 0x61, 0x00)); // left
  out.push(txt('--------------------------------'));
  out.push(txt('Detalle'));

  for (const it of sale.items || []) {
    const name = (it.product?.name ?? it.productId).replaceAll('é', 'e');
    const qty = it.quantity;
    const price = toNumber(it.unitPrice as any);
    const subtotal = toNumber(it.subtotal as any);
    out.push(txt(name));
    out.push(esc(0x1B, 0x61, 0x02)); // right
    out.push(txt(`${qty} x ${formatCOP(price)} = ${formatCOP(subtotal)}`));
    out.push(esc(0x1B, 0x61, 0x00)); // left
  }

  out.push(txt('--------------------------------'));
  const total = toNumber(sale.total as any);
  out.push(esc(0x1B, 0x61, 0x02)); // right
  out.push(esc(0x1B, 0x45, 0x01)); // bold
  out.push(txt(`Total: ${formatCOP(total)}`));
  out.push(esc(0x1B, 0x45, 0x00)); // bold off

  out.push(esc(0x1B, 0x61, 0x01)); // center
  out.push(txt('Gracias por su compra'));
  if (sale.warehouse?.name) out.push(txt(`Almacen: ${sale.warehouse.name}`));
  out.push(txt(''));
  out.push(txt(''));

  // Cut
  out.push(esc(0x1D, 0x56, 0x00)); // GS V 0 (full cut)
  return Buffer.concat(out);
}


