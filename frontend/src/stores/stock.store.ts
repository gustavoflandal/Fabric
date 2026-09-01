import { defineStore } from 'pinia';
import { ref } from 'vue';
import stockService, {
  type StockBalance,
  type StockMovement,
  type StockSummary,
  type RegisterMovementDto,
} from '@/services/stock.service';

export const useStockStore = defineStore('stock', () => {
  const balances = ref<StockBalance[]>([]);
  const summary = ref<StockSummary | null>(null);
  const movements = ref<StockMovement[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchSummary() {
    loading.value = true;
    error.value = null;
    try {
      summary.value = await stockService.getSummary();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar resumo do estoque';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchBalances(filters?: {
    status?: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
    type?: string;
    categoryId?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      balances.value = await stockService.getAllBalances(filters);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar saldos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getBalance(productId: string) {
    loading.value = true;
    error.value = null;
    try {
      return await stockService.getBalance(productId);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar saldo';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchLowStock() {
    loading.value = true;
    error.value = null;
    try {
      balances.value = await stockService.getLowStock();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar produtos com estoque baixo';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchExcessStock() {
    loading.value = true;
    error.value = null;
    try {
      balances.value = await stockService.getExcessStock();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar produtos com excesso';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchMovements(productId: string, limit = 50) {
    loading.value = true;
    error.value = null;
    try {
      movements.value = await stockService.getMovements(productId, limit);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar movimentações';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function registerEntry(data: RegisterMovementDto) {
    loading.value = true;
    error.value = null;
    try {
      const movement = await stockService.registerEntry(data);
      return movement;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao registrar entrada';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function registerExit(data: RegisterMovementDto) {
    loading.value = true;
    error.value = null;
    try {
      const movement = await stockService.registerExit(data);
      return movement;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao registrar saída';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function registerAdjustment(data: RegisterMovementDto) {
    loading.value = true;
    error.value = null;
    try {
      const movement = await stockService.registerAdjustment(data);
      return movement;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao registrar ajuste';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function reserveForOrder(orderId: string) {
    loading.value = true;
    error.value = null;
    try {
      const result = await stockService.reserveForOrder(orderId);
      return result;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao reservar estoque';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    balances,
    summary,
    movements,
    loading,
    error,
    fetchSummary,
    fetchBalances,
    getBalance,
    fetchLowStock,
    fetchExcessStock,
    fetchMovements,
    registerEntry,
    registerExit,
    registerAdjustment,
    reserveForOrder,
  };
});
