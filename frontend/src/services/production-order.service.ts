import api from './api.service';

export interface ProductionOrder {
  id: string;
  orderNumber: string;
  productId: string;
  quantity: number;
  producedQty: number;
  scrapQty: number;
  priority: number;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart?: string;
  actualEnd?: string;
  plannedCost?: number;
  actualCost?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  product?: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
  operations?: ProductionOrderOperation[];
}

export interface ProductionOrderOperation {
  id: string;
  productionOrderId: string;
  sequence: number;
  workCenterId: string;
  description: string;
  plannedQty: number;
  completedQty: number;
  scrapQty: number;
  setupTime: number;
  runTime: number;
  totalPlannedTime: number;
  actualTime: number;
  status: string;
  workCenter?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface CreateProductionOrderDto {
  orderNumber: string;
  productId: string;
  quantity: number;
  scheduledStart: string;
  scheduledEnd: string;
  priority?: number;
  notes?: string;
}

export interface UpdateProductionOrderDto {
  orderNumber?: string;
  quantity?: number;
  scheduledStart?: string;
  scheduledEnd?: string;
  priority?: number;
  notes?: string;
}

class ProductionOrderService {
  private readonly basePath = '/production-orders';

  async getAll(page = 1, limit = 100, filters?: {
    status?: string;
    productId?: string;
    priority?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.productId) params.append('productId', filters.productId);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    return api.get(`${this.basePath}?${params.toString()}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async create(data: CreateProductionOrderDto) {
    return api.post(this.basePath, data);
  }

  async update(id: string, data: UpdateProductionOrderDto) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }

  async changeStatus(id: string, status: string, notes?: string) {
    return api.patch(`${this.basePath}/${id}/status`, { status, notes });
  }

  async updateProgress(id: string, producedQuantity: number, scrapQuantity: number = 0) {
    return api.patch(`${this.basePath}/${id}/progress`, { producedQuantity, scrapQuantity });
  }

  async getOperations(id: string) {
    return api.get(`${this.basePath}/${id}/operations`);
  }

  async getMaterials(id: string) {
    return api.get(`${this.basePath}/${id}/materials`);
  }

  async calculateMaterials(id: string) {
    return api.post(`${this.basePath}/${id}/calculate-materials`);
  }

  async calculateOperations(id: string) {
    return api.post(`${this.basePath}/${id}/calculate-operations`);
  }
}

export default new ProductionOrderService();
