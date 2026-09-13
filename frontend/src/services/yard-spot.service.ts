import api from './api.service'

export interface AreaRef {
  id: string
  code: string
  name: string
}

export interface YardSpot {
  id: string
  areaId: string
  code: string
  active: boolean
  blocked: boolean
  blockedReason: string | null
  createdAt: string
  updatedAt: string
  area?: AreaRef
  visits?: { id: string; vehicle: { plate: string } }[]
}

export interface UpdateYardSpotDto {
  code?: string
}

class YardSpotService {
  private readonly basePath = '/yard-spots'

  async getAll(page = 1, limit = 100, filters?: { areaId?: string; blocked?: boolean }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.areaId) params.append('areaId', filters.areaId)
    if (filters?.blocked !== undefined) params.append('blocked', filters.blocked.toString())
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async update(id: string, data: UpdateYardSpotDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return api.patch(`${this.basePath}/${id}/blocked`, { blocked, blockedReason })
  }
}

export default new YardSpotService()
