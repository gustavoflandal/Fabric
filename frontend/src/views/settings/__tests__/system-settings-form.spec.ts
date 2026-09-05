import { describe, it, expect } from 'vitest'
import { groupByCategory, CATEGORY_LABELS, validateSettingInput, KEY_ENUM_VALUES } from '../system-settings-form'
import type { SystemSetting } from '@/types/system-setting.types'

const setting = (overrides: Partial<SystemSetting> = {}): SystemSetting => ({
  key: 'wms.task_delay_threshold_hours',
  value: '24',
  type: 'NUMBER',
  category: 'wms',
  label: 'Limiar de tarefa atrasada (horas)',
  description: null,
  updatedAt: '2026-09-05T00:00:00.000Z',
  ...overrides,
})

describe('system-settings-form', () => {
  describe('groupByCategory', () => {
    it('agrupa por categoria preservando a ordem de chegada dentro do grupo', () => {
      const settings = [
        setting({ key: 'wms.a', category: 'wms' }),
        setting({ key: 'auditoria.x', category: 'auditoria' }),
        setting({ key: 'wms.b', category: 'wms' }),
      ]
      const grouped = groupByCategory(settings)
      expect(Object.keys(grouped)).toEqual(['wms', 'auditoria'])
      expect(grouped.wms.map((s) => s.key)).toEqual(['wms.a', 'wms.b'])
    })
  })

  describe('KEY_ENUM_VALUES', () => {
    it('espelha os valores fechados de audit.mode aceitos pelo backend', () => {
      expect(KEY_ENUM_VALUES['audit.mode']).toEqual(['all', 'write_only', 'errors_only', 'none'])
    })
  })

  describe('CATEGORY_LABELS', () => {
    it('tem rótulo amigável para as 3 categorias da v1', () => {
      expect(CATEGORY_LABELS.wms).toBe('WMS')
      expect(CATEGORY_LABELS.auditoria).toBe('Auditoria')
      expect(CATEGORY_LABELS.rate_limit).toBe('Rate Limiting')
    })
  })

  describe('validateSettingInput', () => {
    it('NUMBER: aceita numérico, rejeita não-numérico', () => {
      expect(validateSettingInput('NUMBER', '24')).toBeNull()
      expect(validateSettingInput('NUMBER', 'abc')).not.toBeNull()
    })

    it('BOOLEAN: aceita "true"/"false", rejeita outro texto', () => {
      expect(validateSettingInput('BOOLEAN', 'true')).toBeNull()
      expect(validateSettingInput('BOOLEAN', 'talvez')).not.toBeNull()
    })

    it('STRING: sempre válido', () => {
      expect(validateSettingInput('STRING', '')).toBeNull()
      expect(validateSettingInput('STRING', 'qualquer coisa')).toBeNull()
    })

    it('JSON: aceita objeto válido, rejeita sintaxe inválida', () => {
      expect(validateSettingInput('JSON', '{"a":1}')).toBeNull()
      expect(validateSettingInput('JSON', '{a:1}')).not.toBeNull()
    })
  })
})
