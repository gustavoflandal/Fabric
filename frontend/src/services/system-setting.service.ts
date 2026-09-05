import api from './api.service'
import type { SystemSetting } from '@/types/system-setting.types'

interface ApiEnvelope<T> {
  status: 'success' | 'error'
  data: T
}

class SystemSettingService {
  async getAll() {
    return api.get<ApiEnvelope<SystemSetting[]>>('/system/settings')
  }

  async update(key: string, value: string) {
    return api.patch<ApiEnvelope<SystemSetting>>(`/system/settings/${key}`, { value })
  }
}

export default new SystemSettingService()
