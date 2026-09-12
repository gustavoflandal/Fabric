import api from './api.service'

export interface WarehouseRef {
  id: string
  code: string
  name: string
}

export interface StoragePositionRef {
  id: string
  code: string
}

export type DockServiceType = 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'

export interface YardDock {
  id: string
  code: string
  serviceType: DockServiceType
  warehouseId: string
  storagePositionId: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  warehouse?: WarehouseRef
  storagePosition?: StoragePositionRef | null
}

export interface CreateYardDockDto {
  code: string
  serviceType: DockServiceType
  warehouseId: string
  storagePositionId?: string | null
  active?: boolean
}

export interface UpdateYardDockDto extends Partial<Omit<CreateYardDockDto, 'warehouseId'>> {}

class YardDockService {
  private readonly basePath = '/yard-docks'

  async getAll(page = 1, limit = 100, filters?: { warehouseId?: string; serviceType?: DockServiceType; active?: boolean }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId)
    if (filters?.serviceType) params.append('serviceType', filters.serviceType)
    if (filters?.active !== undefined) params.append('active', filters.active.toString())
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateYardDockDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateYardDockDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }
}

export default new YardDockService()
