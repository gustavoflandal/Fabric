import api from '@/services/api'
import type { ApiEnvelope } from '@/types/warehouse.types'

export interface PurchaseReceiptItemDetail {
  id: string
  productId: string
  acceptedQty: number
  lotNumber: string | null
  product: { code: string; name: string; segregationGroup?: string | null }
}

export interface PurchaseReceiptDetail {
  id: string
  receiptNumber: string
  items: PurchaseReceiptItemDetail[]
  order: { supplier: { name: string } | null } | null
}

export const purchaseReceiptService = {
  async getById(id: string) {
    return await api.get<ApiEnvelope<PurchaseReceiptDetail>>(`/purchase-receipts/${id}`)
  },
}

export default purchaseReceiptService
