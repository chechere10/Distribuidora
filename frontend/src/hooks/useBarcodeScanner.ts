import { useEffect, useRef, useCallback, useState } from 'react';

interface UseBarcodeScanner {
  onScan: (barcode: string) => void;
  enabled?: boolean;
  allowInputFocus?: boolean; // Si es true, también funciona cuando hay inputs enfocados
}

/**
 * Hook para detectar escaneos de código de barras con pistola
 * Las pistolas envían caracteres rápidamente y terminan con Enter (o no)
 */
export function useBarcodeScanner({ onScan, enabled = true, allowInputFocus = false }: UseBarcodeScanner) {
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [buffer, setBuffer] = useState('');
  
  // Usar refs para valores que cambian frecuentemente
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  
  // Mantener onScan actualizado
  onScanRef.current = onScan;

  const processBarcode = useCallback((barcode: string) => {
    if (barcode.length >= 3) {
      setLastScan(barcode);
      try {
        onScanRef.current(barcode);
      } catch (err) {
        console.error('Error en escaneo:', err);
      }
    }
    // Limpiar
    bufferRef.current = '';
    setBuffer('');
    setScannerActive(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Detectar si está en un input
      const activeElement = document.activeElement;
      const isInInput = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).isContentEditable
      );

      // Si es Enter y hay buffer, procesar SIEMPRE
      if (e.key === 'Enter' && bufferRef.current.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        processBarcode(bufferRef.current);
        return;
      }

      // Tab también puede ser usado como terminador
      if (e.key === 'Tab' && bufferRef.current.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        processBarcode(bufferRef.current);
        return;
      }

      // Solo caracteres alfanuméricos y algunos especiales (códigos de barras)
      if (e.key.length === 1 && /^[a-zA-Z0-9\-\_]$/.test(e.key)) {
        // Si está en input y no es escaneo rápido, podría ser escritura manual
        // Pero si allowInputFocus está activo, siempre capturamos
        if (isInInput && !allowInputFocus && timeSinceLastKey > 100 && bufferRef.current.length === 0) {
          return;
        }
        
        // Detectar si es escaneo rápido (pistola)
        const isRapidInput = timeSinceLastKey < 100;
        if (isRapidInput || bufferRef.current.length > 0) {
          setScannerActive(true);
        }

        // Agregar al buffer
        bufferRef.current += e.key;
        setBuffer(bufferRef.current);
        
        // Reset timeout - CLAVE: procesar después de 150ms de inactividad
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        // Auto-procesar después de 150ms de inactividad
        timeoutRef.current = setTimeout(() => {
          const currentBuffer = bufferRef.current;
          
          if (currentBuffer.length >= 5) {
            processBarcode(currentBuffer);
          } else {
            bufferRef.current = '';
            setBuffer('');
            setScannerActive(false);
          }
        }, 150);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, allowInputFocus, processBarcode]);

  return {
    buffer,
    lastScan,
    scannerActive,
  };
}

export default useBarcodeScanner;
