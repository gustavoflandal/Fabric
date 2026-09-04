import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWarehouseTaskPanelStore } from '../warehouse-task-panel.store'
import warehouseTaskService from '@/services/warehouse-task.service'

vi.mock('@/services/warehouse-task.service', () => ({
  default: {
    getPanel: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    putaway: vi.fn(),
  },
}))

const mockOperation = {
  receiptId: 'r1',
  receiptNumber: 'REC-2026-0001',
  tasks: [
    { id: 't1', type: 'DESCARGA', status: 'PENDING', reference: 'r1', referenceType: 'PURCHASE_RECEIPT', sequence: 1, assignedTo: null, assignee: null, productId: null, quantity: null, fromPositionId: null, toPositionId: null, version: 0, createdAt: '', startedAt: null, completedAt: null },
  ],
}

describe('useWarehouseTaskPanelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchPanel popula operations a partir do service', async () => {
    vi.mocked(warehouseTaskService.getPanel).mockResolvedValue({
      data: { status: 'success', data: [mockOperation] },
    } as any)

    const store = useWarehouseTaskPanelStore()
    await store.fetchPanel('all')

    expect(store.operations).toEqual([mockOperation])
    expect(warehouseTaskService.getPanel).toHaveBeenCalledWith('all')
  })

  it('em erro, define error e relança', async () => {
    vi.mocked(warehouseTaskService.getPanel).mockRejectedValue(new Error('network'))

    const store = useWarehouseTaskPanelStore()
    await expect(store.fetchPanel('mine')).rejects.toThrow('network')
    expect(store.error).not.toBe('')
  })

  it('loading fica true durante a chamada e false depois', async () => {
    let resolvePromise: (value: any) => void
    vi.mocked(warehouseTaskService.getPanel).mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve })
    )

    const store = useWarehouseTaskPanelStore()
    const promise = store.fetchPanel('all')
    expect(store.loading).toBe(true)

    resolvePromise!({ data: { status: 'success', data: [] } })
    await promise
    expect(store.loading).toBe(false)
  })
})
