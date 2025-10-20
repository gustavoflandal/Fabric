import { defineStore } from 'pinia';
import { ref } from 'vue';
import productionPointingService, {
  type ProductionPointing,
  type CreateProductionPointingDto,
} from '@/services/production-pointing.service';

export const useProductionPointingStore = defineStore('productionPointing', () => {
  const pointings = ref<ProductionPointing[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchPointings(filters?: {
    productionOrderId?: string;
    operationId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionPointingService.getAll(1, 1000, filters);
      pointings.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar apontamentos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getPointingById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionPointingService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar apontamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createPointing(data: CreateProductionPointingDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionPointingService.create(data);
      await fetchPointings();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar apontamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updatePointing(id: string, data: Partial<CreateProductionPointingDto>) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionPointingService.update(id, data);
      await fetchPointings();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar apontamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function finishPointing(id: string, data: { endTime: string; goodQuantity: number; scrapQuantity?: number; notes?: string }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionPointingService.finish(id, data);
      await fetchPointings();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao finalizar apontamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deletePointing(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await productionPointingService.delete(id);
      pointings.value = pointings.value.filter((p) => p.id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir apontamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getByOrder(orderId: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionPointingService.getByOrder(orderId);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar apontamentos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getMyPointings(startDate?: string, endDate?: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionPointingService.getMyPointings(startDate, endDate);
      pointings.value = response.data.data;
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar meus apontamentos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    pointings,
    loading,
    error,
    fetchPointings,
    getPointingById,
    createPointing,
    updatePointing,
    finishPointing,
    deletePointing,
    getByOrder,
    getMyPointings,
  };
});
