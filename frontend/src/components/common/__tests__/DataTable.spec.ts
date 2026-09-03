import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTable from '../DataTable.vue'

const items = [
  { id: 1, code: 'A-1' },
  { id: 2, code: 'A-2' },
]

const rowSlots = {
  head: '<th>Código</th>',
  row: '<template #row="{ item }"><td class="cell">{{ item.code }}</td></template>',
}

// O componente existe para que os 4 estados (I3, I11, I12) e a paginacao (I7)
// parem de ser decisao por tela. Cada estado precisa ser distinguivel dos outros.
describe('DataTable — os 4 estados', () => {
  it('loading: mostra spinner primary + "Carregando..." e nao mostra a tabela', () => {
    const wrapper = mount(DataTable, { props: { loading: true, items }, slots: rowSlots })
    const spinner = wrapper.find('[data-testid="datatable-spinner"]')
    expect(spinner.exists()).toBe(true)
    expect(spinner.classes()).toContain('border-primary-600')
    expect(wrapper.text()).toContain('Carregando...')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('error: mostra a faixa vermelha com a mensagem e o botao Tentar Novamente', () => {
    const wrapper = mount(DataTable, {
      props: { error: 'Erro ao carregar tarefas', items },
      slots: rowSlots,
    })
    const band = wrapper.find('.bg-red-50')
    expect(band.exists()).toBe(true)
    expect(band.classes()).toContain('border-red-200')
    expect(wrapper.text()).toContain('Erro ao carregar tarefas')
    expect(wrapper.text()).toContain('Tentar Novamente')
    // I11: erro nunca colapsa em tabela nem em empty state.
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('error tem precedencia sobre lista vazia (I11)', () => {
    const wrapper = mount(DataTable, {
      props: { error: 'API fora do ar', items: [], emptyTitle: 'Nenhum registro' },
      slots: rowSlots,
    })
    expect(wrapper.text()).toContain('API fora do ar')
    expect(wrapper.text()).not.toContain('Nenhum registro')
  })

  it('empty: mostra icone + titulo + frase de ajuda', () => {
    const wrapper = mount(DataTable, {
      props: {
        items: [],
        emptyTitle: 'Nenhuma tarefa encontrada',
        emptyHint: 'As tarefas aparecem aqui quando um recebimento é criado.',
      },
      slots: rowSlots,
    })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.text()).toContain('Nenhuma tarefa encontrada')
    expect(wrapper.text()).toContain('As tarefas aparecem aqui quando um recebimento é criado.')
    expect(wrapper.find('table').exists()).toBe(false)
  })

  it('empty: renderiza o CTA opcional pelo slot empty-action', () => {
    const wrapper = mount(DataTable, {
      props: { items: [], emptyTitle: 'Nenhuma ordem' },
      slots: { ...rowSlots, 'empty-action': '<button>Criar Primeira Ordem</button>' },
    })
    expect(wrapper.text()).toContain('Criar Primeira Ordem')
  })

  it('dados: renderiza uma linha por item usando o slot row', () => {
    const wrapper = mount(DataTable, { props: { items }, slots: rowSlots })
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    const cells = wrapper.findAll('td.cell')
    expect(cells[0].text()).toBe('A-1')
    expect(cells[1].text()).toBe('A-2')
  })

  it('dados: renderiza o cabecalho pelo slot head', () => {
    const wrapper = mount(DataTable, { props: { items }, slots: rowSlots })
    expect(wrapper.find('thead th').text()).toBe('Código')
  })
})

describe('DataTable — eventos', () => {
  it('emite retry ao clicar em Tentar Novamente', async () => {
    const wrapper = mount(DataTable, { props: { error: 'falhou' }, slots: rowSlots })
    await wrapper.find('.bg-red-50 button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('emite change-page com a pagina anterior e a proxima', async () => {
    const wrapper = mount(DataTable, {
      props: { items, pagination: { page: 2, limit: 20, total: 100, pages: 5 } },
      slots: rowSlots,
    })
    const buttons = wrapper.findAll('button')
    const anterior = buttons.find((b) => b.text() === 'Anterior')!
    const proxima = buttons.find((b) => b.text() === 'Próxima')!

    await anterior.trigger('click')
    expect(wrapper.emitted('change-page')?.[0]).toEqual([1])

    await proxima.trigger('click')
    expect(wrapper.emitted('change-page')?.[1]).toEqual([3])
  })
})

describe('DataTable — paginacao', () => {
  it('mostra o contador "Mostrando X a Y de Z"', () => {
    const wrapper = mount(DataTable, {
      props: { items, pagination: { page: 2, limit: 20, total: 100, pages: 5 } },
      slots: rowSlots,
    })
    const text = wrapper.text().replace(/\s+/g, ' ')
    expect(text).toContain('Mostrando 21 a 40 de 100 resultados')
  })

  it('trunca o "ate" no total na ultima pagina', () => {
    const wrapper = mount(DataTable, {
      props: { items, pagination: { page: 5, limit: 20, total: 93, pages: 5 } },
      slots: rowSlots,
    })
    expect(wrapper.text().replace(/\s+/g, ' ')).toContain('Mostrando 81 a 93 de 93 resultados')
  })

  it('desabilita Anterior na primeira pagina e Proxima na ultima', () => {
    const first = mount(DataTable, {
      props: { items, pagination: { page: 1, limit: 20, total: 100, pages: 5 } },
      slots: rowSlots,
    })
    expect(first.findAll('button').find((b) => b.text() === 'Anterior')!.attributes('disabled')).toBeDefined()

    const last = mount(DataTable, {
      props: { items, pagination: { page: 5, limit: 20, total: 100, pages: 5 } },
      slots: rowSlots,
    })
    expect(last.findAll('button').find((b) => b.text() === 'Próxima')!.attributes('disabled')).toBeDefined()
  })

  it('nao mostra paginacao com uma unica pagina nem sem pagination', () => {
    const onePage = mount(DataTable, {
      props: { items, pagination: { page: 1, limit: 20, total: 2, pages: 1 } },
      slots: rowSlots,
    })
    expect(onePage.text()).not.toContain('Mostrando')

    const none = mount(DataTable, { props: { items }, slots: rowSlots })
    expect(none.text()).not.toContain('Mostrando')
  })

  it('nao mostra paginacao durante loading nem em erro', () => {
    const pagination = { page: 2, limit: 20, total: 100, pages: 5 }
    const loading = mount(DataTable, { props: { loading: true, items, pagination }, slots: rowSlots })
    expect(loading.text()).not.toContain('Mostrando')

    const errored = mount(DataTable, { props: { error: 'x', items, pagination }, slots: rowSlots })
    expect(errored.text()).not.toContain('Mostrando')
  })
})
