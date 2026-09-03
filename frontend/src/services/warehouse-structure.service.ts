import api from '@/services/api';
import type {
  ApiEnvelope,
  WarehouseStructure,
  WarehouseStructureFilters,
} from '@/types/warehouse.types';

const warehouseStructureService = {
  async getAll(page = 1, limit = 100, filters: WarehouseStructureFilters = {}) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (filters.search) params.append('search', filters.search);
    if (filters.blocked !== undefined && filters.blocked !== '') {
      params.append('blocked', String(filters.blocked));
    }

    return await api.get<ApiEnvelope<WarehouseStructure[]>>(
      `/warehouse-structures?${params.toString()}`
    );
  },

  async getById(id: string) {
    return await api.get<ApiEnvelope<WarehouseStructure>>(`/warehouse-structures/${id}`);
  },

  async create(data: Record<string, unknown>) {
    return await api.post<ApiEnvelope<WarehouseStructure>>('/warehouse-structures', data);
  },

  async update(id: string, data: Record<string, unknown>) {
    return await api.put<ApiEnvelope<WarehouseStructure>>(`/warehouse-structures/${id}`, data);
  },

  async delete(id: string) {
    return await api.delete<ApiEnvelope<null>>(`/warehouse-structures/${id}`);
  },
};

export default warehouseStructureService;
