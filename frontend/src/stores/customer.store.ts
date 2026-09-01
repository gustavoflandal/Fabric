import { defineStore } from 'pinia';
import { ref } from 'vue';
import customerService, { type Customer, type CreateCustomerDto, type UpdateCustomerDto } from '@/services/customer.service';

export const useCustomerStore = defineStore('customer', () => {
  const customers = ref<Customer[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchCustomers = async (page = 1, limit = 100, filters?: { active?: boolean; search?: string }) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await customerService.getAll(page, limit, filters);
      customers.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar clientes';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getCustomerById = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await customerService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar cliente';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createCustomer = async (data: CreateCustomerDto) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await customerService.create(data);
      await fetchCustomers();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar cliente';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateCustomer = async (id: string, data: UpdateCustomerDto) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await customerService.update(id, data);
      await fetchCustomers();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar cliente';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      await customerService.delete(id);
      await fetchCustomers();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir cliente';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const toggleActive = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      await customerService.toggleActive(id);
      await fetchCustomers();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar status';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    customers,
    loading,
    error,
    fetchCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    toggleActive,
  };
});
