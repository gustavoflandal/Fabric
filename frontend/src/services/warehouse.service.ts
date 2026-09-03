import api from '@/services/api';
import type {
  ApiEnvelope,
  Warehouse,
  WarehouseFilters,
  WarehouseFormData,
} from '@/types/warehouse.types';

const warehouseService = {
  async getAll(params?: WarehouseFilters) {
    return await api.get<ApiEnvelope<Warehouse[]>>('/warehouses', { params });
  },

  async create(data: Partial<WarehouseFormData>) {
    return await api.post<ApiEnvelope<Warehouse>>('/warehouses', data);
  },

  async update(id: string, data: Partial<WarehouseFormData>) {
    return await api.put<ApiEnvelope<Warehouse>>(`/warehouses/${id}`, data);
  },

  async delete(id: string) {
    return await api.delete<ApiEnvelope<null>>(`/warehouses/${id}`);
  },
};

export default warehouseService;
