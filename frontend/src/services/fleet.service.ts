import api from './api.service'

export interface SupplierRef {
  id: string
  code: string
  name: string
}

export interface Fleet {
  id: string
  name: string
  supplierId: string
  blocked: boolean
  blockedReason: string | null
  createdAt: string
  updatedAt: string
  supplier?: SupplierRef
  _count?: { vehicles: number }
}

export interface CreateFleetDto {
  name: string
  supplierId: string
}

export interface UpdateFleetDto {
  name?: string
}

class FleetService {
  private readonly basePath = '/fleets'

  async getAll(page = 1, limit = 100, filters?: { supplierId?: string; blocked?: boolean }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.supplierId) params.append('supplierId', filters.supplierId)
    if (filters?.blocked !== undefined) params.append('blocked', filters.blocked.toString())
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateFleetDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateFleetDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return api.patch(`${this.basePath}/${id}/blocked`, { blocked, blockedReason })
  }
}

export default new FleetService()
