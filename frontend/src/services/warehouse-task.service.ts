import api from '@/services/api'
import type { ApiEnvelope } from '@/types/warehouse.types'
import type { ReceiptOperation, PanelScope, WarehouseTask } from '@/types/warehouse-task.types'

export const warehouseTaskService = {
  async getPanel(scope: PanelScope) {
    return await api.get<ApiEnvelope<ReceiptOperation[]>>(`/warehouse-tasks/panel?scope=${scope}`)
  },

  /** F4.11 — atribui ao chamador (se livre) e marca IN_PROGRESS. Idempotente para o próprio dono. */
  async start(taskId: string) {
    return await api.post<ApiEnvelope<WarehouseTask>>(`/warehouse-tasks/${taskId}/start`)
  },

  /** Conclusão simples (Descarga/Conferência/Etiquetagem/Quarentena/Segregação/Amostragem). */
  async complete(taskId: string) {
    return await api.post<ApiEnvelope<WarehouseTask>>(`/warehouse-tasks/${taskId}/complete`, {})
  },

  /** Conclusão (parcial ou total) da Alocação. */
  async putaway(
    taskId: string,
    data: { receiptItemId: string; storagePositionId: string; quantity: number }
  ) {
    return await api.post<ApiEnvelope<{ receiptCompleted: boolean }>>(
      `/warehouse-tasks/${taskId}/putaway`,
      data
    )
  },
}

export default warehouseTaskService
