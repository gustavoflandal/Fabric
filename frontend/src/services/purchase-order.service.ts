import api from './api.service';

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  quotationId?: string;
  orderDate: string;
  expectedDate: string;
  receivedDate?: string;
  status: string;
  paymentTerms?: string;
  paymentMethod?: string;
  shippingCost: number;
  discount: number;
  totalValue: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    code: string;
    name: string;
  };
  quotation?: {
    quotationNumber: string;
  };
  items: PurchaseOrderItem[];
  receipts?: any[];
}

export interface PurchaseOrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  receivedQty: number;
  unitPrice: number;
  discount: number;
  totalPrice: number;
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

export interface CreatePurchaseOrderDto {
  supplierId: string;
  quotationId?: string;
  expectedDate: string;
  paymentTerms?: string;
  paymentMethod?: string;
  shippingCost?: number;
  discount?: number;
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    notes?: string;
  }[];
}

class PurchaseOrderService {
  private readonly basePath = '/purchase-orders';

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

  async create(data: CreatePurchaseOrderDto) {
    return api.post(this.basePath, data);
  }

  async createFromQuotation(quotationId: string) {
    return api.post(`${this.basePath}/from-quotation`, { quotationId });
  }

  async update(id: string, data: Partial<CreatePurchaseOrderDto>) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  async updateStatus(id: string, status: string) {
    return api.patch(`${this.basePath}/${id}/status`, { status });
  }

  async approve(id: string) {
    return api.patch(`${this.basePath}/${id}/approve`, {});
  }

  async confirm(id: string) {
    return api.patch(`${this.basePath}/${id}/confirm`, {});
  }

  async cancel(id: string) {
    return api.patch(`${this.basePath}/${id}/cancel`, {});
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }

  async getBySupplier(supplierId: string) {
    return api.get(`${this.basePath}/supplier/${supplierId}`);
  }

  async getPendingOrders() {
    return api.get(`${this.basePath}/pending`);
  }
}

export default new PurchaseOrderService();
