import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import {
  createTestPositions,
  createTestProduct,
  createTestPurchaseOrder,
  createUserWithPermissions,
} from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

/**
 * Fase 4a do plano do WMS (WMS_IMPLEMENTATION_ANALYSIS.md, seção 5, itens F4.1
 * a F4.5) — recebimento orientado a tarefa.
 *
 * O RISCO que estes testes existem para cobrir está escrito na própria tabela
 * de riscos do plano: "`purchase-receipt.service.ts` acumular dois caminhos
 * (com/sem WMS) que divergem com o tempo, um deles sub-testado". Por isso o
 * arquivo cobre os DOIS modos, e o primeiro bloco é justamente o caminho SEM
 * WMS — verificando que ele continua byte-a-byte o de sempre.
 *
 * `clearLicensedModuleCache()` no beforeEach/afterEach é obrigatório: o cache
 * de licença vive no módulo e sobrevive ao `cleanDatabase()`.
 */

const RECEIPT_PERMISSIONS = [
  { resource: 'recebimentos_compra', action: 'visualizar' },
  { resource: 'recebimentos_compra', action: 'criar' },
  { resource: 'recebimentos_compra', action: 'excluir' },
  { resource: 'stock', action: 'read' },
];

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

/** Cria usuário com as permissões de recebimento e devolve `{ user, token }`. */
const loginReceiptUser = async () => {
  const user = await createUserWithPermissions(RECEIPT_PERMISSIONS);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return { user, token: res.body.data.accessToken as string };
};

/** Monta produto + pedido + recebimento via API, no modo já configurado. */
const createReceipt = async (
  token: string,
  userId: string,
  quantity = 100,
  unitPrice = 10
) => {
  const product = await createTestProduct();
  const { order } = await createTestPurchaseOrder(userId, [
    { productId: product.id, quantity, unitPrice },
  ]);

  const res = await request(app)
    .post('/api/v1/purchase-receipts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      purchaseOrderId: order.id,
      receiptDate: new Date().toISOString(),
      items: [
        { orderItemId: order.items[0].id, productId: product.id, quantityReceived: quantity },
      ],
    });

  return { product, order, res };
};

describe('Integração: recebimento orientado a tarefa (Fase 4a, F4.1-F4.5)', () => {
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

  // ==========================================================================
  // F4.3 — caminho SEM WMS: nada pode ter mudado.
  // ==========================================================================
  describe('sem WMS licenciado (comportamento legado, inalterado)', () => {
    beforeEach(async () => {
      await setModule('COMPRAS', true);
      await setModule('WMS', false);
      clearLicensedModuleCache();
    });

    it('registra a entrada de estoque na criação e NÃO gera tarefa nenhuma', async () => {
      const { user, token } = await loginReceiptUser();
      const { product, res } = await createReceipt(token, user.id, 100);

      expect(res.status).toBe(201);
      // Status continua o default da coluna — `CONFERIDO` é do outro caminho.
      expect(res.body.data.status).toBe('PENDING');

      const tasks = await testPrisma.warehouseTask.findMany();
      expect(tasks).toHaveLength(0);

      // Entrada de estoque imediata, SEM posição (é o fluxo não endereçado).
      const movements = await testPrisma.stockMovement.findMany({
        where: { productId: product.id },
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].type).toBe('IN');
      expect(movements[0].quantity).toBe(100);
      expect(movements[0].toPositionId).toBeNull();
      expect(movements[0].fromPositionId).toBeNull();

      const balance = await testPrisma.stockBalance.findUnique({
        where: { productId: product.id },
      });
      expect(balance?.quantity).toBe(100);

      // updateProductCosts() continua rodando no mesmo ponto de sempre.
      const updated = await testPrisma.product.findUnique({ where: { id: product.id } });
      expect(updated?.lastCost).toBe(10);
      expect(updated?.averageCost).toBe(10);
    });

    it('as rotas de tarefa não existem (404) sem WMS licenciado', async () => {
      const { token } = await loginReceiptUser();

      const res = await request(app)
        .get('/api/v1/warehouse-tasks/receipt/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      // 404 do requireModule: o módulo deve PARECER não existir.
      expect(res.status).toBe(404);
    });
  });

  // ==========================================================================
  // F4.1/F4.2/F4.3 — caminho COM WMS.
  // ==========================================================================
  describe('com WMS licenciado', () => {
    beforeEach(async () => {
      await setModule('COMPRAS', true);
      await setModule('WMS', true);
      clearLicensedModuleCache();
    });

    it('cria a cadeia de 5 tarefas, deixa o recebimento CONFERIDO e NÃO mexe no estoque', async () => {
      const { user, token } = await loginReceiptUser();
      const { product, res } = await createReceipt(token, user.id, 100);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('CONFERIDO');

      const list = await request(app)
        .get(`/api/v1/warehouse-tasks/receipt/${res.body.data.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(list.status).toBe(200);
      expect(list.body.data.map((t: any) => [t.sequence, t.type, t.status])).toEqual([
        [1, 'DESCARGA', 'PENDING'],
        [2, 'CONFERENCIA', 'PENDING'],
        [3, 'ETIQUETAGEM', 'PENDING'],
        // QUARENTENA é gerada SEMPRE nesta metade da fase (a condicionalidade
        // depende de StorageRule, F4.6/Fase 4b).
        [4, 'QUARENTENA', 'PENDING'],
        [5, 'ALOCACAO', 'PENDING'],
      ]);

      expect(
        list.body.data.every(
          (t: any) => t.referenceType === 'PURCHASE_RECEIPT' && t.reference === res.body.data.id
        )
      ).toBe(true);
      // Nenhuma tarefa nasce com posição — nem a de ALOCACAO.
      expect(list.body.data.every((t: any) => t.toPositionId === null)).toBe(true);

      // O NÚCLEO DE F4.3: a conferência não dá entrada em estoque.
      const movements = await testPrisma.stockMovement.findMany({
        where: { productId: product.id },
      });
      expect(movements).toHaveLength(0);

      const balance = await testPrisma.stockBalance.findUnique({
        where: { productId: product.id },
      });
      expect(balance).toBeNull();

      // Custo médio também não é recalculado antes do material existir.
      const updatedProduct = await testPrisma.product.findUnique({ where: { id: product.id } });
      expect(updatedProduct?.averageCost).toBeNull();

      // O que NÃO mudou: o pedido foi recebido nos dois modos.
      const orderItem = await testPrisma.purchaseOrderItem.findFirst({
        where: { productId: product.id },
      });
      expect(orderItem?.receivedQty).toBe(100);
    });

    it('respeita a ordem da cadeia: endereçar antes das etapas anteriores é 409', async () => {
      const { user, token } = await loginReceiptUser();
      const { product, res } = await createReceipt(token, user.id, 100);
      const { positions } = await createTestPositions(1);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id },
        orderBy: { sequence: 'asc' },
      });
      const receiptItem = await testPrisma.purchaseReceiptItem.findFirst({
        where: { receiptId: res.body.data.id },
      });

      const early = await request(app)
        .post(`/api/v1/warehouse-tasks/${tasks[4].id}/putaway`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiptItemId: receiptItem!.id,
          storagePositionId: positions[0].id,
          quantity: 10,
        });

      expect(early.status).toBe(409);
      expect(early.body.message).toContain('DESCARGA');

      // E nada foi escrito.
      expect(await testPrisma.receiptPutaway.count()).toBe(0);
      expect(
        await testPrisma.stockMovement.count({ where: { productId: product.id } })
      ).toBe(0);
    });

    it('conclui as 4 etapas sem efeito de estoque e recusa ALOCACAO no endpoint genérico', async () => {
      const { user, token } = await loginReceiptUser();
      const { product, res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id },
        orderBy: { sequence: 'asc' },
      });

      for (const task of tasks.slice(0, 4)) {
        const done = await request(app)
          .post(`/api/v1/warehouse-tasks/${task.id}/complete`)
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(done.status).toBe(200);
        expect(done.body.data.status).toBe('COMPLETED');
        expect(done.body.data.completedAt).not.toBeNull();
        expect(done.body.data.startedAt).not.toBeNull();
      }

      // Nenhuma das quatro toca em estoque.
      expect(
        await testPrisma.stockMovement.count({ where: { productId: product.id } })
      ).toBe(0);

      // ALOCACAO não é concluída pelo endpoint genérico: o corpo dela é outro.
      const wrong = await request(app)
        .post(`/api/v1/warehouse-tasks/${tasks[4].id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(wrong.status).toBe(400);
      expect(wrong.body.message).toContain('putaway');
    });

    it('recusa reconclusão de uma tarefa já concluída e respeita o lock otimista', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const [descarga] = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id },
        orderBy: { sequence: 'asc' },
      });

      // Versão errada -> 409 antes de qualquer escrita.
      const stale = await request(app)
        .post(`/api/v1/warehouse-tasks/${descarga.id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ version: 99 });
      expect(stale.status).toBe(409);

      const first = await request(app)
        .post(`/api/v1/warehouse-tasks/${descarga.id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({ version: descarga.version });
      expect(first.status).toBe(200);

      const second = await request(app)
        .post(`/api/v1/warehouse-tasks/${descarga.id}/complete`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(second.status).toBe(409);
    });
  });

  // ==========================================================================
  // F4.4/F4.5 — conclusão da ALOCACAO: o único ponto de entrada em estoque.
  // ==========================================================================
  describe('conclusão da tarefa de ALOCACAO (F4.4/F4.5)', () => {
    /**
     * Recebimento com WMS, com as quatro primeiras etapas já concluídas e a
     * ALOCACAO liberada — o estado de onde todo teste deste bloco parte.
     */
    const arrangeReadyForPutaway = async (quantity = 100, positionCount = 2) => {
      await setModule('COMPRAS', true);
      await setModule('WMS', true);
      clearLicensedModuleCache();

      const { user, token } = await loginReceiptUser();
      const { product, res } = await createReceipt(token, user.id, quantity);
      const { positions } = await createTestPositions(positionCount);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id },
        orderBy: { sequence: 'asc' },
      });

      // As quatro primeiras etapas são concluídas direto no banco, e não por
      // HTTP: o caminho HTTP delas já tem teste próprio acima, e o
      // `generalLimiter` (100 requisições por IP na janela, e o store é
      // compartilhado por todo o arquivo de teste) tornaria o arranjo o maior
      // consumidor de requisições da suíte.
      await testPrisma.warehouseTask.updateMany({
        where: { id: { in: tasks.slice(0, 4).map((t) => t.id) } },
        data: { status: 'COMPLETED', startedAt: new Date(), completedAt: new Date() },
      });

      const receiptItem = await testPrisma.purchaseReceiptItem.findFirstOrThrow({
        where: { receiptId: res.body.data.id },
      });

      return {
        user,
        token,
        product,
        positions,
        receiptId: res.body.data.id as string,
        allocationTask: tasks[4],
        receiptItem,
      };
    };

    it('endereça em duas posições, gera saldo por posição e fecha tarefa e recebimento', async () => {
      const { token, product, positions, receiptId, allocationTask, receiptItem } =
        await arrangeReadyForPutaway(100, 2);

      const first = await request(app)
        .post(`/api/v1/warehouse-tasks/${allocationTask.id}/putaway`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiptItemId: receiptItem.id,
          storagePositionId: positions[0].id,
          quantity: 60,
        });

      expect(first.status).toBe(201);
      expect(first.body.data.receiptCompleted).toBe(false);
      // Decisão D2: quantidade `Decimal` sai como STRING nos endpoints novos.
      expect(first.body.data.putaway.quantity).toBe('60');

      // Parcial: a tarefa começou mas não fechou, e o recebimento segue CONFERIDO.
      const midTask = await testPrisma.warehouseTask.findUniqueOrThrow({
        where: { id: allocationTask.id },
      });
      expect(midTask.status).toBe('IN_PROGRESS');
      expect(midTask.startedAt).not.toBeNull();

      const midReceipt = await testPrisma.purchaseReceipt.findUniqueOrThrow({
        where: { id: receiptId },
      });
      expect(midReceipt.status).toBe('CONFERIDO');

      // ...mas o estoque JÁ entrou pelo que foi endereçado.
      expect(
        (await testPrisma.stockBalance.findUnique({ where: { productId: product.id } }))
          ?.quantity
      ).toBe(60);

      const second = await request(app)
        .post(`/api/v1/warehouse-tasks/${allocationTask.id}/putaway`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiptItemId: receiptItem.id,
          storagePositionId: positions[1].id,
          quantity: 40,
        });

      expect(second.status).toBe(201);
      expect(second.body.data.receiptCompleted).toBe(true);

      // F4.4 — dois endereçamentos para o MESMO item conferido.
      const putaways = await testPrisma.receiptPutaway.findMany({
        where: { receiptItemId: receiptItem.id },
        orderBy: { putawayAt: 'asc' },
      });
      expect(putaways).toHaveLength(2);
      // `Prisma.Decimal.toString()` devolve o valor sem zeros à direita — o
      // mesmo contrato de serialização firmado na Fase 1 (decisão D2).
      expect(putaways.map((p) => p.quantity.toString())).toEqual(['60', '40']);
      expect(putaways.every((p) => p.taskId === allocationTask.id)).toBe(true);

      // F4.5 — uma movimentação IN COM `toPositionId` por endereçamento.
      const movements = await testPrisma.stockMovement.findMany({
        where: { productId: product.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(movements).toHaveLength(2);
      expect(movements.every((m) => m.type === 'IN')).toBe(true);
      expect(movements.map((m) => m.toPositionId).sort()).toEqual(
        [positions[0].id, positions[1].id].sort()
      );
      expect(movements.every((m) => m.fromPositionId === null)).toBe(true);
      expect(movements.every((m) => m.referenceType === 'PURCHASE')).toBe(true);

      // Saldo agregado E saldo por posição, escritos na mesma transação.
      expect(
        (await testPrisma.stockBalance.findUnique({ where: { productId: product.id } }))
          ?.quantity
      ).toBe(100);

      const positionBalances = await testPrisma.stockPositionBalance.findMany({
        where: { productId: product.id },
      });
      expect(
        positionBalances
          .map((b) => [b.storagePositionId, b.quantity.toString()])
          .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      ).toEqual(
        [
          [positions[0].id, '60'],
          [positions[1].id, '40'],
        ].sort((a, b) => (a[0] < b[0] ? -1 : 1))
      );

      // F4.2/F4.5 — tarefa e recebimento fecham juntos.
      expect(
        (await testPrisma.warehouseTask.findUniqueOrThrow({ where: { id: allocationTask.id } }))
          .status
      ).toBe('COMPLETED');
      expect(
        (await testPrisma.purchaseReceipt.findUniqueOrThrow({ where: { id: receiptId } })).status
      ).toBe('COMPLETED');

      // `updateProductCosts()` inalterado, só adiado para cá.
      const updatedProduct = await testPrisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      expect(updatedProduct.lastCost).toBe(10);
      expect(updatedProduct.averageCost).toBe(10);
    });

    it('recusa endereçar mais do que o acceptedQty do item', async () => {
      const { token, positions, allocationTask, receiptItem } =
        await arrangeReadyForPutaway(100, 1);

      const ok = await request(app)
        .post(`/api/v1/warehouse-tasks/${allocationTask.id}/putaway`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiptItemId: receiptItem.id,
          storagePositionId: positions[0].id,
          quantity: 90,
        });
      expect(ok.status).toBe(201);

      const excess = await request(app)
        .post(`/api/v1/warehouse-tasks/${allocationTask.id}/putaway`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiptItemId: receiptItem.id,
          storagePositionId: positions[0].id,
          quantity: 20,
        });

      expect(excess.status).toBe(400);
      expect(excess.body.message).toContain('excede a conferida');
      expect(await testPrisma.receiptPutaway.count()).toBe(1);
    });

    it('recusa endereçar em posição bloqueada', async () => {
      const { token, positions, allocationTask, receiptItem } =
        await arrangeReadyForPutaway(100, 1);

      await testPrisma.storagePosition.update({
        where: { id: positions[0].id },
        data: { blocked: true },
      });

      const res = await request(app)
        .post(`/api/v1/warehouse-tasks/${allocationTask.id}/putaway`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiptItemId: receiptItem.id,
          storagePositionId: positions[0].id,
          quantity: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('bloqueada');
      expect(await testPrisma.receiptPutaway.count()).toBe(0);
    });

    it('recusa item de recebimento de OUTRO recebimento na mesma tarefa', async () => {
      const { user, token, positions, allocationTask } = await arrangeReadyForPutaway(100, 1);

      // Segundo recebimento, item alheio à tarefa em questão.
      const other = await createReceipt(token, user.id, 50);
      const otherItem = await testPrisma.purchaseReceiptItem.findFirstOrThrow({
        where: { receiptId: other.res.body.data.id },
      });

      const res = await request(app)
        .post(`/api/v1/warehouse-tasks/${allocationTask.id}/putaway`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiptItemId: otherItem.id,
          storagePositionId: positions[0].id,
          quantity: 10,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('não pertence');
    });

    it('cancelar um recebimento com WMS estorna apenas o que foi endereçado', async () => {
      const { token, product, positions, receiptId, allocationTask, receiptItem } =
        await arrangeReadyForPutaway(100, 1);

      await request(app)
        .post(`/api/v1/warehouse-tasks/${allocationTask.id}/putaway`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          receiptItemId: receiptItem.id,
          storagePositionId: positions[0].id,
          quantity: 40,
        })
        .expect(201);

      const cancelled = await request(app)
        .delete(`/api/v1/purchase-receipts/${receiptId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'divergência na nota fiscal' });

      expect(cancelled.status).toBe(200);

      // Estorno de 40 (o endereçado), não de 100 (o conferido) — este é o bug
      // que o branch por existência de tarefa em `cancel()` evita.
      const balance = await testPrisma.stockBalance.findUnique({
        where: { productId: product.id },
      });
      expect(balance?.quantity).toBe(0);

      const positionBalance = await testPrisma.stockPositionBalance.findFirst({
        where: { productId: product.id, storagePositionId: positions[0].id },
      });
      expect(positionBalance?.quantity.toString()).toBe('0');

      // Recebimento, tarefas e endereçamentos saem juntos.
      expect(await testPrisma.purchaseReceipt.count()).toBe(0);
      expect(await testPrisma.warehouseTask.count()).toBe(0);
      expect(await testPrisma.receiptPutaway.count()).toBe(0);

      const orderItem = await testPrisma.purchaseOrderItem.findFirstOrThrow({
        where: { productId: product.id },
      });
      expect(orderItem.receivedQty).toBe(0);
    });

    // ========================================================================
    // CONCORRÊNCIA — o ponto de escrita compartilhada novo desta fase.
    // ========================================================================
    it('duas conclusões simultâneas do mesmo item nunca somam mais que o acceptedQty', async () => {
      const { token, product, positions, receiptItem, allocationTask } =
        await arrangeReadyForPutaway(100, 2);

      // 60 + 60 > 100: sem o `FOR UPDATE` no item de recebimento (e no lock
      // externo da tarefa), as duas leriam soma parcial 0 e ambas passariam na
      // validação — o furo clássico de read-then-write que o banco não tem como
      // barrar com constraint (é uma invariante de AGREGAÇÃO).
      const attempts = [positions[0].id, positions[1].id].map((positionId) =>
        request(app)
          .post(`/api/v1/warehouse-tasks/${allocationTask.id}/putaway`)
          .set('Authorization', `Bearer ${token}`)
          .send({ receiptItemId: receiptItem.id, storagePositionId: positionId, quantity: 60 })
      );

      const responses = await Promise.all(attempts);
      const created = responses.filter((r) => r.status === 201);
      const rejected = responses.filter((r) => r.status !== 201);

      expect(created).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].status).toBe(400);

      const putaways = await testPrisma.receiptPutaway.findMany({
        where: { receiptItemId: receiptItem.id },
      });
      expect(putaways).toHaveLength(1);

      // E o estoque reflete exatamente o endereçamento que passou.
      expect(
        (await testPrisma.stockBalance.findUnique({ where: { productId: product.id } }))
          ?.quantity
      ).toBe(60);
      expect(
        await testPrisma.stockMovement.count({ where: { productId: product.id } })
      ).toBe(1);
    }, 20000);

    it('duas conclusões simultâneas que CABEM no acceptedQty passam as duas e fecham o recebimento uma vez só', async () => {
      const { token, product, positions, receiptItem, allocationTask, receiptId } =
        await arrangeReadyForPutaway(100, 2);

      // 50 + 50 == 100: as duas são válidas. O que se verifica aqui é que a
      // serialização pelo lock da tarefa não deixa as duas decidirem, cada uma
      // por si, que o recebimento acabou (dupla escrita de status/versão).
      const attempts = [positions[0].id, positions[1].id].map((positionId) =>
        request(app)
          .post(`/api/v1/warehouse-tasks/${allocationTask.id}/putaway`)
          .set('Authorization', `Bearer ${token}`)
          .send({ receiptItemId: receiptItem.id, storagePositionId: positionId, quantity: 50 })
      );

      const responses = await Promise.all(attempts);
      expect(responses.filter((r) => r.status === 201)).toHaveLength(2);
      expect(responses.filter((r) => r.body?.data?.receiptCompleted === true)).toHaveLength(1);

      expect(
        (await testPrisma.stockBalance.findUnique({ where: { productId: product.id } }))
          ?.quantity
      ).toBe(100);
      expect(
        (await testPrisma.purchaseReceipt.findUniqueOrThrow({ where: { id: receiptId } })).status
      ).toBe('COMPLETED');

      const task = await testPrisma.warehouseTask.findUniqueOrThrow({
        where: { id: allocationTask.id },
      });
      expect(task.status).toBe('COMPLETED');
    }, 20000);
  });
});
