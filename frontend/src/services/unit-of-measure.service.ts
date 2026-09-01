import api from './api.service';

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  type: string;
  symbol?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnitOfMeasureDto {
  code: string;
  name: string;
  type: string;
  symbol?: string;
  active?: boolean;
}

export interface UpdateUnitOfMeasureDto {
  code?: string;
  name?: string;
  type?: string;
  symbol?: string;
  active?: boolean;
}

class UnitOfMeasureService {
  private readonly basePath = '/units-of-measure';

  async getAll(page = 1, limit = 100, filters?: {
    type?: string;
    active?: boolean;
    search?: string;
  }) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());

    if (filters?.type) params.append('type', filters.type);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.search) params.append('search', filters.search);

    return api.get(`${this.basePath}?${params.toString()}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async create(data: CreateUnitOfMeasureDto) {
    return api.post(this.basePath, data);
  }

  async update(id: string, data: UpdateUnitOfMeasureDto) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }

  async toggleActive(id: string) {
    return api.patch(`${this.basePath}/${id}/toggle-active`);
  }
}

export default new UnitOfMeasureService();
