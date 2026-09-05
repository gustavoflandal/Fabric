import type { WarehouseTask } from '@/types/warehouse-task.types'

export type RectangleState = 'completed' | 'active-mine' | 'active-other' | 'locked'

const RESOLVED_STATUSES = ['COMPLETED', 'CANCELLED']

/**
 * Mesmo critério do gate `assertChainOrderResolved` do backend: a tarefa
 * "ativa" é a primeira, na ordem em que a lista já vem ordenada (sequence
 * asc, createdAt asc), que ainda não está resolvida. `tasks` precisa vir
 * pré-ordenada — a mesma ordem que `GET /warehouse-tasks/panel` já devolve.
 */
export function computeTaskRectangleState(
  tasks: WarehouseTask[],
  task: WarehouseTask,
  currentUserId: string
): RectangleState {
  if (RESOLVED_STATUSES.includes(task.status)) {
    return 'completed'
  }

  const firstUnresolved = tasks.find((t) => !RESOLVED_STATUSES.includes(t.status))

  if (firstUnresolved?.id !== task.id) {
    return 'locked'
  }

  return task.assignedTo === null || task.assignedTo === currentUserId
    ? 'active-mine'
    : 'active-other'
}
