import api from './api.service';

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  unitId: string;
  categoryId?: string;
  leadTime: number;
  lotSize?: number;
  minStock: number;
  maxStock?: number;
  safetyStock: number;
  reorderPoint?: number;
  standardCost?: number;
  lastCost?: number;
  averageCost?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  unit?: { id: string; code: string; name: string };
  category?: { id: string; code: string; name: string };
}

export interface CreateProductDto {
  code: string;
  name: string;
  description?: string;
  type: string;
  unitId: string;
  categoryId?: string;
  leadTime?: number;
  lotSize?: number;
  minStock?: number;
  maxStock?: number;
  safetyStock?: number;
  reorderPoint?: number;
  standardCost?: number;
  lastCost?: number;
  averageCost?: number;
  active?: boolean;
}

export interface UpdateProductDto extends Partial<CreateProductDto> {}

class ProductService {
  private readonly basePath = '/products';

  async getAll(page = 1, limit = 100, filters?: { type?: string; categoryId?: string; active?: boolean; search?: string }) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.search) params.append('search', filters.search);
    return api.get(`${this.basePath}?${params.toString()}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async create(data: CreateProductDto) {
    return api.post(this.basePath, data);
  }

  async update(id: string, data: UpdateProductDto) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }

  async toggleActive(id: string) {
    return api.patch(`${this.basePath}/${id}/toggle-active`);
  }
}

export default new ProductService();
