import api from '@/services/api';

const warehouseService = {
  async getAll() {
    return await api.get('/warehouses');
  },

  async create(data) {
    return await api.post('/warehouses', data);
  },

  async update(id, data) {
    return await api.put(`/warehouses/${id}`, data);
  },

  async delete(id) {
    return await api.delete(`/warehouses/${id}`);
  },
};

export default warehouseService;