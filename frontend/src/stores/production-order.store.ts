import { defineStore } from 'pinia';
import { ref } from 'vue';
import productionOrderService, {
  type ProductionOrder,
  type CreateProductionOrderDto,
  type UpdateProductionOrderDto,
} from '@/services/production-order.service';

export const useProductionOrderStore = defineStore('productionOrder', () => {
  const orders = ref<ProductionOrder[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchOrders(filters?: {
    status?: string;
    productId?: string;
    priority?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionOrderService.getAll(1, 1000, filters);
      orders.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar ordens de produção';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getOrderById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionOrderService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar ordem de produção';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createOrder(data: CreateProductionOrderDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionOrderService.create(data);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar ordem de produção';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateOrder(id: string, data: UpdateProductionOrderDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionOrderService.update(id, data);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar ordem de produção';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteOrder(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await productionOrderService.delete(id);
      orders.value = orders.value.filter((o) => o.id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir ordem de produção';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function changeStatus(id: string, status: string, notes?: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionOrderService.changeStatus(id, status, notes);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao mudar status da ordem';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateProgress(id: string, producedQuantity: number, scrapQuantity: number = 0) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionOrderService.updateProgress(id, producedQuantity, scrapQuantity);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar progresso';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getOperations(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionOrderService.getOperations(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar operações';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getMaterials(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productionOrderService.getMaterials(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar materiais';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    orders,
    loading,
    error,
    fetchOrders,
    getOrderById,
    createOrder,
    updateOrder,
    deleteOrder,
    changeStatus,
    updateProgress,
    getOperations,
    getMaterials,
  };
});
