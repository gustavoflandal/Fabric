import type { SystemSetting, SettingType } from '@/types/system-setting.types'

export const CATEGORY_LABELS: Record<string, string> = {
  wms: 'WMS',
  auditoria: 'Auditoria',
  rate_limit: 'Rate Limiting',
}

/** Agrupa preservando a ordem de chegada dos grupos e dos itens dentro de cada grupo — a lista já vem ordenada por categoria+chave do backend. */
export function groupByCategory(settings: SystemSetting[]): Record<string, SystemSetting[]> {
  const grouped: Record<string, SystemSetting[]> = {}
  for (const setting of settings) {
    if (!grouped[setting.category]) grouped[setting.category] = []
    grouped[setting.category].push(setting)
  }
  return grouped
}

/** Devolve uma mensagem de erro (para exibir e desabilitar o salvar) ou null se `raw` é válido para `type`. Mesma lógica de aceite de coerceSettingValue no backend — validação client-side é só UX, o backend valida de novo. */
export function validateSettingInput(type: SettingType, raw: string): string | null {
  switch (type) {
    case 'NUMBER':
      return Number.isFinite(Number(raw)) && raw.trim() !== '' ? null : 'Informe um número válido.'
    case 'BOOLEAN':
      return raw === 'true' || raw === 'false' ? null : 'Informe verdadeiro ou falso.'
    case 'JSON':
      try {
        JSON.parse(raw)
        return null
      } catch {
        return 'Informe um JSON válido.'
      }
    case 'STRING':
    default:
      return null
  }
}
