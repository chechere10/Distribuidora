export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function toNumber(numericStringOrNumber: any): number {
  if (numericStringOrNumber == null) return 0;
  const n = Number(numericStringOrNumber);
  return Number.isFinite(n) ? n : 0;
}
