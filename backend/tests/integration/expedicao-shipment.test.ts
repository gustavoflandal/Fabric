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
  { resource: 'pedidos_venda', action: 'excluir' },
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
  cancelOrder: (id: string) =>
    request(app)
      .post(`/api/v1/sales-orders/${id}/cancel`)
      .set('Authorization', `Bearer ${token}`),
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

  it('cancelar o PEDIDO cascateia até os romaneios abertos e as tarefas deles', async () => {
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

    const cancelled = await request(app)
      .post(`/api/v1/sales-orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');

    // Sem a cascata, este romaneio continuaria separável e despacharia material
    // de um pedido que não existe mais — e a tarefa aberta debitaria estoque de
    // verdade na conclusão.
    const shipment = await testPrisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(shipment.status).toBe('CANCELLED');

    const tasks = await testPrisma.warehouseTask.findMany();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('CANCELLED');

    expect(await testPrisma.stockMovement.count()).toBe(0);
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
  // CONCORRÊNCIA (correções pós-revisão, achado 1).
  //
  // O padrão é o de `stock-concurrency.test.ts`: as requisições saem juntas num
  // `Promise.all` contra a pilha HTTP inteira, cada uma na sua própria
  // transação do MySQL real — é o duplo clique no botão, reproduzido.
  //
  // SÃO 5 CHAMADAS, E NÃO 2 (reforço pós-revisão). Com duas, o event loop pode
  // serializá-las por acaso: a segunda só sai depois de a primeira ter
  // commitado, cai no guard normal (400) e o teste passa igual contra o código
  // pré-correção — falso NEGATIVO. Cinco disparos tornam a sobreposição real
  // muito provável. O valor probatório continua nas asserções de INVARIANTE do
  // fim (contagem de tarefas, `shippedQty`, `StockMovement`), não no fato de
  // alguém ter tomado 400.
  // ==========================================================================
  const CONCURRENT_CALLS = 5;

  it('chamadas concorrentes a start-separation criam UM conjunto de tarefas só', async () => {
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

    const shipmentRes = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: orderItemId, quantity: 100 }],
    });
    const shipmentId = shipmentRes.body.data.id as string;

    // TODAS AO MESMO TEMPO. Antes da correção, todas liam `PENDING` antes de
    // qualquer uma escrever e cada uma criava um conjunto COMPLETO de tarefas.
    const results = await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, () => client.startSeparation(shipmentId))
    );

    const winners = results.filter((res) => res.status === 200);
    const losers = results.filter((res) => res.status !== 200);
    expect(winners).toHaveLength(1);
    expect(losers.map((res) => res.status)).toEqual(
      Array(CONCURRENT_CALLS - 1).fill(400)
    );

    for (const loser of losers) {
      expect(loser.body.message).toMatch(/romaneio PENDENTE/);
    }

    // O PONTO DO TESTE: UMA tarefa, não duas. Duas fariam o romaneio de 100
    // unidades debitar 200 quando ambas fossem executadas.
    const tasks = await testPrisma.warehouseTask.findMany();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].quantity?.toString()).toBe('100');

    const shipment = await testPrisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(shipment.status).toBe('SEPARATING');

    // E a prova física: executar tudo o que existe debita 100, não 200.
    for (const task of tasks) {
      await client.executeTask(task.id).expect(200);
    }

    const balance = await testPrisma.stockBalance.findUniqueOrThrow({
      where: { productId: product.id },
    });
    expect(balance.quantity).toBe(400);
  }, 40000);

  it('romaneios concorrentes não somam mais que o saldo do item', async () => {
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

    // 60 cada, num pedido de 100: SÓ UM cabe. A validação de disponibilidade
    // rodava FORA da `$transaction`: todas liam "nenhum romaneio aberto", todas
    // concluíam que cabia, e o pedido de 100 acabava com 300 prometidos.
    const results = await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, () =>
        client.createShipment({
          salesOrderId: orderId,
          items: [{ salesOrderItemId: orderItemId, quantity: 60 }],
        })
      )
    );

    const winners = results.filter((res) => res.status === 201);
    const losers = results.filter((res) => res.status !== 201);
    expect(winners).toHaveLength(1);
    expect(losers.map((res) => res.status)).toEqual(
      Array(CONCURRENT_CALLS - 1).fill(400)
    );

    for (const loser of losers) {
      expect(loser.body.message).toMatch(/indispon[íi]vel/i);
    }

    const shipments = await testPrisma.shipment.findMany({ where: { salesOrderId: orderId } });
    expect(shipments).toHaveLength(1);

    // E a numeração não queimou/duplicou: o romaneio que sobrou tem número
    // próprio e único.
    expect(shipments[0].shipmentNumber).toMatch(/^EXP-\d{4}-\d{4,}$/);
  }, 40000);

  it('despachos concorrentes incrementam shippedQty UMA vez só', async () => {
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

    const shipmentRes = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: orderItemId, quantity: 100 }],
    });
    const shipmentId = shipmentRes.body.data.id as string;

    await client.startSeparation(shipmentId).expect(200);
    const task = await testPrisma.warehouseTask.findFirstOrThrow();
    await client.executeTask(task.id).expect(200);

    const results = await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, () => client.dispatch(shipmentId))
    );

    const winners = results.filter((res) => res.status === 200);
    expect(winners).toHaveLength(1);
    expect(results.filter((res) => res.status !== 200).map((res) => res.status)).toEqual(
      Array(CONCURRENT_CALLS - 1).fill(400)
    );

    // Antes da correção o `increment` rodava ANTES da escrita do status e o
    // `update` final não reconferia status nenhum: o item fechava com 500.
    const item = await testPrisma.salesOrderItem.findUniqueOrThrow({
      where: { id: orderItemId },
    });
    expect(item.shippedQty).toBe(100);
    expect(item.pickedQty).toBe(100);

    // E nenhum movimento extra: o despacho nunca movimenta estoque.
    expect(await testPrisma.stockMovement.count()).toBe(1);
  }, 40000);

  // ==========================================================================
  // CONCORRÊNCIA DO CANCELAMENTO (correções da SEGUNDA revisão, R1 e R2).
  //
  // Os dois `cancel()` ficaram para trás quando o resto do módulo passou a
  // reivindicar a transição atomicamente: liam um snapshot, validavam em
  // memória e escreviam sem condição de status. Estes dois testes fixam a
  // invariante de cada um.
  // ==========================================================================
  it('cancelar e despachar o MESMO romaneio ao mesmo tempo: exatamente um efeito vence', async () => {
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

    const shipmentRes = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: orderItemId, quantity: 100 }],
    });
    const shipmentId = shipmentRes.body.data.id as string;

    await client.startSeparation(shipmentId).expect(200);
    const task = await testPrisma.warehouseTask.findFirstOrThrow();
    await client.executeTask(task.id).expect(200);
    expect(await testPrisma.stockMovement.count()).toBe(1);

    // O romaneio agora é despachável. O `cancel` sai JUNTO com o `dispatch`:
    // sem o claim atômico, o `update` final do `cancel` — sem condição de
    // status — sobrescrevia `DISPATCHED` → `CANCELLED` depois de `shippedQty`
    // já ter sido incrementado de verdade.
    const [dispatchRes, cancelRes] = await Promise.all([
      client.dispatch(shipmentId),
      client.cancelShipment(shipmentId),
    ]);

    const shipment = await testPrisma.shipment.findUniqueOrThrow({
      where: { id: shipmentId },
    });
    const item = await testPrisma.salesOrderItem.findUniqueOrThrow({
      where: { id: orderItemId },
    });

    // A INVARIANTE: um dos dois efeitos, nunca os dois, nunca nenhum.
    expect([dispatchRes.status, cancelRes.status].filter((s) => s === 200)).toHaveLength(1);

    if (shipment.status === 'DISPATCHED') {
      expect(dispatchRes.status).toBe(200);
      expect(cancelRes.status).toBe(400);
      expect(shipment.dispatchedAt).not.toBeNull();
      expect(item.shippedQty).toBe(100);
      expect(item.pickedQty).toBe(100);
    } else {
      expect(shipment.status).toBe('CANCELLED');
      expect(cancelRes.status).toBe(200);
      expect(dispatchRes.status).toBe(400);
      expect(shipment.dispatchedAt).toBeNull();
      // Cancelado significa NÃO expedido: nada pode ter sido acumulado.
      expect(item.shippedQty).toBe(0);
    }

    // De qualquer forma, o despacho nunca movimenta estoque: continua o único
    // movimento, o da execução da tarefa.
    expect(await testPrisma.stockMovement.count()).toBe(1);
  }, 40000);

  it('cancelar o PEDIDO enquanto nasce um romaneio novo nunca deixa romaneio órfão vivo', async () => {
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

    // O cancelamento do pedido lia os romaneios FORA de qualquer transação e
    // cascateava só os que enxergava naquele instante: um romaneio criado entre
    // a leitura e o commit ficava vivo em `PENDING`, apontando para um pedido
    // `CANCELLED` — separável e despachável.
    const [cancelRes, createRes] = await Promise.all([
      client.cancelOrder(orderId),
      client.createShipment({
        salesOrderId: orderId,
        items: [{ salesOrderItemId: orderItemId, quantity: 60 }],
      }),
    ]);

    const order = await testPrisma.salesOrder.findUniqueOrThrow({ where: { id: orderId } });
    const shipments = await testPrisma.shipment.findMany({ where: { salesOrderId: orderId } });

    if (order.status === 'CANCELLED') {
      expect(cancelRes.status).toBe(200);
      // A INVARIANTE: nenhum romaneio ABERTO sobra apontando para o pedido
      // cancelado. Ou o `create` foi recusado (nenhum romaneio existe), ou ele
      // nasceu antes e foi alcançado pela cascata.
      expect(shipments.every((s) => s.status === 'CANCELLED')).toBe(true);
      if (createRes.status === 201) {
        expect(shipments).toHaveLength(1);
      } else {
        expect(createRes.status).toBe(400);
        expect(shipments).toHaveLength(0);
      }
    } else {
      // O outro desfecho aceitável: o romaneio nasceu e o cancelamento do
      // pedido foi RECUSADO — nunca cancelado pela metade.
      expect(order.status).toBe('CONFIRMED');
      expect(cancelRes.status).toBe(400);
      expect(createRes.status).toBe(201);
      expect(shipments.some((s) => s.status === 'PENDING')).toBe(true);
    }

    // Nenhum dos dois caminhos movimenta estoque.
    expect(await testPrisma.stockMovement.count()).toBe(0);
  }, 40000);

  // ==========================================================================
  // CANCELAMENTO COM TAREFA JÁ CONCLUÍDA (correções pós-revisão, achado 2).
  // ==========================================================================
  it('bloqueia o cancelamento do romaneio E do pedido quando já há tarefa CONCLUÍDA', async () => {
    const { token } = await login();
    const client = api(token);
    const { customer, warehouse, position } = await setupScenario(0);

    // Dois itens → duas tarefas independentes: uma é executada (estoque sai de
    // verdade) e a outra fica pendente.
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

    await client.startSeparation(shipmentId).expect(200);

    const tasks = await testPrisma.warehouseTask.findMany({ orderBy: { createdAt: 'asc' } });
    expect(tasks).toHaveLength(2);

    // A PRIMEIRA É EXECUTADA: `StockMovement` OUT real, material fora do
    // endereço, fisicamente na doca.
    await client.executeTask(tasks[0].id).expect(200);
    expect(await testPrisma.stockMovement.count()).toBe(1);

    // Cancelar o ROMANEIO agora apagaria o último documento que explica onde
    // aquele material está.
    const shipmentCancel = await client.cancelShipment(shipmentId);
    expect(shipmentCancel.status).toBe(400);
    expect(shipmentCancel.body.message).toBe(
      '1 tarefa(s) de separação já concluídas debitaram estoque. ' +
        'Retorne o material ao endereço (ajuste de estoque) antes de cancelar.'
    );

    // Cancelar o PEDIDO (que cascateia até o romaneio) tem de barrar igual, com
    // a MESMA mensagem — é o mesmo problema físico visto do outro documento.
    const orderCancel = await client.cancelOrder(orderId);
    expect(orderCancel.status).toBe(400);
    expect(orderCancel.body.message).toBe(shipmentCancel.body.message);

    // NADA foi cancelado por nenhuma das duas tentativas.
    const shipment = await testPrisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(shipment.status).toBe('SEPARATING');

    const order = await testPrisma.salesOrder.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('SEPARATING');

    const after = await testPrisma.warehouseTask.findMany({ orderBy: { createdAt: 'asc' } });
    expect(after.map((t) => t.status)).toEqual(['COMPLETED', 'PENDING']);
  }, 40000);

  // ==========================================================================
  // DESPACHO SEM TAREFA NENHUMA (correções pós-revisão, achado 5).
  // ==========================================================================
  it('recusa o despacho de romaneio sem nenhuma tarefa de separação', async () => {
    const { token } = await login();
    const client = api(token);
    const { customer, product, warehouse } = await setupScenario(500);

    const created = await client.createOrder({
      customerId: customer.id,
      warehouseId: warehouse.id,
      items: [{ productId: product.id, quantity: 10, unitPrice: 1 }],
    });
    const orderId = created.body.data.id as string;
    const orderItemId = created.body.data.items[0].id as string;
    await client.confirmOrder(orderId).expect(200);

    const shipmentRes = await client.createShipment({
      salesOrderId: orderId,
      items: [{ salesOrderItemId: orderItemId, quantity: 10 }],
    });
    const shipmentId = shipmentRes.body.data.id as string;

    // Nenhuma rota produz este estado hoje (a separação sempre cria tarefa),
    // mas `READY` existe no enum e o despacho o aceita — então o estado
    // "romaneio despachável sem nenhuma tarefa" é alcançável assim que alguém
    // introduzir essa transição. Forçado aqui direto no banco.
    await testPrisma.shipment.update({
      where: { id: shipmentId },
      data: { status: 'SEPARATING' },
    });
    expect(await testPrisma.warehouseTask.count()).toBe(0);

    const res = await client.dispatch(shipmentId);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/sem tarefas de separação/);

    // O gate antigo (`filter(...).length > 0` numa lista vazia) deixava passar e
    // expedia material que ninguém tirou da prateleira.
    const item = await testPrisma.salesOrderItem.findUniqueOrThrow({
      where: { id: orderItemId },
    });
    expect(item.shippedQty).toBe(0);

    const shipment = await testPrisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    expect(shipment.status).toBe('SEPARATING');
    expect(shipment.dispatchedAt).toBeNull();
  }, 40000);

  // ==========================================================================
  // OBSERVAÇÃO LONGA (correções pós-revisão, achado 3).
  // ==========================================================================
  it('aceita observação de 500 caracteres em pedido e romaneio (notes é TEXT)', async () => {
    const { token } = await login();
    const client = api(token);
    const { customer, product, warehouse } = await setupScenario(500);

    // 500 é exatamente o teto do validator. Com `VARCHAR(191)` isto estourava
    // no INSERT (MySQL 1406) e virava 500 numa entrada declarada válida.
    const longNote = 'á'.repeat(500);

    const created = await client.createOrder({
      customerId: customer.id,
      warehouseId: warehouse.id,
      notes: longNote,
      items: [{ productId: product.id, quantity: 10, unitPrice: 1 }],
    });

    expect(created.status).toBe(201);
    expect(created.body.data.notes).toHaveLength(500);

    const orderId = created.body.data.id as string;
    const orderItemId = created.body.data.items[0].id as string;
    await client.confirmOrder(orderId).expect(200);

    const shipmentRes = await client.createShipment({
      salesOrderId: orderId,
      notes: longNote,
      items: [{ salesOrderItemId: orderItemId, quantity: 10 }],
    });

    expect(shipmentRes.status).toBe(201);
    expect(shipmentRes.body.data.notes).toHaveLength(500);

    // E o que o banco guardou é o texto inteiro, não um truncado silencioso.
    const persisted = await testPrisma.shipment.findUniqueOrThrow({
      where: { id: shipmentRes.body.data.id },
    });
    expect(persisted.notes).toBe(longNote);
  }, 40000);

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
