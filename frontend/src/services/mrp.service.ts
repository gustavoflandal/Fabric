import api from './api.service';

export interface MRPRequirement {
  productId: string;
  product: any;
  requiredQty: number;
  availableQty: number;
  onOrderQty: number;
  netRequirement: number;
  suggestedAction: 'BUY' | 'PRODUCE' | 'NONE';
  leadTime: number;
  suggestedDate: string;
}

export interface MRPResult {
  orderId: string;
  orderNumber: string;
  requirements: MRPRequirement[];
  totalItems: number;
  itemsToBuy: number;
  itemsToProduce: number;
  executedAt: string;
}

export interface MRPSummary {
  totalOrders: number;
  totalRequirements: number;
  totalToBuy: number;
  totalToProduce: number;
  lastExecuted: string;
}

export interface PurchaseSuggestion {
  product: any;
  quantity: number;
  suggestedDate: string;
  leadTime: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ProductionSuggestion {
  product: any;
  quantity: number;
  suggestedDate: string;
  leadTime: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

class MRPService {
  private readonly basePath = '/mrp';

  async getSummary(): Promise<MRPSummary> {
    const response = await api.get(`${this.basePath}/summary`);
    return response.data.data;
  }

  async executeForOrder(orderId: string): Promise<MRPResult> {
    const response = await api.get(`${this.basePath}/order/${orderId}`);
    return response.data.data;
  }

  async executeForMultipleOrders(orderIds: string[]): Promise<MRPResult[]> {
    const response = await api.post(`${this.basePath}/execute-multiple`, { orderIds });
    return response.data.data;
  }

  async executeForAllPending(): Promise<MRPResult[]> {
    const response = await api.post(`${this.basePath}/execute-all`);
    return response.data.data;
  }

  async consolidateRequirements(orderIds: string[]): Promise<MRPRequirement[]> {
    const response = await api.post(`${this.basePath}/consolidate`, { orderIds });
    return response.data.data;
  }

  async getPurchaseSuggestions(orderIds?: string[]): Promise<PurchaseSuggestion[]> {
    const params = orderIds ? { orderIds: JSON.stringify(orderIds) } : {};
    const response = await api.get(`${this.basePath}/purchase-suggestions`, { params });
    return response.data.data;
  }

  async getProductionSuggestions(orderIds?: string[]): Promise<ProductionSuggestion[]> {
    const params = orderIds ? { orderIds: JSON.stringify(orderIds) } : {};
    const response = await api.get(`${this.basePath}/production-suggestions`, { params });
    return response.data.data;
  }
}

export default new MRPService();
