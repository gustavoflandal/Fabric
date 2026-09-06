import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestProduct, createTestPurchaseOrder, createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

const loginWith = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return { user, token: res.body.data.accessToken as string };
};

const createReceipt = async (token: string, userId: string) => {
  const product = await createTestProduct();
  const { order } = await createTestPurchaseOrder(userId, [
    { productId: product.id, quantity: 100, unitPrice: 10 },
  ]);
  return request(app)
    .post('/api/v1/purchase-receipts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      purchaseOrderId: order.id,
      receiptDate: new Date().toISOString(),
      items: [{ orderItemId: order.items[0].id, productId: product.id, quantityReceived: 100 }],
    });
};

describe('Integração: GET /api/v1/warehouse-tasks/kpis', () => {
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

  it('devolve os KPIs para quem tem tarefas_armazem:visualizar', async () => {
    const { user, token } = await loginWith([
      { resource: 'tarefas_armazem', action: 'visualizar' },
      { resource: 'recebimentos_compra', action: 'visualizar' },
      { resource: 'recebimentos_compra', action: 'criar' },
    ]);
    const res = await createReceipt(token, user.id);
    expect(res.status).toBe(201);

    const kpis = await request(app)
      .get('/api/v1/warehouse-tasks/kpis?days=30')
      .set('Authorization', `Bearer ${token}`);

    expect(kpis.status).toBe(200);
    expect(kpis.body.data.period.days).toBe(30);
    expect(kpis.body.data.volumeStatus.receiptsActive).toBe(1);
  });

  it('nega 403 para quem não tem tarefas_armazem:visualizar', async () => {
    const { token } = await loginWith([{ resource: 'outra_coisa', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/warehouse-tasks/kpis')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('usa days=30 como default quando o parâmetro está ausente', async () => {
    const { token } = await loginWith([{ resource: 'tarefas_armazem', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/warehouse-tasks/kpis')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.period.days).toBe(30);
  });

  it('rejeita days fora de 7/30/90 com 400', async () => {
    const { token } = await loginWith([{ resource: 'tarefas_armazem', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/warehouse-tasks/kpis?days=15')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('404 sem WMS licenciado', async () => {
    await testPrisma.licensedModule.updateMany({ where: { code: 'WMS' }, data: { enabled: false } });
    clearLicensedModuleCache();
    const { token } = await loginWith([{ resource: 'tarefas_armazem', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/warehouse-tasks/kpis')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
