import api from './api.service';

export interface PurchaseQuotation {
  id: string;
  quotationNumber: string;
  supplierId: string;
  requestDate: string;
  dueDate: string;
  status: string;
  notes?: string;
  totalValue: number;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    code: string;
    name: string;
  };
  items: PurchaseQuotationItem[];
  purchaseOrders?: any[];
}

export interface PurchaseQuotationItem {
  id: string;
  quotationId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
  deliveryDays?: number;
  notes?: string;
  product?: {
    id: string;
    code: string;
    name: string;
    unit: {
      symbol: string;
    };
  };
}

export interface CreatePurchaseQuotationDto {
  supplierId: string;
  dueDate: string;
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    deliveryDays?: number;
    notes?: string;
  }[];
}

class PurchaseQuotationService {
  private readonly basePath = '/purchase-quotations';

  async getAll(page = 1, limit = 20, filters?: {
    supplierId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.supplierId) params.append('supplierId', filters.supplierId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    return api.get(`${this.basePath}?${params.toString()}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async create(data: CreatePurchaseQuotationDto) {
    return api.post(this.basePath, data);
  }

  async update(id: string, data: Partial<CreatePurchaseQuotationDto>) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async updateStatus(id: string, status: string) {
    return api.patch(`${this.basePath}/${id}/status`, { status });
  }

  async approve(id: string) {
    return api.patch(`${this.basePath}/${id}/approve`, {});
  }

  async reject(id: string) {
    return api.patch(`${this.basePath}/${id}/reject`, {});
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }

  async getBySupplier(supplierId: string) {
    return api.get(`${this.basePath}/supplier/${supplierId}`);
  }
}

export default new PurchaseQuotationService();
