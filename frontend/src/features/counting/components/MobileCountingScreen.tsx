import React, { useState } from 'react';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { Button } from '@/components/ui/button';

interface CountingItem {
  id: string;
  productCode: string;
  productName: string;
  systemQty: number;
  countedQty: number | null;
}

interface MobileCountingScreenProps {
  items: CountingItem[];
  onCount: (itemId: string, qty: number) => void;
  onSubmit: () => void;
}

export const MobileCountingScreen: React.FC<MobileCountingScreenProps> = ({ 
  items, 
  onCount,
  onSubmit 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countedQty, setCountedQty] = useState<string>('');
  
  const currentItem = items[currentIndex];
  
  useBarcodeScanner((barcode) => {
    // TODO: Validar se o código corresponde ao produto atual
    // Focar no campo de quantidade após leitura
    document.getElementById('qty-input')?.focus();
  });

  const handleQtyChange = (value: string) => {
    // Permitir apenas números e ponto decimal
    if (/^\d*\.?\d*$/.test(value)) {
      setCountedQty(value);
    }
  };

  const handleConfirm = () => {
    if (countedQty && currentItem) {
      onCount(currentItem.id, parseFloat(countedQty));
      setCountedQty('');
      
      // Avançar para o próximo item
      if (currentIndex < items.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="text-center mb-2 text-sm text-gray-500">
          Item {currentIndex + 1} de {items.length}
        </div>
        <div className="text-center mb-4">
          <div className="font-bold text-lg">{currentItem?.productName}</div>
          <div className="text-gray-600">{currentItem?.productCode}</div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-blue-700">Sistema</div>
            <div className="text-2xl font-bold">{currentItem?.systemQty}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-green-700">Contado</div>
            <div className="text-2xl font-bold">{currentItem?.countedQty || '-'}</div>
          </div>
        </div>
        
        <div className="mb-4">
          <label htmlFor="qty-input" className="block text-sm font-medium text-gray-700 mb-1">
            Quantidade Contada
          </label>
          <input
            id="qty-input"
            type="text"
            inputMode="decimal"
            value={countedQty}
            onChange={(e) => handleQtyChange(e.target.value)}
            className="w-full p-4 text-3xl border border-gray-300 rounded-lg text-center"
            autoFocus
          />
        </div>
        
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, '⌫'].map(key => (
            <button
              key={key}
              onClick={() => {
                if (key === '⌫') {
                  setCountedQty(prev => prev.slice(0, -1));
                } else {
                  setCountedQty(prev => prev + key.toString());
                }
              }}
              className="p-3 bg-gray-100 text-xl rounded-lg hover:bg-gray-200"
            >
              {key}
            </button>
          ))}
        </div>
        
        <Button 
          onClick={handleConfirm}
          className="w-full py-4 text-lg"
          disabled={!countedQty}
        >
          Confirmar
        </Button>
      </div>
      
      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
        >
          Anterior
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setCurrentIndex(prev => Math.min(items.length - 1, prev + 1))}
          disabled={currentIndex === items.length - 1}
        >
          Próximo
        </Button>
        <Button onClick={onSubmit}>Finalizar Contagem</Button>
      </div>
    </div>
  );
};
