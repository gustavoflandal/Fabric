import { createYardVisitSchema, listYardVisitQuerySchema } from '../../src/validators/yard-visit.validator';

/**
 * Achado IMPORTANTE #2/#3 da revisão final de branch da Etapa 2 (Agendamento
 * + Check-in): supplierId era sempre opcional no validator, mesmo pra
 * RECEBIMENTO — onde a spec exige fornecedor. Isso deixava passar, sem
 * qualquer bloqueio real no backend, um agendamento de Recebimento sem
 * fornecedor (a 4ª validação crítica de check-in só roda quando
 * `visit.supplierId` está preenchido).
 */
describe('createYardVisitSchema — supplierId condicional', () => {
  const warehouseId = '11111111-1111-1111-1111-111111111111';
  const purchaseOrderId = '22222222-2222-2222-2222-222222222222';
  const supplierId = '33333333-3333-3333-3333-333333333333';
  const scheduledAt = new Date().toISOString();

  it('rejeita RECEBIMENTO sem supplierId e sem purchaseOrderId, com mensagem clara', () => {
    const { error } = createYardVisitSchema.validate({
      warehouseId,
      serviceType: 'RECEBIMENTO',
      scheduledAt,
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain('Fornecedor é obrigatório para este tipo de serviço');
  });

  it('rejeita MULTIUSO sem supplierId e sem purchaseOrderId', () => {
    const { error } = createYardVisitSchema.validate({
      warehouseId,
      serviceType: 'MULTIUSO',
      scheduledAt,
    });

    expect(error).toBeDefined();
  });

  it('aceita RECEBIMENTO com purchaseOrderId, mesmo sem supplierId no payload (o service deriva do PO)', () => {
    const { error } = createYardVisitSchema.validate({
      warehouseId,
      serviceType: 'RECEBIMENTO',
      purchaseOrderId,
      scheduledAt,
    });

    expect(error).toBeUndefined();
  });

  it('aceita RECEBIMENTO com supplierId informado diretamente', () => {
    const { error } = createYardVisitSchema.validate({
      warehouseId,
      serviceType: 'RECEBIMENTO',
      supplierId,
      scheduledAt,
    });

    expect(error).toBeUndefined();
  });

  it('aceita EXPEDICAO sem supplierId e sem purchaseOrderId (fornecedor opcional só nesse caso)', () => {
    const { error } = createYardVisitSchema.validate({
      warehouseId,
      serviceType: 'EXPEDICAO',
      scheduledAt,
    });

    expect(error).toBeUndefined();
  });
});

/**
 * Achado IMPORTANTE #2 da revisão final de branch da Etapa 4 (Operação de
 * Doca): `listYardVisitQuerySchema` ficou defasado depois que os status
 * AT_DOCK/COMPLETED foram adicionados à visita — `GET /yard-visits?status=AT_DOCK`
 * respondia 400 "Erro de validação" mesmo sendo um status válido do fluxo.
 */
describe('listYardVisitQuerySchema — status inclui todo o ciclo de vida da visita', () => {
  it('aceita status=AT_DOCK', () => {
    const { error } = listYardVisitQuerySchema.validate({ status: 'AT_DOCK' });
    expect(error).toBeUndefined();
  });

  it('aceita status=COMPLETED', () => {
    const { error } = listYardVisitQuerySchema.validate({ status: 'COMPLETED' });
    expect(error).toBeUndefined();
  });

  it('continua aceitando os status pré-existentes (SCHEDULED, CHECKED_IN, IN_YARD, CANCELLED)', () => {
    for (const status of ['SCHEDULED', 'CHECKED_IN', 'IN_YARD', 'CANCELLED']) {
      const { error } = listYardVisitQuerySchema.validate({ status });
      expect(error).toBeUndefined();
    }
  });

  it('rejeita um status inválido', () => {
    const { error } = listYardVisitQuerySchema.validate({ status: 'NAO_EXISTE' });
    expect(error).toBeDefined();
  });
});
