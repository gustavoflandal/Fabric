import api from '@/services/api'
import type { ApiEnvelope } from '@/types/warehouse.types'
import type {
  ReceiptOperation,
  PanelScope,
  WarehouseTask,
  WarehouseTaskScanResult,
} from '@/types/warehouse-task.types'

export const warehouseTaskService = {
  async getPanel(scope: PanelScope) {
    return await api.get<ApiEnvelope<ReceiptOperation[]>>(`/warehouse-tasks/panel?scope=${scope}`)
  },

  /** F4.9 — a fila do operador logado: minhas tarefas + (opcionalmente) o pool sem dono. */
  async getMyTasks(params?: { includeUnassigned?: boolean; limit?: number }) {
    const query = new URLSearchParams()
    if (params?.includeUnassigned !== undefined) {
      query.set('includeUnassigned', String(params.includeUnassigned))
    }
    if (params?.limit !== undefined) {
      query.set('limit', String(params.limit))
    }
    const qs = query.toString()
    return await api.get<ApiEnvelope<WarehouseTask[]>>(`/warehouse-tasks/my${qs ? `?${qs}` : ''}`)
  },

  /** F4.9 — atribuir (ou desatribuir, com `assignedTo: null`) uma tarefa a um operador. */
  async assign(taskId: string, dto: { assignedTo: string | null; version?: number }) {
    return await api.post<ApiEnvelope<WarehouseTask>>(`/warehouse-tasks/${taskId}/assign`, dto)
  },

  /** F4.11 — confirmação de leitura de código de barras. Sem efeito colateral, sempre 200. */
  async scan(taskId: string, code: string) {
    return await api.post<ApiEnvelope<WarehouseTaskScanResult>>(
      `/warehouse-tasks/${taskId}/scan`,
      { code }
    )
  },

  /** F4.8/F4.10 — executa PICKING/REPLENISHMENT: movimenta estoque a partir do que já está gravado na tarefa. */
  async execute(taskId: string, version?: number) {
    return await api.post<ApiEnvelope<{ task: WarehouseTask; movementId: string }>>(
      `/warehouse-tasks/${taskId}/execute`,
      version !== undefined ? { version } : {}
    )
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
