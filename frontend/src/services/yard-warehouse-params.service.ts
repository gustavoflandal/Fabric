import api from './api.service'

export interface YardWarehouseParams {
  id: string | null
  warehouseId: string
  useYard: boolean
  delayToleranceMinutes: number
  createdAt: string | null
  updatedAt: string | null
}

export interface UpsertYardWarehouseParamsDto {
  useYard: boolean
  delayToleranceMinutes: number
}

class YardWarehouseParamsService {
  private readonly basePath = '/yard-warehouse-params'

  async getByWarehouseId(warehouseId: string) {
    return api.get(`${this.basePath}/${warehouseId}`)
  }

  async upsert(warehouseId: string, data: UpsertYardWarehouseParamsDto) {
    return api.put(`${this.basePath}/${warehouseId}`, data)
  }
}

export default new YardWarehouseParamsService()
