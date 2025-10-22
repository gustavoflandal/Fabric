import React from 'react';
import { useNavigate } from 'react-router-dom';

export const CountingSessionsPage: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Sessões de Contagem</h1>
      
      {/* TODO: Listar sessões existentes */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        Lista de sessões será exibida aqui
      </div>
    </div>
  );
};
