import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskRectangle from '../TaskRectangle.vue'

const task = {
  id: 't1', type: 'CONFERENCIA' as const, status: 'PENDING' as const, reference: 'r1',
  referenceType: 'PURCHASE_RECEIPT', sequence: 2, assignedTo: null, assignee: null,
  productId: null, quantity: null, fromPositionId: null, toPositionId: null,
  version: 0, createdAt: '', startedAt: null, completedAt: null,
}

describe('TaskRectangle', () => {
  it('mostra o rótulo do tipo da tarefa', () => {
    const wrapper = mount(TaskRectangle, { props: { task, state: 'active-mine' } })
    expect(wrapper.text()).toContain('Conferência')
  })

  it('fica desabilitado quando bloqueada', () => {
    const wrapper = mount(TaskRectangle, { props: { task, state: 'locked' } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('não fica desabilitado quando ativa (mesmo active-other, que é clicável pra ver detalhe)', () => {
    const wrapper = mount(TaskRectangle, { props: { task, state: 'active-other' } })
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
  })

  it('emite click ao ser clicado', async () => {
    const wrapper = mount(TaskRectangle, { props: { task, state: 'active-mine' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
