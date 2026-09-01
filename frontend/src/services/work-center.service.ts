import api from './api.service';

export interface WorkCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  capacity?: number;
  efficiency: number;
  costPerHour?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkCenterDto {
  code: string;
  name: string;
  description?: string;
  type: string;
  capacity?: number;
  efficiency?: number;
  costPerHour?: number;
  active?: boolean;
}

export interface UpdateWorkCenterDto extends Partial<CreateWorkCenterDto> {}

class WorkCenterService {
  private readonly basePath = '/work-centers';

  async getAll(page = 1, limit = 100, filters?: { type?: string; active?: boolean; search?: string }) {
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

  async create(data: CreateWorkCenterDto) {
    return api.post(this.basePath, data);
  }

  async update(id: string, data: UpdateWorkCenterDto) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }

  async toggleActive(id: string) {
    return api.patch(`${this.basePath}/${id}/toggle-active`);
  }
}

export default new WorkCenterService();
