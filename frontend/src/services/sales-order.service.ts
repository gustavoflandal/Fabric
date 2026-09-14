import api from './api.service';
import type {
  CreateSalesOrderDto,
  SalesOrderFilters,
  UpdateSalesOrderDto,
} from '@/types/sales.types';

/**
 * Cliente HTTP de `/api/v1/sales-orders` (módulo licenciável EXPEDICAO).
 *
 * Mesma forma de `purchase-order.service.ts` — o documento equivalente do outro
 * lado do fluxo —, com uma diferença deliberada: as transições de status são
 * `POST /:id/<acao>`, não `PATCH /:id/status`. O backend NÃO tem setter genérico
 * de status (ver a nota em `sales-order.service.ts` do backend), então não há
 * `updateStatus()` aqui para espelhar.
 */
class SalesOrderService {
  private readonly basePath = '/sales-orders';

  async getAll(page = 1, limit = 20, filters?: SalesOrderFilters) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.customerId) params.append('customerId', filters.customerId);
    if (filters?.search) params.append('search', filters.search);
    return api.get(`${this.basePath}?${params.toString()}`);
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  async create(data: CreateSalesOrderDto) {
    return api.post(this.basePath, data);
  }

  /** Só aceito em DRAFT; enviar `items` substitui a lista inteira. */
  async update(id: string, data: UpdateSalesOrderDto) {
    return api.put(`${this.basePath}/${id}`, data);
  }

  /** DRAFT → CONFIRMED. */
  async confirm(id: string) {
    return api.post(`${this.basePath}/${id}/confirm`);
  }

  /** Cascateia até os romaneios abertos e suas tarefas de separação. */
  async cancel(id: string) {
    return api.post(`${this.basePath}/${id}/cancel`);
  }

  /** Só DRAFT e sem romaneios. */
  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`);
  }
}

export default new SalesOrderService();
