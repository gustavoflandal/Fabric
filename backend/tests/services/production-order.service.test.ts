import productionOrderService from '../../src/services/production-order.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestProduct, createTestUser } from '../helpers/fixtures';

// Fase 4 do cronograma, item 4.2: lock otimista via campo `version` -
// diferente dos locks pessimistas (SELECT ... FOR UPDATE) das Fases 1/3,
// que protegem contra duas requisições concorrentes na mesma janela de
// tempo, isso protege contra "lost update": um cliente que carregou o
// registro, ficou um tempo com a tela aberta, e salva por cima de uma
// mudança que outra pessoa já fez nesse meio-tempo.

describe('production-order.service - lock otimista (Fase 4, item 4.2)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  async function createOrder() {
    const product = await createTestProduct();
    const user = await createTestUser();
    return testPrisma.productionOrder.create({
      data: {
        orderNumber: `OP-TEST-${Date.now()}`,
        productId: product.id,
        quantity: 10,
        scheduledStart: new Date(),
        scheduledEnd: new Date(Date.now() + 86400000),
        createdBy: user.id,
      },
    });
  }

  it('update() sem version informado continua funcionando (compatibilidade) e incrementa version', async () => {
    const order = await createOrder();

    const updated = await productionOrderService.update(order.id, { priority: 8 });

    expect(updated?.priority).toBe(8);

    const dbOrder = await testPrisma.productionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(dbOrder.version).toBe(1);
  });

  it('update() com version correto aplica a mudança e incrementa version', async () => {
    const order = await createOrder();
    expect(order.version).toBe(0);

    const updated = await productionOrderService.update(order.id, { priority: 9, version: 0 });

    expect(updated?.priority).toBe(9);

    const dbOrder = await testPrisma.productionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(dbOrder.version).toBe(1);
  });

  it('update() com version desatualizado (alguém mudou antes) é rejeitado com 409', async () => {
    const order = await createOrder();

    // Simula outra pessoa salvando primeiro
    await productionOrderService.update(order.id, { priority: 7 });

    // Cliente que carregou a versão original (0) tenta salvar por cima
    await expect(
      productionOrderService.update(order.id, { priority: 3, version: 0 })
    ).rejects.toMatchObject({ statusCode: 409 });

    // A mudança da "outra pessoa" não foi sobrescrita
    const dbOrder = await testPrisma.productionOrder.findUniqueOrThrow({ where: { id: order.id } });
    expect(dbOrder.priority).toBe(7);
  });

  it('update() com version num registro inexistente retorna 404, não 409', async () => {
    await expect(
      productionOrderService.update('00000000-0000-0000-0000-000000000000', { priority: 1, version: 0 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
