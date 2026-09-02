import stockService from '../../src/services/stock.service';
import { getDivergences } from '../../src/services/stock-position.service';
import { prisma } from '../../src/config/database';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestProduct, createTestUser, createTestPositions } from '../helpers/fixtures';

/**
 * F1.5 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5,
 * Fase 1) — testes de concorrência do saldo POR POSIÇÃO.
 *
 * Mesma preocupação (e mesmo estilo, com MySQL real) dos testes de concorrência
 * já existentes em `tests/services/stock.service.test.ts`, mas para a dimensão
 * nova: `applyMovement()` agora trava DUAS linhas (agregado + posição) quando a
 * movimentação informa `positionId`, e o modo de falha que estes testes travam
 * é o clássico read-modify-write concorrente — duas transações lerem o mesmo
 * saldo de posição e ambas decidirem que cabem.
 *
 * Por que chamar o SERVICE direto e não a API: nenhum chamador de produção
 * passa `positionId` ainda (isso só chega nas fases 2 a 4, quando recebimento,
 * contagem e transferência forem endereçados). Sem exercitar o caminho novo
 * aqui, ele entraria em produção sem nenhuma cobertura de concorrência — que é
 * exatamente o cenário em que a race condition original de estoque passou
 * despercebida até acontecer ao vivo.
 *
 * `registerMovement` e `registerMovementInTransaction` são os dois pontos de
 * entrada de `applyMovement`; ambos são exercitados.
 */

const balanceAt = async (productId: string, storagePositionId: string) => {
  const row = await testPrisma.stockPositionBalance.findUnique({
    where: { productId_storagePositionId: { productId, storagePositionId } },
  });
  return row ? Number(row.quantity) : null;
};

describe('saldo por posição — StockPositionBalance (F1.2/F1.5)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------
  // Comportamento básico
  // ------------------------------------------------------------------

  it('IN com positionId cria o saldo da posição e mantém o agregado em sincronia', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(1);

    const movement = await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 40,
      reason: 'entrada endereçada',
      userId: user.id,
      positionId: positions[0].id,
    });

    // A movimentação registra o endereço (F1.2) - é o que a Fase 2 vai
    // desdobrar em fromPositionId/toPositionId.
    expect(movement.positionId).toBe(positions[0].id);

    expect(await balanceAt(product.id, positions[0].id)).toBe(40);
    expect((await stockService.getBalance(product.id)).quantity).toBe(40);
  });

  it('movimentação SEM positionId não cria linha de saldo por posição (compatibilidade)', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();

    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 25,
      reason: 'entrada não endereçada (fluxo atual)',
      userId: user.id,
    });

    expect((await stockService.getBalance(product.id)).quantity).toBe(25);
    expect(await testPrisma.stockPositionBalance.count()).toBe(0);
  });

  it('OUT valida saldo NA POSIÇÃO, não só no agregado', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(2);

    // 10 no endereço A, 90 no endereço B: agregado 100.
    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 10,
      reason: 'entrada A',
      userId: user.id,
      positionId: positions[0].id,
    });
    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 90,
      reason: 'entrada B',
      userId: user.id,
      positionId: positions[1].id,
    });

    // 30 caberia no agregado (100), mas não no endereço A (10). É esta
    // validação que separa saldo por posição de saldo global.
    await expect(
      stockService.registerMovement({
        productId: product.id,
        type: 'OUT',
        quantity: 30,
        reason: 'saída maior que o saldo da posição',
        userId: user.id,
        positionId: positions[0].id,
      })
    ).rejects.toThrow(/insuficiente na posição/i);

    // Nada pode ter mudado - nem posição, nem agregado.
    expect(await balanceAt(product.id, positions[0].id)).toBe(10);
    expect((await stockService.getBalance(product.id)).quantity).toBe(100);
  });

  it('positionId inexistente é erro de negócio (404), não erro de FK cru', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();

    await expect(
      stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: 5,
        reason: 'endereço inexistente',
        userId: user.id,
        positionId: '00000000-0000-0000-0000-000000000000',
      })
    ).rejects.toThrow(/Posição de armazenagem não encontrada/i);
  });

  // ------------------------------------------------------------------
  // F1.5 - concorrência
  // ------------------------------------------------------------------

  it(
    'CONCORRÊNCIA: duas saídas paralelas da MESMA posição com saldo para só uma — só uma passa',
    async () => {
      const product = await createTestProduct();
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);
      const positionId = positions[0].id;

      // Saldo de 50 no endereço; duas saídas de 30 em paralelo pedem 60.
      // Matematicamente só uma cabe.
      await stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: 50,
        reason: 'entrada inicial endereçada',
        userId: user.id,
        positionId,
      });

      const attempts = [0, 1].map((i) =>
        stockService.registerMovement({
          productId: product.id,
          type: 'OUT',
          quantity: 30,
          reason: `saída concorrente da posição ${i}`,
          userId: user.id,
          positionId,
        })
      );

      const results = await Promise.allSettled(attempts);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

      // 50 - 30 = 20, nunca negativo.
      expect(await balanceAt(product.id, positionId)).toBe(20);
      expect((await stockService.getBalance(product.id)).quantity).toBe(20);

      // Confere contra o histórico também: não pode ter ficado uma "saída
      // fantasma" registrada por uma transação que foi rejeitada.
      const outs = await testPrisma.stockMovement.count({
        where: { productId: product.id, type: 'OUT' },
      });
      expect(outs).toBe(1);
    },
    30000
  );

  it(
    'CONCORRÊNCIA: duas entradas paralelas na MESMA posição — sem perda de atualização',
    async () => {
      const product = await createTestProduct();
      const user = await createTestUser();
      const { positions } = await createTestPositions(1);
      const positionId = positions[0].id;

      // Entrada inicial: garante que a LINHA de saldo já existe antes das
      // paralelas. O que este teste isola é o read-modify-write concorrente
      // (perda de atualização), não a corrida de INSERT do upsert - essa
      // segunda é uma propriedade do padrão de upsert que o saldo agregado já
      // usa desde a Fase 1 e não é o que a F1.5 pede.
      await stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: 10,
        reason: 'entrada inicial endereçada',
        userId: user.id,
        positionId,
      });

      const attempts = [7, 13].map((quantity) =>
        stockService.registerMovement({
          productId: product.id,
          type: 'IN',
          quantity,
          reason: `entrada concorrente de ${quantity}`,
          userId: user.id,
          positionId,
        })
      );

      const results = await Promise.allSettled(attempts);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);

      // 10 + 7 + 13 = 30. Se as duas entradas tivessem lido o mesmo saldo (10)
      // e escrito por cima uma da outra, daria 17 ou 23 - o bug clássico.
      expect(await balanceAt(product.id, positionId)).toBe(30);
      expect((await stockService.getBalance(product.id)).quantity).toBe(30);
    },
    30000
  );

  it(
    'CONSISTÊNCIA: sequência mista (com e sem posição) deixa agregado e saldo por posição coerentes',
    async () => {
      const product = await createTestProduct();
      const user = await createTestUser();
      const { positions } = await createTestPositions(2);
      const [posA, posB] = positions;

      const mov = (
        type: 'IN' | 'OUT',
        quantity: number,
        positionId?: string
      ) =>
        stockService.registerMovement({
          productId: product.id,
          type,
          quantity,
          reason: `${type} ${quantity}${positionId ? ' endereçada' : ' sem endereço'}`,
          userId: user.id,
          positionId,
        });

      await mov('IN', 100, posA.id); // A: 100        | agregado: 100
      await mov('IN', 50, posB.id); //  B: 50         | agregado: 150
      await mov('IN', 30); //           não endereçada| agregado: 180
      await mov('OUT', 40, posA.id); // A: 60         | agregado: 140
      await mov('OUT', 20); //          não endereçada| agregado: 120
      await mov('OUT', 50, posB.id); // B: 0          | agregado: 70

      // Uma sétima movimentação passando pelo OUTRO ponto de entrada
      // (registerMovementInTransaction, o que purchase-receipt.service::cancel
      // usa) para garantir que os dois caminhos mantêm a mesma invariante.
      await prisma.$transaction((tx) =>
        stockService.registerMovementInTransaction(tx, {
          productId: product.id,
          type: 'IN',
          quantity: 15,
          reason: 'entrada endereçada dentro de transação do chamador',
          userId: user.id,
          positionId: posB.id,
        })
      );

      const aggregate = (await stockService.getBalance(product.id)).quantity;
      const qtyA = await balanceAt(product.id, posA.id);
      const qtyB = await balanceAt(product.id, posB.id);

      expect(qtyA).toBe(60);
      expect(qtyB).toBe(15);
      expect(aggregate).toBe(85); // 70 + 15

      // A invariante da F1.3: o endereçado (75) é MENOR que o agregado (85), e
      // a diferença de 10 é exatamente o saldo não endereçado (IN 30 - OUT 20)
      // - situação NORMAL nesta fase, não divergência.
      expect(qtyA! + qtyB!).toBe(75);
      expect(qtyA! + qtyB!).toBeLessThanOrEqual(aggregate);
      await expect(getDivergences()).resolves.toEqual([]);
    },
    30000
  );

  // ------------------------------------------------------------------
  // F1.3 - invariante de consistência
  // ------------------------------------------------------------------

  it('getDivergences acusa quando a soma por posição ultrapassa o agregado', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(1);

    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 100,
      reason: 'entrada endereçada',
      userId: user.id,
      positionId: positions[0].id,
    });

    expect(await getDivergences()).toEqual([]);

    // Corrompe o agregado por FORA de applyMovement - que é exatamente a única
    // forma de essa invariante ser violada, e por isso o que o job precisa
    // conseguir detectar.
    await testPrisma.stockBalance.update({
      where: { productId: product.id },
      data: { quantity: 60 },
    });

    const divergences = await getDivergences();
    expect(divergences).toHaveLength(1);
    expect(divergences[0]).toMatchObject({
      productId: product.id,
      productCode: product.code,
      aggregateQuantity: 60,
    });
    expect(Number(divergences[0].addressedQuantity)).toBe(100);
    expect(Number(divergences[0].difference)).toBe(40);
  });
});
