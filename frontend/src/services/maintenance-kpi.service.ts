import api from './api.service'

export interface MtbfEntry {
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  mtbfHours: number | null
}

export interface OrdersByStatusAndType {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  type: 'PREVENTIVE' | 'CORRECTIVE'
  count: number
}

export interface MaintenanceKpis {
  period: { days: number }
  mttrHours: number | null
  mtbfByEquipment: MtbfEntry[]
  preventiveComplianceRate: number
  ordersByStatusAndType: OrdersByStatusAndType[]
}

class MaintenanceKpiService {
  async getKpis(days: number = 90) {
    return api.get('/maintenance/kpis', { params: { days } })
  }
}

export default new MaintenanceKpiService()
