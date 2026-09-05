import { defineStore } from 'pinia';
import { ref } from 'vue';
import purchaseReceiptService, {
  type PurchaseReceipt,
  type CreatePurchaseReceiptDto,
  type ParsedNfe,
} from '@/services/purchase-receipt.service';

export const usePurchaseReceiptStore = defineStore('purchaseReceipt', () => {
  const receipts = ref<PurchaseReceipt[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchReceipts(filters?: {
    purchaseOrderId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseReceiptService.getAll(filters);
      receipts.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar recebimentos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getReceiptById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseReceiptService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar recebimento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createReceipt(data: CreatePurchaseReceiptDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await purchaseReceiptService.create(data);
      await fetchReceipts();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao registrar recebimento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function cancelReceipt(id: string, reason: string) {
    loading.value = true;
    error.value = null;
    try {
      await purchaseReceiptService.cancel(id, reason);
      await fetchReceipts();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao cancelar recebimento';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function parseNfe(xml: string): Promise<ParsedNfe> {
    loading.value = true;
    error.value = null;
    try {
      return await purchaseReceiptService.parseNfe(xml);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao ler XML da NFe';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    receipts,
    loading,
    error,
    fetchReceipts,
    getReceiptById,
    createReceipt,
    cancelReceipt,
    parseNfe,
  };
});
