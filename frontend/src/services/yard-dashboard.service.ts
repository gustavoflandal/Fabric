import api from './api.service'

export type PunctualityStatus = 'NO_HORARIO' | 'ANTECIPADO' | 'ATRASADO' | null

export interface YardDashboardVisitRow {
  id: string
  plate: string | null
  driverName: string | null
  vehicleModel: string | null
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'
  supplierName: string | null
  origin: 'MANUAL' | 'PURCHASE_ORDER'
  currentLocation: 'PORTARIA' | 'PATIO' | 'DOCA' | 'CONCLUIDA' | 'CANCELADA'
  scheduledAt: string
  punctuality: PunctualityStatus
  performedBy: string | null
  notes: string | null
  totalDurationMinutes: number | null
}

export interface YardDashboardResponse {
  mode: 'REALTIME' | 'HISTORICAL'
  totals: { portaria: number; patio: number; doca: number }
  occupancy: {
    patioPercent: number | null
    docaPercent: number | null
    patioRatio: string | null
    docaRatio: string | null
  }
  visits: YardDashboardVisitRow[]
}

class YardDashboardService {
  private readonly basePath = '/yard-dashboard'

  async getDashboard(warehouseId: string, days?: number) {
    const params = new URLSearchParams()
    params.append('warehouseId', warehouseId)
    if (days) params.append('days', days.toString())
    return api.get(`${this.basePath}?${params.toString()}`)
  }
}

export default new YardDashboardService()
