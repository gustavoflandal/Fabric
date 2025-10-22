import React, { useState } from 'react';
import { ProductSelectorModal } from '@/features/counting/components/ProductSelectorModal';
import { CountingTeamAssigner } from '@/features/counting/components/CountingTeamAssigner';
import { MobileCountingScreen } from '@/features/counting/components/MobileCountingScreen';
import { Product } from '@/types';
import { User } from '@/types';

export const TestCountingPage: React.FC = () => {
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  
  const [counters, setCounters] = useState<{user: User, role: string}[]>([]);
  
  const mockItems: any[] = [
    { id: '1', productCode: 'P001', productName: 'Product 1', systemQty: 100 },
    { id: '2', productCode: 'P002', productName: 'Product 2', systemQty: 200 },
  ];
  
  const mockUsers: User[] = [
    { id: '1', name: 'User 1', email: 'user1@fabric.com' },
    { id: '2', name: 'User 2', email: 'user2@fabric.com' },
  ];
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Test Counting Module</h1>
      
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Product Selector</h2>
        <button 
          onClick={() => setIsProductModalOpen(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Open Product Selector
        </button>
        <ProductSelectorModal
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          onSelect={setSelectedProducts}
          initialSelection={selectedProducts}
        />
        <div className="mt-4">
          <h3 className="font-medium">Selected Products ({selectedProducts.length})</h3>
          <ul>
            {selectedProducts.map(product => (
              <li key={product.id}>{product.name} ({product.code})</li>
            ))}
          </ul>
        </div>
      </section>
      
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Counting Team Assigner</h2>
        <CountingTeamAssigner 
          counters={counters} 
          onChange={setCounters} 
        />
      </section>
      
      <section>
        <h2 className="text-xl font-semibold mb-4">Mobile Counting Screen</h2>
        <MobileCountingScreen 
          items={mockItems}
          onCount={(itemId, qty) => console.log(`Counted item ${itemId}: ${qty}`)}
          onSubmit={() => console.log('Submit counting')}
        />
      </section>
    </div>
  );
};
