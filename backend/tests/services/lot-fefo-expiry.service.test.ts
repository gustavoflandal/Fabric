import stockService from '../../src/services/stock.service';
import { executeTask } from '../../src/services/warehouse-task-execution.service';
import { detectReplenishmentNeeds } from '../../src/services/replenishment.service';
import {
  clearLicensedModuleCache,
} from '../../src/services/licensed-module.service';
import { prisma } from '../../src/config/database';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import {
  createTestLot,
  createTestPositions,
  createTestProduct,
  createTestProductionOrderWithBom,
  createTestUser,
  setTestLicensedModule,
} from '../helpers/fixtures';
import { seedStock } from '../helpers/wms-fixtures';

/**
 * FASE 5 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5,
 * Fase 5) — LOTE, VALIDADE E RASTREABILIDADE, no nível de SERVICE.
 *
 * Por que service e não HTTP (o oposto da escolha de `wms-lot-receipt.test.ts`,
 * que é o par deste arquivo): o que está sob teste aqui é a regra dentro de
 * `applyMovement()` e do planejamento de picking — locks, ordenação FEFO,
 * bloqueio de vencido. Passar por HTTP acrescentaria autenticação, RBAC e o
 * `rate-limit` compartilhado por arquivo (ver a nota em
 * `tests/helpers/wms-fixtures.ts`) sem exercitar uma linha a mais da regra. É a
 * mesma decisão já registrada em `stock-position-balance.service.test.ts`.
 *
 * A DIVISÃO EM DOIS ARQUIVOS é deliberada: a captura de lote no recebimento é
 * um fluxo de ponta a ponta (conferência → alocação → saldo) que só é honesto
 * pela API; a mecânica de saldo e FEFO é regra pura.
 */

/** Datas nomeadas — o teste fica legível sem aritmética de dias no meio. */
const VENCIDO = new Date('2020-01-01');
const VENCE_CEDO = new Date('2030-03-01');
const VENCE_TARDE = new Date('2040-03-01');

const balanceOf = async (productId: string, storagePositionId: string, lotId: string | null) => {
  const row = await testPrisma.stockPositionBalance.findFirst({
    where: { productId, storagePositionId, lotId },
  });
  return row ? row.quantity.toString() : null;
};

describe('lote, FEFO e validade (Fase 5)', () => {
  beforeEach(() => {
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
    await prisma.$disconnect();
  });

  // ==========================================================================
  // A TERCEIRA DIMENSÃO DO SALDO
  // ==========================================================================
  describe('saldo por (produto, posição, lote)', () => {
    it('produto SEM lotTracked continua com UMA linha por posição (nada mudou)', async () => {
      const product = await createTestProduct();
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);

      await stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: 40,
        reason: 'entrada endereçada sem lote',
        userId: user.id,
        toPositionId: positions[0].id,
      });
      await stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: 10,
        reason: 'segunda entrada no mesmo endereço',
        userId: user.id,
        toPositionId: positions[0].id,
      });

      const rows = await testPrisma.stockPositionBalance.findMany({
        where: { productId: product.id },
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].lotId).toBeNull();
      expect(rows[0].quantity.toString()).toBe('50');
    });

    it('dois lotes na MESMA posição são duas linhas de saldo, e o agregado soma as duas', async () => {
      const product = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);
      const lotA = await createTestLot(product.id, { lotNumber: 'L-A' });
      const lotB = await createTestLot(product.id, { lotNumber: 'L-B' });

      await stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: 30,
        reason: 'entrada lote A',
        userId: user.id,
        toPositionId: positions[0].id,
        lotId: lotA.id,
      });
      await stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: 20,
        reason: 'entrada lote B',
        userId: user.id,
        toPositionId: positions[0].id,
        lotId: lotB.id,
      });

      expect(await balanceOf(product.id, positions[0].id, lotA.id)).toBe('30');
      expect(await balanceOf(product.id, positions[0].id, lotB.id)).toBe('20');
      // O agregado é do PRODUTO e não conhece lote — decisão D1 (contrato
      // estável) mantida: a dimensão nova é aditiva.
      expect((await stockService.getBalance(product.id)).quantity).toBe(50);
    });

    it('a saída debita SÓ a linha do lote informado', async () => {
      const product = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);
      const lotA = await createTestLot(product.id, { lotNumber: 'L-A' });
      const lotB = await createTestLot(product.id, { lotNumber: 'L-B' });

      await seedStock(product.id, [
        { positionId: positions[0].id, quantity: 30, lotId: lotA.id },
        { positionId: positions[0].id, quantity: 20, lotId: lotB.id },
      ]);

      await stockService.registerMovement({
        productId: product.id,
        type: 'OUT',
        quantity: 25,
        reason: 'saída do lote A',
        userId: user.id,
        fromPositionId: positions[0].id,
        lotId: lotA.id,
      });

      expect(await balanceOf(product.id, positions[0].id, lotA.id)).toBe('5');
      expect(await balanceOf(product.id, positions[0].id, lotB.id)).toBe('20');
    });

    it('saldo insuficiente é avaliado POR LOTE, e a mensagem diz qual', async () => {
      const product = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);
      const lotA = await createTestLot(product.id, { lotNumber: 'L-A' });
      const lotB = await createTestLot(product.id, { lotNumber: 'L-B' });

      // 50 no endereço, mas só 20 do lote B: pedir 30 do B tem de falhar
      // mesmo com a posição "tendo" material de sobra.
      await seedStock(product.id, [
        { positionId: positions[0].id, quantity: 30, lotId: lotA.id },
        { positionId: positions[0].id, quantity: 20, lotId: lotB.id },
      ]);

      await expect(
        stockService.registerMovement({
          productId: product.id,
          type: 'OUT',
          quantity: 30,
          reason: 'saída acima do saldo do lote',
          userId: user.id,
          fromPositionId: positions[0].id,
          lotId: lotB.id,
        })
      ).rejects.toThrow(/insuficiente na posição .*\(lote L-B\)/);

      expect(await balanceOf(product.id, positions[0].id, lotB.id)).toBe('20');
    });

    it('recusa lote de OUTRO produto e lote de produto sem controle de lote', async () => {
      const rastreado = await createTestProduct({ lotTracked: true });
      const outro = await createTestProduct({ lotTracked: true });
      const semLote = await createTestProduct();
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);

      const lotDoOutro = await createTestLot(outro.id, { lotNumber: 'L-OUTRO' });
      const lotSemControle = await createTestLot(semLote.id, { lotNumber: 'L-SEM' });

      await expect(
        stockService.registerMovement({
          productId: rastreado.id,
          type: 'IN',
          quantity: 10,
          reason: 'lote trocado',
          userId: user.id,
          toPositionId: positions[0].id,
          lotId: lotDoOutro.id,
        })
      ).rejects.toThrow(/não pertence ao produto/);

      await expect(
        stockService.registerMovement({
          productId: semLote.id,
          type: 'IN',
          quantity: 10,
          reason: 'lote em produto sem controle',
          userId: user.id,
          toPositionId: positions[0].id,
          lotId: lotSemControle.id,
        })
      ).rejects.toThrow(/não tem controle de lote habilitado/);

      expect(await testPrisma.stockPositionBalance.count()).toBe(0);
    });
  });

  // ==========================================================================
  // FEFO — O NÚCLEO DA FASE
  // ==========================================================================
  describe('FEFO no planejamento de picking', () => {
    /**
     * O CENÁRIO QUE SEPARA FEFO DE FIFO, e a razão de a fase existir.
     *
     * O lote que vence CEDO entra por ÚLTIMO (`updatedAt` mais recente), então o
     * FIFO de F4.8 escolheria o outro. Se este teste passar escolhendo o lote de
     * validade menor, o critério mudou de antiguidade para validade de verdade —
     * e não por coincidência de ordenação.
     */
    it('escolhe o lote que VENCE PRIMEIRO, mesmo tendo entrado por último', async () => {
      const component = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(2);

      await setTestLicensedModule('WMS', true);
      clearLicensedModuleCache();

      const lotTarde = await createTestLot(component.id, {
        lotNumber: 'L-TARDE',
        expiresAt: VENCE_TARDE,
      });
      const lotCedo = await createTestLot(component.id, {
        lotNumber: 'L-CEDO',
        expiresAt: VENCE_CEDO,
      });

      await seedStock(component.id, [
        {
          positionId: positions[0].id,
          quantity: 100,
          lotId: lotTarde.id,
          updatedAt: new Date('2026-01-01'), // o MAIS ANTIGO — o FIFO pegaria este
        },
        {
          positionId: positions[1].id,
          quantity: 100,
          lotId: lotCedo.id,
          updatedAt: new Date('2026-09-01'), // o mais recente, mas vence antes
        },
      ]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 40 }],
        1
      );

      const result = await stockService.reserveForOrder(order.id, user.id);

      expect(result.mode).toBe('WMS_PICKING');

      const tasks = await testPrisma.warehouseTask.findMany();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].lotId).toBe(lotCedo.id);
      expect(tasks[0].fromPositionId).toBe(positions[1].id);
      expect(tasks[0].quantity?.toString()).toBe('40');
    });

    it('varre os lotes na ordem de validade quando um não cobre a necessidade', async () => {
      const component = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(2);

      await setTestLicensedModule('WMS', true);
      clearLicensedModuleCache();

      const lotCedo = await createTestLot(component.id, {
        lotNumber: 'L-CEDO',
        expiresAt: VENCE_CEDO,
      });
      const lotTarde = await createTestLot(component.id, {
        lotNumber: 'L-TARDE',
        expiresAt: VENCE_TARDE,
      });

      await seedStock(component.id, [
        { positionId: positions[0].id, quantity: 30, lotId: lotCedo.id },
        { positionId: positions[1].id, quantity: 100, lotId: lotTarde.id },
      ]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 50 }],
        1
      );

      await stockService.reserveForOrder(order.id, user.id);

      const tasks = await testPrisma.warehouseTask.findMany({ orderBy: { quantity: 'desc' } });

      // Esvazia o que vence primeiro (30) e completa no seguinte (20).
      expect(
        tasks.map((task) => [task.lotId, task.quantity?.toString()])
      ).toEqual([
        [lotCedo.id, '30'],
        [lotTarde.id, '20'],
      ]);
    });

    it('lote SEM validade sai por ÚLTIMO (nunca vence = nunca urge)', async () => {
      const component = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(2);

      await setTestLicensedModule('WMS', true);
      clearLicensedModuleCache();

      // O lote SEM data entra primeiro e é o mais antigo: tanto o FIFO quanto
      // um `orderBy expiresAt asc` cru no MySQL (que ordena NULL primeiro) o
      // escolheriam. O FEFO correto escolhe o que TEM validade.
      const lotSemData = await createTestLot(component.id, { lotNumber: 'L-SEM-DATA' });
      const lotComData = await createTestLot(component.id, {
        lotNumber: 'L-COM-DATA',
        expiresAt: VENCE_TARDE,
      });

      await seedStock(component.id, [
        {
          positionId: positions[0].id,
          quantity: 100,
          lotId: lotSemData.id,
          updatedAt: new Date('2026-01-01'),
        },
        {
          positionId: positions[1].id,
          quantity: 100,
          lotId: lotComData.id,
          updatedAt: new Date('2026-09-01'),
        },
      ]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 10 }],
        1
      );

      await stockService.reserveForOrder(order.id, user.id);

      const tasks = await testPrisma.warehouseTask.findMany();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].lotId).toBe(lotComData.id);
    });

    it('lote VENCIDO não é candidato — a tarefa nasce executável ou não nasce', async () => {
      const component = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(2);

      await setTestLicensedModule('WMS', true);
      clearLicensedModuleCache();

      const lotVencido = await createTestLot(component.id, {
        lotNumber: 'L-VENCIDO',
        expiresAt: VENCIDO,
      });
      const lotBom = await createTestLot(component.id, {
        lotNumber: 'L-BOM',
        expiresAt: VENCE_TARDE,
      });

      await seedStock(component.id, [
        { positionId: positions[0].id, quantity: 100, lotId: lotVencido.id },
        { positionId: positions[1].id, quantity: 100, lotId: lotBom.id },
      ]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 40 }],
        1
      );

      await stockService.reserveForOrder(order.id, user.id);

      const tasks = await testPrisma.warehouseTask.findMany();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].lotId).toBe(lotBom.id);
    });

    it('produto SEM lotTracked mantém o FIFO por updatedAt, intocado', async () => {
      const component = await createTestProduct();
      const user = await createTestUser();
      const { positions } = await createTestPositions(2);

      await setTestLicensedModule('WMS', true);
      clearLicensedModuleCache();

      await seedStock(component.id, [
        { positionId: positions[0].id, quantity: 100, updatedAt: new Date('2026-09-01') },
        { positionId: positions[1].id, quantity: 100, updatedAt: new Date('2026-01-01') },
      ]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 40 }],
        1
      );

      await stockService.reserveForOrder(order.id, user.id);

      const tasks = await testPrisma.warehouseTask.findMany();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].lotId).toBeNull();
      // A posição mais ANTIGA — o FIFO de F4.8, sem uma linha de mudança.
      expect(tasks[0].fromPositionId).toBe(positions[1].id);
    });

    it('a conclusão do PICKING debita a linha do LOTE que o FEFO escolheu', async () => {
      const component = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);

      await setTestLicensedModule('WMS', true);
      clearLicensedModuleCache();

      const lotCedo = await createTestLot(component.id, {
        lotNumber: 'L-CEDO',
        expiresAt: VENCE_CEDO,
      });
      const lotTarde = await createTestLot(component.id, {
        lotNumber: 'L-TARDE',
        expiresAt: VENCE_TARDE,
      });

      await seedStock(component.id, [
        { positionId: positions[0].id, quantity: 100, lotId: lotCedo.id },
        { positionId: positions[0].id, quantity: 100, lotId: lotTarde.id },
      ]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 30 }],
        1
      );

      await stockService.reserveForOrder(order.id, user.id);
      const task = await testPrisma.warehouseTask.findFirstOrThrow();

      await executeTask(task.id, user.id);

      // O lote que vence primeiro perdeu 30; o outro não foi tocado.
      expect(await balanceOf(component.id, positions[0].id, lotCedo.id)).toBe('70');
      expect(await balanceOf(component.id, positions[0].id, lotTarde.id)).toBe('100');
      expect((await stockService.getBalance(component.id)).quantity).toBe(170);

      const movement = await testPrisma.stockMovement.findFirstOrThrow({
        where: { productId: component.id, type: 'OUT' },
      });
      expect(movement.lotId).toBe(lotCedo.id);
    });
  });

  // ==========================================================================
  // BLOQUEIO DE SAÍDA DE LOTE VENCIDO (e a exceção do ajuste)
  // ==========================================================================
  describe('bloqueio de saída de lote vencido', () => {
    const arrangeExpired = async () => {
      const product = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(2);
      const lot = await createTestLot(product.id, {
        lotNumber: 'L-VENCIDO',
        expiresAt: VENCIDO,
      });

      await seedStock(product.id, [
        { positionId: positions[0].id, quantity: 100, lotId: lot.id },
      ]);

      return { product, user, positions, lot };
    };

    it('recusa OUT de lote vencido, sem efeito colateral', async () => {
      const { product, user, positions, lot } = await arrangeExpired();

      await expect(
        stockService.registerMovement({
          productId: product.id,
          type: 'OUT',
          quantity: 10,
          reason: 'consumo de lote vencido',
          userId: user.id,
          fromPositionId: positions[0].id,
          lotId: lot.id,
        })
      ).rejects.toThrow(/venceu em 2020-01-01/);

      expect(await balanceOf(product.id, positions[0].id, lot.id)).toBe('100');
      expect(await testPrisma.stockMovement.count()).toBe(0);
    });

    it('recusa TRANSFER de lote vencido (a origem sempre debita)', async () => {
      const { product, user, positions, lot } = await arrangeExpired();

      await expect(
        stockService.transfer({
          productId: product.id,
          fromPositionId: positions[0].id,
          toPositionId: positions[1].id,
          quantity: 10,
          reason: 'mover material vencido para bloqueio',
          userId: user.id,
          lotId: lot.id,
        })
      ).rejects.toThrow(/não pode sair do estoque/);

      expect(await balanceOf(product.id, positions[0].id, lot.id)).toBe('100');
    });

    it('recusa a CONCLUSÃO de um PICKING cujo lote venceu depois do planejamento', async () => {
      const component = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);

      await setTestLicensedModule('WMS', true);
      clearLicensedModuleCache();

      const lot = await createTestLot(component.id, {
        lotNumber: 'L-VAI-VENCER',
        expiresAt: VENCE_TARDE,
      });

      await seedStock(component.id, [
        { positionId: positions[0].id, quantity: 100, lotId: lot.id },
      ]);

      const { order } = await createTestProductionOrderWithBom(
        user.id,
        [{ productId: component.id, quantity: 30 }],
        1
      );

      await stockService.reserveForOrder(order.id, user.id);
      const task = await testPrisma.warehouseTask.findFirstOrThrow();
      expect(task.lotId).toBe(lot.id);

      // O tempo passa entre o planejamento e a execução. É o cenário real: a
      // tarefa foi criada com lote válido e o operador só a executou depois.
      await testPrisma.lot.update({
        where: { id: lot.id },
        data: { expiresAt: VENCIDO },
      });

      await expect(executeTask(task.id, user.id)).rejects.toThrow(/venceu em/);

      expect(await balanceOf(component.id, positions[0].id, lot.id)).toBe('100');

      // A tarefa continua ABERTA, para replanejamento — mesmo comportamento do
      // "estoque insuficiente na posição" de F4.8.
      const reloaded = await testPrisma.warehouseTask.findUniqueOrThrow({
        where: { id: task.id },
      });
      expect(reloaded.status).toBe('PENDING');
    });

    it('lote SEM validade nunca é bloqueado', async () => {
      const product = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);
      const lot = await createTestLot(product.id, { lotNumber: 'L-SEM-DATA' });

      await seedStock(product.id, [
        { positionId: positions[0].id, quantity: 100, lotId: lot.id },
      ]);

      await stockService.registerMovement({
        productId: product.id,
        type: 'OUT',
        quantity: 10,
        reason: 'saída de lote sem validade',
        userId: user.id,
        fromPositionId: positions[0].id,
        lotId: lot.id,
      });

      expect(await balanceOf(product.id, positions[0].id, lot.id)).toBe('90');
    });

    /**
     * ⚠️ A EXCEÇÃO DELIBERADA — este teste existe para IMPEDIR que alguém
     * "corrija" o furo aparente da regra.
     *
     * Sem ele, o estoque vencido ficaria preso no saldo para sempre: a única
     * operação capaz de removê-lo estaria proibida junto com as demais. E note
     * o formato do ajuste — `type: 'OUT'` com `referenceType: 'ADJUSTMENT'`, que
     * é como o Fabric expressa baixa desde antes desta fase (`type: ADJUSTMENT`
     * soma no agregado, ver a nota em `assertLotNotExpiredForOutbound`). Testar
     * a exceção contra o TIPO passaria e a baixa continuaria impossível.
     */
    it('ADJUSTMENT CONSEGUE dar baixa em lote vencido (exceção deliberada)', async () => {
      const { product, user, positions, lot } = await arrangeExpired();

      const movement = await stockService.registerMovement({
        productId: product.id,
        type: 'OUT',
        quantity: 100,
        reason: 'Ajuste: descarte de material vencido',
        referenceType: 'ADJUSTMENT',
        userId: user.id,
        fromPositionId: positions[0].id,
        lotId: lot.id,
      });

      expect(movement.lotId).toBe(lot.id);
      // O lote saiu inteiro do endereço — a linha fica em zero (não é apagada,
      // mesmo comportamento de sempre).
      expect(await balanceOf(product.id, positions[0].id, lot.id)).toBe('0');
      expect((await stockService.getBalance(product.id)).quantity).toBe(0);
    });

    it('a ENTRADA de lote vencido continua permitida (receber vencido é um fato)', async () => {
      const product = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);
      const lot = await createTestLot(product.id, {
        lotNumber: 'L-JA-VENCIDO',
        expiresAt: VENCIDO,
      });

      await stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: 5,
        reason: 'chegou vencido da doca',
        userId: user.id,
        toPositionId: positions[0].id,
        lotId: lot.id,
      });

      expect(await balanceOf(product.id, positions[0].id, lot.id)).toBe('5');
    });
  });

  // ==========================================================================
  // CONCORRÊNCIA — o ponto de escrita compartilhada que a Fase 5 estreitou
  // ==========================================================================
  describe('concorrência sobre a linha de saldo do lote', () => {
    /**
     * A linha de `stock_position_balances` deixou de ser criada por `upsert`
     * sobre a chave única e passou a ser resolvida por SELECT-então-INSERT
     * (`resolvePositionBalanceRow`) — porque com `lotId` NULL o Prisma não
     * consegue montar o input de chave composta. Um SELECT-então-INSERT é uma
     * corrida clássica, e o que impede a linha duplicada é o LOCK 1 (o saldo
     * agregado do produto), adquirido antes.
     *
     * Este teste ataca exatamente esse ponto: duas entradas simultâneas no mesmo
     * (produto, posição, lote) sobre uma linha que AINDA NÃO EXISTE. Sem o
     * LOCK 1, o resultado seriam duas linhas — e o índice único não as recusa,
     * porque para produto sem lote NULL é distinto e para produto com lote as
     * duas transações iriam para o mesmo par.
     */
    it('duas entradas paralelas criando a MESMA linha de lote não a duplicam', async () => {
      const product = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);
      const lot = await createTestLot(product.id, { lotNumber: 'L-CORRIDA' });

      // A linha do AGREGADO já existe — e isso é de propósito. `applyMovement`
      // a cria com `upsert`, que numa corrida entre duas movimentações do mesmo
      // produto AINDA SEM saldo estoura no unique de `stock_balances`. É uma
      // limitação conhecida e anterior a esta fase (o `upsert` do Prisma não é
      // atômico), e não é o que este teste investiga: o alvo aqui é a linha de
      // (produto, posição, LOTE), que a Fase 5 passou a criar por
      // SELECT-então-INSERT. Deixar a corrida do agregado no meio testaria o
      // bug antigo em vez do ponto novo.
      await testPrisma.stockBalance.create({ data: { productId: product.id, quantity: 0 } });

      const entrada = (quantity: number) =>
        stockService.registerMovement({
          productId: product.id,
          type: 'IN',
          quantity,
          reason: 'entrada concorrente',
          userId: user.id,
          toPositionId: positions[0].id,
          lotId: lot.id,
        });

      await Promise.all([entrada(40), entrada(60)]);

      const rows = await testPrisma.stockPositionBalance.findMany({
        where: { productId: product.id, storagePositionId: positions[0].id },
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].quantity.toString()).toBe('100');
      expect((await stockService.getBalance(product.id)).quantity).toBe(100);
    }, 20000);

    it('duas saídas paralelas do MESMO lote com saldo para só uma — só uma passa', async () => {
      const product = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);
      const lot = await createTestLot(product.id, { lotNumber: 'L-DISPUTA' });

      await seedStock(product.id, [
        { positionId: positions[0].id, quantity: 100, lotId: lot.id },
      ]);

      const saida = () =>
        stockService.registerMovement({
          productId: product.id,
          type: 'OUT',
          quantity: 60,
          reason: 'saída concorrente do mesmo lote',
          userId: user.id,
          fromPositionId: positions[0].id,
          lotId: lot.id,
        });

      const results = await Promise.allSettled([saida(), saida()]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

      expect(await balanceOf(product.id, positions[0].id, lot.id)).toBe('40');
      expect((await stockService.getBalance(product.id)).quantity).toBe(40);
    }, 20000);

    it('saídas paralelas de LOTES DIFERENTES na mesma posição ambas passam', async () => {
      const product = await createTestProduct({ lotTracked: true });
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);
      const lotA = await createTestLot(product.id, { lotNumber: 'L-A' });
      const lotB = await createTestLot(product.id, { lotNumber: 'L-B' });

      await seedStock(product.id, [
        { positionId: positions[0].id, quantity: 100, lotId: lotA.id },
        { positionId: positions[0].id, quantity: 100, lotId: lotB.id },
      ]);

      const results = await Promise.allSettled([
        stockService.registerMovement({
          productId: product.id,
          type: 'OUT',
          quantity: 60,
          reason: 'saída lote A',
          userId: user.id,
          fromPositionId: positions[0].id,
          lotId: lotA.id,
        }),
        stockService.registerMovement({
          productId: product.id,
          type: 'OUT',
          quantity: 60,
          reason: 'saída lote B',
          userId: user.id,
          fromPositionId: positions[0].id,
          lotId: lotB.id,
        }),
      ]);

      // São linhas de saldo DIFERENTES: uma não bloqueia a outra por saldo (o
      // lock do agregado só as serializa em ordem).
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      expect(await balanceOf(product.id, positions[0].id, lotA.id)).toBe('40');
      expect(await balanceOf(product.id, positions[0].id, lotB.id)).toBe('40');
      expect((await stockService.getBalance(product.id)).quantity).toBe(80);
    }, 20000);
  });

  // ==========================================================================
  // REPOSIÇÃO (F4.10) sob a dimensão de lote
  // ==========================================================================
  describe('reposição com lote', () => {
    it('a tarefa de REPLENISHMENT herda o lote da origem, e o FEFO escolhe qual', async () => {
      const product = await createTestProduct({ lotTracked: true, minStock: 50 });
      const { positions: pickingPositions } = await createTestPositions(1, {
        isPickingArea: true,
      });
      const { positions: pulmao } = await createTestPositions(2);

      const lotTarde = await createTestLot(product.id, {
        lotNumber: 'L-TARDE',
        expiresAt: VENCE_TARDE,
      });
      const lotCedo = await createTestLot(product.id, {
        lotNumber: 'L-CEDO',
        expiresAt: VENCE_CEDO,
      });

      await seedStock(product.id, [
        // Picking abaixo do mínimo — dispara a reposição.
        { positionId: pickingPositions[0].id, quantity: 10, lotId: lotCedo.id },
        // Pulmão: o que vence TARDE é o mais antigo (o FIFO o escolheria).
        {
          positionId: pulmao[0].id,
          quantity: 200,
          lotId: lotTarde.id,
          updatedAt: new Date('2026-01-01'),
        },
        {
          positionId: pulmao[1].id,
          quantity: 200,
          lotId: lotCedo.id,
          updatedAt: new Date('2026-09-01'),
        },
      ]);

      const needs = await detectReplenishmentNeeds();

      expect(needs).toHaveLength(1);
      expect(needs[0].status).toBe('TASK_CREATED');

      const task = await testPrisma.warehouseTask.findFirstOrThrow({
        where: { type: 'REPLENISHMENT' },
      });
      expect(task.lotId).toBe(lotCedo.id);
      expect(task.fromPositionId).toBe(pulmao[1].id);
      expect(task.toPositionId).toBe(pickingPositions[0].id);
    });

    it('não repõe a partir de lote VENCIDO (a tarefa seria inexecutável)', async () => {
      const product = await createTestProduct({ lotTracked: true, minStock: 50 });
      const { positions: pickingPositions } = await createTestPositions(1, {
        isPickingArea: true,
      });
      const { positions: pulmao } = await createTestPositions(1);

      const lotVencido = await createTestLot(product.id, {
        lotNumber: 'L-VENCIDO',
        expiresAt: VENCIDO,
      });

      await seedStock(product.id, [
        { positionId: pickingPositions[0].id, quantity: 10, lotId: lotVencido.id },
        { positionId: pulmao[0].id, quantity: 200, lotId: lotVencido.id },
      ]);

      const needs = await detectReplenishmentNeeds();

      expect(needs).toHaveLength(1);
      expect(needs[0].status).toBe('NO_SOURCE');
      expect(await testPrisma.warehouseTask.count()).toBe(0);
    });
  });
});
