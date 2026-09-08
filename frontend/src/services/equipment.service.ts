import api from './api.service'

export interface WorkCenterRef {
  id: string
  code: string
  name: string
}

export interface Equipment {
  id: string
  code: string
  name: string
  workCenterId: string
  manufacturer?: string | null
  model?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  workCenter?: WorkCenterRef
}

export interface CreateEquipmentDto {
  code: string
  name: string
  workCenterId: string
  manufacturer?: string | null
  model?: string | null
  active?: boolean
}

export interface UpdateEquipmentDto extends Partial<CreateEquipmentDto> {}

class EquipmentService {
  private readonly basePath = '/equipment'

  async getAll(page = 1, limit = 100, filters?: { workCenterId?: string; active?: boolean; search?: string }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.workCenterId) params.append('workCenterId', filters.workCenterId)
    if (filters?.active !== undefined) params.append('active', filters.active.toString())
    if (filters?.search) params.append('search', filters.search)
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`)
  }

  async create(data: CreateEquipmentDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateEquipmentDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async toggleActive(id: string) {
    return api.patch(`${this.basePath}/${id}/toggle-active`)
  }
}

export default new EquipmentService()
