import axios from 'axios';

export const CountingSessionService = {
  // Iniciar sessão de contagem
  startSession: async (sessionId: string) => {
    const response = await axios.patch(`/api/counting/sessions/${sessionId}/start`);
    return response.data;
  },
  
  // Finalizar sessão
  completeSession: async (sessionId: string) => {
    const response = await axios.patch(`/api/counting/sessions/${sessionId}/complete`);
    return response.data;
  },
  
  // Obter itens da sessão
  getItems: async (sessionId: string) => {
    const response = await axios.get(`/api/counting/sessions/${sessionId}/items`);
    return response.data;
  },
  
  // Registrar contagem de um item
  countItem: async (itemId: string, quantity: number) => {
    const response = await axios.post(`/api/counting/items/${itemId}/count`, { quantity });
    return response.data;
  },
  
  // Registrar recontagem
  recountItem: async (itemId: string, quantity: number) => {
    const response = await axios.post(`/api/counting/items/${itemId}/recount`, { quantity });
    return response.data;
  }
};
