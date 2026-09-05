import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestProduct, createTestPurchaseOrder, createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

/**
 * Painel de operações do WMS (Recebimento) — GET /warehouse-tasks/panel.
 *
 * Reaproveita o mesmo padrão de setup de `wms-receipt-tasks.test.ts`
 * (createReceipt via API real, não fixture direta) porque o que este teste
 * protege é justamente a AGREGAÇÃO por recebimento a partir das tarefas já
 * criadas pelo fluxo normal de recebimento — criar as tarefas via
 * `testPrisma.warehouseTask.create` direto esconderia um bug de agregação
 * atrás de um fixture que já vem "arrumado".
 */

const RECEIPT_PERMISSIONS = [
  { resource: 'recebimentos_compra', action: 'visualizar' },
  { resource: 'recebimentos_compra', action: 'criar' },
];

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

const loginReceiptUser = async () => {
  const user = await createUserWithPermissions(RECEIPT_PERMISSIONS);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return { user, token: res.body.data.accessToken as string };
};

const createReceipt = async (token: string, userId: string, quantity = 100, unitPrice = 10) => {
  const product = await createTestProduct();
  const { order } = await createTestPurchaseOrder(userId, [
    { productId: product.id, quantity, unitPrice },
  ]);
  const res = await request(app)
    .post('/api/v1/purchase-receipts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      purchaseOrderId: order.id,
      receiptDate: new Date().toISOString(),
      items: [{ orderItemId: order.items[0].id, productId: product.id, quantityReceived: quantity }],
    });
  return { product, order, res };
};

describe('Integração: painel de operações do WMS (GET /warehouse-tasks/panel)', () => {
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

  describe('com WMS e COMPRAS licenciados', () => {
    beforeEach(async () => {
      await setModule('COMPRAS', true);
      await setModule('WMS', true);
    });

    it('scope=all lista o recebimento com sua cadeia de tarefas completa, em ordem', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);
      expect(res.status).toBe(201);

      const panel = await request(app)
        .get('/api/v1/warehouse-tasks/panel?scope=all')
        .set('Authorization', `Bearer ${token}`);

      expect(panel.status).toBe(200);
      expect(panel.body.data).toHaveLength(1);
      expect(panel.body.data[0].receiptId).toBe(res.body.data.id);
      expect(panel.body.data[0].receiptNumber).toBe(res.body.data.receiptNumber);
      expect(panel.body.data[0].tasks.map((t: any) => t.type)).toEqual([
        'DESCARGA',
        'CONFERENCIA',
        'ETIQUETAGEM',
        'QUARENTENA',
        'ALOCACAO',
      ]);
      expect(panel.body.data[0].tasks.map((t: any) => t.status)).toEqual([
        'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING',
      ]);
    });

    it('recebimento sem nenhuma tarefa PENDING/IN_PROGRESS não aparece no painel', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      await testPrisma.warehouseTask.updateMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        data: { status: 'COMPLETED' },
      });

      const panel = await request(app)
        .get('/api/v1/warehouse-tasks/panel?scope=all')
        .set('Authorization', `Bearer ${token}`);

      expect(panel.body.data).toHaveLength(0);
    });

    it('scope=mine ainda traz o recebimento se pelo menos uma tarefa está livre ou atribuída ao usuário', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const otherUser = await createUserWithPermissions(RECEIPT_PERMISSIONS);
      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      // Só a primeira etapa (DESCARGA) fica atribuída a outro operador — as
      // demais continuam livres, então o recebimento ainda é "meu" (dá pra
      // pegar alguma etapa dele).
      await testPrisma.warehouseTask.update({
        where: { id: tasks[0].id },
        data: { assignedTo: otherUser.id },
      });

      const panelMine = await request(app)
        .get('/api/v1/warehouse-tasks/panel?scope=mine')
        .set('Authorization', `Bearer ${token}`);

      expect(panelMine.body.data).toHaveLength(1);
      expect(panelMine.body.data[0].tasks[0].assignedTo).toBe(otherUser.id);
      expect(panelMine.body.data[0].tasks[1].assignedTo).toBeNull();
    });

    it('scope=mine NÃO traz o recebimento se TODAS as tarefas estão atribuídas a outro operador', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const otherUser = await createUserWithPermissions(RECEIPT_PERMISSIONS);
      await testPrisma.warehouseTask.updateMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        data: { assignedTo: otherUser.id },
      });

      const panelMine = await request(app)
        .get('/api/v1/warehouse-tasks/panel?scope=mine')
        .set('Authorization', `Bearer ${token}`);

      expect(panelMine.body.data).toHaveLength(0);
    });

    it('scope omitido tem o mesmo efeito de scope=all', async () => {
      const { user, token } = await loginReceiptUser();
      await createReceipt(token, user.id, 100);

      const panel = await request(app)
        .get('/api/v1/warehouse-tasks/panel')
        .set('Authorization', `Bearer ${token}`);

      expect(panel.status).toBe(200);
      expect(panel.body.data).toHaveLength(1);
    });
  });

  it('sem WMS licenciado, retorna 404 mesmo com a permissão', async () => {
    await setModule('COMPRAS', true);
    await setModule('WMS', false);
    const { token } = await loginReceiptUser();

    const panel = await request(app)
      .get('/api/v1/warehouse-tasks/panel?scope=all')
      .set('Authorization', `Bearer ${token}`);

    expect(panel.status).toBe(404);
  });

  it('sem permissão recebimentos_compra:visualizar, retorna 403', async () => {
    await setModule('COMPRAS', true);
    await setModule('WMS', true);
    const user = await createUserWithPermissions([]);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Test@Password123' });

    const panel = await request(app)
      .get('/api/v1/warehouse-tasks/panel?scope=all')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(panel.status).toBe(403);
  });
});
