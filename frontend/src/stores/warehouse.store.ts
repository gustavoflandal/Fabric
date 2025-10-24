import { defineStore } from 'pinia';
import { ref } from 'vue';
import warehouseService from '@/services/warehouse.service';

export const useWarehouseStore = defineStore('warehouse', () => {
  const warehouses = ref([]);
  const loading = ref(false);

  const fetchWarehouses = async () => {
    loading.value = true;
    try {
      const response = await warehouseService.getAll();
      warehouses.value = response.data.data || [];
    } catch (error) {
      console.error('Erro ao buscar armazéns:', error);
    } finally {
      loading.value = false;
    }
  };

  const createWarehouse = async (data) => {
    try {
      const response = await warehouseService.create(data);
      warehouses.value.push(response.data.data);
    } catch (error) {
      console.error('Erro ao criar armazém:', error);
      throw error;
    }
  };

  const updateWarehouse = async (id, data) => {
    try {
      const response = await warehouseService.update(id, data);
      const index = warehouses.value.findIndex((w) => w.id === id);
      if (index !== -1) {
        warehouses.value[index] = response.data.data;
      }
    } catch (error) {
      console.error('Erro ao atualizar armazém:', error);
      throw error;
    }
  };

  const deleteWarehouse = async (id) => {
    try {
      await warehouseService.delete(id);
      warehouses.value = warehouses.value.filter((w) => w.id !== id);
    } catch (error) {
      console.error('Erro ao excluir armazém:', error);
      throw error;
    }
  };

  return {
    warehouses,
    loading,
    fetchWarehouses,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
  };
});