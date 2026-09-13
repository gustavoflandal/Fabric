import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import StoragePositionsView from '../StoragePositionsView.vue'
import { storagePositionService } from '@/services/storage-position.service'
import warehouseService from '@/services/warehouse.service'

vi.mock('@/services/storage-position.service', () => ({
  storagePositionService: {
    searchPositions: vi.fn(),
    updatePosition: vi.fn(),
    getMovements: vi.fn(),
  },
}))

vi.mock('@/services/warehouse.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const warehouseA = { id: 'wh-1', code: 'WH1', name: 'Armazém 1', active: true }

const positionA = {
  id: 'pos-1',
  code: 'WH1-R01-01-01',
  structureId: 'str-1',
  warehouseCode: 'WH1',
  streetCode: 'R01',
  floor: 1,
  position: 1,
  positionType: 'PORTA_PALETES',
  blocked: false,
  isPickingArea: false,
  structure: { warehouseId: 'wh-1', warehouse: { code: 'WH1', name: 'Armazém 1' } },
}

const positionB = {
  ...positionA,
  id: 'pos-2',
  code: 'WH1-R01-01-02',
  position: 2,
  blocked: true,
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/wms/locations', component: StoragePositionsView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/wms/locations')
  await router.isReady()
  // attachTo: document.body — AppModal renderiza via Teleport(to: 'body'),
  // mesmo padrão de CountingSessionReport.spec.ts.
  const wrapper = mount(StoragePositionsView, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('StoragePositionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    vi.mocked(warehouseService.getAll).mockResolvedValue({
      data: { data: [warehouseA] },
    } as any)
    vi.mocked(storagePositionService.searchPositions).mockResolvedValue({
      data: {
        items: [positionA, positionB],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      },
    } as any)
  })

  it('lista as posições retornadas pelo service', async () => {
    const wrapper = await mountView()

    expect(storagePositionService.searchPositions).toHaveBeenCalled()
    expect(wrapper.text()).toContain('WH1-R01-01-01')
    expect(wrapper.text()).toContain('WH1-R01-01-02')
    expect(wrapper.text()).toContain('Armazém 1')
  })

  it('filtro de armazém dispara nova busca com o warehouseId certo', async () => {
    const wrapper = await mountView()
    vi.mocked(storagePositionService.searchPositions).mockClear()

    const select = wrapper.find('#sp-filter-warehouse')
    await select.setValue('wh-1')
    await flushPromises()

    expect(storagePositionService.searchPositions).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseId: 'wh-1' }),
      1,
      20
    )
  })

  it('filtro de código (debounced) dispara nova busca com o código digitado', async () => {
    vi.useFakeTimers()
    const wrapper = await mountView()
    vi.mocked(storagePositionService.searchPositions).mockClear()

    const input = wrapper.find('#sp-filter-code')
    await input.setValue('WH1-R01')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()

    expect(storagePositionService.searchPositions).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WH1-R01' }),
      1,
      20
    )
    vi.useRealTimers()
  })

  it('editar posição chama updatePosition com o payload certo e fecha o modal', async () => {
    vi.mocked(storagePositionService.updatePosition).mockResolvedValue({
      data: { ...positionA, blocked: true, isPickingArea: true },
    } as any)

    const wrapper = await mountView()

    const row = wrapper.findAll('tr').find((r) => r.text().includes('WH1-R01-01-01'))!
    const editBtn = row.findAll('button').find((b) => b.text() === 'Editar')!
    await editBtn.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    expect(body.find('[role="dialog"]').exists()).toBe(true)

    await body.find('#sp-form-blocked').setValue(true)
    await body.find('#sp-form-picking').setValue(true)
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(storagePositionService.updatePosition).toHaveBeenCalledWith('pos-1', {
      blocked: true,
      isPickingArea: true,
    })
    expect(body.find('[role="dialog"]').exists()).toBe(false)
  })

  it('"Ver Histórico" chama getMovements e lista as movimentações', async () => {
    vi.mocked(storagePositionService.getMovements).mockResolvedValue({
      data: {
        position: { id: 'pos-1', code: positionA.code },
        movements: [
          {
            id: 'mov-1',
            type: 'IN',
            direction: 'IN',
            quantity: 10,
            createdAt: '2026-09-01T12:00:00.000Z',
            product: { id: 'p1', code: 'P1', name: 'Produto 1' },
          },
        ],
      },
    } as any)

    const wrapper = await mountView()

    const row = wrapper.findAll('tr').find((r) => r.text().includes('WH1-R01-01-01'))!
    const historyBtn = row.findAll('button').find((b) => b.text() === 'Ver Histórico')!
    await historyBtn.trigger('click')
    await flushPromises()

    expect(storagePositionService.getMovements).toHaveBeenCalledWith('pos-1')
    const body = new DOMWrapper(document.body)
    expect(body.text()).toContain('Produto 1')
  })
})
