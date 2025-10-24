import { defineStore } from 'pinia';
import { ref } from 'vue';
import warehouseStructureService from '@/services/warehouse-structure.service';

export const useWarehouseStructureStore = defineStore('warehouseStructure', () => {
  const structures = ref([]);
  const loading = ref(false);

  const fetchStructures = async (page = 1, limit = 100, filters = {}) => {
    loading.value = true;
    try {
      const response = await warehouseStructureService.getAll(page, limit, filters);
      return {
        data: response.data.data || [],
        pagination: response.data.pagination || { page: 1, limit: 100, total: 0, pages: 0 }
      };
    } catch (error) {
      console.error('Erro ao buscar estruturas:', error);
      throw error;
    } finally {
      loading.value = false;
    }
  };

  const createStructure = async (data) => {
    try {
      const response = await warehouseStructureService.create(data);
      structures.value.push(response.data.data);
      return response.data.data;
    } catch (error) {
      console.error('Erro ao criar estrutura:', error);
      throw error;
    }
  };

  const updateStructure = async (id, data) => {
    try {
      const response = await warehouseStructureService.update(id, data);
      const index = structures.value.findIndex((s) => s.id === id);
      if (index !== -1) {
        structures.value[index] = response.data.data;
      }
      return response.data.data;
    } catch (error) {
      console.error('Erro ao atualizar estrutura:', error);
      throw error;
    }
  };

  const deleteStructure = async (id) => {
    try {
      await warehouseStructureService.delete(id);
      structures.value = structures.value.filter((s) => s.id !== id);
    } catch (error) {
      console.error('Erro ao excluir estrutura:', error);
      throw error;
    }
  };

  return {
    structures,
    loading,
    fetchStructures,
    createStructure,
    updateStructure,
    deleteStructure,
  };
});
