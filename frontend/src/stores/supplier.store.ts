import { defineStore } from 'pinia';
import { ref } from 'vue';
import supplierService, { type Supplier, type CreateSupplierDto, type UpdateSupplierDto } from '@/services/supplier.service';

export const useSupplierStore = defineStore('supplier', () => {
  const suppliers = ref<Supplier[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchSuppliers = async (page = 1, limit = 100, filters?: {
    active?: boolean;
    search?: string;
  }) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await supplierService.getAll(page, limit, filters);
      suppliers.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar fornecedores';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getSupplierById = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await supplierService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar fornecedor';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createSupplier = async (data: CreateSupplierDto) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await supplierService.create(data);
      await fetchSuppliers();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar fornecedor';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateSupplier = async (id: string, data: UpdateSupplierDto) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await supplierService.update(id, data);
      await fetchSuppliers();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar fornecedor';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteSupplier = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      await supplierService.delete(id);
      await fetchSuppliers();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir fornecedor';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const toggleActive = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      await supplierService.toggleActive(id);
      await fetchSuppliers();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar status';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    suppliers,
    loading,
    error,
    fetchSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    toggleActive,
  };
});
