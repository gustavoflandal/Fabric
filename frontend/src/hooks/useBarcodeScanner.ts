import { useEffect } from 'react';

export const useBarcodeScanner = (onScan: (barcode: string) => void) => {
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Simular leitura de código de barras (normalmente termina com Enter)
      if (e.key === 'Enter') {
        // TODO: Capturar o valor digitado antes do Enter
        onScan('7891234567890'); // Exemplo
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
    };
  }, [onScan]);

  return null;
};
