import api from './api.service';

export interface ProductCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  parent?: { id: string; code: string; name: string };
  children?: { id: string; code: string; name: string }[];
}

export interface CreateProductCategoryDto {
  code: string;
  name: string;
  description?: string;
  parentId?: string;
}

export interface UpdateProductCategoryDto extends Partial<CreateProductCategoryDto> {}

class ProductCategoryService {
  private readonly basePath = '/product-categories';

  async getAll(page = 1, limit = 100, filters?: { search?: string; parentId?: string | null }) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.parentId !== undefined) {
      params.append('parentId', filters.parentId === null ? 'null' : filters.parentId);
    }
    return api.get(`${this.basePath}?${params.toString()}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async create(data: CreateProductCategoryDto) {
    return api.post(this.basePath, data);
  }

  async update(id: string, data: UpdateProductCategoryDto) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }
}

export default new ProductCategoryService();
