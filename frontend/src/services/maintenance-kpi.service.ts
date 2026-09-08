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
  mttrHours: number | null
  mtbfByEquipment: MtbfEntry[]
  preventiveComplianceRate: number
  ordersByStatusAndType: OrdersByStatusAndType[]
}

class MaintenanceKpiService {
  async getKpis() {
    return api.get('/maintenance/kpis')
  }
}

export default new MaintenanceKpiService()
