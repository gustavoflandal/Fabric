import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PlusIcon } from '@heroicons/react/24/outline';

export const CountingPlansPage: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Planos de Contagem</h1>
        <Button onClick={() => navigate('/counting/plans/new')}>
          <PlusIcon className="h-5 w-5 mr-2" /> Novo Plano
        </Button>
      </div>
      
      {/* TODO: Listar planos existentes */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        Lista de planos será exibida aqui
      </div>
    </div>
  );
};
