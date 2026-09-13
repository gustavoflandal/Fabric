import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import CountingSessionReport from '../CountingSessionReport.vue'
import countingService from '@/services/counting.service'

vi.mock('@/services/counting.service', () => ({
  default: {
    getSessionReport: vi.fn(),
    recountItem: vi.fn(),
    acceptItem: vi.fn(),
    adjustStock: vi.fn(),
  },
}))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))
vi.mock('@/stores/theme.store', () => ({ useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }) }))
vi.mock('@/composables/useConfirm', () => ({ confirmDialog: vi.fn().mockResolvedValue(true) }))

const baseReport = {
  session: { code: 'SESSION-1', planName: 'Plano Teste' },
  summary: { totalItems: 2, countedItems: 2, divergences: 1, accuracy: 50 },
  divergences: [
    {
      id: 'item-1',
      product: { code: 'P1', name: 'Produto 1' },
      storagePosition: { code: 'R01-A-01' },
      systemQty: 10,
      countedQty: 7,
      difference: -3,
      differencePercent: -30,
      status: 'COUNTED',
    },
  ],
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [{ path: '/counting/sessions/:id/report', component: CountingSessionReport }],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/counting/sessions/sess-1/report')
  await router.isReady()
  // attachTo: document.body é necessário porque o AppModal renderiza via
  // Teleport(to: 'body') — sem isso, wrapper.find não alcança o conteúdo
  // do modal (mesmo padrão de MaintenanceOrderListView.spec.ts etc.).
  const wrapper = mount(CountingSessionReport, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('CountingSessionReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    vi.mocked(countingService.getSessionReport).mockResolvedValue(JSON.parse(JSON.stringify(baseReport)) as any)
  })

  it('carrega o relatório com sucesso (fetchSessionReport agora existe na store — antes a tela nunca conseguia carregar)', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Produto 1')
    expect(countingService.getSessionReport).toHaveBeenCalledWith('sess-1')
  })

  it('mostra a Localização a partir de storagePosition (não item.location, que não existe)', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('R01-A-01')
  })

  it('mostra o botão "Ajustar Estoque" quando há divergências (hasDivergences não existe na resposta real)', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Ajustar Estoque')
  })

  it('não mostra "Ajustar Estoque" quando não há divergências', async () => {
    vi.mocked(countingService.getSessionReport).mockResolvedValue({
      ...baseReport,
      divergences: [],
    } as any)
    const wrapper = await mountView()
    expect(wrapper.text()).not.toContain('Ajustar Estoque')
  })

  it('mostra "Recontar"/"Aceitar" para uma divergência COUNTED, e "Aceitar" chama acceptItem com o id certo', async () => {
    vi.mocked(countingService.acceptItem).mockResolvedValue({} as any)
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Recontar')
    expect(wrapper.text()).toContain('Aceitar')

    const acceptBtn = wrapper.findAll('button').find((b) => b.text() === 'Aceitar')!
    await acceptBtn.trigger('click')
    await flushPromises()

    expect(countingService.acceptItem).toHaveBeenCalledWith('item-1', undefined)
  })

  it('"Recontar" abre o modal e envia a nova quantidade via recountItem', async () => {
    vi.mocked(countingService.recountItem).mockResolvedValue({} as any)
    const wrapper = await mountView()

    const recountBtn = wrapper.findAll('button').find((b) => b.text() === 'Recontar')!
    await recountBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    const qtyInput = body.find('#recount-qty')
    expect(qtyInput.exists()).toBe(true)
    await qtyInput.setValue(9)
    await body.find('#recount-form').trigger('submit.prevent')
    await flushPromises()

    expect(countingService.recountItem).toHaveBeenCalledWith('item-1', { recountQty: 9 })
  })

  it('não mostra ações para uma divergência já Recontada/Ajustada', async () => {
    vi.mocked(countingService.getSessionReport).mockResolvedValue({
      ...baseReport,
      divergences: [{ ...baseReport.divergences[0], status: 'RECOUNTED' }],
    } as any)
    const wrapper = await mountView()

    expect(wrapper.findAll('button').some((b) => b.text() === 'Recontar')).toBe(false)
    expect(wrapper.findAll('button').some((b) => b.text() === 'Aceitar')).toBe(false)
  })
})
