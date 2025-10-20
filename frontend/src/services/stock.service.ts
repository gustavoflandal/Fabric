import api from './api.service';

export interface StockBalance {
  productId: string;
  product: any;
  quantity: number;
  minStock: number;
  maxStock: number;
  status: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
  lastMovement?: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  reference?: string;
  userId: string;
  createdAt: string;
}

export interface StockSummary {
  total: number;
  ok: number;
  low: number;
  critical: number;
  excess: number;
  totalValue: number;
  lastUpdate: string;
}

export interface RegisterMovementDto {
  productId: string;
  quantity: number;
  reason: string;
  reference?: string;
}

class StockService {
  private readonly basePath = '/stock';

  async getSummary(): Promise<StockSummary> {
    const response = await api.get(`${this.basePath}/summary`);
    return response.data.data;
  }

  async getAllBalances(filters?: {
    status?: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
    type?: string;
    categoryId?: string;
  }): Promise<StockBalance[]> {
    const response = await api.get(`${this.basePath}/balances`, { params: filters });
    return response.data.data;
  }

  async getBalance(productId: string): Promise<StockBalance> {
    const response = await api.get(`${this.basePath}/balance/${productId}`);
    return response.data.data;
  }

  async getLowStock(): Promise<StockBalance[]> {
    const response = await api.get(`${this.basePath}/low-stock`);
    return response.data.data;
  }

  async getExcessStock(): Promise<StockBalance[]> {
    const response = await api.get(`${this.basePath}/excess-stock`);
    return response.data.data;
  }

  async getMovements(productId: string, limit = 50): Promise<StockMovement[]> {
    const response = await api.get(`${this.basePath}/movements/${productId}`, {
      params: { limit },
    });
    return response.data.data;
  }

  async registerEntry(data: RegisterMovementDto): Promise<StockMovement> {
    const response = await api.post(`${this.basePath}/entry`, data);
    return response.data.data;
  }

  async registerExit(data: RegisterMovementDto): Promise<StockMovement> {
    const response = await api.post(`${this.basePath}/exit`, data);
    return response.data.data;
  }

  async registerAdjustment(data: RegisterMovementDto): Promise<StockMovement> {
    const response = await api.post(`${this.basePath}/adjustment`, data);
    return response.data.data;
  }

  async reserveForOrder(orderId: string): Promise<any> {
    const response = await api.post(`${this.basePath}/reserve/${orderId}`);
    return response.data.data;
  }
}

export default new StockService();
