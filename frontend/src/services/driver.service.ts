import api from './api.service'

export interface SupplierRef {
  id: string
  code: string
  name: string
}

export interface Driver {
  id: string
  name: string
  cpf: string
  supplierId: string
  blocked: boolean
  blockedReason: string | null
  createdAt: string
  updatedAt: string
  supplier?: SupplierRef
}

export interface CreateDriverDto {
  name: string
  cpf: string
  supplierId: string
}

export interface UpdateDriverDto extends Partial<CreateDriverDto> {}

class DriverService {
  private readonly basePath = '/drivers'

  async getAll(page = 1, limit = 100, filters?: { supplierId?: string; blocked?: boolean; search?: string }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.supplierId) params.append('supplierId', filters.supplierId)
    if (filters?.blocked !== undefined) params.append('blocked', filters.blocked.toString())
    if (filters?.search) params.append('search', filters.search)
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateDriverDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateDriverDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return api.patch(`${this.basePath}/${id}/blocked`, { blocked, blockedReason })
  }
}

export default new DriverService()
