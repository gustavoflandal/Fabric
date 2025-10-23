import api from '@/services/api';

const warehouseStructureService = {
  async getAll(page = 1, limit = 100, filters = {}) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (filters.search) params.append('search', filters.search);
    if (filters.blocked !== undefined && filters.blocked !== '') {
      params.append('blocked', filters.blocked);
    }
    
    return await api.get(`/warehouse-structures?${params.toString()}`);
  },

  async getById(id) {
    return await api.get(`/warehouse-structures/${id}`);
  },

  async create(data) {
    return await api.post('/warehouse-structures', data);
  },

  async update(id, data) {
    return await api.put(`/warehouse-structures/${id}`, data);
  },

  async delete(id) {
    return await api.delete(`/warehouse-structures/${id}`);
  },
};

export default warehouseStructureService;
