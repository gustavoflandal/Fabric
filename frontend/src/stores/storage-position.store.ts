import { defineStore } from 'pinia';
import { ref } from 'vue';
import { storagePositionService } from '@/services/storage-position.service';
import type { StoragePosition, StoragePositionFilters } from '@/types/warehouse.types';

/** Paginação como o endpoint `GET /storage-positions` devolve (Tarefa 1) — `totalPages`, não `pages` como o resto do projeto. */
export interface StoragePositionSearchPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const useStoragePositionStore = defineStore('storagePosition', () => {
  const positions = ref<StoragePosition[]>([]);
  const loading = ref(false);

  const search = async (
    filters: StoragePositionFilters = {},
    page = 1,
    limit = 20
  ): Promise<{ items: StoragePosition[]; pagination: StoragePositionSearchPagination }> => {
    loading.value = true;
    try {
      const response = await storagePositionService.searchPositions(filters, page, limit);
      const items = response.data?.items ?? [];
      const pagination = response.data?.pagination ?? { page: 1, limit, total: 0, totalPages: 0 };
      positions.value = items;
      return { items, pagination };
    } catch (error) {
      console.error('Erro ao buscar posições:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const updatePosition = async (id: string, data: Record<string, unknown>) => {
    try {
      const response = await storagePositionService.updatePosition(id, data);
      const index = positions.value.findIndex((p) => p.id === id);
      if (index !== -1) {
        positions.value[index] = { ...positions.value[index], ...response.data };
      }
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar posição:', error);
      throw error;
    }
  };

  return {
    positions,
    loading,
    search,
    updatePosition,
  };
});
