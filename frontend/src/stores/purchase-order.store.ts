import { defineStore } from 'pinia';
import { ref } from 'vue';
import purchaseOrderService, {
  type PurchaseOrder,
  type CreatePurchaseOrderDto,
} from '@/services/purchase-order.service';

export const usePurchaseOrderStore = defineStore('purchaseOrder', () => {
  const orders = ref<PurchaseOrder[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchOrders(filters?: {
    supplierId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.getAll(1, 1000, filters);
      orders.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar pedidos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getOrderById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar pedido';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createOrder(data: CreatePurchaseOrderDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.create(data);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar pedido';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createFromQuotation(quotationId: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.createFromQuotation(quotationId);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar pedido a partir do orçamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateOrder(id: string, data: Partial<CreatePurchaseOrderDto>) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.update(id, data);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar pedido';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateStatus(id: string, status: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.updateStatus(id, status);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar status';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function approveOrder(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.approve(id);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao aprovar pedido';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function confirmOrder(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.confirm(id);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao confirmar pedido';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function cancelOrder(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.cancel(id);
      await fetchOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao cancelar pedido';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteOrder(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await purchaseOrderService.delete(id);
      orders.value = orders.value.filter((o) => o.id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir pedido';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getBySupplier(supplierId: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.getBySupplier(supplierId);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar pedidos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getPendingOrders() {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseOrderService.getPendingOrders();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar pedidos pendentes';
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
    createFromQuotation,
    updateOrder,
    updateStatus,
    approveOrder,
    confirmOrder,
    cancelOrder,
    deleteOrder,
    getBySupplier,
    getPendingOrders,
  };
});
