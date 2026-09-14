import { defineStore } from 'pinia';
import { ref } from 'vue';
import shipmentService from '@/services/shipment.service';
import type { Pagination } from '@/types/warehouse.types';
import type { CreateShipmentDto, Shipment, ShipmentFilters } from '@/types/sales.types';

const EMPTY_PAGINATION: Pagination = { page: 1, limit: 20, total: 0, pages: 0 };

export const useShipmentStore = defineStore('shipment', () => {
  const shipments = ref<Shipment[]>([]);
  const pagination = ref<Pagination>({ ...EMPTY_PAGINATION });
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchShipments(page = 1, limit = 20, filters?: ShipmentFilters) {
    loading.value = true;
    error.value = null;
    try {
      const response = await shipmentService.getAll(page, limit, filters);
      const items: Shipment[] = response.data.data ?? [];
      shipments.value = items;
      pagination.value = response.data.pagination ?? { ...EMPTY_PAGINATION, page, limit };
      return { items, pagination: pagination.value };
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar romaneios';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getShipmentById(id: string): Promise<Shipment> {
    loading.value = true;
    error.value = null;
    try {
      const response = await shipmentService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar romaneio';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createShipment(data: CreateShipmentDto): Promise<Shipment> {
    loading.value = true;
    error.value = null;
    try {
      const response = await shipmentService.create(data);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar romaneio';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * As três transições devolvem o romaneio JÁ no shape completo do detalhe
   * (com `pickingTasks`), então a tela de detalhe pode usar o retorno direto em
   * vez de disparar um `getById` logo depois.
   */
  async function startSeparation(id: string): Promise<Shipment> {
    loading.value = true;
    error.value = null;
    try {
      const response = await shipmentService.startSeparation(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao iniciar a separação';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function dispatchShipment(id: string): Promise<Shipment> {
    loading.value = true;
    error.value = null;
    try {
      const response = await shipmentService.dispatch(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao despachar o romaneio';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function cancelShipment(id: string): Promise<Shipment> {
    loading.value = true;
    error.value = null;
    try {
      const response = await shipmentService.cancel(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao cancelar o romaneio';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    shipments,
    pagination,
    loading,
    error,
    fetchShipments,
    getShipmentById,
    createShipment,
    startSeparation,
    dispatchShipment,
    cancelShipment,
  };
});
