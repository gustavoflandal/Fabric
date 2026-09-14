import { defineStore } from 'pinia';
import { ref } from 'vue';
import salesOrderService from '@/services/sales-order.service';
import type { Pagination } from '@/types/warehouse.types';
import type {
  CreateSalesOrderDto,
  SalesOrder,
  SalesOrderFilters,
  UpdateSalesOrderDto,
} from '@/types/sales.types';
import { SHIPPABLE_SALES_ORDER_STATUSES } from '@/types/sales.types';

const EMPTY_PAGINATION: Pagination = { page: 1, limit: 20, total: 0, pages: 0 };

export const useSalesOrderStore = defineStore('salesOrder', () => {
  const orders = ref<SalesOrder[]>([]);
  const pagination = ref<Pagination>({ ...EMPTY_PAGINATION });
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * DIFERENÇA DELIBERADA em relação a `purchase-order.store.ts`: as mutações
   * NÃO chamam `fetchOrders()` sozinhas. Lá o refetch é sem argumentos e
   * descarta silenciosamente filtro e página; aqui a tela é paginada e
   * filtrada, então quem sabe em que página/filtro está é a view — ela recarrega
   * com os próprios parâmetros depois de cada ação.
   */
  async function fetchOrders(page = 1, limit = 20, filters?: SalesOrderFilters) {
    loading.value = true;
    error.value = null;
    try {
      const response = await salesOrderService.getAll(page, limit, filters);
      const items: SalesOrder[] = response.data.data ?? [];
      orders.value = items;
      pagination.value = response.data.pagination ?? { ...EMPTY_PAGINATION, page, limit };
      return { items, pagination: pagination.value };
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar pedidos de venda';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Os pedidos que o backend aceita romanear hoje (CONFIRMED + SEPARATING).
   * Duas chamadas porque `GET /sales-orders` filtra por UM status; o resultado
   * NÃO toca `orders`/`pagination` — é uma consulta auxiliar da tela de
   * romaneios, não a lista da tela de pedidos.
   */
  async function fetchShippableOrders(limit = 100): Promise<SalesOrder[]> {
    const responses = await Promise.all(
      SHIPPABLE_SALES_ORDER_STATUSES.map((status) =>
        salesOrderService.getAll(1, limit, { status })
      )
    );
    return responses.flatMap((response) => (response.data.data ?? []) as SalesOrder[]);
  }

  async function getOrderById(id: string): Promise<SalesOrder> {
    loading.value = true;
    error.value = null;
    try {
      const response = await salesOrderService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar pedido de venda';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createOrder(data: CreateSalesOrderDto): Promise<SalesOrder> {
    loading.value = true;
    error.value = null;
    try {
      const response = await salesOrderService.create(data);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar pedido de venda';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateOrder(id: string, data: UpdateSalesOrderDto): Promise<SalesOrder> {
    loading.value = true;
    error.value = null;
    try {
      const response = await salesOrderService.update(id, data);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar pedido de venda';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function confirmOrder(id: string): Promise<SalesOrder> {
    loading.value = true;
    error.value = null;
    try {
      const response = await salesOrderService.confirm(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao confirmar pedido de venda';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function cancelOrder(id: string): Promise<SalesOrder> {
    loading.value = true;
    error.value = null;
    try {
      const response = await salesOrderService.cancel(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao cancelar pedido de venda';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteOrder(id: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      await salesOrderService.delete(id);
      orders.value = orders.value.filter((order) => order.id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir pedido de venda';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    orders,
    pagination,
    loading,
    error,
    fetchOrders,
    fetchShippableOrders,
    getOrderById,
    createOrder,
    updateOrder,
    confirmOrder,
    cancelOrder,
    deleteOrder,
  };
});
