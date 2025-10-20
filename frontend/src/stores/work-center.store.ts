import { defineStore } from 'pinia';
import { ref } from 'vue';
import workCenterService, { type WorkCenter, type CreateWorkCenterDto, type UpdateWorkCenterDto } from '@/services/work-center.service';

export const useWorkCenterStore = defineStore('workCenter', () => {
  const workCenters = ref<WorkCenter[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchWorkCenters = async (page = 1, limit = 100, filters?: { type?: string; active?: boolean; search?: string }) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await workCenterService.getAll(page, limit, filters);
      workCenters.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar centros de trabalho';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getWorkCenterById = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await workCenterService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar centro de trabalho';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createWorkCenter = async (data: CreateWorkCenterDto) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await workCenterService.create(data);
      await fetchWorkCenters();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar centro de trabalho';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateWorkCenter = async (id: string, data: UpdateWorkCenterDto) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await workCenterService.update(id, data);
      await fetchWorkCenters();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar centro de trabalho';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteWorkCenter = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      await workCenterService.delete(id);
      await fetchWorkCenters();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir centro de trabalho';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const toggleActive = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      await workCenterService.toggleActive(id);
      await fetchWorkCenters();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar status';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    workCenters,
    loading,
    error,
    fetchWorkCenters,
    getWorkCenterById,
    createWorkCenter,
    updateWorkCenter,
    deleteWorkCenter,
    toggleActive,
  };
});
