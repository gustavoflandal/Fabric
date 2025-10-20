import api from './api.service';

export interface ProductionPointing {
  id: string;
  productionOrderId: string;
  operationId: string;
  userId: string;
  quantityGood: number;
  quantityScrap: number;
  setupTime: number;
  runTime: number;
  startTime: string;
  endTime: string;
  notes?: string;
  createdAt: string;
  productionOrder?: {
    id: string;
    orderNumber: string;
    product?: {
      code: string;
      name: string;
    };
  };
  operation?: {
    id: string;
    sequence: number;
    description: string;
  };
  user?: {
    id: string;
    name: string;
  };
}

export interface CreateProductionPointingDto {
  productionOrderId: string;
  operationId: string;
  startTime: string;
  endTime: string;
  goodQuantity: number;
  scrapQuantity?: number;
  setupTime?: number;
  runTime: number;
  notes?: string;
}

class ProductionPointingService {
  private readonly basePath = '/production-pointings';

  async getAll(page = 1, limit = 100, filters?: {
    productionOrderId?: string;
    operationId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.productionOrderId) params.append('productionOrderId', filters.productionOrderId);
    if (filters?.operationId) params.append('operationId', filters.operationId);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.status) params.append('status', filters.status);
    return api.get(`${this.basePath}?${params.toString()}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async create(data: CreateProductionPointingDto) {
    return api.post(this.basePath, data);
  }

  async update(id: string, data: Partial<CreateProductionPointingDto>) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async finish(id: string, data: { endTime: string; goodQuantity: number; scrapQuantity?: number; notes?: string }) {
    return api.patch(`${this.basePath}/${id}/finish`, data);
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }

  async getByOrder(orderId: string) {
    return api.get(`${this.basePath}/order/${orderId}`);
  }

  async getMyPointings(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return api.get(`${this.basePath}/my-pointings?${params.toString()}`);
  }
}

export default new ProductionPointingService();
