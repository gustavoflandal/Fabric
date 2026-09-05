import { describe, it, expect } from 'vitest'
import { computeTaskRectangleState } from '../task-rectangle-state'
import type { WarehouseTask } from '@/types/warehouse-task.types'

function task(overrides: Partial<WarehouseTask>): WarehouseTask {
  return {
    id: 't1',
    type: 'DESCARGA',
    status: 'PENDING',
    reference: 'r1',
    referenceType: 'PURCHASE_RECEIPT',
    sequence: 1,
    assignedTo: null,
    assignee: null,
    productId: null,
    quantity: null,
    fromPositionId: null,
    toPositionId: null,
    version: 0,
    createdAt: '',
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

describe('computeTaskRectangleState', () => {
  it('tarefa COMPLETED é "completed", independente da posição na cadeia', () => {
    const t1 = task({ id: 't1', status: 'COMPLETED', sequence: 1 })
    const t2 = task({ id: 't2', status: 'PENDING', sequence: 2 })
    expect(computeTaskRectangleState([t1, t2], t1, 'me')).toBe('completed')
  })

  it('tarefa CANCELLED também é "completed" (resolvida, mesmo critério do backend)', () => {
    const t1 = task({ id: 't1', status: 'CANCELLED', sequence: 1 })
    expect(computeTaskRectangleState([t1], t1, 'me')).toBe('completed')
  })

  it('a PRIMEIRA tarefa não resolvida é "active-mine" quando livre', () => {
    const t1 = task({ id: 't1', status: 'COMPLETED', sequence: 1 })
    const t2 = task({ id: 't2', status: 'PENDING', sequence: 2, assignedTo: null })
    expect(computeTaskRectangleState([t1, t2], t2, 'me')).toBe('active-mine')
  })

  it('a primeira tarefa não resolvida é "active-mine" quando atribuída ao usuário atual', () => {
    const t1 = task({ id: 't1', status: 'PENDING', sequence: 1, assignedTo: 'me' })
    expect(computeTaskRectangleState([t1], t1, 'me')).toBe('active-mine')
  })

  it('a primeira tarefa não resolvida é "active-other" quando atribuída a outro usuário', () => {
    const t1 = task({ id: 't1', status: 'IN_PROGRESS', sequence: 1, assignedTo: 'other-user' })
    expect(computeTaskRectangleState([t1], t1, 'me')).toBe('active-other')
  })

  it('qualquer tarefa depois da ativa é "locked"', () => {
    const t1 = task({ id: 't1', status: 'PENDING', sequence: 1, assignedTo: null })
    const t2 = task({ id: 't2', status: 'PENDING', sequence: 2, assignedTo: null })
    expect(computeTaskRectangleState([t1, t2], t2, 'me')).toBe('locked')
  })

  it('cadeia inteira concluída: não há "active", mas cada tarefa é "completed"', () => {
    const t1 = task({ id: 't1', status: 'COMPLETED', sequence: 1 })
    const t2 = task({ id: 't2', status: 'COMPLETED', sequence: 2 })
    expect(computeTaskRectangleState([t1, t2], t1, 'me')).toBe('completed')
    expect(computeTaskRectangleState([t1, t2], t2, 'me')).toBe('completed')
  })
})
