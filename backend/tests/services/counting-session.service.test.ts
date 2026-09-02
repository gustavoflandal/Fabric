import countingSessionService from '../../src/services/counting-session.service';
import countingPlanService from '../../src/services/counting-plan.service';
import stockService from '../../src/services/stock.service';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import { compareCountingRoute } from '../../src/utils/counting-position.util';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import {
  createTestProduct,
  createTestUser,
  createTestCountingPlan,
  createTestPositions,
  createTestPositionBalance,
  setTestLicensedModule,
} from '../helpers/fixtures';

/**
 * Fase 3 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5) —
 * contagem por endereço.
 *
 * O eixo destes testes é a RAMIFICAÇÃO POR LICENÇA, que é a decisão de desenho
 * mais fácil de quebrar sem perceber numa fase futura: uma instalação só-PCP
 * precisa continuar gerando um item por produto, sem endereço nenhum, enquanto
 * uma instalação com WMS gera um item por (produto × posição com saldo). Um
 * teste que só cobrisse o caminho novo deixaria passar uma regressão que só
 * apareceria no cliente que não comprou o módulo.
 *
 * `clearLicensedModuleCache()` no beforeEach/afterEach é obrigatório pelo mesmo
 * motivo de tests/integration/module-licensing.test.ts: o cache de licença vive
 * no módulo e sobrevive ao `cleanDatabase()`.
 */

describe('counting-session.service — contagem por endereço (Fase 3 do WMS)', () => {
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

  /** Plano ATIVO restrito a `productIds` — o critério mais determinístico. */
  async function createActivePlan(creatorId: string, productIds: string[]) {
    return createTestCountingPlan(creatorId, {
      status: 'ACTIVE',
      criteria: { productIds },
    });
  }

  const itemsOf = (sessionId: string) =>
    testPrisma.countingItem.findMany({
      where: { sessionId },
      include: { storagePosition: { select: { code: true, floor: true, position: true } } },
      orderBy: { sequence: 'asc' },
    });

  // ==========================================================================
  // F3.2 — geração de itens
  // ==========================================================================

  describe('F3.2: geração de itens', () => {
    it('SEM WMS licenciado: um item por PRODUTO, sem endereço (comportamento inalterado)', async () => {
      await setTestLicensedModule('WMS', false);
      const user = await createTestUser();
      const productA = await createTestProduct();
      const productB = await createTestProduct();

      // Mesmo COM saldo endereçado no banco, a instalação só-PCP o ignora: a
      // ramificação é pela licença, não pela existência do dado.
      const { positions } = await createTestPositions(2);
      await createTestPositionBalance(productA.id, positions[0].id, 10);
      await createTestPositionBalance(productA.id, positions[1].id, 20);

      const plan = await createActivePlan(user.id, [productA.id, productB.id]);
      const session = await countingSessionService.create({
        planId: plan.id,
        scheduledDate: new Date(),
      });

      const items = await itemsOf(session.id);

      expect(items).toHaveLength(2);
      expect(items.every((item) => item.storagePositionId === null)).toBe(true);
      expect(items.every((item) => Number(item.systemQty) === 0)).toBe(true);
      expect(session.totalItems).toBe(2);
    });

    it('COM WMS licenciado: produto com saldo em 3 posições vira 3 itens, um por posição', async () => {
      await setTestLicensedModule('WMS', true);
      const user = await createTestUser();
      const product = await createTestProduct();
      const { positions } = await createTestPositions(3);

      await createTestPositionBalance(product.id, positions[0].id, 10);
      await createTestPositionBalance(product.id, positions[1].id, 25);
      await createTestPositionBalance(product.id, positions[2].id, 5);

      const plan = await createActivePlan(user.id, [product.id]);
      const session = await countingSessionService.create({
        planId: plan.id,
        scheduledDate: new Date(),
      });

      const items = await itemsOf(session.id);

      expect(items).toHaveLength(3);
      expect(session.totalItems).toBe(3);
      // `totalItems` conta ITENS, não produtos — é o número que o contador vê
      // como tamanho do trabalho.
      expect(items.every((item) => item.productId === product.id)).toBe(true);

      // `systemQty` vem direto do StockPositionBalance daquela posição, e não
      // mais do placeholder 0 + soma de stock_movements em start().
      const byPosition = new Map(items.map((item) => [item.storagePositionId, Number(item.systemQty)]));
      expect(byPosition.get(positions[0].id)).toBe(10);
      expect(byPosition.get(positions[1].id)).toBe(25);
      expect(byPosition.get(positions[2].id)).toBe(5);
    });

    it('COM WMS licenciado: posição com saldo ZERADO não vira item', async () => {
      await setTestLicensedModule('WMS', true);
      const user = await createTestUser();
      const product = await createTestProduct();
      const { positions } = await createTestPositions(2);

      await createTestPositionBalance(product.id, positions[0].id, 7);
      // Linha de saldo que sobreviveu zerada: o material não está mais lá.
      await createTestPositionBalance(product.id, positions[1].id, 0);

      const plan = await createActivePlan(user.id, [product.id]);
      const session = await countingSessionService.create({
        planId: plan.id,
        scheduledDate: new Date(),
      });

      const items = await itemsOf(session.id);

      expect(items).toHaveLength(1);
      expect(items[0].storagePositionId).toBe(positions[0].id);
    });

    it('COM WMS licenciado: produto SEM nenhum saldo endereçado ainda gera 1 item, sem posição', async () => {
      await setTestLicensedModule('WMS', true);
      const user = await createTestUser();
      const enderecado = await createTestProduct();
      const orfao = await createTestProduct();
      const { positions } = await createTestPositions(1);

      await createTestPositionBalance(enderecado.id, positions[0].id, 12);

      const plan = await createActivePlan(user.id, [enderecado.id, orfao.id]);
      const session = await countingSessionService.create({
        planId: plan.id,
        scheduledDate: new Date(),
      });

      const items = await itemsOf(session.id);

      // Decisão de desenho: não gerar item faria o produto SUMIR da contagem —
      // e "o sistema acha que tem saldo, mas ninguém sabe onde" é exatamente o
      // caso que mais precisa ser conferido.
      expect(items).toHaveLength(2);

      const orfaoItem = items.find((item) => item.productId === orfao.id);
      expect(orfaoItem?.storagePositionId).toBeNull();
      expect(orfaoItem?.sequence).toBe(0);

      const enderecadoItem = items.find((item) => item.productId === enderecado.id);
      expect(enderecadoItem?.storagePositionId).toBe(positions[0].id);
    });
  });

  // ==========================================================================
  // F3.2 — critério de plano por rua/armazém
  // ==========================================================================

  describe('F3.2: critério de plano por rua/armazém', () => {
    it('selectProducts() por streetCode traz só quem tem saldo naquela rua', async () => {
      const user = await createTestUser();
      const naRua = await createTestProduct();
      const foraDaRua = await createTestProduct();

      const ruaA = await createTestPositions(1, { streetCode: 'R07' });
      const ruaB = await createTestPositions(1, { streetCode: 'R09' });

      await createTestPositionBalance(naRua.id, ruaA.positions[0].id, 4);
      await createTestPositionBalance(foraDaRua.id, ruaB.positions[0].id, 4);

      const plan = await createTestCountingPlan(user.id, {
        status: 'ACTIVE',
        criteria: { streetCode: 'R07' },
      });

      const selected = await countingPlanService.selectProducts(plan.id);

      expect(selected.map((product) => product.id)).toEqual([naRua.id]);
    });

    it('selectProducts() por warehouseId traz só quem tem saldo naquele armazém', async () => {
      const user = await createTestUser();
      const dentro = await createTestProduct();
      const fora = await createTestProduct();

      const armazemA = await createTestPositions(1);
      const armazemB = await createTestPositions(1);

      await createTestPositionBalance(dentro.id, armazemA.positions[0].id, 3);
      await createTestPositionBalance(fora.id, armazemB.positions[0].id, 3);

      const plan = await createTestCountingPlan(user.id, {
        status: 'ACTIVE',
        criteria: { warehouseId: armazemA.warehouse.id },
      });

      const selected = await countingPlanService.selectProducts(plan.id);

      expect(selected.map((product) => product.id)).toEqual([dentro.id]);
    });

    it('critério por rua ignora saldo ZERADO (produto que já saiu de lá)', async () => {
      const user = await createTestUser();
      const product = await createTestProduct();
      const rua = await createTestPositions(1, { streetCode: 'R11' });

      await createTestPositionBalance(product.id, rua.positions[0].id, 0);

      const plan = await createTestCountingPlan(user.id, {
        status: 'ACTIVE',
        criteria: { streetCode: 'R11' },
      });

      expect(await countingPlanService.selectProducts(plan.id)).toHaveLength(0);
    });
  });

  // ==========================================================================
  // F3.3 — sequence / rota serpentina
  // ==========================================================================

  describe('F3.3: sequence (rota serpentina)', () => {
    it('numera 1..N alternando a direção das posições a cada andar', async () => {
      await setTestLicensedModule('WMS', true);
      const user = await createTestUser();
      const product = await createTestProduct();
      // 2 andares × 3 posições, todos com saldo.
      const { positions } = await createTestPositions(3, { floors: 2 });
      for (const position of positions) {
        await createTestPositionBalance(product.id, position.id, 1);
      }

      const plan = await createActivePlan(user.id, [product.id]);
      const session = await countingSessionService.create({
        planId: plan.id,
        scheduledDate: new Date(),
      });

      const items = await itemsOf(session.id);

      expect(items.map((item) => item.sequence)).toEqual([1, 2, 3, 4, 5, 6]);

      // Andar 1 (ímpar) = ida (1→3); andar 2 (par) = volta (3→1). Sem a
      // serpentina, o contador terminaria o andar 1 na posição 3 e teria que
      // voltar a rua inteira para começar o andar 2 na posição 1.
      expect(items.map((item) => [item.storagePosition!.floor, item.storagePosition!.position])).toEqual([
        [1, 1],
        [1, 2],
        [1, 3],
        [2, 3],
        [2, 2],
        [2, 1],
      ]);
    });

    it('itens SEM endereço mantêm sequence 0 (caminho só-PCP)', async () => {
      await setTestLicensedModule('WMS', false);
      const user = await createTestUser();
      const product = await createTestProduct();

      const plan = await createActivePlan(user.id, [product.id]);
      const session = await countingSessionService.create({
        planId: plan.id,
        scheduledDate: new Date(),
      });

      const items = await itemsOf(session.id);
      expect(items.every((item) => item.sequence === 0)).toBe(true);
    });

    it('compareCountingRoute() ordena armazém > rua > andar, e só então serpenteia', () => {
      const route = (warehouseCode: string, streetCode: string, floor: number, position: number) => ({
        warehouseCode,
        streetCode,
        floor,
        position,
      });

      // Armazém e rua NUNCA invertem — são a linha da varredura, não a direção.
      expect(compareCountingRoute(route('A', 'R01', 1, 9), route('B', 'R01', 1, 1))).toBeLessThan(0);
      expect(compareCountingRoute(route('A', 'R01', 1, 9), route('A', 'R02', 1, 1))).toBeLessThan(0);
      expect(compareCountingRoute(route('A', 'R01', 1, 9), route('A', 'R01', 2, 1))).toBeLessThan(0);

      // Andar ímpar: posição crescente. Andar par: decrescente.
      expect(compareCountingRoute(route('A', 'R01', 1, 1), route('A', 'R01', 1, 2))).toBeLessThan(0);
      expect(compareCountingRoute(route('A', 'R01', 2, 1), route('A', 'R01', 2, 2))).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // start() — systemQty
  // ==========================================================================

  describe('F3.2: start() e o systemQty', () => {
    it('relê o saldo da POSIÇÃO ao iniciar (a sessão pode ter sido agendada dias antes)', async () => {
      await setTestLicensedModule('WMS', true);
      const user = await createTestUser();
      const product = await createTestProduct();
      const { positions } = await createTestPositions(1);
      await createTestPositionBalance(product.id, positions[0].id, 30);

      const plan = await createActivePlan(user.id, [product.id]);
      const session = await countingSessionService.create({
        planId: plan.id,
        scheduledDate: new Date(),
      });

      // Movimentação entre o agendamento e a partida.
      // Fase 5: `updateMany` filtrando `lotId: null` — a chave única composta
      // ganhou o lote e o Prisma não aceita `lotId: null` no input dela. O
      // produto deste teste não controla lote, então existe exatamente UMA
      // linha sem lote nesta posição e o `updateMany` atinge só ela.
      await testPrisma.stockPositionBalance.updateMany({
        where: { productId: product.id, storagePositionId: positions[0].id, lotId: null },
        data: { quantity: 18 },
      });

      await countingSessionService.start(session.id, user.id);

      const items = await itemsOf(session.id);
      expect(Number(items[0].systemQty)).toBe(18);
    });

    it('item SEM endereço continua derivando o saldo de stock_movements', async () => {
      await setTestLicensedModule('WMS', false);
      const user = await createTestUser();
      const product = await createTestProduct();

      await stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: 40,
        reason: 'Entrada de teste',
        userId: user.id,
      });

      const plan = await createActivePlan(user.id, [product.id]);
      const session = await countingSessionService.create({
        planId: plan.id,
        scheduledDate: new Date(),
      });

      await countingSessionService.start(session.id, user.id);

      const items = await itemsOf(session.id);
      expect(Number(items[0].systemQty)).toBe(40);
    });
  });

  // ==========================================================================
  // F3.4 — ajuste pós-contagem com posição
  // ==========================================================================

  describe('F3.4: adjustStock() com posição', () => {
    /**
     * Deixa a sessão pronta para ajuste: item RECOUNTED com divergência e
     * sessão COMPLETED. O status é gravado direto porque o que está sob teste é
     * `adjustStock()`, não o fluxo de contagem/recontagem (coberto em
     * counting-item.service.test.ts).
     */
    async function sessionProntaParaAjuste(wmsEnabled: boolean, saldoInicial: number, contado: number) {
      await setTestLicensedModule('WMS', wmsEnabled);
      const user = await createTestUser();
      const product = await createTestProduct();
      const { positions } = await createTestPositions(1);

      // Saldo real via registerMovement: constrói stock_balances E
      // stock_position_balances de forma consistente, que é pré-requisito para
      // o OUT endereçado do ajuste passar pelas validações de saldo.
      await stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: saldoInicial,
        reason: 'Carga inicial de teste',
        userId: user.id,
        ...(wmsEnabled ? { toPositionId: positions[0].id } : {}),
      });

      const plan = await createActivePlan(user.id, [product.id]);
      const session = await countingSessionService.create({
        planId: plan.id,
        scheduledDate: new Date(),
      });
      await countingSessionService.start(session.id, user.id);

      const [item] = await itemsOf(session.id);
      await testPrisma.countingItem.update({
        where: { id: item.id },
        data: {
          countedQty: contado,
          recountQty: contado,
          finalQty: contado,
          difference: contado - saldoInicial,
          hasDifference: true,
          status: 'RECOUNTED',
        },
      });
      await testPrisma.countingSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED' },
      });

      return { user, product, session, position: positions[0] };
    }

    it('SOBRA (difference > 0) gera IN com toPositionId no endereço do item', async () => {
      const { user, session, position } = await sessionProntaParaAjuste(true, 100, 112);

      const result = await countingSessionService.adjustStock(session.id, user.id);

      expect(result.adjustmentsCreated).toBe(1);
      const [movement] = result.adjustments;
      expect(movement.type).toBe('IN');
      expect(movement.quantity).toBe(12);
      expect(movement.toPositionId).toBe(position.id);
      expect(movement.fromPositionId).toBeNull();
      expect(movement.countingSessionId).toBe(session.id);
    });

    it('QUEBRA (difference < 0) gera OUT com fromPositionId no endereço do item', async () => {
      const { user, product, session, position } = await sessionProntaParaAjuste(true, 100, 85);

      const result = await countingSessionService.adjustStock(session.id, user.id);

      const [movement] = result.adjustments;
      expect(movement.type).toBe('OUT');
      expect(movement.quantity).toBe(15);
      expect(movement.fromPositionId).toBe(position.id);
      expect(movement.toPositionId).toBeNull();

      // O saldo DA POSIÇÃO foi debitado, não só o agregado — é isso que a
      // dimensão de endereço acrescenta ao ajuste.
      const balance = await testPrisma.stockPositionBalance.findFirst({
        where: { productId: product.id, storagePositionId: position.id, lotId: null },
      });
      expect(Number(balance?.quantity)).toBe(85);
    });

    it('item SEM endereço continua ajustando sem posição nenhuma', async () => {
      const { user, session } = await sessionProntaParaAjuste(false, 50, 44);

      const result = await countingSessionService.adjustStock(session.id, user.id);

      const [movement] = result.adjustments;
      expect(movement.type).toBe('OUT');
      expect(movement.fromPositionId).toBeNull();
      expect(movement.toPositionId).toBeNull();
    });
  });
});
