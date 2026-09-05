export interface ReceiptItemLike {
  id: string
  productId: string
  quantity: number
  lotNumber: string | null
  product: { code: string; name: string; segregationGroup?: string | null }
}

export interface OperationItemForDocument {
  receiptItemId: string
  productId: string
  code: string
  name: string
  quantity: string
  lotNumber: string | null
  segregationGroup: string | null
}

/** Converte os itens de `GET /purchase-receipts/:id` para o formato que os modais de ação e o gerador de documento consomem. */
export function toOperationItems(items: ReceiptItemLike[]): OperationItemForDocument[] {
  return items.map((item) => ({
    receiptItemId: item.id,
    productId: item.productId,
    code: item.product.code,
    name: item.product.name,
    quantity: String(item.quantity),
    lotNumber: item.lotNumber,
    segregationGroup: item.product.segregationGroup ?? null,
  }))
}
