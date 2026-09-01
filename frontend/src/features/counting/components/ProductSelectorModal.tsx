import React, { useState } from 'react';
import { Dialog, Combobox } from '@headlessui/react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Product } from '@/types';

interface ProductSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (products: Product[]) => void;
  initialSelection?: Product[];
}

export const ProductSelectorModal: React.FC<ProductSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialSelection = []
}) => {
  const [query, setQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>(initialSelection);
  
  // TODO: Integrar com API para buscar produtos
  const products: Product[] = [];
  
  const filteredProducts = query === '' 
    ? products 
    : products.filter(product => 
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.code.toLowerCase().includes(query.toLowerCase())
      );

  const toggleProductSelection = (product: Product) => {
    setSelectedProducts(prev => 
      prev.some(p => p.id === product.id)
        ? prev.filter(p => p.id !== product.id)
        : [...prev, product]
    );
  };

  const handleSubmit = () => {
    onSelect(selectedProducts);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
          <div className="flex justify-between items-start mb-4">
            <Dialog.Title className="text-xl font-semibold text-gray-900">
              Selecionar Produtos
            </Dialog.Title>
            <button 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          <div className="mb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <Combobox>
                <Combobox.Input
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Buscar produtos..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </Combobox>
            </div>
          </div>
          
          <div className="mb-6 max-h-96 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum produto encontrado
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredProducts.map(product => (
                  <li key={product.id} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{product.name}</div>
                      <div className="text-sm text-gray-500">{product.code}</div>
                    </div>
                    <button
                      onClick={() => toggleProductSelection(product)}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${selectedProducts.some(p => p.id === product.id) 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-gray-100 text-gray-800'}`}
                    >
                      {selectedProducts.some(p => p.id === product.id) ? 'Selecionado' : 'Selecionar'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Confirmar ({selectedProducts.length} produtos)
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};
