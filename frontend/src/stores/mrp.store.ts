import { defineStore } from 'pinia';
import { ref } from 'vue';
import mrpService, {
  type MRPResult,
  type MRPSummary,
  type MRPRequirement,
  type PurchaseSuggestion,
  type ProductionSuggestion,
} from '@/services/mrp.service';

export const useMRPStore = defineStore('mrp', () => {
  const results = ref<MRPResult[]>([]);
  const summary = ref<MRPSummary | null>(null);
  const requirements = ref<MRPRequirement[]>([]);
  const purchaseSuggestions = ref<PurchaseSuggestion[]>([]);
  const productionSuggestions = ref<ProductionSuggestion[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchSummary() {
    loading.value = true;
    error.value = null;
    try {
      summary.value = await mrpService.getSummary();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar resumo do MRP';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function executeForOrder(orderId: string) {
    loading.value = true;
    error.value = null;
    try {
      const result = await mrpService.executeForOrder(orderId);
      results.value = [result];
      return result;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao executar MRP';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function executeForMultipleOrders(orderIds: string[]) {
    loading.value = true;
    error.value = null;
    try {
      results.value = await mrpService.executeForMultipleOrders(orderIds);
      return results.value;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao executar MRP';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function executeForAllPending() {
    loading.value = true;
    error.value = null;
    try {
      results.value = await mrpService.executeForAllPending();
      return results.value;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao executar MRP';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function consolidateRequirements(orderIds: string[]) {
    loading.value = true;
    error.value = null;
    try {
      requirements.value = await mrpService.consolidateRequirements(orderIds);
      return requirements.value;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao consolidar necessidades';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchPurchaseSuggestions(orderIds?: string[]) {
    loading.value = true;
    error.value = null;
    try {
      purchaseSuggestions.value = await mrpService.getPurchaseSuggestions(orderIds);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar sugestões de compra';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchProductionSuggestions(orderIds?: string[]) {
    loading.value = true;
    error.value = null;
    try {
      productionSuggestions.value = await mrpService.getProductionSuggestions(orderIds);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar sugestões de produção';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    results,
    summary,
    requirements,
    purchaseSuggestions,
    productionSuggestions,
    loading,
    error,
    fetchSummary,
    executeForOrder,
    executeForMultipleOrders,
    executeForAllPending,
    consolidateRequirements,
    fetchPurchaseSuggestions,
    fetchProductionSuggestions,
  };
});
