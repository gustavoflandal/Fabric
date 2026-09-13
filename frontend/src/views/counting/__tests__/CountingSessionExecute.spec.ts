import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import CountingSessionExecute from '../CountingSessionExecute.vue'
import countingService from '@/services/counting.service'

vi.mock('@/services/counting.service', () => ({
  default: {
    getSession: vi.fn(),
    getItems: vi.fn(),
    countItem: vi.fn(),
    completeSession: vi.fn(),
  },
}))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn(), accessToken: 'tok' }) }))
vi.mock('@/stores/theme.store', () => ({ useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }) }))

// 4 itens: o do meio (índice 1) já foi "pulado" antes deste teste (segue
// PENDING), e o item 2 está sendo contado agora.
const baseItems = [
  { id: 'item-0', status: 'COUNTED', systemQty: 10, product: { code: 'P0', name: 'Produto 0' } },
  { id: 'item-1', status: 'PENDING', systemQty: 5, product: { code: 'P1', name: 'Produto 1' }, storagePosition: { code: 'R01-A-01' } },
  { id: 'item-2', status: 'PENDING', systemQty: 8, product: { code: 'P2', name: 'Produto 2' } },
  { id: 'item-3', status: 'ADJUSTED', systemQty: 3, product: { code: 'P3', name: 'Produto 3' } },
]

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/counting/sessions/:id/execute', component: CountingSessionExecute },
      { path: '/counting/sessions/:id/report', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/counting/sessions/sess-1/execute')
  await router.isReady()
  const wrapper = mount(CountingSessionExecute, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('CountingSessionExecute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(countingService.getSession).mockResolvedValue({ id: 'sess-1', code: 'SESSION-1' } as any)
    vi.mocked(countingService.getItems).mockResolvedValue(baseItems.map((i) => ({ ...i })) as any)
  })

  it('calcula o progresso contando qualquer item não-PENDING (inclusive ADJUSTED), não só COUNTED', async () => {
    const { wrapper } = await mountView()
    // item-0 (COUNTED) + item-3 (ADJUSTED) = 2 de 4 já processados.
    expect(wrapper.text()).toContain('2/4')
  })

  it('mostra o código de storagePosition como Localização (não item.location, que não existe na resposta real)', async () => {
    // A tela abre no primeiro PENDING (item-1, que tem storagePosition).
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('R01-A-01')
  })

  it('"Pular" avança pro próximo PENDING e, ao chegar no fim, dá a volta e revisita o item pulado em vez de declarar concluído', async () => {
    const { wrapper } = await mountView()
    // Começa no item-1 (primeiro PENDING).
    expect(wrapper.text()).toContain('P1')

    // Pula item-1 -> deveria ir pro item-2 (próximo PENDING).
    const skipButton = wrapper.findAll('button').find((b) => b.text() === 'Pular')!
    await skipButton.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('P2')

    // Pula item-2 também -> não sobra nenhum PENDING À FRENTE, mas item-1
    // continua PENDING (foi só pulado, nunca persistido) - a busca circular
    // deve voltar pra ele em vez de mostrar "Concluído" prematuramente.
    const skipButton2 = wrapper.findAll('button').find((b) => b.text() === 'Pular')!
    await skipButton2.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('P1')
    expect(wrapper.text()).not.toContain('Concluído')
  })

  it('só mostra "Inventário Concluído!" quando de fato não sobra nenhum item PENDING', async () => {
    vi.mocked(countingService.getItems).mockResolvedValue(
      baseItems.map((i) => ({ ...i, status: i.status === 'PENDING' ? 'COUNTED' : i.status })) as any
    )
    const { wrapper } = await mountView()
    expect(wrapper.text()).toContain('Inventário Concluído!')
  })
})
