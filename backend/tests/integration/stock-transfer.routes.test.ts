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
 * Fase 2 do plano do WMS — a transferência interna (F2.3) e os históricos por
 * posição (F2.4) pela pilha HTTP completa, não só pelo service.
 *
 * As camadas que estes testes protegem, além do dado:
 *   * `POST /stock/transfer` é a ÚNICA rota de `/stock` com
 *     `requireModule('WMS')` aplicado na própria rota — o arquivo é montado
 *     fora do módulo (é núcleo PCP), então uma instalação só-PCP tem de receber
 *     404 aqui e continuar usando o resto de `/stock` normalmente. Este segundo
 *     ponto é o que mais facilmente quebraria numa refatoração distraída.
 *   * `GET /storage-positions/:id/movements` está DENTRO do módulo (montagem em
 *     routes/index.ts), como o resto do armazém.
 *   * `GET /stock/movements/:productId` NÃO está no módulo, e o filtro novo
 *     `?positionId=` não pode tê-lo movido para lá.
 *   * RBAC e validator Joi de cada uma.
 */

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return res.body.data.accessToken as string;
};

const TRANSFER = { resource: 'storage_positions', action: 'update' };
const READ_POSITION = { resource: 'estruturas_armazem', action: 'visualizar' };
const READ_STOCK = { resource: 'stock', action: 'read' };

describe('Integração: transferência interna e histórico por posição (F2.3/F2.4)', () => {
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

  const seed = async () => {
    const product = await createTestProduct();
    const { positions } = await createTestPositions(3);
    const user = await createUserWithPermissions([]);

    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 100,
      reason: 'carga inicial endereçada',
      userId: user.id,
      toPositionId: positions[0].id,
    });

    return { product, positions };
  };

  // ------------------------------------------------------------------
  // F2.3 — POST /stock/transfer
  // ------------------------------------------------------------------

  it('POST /stock/transfer move o saldo entre endereços e preserva o agregado', async () => {
    const { product, positions } = await seed();
    const token = await login([TRANSFER]);

    const res = await request(app)
      .post('/api/v1/stock/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        fromPositionId: positions[0].id,
        toPositionId: positions[1].id,
        quantity: 25,
        reason: 'realocação para picking',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('TRANSFER');
    expect(res.body.data.fromPositionId).toBe(positions[0].id);
    expect(res.body.data.toPositionId).toBe(positions[1].id);
    // O usuário autenticado é quem assina a movimentação — não um campo do body.
    expect(res.body.data.userId).toBeDefined();

    const balances = await testPrisma.stockPositionBalance.findMany({
      orderBy: { storagePositionId: 'asc' },
    });
    const byPosition = new Map(
      balances.map((b) => [b.storagePositionId, b.quantity.toString()])
    );
    expect(byPosition.get(positions[0].id)).toBe('75');
    expect(byPosition.get(positions[1].id)).toBe('25');

    expect((await stockService.getBalance(product.id)).quantity).toBe(100);
  });

  it('POST /stock/transfer valida o payload na borda (Joi)', async () => {
    const { product, positions } = await seed();
    const token = await login([TRANSFER]);

    const post = (body: any) =>
      request(app)
        .post('/api/v1/stock/transfer')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    const valido = {
      productId: product.id,
      fromPositionId: positions[0].id,
      toPositionId: positions[1].id,
      quantity: 5,
      reason: 'transferência válida',
    };

    // Falta o destino.
    expect((await post({ ...valido, toPositionId: undefined })).status).toBe(400);
    // Destino igual à origem.
    expect((await post({ ...valido, toPositionId: positions[0].id })).status).toBe(400);
    // Quantidade não positiva.
    expect((await post({ ...valido, quantity: 0 })).status).toBe(400);
    expect((await post({ ...valido, quantity: -5 })).status).toBe(400);
    // Motivo ausente (rastreabilidade é o ponto da fase — transferência sem
    // motivo não entra).
    expect((await post({ ...valido, reason: undefined })).status).toBe(400);
    // UUID malformado.
    expect((await post({ ...valido, fromPositionId: 'nao-e-uuid' })).status).toBe(400);

    // Nenhuma delas pode ter movimentado nada.
    expect(await testPrisma.stockMovement.count({ where: { type: 'TRANSFER' } })).toBe(0);
  });

  it('POST /stock/transfer traduz regra de negócio em 4xx, não em 500', async () => {
    const { product, positions } = await seed();
    const token = await login([TRANSFER]);

    const post = (body: any) =>
      request(app)
        .post('/api/v1/stock/transfer')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    // Saldo insuficiente na origem (o payload é válido; quem recusa é o service).
    const semSaldo = await post({
      productId: product.id,
      fromPositionId: positions[1].id, // vazia
      toPositionId: positions[0].id,
      quantity: 10,
      reason: 'origem sem saldo',
    });
    expect(semSaldo.status).toBe(400);
    expect(semSaldo.body.message).toMatch(/insuficiente na posição/i);

    // Destino bloqueado.
    await testPrisma.storagePosition.update({
      where: { id: positions[1].id },
      data: { blocked: true },
    });
    const bloqueado = await post({
      productId: product.id,
      fromPositionId: positions[0].id,
      toPositionId: positions[1].id,
      quantity: 10,
      reason: 'destino bloqueado',
    });
    expect(bloqueado.status).toBe(400);
    expect(bloqueado.body.message).toMatch(/bloqueada/i);

    // Posição inexistente.
    const inexistente = await post({
      productId: product.id,
      fromPositionId: positions[0].id,
      toPositionId: '00000000-0000-0000-0000-000000000000',
      quantity: 10,
      reason: 'destino inexistente',
    });
    expect(inexistente.status).toBe(404);
  });

  it('POST /stock/transfer exige a permissão certa (403 sem ela)', async () => {
    const { product, positions } = await seed();
    // `stock:read` permite LER estoque, não realocar material fisicamente.
    const token = await login([READ_STOCK]);

    const res = await request(app)
      .post('/api/v1/stock/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        fromPositionId: positions[0].id,
        toPositionId: positions[1].id,
        quantity: 10,
        reason: 'sem permissão',
      });

    expect(res.status).toBe(403);
  });

  it('POST /stock/transfer some (404) sem o módulo WMS — mas o resto de /stock continua de pé', async () => {
    const { product, positions } = await seed();
    const token = await login([TRANSFER, READ_STOCK]);

    await testPrisma.licensedModule.update({
      where: { code: 'WMS' },
      data: { enabled: false },
    });
    clearLicensedModuleCache();

    const transfer = await request(app)
      .post('/api/v1/stock/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        fromPositionId: positions[0].id,
        toPositionId: positions[1].id,
        quantity: 10,
        reason: 'instalação sem WMS',
      });

    expect(transfer.status).toBe(404);

    // ESTA é a metade que importa: `/stock` é núcleo. Bloquear a transferência
    // não pode ter arrastado o resto do módulo de estoque junto.
    const movements = await request(app)
      .get(`/api/v1/stock/movements/${product.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(movements.status).toBe(200);

    const summary = await request(app)
      .get('/api/v1/stock/summary')
      .set('Authorization', `Bearer ${token}`);
    expect(summary.status).toBe(200);
  });

  // ------------------------------------------------------------------
  // F2.4 — históricos
  // ------------------------------------------------------------------

  it('GET /storage-positions/:id/movements traz origem, destino e direção', async () => {
    const { product, positions } = await seed();
    const token = await login([TRANSFER, READ_POSITION]);

    await request(app)
      .post('/api/v1/stock/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        fromPositionId: positions[0].id,
        toPositionId: positions[1].id,
        quantity: 40,
        reason: 'A -> B',
      });

    const origem = await request(app)
      .get(`/api/v1/storage-positions/${positions[0].id}/movements`)
      .set('Authorization', `Bearer ${token}`);

    expect(origem.status).toBe(200);
    expect(origem.body.data.position.code).toBe(positions[0].code);
    // A entrada inicial (destino) e a transferência (origem).
    expect(origem.body.data.movements).toHaveLength(2);
    expect(origem.body.data.movements.map((m: any) => [m.type, m.direction])).toEqual([
      ['TRANSFER', 'OUT'],
      ['IN', 'IN'],
    ]);
    expect(origem.body.data.movements[0].toPosition.code).toBe(positions[1].code);

    const destino = await request(app)
      .get(`/api/v1/storage-positions/${positions[1].id}/movements`)
      .set('Authorization', `Bearer ${token}`);
    expect(destino.body.data.movements).toHaveLength(1);
    expect(destino.body.data.movements[0].direction).toBe('IN');

    // Endereço que existe mas nunca foi usado: 200 com lista vazia, não 404.
    const livre = await request(app)
      .get(`/api/v1/storage-positions/${positions[2].id}/movements`)
      .set('Authorization', `Bearer ${token}`);
    expect(livre.status).toBe(200);
    expect(livre.body.data.movements).toEqual([]);

    // Endereço inexistente: 404.
    const inexistente = await request(app)
      .get('/api/v1/storage-positions/00000000-0000-0000-0000-000000000000/movements')
      .set('Authorization', `Bearer ${token}`);
    expect(inexistente.status).toBe(404);
  });

  it('GET /storage-positions/:id/movements exige permissão, módulo e query válida', async () => {
    const { positions } = await seed();

    const semPermissao = await login([{ resource: 'products', action: 'read' }]);
    expect(
      (
        await request(app)
          .get(`/api/v1/storage-positions/${positions[0].id}/movements`)
          .set('Authorization', `Bearer ${semPermissao}`)
      ).status
    ).toBe(403);

    const token = await login([READ_POSITION]);

    // Query inválida é 400, não uma lista silenciosamente vazia.
    expect(
      (
        await request(app)
          .get(`/api/v1/storage-positions/${positions[0].id}/movements?productId=lixo`)
          .set('Authorization', `Bearer ${token}`)
      ).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .get(`/api/v1/storage-positions/${positions[0].id}/movements?limit=0`)
          .set('Authorization', `Bearer ${token}`)
      ).status
    ).toBe(400);

    // Sem o módulo, a rota inteira some.
    await testPrisma.licensedModule.update({
      where: { code: 'WMS' },
      data: { enabled: false },
    });
    clearLicensedModuleCache();

    expect(
      (
        await request(app)
          .get(`/api/v1/storage-positions/${positions[0].id}/movements`)
          .set('Authorization', `Bearer ${token}`)
      ).status
    ).toBe(404);
  });

  it('GET /stock/movements/:productId aceita ?positionId= e continua fora do módulo WMS', async () => {
    const { product, positions } = await seed();
    const token = await login([TRANSFER, READ_STOCK]);

    await request(app)
      .post('/api/v1/stock/transfer')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        fromPositionId: positions[0].id,
        toPositionId: positions[1].id,
        quantity: 15,
        reason: 'A -> B',
      });

    const todas = await request(app)
      .get(`/api/v1/stock/movements/${product.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(todas.status).toBe(200);
    expect(todas.body.data).toHaveLength(2);

    const emB = await request(app)
      .get(`/api/v1/stock/movements/${product.id}?positionId=${positions[1].id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(emB.status).toBe(200);
    expect(emB.body.data).toHaveLength(1);
    expect(emB.body.data[0].type).toBe('TRANSFER');
    expect(emB.body.data[0].fromPosition.code).toBe(positions[0].code);

    // positionId malformado é 400.
    expect(
      (
        await request(app)
          .get(`/api/v1/stock/movements/${product.id}?positionId=lixo`)
          .set('Authorization', `Bearer ${token}`)
      ).status
    ).toBe(400);

    // E o filtro não moveu a rota para dentro do módulo WMS.
    await testPrisma.licensedModule.update({
      where: { code: 'WMS' },
      data: { enabled: false },
    });
    clearLicensedModuleCache();

    const semModulo = await request(app)
      .get(`/api/v1/stock/movements/${product.id}?positionId=${positions[1].id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(semModulo.status).toBe(200);
  });
});
