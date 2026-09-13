import request from 'supertest';
import { app } from '../../src/app';
import stockService from '../../src/services/stock.service';
import { prisma } from '../../src/config/database';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import { createTestProduct, createTestPositions, createUserWithPermissions } from '../helpers/fixtures';

/**
 * Tarefa 1 (tela de Localizações do WMS) — `GET /api/v1/storage-positions`
 * (rota RAIZ, sem `:structureId`), pela pilha HTTP completa: requireModule ->
 * requirePermission -> validateQuery -> controller -> service.
 */

const READ_POSITION = { resource: 'estruturas_armazem', action: 'visualizar' };

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return res.body.data.accessToken as string;
};

describe('Integração: GET /api/v1/storage-positions (busca/browse paginado)', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
    await testPrisma.licensedModule.create({ data: { code: 'WMS', enabled: true } });
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
    await prisma.$disconnect();
  });

  it('filtra por warehouseId', async () => {
    const token = await login([READ_POSITION]);
    const { warehouse: warehouseA } = await createTestPositions(2);
    const { warehouse: warehouseB } = await createTestPositions(2);

    const res = await request(app)
      .get(`/api/v1/storage-positions?warehouseId=${warehouseA.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items.every((p: any) => p.structure.warehouseId === warehouseA.id)).toBe(true);
    expect(res.body.data.items[0].structure.warehouse.code).toBe(warehouseA.code);
    // Garante que a outra base não vaza no filtro.
    expect(res.body.data.items.every((p: any) => p.structure.warehouseId !== warehouseB.id)).toBe(true);
  });

  it('filtra por blocked', async () => {
    const token = await login([READ_POSITION]);
    const { warehouse, positions } = await createTestPositions(3);
    await testPrisma.storagePosition.update({ where: { id: positions[0].id }, data: { blocked: true } });

    const res = await request(app)
      .get(`/api/v1/storage-positions?warehouseId=${warehouse.id}&blocked=true`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].id).toBe(positions[0].id);

    const resFalse = await request(app)
      .get(`/api/v1/storage-positions?warehouseId=${warehouse.id}&blocked=false`)
      .set('Authorization', `Bearer ${token}`);

    expect(resFalse.body.data.items).toHaveLength(2);
  });

  it('filtra por occupied (derivado de saldo, não de flag)', async () => {
    const token = await login([READ_POSITION]);
    const product = await createTestProduct();
    const { warehouse, positions } = await createTestPositions(2);
    const user = await createUserWithPermissions([]);

    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 10,
      reason: 'entrada endereçada para teste de busca',
      userId: user.id,
      toPositionId: positions[0].id,
    });

    const occupied = await request(app)
      .get(`/api/v1/storage-positions?warehouseId=${warehouse.id}&occupied=true`)
      .set('Authorization', `Bearer ${token}`);

    expect(occupied.status).toBe(200);
    expect(occupied.body.data.items).toHaveLength(1);
    expect(occupied.body.data.items[0].id).toBe(positions[0].id);

    const free = await request(app)
      .get(`/api/v1/storage-positions?warehouseId=${warehouse.id}&occupied=false`)
      .set('Authorization', `Bearer ${token}`);

    expect(free.status).toBe(200);
    expect(free.body.data.items).toHaveLength(1);
    expect(free.body.data.items[0].id).toBe(positions[1].id);
  });

  it('pagina os resultados (page/limit + total/totalPages)', async () => {
    const token = await login([READ_POSITION]);
    const { warehouse } = await createTestPositions(5);

    const page1 = await request(app)
      .get(`/api/v1/storage-positions?warehouseId=${warehouse.id}&page=1&limit=2`)
      .set('Authorization', `Bearer ${token}`);

    expect(page1.status).toBe(200);
    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.pagination).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 });

    const page3 = await request(app)
      .get(`/api/v1/storage-positions?warehouseId=${warehouse.id}&page=3&limit=2`)
      .set('Authorization', `Bearer ${token}`);

    expect(page3.body.data.items).toHaveLength(1);
    expect(page3.body.data.pagination.page).toBe(3);
  });

  it('nega 403 sem a permissão estruturas_armazem:visualizar', async () => {
    const token = await login([{ resource: 'outra_coisa', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/storage-positions')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
