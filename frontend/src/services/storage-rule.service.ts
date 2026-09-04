import api from '@/services/api'
import type { ApiEnvelope } from '@/types/warehouse.types'

export interface PositionSuggestion {
  positionId: string
  code: string
  positionType: string
  currentQuantity: string
  score: number
  reasons: string[]
}

export interface SuggestPositionResult {
  productId: string
  quantity: string
  appliedRuleId: string | null
  suggestion: PositionSuggestion | null
  alternatives: PositionSuggestion[]
  rejected: { code: string; reason: string }[]
}

export const storageRuleService = {
  async suggestPosition(productId: string, quantity: number) {
    return await api.get<ApiEnvelope<SuggestPositionResult>>(
      `/storage-rules/suggest?productId=${productId}&quantity=${quantity}`
    )
  },
}

export default storageRuleService
