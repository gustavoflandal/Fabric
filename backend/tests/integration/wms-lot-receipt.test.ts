import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import {
  createTestPositions,
  createTestProduct,
  createTestPurchaseOrder,
  createUserWithPermissions,
} from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

/**
 * FASE 5 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5,
 * Fase 5) — CAPTURA DE LOTE NO RECEBIMENTO, de ponta a ponta.
 *
 * Por que pela API e não pelo service (o oposto da escolha de
 * `lot-fefo-expiry.service.test.ts`, o par deste arquivo): o que está sob teste
 * aqui é um FLUXO — conferência lê a etiqueta, alocação faz o `Lot` nascer, o
 * saldo passa a ter três dimensões — e ele atravessa o validator Joi, o branch
 * de licenciamento e dois services. Um teste de service pularia justamente a
 * borda onde `lotNumber` é exigido.
 *
 * O arquivo é SEPARADO de `wms-receipt-tasks.test.ts` pelo motivo já registrado
 * em `tests/helpers/wms-fixtures.ts`: o store do `rate-limit` é por módulo e
 * portanto por ARQUIVO de teste, e empurrar mais um bloco para aquele arquivo o
 * levaria contra o limite de requisições por IP.
 */

const RECEIPT_PERMISSIONS = [
  { resource: 'recebimentos_compra', action: 'visualizar' },
  { resource: 'recebimentos_compra', action: 'criar' },
  { resource: 'recebimentos_compra', action: 'excluir' },
  { resource: 'stock', action: 'read' },
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

interface LotFields {
  lotNumber?: string;
  manufacturedAt?: string;
  expiresAt?: string;
}

const postReceipt = async (
  token: string,
  userId: string,
  productId: string,
  quantity: number,
  lot: LotFields = {}
) => {
  const { order, supplier } = await createTestPurchaseOrder(userId, [
    { productId, quantity },
  ]);

  const res = await request(app)
    .post('/api/v1/purchase-receipts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      purchaseOrderId: order.id,
      receiptDate: new Date().toISOString(),
      items: [
        {
          orderItemId: order.items[0].id,
          productId,
          quantityReceived: quantity,
          ...lot,
        },
      ],
    });

  return { order, supplier, res };
};

/**
 * Conclui as quatro primeiras etapas da cadeia direto no banco e devolve a
 * tarefa de `ALOCACAO`. Mesma técnica (e mesma justificativa) de
 * `wms-receipt-tasks.test.ts`: o caminho HTTP dessas etapas já tem teste
 * próprio lá, e repeti-lo aqui só consumiria o orçamento de requisições.
 */
const releaseAllocationTask = async (receiptId: string) => {
  const tasks = await testPrisma.warehouseTask.findMany({
    where: { reference: receiptId, referenceType: 'PURCHASE_RECEIPT' },
    orderBy: { sequence: 'asc' },
  });

  await testPrisma.warehouseTask.updateMany({
    where: { id: { in: tasks.slice(0, tasks.length - 1).map((t) => t.id) } },
    data: { status: 'COMPLETED', startedAt: new Date(), completedAt: new Date() },
  });

  return tasks[tasks.length - 1];
};

const putaway = (
  token: string,
  taskId: string,
  body: { receiptItemId: string; storagePositionId: string; quantity: number }
) =>
  request(app)
    .post(`/api/v1/warehouse-tasks/${taskId}/putaway`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

describe('Integração: captura de lote no recebimento (Fase 5)', () => {
  beforeEach(() => {
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
  // A OBRIGATORIEDADE, e o que ela NÃO alcança
  // ==========================================================================
  describe('obrigatoriedade de lotNumber', () => {
    beforeEach(async () => {
      await setModule('COMPRAS', true);
      await setModule('WMS', true);
      clearLicensedModuleCache();
    });

    it('RECUSA o recebimento de produto lotTracked sem lotNumber', async () => {
      const { user, token } = await login();
      const product = await createTestProduct({ lotTracked: true });

      const { res } = await postReceipt(token, user.id, product.id, 100);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/controle de lote/i);
      expect(res.body.message).toContain(product.code);

      // Nada foi criado: nem recebimento, nem cadeia de tarefas.
      expect(await testPrisma.purchaseReceipt.count()).toBe(0);
      expect(await testPrisma.warehouseTask.count()).toBe(0);
    });

    it('RECUSA também quando lotNumber vem só com espaços', async () => {
      const { user, token } = await login();
      const product = await createTestProduct({ lotTracked: true });

      const { res } = await postReceipt(token, user.id, product.id, 100, {
        lotNumber: '   ',
      });

      expect(res.status).toBe(400);
      expect(await testPrisma.purchaseReceipt.count()).toBe(0);
    });

    it('produto SEM lotTracked: os campos de lote são IGNORADOS, não recusados', async () => {
      const { user, token } = await login();
      const product = await createTestProduct();

      const { res } = await postReceipt(token, user.id, product.id, 100, {
        lotNumber: 'L-RUIDO',
        expiresAt: new Date('2040-01-01').toISOString(),
      });

      expect(res.status).toBe(201);

      // Gravar o número num item cujo produto não é rastreado criaria
      // rastreabilidade que não existe — o service descarta os três campos.
      const item = await testPrisma.purchaseReceiptItem.findFirstOrThrow({
        where: { receiptId: res.body.data.id },
      });
      expect(item.lotNumber).toBeNull();
      expect(item.expiresAt).toBeNull();
      expect(await testPrisma.lot.count()).toBe(0);
    });
  });

  // ==========================================================================
  // O FLUXO COMPLETO: conferência → alocação → Lot → saldo em três dimensões
  // ==========================================================================
  describe('fluxo completo com WMS licenciado', () => {
    beforeEach(async () => {
      await setModule('COMPRAS', true);
      await setModule('WMS', true);
      clearLicensedModuleCache();
    });

    it('receber → alocar cria o Lot e o saldo por (produto, posição, lote)', async () => {
      const { user, token } = await login();
      const product = await createTestProduct({ lotTracked: true });
      const { positions } = await createTestPositions(1);

      const fabricacao = new Date('2026-01-10');
      const validade = new Date('2040-06-30');

      const { supplier, res } = await postReceipt(token, user.id, product.id, 100, {
        lotNumber: 'L-2026-001',
        manufacturedAt: fabricacao.toISOString(),
        expiresAt: validade.toISOString(),
      });

      expect(res.status).toBe(201);
      const receiptId = res.body.data.id as string;

      // A CONFERÊNCIA guarda o que foi LIDO na etiqueta — e nada mais: o `Lot`
      // ainda não existe, porque o material está na doca, não no estoque.
      const item = await testPrisma.purchaseReceiptItem.findFirstOrThrow({
        where: { receiptId },
      });
      expect(item.lotNumber).toBe('L-2026-001');
      expect(item.manufacturedAt?.toISOString()).toBe(fabricacao.toISOString());
      expect(item.expiresAt?.toISOString()).toBe(validade.toISOString());
      expect(await testPrisma.lot.count()).toBe(0);
      expect(await testPrisma.stockMovement.count()).toBe(0);

      // A ALOCAÇÃO é o que faz o lote nascer.
      const allocationTask = await releaseAllocationTask(receiptId);

      const done = await putaway(token, allocationTask.id, {
        receiptItemId: item.id,
        storagePositionId: positions[0].id,
        quantity: 100,
      });

      expect(done.status).toBe(201);
      expect(done.body.data.receiptCompleted).toBe(true);

      const lot = await testPrisma.lot.findFirstOrThrow();
      expect(lot.productId).toBe(product.id);
      expect(lot.lotNumber).toBe('L-2026-001');
      expect(lot.manufacturedAt?.toISOString()).toBe(fabricacao.toISOString());
      expect(lot.expiresAt?.toISOString()).toBe(validade.toISOString());
      // O fornecedor vem do PEDIDO por trás do recebimento.
      expect(lot.supplierId).toBe(supplier.id);

      // As TRÊS dimensões do saldo, coerentes entre si.
      const aggregate = await testPrisma.stockBalance.findUniqueOrThrow({
        where: { productId: product.id },
      });
      expect(aggregate.quantity).toBe(100);

      const positionRows = await testPrisma.stockPositionBalance.findMany({
        where: { productId: product.id },
      });
      expect(positionRows).toHaveLength(1);
      expect(positionRows[0].storagePositionId).toBe(positions[0].id);
      expect(positionRows[0].lotId).toBe(lot.id);
      expect(positionRows[0].quantity.toString()).toBe('100');

      const movement = await testPrisma.stockMovement.findFirstOrThrow({
        where: { productId: product.id },
      });
      expect(movement.type).toBe('IN');
      expect(movement.toPositionId).toBe(positions[0].id);
      expect(movement.lotId).toBe(lot.id);
    });

    it('o MESMO lote em dois recebimentos é UM Lot só, com o saldo somado', async () => {
      const { user, token } = await login();
      const product = await createTestProduct({ lotTracked: true });
      const { positions } = await createTestPositions(1);

      const validade = new Date('2040-06-30').toISOString();

      const primeiro = await postReceipt(token, user.id, product.id, 60, {
        lotNumber: 'L-MESMO',
        expiresAt: validade,
      });
      const item1 = await testPrisma.purchaseReceiptItem.findFirstOrThrow({
        where: { receiptId: primeiro.res.body.data.id },
      });
      const task1 = await releaseAllocationTask(primeiro.res.body.data.id);
      await putaway(token, task1.id, {
        receiptItemId: item1.id,
        storagePositionId: positions[0].id,
        quantity: 60,
      }).expect(201);

      // Segundo recebimento, MESMO número de lote. Sem data desta vez: o
      // segundo não pode reescrever a validade do material que já está no
      // estoque, e também não pode apagá-la.
      const segundo = await postReceipt(token, user.id, product.id, 40, {
        lotNumber: 'L-MESMO',
      });
      const item2 = await testPrisma.purchaseReceiptItem.findFirstOrThrow({
        where: { receiptId: segundo.res.body.data.id },
      });
      const task2 = await releaseAllocationTask(segundo.res.body.data.id);
      await putaway(token, task2.id, {
        receiptItemId: item2.id,
        storagePositionId: positions[0].id,
        quantity: 40,
      }).expect(201);

      // UM lote — é o ponto inteiro da rastreabilidade. Dois partiriam o saldo
      // e o recall em dois.
      const lots = await testPrisma.lot.findMany();
      expect(lots).toHaveLength(1);
      expect(lots[0].expiresAt?.toISOString()).toBe(validade);

      const positionRows = await testPrisma.stockPositionBalance.findMany({
        where: { productId: product.id },
      });
      expect(positionRows).toHaveLength(1);
      expect(positionRows[0].quantity.toString()).toBe('100');
    });

    it('o cancelamento estorna a linha do LOTE, não uma linha sem lote', async () => {
      const { user, token } = await login();
      const product = await createTestProduct({ lotTracked: true });
      const { positions } = await createTestPositions(1);

      const { res } = await postReceipt(token, user.id, product.id, 100, {
        lotNumber: 'L-ESTORNO',
        expiresAt: new Date('2040-06-30').toISOString(),
      });
      const receiptId = res.body.data.id as string;

      const item = await testPrisma.purchaseReceiptItem.findFirstOrThrow({
        where: { receiptId },
      });
      const allocationTask = await releaseAllocationTask(receiptId);
      await putaway(token, allocationTask.id, {
        receiptItemId: item.id,
        storagePositionId: positions[0].id,
        quantity: 100,
      }).expect(201);

      const cancel = await request(app)
        .delete(`/api/v1/purchase-receipts/${receiptId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'material errado' });

      expect(cancel.status).toBe(200);

      const lot = await testPrisma.lot.findFirstOrThrow();

      // A linha do lote voltou a zero. Se o estorno tivesse saído sem `lotId`,
      // ele teria procurado a linha SEM lote deste endereço — que não existe —
      // e falhado com "estoque insuficiente na posição".
      const positionRows = await testPrisma.stockPositionBalance.findMany({
        where: { productId: product.id },
      });
      expect(positionRows).toHaveLength(1);
      expect(positionRows[0].lotId).toBe(lot.id);
      expect(positionRows[0].quantity.toString()).toBe('0');

      const aggregate = await testPrisma.stockBalance.findUniqueOrThrow({
        where: { productId: product.id },
      });
      expect(aggregate.quantity).toBe(0);

      // O lote SOBREVIVE ao cancelamento: as FKs são RESTRICT e o histórico de
      // movimentação continua apontando para ele. Um lote com saldo zero é
      // rastreabilidade, não lixo.
      const movements = await testPrisma.stockMovement.findMany({
        where: { productId: product.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(movements.map((m) => [m.type, m.lotId])).toEqual([
        ['IN', lot.id],
        ['OUT', lot.id],
      ]);
    });
  });

  // ==========================================================================
  // SEM WMS licenciado: lote é do PRODUTO, não do módulo
  // ==========================================================================
  describe('sem WMS licenciado', () => {
    beforeEach(async () => {
      await setModule('COMPRAS', true);
      await setModule('WMS', false);
      clearLicensedModuleCache();
    });

    it('produto lotTracked continua exigindo lotNumber', async () => {
      const { user, token } = await login();
      const product = await createTestProduct({ lotTracked: true });

      const { res } = await postReceipt(token, user.id, product.id, 100);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/controle de lote/i);
    });

    it('com lotNumber, o recebimento linear grava a etiqueta mas NÃO cria Lot', async () => {
      const { user, token } = await login();
      const product = await createTestProduct({ lotTracked: true });

      const { res } = await postReceipt(token, user.id, product.id, 100, {
        lotNumber: 'L-SEM-WMS',
      });

      expect(res.status).toBe(201);

      const item = await testPrisma.purchaseReceiptItem.findFirstOrThrow({
        where: { receiptId: res.body.data.id },
      });
      expect(item.lotNumber).toBe('L-SEM-WMS');

      // O `Lot` nasce na ALOCAÇÃO, que só existe com WMS. Sem endereço não há
      // onde pendurar saldo por lote — a entrada é a de sempre, sem posição e
      // sem lote.
      expect(await testPrisma.lot.count()).toBe(0);

      const movement = await testPrisma.stockMovement.findFirstOrThrow({
        where: { productId: product.id },
      });
      expect(movement.type).toBe('IN');
      expect(movement.toPositionId).toBeNull();
      expect(movement.lotId).toBeNull();
    });
  });
});
