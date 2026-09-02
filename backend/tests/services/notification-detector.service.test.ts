import notificationDetector from '../../src/services/notification-detector.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import {
  createTestManager,
  createTestOperation,
  createTestPointing,
  createTestProduct,
  createTestProductionOrder,
  createTestProductionOrderWithBom,
  createTestUser,
  createTestWorkCenter,
} from '../helpers/fixtures';

/**
 * Cobre as duas correções desta rodada em `notification-detector.service.ts`:
 *
 *   1. `checkMaterialAvailability()` passou a LER `stock_balances` em vez de
 *      ressomar `stock_movements` do zero;
 *   2. `detectLowCapacity()` / `CAPACITY_LOW`, que antes não existia (o cron de
 *      2h só logava "não implementado ainda").
 */

/** Escreve saldo direto na tabela — é a fonte que o detector deve consultar. */
const setBalance = (productId: string, quantity: number) =>
  testPrisma.stockBalance.create({ data: { productId, quantity } });

describe('notification-detector: disponibilidade de material via stock_balances', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('usa o saldo de stock_balances (e não a soma de stock_movements) para decidir', async () => {
    const manager = await createTestManager();
    const component = await createTestProduct();
    const { order } = await createTestProductionOrderWithBom(
      manager.id,
      [{ productId: component.id, quantity: 2 }],
      10 // precisa de 20
    );

    // Saldo persistido diz 5 — insuficiente para os 20 necessários.
    await setBalance(component.id, 5);

    // ...e NÃO existe nenhuma linha em stock_movements. Na implementação
    // anterior a soma daria 0 e a notificação sairia com "Disponível: 0";
    // lendo o saldo real, tem que sair com 5.
    await expect(testPrisma.stockMovement.count()).resolves.toBe(0);

    await notificationDetector.checkMaterialAvailability(order.id);

    const notification = await testPrisma.notification.findFirst({
      where: { eventType: 'MATERIAL_UNAVAILABLE', userId: manager.id },
    });

    expect(notification).not.toBeNull();
    const data = notification!.data as Record<string, unknown>;
    expect(data.available).toBe(5);
    expect(data.required).toBe(20);
    expect(data.shortage).toBe(15);
  });

  it('não notifica quando o saldo persistido cobre a necessidade', async () => {
    const manager = await createTestManager();
    const component = await createTestProduct();
    const { order } = await createTestProductionOrderWithBom(
      manager.id,
      [{ productId: component.id, quantity: 2 }],
      10 // precisa de 20
    );

    await setBalance(component.id, 50);

    await notificationDetector.checkMaterialAvailability(order.id);

    await expect(
      testPrisma.notification.count({ where: { eventType: 'MATERIAL_UNAVAILABLE' } })
    ).resolves.toBe(0);
  });

  it('trata componente sem linha de saldo como zero (e não cria a linha)', async () => {
    const manager = await createTestManager();
    const component = await createTestProduct();
    const { order } = await createTestProductionOrderWithBom(
      manager.id,
      [{ productId: component.id, quantity: 1 }],
      5
    );

    await notificationDetector.checkMaterialAvailability(order.id);

    const notification = await testPrisma.notification.findFirst({
      where: { eventType: 'MATERIAL_UNAVAILABLE' },
    });
    expect((notification!.data as Record<string, unknown>).available).toBe(0);

    // Caminho de leitura não deve escrever saldo (ver nota no detector).
    await expect(testPrisma.stockBalance.count()).resolves.toBe(0);
  });
});

describe('notification-detector: CAPACITY_LOW (detectLowCapacity)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  /**
   * Monta um centro COM demanda (uma operação PENDING) e com a produção
   * informada apontada dentro da janela de 8h.
   *
   * Capacidade 10/h × eficiência 1.0 × 8h = 80 esperado; o limiar de 50% fica
   * exatamente em 40 unidades.
   */
  const scenario = async (opts: {
    capacity: number | null;
    produced: number;
    efficiency?: number;
    withDemand?: boolean;
    producedHoursAgo?: number;
  }) => {
    const manager = await createTestManager();
    const operator = await createTestUser();
    const workCenter = await createTestWorkCenter({
      capacity: opts.capacity,
      efficiency: opts.efficiency ?? 1.0,
    });
    const order = await createTestProductionOrder(manager.id);

    const operation = await createTestOperation(
      order.id,
      workCenter.id,
      opts.withDemand === false ? 'COMPLETED' : 'PENDING'
    );

    if (opts.produced > 0) {
      await createTestPointing({
        productionOrderId: order.id,
        operationId: operation.id,
        workCenterId: workCenter.id,
        userId: operator.id,
        quantityGood: opts.produced,
        endTime: new Date(Date.now() - (opts.producedHoursAgo ?? 1) * 60 * 60 * 1000),
      });
    }

    return { manager, workCenter };
  };

  const capacityNotifications = () =>
    testPrisma.notification.findMany({ where: { eventType: 'CAPACITY_LOW' } });

  it('dispara quando a produção fica abaixo de 50% da capacidade esperada', async () => {
    // Esperado 80 na janela; produziu 10 (12,5%).
    const { manager, workCenter } = await scenario({ capacity: 10, produced: 10 });

    const detected = await notificationDetector.detectLowCapacity();

    expect(detected).toBe(1);

    const notifications = await capacityNotifications();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe(manager.id);
    expect(notifications[0].category).toBe('CAPACITY');
    expect(notifications[0].priority).toBe(2);
    expect(notifications[0].resourceId).toBe(workCenter.id);

    const data = notifications[0].data as Record<string, unknown>;
    expect(data.expected).toBe(80);
    expect(data.actual).toBe(10);
    expect(data.utilizationPercent).toBe(12.5);
  });

  it('NÃO dispara quando a produção fica acima do limiar de 50%', async () => {
    // Esperado 80; produziu 60 (75%).
    await scenario({ capacity: 10, produced: 60 });

    const detected = await notificationDetector.detectLowCapacity();

    expect(detected).toBe(0);
    await expect(capacityNotifications()).resolves.toHaveLength(0);
  });

  it('NÃO dispara exatamente no limiar (produção == 50% do esperado)', async () => {
    // Esperado 80; produziu 40 — o corte é `actual < 50%`, então 40 não alarma.
    await scenario({ capacity: 10, produced: 40 });

    expect(await notificationDetector.detectLowCapacity()).toBe(0);
    await expect(capacityNotifications()).resolves.toHaveLength(0);
  });

  it('dispara logo abaixo do limiar (produção == 49% do esperado)', async () => {
    // Esperado 80; produziu 39.
    await scenario({ capacity: 10, produced: 39 });

    expect(await notificationDetector.detectLowCapacity()).toBe(1);
    await expect(capacityNotifications()).resolves.toHaveLength(1);
  });

  it('ignora centro sem capacidade cadastrada', async () => {
    await scenario({ capacity: null, produced: 0 });

    expect(await notificationDetector.detectLowCapacity()).toBe(0);
    await expect(capacityNotifications()).resolves.toHaveLength(0);
  });

  it('ignora centro ocioso (sem operação na fila), mesmo produzindo nada', async () => {
    await scenario({ capacity: 10, produced: 0, withDemand: false });

    expect(await notificationDetector.detectLowCapacity()).toBe(0);
    await expect(capacityNotifications()).resolves.toHaveLength(0);
  });

  it('considera a eficiência do centro ao calcular o esperado', async () => {
    // Capacidade 10/h, eficiência 0.25 -> esperado 20 na janela de 8h.
    // Produziu 15 (75% do esperado) — não deve alarmar, embora 15 fosse
    // apenas 18,75% da capacidade nominal sem eficiência.
    await scenario({ capacity: 10, produced: 15, efficiency: 0.25 });

    expect(await notificationDetector.detectLowCapacity()).toBe(0);
    await expect(capacityNotifications()).resolves.toHaveLength(0);
  });

  it('ignora produção fora da janela de 8 horas', async () => {
    // Produziu 80 (o esperado inteiro), mas 20 horas atrás: dentro da janela a
    // produção é zero, então o alarme deve disparar.
    await scenario({ capacity: 10, produced: 80, producedHoursAgo: 20 });

    expect(await notificationDetector.detectLowCapacity()).toBe(1);
    await expect(capacityNotifications()).resolves.toHaveLength(1);
  });

  it('não duplica a notificação dentro da janela de dedupe de 6h', async () => {
    await scenario({ capacity: 10, produced: 0 });

    await notificationDetector.detectLowCapacity();
    await notificationDetector.detectLowCapacity();

    await expect(capacityNotifications()).resolves.toHaveLength(1);
  });
});

describe('notification-detector: resumo diário (sendDailySummary)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  /** Notificação criada no dia civil anterior, que é o recorte do resumo. */
  const yesterdayAt = (hour: number) => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  const seedNotification = (userId: string, priority: number, createdAt: Date, read = false) =>
    testPrisma.notification.create({
      data: {
        userId,
        type: 'WARNING',
        category: 'PRODUCTION',
        eventType: 'PRODUCTION_DELAYED',
        title: 'Teste',
        message: 'Teste',
        priority,
        read,
        createdAt,
      },
    });

  it('resume as não lidas de prioridade alta e crítica do dia anterior', async () => {
    const manager = await createTestManager();

    await seedNotification(manager.id, 4, yesterdayAt(9));
    await seedNotification(manager.id, 4, yesterdayAt(14));
    await seedNotification(manager.id, 3, yesterdayAt(16));
    // Ruído que NÃO deve entrar na contagem:
    await seedNotification(manager.id, 2, yesterdayAt(10)); // prioridade baixa
    await seedNotification(manager.id, 4, yesterdayAt(11), true); // já lida
    await seedNotification(manager.id, 4, new Date()); // de hoje

    const sent = await notificationDetector.sendDailySummary();

    expect(sent).toBe(1);

    const summary = await testPrisma.notification.findFirst({
      where: { eventType: 'DAILY_SUMMARY', userId: manager.id },
    });

    expect(summary).not.toBeNull();
    expect(summary!.type).toBe('INFO');
    expect(summary!.priority).toBe(1);

    const data = summary!.data as Record<string, unknown>;
    expect(data.criticalUnread).toBe(2);
    expect(data.highUnread).toBe(1);
    expect(data.totalUnread).toBe(3);
  });

  it('não gera resumo quando não há pendência do dia anterior', async () => {
    const manager = await createTestManager();
    await seedNotification(manager.id, 2, yesterdayAt(9)); // prioridade baixa
    await seedNotification(manager.id, 4, yesterdayAt(9), true); // lida

    expect(await notificationDetector.sendDailySummary()).toBe(0);
    await expect(
      testPrisma.notification.count({ where: { eventType: 'DAILY_SUMMARY' } })
    ).resolves.toBe(0);
  });

  it('não envia um segundo resumo no mesmo dia', async () => {
    const manager = await createTestManager();
    await seedNotification(manager.id, 4, yesterdayAt(9));

    await notificationDetector.sendDailySummary();
    const second = await notificationDetector.sendDailySummary();

    expect(second).toBe(0);
    await expect(
      testPrisma.notification.count({ where: { eventType: 'DAILY_SUMMARY' } })
    ).resolves.toBe(1);
  });
});
