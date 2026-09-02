import request from 'supertest';
import { app } from '../../src/app';
import stockService from '../../src/services/stock.service';
import { prisma } from '../../src/config/database';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import {
  createTestProduct,
  createTestPositions,
  createUserWithPermissions,
} from '../helpers/fixtures';

/**
 * F1.4 do plano do WMS — a superfície de leitura do saldo por posição, pela
 * pilha HTTP completa (requireModule -> requirePermission -> validator ->
 * controller), e não só pelo service.
 *
 * As duas camadas que estes testes protegem, além do dado em si:
 *   * `requireModule('WMS')` no ponto de montagem: uma instalação só-PCP não
 *     enxerga estas rotas (404), mesmo com o usuário tendo a permissão — é a
 *     mesma regra já coberta para `/warehouses` em module-licensing.test.ts.
 *   * serialização das quantidades como STRING (decisão D2): a coluna é
 *     `Decimal(18,4)` e converter para number na borda jogaria fora a precisão
 *     pela qual ela foi criada assim. O frontend da F1.6 depende disso.
 */

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return res.body.data.accessToken as string;
};

const READ_POSITION = { resource: 'estruturas_armazem', action: 'visualizar' };
const READ_STOCK = { resource: 'stock', action: 'read' };

describe('Integração: saldo por posição (F1.3/F1.4)', () => {
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

  const seedBalances = async () => {
    const product = await createTestProduct();
    const other = await createTestProduct();
    const { warehouse, structure, positions } = await createTestPositions(2);
    const user = await createUserWithPermissions([]);

    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 12.5,
      reason: 'entrada endereçada',
      userId: user.id,
      toPositionId: positions[0].id,
    });
    await stockService.registerMovement({
      productId: other.id,
      type: 'IN',
      quantity: 3,
      reason: 'entrada endereçada de outro produto na mesma posição',
      userId: user.id,
      toPositionId: positions[0].id,
    });
    // Parcela NÃO endereçada do primeiro produto — normal nesta fase.
    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 7.5,
      reason: 'entrada sem endereço',
      userId: user.id,
    });

    return { product, other, warehouse, structure, positions };
  };

  it('GET /stock-positions/product/:id devolve o saldo por posição e a parcela não endereçada', async () => {
    const { product, positions } = await seedBalances();
    const token = await login([READ_POSITION]);

    const res = await request(app)
      .get(`/api/v1/stock-positions/product/${product.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.aggregateQuantity).toBe(20);
    // Strings, não numbers - decisão D2.
    expect(res.body.data.addressedQuantity).toBe('12.5');
    expect(res.body.data.unaddressedQuantity).toBe('7.5');
    expect(res.body.data.positions).toHaveLength(1);
    expect(res.body.data.positions[0].storagePositionId).toBe(positions[0].id);
    expect(res.body.data.positions[0].position.code).toBe(positions[0].code);
    expect(res.body.data.positions[0].quantity).toBe('12.5');
  });

  it('GET /stock-positions/position/:id devolve todos os produtos daquele endereço', async () => {
    const { positions } = await seedBalances();
    const token = await login([READ_POSITION]);

    const res = await request(app)
      .get(`/api/v1/stock-positions/position/${positions[0].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.position.code).toBe(positions[0].code);
    expect(res.body.data.occupied).toBe(true);
    expect(res.body.data.products).toHaveLength(2);

    // Posição sem nenhum saldo: responde 200 com lista vazia (existe, só está
    // livre), não 404.
    const empty = await request(app)
      .get(`/api/v1/stock-positions/position/${positions[1].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(empty.status).toBe(200);
    expect(empty.body.data.occupied).toBe(false);
    expect(empty.body.data.products).toEqual([]);
  });

  it('GET /stock-positions/occupied lista só as posições com saldo > 0 do escopo', async () => {
    const { warehouse, structure, positions } = await seedBalances();
    const token = await login([READ_POSITION]);

    const byWarehouse = await request(app)
      .get(`/api/v1/stock-positions/occupied?warehouseId=${warehouse.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(byWarehouse.status).toBe(200);
    // Duas posições existem, mas só uma tem saldo (ocupação é DERIVADA do
    // saldo - decisão D3, `occupied` como flag foi removido na F0.4).
    expect(byWarehouse.body.data).toHaveLength(1);
    expect(byWarehouse.body.data[0].position.id).toBe(positions[0].id);
    expect(byWarehouse.body.data[0].totalQuantity).toBe('15.5'); // 12.5 + 3
    expect(byWarehouse.body.data[0].products).toHaveLength(2);

    const byStructure = await request(app)
      .get(`/api/v1/stock-positions/occupied?structureId=${structure.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(byStructure.status).toBe(200);
    expect(byStructure.body.data).toHaveLength(1);
  });

  it('GET /stock-positions/occupied exige escopo (warehouseId ou structureId)', async () => {
    const token = await login([READ_POSITION]);

    const res = await request(app)
      .get('/api/v1/stock-positions/occupied')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('GET /stock-positions/divergences responde consistente quando a invariante vale', async () => {
    const { product } = await seedBalances();
    const token = await login([READ_STOCK]);

    const ok = await request(app)
      .get('/api/v1/stock-positions/divergences')
      .set('Authorization', `Bearer ${token}`);

    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ consistent: true, total: 0, divergences: [] });

    // Corrompe o agregado por fora de applyMovement (única forma de violar a
    // invariante) e confere que o endpoint acusa.
    await testPrisma.stockBalance.update({
      where: { productId: product.id },
      data: { quantity: 1 },
    });

    const bad = await request(app)
      .get('/api/v1/stock-positions/divergences')
      .set('Authorization', `Bearer ${token}`);

    expect(bad.status).toBe(200);
    expect(bad.body.data.consistent).toBe(false);
    expect(bad.body.data.divergences[0].productId).toBe(product.id);
  });

  it('exige a permissão certa (403 sem ela)', async () => {
    const { product } = await seedBalances();
    const token = await login([{ resource: 'products', action: 'read' }]);

    const res = await request(app)
      .get(`/api/v1/stock-positions/product/${product.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('some (404) para uma instalação sem o módulo WMS licenciado, mesmo com a permissão', async () => {
    const { product } = await seedBalances();
    const token = await login([READ_POSITION]);

    await testPrisma.licensedModule.update({
      where: { code: 'WMS' },
      data: { enabled: false },
    });
    clearLicensedModuleCache();

    const res = await request(app)
      .get(`/api/v1/stock-positions/product/${product.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
