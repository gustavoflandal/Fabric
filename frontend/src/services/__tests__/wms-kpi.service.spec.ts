import { describe, it, expect, vi, beforeEach } from 'vitest'
import wmsKpiService from '../wms-kpi.service'
import api from '../api.service'

vi.mock('../api.service', () => ({
  default: { get: vi.fn() },
}))

describe('wms-kpi.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getTaskKpis chama /warehouse-tasks/kpis com o parâmetro days', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'success', data: { period: { days: 30 } } } })

    await wmsKpiService.getTaskKpis(30)

    expect(api.get).toHaveBeenCalledWith('/warehouse-tasks/kpis', { params: { days: 30 } })
  })

  it('getOccupancy chama /storage-positions/occupancy sem parâmetros', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { byWarehouse: [] } } })

    await wmsKpiService.getOccupancy()

    expect(api.get).toHaveBeenCalledWith('/storage-positions/occupancy')
  })
})
