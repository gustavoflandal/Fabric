import api from './api.service';

export interface Routing {
  id: string;
  productId: string;
  version: number;
  description?: string;
  validFrom?: string;
  validTo?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  product?: { id: string; code: string; name: string };
  operations: RoutingOperation[];
}

export interface RoutingOperation {
  id: string;
  routingId: string;
  sequence: number;
  workCenterId: string;
  description: string;
  setupTime: number;
  runTime: number;
  queueTime: number;
  moveTime: number;
  notes?: string;
  workCenter?: { id: string; code: string; name: string; costPerHour?: number };
}

export interface CreateRoutingDto {
  productId: string;
  version?: number;
  description?: string;
  validFrom?: string;
  validTo?: string;
  active?: boolean;
  operations: CreateRoutingOperationDto[];
}

export interface CreateRoutingOperationDto {
  sequence: number;
  workCenterId: string;
  description: string;
  setupTime: number;
  runTime: number;
  queueTime?: number;
  moveTime?: number;
  notes?: string;
}

export interface UpdateRoutingDto {
  description?: string;
  validFrom?: string;
  validTo?: string;
  active?: boolean;
  operations?: CreateRoutingOperationDto[];
}

class RoutingService {
  private readonly basePath = '/routings';

  async getAll(page = 1, limit = 100, filters?: { productId?: string; active?: boolean; search?: string }) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.productId) params.append('productId', filters.productId);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.search) params.append('search', filters.search);
    return api.get(`${this.basePath}?${params.toString()}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async getByProduct(productId: string) {
    return api.get(`${this.basePath}/product/${productId}`);
  }

  async create(data: CreateRoutingDto) {
    return api.post(this.basePath, data);
  }

  async update(id: string, data: UpdateRoutingDto) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }

  async setActive(id: string, productId: string, active: boolean) {
    return api.patch(`${this.basePath}/${id}/set-active?productId=${productId}`, { active });
  }

  async calculateTotalTime(id: string, quantity: number = 1) {
    return api.get(`${this.basePath}/${id}/calculate-time?quantity=${quantity}`);
  }
}

export default new RoutingService();
