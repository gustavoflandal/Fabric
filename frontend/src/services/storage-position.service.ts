import api from './api';

export const storagePositionService = {
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
  }
};
