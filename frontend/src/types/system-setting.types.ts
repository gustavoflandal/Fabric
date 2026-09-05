export type SettingType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON'

export interface SystemSetting {
  key: string
  value: string
  type: SettingType
  category: string
  label: string
  description: string | null
  updatedAt: string
}
