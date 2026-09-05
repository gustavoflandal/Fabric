import { describe, it, expect, vi } from 'vitest'
import { buildTaskSupportDocument } from '../task-support-document'
import * as pdfGenerator from '../pdf-generator'

describe('buildTaskSupportDocument', () => {
  const baseParams = {
    taskType: 'CONFERENCIA' as const,
    receiptNumber: 'REC-2026-0001',
    supplierName: 'Fornecedor Exemplo',
    items: [
      { code: 'PROD-001', name: 'Parafuso M6', quantity: '100', lotNumber: null, segregationGroup: null },
    ],
    positions: [],
  }

  it('chama generatePDF com título específico do tipo de etapa', () => {
    const spy = vi.spyOn(pdfGenerator, 'generatePDF')
    buildTaskSupportDocument(baseParams)

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Conferência') })
    )
  });

  it('Conferência adiciona a coluna "Conferido" em branco', () => {
    const spy = vi.spyOn(pdfGenerator, 'generatePDF')
    buildTaskSupportDocument(baseParams)

    const call = spy.mock.calls[0][0]
    expect(call.itemsColumns?.some((c) => c.header === 'Conferido')).toBe(true)
  });

  it('Alocação inclui a coluna de posição sugerida quando fornecida', () => {
    const spy = vi.spyOn(pdfGenerator, 'generatePDF')
    buildTaskSupportDocument({
      ...baseParams,
      taskType: 'ALOCACAO',
      positions: [{ productCode: 'PROD-001', suggestedCode: 'ARM-A-01-01' }],
    })

    const call = spy.mock.calls[0][0]
    expect(call.itemsColumns?.some((c) => c.header === 'Posição sugerida')).toBe(true)
    expect(call.items?.[0]['Posição sugerida']).toBe('ARM-A-01-01')
  });

  it('Etiquetagem inclui coluna de lote só quando o item tem lote', () => {
    const spy = vi.spyOn(pdfGenerator, 'generatePDF')
    buildTaskSupportDocument({
      ...baseParams,
      taskType: 'ETIQUETAGEM',
      items: [{ code: 'PROD-002', name: 'Produto com lote', quantity: '10', lotNumber: 'L-2026-01', segregationGroup: null }],
    })

    const call = spy.mock.calls[0][0]
    expect(call.itemsColumns?.some((c) => c.header === 'Lote')).toBe(true)
  });

  it('tipos desconhecidos (fora dos 7 mapeados) lançam erro claro em vez de gerar documento vazio', () => {
    expect(() =>
      buildTaskSupportDocument({ ...baseParams, taskType: 'INEXISTENTE' as any })
    ).toThrow(/tipo de etapa/i)
  });
})
