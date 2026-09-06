import request from 'supertest';
import { app } from '../../src/app';
import { getTaskKpis } from '../../src/services/wms-kpi.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestProduct, createTestPurchaseOrder, createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import { clearSettingCache } from '../../src/services/system-setting.service';

/**
 * wms-kpi.service.ts::getTaskKpis — as 4 abas de Recebimento do Dashboard de
 * KPIs do WMS. Mesmo padrão de setup de `wms-operations-panel.test.ts`
 * (criar a cadeia via API real, não fixture direta, para não esconder um bug
 * de agregação atrás de um fixture já "arrumado") — depois ajustar
 * createdAt/startedAt/completedAt via `testPrisma.warehouseTask.update` para
 * simular tarefas antigas/concluídas, o que a API não permite fazer
 * diretamente (não dá para "voltar no tempo" via HTTP).
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

const HOUR = 60 * 60 * 1000;

describe('wms-kpi.service — getTaskKpis', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
    await setModule('COMPRAS', true);
    await setModule('WMS', true);
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
    clearSettingCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('volumeStatus', () => {
    it('agrupa por type e status dentro do período, e conta recebimentos ativos vs finalizados', async () => {
      const { user, token } = await loginReceiptUser();
      await createReceipt(token, user.id, 100);

      const kpis = await getTaskKpis(30);

      const descarga = kpis.volumeStatus.byTypeAndStatus.find(
        (e) => e.type === 'DESCARGA' && e.status === 'PENDING'
      );
      expect(descarga?.count).toBe(1);
      expect(kpis.volumeStatus.receiptsActive).toBe(1);
      expect(kpis.volumeStatus.receiptsFinished).toBe(0);
    });

    it('conta como finalizado um recebimento cuja cadeia inteira já fechou', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      await testPrisma.warehouseTask.updateMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const kpis = await getTaskKpis(30);
      expect(kpis.volumeStatus.receiptsActive).toBe(0);
      expect(kpis.volumeStatus.receiptsFinished).toBe(1);
    });

    it('não conta uma tarefa criada fora do período', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      await testPrisma.warehouseTask.updateMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        data: { createdAt: new Date(Date.now() - 40 * 24 * HOUR) },
      });

      const kpis = await getTaskKpis(30);
      expect(kpis.volumeStatus.receiptsActive).toBe(0);
      expect(kpis.volumeStatus.receiptsFinished).toBe(0);
    });
  });

  describe('cycleTime', () => {
    it('calcula a média de completedAt-createdAt por tipo, só tarefas COMPLETED concluídas no período', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      const descarga = tasks[0];
      const createdAt = new Date(Date.now() - 10 * HOUR);
      const completedAt = new Date(Date.now() - 4 * HOUR); // 6h de ciclo
      await testPrisma.warehouseTask.update({
        where: { id: descarga.id },
        data: { status: 'COMPLETED', createdAt, completedAt },
      });

      const kpis = await getTaskKpis(30);
      const entry = kpis.cycleTime.byType.find((e) => e.type === 'DESCARGA');
      expect(entry?.avgHours).toBe(6);
    });

    it('fullReceiptAvgHours só considera recebimento com a cadeia inteira fechada', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      const firstCreatedAt = new Date(Date.now() - 20 * HOUR);
      const lastCompletedAt = new Date(Date.now() - 2 * HOUR); // 18h de recebimento completo

      // Todas as tarefas nascem em firstCreatedAt; todas concluídas, a última em lastCompletedAt.
      for (const [index, task] of tasks.entries()) {
        await testPrisma.warehouseTask.update({
          where: { id: task.id },
          data: {
            createdAt: firstCreatedAt,
            status: 'COMPLETED',
            completedAt: index === tasks.length - 1 ? lastCompletedAt : new Date(Date.now() - 15 * HOUR),
          },
        });
      }

      const kpis = await getTaskKpis(30);
      expect(kpis.cycleTime.fullReceiptAvgHours).toBe(18);
    });

    it('não inclui no fullReceiptAvgHours um recebimento com etapa ainda aberta', async () => {
      const { user, token } = await loginReceiptUser();
      await createReceipt(token, user.id, 100);
      // Cadeia recém-criada: todas PENDING, nenhuma COMPLETED.

      const kpis = await getTaskKpis(30);
      expect(kpis.cycleTime.fullReceiptAvgHours).toBe(0);
    });

    it('fullReceiptAvgHours alcança o início real da cadeia mesmo quando ele fica fora da janela do período (query em duas etapas de getCycleTime)', async () => {
      // getCycleTime busca em 2 passos: (1) referências com tarefa COMPLETED
      // dentro do período, leve; (2) a cadeia INTEIRA (sem filtro de data)
      // dessas referências. Este teste prova que o passo 2 ainda alcança uma
      // tarefa criada 45 dias atrás — bem antes da janela de days=30 — desde
      // que a ÚLTIMA conclusão da cadeia caia dentro do período.
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      expect(tasks.length).toBeGreaterThan(1);

      const chainStart = new Date(Date.now() - 45 * 24 * HOUR); // 45 dias atrás: fora da janela de 30 dias
      const earlyCompletedAt = new Date(Date.now() - 40 * 24 * HOUR); // 40 dias atrás: também fora da janela
      const lastCompletedAt = new Date(Date.now() - 5 * 24 * HOUR); // 5 dias atrás: dentro da janela de 30 dias

      for (const [index, task] of tasks.entries()) {
        const isLast = index === tasks.length - 1;
        await testPrisma.warehouseTask.update({
          where: { id: task.id },
          data: {
            createdAt: chainStart,
            status: 'COMPLETED',
            completedAt: isLast ? lastCompletedAt : earlyCompletedAt,
          },
        });
      }

      const kpis = await getTaskKpis(30);
      // (lastCompletedAt - chainStart) = 40 dias = 960h. Se o passo 1 tivesse
      // restringido por data a cadeia inteira (em vez de só decidir QUAIS
      // referências entram), o createdAt de 45 dias atrás seria perdido e o
      // resultado ficaria errado.
      expect(kpis.cycleTime.fullReceiptAvgHours).toBe(40 * 24);
    });
  });

  describe('productivity', () => {
    it('agrupa tarefas concluídas por operador, com tempo médio de execução (startedAt→completedAt)', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      const startedAt = new Date(Date.now() - 5 * HOUR);
      const completedAt = new Date(Date.now() - 3 * HOUR); // 2h de execução
      await testPrisma.warehouseTask.update({
        where: { id: tasks[0].id },
        data: { assignedTo: user.id, status: 'COMPLETED', startedAt, completedAt },
      });

      const kpis = await getTaskKpis(30);
      const entry = kpis.productivity.find((p) => p.userId === user.id);
      expect(entry?.tasksCompleted).toBe(1);
      expect(entry?.avgExecutionHours).toBe(2);
      expect(entry?.userName).toBe(user.name);
    });

    it('ignora tarefa concluída sem assignedTo/startedAt', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
      });
      await testPrisma.warehouseTask.update({
        where: { id: tasks[0].id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const kpis = await getTaskKpis(30);
      expect(kpis.productivity).toHaveLength(0);
    });
  });

  describe('bottlenecks', () => {
    it('usa wms.task_delay_threshold_hours do banco, não o default de 24h, e ordena do mais parado', async () => {
      await testPrisma.systemSetting.create({
        data: {
          key: 'wms.task_delay_threshold_hours',
          value: '10',
          type: 'NUMBER',
          category: 'wms',
          label: 'Limiar de tarefa atrasada (horas)',
        },
      });
      clearSettingCache();

      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      // 15h parada: com o default (24h) NÃO apareceria; com 10h (do banco) aparece.
      await testPrisma.warehouseTask.update({
        where: { id: tasks[0].id },
        data: { createdAt: new Date(Date.now() - 15 * HOUR) },
      });

      const kpis = await getTaskKpis(30);
      expect(kpis.bottlenecks.byType.find((b) => b.type === 'DESCARGA')?.count).toBe(1);
      expect(kpis.bottlenecks.affected).toHaveLength(1);
      expect(kpis.bottlenecks.affected[0].receiptNumber).toBe(res.body.data.receiptNumber);
      expect(kpis.bottlenecks.affected[0].hoursStuck).toBeGreaterThanOrEqual(15);
    });

    it('não lista tarefa PENDING dentro do limiar', async () => {
      const { user, token } = await loginReceiptUser();
      await createReceipt(token, user.id, 100);
      // Tarefas recém-criadas: bem dentro do limiar default de 24h.

      const kpis = await getTaskKpis(30);
      expect(kpis.bottlenecks.affected).toHaveLength(0);
    });
  });
});
