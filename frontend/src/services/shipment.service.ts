import api from './api.service';
import type { CreateShipmentDto, ShipmentFilters } from '@/types/sales.types';

/**
 * Cliente HTTP de `/api/v1/shipments` (módulo licenciável EXPEDICAO).
 *
 * Não existe `update`/`delete`: o romaneio é criado a partir do pedido e daí em
 * diante só anda por transições nomeadas, cada uma com a sua própria permissão
 * no backend (`separar`, `despachar`, `cancelar`).
 */
class ShipmentService {
  private readonly basePath = '/shipments';

  async getAll(page = 1, limit = 20, filters?: ShipmentFilters) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.salesOrderId) params.append('salesOrderId', filters.salesOrderId);
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId);
    return api.get(`${this.basePath}?${params.toString()}`);
  }

  /** Detalhe — inclui `pickingTasks`, que a listagem não traz. */
  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`);
  }

  /**
   * A partir de um pedido CONFIRMADO ou em SEPARAÇÃO, admitindo expedição
   * parcial. `warehouseId` não vai no payload: é herdado do pedido.
   */
  async create(data: CreateShipmentDto) {
    return api.post(this.basePath, data);
  }

  /** PENDING → SEPARATING; planeja FIFO/FEFO e cria as tarefas de PICKING. */
  async startSeparation(id: string) {
    return api.post(`${this.basePath}/${id}/start-separation`);
  }

  /** SEPARATING/READY → DISPATCHED. Exige todas as tarefas de separação COMPLETED. */
  async dispatch(id: string) {
    return api.post(`${this.basePath}/${id}/dispatch`);
  }

  /** Só antes do despacho, e só se nenhuma tarefa de separação já tiver sido concluída. */
  async cancel(id: string) {
    return api.post(`${this.basePath}/${id}/cancel`);
  }
}

export default new ShipmentService();
