import api from './api.service'

export interface EquipmentRef {
  id: string
  code: string
  name: string
}

export interface MaintenancePlan {
  id: string
  equipmentId: string
  name: string
  description?: string | null
  frequencyDays: number
  nextDueDate: string
  active: boolean
  createdAt: string
  updatedAt: string
  equipment?: EquipmentRef
}

export interface CreateMaintenancePlanDto {
  equipmentId: string
  name: string
  description?: string | null
  frequencyDays: number
  nextDueDate?: string
  active?: boolean
}

export interface UpdateMaintenancePlanDto extends Partial<CreateMaintenancePlanDto> {}

class MaintenancePlanService {
  private readonly basePath = '/maintenance-plans'

  async getAll(page = 1, limit = 100, filters?: { equipmentId?: string; active?: boolean }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.equipmentId) params.append('equipmentId', filters.equipmentId)
    if (filters?.active !== undefined) params.append('active', filters.active.toString())
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`)
  }

  async create(data: CreateMaintenancePlanDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateMaintenancePlanDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async toggleActive(id: string) {
    return api.patch(`${this.basePath}/${id}/toggle-active`)
  }
}

export default new MaintenancePlanService()
