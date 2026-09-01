import { defineStore } from 'pinia';
import { ref } from 'vue';
import routingService, { type Routing, type CreateRoutingDto, type UpdateRoutingDto } from '@/services/routing.service';

export const useRoutingStore = defineStore('routing', () => {
  const routings = ref<Routing[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const cachedRoutingsByProduct = ref<Record<string, Routing[]>>({});

  async function fetchRoutings(filters?: { productId?: string; active?: boolean; search?: string }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await routingService.getAll(1, 1000, filters);
      routings.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar roteiros';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchByProduct(productId: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await routingService.getByProduct(productId);
      const routings = response.data.data;
      cachedRoutingsByProduct.value[productId] = routings;
      return routings;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar roteiros do produto';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function getCachedRoutings(productId: string): Routing[] {
    return cachedRoutingsByProduct.value[productId] || [];
  }

  async function getRoutingById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await routingService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar roteiro';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createRouting(data: CreateRoutingDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await routingService.create(data);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar roteiro';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateRouting(id: string, productId: string, data: UpdateRoutingDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await routingService.update(id, data);
      // Atualizar cache
      if (cachedRoutingsByProduct.value[productId]) {
        const index = cachedRoutingsByProduct.value[productId].findIndex((r) => r.id === id);
        if (index !== -1) {
          cachedRoutingsByProduct.value[productId][index] = response.data.data;
        }
      }
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar roteiro';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteRouting(id: string, productId: string) {
    loading.value = true;
    error.value = null;
    try {
      await routingService.delete(id);
      // Remover do cache
      if (cachedRoutingsByProduct.value[productId]) {
        cachedRoutingsByProduct.value[productId] = cachedRoutingsByProduct.value[productId].filter(
          (r) => r.id !== id
        );
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir roteiro';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function setActiveRouting(id: string, productId: string, active: boolean) {
    loading.value = true;
    error.value = null;
    try {
      const response = await routingService.setActive(id, productId, active);
      // Atualizar cache
      if (cachedRoutingsByProduct.value[productId]) {
        cachedRoutingsByProduct.value[productId] = cachedRoutingsByProduct.value[productId].map((r) => ({
          ...r,
          active: r.id === id ? active : false,
        }));
      }
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao ativar/desativar roteiro';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function calculateTotalTime(id: string, quantity: number = 1) {
    loading.value = true;
    error.value = null;
    try {
      const response = await routingService.calculateTotalTime(id, quantity);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao calcular tempo total';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    routings,
    loading,
    error,
    cachedRoutingsByProduct,
    fetchRoutings,
    fetchByProduct,
    getCachedRoutings,
    getRoutingById,
    createRouting,
    updateRouting,
    deleteRouting,
    setActiveRouting,
    calculateTotalTime,
  };
});
