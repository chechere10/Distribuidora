import { formatCOP, toNumber } from './format';
import iconv from 'iconv-lite';

function esc(...codes: number[]) {
  return Buffer.from(codes);
}

function txt(s: string) {
  // Usar CP437 para compatibilidad básica
  return iconv.encode(s + '\n', 'cp437');
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


