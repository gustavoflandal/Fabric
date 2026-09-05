import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SimpleTaskActionModal from '../SimpleTaskActionModal.vue'
import warehouseTaskService from '@/services/warehouse-task.service'

vi.mock('@/services/warehouse-task.service', () => ({
  default: { complete: vi.fn() },
}))

const task = {
  id: 't1', type: 'CONFERENCIA' as const, status: 'IN_PROGRESS' as const, reference: 'r1',
  referenceType: 'PURCHASE_RECEIPT', sequence: 2, assignedTo: 'me', assignee: null,
  productId: null, quantity: null, fromPositionId: null, toPositionId: null,
  version: 0, createdAt: '', startedAt: null, completedAt: null,
}

const baseProps = {
  modelValue: true,
  task,
  receiptNumber: 'REC-2026-0001',
  supplierName: 'Fornecedor Exemplo',
  items: [{ code: 'P1', name: 'Produto 1', quantity: '10', lotNumber: null, segregationGroup: null }],
}

describe('SimpleTaskActionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('ao confirmar, chama warehouseTaskService.complete com o id da tarefa e emite completed', async () => {
    vi.mocked(warehouseTaskService.complete).mockResolvedValue({ data: { status: 'success', data: task } } as any)

    const wrapper = mount(SimpleTaskActionModal, { props: baseProps, attachTo: document.body })
    const confirmBtn = document.body.querySelector('button.bg-primary-600') as HTMLElement
    confirmBtn.click()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(warehouseTaskService.complete).toHaveBeenCalledWith('t1')
    expect(wrapper.emitted('completed')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.pop()).toEqual([false])
  })

  it('em erro, mostra a mensagem e NÃO emite completed', async () => {
    vi.mocked(warehouseTaskService.complete).mockRejectedValue({
      response: { data: { message: 'Tarefa já concluída' } },
    })

    const wrapper = mount(SimpleTaskActionModal, { props: baseProps, attachTo: document.body })
    const confirmBtn = document.body.querySelector('button.bg-primary-600') as HTMLElement
    confirmBtn.click()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(document.body.textContent).toContain('Tarefa já concluída')
    expect(wrapper.emitted('completed')).toBeFalsy()
  })
})
