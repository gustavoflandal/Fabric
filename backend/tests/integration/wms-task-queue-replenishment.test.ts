import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import {
  createTestPositions,
  createTestProduct,
  createTestProductionOrderWithBom,
  createTestUser,
} from '../helpers/fixtures';
import {
  executeTask,
  loginWarehouseUser,
  reserveForOrder,
  seedStock,
  setModule,
} from '../helpers/wms-fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import replenishmentJob from '../../src/jobs/replenishment.job';

/**
 * Fase 4b do plano do WMS — FILA DE OPERADOR (F4.9), SUPERFÍCIE DE COLETOR
 * (F4.11) e REPOSIÇÃO (F4.10).
 *
 * Separado de `wms-picking-tasks.test.ts` por um motivo mecânico documentado em
 * `tests/helpers/wms-fixtures.ts`: o rate limiter conta TODA requisição contra o
 * limite de login, e o store é por arquivo de teste.
 */

describe('Integração: fila de operador, coletor e reposição (Fase 4b, F4.9-F4.11)', () => {
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

  // ==========================================================================
  // F4.9 / F4.11 — fila do operador e API de coletor
  // ==========================================================================
  describe('fila do operador e API de coletor', () => {
    /** Cria uma tarefa de PICKING real (via reserva de ordem) para operar. */
    const setupPickingTask = async (token: string, userId: string) => {
      const component = await createTestProduct();
      const { positions } = await createTestPositions(1);
      await seedStock(component.id, [{ positionId: positions[0].id, quantity: 100 }]);

      const { order } = await createTestProductionOrderWithBom(
        userId,
        [{ productId: component.id, quantity: 30 }],
        1
      );
      await reserveForOrder(token, order.id).expect(200);

      return {
        component,
        position: positions[0],
        order,
        task: await testPrisma.warehouseTask.findFirstOrThrow(),
      };
    };

    it('GET /my devolve as tarefas abertas do pool (não atribuídas)', async () => {
      const { user, token } = await loginWarehouseUser();
      const { task } = await setupPickingTask(token, user.id);

      const res = await request(app)
        .get('/api/v1/warehouse-tasks/my')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(task.id);
      // Decisão D2: quantidade Decimal sai como STRING.
      expect(res.body.data[0].quantity).toBe('30');
    });

    it('GET /my NÃO devolve tarefa atribuída a outro operador', async () => {
      const { user, token } = await loginWarehouseUser();
      const { task } = await setupPickingTask(token, user.id);
      const outro = await createTestUser();

      await request(app)
        .post(`/api/v1/warehouse-tasks/${task.id}/assign`)
        .set('Authorization', `Bearer ${token}`)
        .send({ assignedTo: outro.id })
        .expect(200);

      const res = await request(app)
        .get('/api/v1/warehouse-tasks/my')
        .set('Authorization', `Bearer ${token}`);

      expect(res.body.data).toHaveLength(0);
    });

    it('POST /start marca IN_PROGRESS, carimba startedAt, atribui, e é idempotente', async () => {
      const { user, token } = await loginWarehouseUser();
      const { task } = await setupPickingTask(token, user.id);

      const res = await request(app)
        .post(`/api/v1/warehouse-tasks/${task.id}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('IN_PROGRESS');
      expect(res.body.data.startedAt).not.toBeNull();
      expect(res.body.data.assignedTo).toBe(user.id);

      // Idempotente para o próprio dono: um coletor com sinal ruim repete a
      // chamada o tempo todo e não pode receber erro por isso.
      const again = await request(app)
        .post(`/api/v1/warehouse-tasks/${task.id}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(again.status).toBe(200);
      expect(again.body.data.startedAt).toBe(res.body.data.startedAt);
    });

    it('POST /start recusa (409) tarefa de outro operador', async () => {
      const { user, token } = await loginWarehouseUser();
      const { task } = await setupPickingTask(token, user.id);
      const outro = await createTestUser();

      await testPrisma.warehouseTask.update({
        where: { id: task.id },
        data: { assignedTo: outro.id },
      });

      const res = await request(app)
        .post(`/api/v1/warehouse-tasks/${task.id}/start`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(409);
    });

    it('POST /scan valida o código lido SEM nenhum efeito colateral', async () => {
      const { user, token } = await loginWarehouseUser();
      const { task, position, component } = await setupPickingTask(token, user.id);

      const scan = (code: string) =>
        request(app)
          .post(`/api/v1/warehouse-tasks/${task.id}/scan`)
          .set('Authorization', `Bearer ${token}`)
          .send({ code });

      const okPosition = await scan(position.code);
      expect(okPosition.status).toBe(200);
      expect(okPosition.body.data.ok).toBe(true);
      expect(okPosition.body.data.match).toBe('POSITION');

      const okProduct = await scan(component.code);
      expect(okProduct.body.data.ok).toBe(true);
      expect(okProduct.body.data.match).toBe('PRODUCT');

      // Código inexistente: 200 com ok=false. É resposta de NEGÓCIO, não erro
      // de requisição — um coletor offline-first trataria 4xx como falha de
      // rede e entraria em retentativa infinita numa leitura simplesmente
      // errada.
      const desconhecido = await scan('NAO-EXISTE-0001');
      expect(desconhecido.status).toBe(200);
      expect(desconhecido.body.data.ok).toBe(false);
      expect(desconhecido.body.data.match).toBeNull();

      // NENHUM efeito colateral depois de três leituras.
      const unchanged = await testPrisma.warehouseTask.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(unchanged.status).toBe('PENDING');
      expect(unchanged.startedAt).toBeNull();
      expect(unchanged.version).toBe(task.version);
      expect(await testPrisma.stockMovement.count()).toBe(0);
    });

    it('POST /scan devolve ok=false e o endereço esperado quando bipa a posição errada', async () => {
      const { user, token } = await loginWarehouseUser();
      const { task, position } = await setupPickingTask(token, user.id);
      const { positions: outras } = await createTestPositions(1, { streetCode: 'R99' });

      const res = await request(app)
        .post(`/api/v1/warehouse-tasks/${task.id}/scan`)
        .set('Authorization', `Bearer ${token}`)
        .send({ code: outras[0].code });

      expect(res.status).toBe(200);
      expect(res.body.data.ok).toBe(false);
      expect(res.body.data.match).toBe('POSITION');
      expect(res.body.data.message).toMatch(/Endereço incorreto/);
      expect(res.body.data.expected.position).toBe(position.code);
    });

    it('tarefa atribuída só é executada pelo dono', async () => {
      const { user, token } = await loginWarehouseUser();
      const { task } = await setupPickingTask(token, user.id);
      const outro = await createTestUser();

      await testPrisma.warehouseTask.update({
        where: { id: task.id },
        data: { assignedTo: outro.id },
      });

      const res = await executeTask(token, task.id);

      expect(res.status).toBe(409);
      expect(await testPrisma.stockMovement.count()).toBe(0);
    });
  });

  // ==========================================================================
  // F4.10 — REPOSIÇÃO
  // ==========================================================================
  describe('reposição da área de picking (F4.10)', () => {
    /**
     * Cenário canônico: uma posição de PICKING e uma de PULMÃO. As duas vêm de
     * chamadas distintas de `createTestPositions` porque `isPickingArea` é
     * aplicado a todas as posições de uma mesma estrutura na fixture.
     */
    const setupScenario = async (
      pickingQty: number,
      bulkQty: number,
      product: { minStock?: number; safetyStock?: number; maxStock?: number } = {}
    ) => {
      const created = await createTestProduct({
        minStock: product.minStock ?? 20,
        safetyStock: product.safetyStock ?? 0,
        maxStock: product.maxStock,
      });

      const { positions: picking } = await createTestPositions(1, {
        streetCode: 'P01',
        isPickingArea: true,
      });
      const { positions: bulk } = await createTestPositions(1, { streetCode: 'B01' });

      const layout = [{ positionId: picking[0].id, quantity: pickingQty }];
      if (bulkQty > 0) {
        layout.push({ positionId: bulk[0].id, quantity: bulkQty });
      }
      await seedStock(created.id, layout);

      return { product: created, picking: picking[0], bulk: bulk[0] };
    };

    /** MANAGER é o destinatário de toda notificação do sistema. */
    const createManager = async () => {
      const manager = await createTestUser();
      const role = await testPrisma.role.create({
        data: { code: 'MANAGER', name: 'Gerente' },
      });
      await testPrisma.userRole.create({ data: { userId: manager.id, roleId: role.id } });
      return manager;
    };

    it('gera tarefa REPLENISHMENT do pulmão para o picking abaixo do mínimo', async () => {
      const { product, picking, bulk } = await setupScenario(5, 500);

      const needs = await replenishmentJob.runManually();

      expect(needs).toHaveLength(1);
      expect(needs[0].status).toBe('TASK_CREATED');

      const task = await testPrisma.warehouseTask.findFirstOrThrow({
        where: { type: 'REPLENISHMENT' },
      });
      expect(task.productId).toBe(product.id);
      expect(task.fromPositionId).toBe(bulk.id);
      expect(task.toPositionId).toBe(picking.id);
      expect(task.referenceType).toBe('REPLENISHMENT');
      // A reposição é a única tarefa sem documento por trás: a `reference` é o
      // próprio endereço que disparou a regra.
      expect(task.reference).toBe(picking.id);
      // Sem `maxStock`, o alvo é o dobro do limiar (2 × 20 = 40); já há 5.
      expect(task.quantity?.toString()).toBe('35');

      // A DETECÇÃO não mexe em saldo — mesmo princípio de F4.8.
      expect(await testPrisma.stockMovement.count()).toBe(0);
    });

    it('usa max(minStock, safetyStock) como limiar', async () => {
      // minStock 5, safetyStock 50, saldo 30: acima do mínimo mas abaixo do
      // estoque de segurança — tem de disparar.
      await setupScenario(30, 500, { minStock: 5, safetyStock: 50 });

      const needs = await replenishmentJob.runManually();

      expect(needs).toHaveLength(1);
      expect(needs[0].threshold).toBe('50');
    });

    it('respeita maxStock como alvo quando ele existe', async () => {
      await setupScenario(5, 500, { minStock: 20, maxStock: 100 });

      await replenishmentJob.runManually();

      const task = await testPrisma.warehouseTask.findFirstOrThrow({
        where: { type: 'REPLENISHMENT' },
      });
      expect(task.quantity?.toString()).toBe('95');
    });

    it('nunca pede mais do que o pulmão tem, e prioriza o picking ZERADO', async () => {
      await setupScenario(0, 12, { minStock: 20 });

      await replenishmentJob.runManually();

      const task = await testPrisma.warehouseTask.findFirstOrThrow({
        where: { type: 'REPLENISHMENT' },
      });
      expect(task.quantity?.toString()).toBe('12');
      expect(task.priority).toBe(3);
    });

    it('não gera tarefa quando a posição de picking está acima do mínimo', async () => {
      await setupScenario(100, 500, { minStock: 20 });

      const needs = await replenishmentJob.runManually();

      expect(needs).toHaveLength(0);
      expect(await testPrisma.warehouseTask.count()).toBe(0);
    });

    it('não considera posição de PULMÃO como destino de reposição', async () => {
      // Nenhuma posição marcada como picking: mesmo com saldo abaixo do
      // mínimo, não há área de picking para repor.
      const product = await createTestProduct({ minStock: 50 });
      const { positions } = await createTestPositions(2);
      await seedStock(product.id, [{ positionId: positions[0].id, quantity: 5 }]);

      const needs = await replenishmentJob.runManually();

      expect(needs).toHaveLength(0);
    });

    it('não empilha tarefas: a segunda execução do job não cria outra', async () => {
      await setupScenario(5, 500);

      await replenishmentJob.runManually();
      const needs = await replenishmentJob.runManually();

      expect(needs[0].status).toBe('TASK_ALREADY_OPEN');
      expect(
        await testPrisma.warehouseTask.count({ where: { type: 'REPLENISHMENT' } })
      ).toBe(1);
    });

    it('sem pulmão com saldo: NÃO cria tarefa e reporta NO_SOURCE', async () => {
      await setupScenario(5, 0);

      const needs = await replenishmentJob.runManually();

      expect(needs).toHaveLength(1);
      expect(needs[0].status).toBe('NO_SOURCE');
      expect(await testPrisma.warehouseTask.count()).toBe(0);
    });

    it('notifica na categoria WAREHOUSE (não STOCK) — seção 3.4 do doc de licenciamento', async () => {
      const manager = await createManager();
      await setupScenario(5, 500);

      await replenishmentJob.runManually();

      const notifications = await testPrisma.notification.findMany({
        where: { userId: manager.id },
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].category).toBe('WAREHOUSE');
      expect(notifications[0].eventType).toBe('REPLENISHMENT_NEEDED');
      expect(notifications[0].resourceType).toBe('StoragePosition');
    });

    it('concluir a REPLENISHMENT transfere o saldo do pulmão para o picking', async () => {
      const { token } = await loginWarehouseUser();
      const { product, picking, bulk } = await setupScenario(5, 500);

      await replenishmentJob.runManually();
      const task = await testPrisma.warehouseTask.findFirstOrThrow({
        where: { type: 'REPLENISHMENT' },
      });

      const res = await executeTask(token, task.id);
      expect(res.status).toBe(200);

      const movement = await testPrisma.stockMovement.findFirstOrThrow();
      expect(movement.type).toBe('TRANSFER');
      expect(movement.fromPositionId).toBe(bulk.id);
      expect(movement.toPositionId).toBe(picking.id);
      expect(movement.quantity).toBe(35);

      const balances = await testPrisma.stockPositionBalance.findMany({
        where: { productId: product.id },
      });
      const byPosition = new Map(
        balances.map((b) => [b.storagePositionId, b.quantity.toString()])
      );
      expect(byPosition.get(picking.id)).toBe('40');
      expect(byPosition.get(bulk.id)).toBe('465');

      // TRANSFER não altera o saldo AGREGADO (F2.1): reposição não cria nem
      // consome estoque, só o muda de lugar.
      const aggregate = await testPrisma.stockBalance.findUnique({
        where: { productId: product.id },
      });
      expect(aggregate?.quantity).toBe(505);
    });

    it('sem WMS licenciado o detector nem roda', async () => {
      await setupScenario(5, 500);

      await testPrisma.licensedModule.update({
        where: { code: 'WMS' },
        data: { enabled: false },
      });
      clearLicensedModuleCache();

      const needs = await replenishmentJob.runManually();

      expect(needs).toHaveLength(0);
      expect(await testPrisma.warehouseTask.count()).toBe(0);
      expect(await testPrisma.notification.count()).toBe(0);
    });
  });
});
