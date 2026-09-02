import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import {
  createTestPositions,
  createTestProduct,
  createTestProductionOrderWithBom,
} from '../helpers/fixtures';
import {
  executeTask,
  loginWarehouseUser,
  reserveForOrder,
  seedStock,
  setModule,
} from '../helpers/wms-fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

/**
 * Fase 4b do plano do WMS (WMS_IMPLEMENTATION_ANALYSIS.md, seção 5, item F4.8)
 * — SEPARAÇÃO ORIENTADA A TAREFA.
 *
 * O RISCO que estes testes existem para cobrir é o mesmo já registrado na
 * tabela de riscos do plano e coberto para o recebimento na Fase 4a: "dois
 * caminhos (com/sem WMS) que divergem com o tempo, um deles sub-testado". Por
 * isso o PRIMEIRO bloco é o caminho SEM WMS — verificando que ele continua
 * exatamente o de sempre.
 *
 * `clearLicensedModuleCache()` no beforeEach/afterEach é obrigatório: o cache de
 * licença vive no módulo e sobrevive ao `cleanDatabase()`.
 */

describe('Integração: separação orientada a tarefa (Fase 4b, F4.8)', () => {
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
  // Caminho SEM WMS: nada pode ter mudado.
  // ==========================================================================
  describe('sem WMS licenciado (comportamento legado, inalterado)', () => {
    beforeEach(async () => {
      await setModule('WMS', false);
      clearLicensedModuleCache();
    });

    it('debita o saldo na reserva, sem posição e sem gerar tarefa nenhuma', async () => {
      const { user, token } = await loginWarehouseUser();
      const component = await createTestProduct();
      const { positions } = await createTestPositions(1);
      await seedStock(component.id, [{ positionId: positions[0].id, quantity: 100 }]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 10 }],
        3
      );

      const res = await reserveForOrder(token, order.id);

      expect(res.status).toBe(200);
      expect(res.body.data.mode).toBe('DIRECT');
      expect(res.body.data.totalItems).toBe(1);

      // Saída IMEDIATA e SEM posição — o fluxo não endereçado de sempre.
      const movements = await testPrisma.stockMovement.findMany({
        where: { productId: component.id },
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('OUT');
      expect(movements[0].quantity).toBe(30);
      expect(movements[0].fromPositionId).toBeNull();
      expect(movements[0].toPositionId).toBeNull();
      expect(movements[0].reference).toBe(order.orderNumber);

      const balance = await testPrisma.stockBalance.findUnique({
        where: { productId: component.id },
      });
      expect(balance?.quantity).toBe(70);

      expect(await testPrisma.warehouseTask.count()).toBe(0);
    });

    it('as rotas de tarefa não existem (404) sem WMS licenciado', async () => {
      const { token } = await loginWarehouseUser();

      const res = await request(app)
        .get('/api/v1/warehouse-tasks/my')
        .set('Authorization', `Bearer ${token}`);

      // 404 do requireModule: o módulo deve PARECER não existir.
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // Caminho COM WMS.
  // ==========================================================================
  describe('com WMS licenciado', () => {
    beforeEach(async () => {
      await setModule('WMS', true);
      clearLicensedModuleCache();
    });

    it('gera tarefa de PICKING e NÃO mexe em saldo nenhum', async () => {
      const { user, token } = await loginWarehouseUser();
      const component = await createTestProduct();
      const { positions } = await createTestPositions(1);
      await seedStock(component.id, [{ positionId: positions[0].id, quantity: 100 }]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 10 }],
        3
      );

      const res = await reserveForOrder(token, order.id);

      expect(res.status).toBe(200);
      expect(res.body.data.mode).toBe('WMS_PICKING');
      expect(res.body.data.pickingTasks).toEqual([
        { productId: component.id, storagePositionId: positions[0].id, quantity: '30' },
      ]);

      // O NÚCLEO DE F4.8: criar a tarefa não move estoque.
      expect(await testPrisma.stockMovement.count()).toBe(0);

      const balance = await testPrisma.stockBalance.findUnique({
        where: { productId: component.id },
      });
      expect(balance?.quantity).toBe(100);

      const positionBalance = await testPrisma.stockPositionBalance.findFirstOrThrow({
        where: { productId: component.id },
      });
      expect(positionBalance.quantity.toString()).toBe('100');

      // A tarefa nasce com ORIGEM definida — o oposto da ALOCACAO da Fase 4a,
      // que nasce sem destino.
      const tasks = await testPrisma.warehouseTask.findMany();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].type).toBe('PICKING');
      expect(tasks[0].status).toBe('PENDING');
      expect(tasks[0].referenceType).toBe('PRODUCTION_ORDER');
      expect(tasks[0].reference).toBe(order.id);
      expect(tasks[0].fromPositionId).toBe(positions[0].id);
      expect(tasks[0].toPositionId).toBeNull();
      expect(tasks[0].quantity?.toString()).toBe('30');
      // Sem `sequence`: as tarefas de picking de uma ordem são paralelas, não
      // uma cadeia — nada bloqueia nada.
      expect(tasks[0].sequence).toBeNull();
    });

    it('escolhe a posição por FIFO (a de saldo mais antigo primeiro)', async () => {
      const { user, token } = await loginWarehouseUser();
      const component = await createTestProduct();
      const { positions } = await createTestPositions(2);

      // positions[0] tem o código MENOR mas foi movimentada há pouco;
      // positions[1] tem o código maior e é a mais ANTIGA. O FIFO tem de
      // escolher a antiga — se a ordenação caísse para o código (ou para a
      // ordem de inserção), escolheria a errada e este teste falharia.
      await seedStock(component.id, [
        { positionId: positions[0].id, quantity: 100, updatedAt: new Date('2026-09-01') },
        { positionId: positions[1].id, quantity: 100, updatedAt: new Date('2026-01-01') },
      ]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 40 }],
        1
      );

      await reserveForOrder(token, order.id).expect(200);

      const tasks = await testPrisma.warehouseTask.findMany();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].fromPositionId).toBe(positions[1].id);
    });

    it('divide em VÁRIAS tarefas quando uma posição não cobre a necessidade', async () => {
      const { user, token } = await loginWarehouseUser();
      const component = await createTestProduct();
      const { positions } = await createTestPositions(2);

      await seedStock(component.id, [
        { positionId: positions[0].id, quantity: 30, updatedAt: new Date('2026-01-01') },
        { positionId: positions[1].id, quantity: 100, updatedAt: new Date('2026-06-01') },
      ]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 50 }],
        1
      );

      await reserveForOrder(token, order.id).expect(200);

      const tasks = await testPrisma.warehouseTask.findMany({
        orderBy: { quantity: 'desc' },
      });

      // Esvazia a posição mais antiga (30) e completa na seguinte (20) — uma
      // parada física por endereço, não uma tarefa "pegue 50 espalhados".
      expect(tasks).toHaveLength(2);
      expect(tasks.map((t) => [t.fromPositionId, t.quantity?.toString()])).toEqual([
        [positions[0].id, '30'],
        [positions[1].id, '20'],
      ]);
    });

    it('recusa a reserva quando o saldo existe mas NÃO está endereçado', async () => {
      const { user, token } = await loginWarehouseUser();
      const component = await createTestProduct();

      // Saldo agregado sem nenhuma posição — o estado de quem acabou de
      // licenciar o WMS e ainda não endereçou o estoque legado.
      await testPrisma.stockBalance.create({
        data: { productId: component.id, quantity: 100 },
      });

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 10 }],
        1
      );

      const res = await reserveForOrder(token, order.id);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Saldo endereçado insuficiente/);
      expect(await testPrisma.warehouseTask.count()).toBe(0);
    });

    it('não separa de posição BLOQUEADA', async () => {
      const { user, token } = await loginWarehouseUser();
      const component = await createTestProduct();
      const { positions } = await createTestPositions(1);
      await seedStock(component.id, [{ positionId: positions[0].id, quantity: 100 }]);

      await testPrisma.storagePosition.update({
        where: { id: positions[0].id },
        data: { blocked: true },
      });

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 10 }],
        1
      );

      const res = await reserveForOrder(token, order.id);

      expect(res.status).toBe(400);
      expect(await testPrisma.warehouseTask.count()).toBe(0);
    });

    // ========================================================================
    // CONCLUSÃO da tarefa: é aqui que o estoque se move.
    // ========================================================================
    it('concluir o PICKING gera OUT com fromPositionId e debita os dois saldos', async () => {
      const { user, token } = await loginWarehouseUser();
      const component = await createTestProduct();
      const { positions } = await createTestPositions(1);
      await seedStock(component.id, [{ positionId: positions[0].id, quantity: 100 }]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 30 }],
        1
      );

      await reserveForOrder(token, order.id).expect(200);
      const task = await testPrisma.warehouseTask.findFirstOrThrow();

      const res = await executeTask(token, task.id);

      expect(res.status).toBe(200);
      expect(res.body.data.task.status).toBe('COMPLETED');

      const movements = await testPrisma.stockMovement.findMany({
        where: { productId: component.id },
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('OUT');
      expect(movements[0].quantity).toBe(30);
      expect(movements[0].fromPositionId).toBe(positions[0].id);
      expect(movements[0].toPositionId).toBeNull();
      // Mesma `reference` do caminho sem WMS: o histórico de consumo fica
      // idêntico nos dois modos.
      expect(movements[0].reference).toBe(order.orderNumber);

      const balance = await testPrisma.stockBalance.findUnique({
        where: { productId: component.id },
      });
      expect(balance?.quantity).toBe(70);

      const positionBalance = await testPrisma.stockPositionBalance.findFirstOrThrow({
        where: { productId: component.id },
      });
      expect(positionBalance.quantity.toString()).toBe('70');
    });

    it('não conclui duas vezes a mesma tarefa', async () => {
      const { user, token } = await loginWarehouseUser();
      const component = await createTestProduct();
      const { positions } = await createTestPositions(1);
      await seedStock(component.id, [{ positionId: positions[0].id, quantity: 100 }]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 30 }],
        1
      );
      await reserveForOrder(token, order.id).expect(200);
      const task = await testPrisma.warehouseTask.findFirstOrThrow();

      await executeTask(token, task.id).expect(200);
      const second = await executeTask(token, task.id);

      expect(second.status).toBe(409);

      // O saldo foi debitado UMA vez.
      const balance = await testPrisma.stockBalance.findUnique({
        where: { productId: component.id },
      });
      expect(balance?.quantity).toBe(70);
    });

    // ========================================================================
    // CONCORRÊNCIA — duas tarefas de picking disputando a MESMA posição.
    //
    // Este é o ponto de escrita compartilhada que a Fase 4b introduziu, e o
    // cenário é possível de propósito: a criação de tarefa não trava saldo de
    // posição (não o altera), então duas ordens podem planejar picking do mesmo
    // endereço. É a CONCLUSÃO que precisa serializar, sob o lock de
    // `applyMovement`. Ver a nota de sobre-alocação em `reserveForOrder`.
    // ========================================================================
    it('duas conclusões de PICKING concorrentes na mesma posição nunca deixam o saldo negativo', async () => {
      const { user, token } = await loginWarehouseUser();
      const component = await createTestProduct();
      const { positions } = await createTestPositions(1);
      await seedStock(component.id, [{ positionId: positions[0].id, quantity: 100 }]);

      const first = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 60 }],
        1
      );
      const second = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 60 }],
        1
      );

      await reserveForOrder(token, first.order.id).expect(200);
      await reserveForOrder(token, second.order.id).expect(200);

      const tasks = await testPrisma.warehouseTask.findMany({
        orderBy: { createdAt: 'asc' },
      });
      expect(tasks).toHaveLength(2);

      const responses = await Promise.all(
        tasks.map((task) => executeTask(token, task.id))
      );

      const succeeded = responses.filter((r) => r.status === 200);
      const failed = responses.filter((r) => r.status !== 200);

      // 60 + 60 > 100: exatamente uma passa.
      expect(succeeded).toHaveLength(1);
      expect(failed).toHaveLength(1);
      expect(failed[0].status).toBe(400);
      expect(failed[0].body.message).toMatch(/insuficiente/i);

      const positionBalance = await testPrisma.stockPositionBalance.findFirstOrThrow({
        where: { productId: component.id },
      });
      expect(positionBalance.quantity.toString()).toBe('40');

      const balance = await testPrisma.stockBalance.findUnique({
        where: { productId: component.id },
      });
      expect(balance?.quantity).toBe(40);

      // A tarefa que falhou continua ABERTA, para replanejamento — o material
      // não foi separado, então o trabalho não foi feito.
      const open = await testPrisma.warehouseTask.count({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      });
      expect(open).toBe(1);
    }, 20000);
  });
});
