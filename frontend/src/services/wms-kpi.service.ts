import api from './api.service'
import type { WmsTaskKpis, OccupancyResponse } from '@/types/wms-kpi.types'

class WmsKpiService {
  async getTaskKpis(days: number): Promise<WmsTaskKpis> {
    const response = await api.get<{ status: string; data: WmsTaskKpis }>('/warehouse-tasks/kpis', {
      params: { days },
    })
    return response.data.data
  }

  async getOccupancy(): Promise<OccupancyResponse> {
    const response = await api.get<{ success: boolean; data: OccupancyResponse }>('/storage-positions/occupancy')
    return response.data.data
  }
}

export default new WmsKpiService()
