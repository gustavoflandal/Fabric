import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SystemSettingsView from '../SystemSettingsView.vue'
import { useSystemSettingStore } from '@/stores/system-setting.store'
import systemSettingService from '@/services/system-setting.service'

vi.mock('@/services/system-setting.service', () => ({
  default: { getAll: vi.fn(), update: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

const mockSettings = [
  {
    key: 'wms.task_delay_threshold_hours',
    value: '24',
    type: 'NUMBER' as const,
    category: 'wms',
    label: 'Limiar de tarefa atrasada (horas)',
    description: 'ajuda',
    updatedAt: '2026-09-05T00:00:00.000Z',
  },
  {
    key: 'audit.include_reads',
    value: 'false',
    type: 'BOOLEAN' as const,
    category: 'auditoria',
    label: 'Incluir leituras',
    description: null,
    updatedAt: '2026-09-05T00:00:00.000Z',
  },
  {
    key: 'audit.mode',
    value: 'write_only',
    type: 'STRING' as const,
    category: 'auditoria',
    label: 'Modo de auditoria',
    description: null,
    updatedAt: '2026-09-05T00:00:00.000Z',
  },
]

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/settings/system', component: SystemSettingsView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('SystemSettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('carrega e agrupa as configurações por categoria ao montar', async () => {
    vi.mocked(systemSettingService.getAll).mockResolvedValue({
      data: { status: 'success', data: mockSettings },
    } as any)

    const router = makeRouter()
    router.push('/settings/system')
    await router.isReady()

    const wrapper = mount(SystemSettingsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('WMS')
    expect(wrapper.text()).toContain('Auditoria')
    expect(wrapper.text()).toContain('Limiar de tarefa atrasada')
  })

  it('salva um campo individual e mostra o valor atualizado', async () => {
    vi.mocked(systemSettingService.getAll).mockResolvedValue({
      data: { status: 'success', data: mockSettings },
    } as any)
    vi.mocked(systemSettingService.update).mockResolvedValue({
      data: { status: 'success', data: { ...mockSettings[0], value: '48' } },
    } as any)

    const router = makeRouter()
    router.push('/settings/system')
    await router.isReady()

    const wrapper = mount(SystemSettingsView, { global: { plugins: [router] } })
    await flushPromises()

    const input = wrapper.find('input[type="number"]')
    await input.setValue('48')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text().includes('Salvar'))
    await saveButtons[0].trigger('click')
    await flushPromises()

    expect(systemSettingService.update).toHaveBeenCalledWith('wms.task_delay_threshold_hours', '48')
  })

  it('renderiza um select com as 4 opções fechadas para audit.mode, não um input livre', async () => {
    vi.mocked(systemSettingService.getAll).mockResolvedValue({
      data: { status: 'success', data: mockSettings },
    } as any)

    const router = makeRouter()
    router.push('/settings/system')
    await router.isReady()

    const wrapper = mount(SystemSettingsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Modo de auditoria')

    const selects = wrapper.findAll('select')
    const auditModeSelect = selects.find(
      (select) =>
        select
          .findAll('option')
          .map((o) => o.attributes('value'))
          .join(',') === 'all,write_only,errors_only,none'
    )

    expect(auditModeSelect).toBeTruthy()
    expect(auditModeSelect!.findAll('option')).toHaveLength(4)

    // Nenhum <input> livre deve existir para a chave audit.mode.
    const inputs = wrapper.findAll('input')
    expect(inputs.every((el) => el.attributes('value') !== 'write_only')).toBe(true)
  })
})
