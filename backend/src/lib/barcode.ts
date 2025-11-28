import { customAlphabet } from 'nanoid';
import bwipjs from 'bwip-js';
import { PrismaClient } from '@prisma/client';

// Generador de códigos de barras únicos
// Solo números, longitud 12 - compatible con CODE128 y pistolas lectoras
const nanoid = customAlphabet('0123456789', 12);

/**
 * Genera un código de barras numérico único de 12 dígitos
 * Compatible con cualquier pistola lectora de códigos de barras
 * Formato: CODE128 (números puros)
 * NOTA: Esta función NO valida unicidad. Usar generateUniqueBarcode() en su lugar.
 */
export function generateBarcode(): string {
  return nanoid();
}

/**
 * Genera un código de barras EAN-13 válido con dígito de verificación
 * Prefijo 20 para uso interno
 */
export function generateEAN13(): string {
  const prefix = '20';
  const random = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
  const partial = prefix + random;
  
  // Calcular dígito de verificación EAN-13
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(partial[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return partial + checkDigit;
}

/**
 * Genera un código de barras ÚNICO verificando que no exista en la base de datos
 * @param prisma - Cliente de Prisma
 * @param maxAttempts - Máximo intentos antes de fallar (default: 100)
 * @returns Código de barras único garantizado
 */
export async function generateUniqueBarcode(
  prisma: PrismaClient,
  maxAttempts: number = 100
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const barcode = generateEAN13();
    
    // Verificar en productos
    const existingProduct = await prisma.product.findUnique({ 
      where: { barcode },
      select: { id: true }
    });
    
    // Verificar en presentaciones
    const existingPresentation = await prisma.productPresentation.findUnique({ 
      where: { barcode },
      select: { id: true }
    });
    
    if (!existingProduct && !existingPresentation) {
      return barcode;
    }
  }
  
  throw new Error(`No se pudo generar un código único después de ${maxAttempts} intentos`);
}

/**
 * Genera un código de barras con prefijo personalizado
 * Útil para diferenciar productos vs presentaciones
 * 
 * @param prefix - Prefijo (ej: "P" para productos, "R" para presentaciones)
 * @param length - Longitud de la parte numérica (default: 11)
 */
export function generatePrefixedBarcode(prefix: string = '', length: number = 11): string {
  const customNanoid = customAlphabet('0123456789', length);
  return prefix + customNanoid();
}

/**
 * Valida si un código de barras tiene formato válido
 * Acepta códigos numéricos de 8-20 dígitos
 */
export function isValidBarcode(barcode: string): boolean {
  return /^\d{8,20}$/.test(barcode);
}

/**
 * Genera una imagen PNG del código de barras
 * Formato CODE128 - compatible con pistolas lectoras
 * 
 * @param barcode - El código de barras a convertir en imagen
 * @returns Buffer con la imagen PNG
 */
export async function barcodeToPng(barcode: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: 'code128',       // Tipo de código de barras
    text: barcode,         // Texto a codificar
    scale: 3,              // Escala de la imagen
    height: 12,            // Altura en mm
    includetext: true,     // Incluir texto debajo del código
    textxalign: 'center',  // Centrar texto
    backgroundcolor: 'ffffff', // Fondo blanco
  });
}

/**
 * Genera múltiples imágenes de códigos de barras
 * Útil para imprimir etiquetas en lote
 */
export async function barcodesBatchToPng(barcodes: string[]): Promise<Map<string, Buffer>> {
  const results = new Map<string, Buffer>();
  
  for (const barcode of barcodes) {
    try {
      const png = await barcodeToPng(barcode);
      results.set(barcode, png);
    } catch (error) {
      console.error(`Error generando imagen para código ${barcode}:`, error);
    }
  }
  
  return results;
}
