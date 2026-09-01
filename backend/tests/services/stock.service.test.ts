import stockService from '../../src/services/stock.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestProduct, createTestUser } from '../helpers/fixtures';

// Fase 3 do cronograma, item 3.2: cobre a race condition de estoque
// corrigida na Fase 1 (docs/fase-2026-09-modernizacao/02_CRONOGRAMA_IMPLEMENTACOES.md,
// itens 1.1/1.2) - antes o saldo era somado em memória a cada chamada, sem
// nenhuma linha para travar, e movimentações concorrentes do mesmo produto
// podiam ler o mesmo saldo desatualizado e ambas decidir que havia estoque
// suficiente. Sem esses testes, um refactor futuro poderia reintroduzir o
// mesmo bug sem que ninguém percebesse até acontecer em produção de novo.

describe('stock.service (Fase 3, item 3.2)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('registerMovement IN cria saldo e movimentação corretos', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();

    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 100,
      reason: 'teste',
      userId: user.id,
    });

    const balance = await stockService.getBalance(product.id);
    expect(balance.quantity).toBe(100);
  });

  it('registerMovement OUT rejeita quando não há estoque suficiente', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();

    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 10,
      reason: 'entrada inicial',
      userId: user.id,
    });

    await expect(
      stockService.registerMovement({
        productId: product.id,
        type: 'OUT',
        quantity: 11,
        reason: 'saída maior que o saldo',
        userId: user.id,
      })
    ).rejects.toThrow(/insuficiente/i);

    const balance = await stockService.getBalance(product.id);
    expect(balance.quantity).toBe(10); // saldo não pode ter mudado
  });

  it(
    'CONCORRÊNCIA: N saídas simultâneas nunca deixam o saldo negativo, mesmo pedindo mais que o total disponível',
    async () => {
      const product = await createTestProduct();
      const user = await createTestUser();

      await stockService.registerMovement({
        productId: product.id,
        type: 'IN',
        quantity: 100,
        reason: 'entrada inicial',
        userId: user.id,
      });

      // 5 saídas de 30 disparadas em paralelo contra um saldo de 100
      // (150 solicitado no total) - matematicamente só 3 podem caber.
      const attempts = Array.from({ length: 5 }, (_, i) =>
        stockService.registerMovement({
          productId: product.id,
          type: 'OUT',
          quantity: 30,
          reason: `saída concorrente ${i}`,
          userId: user.id,
        })
      );

      const results = await Promise.allSettled(attempts);
      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(succeeded).toHaveLength(3);
      expect(failed).toHaveLength(2);

      const balance = await stockService.getBalance(product.id);
      expect(balance.quantity).toBe(10); // 100 - 3*30, nunca negativo
      expect(balance.quantity).toBeGreaterThanOrEqual(0);

      // Confere contra o histórico de movimentações também, não só o saldo
      // persistido - garante que não houve "saída fantasma" registrada.
      const movements = await testPrisma.stockMovement.findMany({ where: { productId: product.id } });
      const outCount = movements.filter((m) => m.type === 'OUT').length;
      expect(outCount).toBe(3);
    },
    20000
  );

  it('adjustStock ajusta o saldo para a quantidade informada (para cima e para baixo)', async () => {
    const product = await createTestProduct();
    const user = await createTestUser();

    await stockService.registerMovement({
      productId: product.id,
      type: 'IN',
      quantity: 50,
      reason: 'entrada inicial',
      userId: user.id,
    });

    await stockService.adjustStock(product.id, 80, 'contagem encontrou mais', user.id);
    expect((await stockService.getBalance(product.id)).quantity).toBe(80);

    await stockService.adjustStock(product.id, 20, 'contagem encontrou menos', user.id);
    expect((await stockService.getBalance(product.id)).quantity).toBe(20);
  });
});
