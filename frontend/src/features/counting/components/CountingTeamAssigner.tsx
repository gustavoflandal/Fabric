import React, { useState } from 'react';
import { User } from '@/types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface CounterAssignment {
  user: User;
  role: 'PRIMARY' | 'SECONDARY' | 'VALIDATOR' | 'SUPERVISOR';
}

interface CountingTeamAssignerProps {
  counters: CounterAssignment[];
  onChange: (counters: CounterAssignment[]) => void;
}

export const CountingTeamAssigner: React.FC<CountingTeamAssignerProps> = ({ counters, onChange }) => {
  const [availableUsers, setAvailableUsers] = useState<User[]>([]); // TODO: Buscar da API
  
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(counters);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    onChange(items);
  };

  const addCounter = (user: User) => {
    onChange([...counters, { user, role: 'SECONDARY' }]);
  };

  const removeCounter = (userId: string) => {
    onChange(counters.filter(c => c.user.id !== userId));
  };

  const updateRole = (userId: string, role: CounterAssignment['role']) => {
    onChange(counters.map(c => 
      c.user.id === userId ? { ...c, role } : c
    ));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Equipe de Contagem</h3>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="counters">
          {(provided) => (
            <div 
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-2"
            >
              {counters.map((counter, index) => (
                <Draggable key={counter.user.id} draggableId={counter.user.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-700">
                            {counter.user.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{counter.user.name}</div>
                          <div className="text-sm text-gray-500">{counter.user.email}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        <select
                          value={counter.role}
                          onChange={(e) => updateRole(counter.user.id, e.target.value as any)}
                          className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                        >
                          <option value="PRIMARY">Principal</option>
                          <option value="SECONDARY">Secundário</option>
                          <option value="VALIDATOR">Validador</option>
                          <option value="SUPERVISOR">Supervisor</option>
                        </select>
                        <button
                          onClick={() => removeCounter(counter.user.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      
      <div className="mt-6">
        <h4 className="text-md font-medium mb-2">Adicionar Contador</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availableUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-700 text-sm">
                    {user.name.charAt(0)}
                  </span>
                </div>
                <div className="text-sm">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-gray-500">{user.email}</div>
                </div>
              </div>
              <button
                onClick={() => addCounter(user)}
                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200"
              >
                Adicionar
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
