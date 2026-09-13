import api from './api.service'

export interface WarehouseRef {
  id: string
  code: string
  name: string
}

export interface YardArea {
  id: string
  warehouseId: string
  code: string
  name: string
  active: boolean
  blocked: boolean
  blockedReason: string | null
  createdAt: string
  updatedAt: string
  warehouse?: WarehouseRef
  _count?: { spots: number }
}

export interface CreateYardAreaDto {
  warehouseId: string
  code: string
  name: string
}

export interface UpdateYardAreaDto {
  code?: string
  name?: string
}

class YardAreaService {
  private readonly basePath = '/yard-areas'

  async getAll(page = 1, limit = 100, filters?: { warehouseId?: string; blocked?: boolean }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId)
    if (filters?.blocked !== undefined) params.append('blocked', filters.blocked.toString())
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`)
  }

  async create(data: CreateYardAreaDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateYardAreaDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return api.patch(`${this.basePath}/${id}/blocked`, { blocked, blockedReason })
  }

  async generateSpots(areaId: string, count: number) {
    return api.post(`${this.basePath}/${areaId}/spots/generate`, { count })
  }
}

export default new YardAreaService()
