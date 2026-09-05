import { generatePDF } from './pdf-generator'
import { WAREHOUSE_TASK_TYPE_LABELS } from '@/types/warehouse-task.types'
import type { WarehouseTaskType } from '@/types/warehouse-task.types'

export interface TaskSupportDocumentItem {
  code: string
  name: string
  quantity: string
  lotNumber: string | null
  segregationGroup: string | null
}

export interface TaskSupportDocumentPosition {
  productCode: string
  suggestedCode: string | null
}

export interface TaskSupportDocumentParams {
  taskType: WarehouseTaskType
  receiptNumber: string
  supplierName: string
  items: TaskSupportDocumentItem[]
  positions: TaskSupportDocumentPosition[]
}

type ItemColumn = { header: string; key: string; align?: 'left' | 'center' | 'right' }

const BASE_COLUMNS: ItemColumn[] = [
  { header: 'Código', key: 'Código' },
  { header: 'Produto', key: 'Produto' },
  { header: 'Quantidade', key: 'Quantidade', align: 'right' },
]

/**
 * Um gerador só, configurado por tipo de etapa — todos os 7 tipos
 * compartilham a mesma base (itens do recebimento) e só divergem em colunas
 * extras/observação. Ver a tabela do spec
 * (docs/superpowers/specs/2026-09-04-painel-operacoes-wms-design.md, seção 3).
 */
export function buildTaskSupportDocument(params: TaskSupportDocumentParams) {
  const { taskType, receiptNumber, supplierName, items, positions } = params

  const label = WAREHOUSE_TASK_TYPE_LABELS[taskType]
  if (!label) {
    throw new Error(`Documento de apoio não definido para o tipo de etapa "${taskType}".`)
  }

  const extraColumns: ItemColumn[] = []
  const hasLotItem = items.some((item) => item.lotNumber)
  const hasSegregationItem = items.some((item) => item.segregationGroup)

  switch (taskType) {
    case 'CONFERENCIA':
      extraColumns.push({ header: 'Conferido', key: 'Conferido' })
      break
    case 'ETIQUETAGEM':
      if (hasLotItem) extraColumns.push({ header: 'Lote', key: 'Lote' })
      break
    case 'QUARENTENA':
      extraColumns.push({ header: 'Resultado da inspeção', key: 'Resultado' })
      break
    case 'SEGREGACAO':
      if (hasSegregationItem) extraColumns.push({ header: 'Grupo de segregação', key: 'Grupo' })
      extraColumns.push({ header: 'Justificativa', key: 'Justificativa' })
      break
    case 'AMOSTRAGEM':
      extraColumns.push({ header: 'Qtd. coletada', key: 'Qtd. coletada' })
      extraColumns.push({ header: 'Referência de laboratório', key: 'Ref. laboratório' })
      break
    case 'ALOCACAO':
      extraColumns.push({ header: 'Posição sugerida', key: 'Posição sugerida' })
      break
    case 'DESCARGA':
      // Base (código/produto/quantidade) já é o manifesto — sem coluna extra.
      break
  }

  const positionByProductCode = new Map(positions.map((p) => [p.productCode, p.suggestedCode]))

  const tableItems = items.map((item) => ({
    Código: item.code,
    Produto: item.name,
    Quantidade: item.quantity,
    ...(taskType === 'ETIQUETAGEM' && hasLotItem ? { Lote: item.lotNumber ?? '' } : {}),
    ...(taskType === 'SEGREGACAO' && hasSegregationItem ? { Grupo: item.segregationGroup ?? '' } : {}),
    ...(taskType === 'ALOCACAO' ? { 'Posição sugerida': positionByProductCode.get(item.code) ?? '' } : {}),
  }))

  return generatePDF({
    title: `${label} — Recebimento ${receiptNumber}`,
    subtitle: supplierName,
    data: { 'Nº do Recebimento': receiptNumber, Fornecedor: supplierName },
    items: tableItems,
    itemsColumns: [...BASE_COLUMNS, ...extraColumns],
  })
}
