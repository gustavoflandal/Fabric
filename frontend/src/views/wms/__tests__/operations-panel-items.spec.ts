import { describe, it, expect } from 'vitest'
import { toOperationItems } from '../operations-panel-items'

describe('toOperationItems', () => {
  it('converte item do recebimento para o formato de documento/modal', () => {
    const result = toOperationItems([
      { id: 'ri1', productId: 'p1', quantity: 10, lotNumber: 'L-01', product: { code: 'PROD-001', name: 'Parafuso', segregationGroup: 'QUIMICO' } },
    ])

    expect(result).toEqual([
      { receiptItemId: 'ri1', productId: 'p1', code: 'PROD-001', name: 'Parafuso', quantity: '10', lotNumber: 'L-01', segregationGroup: 'QUIMICO' },
    ])
  })

  it('produto sem segregationGroup vira null, não undefined', () => {
    const result = toOperationItems([
      { id: 'ri1', productId: 'p1', quantity: 5, lotNumber: null, product: { code: 'PROD-002', name: 'Chapa' } },
    ])

    expect(result[0].segregationGroup).toBeNull()
  })
})
