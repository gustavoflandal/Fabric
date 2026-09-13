import api from './api.service'

export type YardVisitStatus = 'SCHEDULED' | 'CHECKED_IN' | 'IN_YARD' | 'CANCELLED'
export type PunctualityStatus = 'NO_HORARIO' | 'ANTECIPADO' | 'ATRASADO' | null

export interface WarehouseRef {
  id: string
  code: string
  name: string
}

export interface SupplierRef {
  id: string
  code: string
  name: string
}

export interface DriverRef {
  id: string
  name: string
}

export interface VehicleRef {
  id: string
  plate: string
}

export interface YardVisit {
  id: string
  warehouseId: string
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'
  supplierId: string | null
  purchaseOrderId: string | null
  scheduledAt: string
  status: YardVisitStatus
  notes: string | null
  driverId: string | null
  vehicleId: string | null
  yardSpotId: string | null
  checkedInAt: string | null
  punctuality: PunctualityStatus
  createdAt: string
  updatedAt: string
  warehouse?: WarehouseRef
  supplier?: SupplierRef | null
  driver?: DriverRef | null
  vehicle?: VehicleRef | null
}

export interface CreateYardVisitDto {
  warehouseId: string
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'
  supplierId?: string | null
  purchaseOrderId?: string | null
  scheduledAt: string
  notes?: string | null
  driverId?: string | null
  vehicleId?: string | null
}

export interface UpdateYardVisitDto {
  serviceType?: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'
  supplierId?: string | null
  purchaseOrderId?: string | null
  scheduledAt?: string
  notes?: string | null
}

export interface CheckInYardVisitDto {
  driverId: string
  vehicleId: string
}

class YardVisitService {
  private readonly basePath = '/yard-visits'

  async getAll(
    page = 1,
    limit = 100,
    filters?: { warehouseId?: string; status?: YardVisitStatus; serviceType?: string; vehicleId?: string }
  ) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.serviceType) params.append('serviceType', filters.serviceType)
    if (filters?.vehicleId) params.append('vehicleId', filters.vehicleId)
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateYardVisitDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateYardVisitDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async checkIn(id: string, data: CheckInYardVisitDto) {
    return api.patch(`${this.basePath}/${id}/check-in`, data)
  }

  async cancel(id: string) {
    return api.patch(`${this.basePath}/${id}/cancel`)
  }

  async allocateSpot(id: string, yardSpotId: string) {
    return api.patch(`${this.basePath}/${id}/allocate-spot`, { yardSpotId })
  }
}

export default new YardVisitService()
