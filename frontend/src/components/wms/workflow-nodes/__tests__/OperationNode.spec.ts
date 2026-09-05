import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { VueFlow } from '@vue-flow/core'
import OperationNode from '../OperationNode.vue'

describe('OperationNode', () => {
  it('mostra o rótulo e ícone do tipo de nó', () => {
    const wrapper = mount(OperationNode, {
      props: { data: { type: 'DESCARGA' } },
      global: { stubs: { Handle: true } },
    })
    expect(wrapper.text()).toContain('Descarga')
  })

  it('não renderiza handle de saída (source) para Alocação', () => {
    const wrapper = mount(OperationNode, {
      props: { data: { type: 'ALOCACAO' } },
      global: { stubs: { Handle: { template: '<div class="handle-stub" :data-type="type" />', props: ['type'] } } },
    })
    const sourceHandles = wrapper.findAll('.handle-stub[data-type="source"]')
    expect(sourceHandles).toHaveLength(0)
  })
})
