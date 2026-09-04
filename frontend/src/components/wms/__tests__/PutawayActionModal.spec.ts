import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PutawayActionModal from '../PutawayActionModal.vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import storageRuleService from '@/services/storage-rule.service'
import { storagePositionService } from '@/services/storage-position.service'

vi.mock('@/services/warehouse-task.service', () => ({ default: { putaway: vi.fn() } }))
vi.mock('@/services/storage-rule.service', () => ({ default: { suggestPosition: vi.fn() } }))
vi.mock('@/services/storage-position.service', () => ({
  storagePositionService: { getPositionByCode: vi.fn() },
}))

const task = {
  id: 't1', type: 'ALOCACAO' as const, status: 'IN_PROGRESS' as const, reference: 'r1',
  referenceType: 'PURCHASE_RECEIPT', sequence: 5, assignedTo: 'me', assignee: null,
  productId: null, quantity: null, fromPositionId: null, toPositionId: null,
  version: 0, createdAt: '', startedAt: null, completedAt: null,
}

const baseProps = {
  modelValue: true,
  task,
  receiptNumber: 'REC-2026-0001',
  supplierName: 'Fornecedor Exemplo',
  items: [{ receiptItemId: 'ri1', productId: 'p1', code: 'PROD-001', name: 'Produto 1', quantity: '10', lotNumber: null, segregationGroup: null }],
}

// AppModal renderiza via <Teleport to="body">, entao o conteudo do modal fica
// FORA da arvore do wrapper: wrapper.find()/findAll() nao o alcanca (mesma
// observacao de AppModal.spec.ts:17-19 e do padrao ja usado em
// SimpleTaskActionModal.spec.ts). As consultas e interacoes abaixo vao pelo
// DOM real via document.body, com attachTo: document.body no mount.
function findButton(text: string): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text)
  )
  if (!button) throw new Error(`Botao contendo "${text}" nao encontrado`)
  return button as HTMLButtonElement
}

describe('PutawayActionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    vi.mocked(storageRuleService.suggestPosition).mockResolvedValue({
      data: { status: 'success', data: { suggestion: { positionId: 'pos1', code: 'ARM-A-01-01', positionType: 'RUA', currentQuantity: '0', score: 10, reasons: [] }, alternatives: [], rejected: [], productId: 'p1', quantity: '10', appliedRuleId: null } },
    } as any)
  })

  it('ao selecionar a sugestão e confirmar, chama putaway com a posição sugerida', async () => {
    vi.mocked(warehouseTaskService.putaway).mockResolvedValue({ data: { status: 'success', data: { receiptCompleted: false } } } as any)

    const wrapper = mount(PutawayActionModal, { props: baseProps, attachTo: document.body })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    const suggestionButton = findButton('ARM-A-01-01')
    suggestionButton.click()
    await wrapper.vm.$nextTick()

    const confirmButton = findButton('Endereçar')
    confirmButton.click()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(warehouseTaskService.putaway).toHaveBeenCalledWith('t1', {
      receiptItemId: 'ri1',
      storagePositionId: 'pos1',
      quantity: 10,
    })
    expect(wrapper.emitted('completed')).toBeTruthy()
  })

  it('digitar um código manual resolve o id da posição via getPositionByCode no blur', async () => {
    vi.mocked(storagePositionService.getPositionByCode).mockResolvedValue({ data: { id: 'pos2', code: 'ARM-B-02-02' } } as any)

    const wrapper = mount(PutawayActionModal, { props: baseProps, attachTo: document.body })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const input = document.body.querySelector('input[placeholder="ARM-RUA-AA-PP"]') as HTMLInputElement
    input.value = 'ARM-B-02-02'
    input.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()
    input.dispatchEvent(new Event('blur'))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(storagePositionService.getPositionByCode).toHaveBeenCalledWith('ARM-B-02-02')
  })

  it('código de posição inválido mostra erro e não deixa confirmar', async () => {
    vi.mocked(storagePositionService.getPositionByCode).mockRejectedValue(new Error('not found'))

    const wrapper = mount(PutawayActionModal, { props: baseProps, attachTo: document.body })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const input = document.body.querySelector('input[placeholder="ARM-RUA-AA-PP"]') as HTMLInputElement
    input.value = 'CODIGO-INEXISTENTE'
    input.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()
    input.dispatchEvent(new Event('blur'))
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('Posição não encontrada')
    const confirmButton = findButton('Endereçar')
    expect(confirmButton.disabled).toBe(true)
  })
})
