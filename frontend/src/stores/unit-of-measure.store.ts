import { defineStore } from 'pinia';
import { ref } from 'vue';
import unitOfMeasureService, { type UnitOfMeasure, type CreateUnitOfMeasureDto, type UpdateUnitOfMeasureDto } from '@/services/unit-of-measure.service';

export const useUnitOfMeasureStore = defineStore('unitOfMeasure', () => {
  const units = ref<UnitOfMeasure[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchUnits = async (page = 1, limit = 100, filters?: {
    type?: string;
    active?: boolean;
    search?: string;
  }) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await unitOfMeasureService.getAll(page, limit, filters);
      units.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar unidades de medida';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getUnitById = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await unitOfMeasureService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar unidade de medida';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createUnit = async (data: CreateUnitOfMeasureDto) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await unitOfMeasureService.create(data);
      await fetchUnits(); // Recarregar lista
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar unidade de medida';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateUnit = async (id: string, data: UpdateUnitOfMeasureDto) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await unitOfMeasureService.update(id, data);
      await fetchUnits(); // Recarregar lista
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar unidade de medida';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteUnit = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      await unitOfMeasureService.delete(id);
      await fetchUnits(); // Recarregar lista
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir unidade de medida';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const toggleActive = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      await unitOfMeasureService.toggleActive(id);
      await fetchUnits(); // Recarregar lista
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar status';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    units,
    loading,
    error,
    fetchUnits,
    getUnitById,
    createUnit,
    updateUnit,
    deleteUnit,
    toggleActive,
  };
});
