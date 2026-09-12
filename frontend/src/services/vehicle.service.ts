import api from './api.service'

export interface SupplierRef {
  id: string
  code: string
  name: string
}

export interface FleetRef {
  id: string
  name: string
}

export type VehicleType = 'TRUCK' | 'TOCO' | 'CAVALO' | 'MECANICO' | 'VAN' | 'UTILITARIO' | 'OUTROS'

export interface Vehicle {
  id: string
  plate: string
  type: VehicleType
  model: string | null
  supplierId: string
  fleetId: string | null
  blocked: boolean
  blockedReason: string | null
  createdAt: string
  updatedAt: string
  supplier?: SupplierRef
  fleet?: FleetRef | null
}

export interface CreateVehicleDto {
  plate: string
  type: VehicleType
  model?: string | null
  supplierId: string
  fleetId?: string | null
}

export interface UpdateVehicleDto extends Partial<CreateVehicleDto> {}

class VehicleService {
  private readonly basePath = '/vehicles'

  async getAll(
    page = 1,
    limit = 100,
    filters?: { supplierId?: string; fleetId?: string; type?: VehicleType; blocked?: boolean; search?: string }
  ) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.supplierId) params.append('supplierId', filters.supplierId)
    if (filters?.fleetId) params.append('fleetId', filters.fleetId)
    if (filters?.type) params.append('type', filters.type)
    if (filters?.blocked !== undefined) params.append('blocked', filters.blocked.toString())
    if (filters?.search) params.append('search', filters.search)
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateVehicleDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateVehicleDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return api.patch(`${this.basePath}/${id}/blocked`, { blocked, blockedReason })
  }
}

export default new VehicleService()
