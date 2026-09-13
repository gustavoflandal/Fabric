import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import {
  createTestCustomer,
  createTestPositions,
  createTestProduct,
  createUserWithPermissions,
  setTestLicensedModule,
} from '../helpers/fixtures';
import { seedStock } from '../helpers/wms-fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

/**
 * EXPEDIÇÃO — o ciclo inteiro contra o MySQL real:
 *
 *   Pedido de Venda (DRAFT) → confirma → Romaneio (PENDING) → separação
 *   (SEPARATING, tarefas de PICKING criadas) → execução das tarefas (é AQUI que
 *   o estoque se move) → despacho (DISPATCHED, só status).
 *
 * O QUE ESTES TESTES EXISTEM PARA PROVAR, além do caminho feliz:
 *
 *   1. A tarefa de picking do romaneio nasce com
 *      (`referenceType` = 'SHIPMENT', `reference` = shipment.id) — o par que a
 *      generalização de `createPickingTasks` introduziu.
 *   2. A BAIXA DE ESTOQUE acontece UMA vez, na execução da tarefa, e o despacho
 *      NÃO cria um segundo `StockMovement`. Esta é a decisão de desenho central
 *      do módulo e a mais fácil de quebrar sem perceber.
 *   3. O despacho é BARRADO enquanto sobrar tarefa aberta.
 *   4. A expedição PARCIAL não fecha o pedido.
 *
 * O caminho de picking de PRODUÇÃO, que compartilha o mesmo mecanismo, continua
 * coberto por `wms-picking-tasks.test.ts` — inalterado de propósito: é a
 * verificação de não-regressão da generalização.
 *
 * `clearLicensedModuleCache()` no beforeEach/afterEach é obrigatório: o cache de
 * licença vive no módulo e sobrevive ao `cleanDatabase()`.
 */

const EXPEDICAO_PERMISSIONS = [
  { resource: 'pedidos_venda', action: 'visualizar' },
  { resource: 'pedidos_venda', action: 'criar' },
  { resource: 'pedidos_venda', action: 'editar' },
  { resource: 'pedidos_venda', action: 'confirmar' },
  { resource: 'pedidos_venda', action: 'cancelar' },
  { resource: 'expedicao', action: 'visualizar' },
  { resource: 'expedicao', action: 'criar' },
  { resource: 'expedicao', action: 'separar' },
  { resource: 'expedicao', action: 'despachar' },
  { resource: 'expedicao', action: 'cancelar' },
  // A execução da tarefa de picking é do WMS — o mesmo endpoint que a produção
  // já usa.
  { resource: 'tarefas_armazem', action: 'visualizar' },
  { resource: 'tarefas_armazem', action: 'executar' },
  { resource: 'stock', action: 'read' },
  { resource: 'stock', action: 'update' },
];

const login = async () => {
  const user = await createUserWithPermissions(EXPEDICAO_PERMISSIONS);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return { user, token: res.body.data.accessToken as string };
};

const api = (token: string) => ({
  createOrder: (body: object) =>
    request(app)
      .post('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${token}`)
      .send(body),
  confirmOrder: (id: string) =>
    request(app).post(`/api/v1/sales-orders/${id}/confirm`).set('Authorization', `Bearer ${token}`),
  createShipment: (body: object) =>
    request(app).post('/api/v1/shipments').set('Authorization', `Bearer ${token}`).send(body),
  getShipment: (id: string) =>
    request(app).get(`/api/v1/shipments/${id}`).set('Authorization', `Bearer ${token}`),
  startSeparation: (id: string) =>
    request(app)
      .post(`/api/v1/shipments/${id}/start-separation`)
      .set('Authorization', `Bearer ${token}`),
  dispatch: (id: string) =>
    request(app).post(`/api/v1/shipments/${id}/dispatch`).set('Authorization', `Bearer ${token}`),
  cancelShipment: (id: string) =>
    request(app).post(`/api/v1/shipments/${id}/cancel`).set('Authorization', `Bearer ${token}`),
  executeTask: (taskId: string) =>
    request(app)
      .post(`/api/v1/warehouse-tasks/${taskId}/execute`)
      .set('Authorization', `Bearer ${token}`)
      .send({}),
});

/**
 * Cenário base: um cliente, um armazém com uma posição cheia e um produto
 * endereçado. Devolve tudo o que os testes precisam referenciar.
 */
const setupScenario = async (stockQty = 500) => {
  const customer = await createTestCustomer();
  const product = await createTestProduct();
  const { warehouse, positions } = await createTestPositions(1);
  await seedStock(product.id, [{ positionId: positions[0].id, quantity: stockQty }]);

  return { customer, product, warehouse, position: positions[0] };
};

describe('Integração: Expedição (pedido de venda → romaneio → separação → despacho)', () => {
  beforeEach(async () => {
    // A separação do romaneio executa tarefas do WMS, então os DOIS módulos
    // precisam estar licenciados — é a dependência real registrada em
    // `shipment.service.ts`.
    await setTestLicensedModule('EXPEDICAO', true);
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

  // ==========================================================================
  // O CICLO COMPLETO, com 1 item e quantidade cheia.
  // ==========================================================================
  it('percorre o ciclo inteiro e debita o estoque UMA vez, na execução da tarefa', async () => {
    const { token } = await login();
    const client = api(token);
    const { customer, product, warehouse, position } = await setupScenario(500);

    // ---- 1. Pedido DRAFT -----------------------------------------------
    const created = await client.createOrder({
      customerId: customer.id,
      warehouseId: warehouse.id,
      items: [{ productId: product.id, quantity: 100, unitPrice: 2.5 }],
    });

    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('DRAFT');
    // Numeração emitida pela sequência atômica, nunca pelo cliente.
    expect(created.body.data.orderNumber).toMatch(/^PV-\d{4}-\d{4,}$/);
    expect(created.body.data.totalValue).toBe(250);
    expect(created.body.data.items).toHaveLength(1);
    expect(created.body.data.items[0].totalPrice).toBe(250);
    expect(created.body.data.items[0].shippedQty).toBe(0);

    const orderId = created.body.data.id as string;
    const orderItemId = created.body.data.items[0].id as string;

    // ---- 2. Confirmação -------------------------------------------------
    const confirmed = await client.confirmOrder(orderId);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('CONFIRMED');

    // ---- 3. Romaneio ----------------------------------------------------
    const shipmentRes = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: orderItemId, quantity: 100 }],
    });

    expect(shipmentRes.status).toBe(201);
    expect(shipmentRes.body.data.status).toBe('PENDING');
    expect(shipmentRes.body.data.shipmentNumber).toMatch(/^EXP-\d{4}-\d{4,}$/);
    // O armazém é HERDADO do pedido, não veio do payload.
    expect(shipmentRes.body.data.warehouseId).toBe(warehouse.id);

    const shipmentId = shipmentRes.body.data.id as string;

    // ---- 4. Separação: cria tarefa, NÃO move estoque ---------------------
    const separation = await client.startSeparation(shipmentId);

    expect(separation.status).toBe(200);
    expect(separation.body.data.status).toBe('SEPARATING');
    expect(separation.body.data.pickingTasks).toHaveLength(1);

    const tasks = await testPrisma.warehouseTask.findMany();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe('PICKING');
    expect(tasks[0].status).toBe('PENDING');
    // O PAR QUE A GENERALIZAÇÃO DE `createPickingTasks` INTRODUZIU.
    expect(tasks[0].referenceType).toBe('SHIPMENT');
    expect(tasks[0].reference).toBe(shipmentId);
    expect(tasks[0].fromPositionId).toBe(position.id);
    expect(tasks[0].quantity?.toString()).toBe('100');

    // Planejar separação não debita nada.
    expect(await testPrisma.stockMovement.count()).toBe(0);

    // O pedido acompanha o romaneio.
    const orderAfterSeparation = await testPrisma.salesOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(orderAfterSeparation.status).toBe('SEPARATING');

    // ---- 5. Execução da tarefa: É AQUI QUE O ESTOQUE SE MOVE -------------
    const execution = await client.executeTask(tasks[0].id);
    expect(execution.status).toBe(200);
    expect(execution.body.data.task.status).toBe('COMPLETED');

    const movements = await testPrisma.stockMovement.findMany();
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('OUT');
    expect(movements[0].quantity).toBe(100);
    expect(movements[0].fromPositionId).toBe(position.id);
    expect(movements[0].toPositionId).toBeNull();
    expect(movements[0].referenceType).toBe('SHIPMENT');
    // A referência é o NÚMERO legível do romaneio, não o id.
    expect(movements[0].reference).toBe(shipmentRes.body.data.shipmentNumber);
    expect(movements[0].reason).toBe('Separação para expedição');

    const balance = await testPrisma.stockBalance.findUniqueOrThrow({
      where: { productId: product.id },
    });
    expect(balance.quantity).toBe(400);

    const positionBalance = await testPrisma.stockPositionBalance.findFirstOrThrow({
      where: { productId: product.id },
    });
    expect(positionBalance.quantity.toString()).toBe('400');

    // ---- 6. Despacho: SÓ status, NENHUM movimento novo -------------------
    const dispatched = await client.dispatch(shipmentId);

    expect(dispatched.status).toBe(200);
    expect(dispatched.body.data.status).toBe('DISPATCHED');
    expect(dispatched.body.data.dispatchedAt).not.toBeNull();
    expect(dispatched.body.data.salesOrderStatus).toBe('SHIPPED');

    // A INVARIANTE CENTRAL DO MÓDULO: continua UM movimento só.
    expect(await testPrisma.stockMovement.count()).toBe(1);

    const finalItem = await testPrisma.salesOrderItem.findUniqueOrThrow({
      where: { id: orderItemId },
    });
    expect(finalItem.shippedQty).toBe(100);
    expect(finalItem.pickedQty).toBe(100);

    const finalOrder = await testPrisma.salesOrder.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(finalOrder.status).toBe('SHIPPED');
  }, 30000);

  // ==========================================================================
  // O GATE DO DESPACHO.
  // ==========================================================================
  it('recusa o despacho enquanto sobrar tarefa de separação aberta', async () => {
    const { token } = await login();
    const client = api(token);
    const { customer, warehouse, position } = await setupScenario(0);

    // Dois produtos, um por item — dá duas tarefas de picking independentes.
    const productA = await createTestProduct();
    const productB = await createTestProduct();
    await seedStock(productA.id, [{ positionId: position.id, quantity: 200 }]);
    await seedStock(productB.id, [{ positionId: position.id, quantity: 200 }]);

    const created = await client.createOrder({
      customerId: customer.id,
      warehouseId: warehouse.id,
      items: [
        { productId: productA.id, quantity: 10, unitPrice: 1 },
        { productId: productB.id, quantity: 20, unitPrice: 1 },
      ],
    });
    expect(created.status).toBe(201);

    const orderId = created.body.data.id as string;
    await client.confirmOrder(orderId).expect(200);

    const shipmentRes = await client.createShipment({
      salesOrderId: orderId,
      items: created.body.data.items.map((item: { id: string; quantity: number }) => ({
        salesOrderItemId: item.id,
        quantity: item.quantity,
      })),
    });
    expect(shipmentRes.status).toBe(201);
    const shipmentId = shipmentRes.body.data.id as string;

    await client.startSeparation(shipmentId).expect(200);

    const tasks = await testPrisma.warehouseTask.findMany({ orderBy: { createdAt: 'asc' } });
    expect(tasks).toHaveLength(2);

    // Só UMA das duas é executada.
    await client.executeTask(tasks[0].id).expect(200);

    const blocked = await client.dispatch(shipmentId);
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/1 de 2 tarefa/);

    // O romaneio continua em separação e o pedido não avançou.
    const stillSeparating = await testPrisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    expect(stillSeparating.status).toBe('SEPARATING');
    expect(stillSeparating.dispatchedAt).toBeNull();

    // Nenhum `shippedQty` foi tocado por um despacho que não aconteceu.
    const items = await testPrisma.salesOrderItem.findMany({ where: { orderId } });
    expect(items.every((item) => item.shippedQty === 0)).toBe(true);

    // Concluída a segunda, o despacho passa.
    await client.executeTask(tasks[1].id).expect(200);

    const ok = await client.dispatch(shipmentId);
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('DISPATCHED');
    expect(ok.body.data.salesOrderStatus).toBe('SHIPPED');
    // Um movimento por tarefa, e nenhum a mais pelo despacho.
    expect(await testPrisma.stockMovement.count()).toBe(2);
  }, 30000);

  // ==========================================================================
  // EXPEDIÇÃO PARCIAL — o pedido NÃO fecha.
  // ==========================================================================
  it('expedição parcial não fecha o pedido e libera o restante para outro romaneio', async () => {
    const { token } = await login();
    const client = api(token);
    const { customer, product, warehouse } = await setupScenario(500);

    const created = await client.createOrder({
      customerId: customer.id,
      warehouseId: warehouse.id,
      items: [{ productId: product.id, quantity: 100, unitPrice: 1 }],
    });
    const orderId = created.body.data.id as string;
    const orderItemId = created.body.data.items[0].id as string;

    await client.confirmOrder(orderId).expect(200);

    // Romaneio de 60 das 100.
    const first = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: orderItemId, quantity: 60 }],
    });
    expect(first.status).toBe(201);
    const firstId = first.body.data.id as string;

    await client.startSeparation(firstId).expect(200);
    const task = await testPrisma.warehouseTask.findFirstOrThrow();
    await client.executeTask(task.id).expect(200);

    const dispatched = await client.dispatch(firstId);
    expect(dispatched.status).toBe(200);
    // NÃO é SHIPPED: faltam 40.
    expect(dispatched.body.data.salesOrderStatus).toBe('SEPARATING');

    const item = await testPrisma.salesOrderItem.findUniqueOrThrow({ where: { id: orderItemId } });
    expect(item.shippedQty).toBe(60);
    expect(item.quantity).toBe(100);

    const order = await testPrisma.salesOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('SEPARATING');

    // O saldo restante do item é 40 — pedir 41 tem de ser recusado.
    const tooMuch = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: orderItemId, quantity: 41 }],
    });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.message).toMatch(/indispon[íi]vel/i);

    // 40 exatos passam, e o pedido fecha ao despachar.
    const second = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: orderItemId, quantity: 40 }],
    });
    expect(second.status).toBe(201);
    const secondId = second.body.data.id as string;

    await client.startSeparation(secondId).expect(200);
    const secondTask = await testPrisma.warehouseTask.findFirstOrThrow({
      where: { reference: secondId },
    });
    await client.executeTask(secondTask.id).expect(200);

    const finalDispatch = await client.dispatch(secondId);
    expect(finalDispatch.status).toBe(200);
    expect(finalDispatch.body.data.salesOrderStatus).toBe('SHIPPED');

    const finalOrder = await testPrisma.salesOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(finalOrder.status).toBe('SHIPPED');
  }, 30000);

  // ==========================================================================
  // ROMANEIO ABERTO JÁ RESERVA QUANTIDADE.
  // ==========================================================================
  it('romaneio ainda não despachado já reserva a quantidade do item', async () => {
    const { token } = await login();
    const client = api(token);
    const { customer, product, warehouse } = await setupScenario(500);

    const created = await client.createOrder({
      customerId: customer.id,
      warehouseId: warehouse.id,
      items: [{ productId: product.id, quantity: 100, unitPrice: 1 }],
    });
    const orderId = created.body.data.id as string;
    const orderItemId = created.body.data.items[0].id as string;
    await client.confirmOrder(orderId).expect(200);

    await client
      .createShipment({
        salesOrderId: orderId,
        items: [{ salesOrderItemId: orderItemId, quantity: 70 }],
      })
      .expect(201);

    // Nada foi expedido ainda (shippedQty = 0), mas 70 já estão prometidos:
    // pedir mais 40 tem de falhar, não "caber" nas 100 do pedido.
    const second = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: orderItemId, quantity: 40 }],
    });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/em romaneios abertos 70/);

    // 30 cabem.
    await client
      .createShipment({
        salesOrderId: orderId,
        items: [{ salesOrderItemId: orderItemId, quantity: 30 }],
      })
      .expect(201);
  }, 30000);

  // ==========================================================================
  // SALDO INSUFICIENTE: TUDO OU NADA.
  // ==========================================================================
  it('não cria tarefa nenhuma quando falta saldo endereçado para um dos itens', async () => {
    const { token } = await login();
    const client = api(token);
    const { customer, warehouse, position } = await setupScenario(0);

    const ok = await createTestProduct();
    const short = await createTestProduct();
    await seedStock(ok.id, [{ positionId: position.id, quantity: 100 }]);
    // `short` tem saldo AGREGADO mas nada endereçado — o estado de quem ainda
    // não endereçou o estoque legado.
    await testPrisma.stockBalance.create({ data: { productId: short.id, quantity: 100 } });

    const created = await client.createOrder({
      customerId: customer.id,
      warehouseId: warehouse.id,
      items: [
        { productId: ok.id, quantity: 10, unitPrice: 1 },
        { productId: short.id, quantity: 10, unitPrice: 1 },
      ],
    });
    const orderId = created.body.data.id as string;
    await client.confirmOrder(orderId).expect(200);

    const shipmentRes = await client.createShipment({
      salesOrderId: orderId,
      items: created.body.data.items.map((item: { id: string; quantity: number }) => ({
        salesOrderItemId: item.id,
        quantity: item.quantity,
      })),
    });
    const shipmentId = shipmentRes.body.data.id as string;

    const res = await client.startSeparation(shipmentId);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Saldo endereçado insuficiente/);

    // TUDO OU NADA: nem a tarefa do item que tinha saldo foi criada, e o
    // romaneio continua PENDENTE.
    expect(await testPrisma.warehouseTask.count()).toBe(0);
    const shipment = await testPrisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(shipment.status).toBe('PENDING');
  }, 30000);

  // ==========================================================================
  // CANCELAMENTO.
  // ==========================================================================
  it('cancelar o romaneio cancela as tarefas de separação ainda abertas', async () => {
    const { token } = await login();
    const client = api(token);
    const { customer, product, warehouse } = await setupScenario(500);

    const created = await client.createOrder({
      customerId: customer.id,
      warehouseId: warehouse.id,
      items: [{ productId: product.id, quantity: 50, unitPrice: 1 }],
    });
    const orderId = created.body.data.id as string;
    await client.confirmOrder(orderId).expect(200);

    const shipmentRes = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: created.body.data.items[0].id, quantity: 50 }],
    });
    const shipmentId = shipmentRes.body.data.id as string;
    await client.startSeparation(shipmentId).expect(200);

    const cancelled = await client.cancelShipment(shipmentId);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    // A tarefa não pode continuar de pé: um operador a concluiria depois e o
    // `applyMovement` debitaria estoque para um romaneio que não existe mais.
    const tasks = await testPrisma.warehouseTask.findMany();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('CANCELLED');

    // Nada foi movimentado.
    expect(await testPrisma.stockMovement.count()).toBe(0);

    // Despachar um romaneio cancelado é recusado.
    const dispatched = await client.dispatch(shipmentId);
    expect(dispatched.status).toBe(400);
  }, 30000);

  // ==========================================================================
  // GUARDAS DE STATUS.
  // ==========================================================================
  it('recusa romaneio de pedido em RASCUNHO e confirmação repetida', async () => {
    const { token } = await login();
    const client = api(token);
    const { customer, product, warehouse } = await setupScenario(100);

    const created = await client.createOrder({
      customerId: customer.id,
      warehouseId: warehouse.id,
      items: [{ productId: product.id, quantity: 10, unitPrice: 1 }],
    });
    const orderId = created.body.data.id as string;
    const orderItemId = created.body.data.items[0].id as string;

    const tooEarly = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: orderItemId, quantity: 10 }],
    });
    expect(tooEarly.status).toBe(400);
    expect(tooEarly.body.message).toMatch(/CONFIRMADO ou em SEPARA/);

    await client.confirmOrder(orderId).expect(200);

    const again = await client.confirmOrder(orderId);
    expect(again.status).toBe(400);
  }, 30000);

  // ==========================================================================
  // MÓDULO NÃO LICENCIADO.
  // ==========================================================================
  it('as rotas de expedição não existem (404) sem o módulo licenciado', async () => {
    await setTestLicensedModule('EXPEDICAO', false);
    clearLicensedModuleCache();

    const { token } = await login();

    const orders = await request(app)
      .get('/api/v1/sales-orders')
      .set('Authorization', `Bearer ${token}`);
    expect(orders.status).toBe(404);

    const shipments = await request(app)
      .get('/api/v1/shipments')
      .set('Authorization', `Bearer ${token}`);
    expect(shipments.status).toBe(404);
  });
});
