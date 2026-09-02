import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import {
  createTestCategory,
  createTestProduct,
  createTestPurchaseOrder,
  createUserWithPermissions,
} from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

/**
 * Fase 4b — o que MUDOU na cadeia de recebimento da Fase 4a:
 *
 *   F4.6 — a etapa de `QUARENTENA` deixou de ser incondicional. Passa a ser
 *          decidida por `StorageRule.requiresQuarantine`, com fallback seguro
 *          (gera) quando não há regra aplicável. É o `// TODO Fase 4b` que
 *          estava em `warehouse-task.service.ts`.
 *   F4.7 — `receiptNumber` saiu do `count() + 1` para a sequência atômica.
 *
 * O resto da cadeia (F4.1-F4.5) é coberto por `wms-receipt-tasks.test.ts` e não
 * é repetido aqui — este arquivo existe para as DUAS mudanças acima, e separado
 * para não empurrar aquele arquivo contra o limite de requisições por IP do
 * rate limiter (ver a nota em `tests/helpers/wms-fixtures.ts`).
 */

const RECEIPT_PERMISSIONS = [
  { resource: 'recebimentos_compra', action: 'visualizar' },
  { resource: 'recebimentos_compra', action: 'criar' },
  { resource: 'recebimentos_compra', action: 'excluir' },
];

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

const login = async () => {
  const user = await createUserWithPermissions(RECEIPT_PERMISSIONS);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return { user, token: res.body.data.accessToken as string };
};

const createReceipt = async (
  token: string,
  userId: string,
  productId: string,
  quantity = 100
) => {
  const { order } = await createTestPurchaseOrder(userId, [{ productId, quantity }]);

  const res = await request(app)
    .post('/api/v1/purchase-receipts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      purchaseOrderId: order.id,
      receiptDate: new Date().toISOString(),
      items: [{ orderItemId: order.items[0].id, productId, quantityReceived: quantity }],
    });

  return { order, res };
};

const chainOf = (receiptId: string) =>
  testPrisma.warehouseTask.findMany({
    where: { referenceType: 'PURCHASE_RECEIPT', reference: receiptId },
    orderBy: { sequence: 'asc' },
    select: { sequence: true, type: true },
  });

describe('Integração: cadeia de recebimento na Fase 4b (F4.6 quarentena, F4.7 numeração)', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
    await setModule('COMPRAS', true);
    await setModule('WMS', true);
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  // ==========================================================================
  // F4.6 — quarentena condicional
  // ==========================================================================
  it('SEM regra cadastrada, a cadeia continua com QUARENTENA (comportamento da Fase 4a)', async () => {
    const { user, token } = await login();
    const product = await createTestProduct();

    const { res } = await createReceipt(token, user.id, product.id);
    expect(res.status).toBe(201);

    expect(await chainOf(res.body.data.id)).toEqual([
      { sequence: 1, type: 'DESCARGA' },
      { sequence: 2, type: 'CONFERENCIA' },
      { sequence: 3, type: 'ETIQUETAGEM' },
      { sequence: 4, type: 'QUARENTENA' },
      { sequence: 5, type: 'ALOCACAO' },
    ]);
  });

  it('com regra do produto dispensando inspeção, a cadeia NÃO tem QUARENTENA', async () => {
    const { user, token } = await login();
    const product = await createTestProduct();

    await testPrisma.storageRule.create({
      data: { productId: product.id, requiresQuarantine: false, active: true },
    });

    const { res } = await createReceipt(token, user.id, product.id);
    expect(res.status).toBe(201);

    // Quatro etapas, e a `sequence` é RENUMERADA (1..4) — a cadeia não fica com
    // um buraco na etapa 4 e a ALOCACAO não se apresenta como "etapa 5 de 4".
    expect(await chainOf(res.body.data.id)).toEqual([
      { sequence: 1, type: 'DESCARGA' },
      { sequence: 2, type: 'CONFERENCIA' },
      { sequence: 3, type: 'ETIQUETAGEM' },
      { sequence: 4, type: 'ALOCACAO' },
    ]);
  });

  it('regra de CATEGORIA também dispensa a quarentena', async () => {
    const { user, token } = await login();
    const category = await createTestCategory();
    const product = await createTestProduct({ categoryId: category.id });

    await testPrisma.storageRule.create({
      data: { categoryId: category.id, requiresQuarantine: false, active: true },
    });

    const { res } = await createReceipt(token, user.id, product.id);

    const chain = await chainOf(res.body.data.id);
    expect(chain.map((t) => t.type)).not.toContain('QUARENTENA');
  });

  it('regra que EXIGE inspeção mantém a quarentena', async () => {
    const { user, token } = await login();
    const product = await createTestProduct();

    await testPrisma.storageRule.create({
      data: { productId: product.id, requiresQuarantine: true, active: true },
    });

    const { res } = await createReceipt(token, user.id, product.id);

    const chain = await chainOf(res.body.data.id);
    expect(chain.map((t) => t.type)).toContain('QUARENTENA');
  });

  // ==========================================================================
  // F4.7 — numeração atômica
  // ==========================================================================
  it('numera os recebimentos pela sequência e NÃO reaproveita número após cancelamento', async () => {
    const { user, token } = await login();
    const product = await createTestProduct();

    const primeiro = await createReceipt(token, user.id, product.id, 10);
    const segundo = await createReceipt(token, user.id, product.id, 10);

    const ano = new Date().getFullYear();
    expect(primeiro.res.body.data.receiptNumber).toBe(`REC-${ano}-0001`);
    expect(segundo.res.body.data.receiptNumber).toBe(`REC-${ano}-0002`);

    // Cancelar o segundo. Com o antigo `count() + 1`, o próximo recebimento
    // nasceria REC-0002 de novo — reciclando o número de um documento que
    // existiu.
    await request(app)
      .delete(`/api/v1/purchase-receipts/${segundo.res.body.data.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'teste de numeração' })
      .expect(200);

    const terceiro = await createReceipt(token, user.id, product.id, 10);
    expect(terceiro.res.body.data.receiptNumber).toBe(`REC-${ano}-0003`);

    // A sequência é a fonte da verdade, não a contagem de linhas.
    const sequence = await testPrisma.documentSequence.findUniqueOrThrow({
      where: { code: `REC-${ano}` },
    });
    expect(sequence.nextValue).toBe(4);
  });
});
