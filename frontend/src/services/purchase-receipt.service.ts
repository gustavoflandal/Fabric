import api from './api.service';

export interface PurchaseReceiptItem {
  id: string;
  receiptId: string;
  orderItemId: string;
  productId: string;
  quantity: number;
  acceptedQty: number;
  rejectedQty: number;
  notes?: string;
  lotNumber?: string;
  manufacturedAt?: string;
  expiresAt?: string;
  product?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface PurchaseReceipt {
  id: string;
  receiptNumber: string;
  orderId: string;
  receiptDate: string;
  receivedBy: string;
  status: string;
  notes?: string;
  createdAt: string;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
    supplier?: {
      id: string;
      name: string;
    };
  };
  items: PurchaseReceiptItem[];
}

export interface CreatePurchaseReceiptDto {
  purchaseOrderId: string;
  receiptDate: string;
  invoiceNumber?: string;
  notes?: string;
  items: {
    orderItemId: string;
    productId: string;
    quantityReceived: number;
    notes?: string;
    lotNumber?: string;
    manufacturedAt?: string;
    expiresAt?: string;
  }[];
}

export interface ParsedNfeItem {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitValue: number;
  lotNumber?: string;
  manufacturedAt?: string;
  expiresAt?: string;
}

export interface ParsedNfe {
  supplierCnpj: string;
  supplierName: string;
  number: string;
  series: string;
  items: ParsedNfeItem[];
}

class PurchaseReceiptService {
  private readonly basePath = '/purchase-receipts';

  async getAll(filters?: { purchaseOrderId?: string; startDate?: string; endDate?: string }) {
    const params = new URLSearchParams();
    if (filters?.purchaseOrderId) params.append('purchaseOrderId', filters.purchaseOrderId);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    const query = params.toString();
    return api.get(`${this.basePath}${query ? `?${query}` : ''}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async create(data: CreatePurchaseReceiptDto) {
    return api.post(this.basePath, data);
  }

  async cancel(id: string, reason: string) {
    return api.delete(`${this.basePath}/${id}`, { data: { reason } });
  }

  async parseNfe(xml: string): Promise<ParsedNfe> {
    const response = await api.post(`${this.basePath}/parse-nfe`, { xml });
    return response.data.data;
  }
}

export default new PurchaseReceiptService();
