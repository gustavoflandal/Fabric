import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import {
  createTestPositions,
  createTestPositionBalance,
  createTestProduct,
  createTestLot,
  createUserWithPermissions,
} from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

const loginWith = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return res.body.data.accessToken as string;
};

describe('Integração: GET /api/v1/storage-positions/occupancy', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
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

  it('classifica posições em occupied/free/blocked por armazém', async () => {
    const token = await loginWith([{ resource: 'estruturas_armazem', action: 'visualizar' }]);
    const product = await createTestProduct();
    const { positions } = await createTestPositions(3);

    // posições[0]: ocupada (tem saldo > 0)
    await createTestPositionBalance(product.id, positions[0].id, 50);
    // posições[1]: bloqueada (sem saldo)
    await testPrisma.storagePosition.update({ where: { id: positions[1].id }, data: { blocked: true } });
    // posições[2]: livre (sem saldo, sem bloqueio)

    const res = await request(app)
      .get('/api/v1/storage-positions/occupancy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const warehouseCode = positions[0].warehouseCode;
    const entry = res.body.data.byWarehouse.find((w: any) => w.warehouseCode === warehouseCode);
    expect(entry).toMatchObject({ occupied: 1, blocked: 1, free: 1, total: 3 });
  });

  it('posição com saldo só em um dos lotes (múltiplas linhas de saldo) ainda conta como occupied', async () => {
    const token = await loginWith([{ resource: 'estruturas_armazem', action: 'visualizar' }]);
    const product = await createTestProduct({ lotTracked: true });
    const { positions } = await createTestPositions(1);
    const lot = await createTestLot(product.id, { expiresAt: null });

    // Uma linha SEM lote com saldo zerado, outra COM lote com saldo real —
    // a posição tem duas linhas de StockPositionBalance (chave composta
    // produto+posição+lote), e a sem-lote (zerada) não pode mascarar a outra.
    await createTestPositionBalance(product.id, positions[0].id, 0, null);
    await createTestPositionBalance(product.id, positions[0].id, 20, lot.id);

    const res = await request(app)
      .get('/api/v1/storage-positions/occupancy')
      .set('Authorization', `Bearer ${token}`);

    const entry = res.body.data.byWarehouse.find((w: any) => w.warehouseCode === positions[0].warehouseCode);
    expect(entry).toMatchObject({ occupied: 1, blocked: 0, free: 0, total: 1 });
  });

  it('posição bloqueada COM saldo conta como blocked, não occupied', async () => {
    const token = await loginWith([{ resource: 'estruturas_armazem', action: 'visualizar' }]);
    const product = await createTestProduct();
    const { positions } = await createTestPositions(1);

    await createTestPositionBalance(product.id, positions[0].id, 50);
    await testPrisma.storagePosition.update({ where: { id: positions[0].id }, data: { blocked: true } });

    const res = await request(app)
      .get('/api/v1/storage-positions/occupancy')
      .set('Authorization', `Bearer ${token}`);

    const entry = res.body.data.byWarehouse.find((w: any) => w.warehouseCode === positions[0].warehouseCode);
    expect(entry).toMatchObject({ occupied: 0, blocked: 1, free: 0, total: 1 });
  });

  it('nega 403 para quem não tem estruturas_armazem:visualizar', async () => {
    const token = await loginWith([{ resource: 'outra_coisa', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/storage-positions/occupancy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
