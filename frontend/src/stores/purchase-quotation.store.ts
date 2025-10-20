import { defineStore } from 'pinia';
import { ref } from 'vue';
import purchaseQuotationService, {
  type PurchaseQuotation,
  type CreatePurchaseQuotationDto,
} from '@/services/purchase-quotation.service';

export const usePurchaseQuotationStore = defineStore('purchaseQuotation', () => {
  const quotations = ref<PurchaseQuotation[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchQuotations(filters?: {
    supplierId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseQuotationService.getAll(1, 1000, filters);
      quotations.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar orçamentos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getQuotationById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseQuotationService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar orçamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createQuotation(data: CreatePurchaseQuotationDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseQuotationService.create(data);
      await fetchQuotations();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar orçamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateQuotation(id: string, data: Partial<CreatePurchaseQuotationDto>) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseQuotationService.update(id, data);
      await fetchQuotations();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar orçamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateStatus(id: string, status: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseQuotationService.updateStatus(id, status);
      await fetchQuotations();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar status';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function approve(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseQuotationService.approve(id);
      await fetchQuotations();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao aprovar orçamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function reject(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseQuotationService.reject(id);
      await fetchQuotations();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao rejeitar orçamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteQuotation(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await purchaseQuotationService.delete(id);
      quotations.value = quotations.value.filter((q) => q.id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir orçamento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getBySupplier(supplierId: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseQuotationService.getBySupplier(supplierId);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar orçamentos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    quotations,
    loading,
    error,
    fetchQuotations,
    getQuotationById,
    createQuotation,
    updateQuotation,
    updateStatus,
    approve,
    reject,
    deleteQuotation,
    getBySupplier,
  };
});
