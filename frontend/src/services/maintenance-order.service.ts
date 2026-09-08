import api from './api.service'

export type MaintenanceOrderType = 'PREVENTIVE' | 'CORRECTIVE'
export type MaintenanceOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface MaintenanceOrder {
  id: string
  equipmentId: string
  planId: string | null
  type: MaintenanceOrderType
  status: MaintenanceOrderStatus
  problemDescription: string | null
  resolutionNotes: string | null
  assignedTo: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  equipment?: { id: string; code: string; name: string }
  plan?: { id: string; name: string } | null
  assignee?: { id: string; name: string; email: string } | null
}

export interface CreateCorrectiveOrderDto {
  equipmentId: string
  problemDescription: string
  assignedTo?: string | null
}

class MaintenanceOrderService {
  private readonly basePath = '/maintenance-orders'

  async getAll(
    page = 1,
    limit = 100,
    filters?: { equipmentId?: string; type?: MaintenanceOrderType; status?: MaintenanceOrderStatus }
  ) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.equipmentId) params.append('equipmentId', filters.equipmentId)
    if (filters?.type) params.append('type', filters.type)
    if (filters?.status) params.append('status', filters.status)
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateCorrectiveOrderDto) {
    return api.post(this.basePath, data)
  }

  async start(id: string) {
    return api.patch(`${this.basePath}/${id}/start`)
  }

  async complete(id: string, resolutionNotes: string) {
    return api.patch(`${this.basePath}/${id}/complete`, { resolutionNotes })
  }

  async cancel(id: string, reason?: string) {
    return api.patch(`${this.basePath}/${id}/cancel`, { reason })
  }
}

export default new MaintenanceOrderService()
