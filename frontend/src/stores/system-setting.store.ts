import { defineStore } from 'pinia'
import { ref } from 'vue'
import systemSettingService from '@/services/system-setting.service'
import type { SystemSetting } from '@/types/system-setting.types'

export const useSystemSettingStore = defineStore('systemSetting', () => {
  const settings = ref<SystemSetting[]>([])
  const loading = ref(false)
  const error = ref('')

  const fetchSettings = async (): Promise<void> => {
    loading.value = true
    error.value = ''
    try {
      const response = await systemSettingService.getAll()
      settings.value = response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar configurações'
    } finally {
      loading.value = false
    }
  }

  const updateSetting = async (key: string, value: string): Promise<SystemSetting> => {
    const response = await systemSettingService.update(key, value)
    const updated = response.data.data
    const index = settings.value.findIndex((s) => s.key === key)
    if (index !== -1) settings.value[index] = updated
    return updated
  }

  return { settings, loading, error, fetchSettings, updateSetting }
})
