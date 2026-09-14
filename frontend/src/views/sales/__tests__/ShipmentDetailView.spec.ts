import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import ShipmentDetailView from '../ShipmentDetailView.vue'
import shipmentService from '@/services/shipment.service'
import { useToast } from '@/composables/useToast'

vi.mock('@/services/shipment.service', () => ({
  default: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    startSeparation: vi.fn(),
    dispatch: vi.fn(),
    cancel: vi.fn(),
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

vi.mock('@/composables/useConfirm', () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

const shipmentItem = {
  id: 'shi-1',
  shipmentId: 'sh-1',
  salesOrderItemId: 'soi-1',
  productId: 'prod-1',
  quantity: 6,
  lotId: null,
  product: {
    id: 'prod-1',
    code: 'P001',
    name: 'Produto Um',
    lotTracked: false,
    unit: { id: 'un-1', code: 'UN', symbol: 'un' },
  },
  salesOrderItem: { id: 'soi-1', quantity: 10, pickedQty: 0, shippedQty: 4 },
  lot: null,
}

// Shape real de `listTasks` (shipment.service.ts) — `quantity` é STRING
// (Decimal serializado, decisão D2 do WMS).
function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    type: 'PICKING',
    status: 'PENDING',
    productId: 'prod-1',
    lotId: null,
    quantity: '6.0000',
    fromPositionId: 'pos-1',
    priority: 0,
    assignedTo: null,
    version: 1,
    createdAt: '2026-09-11T11:00:00.000Z',
    startedAt: null,
    completedAt: null,
    product: { id: 'prod-1', code: 'P001', name: 'Produto Um' },
    lot: null,
    fromPosition: { id: 'pos-1', code: 'ARM-RUA-AA-01' },
    assignee: null,
    ...overrides,
  }
}

function makeShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sh-1',
    shipmentNumber: 'EXP-2026-000001',
    salesOrderId: 'so-1',
    warehouseId: 'wh-1',
    status: 'PENDING',
    dispatchedAt: null,
    notes: 'Carga urgente',
    createdBy: 'u1',
    createdAt: '2026-09-11T10:00:00.000Z',
    updatedAt: '2026-09-11T10:00:00.000Z',
    salesOrder: {
      id: 'so-1',
      orderNumber: 'PV-2026-000001',
      status: 'CONFIRMED',
      customer: { id: 'cust-1', code: 'C001', name: 'Cliente Um', document: null },
    },
    warehouse: { id: 'wh-1', code: 'WH1', name: 'Armazém 1' },
    creator: { id: 'u1', name: 'Admin', email: 'a@a.com' },
    items: [shipmentItem],
    pickingTasks: [],
    ...overrides,
  }
}

function detailResponse(shipment: unknown) {
  return { data: { status: 'success', data: shipment } } as any
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/shipments', component: { template: '<div />' } },
      { path: '/shipments/:id', component: ShipmentDetailView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const router = makeRouter()
  router.push('/shipments/sh-1')
  await router.isReady()
  const wrapper = mount(ShipmentDetailView, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function buttonByText(wrapper: any, text: string) {
  return wrapper.findAll('button').find((b: any) => b.text() === text)
}

describe('ShipmentDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    document.body.innerHTML = ''
    useToast().toasts.splice(0)
  })

  it('carrega o romaneio pelo id da rota e mostra cabeçalho, itens e tarefas', async () => {
    vi.mocked(shipmentService.getById).mockResolvedValue(
      detailResponse(
        makeShipment({
          status: 'SEPARATING',
          pickingTasks: [makeTask({ status: 'IN_PROGRESS', assignee: { id: 'u2', name: 'Operador' } })],
        })
      )
    )

    const wrapper = await mountView()

    expect(shipmentService.getById).toHaveBeenCalledWith('sh-1')
    expect(wrapper.text()).toContain('EXP-2026-000001')
    expect(wrapper.text()).toContain('PV-2026-000001')
    expect(wrapper.text()).toContain('Cliente Um')
    expect(wrapper.text()).toContain('Carga urgente')
    // Item do romaneio.
    expect(wrapper.text()).toContain('P001 - Produto Um')
    // Tarefa de separação, com o rótulo compartilhado com a tela de Picking.
    expect(wrapper.text()).toContain('ARM-RUA-AA-01')
    expect(wrapper.text()).toContain('Em andamento')
    expect(wrapper.text()).toContain('Operador')
    expect(wrapper.text()).toContain('0 de 1 tarefa(s) concluída(s)')
  })

  it('mostra o estado vazio do DataTable de tarefas quando ainda não há separação', async () => {
    vi.mocked(shipmentService.getById).mockResolvedValue(detailResponse(makeShipment()))

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Nenhuma tarefa de separação')
    expect(wrapper.text()).toContain('As tarefas são geradas ao iniciar a separação do romaneio.')
  })

  it('mostra o erro quando o carregamento falha e permite tentar novamente', async () => {
    vi.mocked(shipmentService.getById).mockRejectedValue({
      response: { data: { message: 'Romaneio não encontrado' } },
    })

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Romaneio não encontrado')

    vi.mocked(shipmentService.getById).mockResolvedValue(detailResponse(makeShipment()))
    await buttonByText(wrapper, 'Tentar Novamente')!.trigger('click')
    await flushPromises()

    expect(shipmentService.getById).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('EXP-2026-000001')
  })

  it('"Iniciar Separação" chama o service e aplica o romaneio devolvido (com as tarefas criadas)', async () => {
    vi.mocked(shipmentService.getById).mockResolvedValue(detailResponse(makeShipment()))
    vi.mocked(shipmentService.startSeparation).mockResolvedValue(
      detailResponse(makeShipment({ status: 'SEPARATING', pickingTasks: [makeTask()] }))
    )

    const wrapper = await mountView()

    await buttonByText(wrapper, 'Iniciar Separação')!.trigger('click')
    await flushPromises()

    expect(shipmentService.startSeparation).toHaveBeenCalledWith('sh-1')
    // O retorno da transição substitui o estado: nenhum getById extra.
    expect(shipmentService.getById).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('0 de 1 tarefa(s) concluída(s)')
    expect(
      useToast().toasts.some(
        (t) => t.type === 'success' && t.message === 'Separação iniciada e tarefas de picking geradas.'
      )
    ).toBe(true)
  })

  it('"Despachar" fica desabilitado enquanto houver tarefa de separação em aberto', async () => {
    vi.mocked(shipmentService.getById).mockResolvedValue(
      detailResponse(
        makeShipment({
          status: 'SEPARATING',
          pickingTasks: [
            makeTask({ id: 'task-1', status: 'COMPLETED' }),
            makeTask({ id: 'task-2', status: 'PENDING' }),
          ],
        })
      )
    )

    const wrapper = await mountView()

    expect(wrapper.text()).toContain('1 de 2 tarefa(s) concluída(s)')
    expect(buttonByText(wrapper, 'Despachar')!.attributes('disabled')).toBeDefined()

    await buttonByText(wrapper, 'Despachar')!.trigger('click')
    await flushPromises()
    expect(shipmentService.dispatch).not.toHaveBeenCalled()
  })

  it('"Despachar" habilita com todas as tarefas concluídas e chama o service com o id certo', async () => {
    vi.mocked(shipmentService.getById).mockResolvedValue(
      detailResponse(
        makeShipment({
          status: 'SEPARATING',
          pickingTasks: [makeTask({ status: 'COMPLETED' })],
        })
      )
    )
    vi.mocked(shipmentService.dispatch).mockResolvedValue(
      detailResponse(
        makeShipment({
          status: 'DISPATCHED',
          dispatchedAt: '2026-09-12T15:00:00.000Z',
          pickingTasks: [makeTask({ status: 'COMPLETED' })],
          salesOrderStatus: 'SHIPPED',
        })
      )
    )

    const wrapper = await mountView()

    const dispatchBtn = buttonByText(wrapper, 'Despachar')!
    expect(dispatchBtn.attributes('disabled')).toBeUndefined()

    await dispatchBtn.trigger('click')
    await flushPromises()

    expect(shipmentService.dispatch).toHaveBeenCalledWith('sh-1')
    expect(wrapper.text()).toContain('Despachado')
    expect(
      useToast().toasts.some(
        (t) => t.type === 'success' && t.message === 'Romaneio despachado com sucesso!'
      )
    ).toBe(true)
  })

  it('romaneio sem tarefa nenhuma não habilita o despacho (mesmo gate do backend)', async () => {
    vi.mocked(shipmentService.getById).mockResolvedValue(
      detailResponse(makeShipment({ status: 'SEPARATING', pickingTasks: [] }))
    )

    const wrapper = await mountView()

    expect(buttonByText(wrapper, 'Despachar')!.attributes('disabled')).toBeDefined()
  })

  it('"Cancelar" chama o service, e o botão some depois do despacho', async () => {
    vi.mocked(shipmentService.getById).mockResolvedValue(detailResponse(makeShipment()))
    vi.mocked(shipmentService.cancel).mockResolvedValue(
      detailResponse(makeShipment({ status: 'CANCELLED' }))
    )

    const wrapper = await mountView()

    await buttonByText(wrapper, 'Cancelar')!.trigger('click')
    await flushPromises()

    expect(shipmentService.cancel).toHaveBeenCalledWith('sh-1')
    // Já cancelado: a ação deixa de ser oferecida.
    expect(buttonByText(wrapper, 'Cancelar')).toBeUndefined()
  })

  it('erro numa transição mostra a mensagem do backend e recarrega o romaneio', async () => {
    vi.mocked(shipmentService.getById).mockResolvedValue(
      detailResponse(makeShipment({ status: 'SEPARATING', pickingTasks: [makeTask({ status: 'COMPLETED' })] }))
    )
    vi.mocked(shipmentService.dispatch).mockRejectedValue({
      response: {
        data: { message: 'Não é possível despachar: 1 de 2 tarefa(s) de separação ainda não foram concluídas.' },
      },
    })

    const wrapper = await mountView()

    await buttonByText(wrapper, 'Despachar')!.trigger('click')
    await flushPromises()

    expect(
      useToast().toasts.some(
        (t) =>
          t.type === 'error' &&
          t.message ===
            'Não é possível despachar: 1 de 2 tarefa(s) de separação ainda não foram concluídas.'
      )
    ).toBe(true)
    // Recarrega para refletir o estado real depois da recusa.
    expect(shipmentService.getById).toHaveBeenCalledTimes(2)
  })
})
