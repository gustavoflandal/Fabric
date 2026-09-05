import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSystemSettingStore } from '../system-setting.store'
import systemSettingService from '@/services/system-setting.service'

vi.mock('@/services/system-setting.service', () => ({
  default: {
    getAll: vi.fn(),
    update: vi.fn(),
  },
}))

const mockSetting = {
  key: 'wms.task_delay_threshold_hours',
  value: '24',
  type: 'NUMBER' as const,
  category: 'wms',
  label: 'Limiar de tarefa atrasada (horas)',
  description: null,
  updatedAt: '2026-09-05T00:00:00.000Z',
}

describe('useSystemSettingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchSettings popula settings a partir do service', async () => {
    vi.mocked(systemSettingService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockSetting] },
    } as any)

    const store = useSystemSettingStore()
    await store.fetchSettings()

    expect(store.settings).toEqual([mockSetting])
    expect(store.loading).toBe(false)
  })

  it('fetchSettings marca error em caso de falha e não deixa loading travado', async () => {
    vi.mocked(systemSettingService.getAll).mockRejectedValue({
      response: { data: { message: 'falha de rede' } },
    })

    const store = useSystemSettingStore()
    await store.fetchSettings()

    expect(store.error).toBe('falha de rede')
    expect(store.loading).toBe(false)
  })

  it('updateSetting atualiza a linha correspondente na lista', async () => {
    const store = useSystemSettingStore()
    store.settings = [mockSetting]

    vi.mocked(systemSettingService.update).mockResolvedValue({
      data: { status: 'success', data: { ...mockSetting, value: '48' } },
    } as any)

    await store.updateSetting('wms.task_delay_threshold_hours', '48')

    expect(store.settings[0].value).toBe('48')
  })
})
