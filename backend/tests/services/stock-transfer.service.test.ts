import stockService from '../../src/services/stock.service';
import { getDivergences } from '../../src/services/stock-position.service';
import { getPositionMovements } from '../../src/services/storage-position.service';
import { prisma } from '../../src/config/database';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestProduct, createTestUser, createTestPositions } from '../helpers/fixtures';

/**
 * Fase 2 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5,
 * Fase 2) — TRANSFERÊNCIA INTERNA (F2.3) e o histórico por posição (F2.4).
 *
 * Testes de concorrência OBRIGATÓRIOS, mesmo padrão exigido nas fases
 * anteriores (F1.5): MySQL real, `Promise.allSettled` de operações paralelas,
 * asserção sobre o saldo FINAL e sobre o histórico gravado — não só sobre o
 * retorno das chamadas.
 *
 * O que é específico da transferência e não existia na Fase 1:
 *   * uma única movimentação toca DUAS linhas de `stock_position_balances`;
 *   * o saldo agregado (`stock_balances`) NÃO pode mudar — é a diferença
 *     essencial em relação a IN/OUT/ADJUSTMENT;
 *   * duas transferências em SENTIDOS OPOSTOS entre as mesmas posições são o
 *     cenário clássico de deadlock, e é a ordem determinística de lock
 *     (agregado primeiro, depois posições em ordem crescente de id) que o
 *     previne.
 */

/**
 * Fase 5: a chave única virou (produto, posição, LOTE) e o input de chave
 * composta do Prisma não aceita `lotId: null` — a leitura da linha SEM lote
 * passa a ser um `findFirst` com `lotId: null`.
 */
const balanceAt = async (productId: string, storagePositionId: string) => {
  const row = await testPrisma.stockPositionBalance.findFirst({
    where: { productId, storagePositionId, lotId: null },
  });
  return row ? Number(row.quantity) : null;
};

const seedAt = (productId: string, userId: string, positionId: string, quantity: number) =>
  stockService.registerMovement({
    productId,
    type: 'IN',
    quantity,
    reason: 'carga inicial endereçada',
    userId,
    toPositionId: positionId,
  });

describe('transferência interna — TRANSFER (F2.3/F2.4)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
    await prisma.$disconnect();
  });

  // ------------------------------------------------------------------
  // F2.3 — comportamento básico
  // ------------------------------------------------------------------

  it('debita a origem, credita o destino e NÃO altera o saldo agregado', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(2);
    const [origem, destino] = positions;

    await seedAt(product.id, user.id, origem.id, 100);

    const aggregateBefore = await testPrisma.stockBalance.findUnique({
      where: { productId: product.id },
    });

    const movement = await stockService.transfer({
      productId: product.id,
      fromPositionId: origem.id,
      toPositionId: destino.id,
      quantity: 30,
      reason: 'realocação para posição de picking',
      userId: user.id,
    });

    // UMA movimentação, com as duas pontas — não um par OUT/IN.
    expect(movement.type).toBe('TRANSFER');
    expect(movement.fromPositionId).toBe(origem.id);
    expect(movement.toPositionId).toBe(destino.id);
    expect(await testPrisma.stockMovement.count()).toBe(2); // a carga inicial + esta

    expect(await balanceAt(product.id, origem.id)).toBe(70);
    expect(await balanceAt(product.id, destino.id)).toBe(30);

    // O agregado é o ponto: a empresa continua tendo 100 do produto. E a linha
    // não pode nem ter sido reescrita — `version` intacta, porque nada mudou
    // nela (um leitor com lock otimista não pode ver uma versão nova sem fato
    // novo).
    const aggregateAfter = await testPrisma.stockBalance.findUnique({
      where: { productId: product.id },
    });
    expect(aggregateAfter!.quantity).toBe(100);
    expect(aggregateAfter!.version).toBe(aggregateBefore!.version);
    expect((await stockService.getBalance(product.id)).quantity).toBe(100);

    // A invariante da F1.3 continua valendo: a soma endereçada (70 + 30) não
    // ultrapassa o agregado.
    await expect(getDivergences()).resolves.toEqual([]);
  });

  it('recusa transferência maior que o saldo DA ORIGEM, sem efeito colateral', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(3);
    const [origem, destino, outra] = positions;

    // 10 na origem e 90 em outra posição: o agregado (100) cobriria 30, mas a
    // ORIGEM não. É a mesma distinção que a Fase 1 já garantia para o OUT.
    await seedAt(product.id, user.id, origem.id, 10);
    await seedAt(product.id, user.id, outra.id, 90);

    await expect(
      stockService.transfer({
        productId: product.id,
        fromPositionId: origem.id,
        toPositionId: destino.id,
        quantity: 30,
        reason: 'transferência sem lastro na origem',
        userId: user.id,
      })
    ).rejects.toThrow(/insuficiente na posição/i);

    expect(await balanceAt(product.id, origem.id)).toBe(10);
    // O destino não pode nem ter ganhado uma linha de saldo zerada por um
    // upsert que a transação abortada deveria ter desfeito.
    expect(await balanceAt(product.id, destino.id)).toBeNull();
    expect((await stockService.getBalance(product.id)).quantity).toBe(100);
    expect(
      await testPrisma.stockMovement.count({ where: { type: 'TRANSFER' } })
    ).toBe(0);
  });

  it('recusa destino BLOQUEADO', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(2);
    const [origem, destino] = positions;

    await seedAt(product.id, user.id, origem.id, 50);
    await testPrisma.storagePosition.update({
      where: { id: destino.id },
      data: { blocked: true },
    });

    await expect(
      stockService.transfer({
        productId: product.id,
        fromPositionId: origem.id,
        toPositionId: destino.id,
        quantity: 10,
        reason: 'tentativa de endereçar em posição bloqueada',
        userId: user.id,
      })
    ).rejects.toThrow(/bloqueada/i);

    expect(await balanceAt(product.id, origem.id)).toBe(50);
    expect(await balanceAt(product.id, destino.id)).toBeNull();
  });

  it('origem BLOQUEADA continua podendo ser esvaziada', async () => {
    // Bloquear um endereço significa "não receba mais material", e não
    // "o material que está aqui ficou preso". Esvaziar uma posição bloqueada é
    // justamente a operação que se quer fazer depois de bloqueá-la.
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(2);
    const [origem, destino] = positions;

    await seedAt(product.id, user.id, origem.id, 40);
    await testPrisma.storagePosition.update({
      where: { id: origem.id },
      data: { blocked: true },
    });

    await stockService.transfer({
      productId: product.id,
      fromPositionId: origem.id,
      toPositionId: destino.id,
      quantity: 40,
      reason: 'esvaziando endereço bloqueado',
      userId: user.id,
    });

    expect(await balanceAt(product.id, origem.id)).toBe(0);
    expect(await balanceAt(product.id, destino.id)).toBe(40);
  });

  it('recusa origem igual ao destino e posição inexistente', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(1);

    await seedAt(product.id, user.id, positions[0].id, 10);

    await expect(
      stockService.transfer({
        productId: product.id,
        fromPositionId: positions[0].id,
        toPositionId: positions[0].id,
        quantity: 5,
        reason: 'origem igual ao destino',
        userId: user.id,
      })
    ).rejects.toThrow(/origem e destino são a mesma/i);

    await expect(
      stockService.transfer({
        productId: product.id,
        fromPositionId: positions[0].id,
        toPositionId: '00000000-0000-0000-0000-000000000000',
        quantity: 5,
        reason: 'destino inexistente',
        userId: user.id,
      })
    ).rejects.toThrow(/Posição de armazenagem não encontrada/i);

    expect(await balanceAt(product.id, positions[0].id)).toBe(10);
  });

  it('recusa quantidade não positiva e produto inexistente', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(2);

    await expect(
      stockService.transfer({
        productId: product.id,
        fromPositionId: positions[0].id,
        toPositionId: positions[1].id,
        quantity: 0,
        reason: 'quantidade zero',
        userId: user.id,
      })
    ).rejects.toThrow(/maior que zero/i);

    await expect(
      stockService.transfer({
        productId: '00000000-0000-0000-0000-000000000000',
        fromPositionId: positions[0].id,
        toPositionId: positions[1].id,
        quantity: 5,
        reason: 'produto inexistente',
        userId: user.id,
      })
    ).rejects.toThrow(/Produto não encontrado/i);
  });

  it('preserva a precisão decimal em transferências fracionadas', async () => {
    // A coluna é DECIMAL(18,4) (decisão D2). Uma sequência que em Float
    // acumularia erro (0.1 + 0.2) tem de fechar exata aqui.
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(2);
    const [origem, destino] = positions;

    await seedAt(product.id, user.id, origem.id, 1);

    await stockService.transfer({
      productId: product.id,
      fromPositionId: origem.id,
      toPositionId: destino.id,
      quantity: 0.1,
      reason: 'fração 1',
      userId: user.id,
    });
    await stockService.transfer({
      productId: product.id,
      fromPositionId: origem.id,
      toPositionId: destino.id,
      quantity: 0.2,
      reason: 'fração 2',
      userId: user.id,
    });

    const origemRow = await testPrisma.stockPositionBalance.findFirst({
      where: { productId: product.id, storagePositionId: origem.id, lotId: null },
    });
    const destinoRow = await testPrisma.stockPositionBalance.findFirst({
      where: { productId: product.id, storagePositionId: destino.id, lotId: null },
    });

    expect(origemRow!.quantity.toString()).toBe('0.7');
    expect(destinoRow!.quantity.toString()).toBe('0.3');
  });

  // ------------------------------------------------------------------
  // F2.3 — CONCORRÊNCIA (obrigatória, padrão da F1.5)
  // ------------------------------------------------------------------

  it(
    'CONCORRÊNCIA: duas transferências paralelas da MESMA origem com saldo para só uma — só uma passa',
    async () => {
      const product = await createTestProduct();
      const user = await createTestUser();
      const { positions } = await createTestPositions(3);
      const [origem, destinoA, destinoB] = positions;

      // 50 na origem; duas transferências de 30 em paralelo pedem 60.
      await seedAt(product.id, user.id, origem.id, 50);

      const results = await Promise.allSettled(
        [destinoA, destinoB].map((destino) =>
          stockService.transfer({
            productId: product.id,
            fromPositionId: origem.id,
            toPositionId: destino.id,
            quantity: 30,
            reason: `transferência concorrente para ${destino.code}`,
            userId: user.id,
          })
        )
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

      // 50 - 30 = 20 na origem, nunca negativo; e exatamente UM destino
      // recebeu — o outro não pode ter sido creditado por uma transação que
      // foi rejeitada (transferência "fantasma": material aparecendo no
      // destino sem ter saído da origem).
      expect(await balanceAt(product.id, origem.id)).toBe(20);

      const creditados = [
        await balanceAt(product.id, destinoA.id),
        await balanceAt(product.id, destinoB.id),
      ].filter((q) => q !== null && q > 0);
      expect(creditados).toEqual([30]);

      expect(
        await testPrisma.stockMovement.count({ where: { type: 'TRANSFER' } })
      ).toBe(1);
      // O agregado permanece intocado mesmo sob concorrência.
      expect((await stockService.getBalance(product.id)).quantity).toBe(50);
      await expect(getDivergences()).resolves.toEqual([]);
    },
    30000
  );

  it(
    'CONCORRÊNCIA: transferências em SENTIDOS OPOSTOS entre as mesmas posições não deadlockam',
    async () => {
      // ESTE é o cenário que a ordem determinística de lock existe para
      // prevenir: A→B e B→A simultâneas travam as MESMAS duas linhas de
      // `stock_position_balances`. Sem ordenar por `storagePositionId`, uma
      // transação pegaria A e esperaria B enquanto a outra segurava B e
      // esperava A — deadlock, que o MySQL resolveria abortando uma delas com
      // ER_LOCK_DEADLOCK (falha intermitente sob carga, o pior modo de falha).
      //
      // Com a ordem crescente de id, as duas pedem a mesma posição primeiro e a
      // segunda simplesmente espera. O resultado esperado é que AS DUAS passem.
      const product = await createTestProduct();
      const user = await createTestUser();
      const { positions } = await createTestPositions(2);
      const [posA, posB] = positions;

      await seedAt(product.id, user.id, posA.id, 100);
      await seedAt(product.id, user.id, posB.id, 100);

      const results = await Promise.allSettled([
        stockService.transfer({
          productId: product.id,
          fromPositionId: posA.id,
          toPositionId: posB.id,
          quantity: 40,
          reason: 'transferência A->B',
          userId: user.id,
        }),
        stockService.transfer({
          productId: product.id,
          fromPositionId: posB.id,
          toPositionId: posA.id,
          quantity: 25,
          reason: 'transferência B->A',
          userId: user.id,
        }),
      ]);

      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );
      // Falha explícita e legível se algum dia voltar a deadlockar.
      expect(rejected.map((r) => String(r.reason))).toEqual([]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);

      // A: 100 - 40 + 25 = 85 | B: 100 + 40 - 25 = 115 | agregado: 200
      expect(await balanceAt(product.id, posA.id)).toBe(85);
      expect(await balanceAt(product.id, posB.id)).toBe(115);
      expect((await stockService.getBalance(product.id)).quantity).toBe(200);
      await expect(getDivergences()).resolves.toEqual([]);
    },
    30000
  );

  it(
    'CONCORRÊNCIA: transferências de PRODUTOS diferentes sobre as mesmas duas posições, em sentidos opostos',
    async () => {
      // Variante mais dura do cenário anterior: com produtos diferentes, as
      // transações NÃO compartilham o lock do agregado (`stock_balances` é por
      // produto), então o lock externo não as serializa. Sobra apenas a ordem
      // por `storagePositionId` para impedir o deadlock — é exatamente esta
      // regra que este teste isola.
      const [productA, productB] = [await createTestProduct(), await createTestProduct()];
      const user = await createTestUser();
      const { positions } = await createTestPositions(2);
      const [posA, posB] = positions;

      await seedAt(productA.id, user.id, posA.id, 60);
      await seedAt(productB.id, user.id, posB.id, 60);

      const results = await Promise.allSettled([
        stockService.transfer({
          productId: productA.id,
          fromPositionId: posA.id,
          toPositionId: posB.id,
          quantity: 20,
          reason: 'produto A: posA -> posB',
          userId: user.id,
        }),
        stockService.transfer({
          productId: productB.id,
          fromPositionId: posB.id,
          toPositionId: posA.id,
          quantity: 15,
          reason: 'produto B: posB -> posA',
          userId: user.id,
        }),
      ]);

      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected'
      );
      expect(rejected.map((r) => String(r.reason))).toEqual([]);

      expect(await balanceAt(productA.id, posA.id)).toBe(40);
      expect(await balanceAt(productA.id, posB.id)).toBe(20);
      expect(await balanceAt(productB.id, posB.id)).toBe(45);
      expect(await balanceAt(productB.id, posA.id)).toBe(15);

      expect((await stockService.getBalance(productA.id)).quantity).toBe(60);
      expect((await stockService.getBalance(productB.id)).quantity).toBe(60);
      await expect(getDivergences()).resolves.toEqual([]);
    },
    30000
  );

  it(
    'CONCORRÊNCIA: transferência e saída (OUT) disputando a mesma posição de origem',
    async () => {
      // A transferência não vive isolada: ela concorre com o fluxo de estoque
      // normal. Aqui uma TRANSFER e um OUT saem da mesma posição, e só há saldo
      // para um — o lock da linha de posição tem de valer para os dois
      // caminhos, que são tipos diferentes dentro do MESMO `applyMovement`.
      const product = await createTestProduct();
      const user = await createTestUser();
      const { positions } = await createTestPositions(2);
      const [origem, destino] = positions;

      await seedAt(product.id, user.id, origem.id, 30);

      const results = await Promise.allSettled([
        stockService.transfer({
          productId: product.id,
          fromPositionId: origem.id,
          toPositionId: destino.id,
          quantity: 20,
          reason: 'transferência concorrente com saída',
          userId: user.id,
        }),
        stockService.registerMovement({
          productId: product.id,
          type: 'OUT',
          quantity: 20,
          reason: 'saída concorrente com transferência',
          userId: user.id,
          fromPositionId: origem.id,
        }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);

      // Em qualquer das duas ordens, a origem fica com 10 e nunca negativa.
      expect(await balanceAt(product.id, origem.id)).toBe(10);

      // E o agregado depende de QUEM passou: a saída o reduz para 10, a
      // transferência o deixa em 30. As duas leituras são válidas; o que não
      // pode acontecer é a soma endereçada ultrapassar o agregado.
      const aggregate = (await stockService.getBalance(product.id)).quantity;
      const destinoQty = (await balanceAt(product.id, destino.id)) ?? 0;
      expect([10, 30]).toContain(aggregate);
      expect(10 + destinoQty).toBeLessThanOrEqual(aggregate);
      await expect(getDivergences()).resolves.toEqual([]);
    },
    30000
  );

  // ------------------------------------------------------------------
  // F2.4 — histórico por posição
  // ------------------------------------------------------------------

  it('getPositionMovements lista a posição como ORIGEM e como DESTINO, com a direção', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(3);
    const [posA, posB, posC] = positions;

    await seedAt(product.id, user.id, posA.id, 100); // IN  -> destino A
    await stockService.transfer({
      productId: product.id,
      fromPositionId: posA.id,
      toPositionId: posB.id,
      quantity: 30,
      reason: 'A -> B',
      userId: user.id,
    });
    await stockService.transfer({
      productId: product.id,
      fromPositionId: posB.id,
      toPositionId: posA.id,
      quantity: 10,
      reason: 'B -> A',
      userId: user.id,
    });
    await stockService.registerMovement({
      productId: product.id,
      type: 'OUT',
      quantity: 5,
      reason: 'saída de A',
      userId: user.id,
      fromPositionId: posA.id,
    });

    const historicoA = await getPositionMovements(posA.id);

    expect(historicoA.position.code).toBe(posA.code);
    // As quatro movimentações tocam A: entrada, saída para B, retorno de B e
    // a saída final. Ordenadas da mais recente para a mais antiga.
    expect(historicoA.movements).toHaveLength(4);
    expect(historicoA.movements.map((m) => [m.type, m.direction])).toEqual([
      ['OUT', 'OUT'],
      ['TRANSFER', 'IN'], // B -> A: A é o destino
      ['TRANSFER', 'OUT'], // A -> B: A é a origem
      ['IN', 'IN'],
    ]);

    // Uma posição que nunca recebeu nada existe e responde com lista vazia —
    // não é 404 (o endereço existe, só nunca foi usado).
    const historicoC = await getPositionMovements(posC.id);
    expect(historicoC.movements).toEqual([]);

    await expect(
      getPositionMovements('00000000-0000-0000-0000-000000000000')
    ).rejects.toThrow(/Posição de armazenagem não encontrada/i);
  });

  it('getMovements do produto aceita o filtro por posição (F2.4)', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(3);
    const [posA, posB, posC] = positions;

    await seedAt(product.id, user.id, posA.id, 50);
    await seedAt(product.id, user.id, posC.id, 50);
    await stockService.transfer({
      productId: product.id,
      fromPositionId: posA.id,
      toPositionId: posB.id,
      quantity: 10,
      reason: 'A -> B',
      userId: user.id,
    });

    // Sem filtro: tudo do produto.
    expect(await stockService.getMovements(product.id)).toHaveLength(3);

    // Com filtro: só o que tocou A (a entrada e a transferência que saiu dali).
    const emA = await stockService.getMovements(product.id, 50, posA.id);
    expect(emA).toHaveLength(2);
    expect(emA.map((m) => m.type).sort()).toEqual(['IN', 'TRANSFER']);

    // Só o que tocou B: a perna de chegada da transferência.
    const emB = await stockService.getMovements(product.id, 50, posB.id);
    expect(emB).toHaveLength(1);
    expect(emB[0].toPosition?.code).toBe(posB.code);
    expect(emB[0].fromPosition?.code).toBe(posA.code);
  });

  it('endereço que só foi DESTINO não pode ser excluído (guarda de histórico, F2.1)', async () => {
    // Antes da Fase 2 a guarda olhava um campo só. Com o par origem/destino,
    // considerar apenas a origem deixaria passar a exclusão de um endereço que
    // nunca foi origem — e o DELETE estouraria na FK como 500 em vez do 409
    // explicativo.
    const product = await createTestProduct();
    const user = await createTestUser();
    const { positions } = await createTestPositions(2);
    const [origem, destino] = positions;

    await seedAt(product.id, user.id, origem.id, 20);
    await stockService.transfer({
      productId: product.id,
      fromPositionId: origem.id,
      toPositionId: destino.id,
      quantity: 20,
      reason: 'esvazia a origem, ocupa o destino',
      userId: user.id,
    });

    const { deletePosition } = await import('../../src/services/storage-position.service');

    // Com saldo, a primeira guarda (saldo) é quem barra — comportamento da
    // Fase 1, inalterado.
    await expect(deletePosition(destino.id)).rejects.toThrow(
      /saldo de estoque registrado/i
    );

    // Zera as LINHAS de saldo para isolar a segunda guarda. `destino` nunca foi
    // ORIGEM de nada: ele só aparece em `toPositionId`. É exatamente o caso que
    // a versão anterior da guarda (que olhava um campo só) deixaria passar.
    await testPrisma.stockPositionBalance.deleteMany({});

    await expect(deletePosition(destino.id)).rejects.toThrow(
      /histórico de movimentação/i
    );
    await expect(deletePosition(origem.id)).rejects.toThrow(
      /histórico de movimentação/i
    );

    // E a mensagem nomeia o endereço certo, não um vizinho.
    await expect(deletePosition(destino.id)).rejects.toThrow(destino.code);
  });
});
