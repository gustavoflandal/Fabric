import api from './api.service';
import type { StoragePositionFilters } from '@/types/warehouse.types';

export const storagePositionService = {
  /**
   * Tarefa 1 (tela de Localizações): browse/busca paginada entre
   * armazéns/estruturas, via `GET /storage-positions` (rota RAIZ, sem
   * `:structureId` no path — não colide com `getPositions(structureId)`
   * abaixo).
   */
  async searchPositions(filters: StoragePositionFilters = {}, page = 1, limit = 20) {
    const response = await api.get('/storage-positions', {
      params: { ...filters, page, limit }
    });
    return response.data;
  },

  /**
   * F2.4: histórico de movimentação de um endereço. Espelha a assinatura do
   * endpoint (`limit`, `productId` opcionais).
   */
  async getMovements(positionId: string, params?: { limit?: number; productId?: string }) {
    const response = await api.get(`/storage-positions/${positionId}/movements`, { params });
    return response.data;
  },

  async generatePositions(structureId: string) {
    const response = await api.post(`/storage-positions/${structureId}/generate`);
    return response.data;
  },

  async getPositions(structureId: string) {
    const response = await api.get(`/storage-positions/${structureId}`);
    return response.data;
  },

  async deletePositions(structureId: string) {
    const response = await api.delete(`/storage-positions/${structureId}`);
    return response.data;
  },

  async updatePosition(positionId: string, data: any) {
    const response = await api.put(`/storage-positions/position/${positionId}`, data);
    return response.data;
  },

  async deletePosition(positionId: string) {
    const response = await api.delete(`/storage-positions/position/${positionId}`);
    return response.data;
  },

  async getPositionByCode(code: string) {
    const response = await api.get(`/storage-positions/by-code/${code}`);
    return response.data;
  }
};
