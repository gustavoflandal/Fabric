export type WarehouseTaskType =
  | 'DESCARGA'
  | 'CONFERENCIA'
  | 'ETIQUETAGEM'
  | 'QUARENTENA'
  | 'SEGREGACAO'
  | 'AMOSTRAGEM'
  | 'ALOCACAO'
  | 'PICKING'
  | 'REPLENISHMENT'

export type WarehouseTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface VolumeStatusEntry {
  type: WarehouseTaskType
  status: WarehouseTaskStatus
  count: number
}

export interface VolumeStatus {
  byTypeAndStatus: VolumeStatusEntry[]
  receiptsActive: number
  receiptsFinished: number
}

export interface CycleTimeByType {
  type: WarehouseTaskType
  avgHours: number
}

export interface CycleTime {
  byType: CycleTimeByType[]
  fullReceiptAvgHours: number
}

export interface ProductivityEntry {
  userId: string
  userName: string
  tasksCompleted: number
  avgExecutionHours: number
}

export interface BottleneckByType {
  type: WarehouseTaskType
  count: number
}

export interface BottleneckAffected {
  receiptId: string
  receiptNumber: string
  taskType: WarehouseTaskType
  hoursStuck: number
}

export interface Bottlenecks {
  byType: BottleneckByType[]
  affected: BottleneckAffected[]
}

export interface WmsTaskKpis {
  period: { days: number }
  volumeStatus: VolumeStatus
  cycleTime: CycleTime
  productivity: ProductivityEntry[]
  bottlenecks: Bottlenecks
}

export interface WarehouseOccupancy {
  warehouseCode: string
  occupied: number
  free: number
  blocked: number
  total: number
}

export interface OccupancyResponse {
  byWarehouse: WarehouseOccupancy[]
}
