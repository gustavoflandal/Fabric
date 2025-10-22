import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Product } from '@/types';

interface CountingPlanPreviewProps {
  products: Product[];
  onPriorityChange: (products: Product[]) => void;
  onRemove: (productId: string) => void;
}

export const CountingPlanPreview: React.FC<CountingPlanPreviewProps> = ({ 
  products,
  onPriorityChange,
  onRemove
}) => {
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(products);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onPriorityChange(items);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 p-3 border-b border-gray-200">
        <h3 className="font-medium">Produtos Selecionados ({products.length})</h3>
      </div>
      
      {products.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          Nenhum produto selecionado
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="products">
            {(provided) => (
              <div 
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="divide-y divide-gray-200"
              >
                {products.map((product, index) => (
                  <Draggable key={product.id} draggableId={product.id} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="flex items-center justify-between p-3 bg-white"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.code}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => onRemove(product.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
};
