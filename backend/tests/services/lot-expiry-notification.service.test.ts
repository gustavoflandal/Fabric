import notificationDetector from '../../src/services/notification-detector.service';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import { config } from '../../src/config/env';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import {
  createTestLot,
  createTestManager,
  createTestPositionBalance,
  createTestPositions,
  createTestProduct,
  setTestLicensedModule,
} from '../helpers/fixtures';

/**
 * FASE 5 (complemento) — alerta de VALIDADE DE LOTE
 * (`notification-detector.service.ts::checkExpiringLots()`).
 *
 * Os dois eventos e o que os separa:
 *   * `LOT_EXPIRING_SOON` — vence dentro de `config.wms.lotExpiryAlertDays`
 *     (default 7) e ainda tem saldo. WARNING, prioridade 3.
 *   * `LOT_EXPIRED` — já venceu e AINDA tem saldo. ERROR, prioridade 4.
 *
 * As datas são montadas em OFFSET a partir de agora (e não em datas literais
 * como em `lot-fefo-expiry.service.test.ts`) porque aqui o que está sob teste é
 * exatamente a BORDA da janela — "6 dias e meio" e "7 dias e meio" precisam ser
 * relativos ao instante da execução para significar alguma coisa.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const inDays = (days: number) => new Date(Date.now() + days * DAY);

/** Lote + saldo em N posições, montado num produto `lotTracked`. */
const seedLot = async (opts: {
  expiresAt: Date | null;
  quantities?: number[];
  lotNumber?: string;
}) => {
  const product = await createTestProduct({ lotTracked: true });
  const lot = await createTestLot(product.id, {
    expiresAt: opts.expiresAt,
    lotNumber: opts.lotNumber,
  });

  const quantities = opts.quantities ?? [10];
  const { positions } = await createTestPositions(quantities.length);

  for (let i = 0; i < quantities.length; i += 1) {
    await createTestPositionBalance(product.id, positions[i].id, quantities[i], lot.id);
  }

  return { product, lot, positions };
};

const notificationsOf = (eventType: string) =>
  testPrisma.notification.findMany({ where: { eventType } });

describe('checkExpiringLots: WMS licenciado', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
    await setTestLicensedModule('WMS', true);
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('LOT_EXPIRING_SOON (a vencer, com saldo)', () => {
    it('dispara WARNING prioridade 3 para lote dentro da janela de alerta', async () => {
      const manager = await createTestManager();
      const { product, lot, positions } = await seedLot({ expiresAt: inDays(3) });

      const findings = await notificationDetector.checkExpiringLots();

      expect(findings).toHaveLength(1);
      expect(findings[0].status).toBe('EXPIRING_SOON');
      expect(findings[0].notified).toBe(true);
      expect(findings[0].days).toBe(3);

      const notifications = await notificationsOf('LOT_EXPIRING_SOON');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].userId).toBe(manager.id);
      expect(notifications[0].type).toBe('WARNING');
      expect(notifications[0].category).toBe('WAREHOUSE');
      expect(notifications[0].priority).toBe(3);
      expect(notifications[0].resourceType).toBe('Lot');
      expect(notifications[0].resourceId).toBe(lot.id);

      const data = notifications[0].data as Record<string, any>;
      expect(data.lotNumber).toBe(lot.lotNumber);
      expect(data.productId).toBe(product.id);
      expect(data.expiresAt).toBeDefined();
      expect(data.totalQuantity).toBe('10');
      expect(data.positions).toHaveLength(1);
      expect(data.positions[0].positionId).toBe(positions[0].id);
      expect(data.positions[0].positionCode).toBe(positions[0].code);
      expect(data.positions[0].quantity).toBe('10');
    });

    it('NÃO dispara para lote com validade além da janela', async () => {
      await createTestManager();
      // Janela default de 7 dias; 8 dias está fora.
      await seedLot({ expiresAt: inDays(8) });

      await expect(notificationDetector.checkExpiringLots()).resolves.toHaveLength(0);
      await expect(notificationsOf('LOT_EXPIRING_SOON')).resolves.toHaveLength(0);
    });

    it('respeita a borda exata da janela configurada', async () => {
      await createTestManager();
      const windowDays = config.wms.lotExpiryAlertDays;

      // Meio dia ANTES do horizonte: dentro. Meio dia DEPOIS: fora.
      await seedLot({ expiresAt: inDays(windowDays - 0.5), lotNumber: 'DENTRO' });
      await seedLot({ expiresAt: inDays(windowDays + 0.5), lotNumber: 'FORA' });

      const findings = await notificationDetector.checkExpiringLots();

      expect(findings).toHaveLength(1);
      expect(findings[0].lotNumber).toBe('DENTRO');
    });

    it('soma o saldo de todas as posições e lista cada uma no payload', async () => {
      await createTestManager();
      await seedLot({ expiresAt: inDays(2), quantities: [4, 6, 5] });

      const findings = await notificationDetector.checkExpiringLots();

      expect(findings[0].totalQuantity).toBe('15');
      expect(findings[0].positions).toHaveLength(3);

      const data = (await notificationsOf('LOT_EXPIRING_SOON'))[0].data as Record<string, any>;
      expect(data.positions).toHaveLength(3);
      expect(data.totalQuantity).toBe('15');
    });
  });

  describe('LOT_EXPIRED (já vencido, com saldo parado)', () => {
    it('dispara ERROR prioridade 4 para lote vencido que ainda tem saldo', async () => {
      const manager = await createTestManager();
      const { lot } = await seedLot({ expiresAt: inDays(-5) });

      const findings = await notificationDetector.checkExpiringLots();

      expect(findings).toHaveLength(1);
      expect(findings[0].status).toBe('EXPIRED');
      expect(findings[0].days).toBe(5);

      const notifications = await notificationsOf('LOT_EXPIRED');
      expect(notifications).toHaveLength(1);
      expect(notifications[0].userId).toBe(manager.id);
      expect(notifications[0].type).toBe('ERROR');
      expect(notifications[0].category).toBe('WAREHOUSE');
      expect(notifications[0].priority).toBe(4);
      expect(notifications[0].resourceId).toBe(lot.id);

      // E NÃO sai também como "a vencer" — os dois eventos são exclusivos.
      await expect(notificationsOf('LOT_EXPIRING_SOON')).resolves.toHaveLength(0);
    });

    it('alerta lote vencido há muito tempo (não há limite inferior)', async () => {
      await createTestManager();
      await seedLot({ expiresAt: inDays(-400) });

      const findings = await notificationDetector.checkExpiringLots();

      expect(findings[0].status).toBe('EXPIRED');
      expect(findings[0].days).toBe(400);
      await expect(notificationsOf('LOT_EXPIRED')).resolves.toHaveLength(1);
    });

    it('diz "venceu hoje" para o lote que virou há poucas horas', async () => {
      await createTestManager();
      await seedLot({ expiresAt: new Date(Date.now() - 3 * HOUR) });

      const findings = await notificationDetector.checkExpiringLots();

      expect(findings[0].status).toBe('EXPIRED');
      expect(findings[0].days).toBe(0);
      expect((await notificationsOf('LOT_EXPIRED'))[0].message).toContain('venceu hoje');
    });
  });

  describe('o que NÃO deve gerar evento nenhum', () => {
    it('lote SEM saldo em posição alguma (já consumido/baixado)', async () => {
      await createTestManager();
      const product = await createTestProduct({ lotTracked: true });
      // Vencido há 30 dias, mas sem nenhuma linha de saldo.
      await createTestLot(product.id, { expiresAt: inDays(-30) });

      await expect(notificationDetector.checkExpiringLots()).resolves.toHaveLength(0);
      await expect(testPrisma.notification.count()).resolves.toBe(0);
    });

    it('lote com linha de saldo ZERADA (a linha sobrevive à baixa, o alerta não)', async () => {
      await createTestManager();
      await seedLot({ expiresAt: inDays(-30), quantities: [0] });

      await expect(notificationDetector.checkExpiringLots()).resolves.toHaveLength(0);
      await expect(testPrisma.notification.count()).resolves.toBe(0);
    });

    it('lote SEM `expiresAt` (nem todo lote tem validade), mesmo com saldo', async () => {
      await createTestManager();
      await seedLot({ expiresAt: null, quantities: [100] });

      await expect(notificationDetector.checkExpiringLots()).resolves.toHaveLength(0);
      await expect(testPrisma.notification.count()).resolves.toBe(0);
    });

    it('ignora as posições zeradas de um lote que tem saldo em outra', async () => {
      await createTestManager();
      const { positions } = await seedLot({ expiresAt: inDays(2), quantities: [0, 7] });

      const findings = await notificationDetector.checkExpiringLots();

      expect(findings).toHaveLength(1);
      expect(findings[0].totalQuantity).toBe('7');
      expect(findings[0].positions).toHaveLength(1);
      expect(findings[0].positions[0].positionCode).toBe(positions[1].code);
    });
  });

  describe('dedupe', () => {
    it('não renotifica o mesmo lote na execução seguinte (janela de 24h)', async () => {
      await createTestManager();
      await seedLot({ expiresAt: inDays(3) });

      await notificationDetector.checkExpiringLots();
      const second = await notificationDetector.checkExpiringLots();

      // O lote continua sendo um ACHADO (o job precisa saber que ele existe),
      // mas a notificação não é recriada.
      expect(second).toHaveLength(1);
      expect(second[0].notified).toBe(false);
      await expect(notificationsOf('LOT_EXPIRING_SOON')).resolves.toHaveLength(1);
    });

    it('dedupe também para o lote já vencido', async () => {
      await createTestManager();
      await seedLot({ expiresAt: inDays(-2) });

      await notificationDetector.checkExpiringLots();
      await notificationDetector.checkExpiringLots();

      await expect(notificationsOf('LOT_EXPIRED')).resolves.toHaveLength(1);
    });

    it('o dedupe é POR EVENTO: o aviso de véspera não suprime o alerta de vencido', async () => {
      await createTestManager();
      const { lot } = await seedLot({ expiresAt: inDays(1) });

      await notificationDetector.checkExpiringLots();
      await expect(notificationsOf('LOT_EXPIRING_SOON')).resolves.toHaveLength(1);

      // O dia vira: o mesmo lote passa a estar vencido. A notificação de ontem
      // (LOT_EXPIRING_SOON, dentro das 24h) não pode engolir a crítica de hoje.
      await testPrisma.lot.update({
        where: { id: lot.id },
        data: { expiresAt: new Date(Date.now() - 2 * HOUR) },
      });

      await notificationDetector.checkExpiringLots();

      await expect(notificationsOf('LOT_EXPIRED')).resolves.toHaveLength(1);
      await expect(notificationsOf('LOT_EXPIRING_SOON')).resolves.toHaveLength(1);
    });
  });

  it('notifica cada lote separadamente numa varredura com os dois casos', async () => {
    await createTestManager();
    await seedLot({ expiresAt: inDays(-1), lotNumber: 'VENCIDO' });
    await seedLot({ expiresAt: inDays(4), lotNumber: 'A-VENCER' });
    await seedLot({ expiresAt: inDays(60), lotNumber: 'LONGE' });

    const findings = await notificationDetector.checkExpiringLots();

    expect(findings).toHaveLength(2);
    // Ordem por `expiresAt` ascendente: o mais urgente primeiro.
    expect(findings.map((f) => f.lotNumber)).toEqual(['VENCIDO', 'A-VENCER']);

    await expect(notificationsOf('LOT_EXPIRED')).resolves.toHaveLength(1);
    await expect(notificationsOf('LOT_EXPIRING_SOON')).resolves.toHaveLength(1);
  });
});

describe('checkExpiringLots: sem WMS licenciado (fail-closed)', () => {
  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('não roda o detector quando o módulo está desabilitado', async () => {
    clearLicensedModuleCache();
    await setTestLicensedModule('WMS', false);
    clearLicensedModuleCache();

    await createTestManager();
    await seedLot({ expiresAt: inDays(-10) });
    await seedLot({ expiresAt: inDays(1) });

    await expect(notificationDetector.checkExpiringLots()).resolves.toEqual([]);
    await expect(testPrisma.notification.count()).resolves.toBe(0);
  });

  it('não roda quando o módulo sequer existe na tabela de licenças', async () => {
    clearLicensedModuleCache();

    await createTestManager();
    await seedLot({ expiresAt: inDays(-10) });

    await expect(notificationDetector.checkExpiringLots()).resolves.toEqual([]);
    await expect(testPrisma.notification.count()).resolves.toBe(0);
  });
});
