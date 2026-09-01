import api from './api.service';

export interface BomItem {
  id?: string;
  componentId: string;
  componentCode?: string;
  componentName?: string;
  quantity: number;
  unitId: string;
  unit?: {
    id: string;
    code: string;
    name: string;
    symbol?: string | null;
  };
  scrapFactor?: number;
  sequence?: number;
  notes?: string | null;
}

export interface Bom {
  id: string;
  productId: string;
  version: number;
  description?: string | null;
  active: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  items: BomItem[];
}

export interface CreateBomDto {
  productId: string;
  description?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  active?: boolean;
  version?: number;
  items: Array<{
    componentId: string;
    quantity: number;
    unitId: string;
    scrapFactor?: number;
    sequence?: number;
    notes?: string | null;
  }>;
}

export interface UpdateBomDto {
  description?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  active?: boolean;
  version?: number;
  items?: CreateBomDto['items'];
}

class BomService {
  private readonly basePath = '/boms';

  async list(productId?: string) {
    const params = new URLSearchParams();
    if (productId) params.append('productId', productId);
    const query = params.toString();
    return api.get(`${this.basePath}${query ? `?${query}` : ''}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async getActiveByProduct(productId: string) {
    return api.get(`${this.basePath}/product/${productId}/active`);
  }

  async create(data: CreateBomDto) {
    return api.post(this.basePath, data);
  }

  async update(id: string, data: UpdateBomDto) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }

  async setActive(id: string, active: boolean) {
    return api.patch(`${this.basePath}/${id}/active`, { active });
  }

  async explode(id: string, quantity?: number) {
    const params = new URLSearchParams();
    if (quantity) params.append('quantity', quantity.toString());
    const query = params.toString();
    return api.get(`${this.basePath}/${id}/explode${query ? `?${query}` : ''}`);
  }
}

export default new BomService();
