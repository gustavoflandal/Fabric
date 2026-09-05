# Painel de Operações do WMS (Recebimento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um painel visual (linhas de retângulos, um por etapa da cadeia de `WarehouseTask` de cada recebimento ativo) para supervisor e operador acompanharem e — quando não há coletor de dados — conduzirem manualmente o recebimento, com documentos de apoio impressos por tipo de etapa.

**Architecture:** Um único endpoint agregado novo (`GET /warehouse-tasks/panel`) alimenta um componente frontend compartilhado; a execução em si (iniciar/concluir/endereçar) reaproveita integralmente os endpoints de tarefa já existentes (`/start`, `/complete`, `/putaway`) — nada de novo no ciclo de vida da tarefa, só uma tela nova por cima do que já existe.

**Tech Stack:** Express + Prisma + Joi + Jest/ts-jest (backend); Vue 3 `<script setup>` + TypeScript + Pinia + Tailwind (frontend).

## Global Constraints

- Escopo: só Recebimento (`referenceType = 'PURCHASE_RECEIPT'`). Separação/Reposição ficam de fora.
- Uma "operação ativa" é um `PurchaseReceipt` com pelo menos uma `WarehouseTask` em status `PENDING` ou `IN_PROGRESS`.
- 3 estados de retângulo: concluída (`COMPLETED`/`CANCELLED`), ativa (a primeira tarefa não resolvida da cadeia, na ordem `sequence`/`createdAt` — mesmo critério de `assertChainOrderResolved`), bloqueada (qualquer coisa depois da ativa).
- Clicar numa tarefa ativa SEM atribuição abre diálogo de confirmação ("Pegar esta tarefa?") antes de agir — nenhuma atribuição acontece sem confirmação explícita.
- Reaproveitar sempre que possível: `POST /warehouse-tasks/:id/start` (F4.11, já existe) faz exatamente "atribui a quem chamou, se estiver livre, e marca IN_PROGRESS" — é o que a confirmação de "pegar tarefa" dispara. `POST /:id/complete` (DESCARGA/CONFERENCIA/ETIQUETAGEM/QUARENTENA) e `POST /:id/putaway` (ALOCACAO) já existem e não mudam.
- **Descoberta desta fase de plano, corrigindo uma suposição do spec:** o spec dizia que a Alocação reaproveitaria "o fluxo de endereçamento que já existe" — na verdade **não existe nenhuma tela de endereçamento no frontend hoje** (Fase 4 do WMS nunca ganhou frontend, nem no PR #8 nem em nenhum outro). Este plano constrói um mini-formulário de endereçamento (posição + quantidade) como parte da Task 6 — pequeno e contido, chamando o `/putaway` que já existe e é testado, não duplicando lógica de negócio nenhuma.
- Tipos de etapa no frontend: os 8 tipos completos do motor de workflow dinâmico (`DESCARGA`, `CONFERENCIA`, `ETIQUETAGEM`, `QUARENTENA`, `SEGREGACAO`, `AMOSTRAGEM`, `ALOCACAO`) — os dois últimos (`SEGREGACAO`/`AMOSTRAGEM`) ainda não existem no enum `WarehouseTaskType` deste branch (só entram quando o PR #9 for mesclado), mas o tipo TypeScript do frontend já nasce com os 7, de propósito: é um superconjunto seguro do que o backend atual pode devolver (nunca há um valor real fora dessa lista), e evita precisar mexer no frontend de novo quando o PR #9 mesclar.
- RBAC: `GET /warehouse-tasks/panel` usa `recebimentos_compra:visualizar` (mesmo recurso de `GET /warehouse-tasks/receipt/:id`, o endpoint irmão mais próximo) — nenhum recurso novo. As ações de execução continuam com os recursos que já têm (`recebimentos_compra:criar` para complete/putaway, `tarefas_armazem:executar` para start).
- Documentos de apoio: um gerador único configurado por tipo de etapa, reaproveitando `generatePDF()` (`frontend/src/utils/pdf-generator.ts`, já existente neste branch — **atenção:** ainda na forma pré-PR#8, com `supplierSignature?: boolean`, não o `signature: {label}` generalizado; este plano NÃO depende do PR #8 e não toca nesse arquivo).
- Atualização do painel: polling a cada 25s + refetch imediato após qualquer ação de conclusão bem-sucedida. Sem WebSocket.
- **Risco do spec já resolvido, sem código novo:** a corrida de dois operadores confirmando "pegar" a mesma tarefa ao mesmo tempo já é tratada pelo `POST /:id/start` existente (F4.11) — ele trava a linha com `FOR UPDATE` (`loadTaskForUpdate`) e recusa com 409 quem tenta iniciar uma tarefa já atribuída a outro. Nenhum mecanismo de lock novo é necessário neste plano.
- **Paginação do `/panel`:** aceito como limitação da v1, não implementada — mesmo padrão já aceito em `listByReceipt`/`listMyTasks` (sem paginação). Revisar se algum armazém real tiver dezenas de recebimentos ativos simultâneos ao ponto de a resposta ficar pesada.

---

## Task 1: Backend — `GET /warehouse-tasks/panel`

**Files:**
- Modify: `backend/src/services/warehouse-task.service.ts` (adicionar `listActiveReceiptOperations`)
- Modify: `backend/src/controllers/warehouse-task.controller.ts` (adicionar `getPanel`)
- Modify: `backend/src/routes/warehouse-task.routes.ts` (adicionar `GET /panel`)
- Modify: `backend/src/validators/warehouse-task.validator.ts` (adicionar `panelQuerySchema`)
- Test: `backend/tests/integration/wms-operations-panel.test.ts`

**Interfaces:**
- Consumes: `taskSelect`, `serializeTask`, `RECEIPT_TASK_REFERENCE_TYPE`, `OPEN_STATUSES` (já existentes no próprio arquivo, uso interno).
- Produces: rota `GET /warehouse-tasks/panel?scope=all|mine`, resposta `{ status: 'success', data: ReceiptOperation[] }` onde `ReceiptOperation = { receiptId: string; receiptNumber: string; tasks: SerializedTask[] }` — a Task 2 (frontend) consome este contrato.

- [ ] **Step 1: Escrever o teste de integração que falha**

Create `backend/tests/integration/wms-operations-panel.test.ts`:

```ts
import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestProduct, createTestPurchaseOrder, createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

/**
 * Painel de operações do WMS (Recebimento) — GET /warehouse-tasks/panel.
 *
 * Reaproveita o mesmo padrão de setup de `wms-receipt-tasks.test.ts`
 * (createReceipt via API real, não fixture direta) porque o que este teste
 * protege é justamente a AGREGAÇÃO por recebimento a partir das tarefas já
 * criadas pelo fluxo normal de recebimento — criar as tarefas via
 * `testPrisma.warehouseTask.create` direto esconderia um bug de agregação
 * atrás de um fixture que já vem "arrumado".
 */

const RECEIPT_PERMISSIONS = [
  { resource: 'recebimentos_compra', action: 'visualizar' },
  { resource: 'recebimentos_compra', action: 'criar' },
];

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

const loginReceiptUser = async () => {
  const user = await createUserWithPermissions(RECEIPT_PERMISSIONS);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return { user, token: res.body.data.accessToken as string };
};

const createReceipt = async (token: string, userId: string, quantity = 100, unitPrice = 10) => {
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
      items: [{ orderItemId: order.items[0].id, productId: product.id, quantityReceived: quantity }],
    });
  return { product, order, res };
};

describe('Integração: painel de operações do WMS (GET /warehouse-tasks/panel)', () => {
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

  describe('com WMS e COMPRAS licenciados', () => {
    beforeEach(async () => {
      await setModule('COMPRAS', true);
      await setModule('WMS', true);
    });

    it('scope=all lista o recebimento com sua cadeia de tarefas completa, em ordem', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);
      expect(res.status).toBe(201);

      const panel = await request(app)
        .get('/api/v1/warehouse-tasks/panel?scope=all')
        .set('Authorization', `Bearer ${token}`);

      expect(panel.status).toBe(200);
      expect(panel.body.data).toHaveLength(1);
      expect(panel.body.data[0].receiptId).toBe(res.body.data.id);
      expect(panel.body.data[0].receiptNumber).toBe(res.body.data.receiptNumber);
      expect(panel.body.data[0].tasks.map((t: any) => t.type)).toEqual([
        'DESCARGA',
        'CONFERENCIA',
        'ETIQUETAGEM',
        'QUARENTENA',
        'ALOCACAO',
      ]);
      expect(panel.body.data[0].tasks.map((t: any) => t.status)).toEqual([
        'PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING',
      ]);
    });

    it('recebimento sem nenhuma tarefa PENDING/IN_PROGRESS não aparece no painel', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      await testPrisma.warehouseTask.updateMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        data: { status: 'COMPLETED' },
      });

      const panel = await request(app)
        .get('/api/v1/warehouse-tasks/panel?scope=all')
        .set('Authorization', `Bearer ${token}`);

      expect(panel.body.data).toHaveLength(0);
    });

    it('scope=mine ainda traz o recebimento se pelo menos uma tarefa está livre ou atribuída ao usuário', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const otherUser = await createUserWithPermissions(RECEIPT_PERMISSIONS);
      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      // Só a primeira etapa (DESCARGA) fica atribuída a outro operador — as
      // demais continuam livres, então o recebimento ainda é "meu" (dá pra
      // pegar alguma etapa dele).
      await testPrisma.warehouseTask.update({
        where: { id: tasks[0].id },
        data: { assignedTo: otherUser.id },
      });

      const panelMine = await request(app)
        .get('/api/v1/warehouse-tasks/panel?scope=mine')
        .set('Authorization', `Bearer ${token}`);

      expect(panelMine.body.data).toHaveLength(1);
      expect(panelMine.body.data[0].tasks[0].assignedTo).toBe(otherUser.id);
      expect(panelMine.body.data[0].tasks[1].assignedTo).toBeNull();
    });

    it('scope=mine NÃO traz o recebimento se TODAS as tarefas estão atribuídas a outro operador', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const otherUser = await createUserWithPermissions(RECEIPT_PERMISSIONS);
      await testPrisma.warehouseTask.updateMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        data: { assignedTo: otherUser.id },
      });

      const panelMine = await request(app)
        .get('/api/v1/warehouse-tasks/panel?scope=mine')
        .set('Authorization', `Bearer ${token}`);

      expect(panelMine.body.data).toHaveLength(0);
    });

    it('scope omitido tem o mesmo efeito de scope=all', async () => {
      const { user, token } = await loginReceiptUser();
      await createReceipt(token, user.id, 100);

      const panel = await request(app)
        .get('/api/v1/warehouse-tasks/panel')
        .set('Authorization', `Bearer ${token}`);

      expect(panel.status).toBe(200);
      expect(panel.body.data).toHaveLength(1);
    });
  });

  it('sem WMS licenciado, retorna 404 mesmo com a permissão', async () => {
    await setModule('COMPRAS', true);
    await setModule('WMS', false);
    const { token } = await loginReceiptUser();

    const panel = await request(app)
      .get('/api/v1/warehouse-tasks/panel?scope=all')
      .set('Authorization', `Bearer ${token}`);

    expect(panel.status).toBe(404);
  });

  it('sem permissão recebimentos_compra:visualizar, retorna 403', async () => {
    await setModule('COMPRAS', true);
    await setModule('WMS', true);
    const user = await createUserWithPermissions([]);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'Test@Password123' });

    const panel = await request(app)
      .get('/api/v1/warehouse-tasks/panel?scope=all')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(panel.status).toBe(403);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run (de `backend/`): `npm run test:integration -- tests/integration/wms-operations-panel.test.ts`
Expected: FAIL em todos os testes — `GET /api/v1/warehouse-tasks/panel` ainda não existe (404 de rota inexistente, não o 404 de módulo).

- [ ] **Step 3: Implementar o service**

Em `backend/src/services/warehouse-task.service.ts`, adicionar (logo depois de `listByReceipt`, antes de `loadTaskForUpdate`):

```ts
export type PanelScope = 'all' | 'mine';

export interface ReceiptOperation {
  receiptId: string;
  receiptNumber: string;
  tasks: ReturnType<typeof serializeTask>[];
}

/**
 * Painel de operações — recebimentos ATIVOS (com pelo menos uma tarefa
 * PENDING/IN_PROGRESS), cada um com a cadeia de tarefas completa (incluindo
 * as já concluídas e as ainda bloqueadas — o painel precisa do CONTEXTO
 * inteiro da cadeia, não só do que está acionável agora).
 *
 * `scope='mine'` filtra os RECEBIMENTOS a quem tem pelo menos uma tarefa
 * livre (`assignedTo: null`) ou já atribuída ao usuário — mesmo critério de
 * `listMyTasks` (F4.9), aplicado aqui no nível do recebimento em vez da
 * tarefa individual: um recebimento com uma etapa já tomada por outro
 * operador ainda é "meu" se sobrar alguma etapa livre ou minha nele.
 */
export const listActiveReceiptOperations = async (
  scope: PanelScope,
  userId?: string
): Promise<ReceiptOperation[]> => {
  const activeTaskWhere = {
    referenceType: RECEIPT_TASK_REFERENCE_TYPE,
    status: { in: OPEN_STATUSES },
    ...(scope === 'mine' ? { OR: [{ assignedTo: userId }, { assignedTo: null }] } : {}),
  };

  const activeRefs = await prisma.warehouseTask.findMany({
    where: activeTaskWhere,
    select: { reference: true },
    distinct: ['reference'],
  });
  const receiptIds = activeRefs
    .map((row) => row.reference)
    .filter((id): id is string => id !== null);

  if (receiptIds.length === 0) {
    return [];
  }

  const [receipts, tasks] = await Promise.all([
    prisma.purchaseReceipt.findMany({
      where: { id: { in: receiptIds } },
      select: { id: true, receiptNumber: true },
    }),
    prisma.warehouseTask.findMany({
      where: { referenceType: RECEIPT_TASK_REFERENCE_TYPE, reference: { in: receiptIds } },
      select: {
        ...taskSelect,
        assignee: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  const tasksByReceipt = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.reference) continue;
    const list = tasksByReceipt.get(task.reference) ?? [];
    list.push(task);
    tasksByReceipt.set(task.reference, list);
  }

  const receiptById = new Map(receipts.map((r) => [r.id, r]));

  return receiptIds
    .filter((id) => receiptById.has(id))
    .map((id) => ({
      receiptId: id,
      receiptNumber: receiptById.get(id)!.receiptNumber,
      tasks: (tasksByReceipt.get(id) ?? []).map(serializeTask),
    }))
    .sort((a, b) => a.receiptNumber.localeCompare(b.receiptNumber));
};
```

- [ ] **Step 4: Implementar o validator**

Em `backend/src/validators/warehouse-task.validator.ts`, adicionar ao final:

```ts
/**
 * `GET /warehouse-tasks/panel`. `.unknown(true)` mesmo motivo de
 * `myWarehouseTasksQuerySchema` — `validateQuery` não faz `stripUnknown`.
 */
export const panelQuerySchema = Joi.object({
  scope: Joi.string().valid('all', 'mine'),
}).unknown(true);
```

- [ ] **Step 5: Implementar o controller**

Em `backend/src/controllers/warehouse-task.controller.ts`, adicionar dentro da classe `WarehouseTaskController` (logo depois de `getByReceipt`):

```ts
  /** Painel de operações — recebimentos ativos com a cadeia completa. */
  async getPanel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const scope = (req.query.scope as 'all' | 'mine' | undefined) ?? 'all';
      const data = await warehouseTaskService.listActiveReceiptOperations(scope, req.userId!);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }
```

- [ ] **Step 6: Montar a rota**

Em `backend/src/routes/warehouse-task.routes.ts`, adicionar o import de `panelQuerySchema` junto aos demais imports de `../validators/warehouse-task.validator`, e adicionar a rota logo depois do bloco `GET /my` (segmento fixo, antes das paramétricas, mesma disciplina do arquivo):

```ts
// Painel de operações — recebimentos ativos com a cadeia completa de
// tarefas. RBAC: `recebimentos_compra:visualizar`, o mesmo recurso de
// `GET /receipt/:receiptId` logo abaixo — é a mesma leitura, só agregada.
router.get(
  '/panel',
  requirePermission('recebimentos_compra', 'visualizar'),
  validateQuery(panelQuerySchema),
  warehouseTaskController.getPanel
);
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `npm run test:integration -- tests/integration/wms-operations-panel.test.ts`
Expected: PASS — 8/8 testes.

- [ ] **Step 8: Rodar a suíte completa**

Run: `npm run test:integration`
Expected: PASS, sem regressão no total pré-existente.

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/warehouse-task.service.ts backend/src/controllers/warehouse-task.controller.ts backend/src/routes/warehouse-task.routes.ts backend/src/validators/warehouse-task.validator.ts backend/tests/integration/wms-operations-panel.test.ts
git commit -m "feat(backend): adiciona endpoint agregado do painel de operacoes do WMS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Frontend — tipos, serviços e store

**Files:**
- Create: `frontend/src/types/warehouse-task.types.ts`
- Create: `frontend/src/services/warehouse-task.service.ts`
- Create: `frontend/src/services/storage-rule.service.ts`
- Modify: `frontend/src/services/storage-position.service.ts` (adicionar `getPositionByCode`)
- Create: `frontend/src/stores/warehouse-task-panel.store.ts`
- Test: `frontend/src/stores/__tests__/warehouse-task-panel.store.spec.ts`

**Interfaces:**
- Consumes: `ApiEnvelope<T>` de `@/types/warehouse.types` (já existente).
- Produces: `WarehouseTaskType`, `WAREHOUSE_TASK_TYPE_LABELS`, `WarehouseTaskStatus`, `WarehouseTask`, `ReceiptOperation`, `PanelScope` (tipos); `warehouseTaskService` (`getPanel`, `start`, `complete`, `putaway`); `storageRuleService` (`suggestPosition`); `storagePositionService.getPositionByCode` (novo método no arquivo existente); `purchaseReceiptService` (`getById`, único método — o mínimo que este projeto precisa, não é o service completo do PR #8); `useWarehouseTaskPanelStore` — Tasks 3-7 importam estes diretamente.

- [ ] **Step 1: Tipos**

Create `frontend/src/types/warehouse-task.types.ts`:

```ts
// Os 7 tipos do motor de workflow dinâmico (PR #9). SEGREGACAO/AMOSTRAGEM
// ainda não existem no enum do backend deste branch (só depois do PR #9
// mesclar) — mantidos aqui porque é um superconjunto seguro: nenhuma tarefa
// real hoje tem esses dois tipos, então nunca há mismatch com o que a API
// atual devolve, e o frontend já nasce pronto para quando o PR #9 mesclar.
export const WAREHOUSE_TASK_TYPES = [
  'DESCARGA',
  'CONFERENCIA',
  'ETIQUETAGEM',
  'QUARENTENA',
  'SEGREGACAO',
  'AMOSTRAGEM',
  'ALOCACAO',
] as const

export type WarehouseTaskType = (typeof WAREHOUSE_TASK_TYPES)[number]

export const WAREHOUSE_TASK_TYPE_LABELS: Record<WarehouseTaskType, string> = {
  DESCARGA: 'Descarga',
  CONFERENCIA: 'Conferência',
  ETIQUETAGEM: 'Etiquetagem',
  QUARENTENA: 'Quarentena',
  SEGREGACAO: 'Segregação',
  AMOSTRAGEM: 'Amostragem',
  ALOCACAO: 'Alocação',
}

export type WarehouseTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface WarehouseTaskAssignee {
  id: string
  name: string
  email: string
}

export interface WarehouseTask {
  id: string
  type: WarehouseTaskType
  status: WarehouseTaskStatus
  reference: string | null
  referenceType: string | null
  sequence: number | null
  assignedTo: string | null
  assignee: WarehouseTaskAssignee | null
  productId: string | null
  quantity: string | null
  fromPositionId: string | null
  toPositionId: string | null
  version: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface ReceiptOperation {
  receiptId: string
  receiptNumber: string
  tasks: WarehouseTask[]
}

export type PanelScope = 'all' | 'mine'
```

- [ ] **Step 2: Serviço de tarefas**

Create `frontend/src/services/warehouse-task.service.ts`:

```ts
import api from '@/services/api'
import type { ApiEnvelope } from '@/types/warehouse.types'
import type { ReceiptOperation, PanelScope, WarehouseTask } from '@/types/warehouse-task.types'

export const warehouseTaskService = {
  async getPanel(scope: PanelScope) {
    return await api.get<ApiEnvelope<ReceiptOperation[]>>(`/warehouse-tasks/panel?scope=${scope}`)
  },

  /** F4.11 — atribui ao chamador (se livre) e marca IN_PROGRESS. Idempotente para o próprio dono. */
  async start(taskId: string) {
    return await api.post<ApiEnvelope<WarehouseTask>>(`/warehouse-tasks/${taskId}/start`)
  },

  /** Conclusão simples (Descarga/Conferência/Etiquetagem/Quarentena/Segregação/Amostragem). */
  async complete(taskId: string) {
    return await api.post<ApiEnvelope<WarehouseTask>>(`/warehouse-tasks/${taskId}/complete`, {})
  },

  /** Conclusão (parcial ou total) da Alocação. */
  async putaway(
    taskId: string,
    data: { receiptItemId: string; storagePositionId: string; quantity: number }
  ) {
    return await api.post<ApiEnvelope<{ receiptCompleted: boolean }>>(
      `/warehouse-tasks/${taskId}/putaway`,
      data
    )
  },
}

export default warehouseTaskService
```

- [ ] **Step 3: Serviço de sugestão de posição**

Create `frontend/src/services/storage-rule.service.ts`:

```ts
import api from '@/services/api'
import type { ApiEnvelope } from '@/types/warehouse.types'

export interface PositionSuggestion {
  positionId: string
  code: string
  positionType: string
  currentQuantity: string
  score: number
  reasons: string[]
}

export interface SuggestPositionResult {
  productId: string
  quantity: string
  appliedRuleId: string | null
  suggestion: PositionSuggestion | null
  alternatives: PositionSuggestion[]
  rejected: { code: string; reason: string }[]
}

export const storageRuleService = {
  async suggestPosition(productId: string, quantity: number) {
    return await api.get<ApiEnvelope<SuggestPositionResult>>(
      `/storage-rules/suggest?productId=${productId}&quantity=${quantity}`
    )
  },
}

export default storageRuleService
```

- [ ] **Step 4: Busca de posição por código (arquivo existente)**

Em `frontend/src/services/storage-position.service.ts`, adicionar (seguindo o estilo já usado neste arquivo — `./api.service`, `response.data` sem tipo `ApiEnvelope`, é o padrão antigo já estabelecido aqui; não generalizar o arquivo inteiro nesta task):

```ts
  async getPositionByCode(code: string) {
    const response = await api.get(`/storage-positions/by-code/${code}`);
    return response.data;
  },
```

(Inserir como mais um método do objeto `storagePositionService`, antes do fechamento `};` do objeto.)

- [ ] **Step 5: Serviço mínimo de recebimento (leitura só)**

Nenhum `purchase-receipt.service.ts` existe neste branch (a tela de recebimento é do PR #8, não mesclado) — mas a Task 7 precisa ler os itens do recebimento pra montar os modais de ação e o documento de apoio. Em vez de chamar `api.get` direto de dentro da view (quebraria a convenção de toda a base de sempre passar pela camada de serviço), criar um serviço mínimo, só com o que este projeto usa:

Create `frontend/src/services/purchase-receipt.service.ts`:

```ts
import api from '@/services/api'
import type { ApiEnvelope } from '@/types/warehouse.types'

export interface PurchaseReceiptItemDetail {
  id: string
  productId: string
  acceptedQty: number
  lotNumber: string | null
  product: { code: string; name: string; segregationGroup?: string | null }
}

export interface PurchaseReceiptDetail {
  id: string
  receiptNumber: string
  items: PurchaseReceiptItemDetail[]
  order: { supplier: { name: string } | null } | null
}

export const purchaseReceiptService = {
  async getById(id: string) {
    return await api.get<ApiEnvelope<PurchaseReceiptDetail>>(`/purchase-receipts/${id}`)
  },
}

export default purchaseReceiptService
```

- [ ] **Step 6: Store**

Create `frontend/src/stores/warehouse-task-panel.store.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import type { ReceiptOperation, PanelScope } from '@/types/warehouse-task.types'

export const useWarehouseTaskPanelStore = defineStore('warehouseTaskPanel', () => {
  const operations = ref<ReceiptOperation[]>([])
  const loading = ref(false)
  const error = ref('')

  const fetchPanel = async (scope: PanelScope): Promise<void> => {
    loading.value = true
    error.value = ''
    try {
      const response = await warehouseTaskService.getPanel(scope)
      operations.value = response.data.data || []
    } catch (err) {
      error.value = 'Não foi possível carregar o painel de operações.'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    operations,
    loading,
    error,
    fetchPanel,
  }
})
```

- [ ] **Step 7: Teste do store**

Create `frontend/src/stores/__tests__/warehouse-task-panel.store.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWarehouseTaskPanelStore } from '../warehouse-task-panel.store'
import warehouseTaskService from '@/services/warehouse-task.service'

vi.mock('@/services/warehouse-task.service', () => ({
  default: {
    getPanel: vi.fn(),
    start: vi.fn(),
    complete: vi.fn(),
    putaway: vi.fn(),
  },
}))

const mockOperation = {
  receiptId: 'r1',
  receiptNumber: 'REC-2026-0001',
  tasks: [
    { id: 't1', type: 'DESCARGA', status: 'PENDING', reference: 'r1', referenceType: 'PURCHASE_RECEIPT', sequence: 1, assignedTo: null, assignee: null, productId: null, quantity: null, fromPositionId: null, toPositionId: null, version: 0, createdAt: '', startedAt: null, completedAt: null },
  ],
}

describe('useWarehouseTaskPanelStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchPanel popula operations a partir do service', async () => {
    vi.mocked(warehouseTaskService.getPanel).mockResolvedValue({
      data: { status: 'success', data: [mockOperation] },
    } as any)

    const store = useWarehouseTaskPanelStore()
    await store.fetchPanel('all')

    expect(store.operations).toEqual([mockOperation])
    expect(warehouseTaskService.getPanel).toHaveBeenCalledWith('all')
  })

  it('em erro, define error e relança', async () => {
    vi.mocked(warehouseTaskService.getPanel).mockRejectedValue(new Error('network'))

    const store = useWarehouseTaskPanelStore()
    await expect(store.fetchPanel('mine')).rejects.toThrow('network')
    expect(store.error).not.toBe('')
  })

  it('loading fica true durante a chamada e false depois', async () => {
    let resolvePromise: (value: any) => void
    vi.mocked(warehouseTaskService.getPanel).mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve })
    )

    const store = useWarehouseTaskPanelStore()
    const promise = store.fetchPanel('all')
    expect(store.loading).toBe(true)

    resolvePromise!({ data: { status: 'success', data: [] } })
    await promise
    expect(store.loading).toBe(false)
  })
})
```

- [ ] **Step 8: Rodar os testes e o type-check**

Run: `npx vitest run src/stores/__tests__/warehouse-task-panel.store.spec.ts`
Expected: PASS — 3/3 testes.

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem de erros do baseline atual deste worktree (rodar antes de qualquer mudança para registrar o número, e comparar — este worktree é novo, o baseline ainda não foi confirmado nesta sessão).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/types/warehouse-task.types.ts frontend/src/services/warehouse-task.service.ts frontend/src/services/storage-rule.service.ts frontend/src/services/storage-position.service.ts frontend/src/services/purchase-receipt.service.ts frontend/src/stores/warehouse-task-panel.store.ts frontend/src/stores/__tests__/warehouse-task-panel.store.spec.ts
git commit -m "feat(frontend): adiciona tipos, servicos e store do painel de operacoes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Frontend — `TaskRectangle.vue` (componente puro de retângulo + cálculo de estado)

**Files:**
- Create: `frontend/src/components/wms/TaskRectangle.vue`
- Create: `frontend/src/components/wms/task-rectangle-state.ts`
- Test: `frontend/src/components/wms/__tests__/task-rectangle-state.spec.ts`
- Test: `frontend/src/components/wms/__tests__/TaskRectangle.spec.ts`

**Interfaces:**
- Consumes: `WarehouseTask`, `WAREHOUSE_TASK_TYPE_LABELS` de `@/types/warehouse-task.types` (Task 2).
- Produces: `computeTaskRectangleState(tasks, task, currentUserId): RectangleState` (`RectangleState = 'completed' | 'active-mine' | 'active-other' | 'locked'`); componente `TaskRectangle.vue` com props `task: WarehouseTask`, `state: RectangleState`, emit `click: []` — Task 6 (a view do painel) consome os dois diretamente.

- [ ] **Step 1: Escrever o teste da função de estado (pura, TDD)**

Create `frontend/src/components/wms/__tests__/task-rectangle-state.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeTaskRectangleState } from '../task-rectangle-state'
import type { WarehouseTask } from '@/types/warehouse-task.types'

function task(overrides: Partial<WarehouseTask>): WarehouseTask {
  return {
    id: 't1',
    type: 'DESCARGA',
    status: 'PENDING',
    reference: 'r1',
    referenceType: 'PURCHASE_RECEIPT',
    sequence: 1,
    assignedTo: null,
    assignee: null,
    productId: null,
    quantity: null,
    fromPositionId: null,
    toPositionId: null,
    version: 0,
    createdAt: '',
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

describe('computeTaskRectangleState', () => {
  it('tarefa COMPLETED é "completed", independente da posição na cadeia', () => {
    const t1 = task({ id: 't1', status: 'COMPLETED', sequence: 1 })
    const t2 = task({ id: 't2', status: 'PENDING', sequence: 2 })
    expect(computeTaskRectangleState([t1, t2], t1, 'me')).toBe('completed')
  })

  it('tarefa CANCELLED também é "completed" (resolvida, mesmo critério do backend)', () => {
    const t1 = task({ id: 't1', status: 'CANCELLED', sequence: 1 })
    expect(computeTaskRectangleState([t1], t1, 'me')).toBe('completed')
  })

  it('a PRIMEIRA tarefa não resolvida é "active-mine" quando livre', () => {
    const t1 = task({ id: 't1', status: 'COMPLETED', sequence: 1 })
    const t2 = task({ id: 't2', status: 'PENDING', sequence: 2, assignedTo: null })
    expect(computeTaskRectangleState([t1, t2], t2, 'me')).toBe('active-mine')
  })

  it('a primeira tarefa não resolvida é "active-mine" quando atribuída ao usuário atual', () => {
    const t1 = task({ id: 't1', status: 'PENDING', sequence: 1, assignedTo: 'me' })
    expect(computeTaskRectangleState([t1], t1, 'me')).toBe('active-mine')
  })

  it('a primeira tarefa não resolvida é "active-other" quando atribuída a outro usuário', () => {
    const t1 = task({ id: 't1', status: 'IN_PROGRESS', sequence: 1, assignedTo: 'other-user' })
    expect(computeTaskRectangleState([t1], t1, 'me')).toBe('active-other')
  })

  it('qualquer tarefa depois da ativa é "locked"', () => {
    const t1 = task({ id: 't1', status: 'PENDING', sequence: 1, assignedTo: null })
    const t2 = task({ id: 't2', status: 'PENDING', sequence: 2, assignedTo: null })
    expect(computeTaskRectangleState([t1, t2], t2, 'me')).toBe('locked')
  })

  it('cadeia inteira concluída: não há "active", mas cada tarefa é "completed"', () => {
    const t1 = task({ id: 't1', status: 'COMPLETED', sequence: 1 })
    const t2 = task({ id: 't2', status: 'COMPLETED', sequence: 2 })
    expect(computeTaskRectangleState([t1, t2], t1, 'me')).toBe('completed')
    expect(computeTaskRectangleState([t1, t2], t2, 'me')).toBe('completed')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/components/wms/__tests__/task-rectangle-state.spec.ts`
Expected: FAIL — `Cannot find module '../task-rectangle-state'`

- [ ] **Step 3: Implementar a função de estado**

Create `frontend/src/components/wms/task-rectangle-state.ts`:

```ts
import type { WarehouseTask } from '@/types/warehouse-task.types'

export type RectangleState = 'completed' | 'active-mine' | 'active-other' | 'locked'

const RESOLVED_STATUSES = ['COMPLETED', 'CANCELLED']

/**
 * Mesmo critério do gate `assertChainOrderResolved` do backend: a tarefa
 * "ativa" é a primeira, na ordem em que a lista já vem ordenada (sequence
 * asc, createdAt asc), que ainda não está resolvida. `tasks` precisa vir
 * pré-ordenada — a mesma ordem que `GET /warehouse-tasks/panel` já devolve.
 */
export function computeTaskRectangleState(
  tasks: WarehouseTask[],
  task: WarehouseTask,
  currentUserId: string
): RectangleState {
  if (RESOLVED_STATUSES.includes(task.status)) {
    return 'completed'
  }

  const firstUnresolved = tasks.find((t) => !RESOLVED_STATUSES.includes(t.status))

  if (firstUnresolved?.id !== task.id) {
    return 'locked'
  }

  return task.assignedTo === null || task.assignedTo === currentUserId
    ? 'active-mine'
    : 'active-other'
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/components/wms/__tests__/task-rectangle-state.spec.ts`
Expected: PASS — 7/7 testes.

- [ ] **Step 5: Componente visual**

Create `frontend/src/components/wms/TaskRectangle.vue`:

```vue
<template>
  <button
    type="button"
    class="px-3 py-2 rounded-lg border-2 text-xs font-semibold whitespace-nowrap transition-colors"
    :class="classesByState[state]"
    :disabled="state === 'locked'"
    @click="emit('click')"
  >
    {{ WAREHOUSE_TASK_TYPE_LABELS[task.type] }}
    <span v-if="state === 'completed'" aria-hidden="true">✓</span>
  </button>
</template>

<script setup lang="ts">
import { WAREHOUSE_TASK_TYPE_LABELS } from '@/types/warehouse-task.types'
import type { WarehouseTask } from '@/types/warehouse-task.types'
import type { RectangleState } from './task-rectangle-state'

defineProps<{ task: WarehouseTask; state: RectangleState }>()
const emit = defineEmits<{ click: [] }>()

const classesByState: Record<RectangleState, string> = {
  completed: 'border-green-500 bg-green-50 text-green-800 cursor-pointer hover:bg-green-100',
  'active-mine': 'border-primary-500 bg-primary-50 text-primary-800 cursor-pointer hover:bg-primary-100 ring-2 ring-primary-300',
  'active-other': 'border-yellow-500 bg-yellow-50 text-yellow-800 cursor-pointer hover:bg-yellow-100',
  locked: 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed',
}
</script>
```

- [ ] **Step 6: Teste do componente**

Create `frontend/src/components/wms/__tests__/TaskRectangle.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TaskRectangle from '../TaskRectangle.vue'

const task = {
  id: 't1', type: 'CONFERENCIA' as const, status: 'PENDING' as const, reference: 'r1',
  referenceType: 'PURCHASE_RECEIPT', sequence: 2, assignedTo: null, assignee: null,
  productId: null, quantity: null, fromPositionId: null, toPositionId: null,
  version: 0, createdAt: '', startedAt: null, completedAt: null,
}

describe('TaskRectangle', () => {
  it('mostra o rótulo do tipo da tarefa', () => {
    const wrapper = mount(TaskRectangle, { props: { task, state: 'active-mine' } })
    expect(wrapper.text()).toContain('Conferência')
  })

  it('fica desabilitado quando bloqueada', () => {
    const wrapper = mount(TaskRectangle, { props: { task, state: 'locked' } })
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('não fica desabilitado quando ativa (mesmo active-other, que é clicável pra ver detalhe)', () => {
    const wrapper = mount(TaskRectangle, { props: { task, state: 'active-other' } })
    expect(wrapper.find('button').attributes('disabled')).toBeUndefined()
  })

  it('emite click ao ser clicado', async () => {
    const wrapper = mount(TaskRectangle, { props: { task, state: 'active-mine' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
  })
})
```

- [ ] **Step 7: Rodar os testes e o type-check**

Run: `npx vitest run src/components/wms/__tests__/task-rectangle-state.spec.ts src/components/wms/__tests__/TaskRectangle.spec.ts`
Expected: PASS — 11/11 testes.

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem do baseline (Task 2).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/wms/TaskRectangle.vue frontend/src/components/wms/task-rectangle-state.ts frontend/src/components/wms/__tests__/task-rectangle-state.spec.ts frontend/src/components/wms/__tests__/TaskRectangle.spec.ts
git commit -m "feat(frontend): adiciona retangulo de tarefa e calculo de estado da cadeia

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Frontend — documentos de apoio impressos por tipo de etapa

**Files:**
- Create: `frontend/src/utils/task-support-document.ts`
- Test: `frontend/src/utils/__tests__/task-support-document.spec.ts`

**Interfaces:**
- Consumes: `generatePDF` de `@/utils/pdf-generator` (já existente, sem alteração); `WarehouseTaskType`, `WAREHOUSE_TASK_TYPE_LABELS` de `@/types/warehouse-task.types` (Task 2).
- Produces: `buildTaskSupportDocument(params: TaskSupportDocumentParams): jsPDF` — Task 5 (modais de ação) chama isto no botão "Imprimir documento de apoio".

- [ ] **Step 1: Escrever o teste**

Create `frontend/src/utils/__tests__/task-support-document.spec.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { buildTaskSupportDocument } from '../task-support-document'
import * as pdfGenerator from '../pdf-generator'

describe('buildTaskSupportDocument', () => {
  const baseParams = {
    taskType: 'CONFERENCIA' as const,
    receiptNumber: 'REC-2026-0001',
    supplierName: 'Fornecedor Exemplo',
    items: [
      { code: 'PROD-001', name: 'Parafuso M6', quantity: '100', lotNumber: null, segregationGroup: null },
    ],
    positions: [],
  }

  it('chama generatePDF com título específico do tipo de etapa', () => {
    const spy = vi.spyOn(pdfGenerator, 'generatePDF')
    buildTaskSupportDocument(baseParams)

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining('Conferência') })
    )
  });

  it('Conferência adiciona a coluna "Conferido" em branco', () => {
    const spy = vi.spyOn(pdfGenerator, 'generatePDF')
    buildTaskSupportDocument(baseParams)

    const call = spy.mock.calls[0][0]
    expect(call.itemsColumns?.some((c) => c.header === 'Conferido')).toBe(true)
  });

  it('Alocação inclui a coluna de posição sugerida quando fornecida', () => {
    const spy = vi.spyOn(pdfGenerator, 'generatePDF')
    buildTaskSupportDocument({
      ...baseParams,
      taskType: 'ALOCACAO',
      positions: [{ productCode: 'PROD-001', suggestedCode: 'ARM-A-01-01' }],
    })

    const call = spy.mock.calls[0][0]
    expect(call.itemsColumns?.some((c) => c.header === 'Posição sugerida')).toBe(true)
    expect(call.items?.[0]['Posição sugerida']).toBe('ARM-A-01-01')
  });

  it('Etiquetagem inclui coluna de lote só quando o item tem lote', () => {
    const spy = vi.spyOn(pdfGenerator, 'generatePDF')
    buildTaskSupportDocument({
      ...baseParams,
      taskType: 'ETIQUETAGEM',
      items: [{ code: 'PROD-002', name: 'Produto com lote', quantity: '10', lotNumber: 'L-2026-01', segregationGroup: null }],
    })

    const call = spy.mock.calls[0][0]
    expect(call.itemsColumns?.some((c) => c.header === 'Lote')).toBe(true)
  });

  it('tipos desconhecidos (fora dos 7 mapeados) lançam erro claro em vez de gerar documento vazio', () => {
    expect(() =>
      buildTaskSupportDocument({ ...baseParams, taskType: 'INEXISTENTE' as any })
    ).toThrow(/tipo de etapa/i)
  });
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/utils/__tests__/task-support-document.spec.ts`
Expected: FAIL — `Cannot find module '../task-support-document'`

- [ ] **Step 3: Implementar**

Create `frontend/src/utils/task-support-document.ts`:

```ts
import { generatePDF } from './pdf-generator'
import { WAREHOUSE_TASK_TYPE_LABELS } from '@/types/warehouse-task.types'
import type { WarehouseTaskType } from '@/types/warehouse-task.types'

export interface TaskSupportDocumentItem {
  code: string
  name: string
  quantity: string
  lotNumber: string | null
  segregationGroup: string | null
}

export interface TaskSupportDocumentPosition {
  productCode: string
  suggestedCode: string | null
}

export interface TaskSupportDocumentParams {
  taskType: WarehouseTaskType
  receiptNumber: string
  supplierName: string
  items: TaskSupportDocumentItem[]
  positions: TaskSupportDocumentPosition[]
}

type ItemColumn = { header: string; key: string; align?: 'left' | 'center' | 'right' }

const BASE_COLUMNS: ItemColumn[] = [
  { header: 'Código', key: 'Código' },
  { header: 'Produto', key: 'Produto' },
  { header: 'Quantidade', key: 'Quantidade', align: 'right' },
]

/**
 * Um gerador só, configurado por tipo de etapa — todos os 7 tipos
 * compartilham a mesma base (itens do recebimento) e só divergem em colunas
 * extras/observação. Ver a tabela do spec
 * (docs/superpowers/specs/2026-09-04-painel-operacoes-wms-design.md, seção 3).
 */
export function buildTaskSupportDocument(params: TaskSupportDocumentParams) {
  const { taskType, receiptNumber, supplierName, items, positions } = params

  const label = WAREHOUSE_TASK_TYPE_LABELS[taskType]
  if (!label) {
    throw new Error(`Documento de apoio não definido para o tipo de etapa "${taskType}".`)
  }

  const extraColumns: ItemColumn[] = []
  const hasLotItem = items.some((item) => item.lotNumber)
  const hasSegregationItem = items.some((item) => item.segregationGroup)

  switch (taskType) {
    case 'CONFERENCIA':
      extraColumns.push({ header: 'Conferido', key: 'Conferido' })
      break
    case 'ETIQUETAGEM':
      if (hasLotItem) extraColumns.push({ header: 'Lote', key: 'Lote' })
      break
    case 'QUARENTENA':
      extraColumns.push({ header: 'Resultado da inspeção', key: 'Resultado' })
      break
    case 'SEGREGACAO':
      if (hasSegregationItem) extraColumns.push({ header: 'Grupo de segregação', key: 'Grupo' })
      extraColumns.push({ header: 'Justificativa', key: 'Justificativa' })
      break
    case 'AMOSTRAGEM':
      extraColumns.push({ header: 'Qtd. coletada', key: 'Qtd. coletada' })
      extraColumns.push({ header: 'Referência de laboratório', key: 'Ref. laboratório' })
      break
    case 'ALOCACAO':
      extraColumns.push({ header: 'Posição sugerida', key: 'Posição sugerida' })
      break
    case 'DESCARGA':
      // Base (código/produto/quantidade) já é o manifesto — sem coluna extra.
      break
  }

  const positionByProductCode = new Map(positions.map((p) => [p.productCode, p.suggestedCode]))

  const tableItems = items.map((item) => ({
    Código: item.code,
    Produto: item.name,
    Quantidade: item.quantity,
    ...(taskType === 'ETIQUETAGEM' && hasLotItem ? { Lote: item.lotNumber ?? '' } : {}),
    ...(taskType === 'SEGREGACAO' && hasSegregationItem ? { Grupo: item.segregationGroup ?? '' } : {}),
    ...(taskType === 'ALOCACAO' ? { 'Posição sugerida': positionByProductCode.get(item.code) ?? '' } : {}),
  }))

  return generatePDF({
    title: `${label} — Recebimento ${receiptNumber}`,
    subtitle: supplierName,
    data: { 'Nº do Recebimento': receiptNumber, Fornecedor: supplierName },
    items: tableItems,
    itemsColumns: [...BASE_COLUMNS, ...extraColumns],
  })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/utils/__tests__/task-support-document.spec.ts`
Expected: PASS — 5/5 testes.

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem do baseline.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/utils/task-support-document.ts frontend/src/utils/__tests__/task-support-document.spec.ts
git commit -m "feat(frontend): adiciona gerador de documento de apoio por tipo de etapa

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Frontend — modal de ação simples (Descarga/Conferência/Etiquetagem/Quarentena/Segregação/Amostragem)

**Files:**
- Create: `frontend/src/components/wms/SimpleTaskActionModal.vue`
- Test: `frontend/src/components/wms/__tests__/SimpleTaskActionModal.spec.ts`

**Interfaces:**
- Consumes: `AppModal` (`frontend/src/components/common/AppModal.vue`, já existente); `WAREHOUSE_TASK_TYPE_LABELS` (Task 2); `buildTaskSupportDocument` (Task 4); `warehouseTaskService.complete` (Task 2).
- Produces: componente com props `modelValue: boolean`, `task: WarehouseTask`, `receiptNumber: string`, `supplierName: string`, `items: TaskSupportDocumentItem[]`; emits `update:modelValue`, `completed` — Task 6 (a view do painel) o monta para os 6 tipos simples.

- [ ] **Step 1: Implementar**

Create `frontend/src/components/wms/SimpleTaskActionModal.vue`:

```vue
<template>
  <AppModal :model-value="modelValue" title="Conduzir etapa" size="sm" @update:model-value="emit('update:modelValue', $event)">
    <p class="text-sm text-gray-700 mb-4">
      Confirmar a conclusão da etapa <strong>{{ WAREHOUSE_TASK_TYPE_LABELS[task.type] }}</strong>
      do recebimento <strong>{{ receiptNumber }}</strong>?
    </p>

    <div v-if="errorMessage" class="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <button
      type="button"
      class="text-sm text-primary-600 hover:underline mb-4"
      @click="printSupportDocument"
    >
      🖨️ Imprimir documento de apoio
    </button>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button type="button" class="px-4 py-2 text-sm text-gray-700" @click="emit('update:modelValue', false)">
          Cancelar
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          :disabled="submitting"
          @click="handleConfirm"
        >
          {{ submitting ? 'Concluindo...' : 'Concluir etapa' }}
        </button>
      </div>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import AppModal from '@/components/common/AppModal.vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import { buildTaskSupportDocument } from '@/utils/task-support-document'
import { WAREHOUSE_TASK_TYPE_LABELS } from '@/types/warehouse-task.types'
import type { WarehouseTask } from '@/types/warehouse-task.types'
import type { TaskSupportDocumentItem } from '@/utils/task-support-document'

const props = defineProps<{
  modelValue: boolean
  task: WarehouseTask
  receiptNumber: string
  supplierName: string
  items: TaskSupportDocumentItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  completed: []
}>()

const submitting = ref(false)
const errorMessage = ref('')

function printSupportDocument(): void {
  const doc = buildTaskSupportDocument({
    taskType: props.task.type,
    receiptNumber: props.receiptNumber,
    supplierName: props.supplierName,
    items: props.items,
    positions: [],
  })
  doc.save(`${props.task.type.toLowerCase()}-${props.receiptNumber}.pdf`)
}

async function handleConfirm(): Promise<void> {
  submitting.value = true
  errorMessage.value = ''
  try {
    await warehouseTaskService.complete(props.task.id)
    emit('completed')
    emit('update:modelValue', false)
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.message ?? 'Erro ao concluir a etapa.'
  } finally {
    submitting.value = false
  }
}
</script>
```

- [ ] **Step 2: Escrever o teste**

Create `frontend/src/components/wms/__tests__/SimpleTaskActionModal.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SimpleTaskActionModal from '../SimpleTaskActionModal.vue'
import warehouseTaskService from '@/services/warehouse-task.service'

vi.mock('@/services/warehouse-task.service', () => ({
  default: { complete: vi.fn() },
}))

const task = {
  id: 't1', type: 'CONFERENCIA' as const, status: 'IN_PROGRESS' as const, reference: 'r1',
  referenceType: 'PURCHASE_RECEIPT', sequence: 2, assignedTo: 'me', assignee: null,
  productId: null, quantity: null, fromPositionId: null, toPositionId: null,
  version: 0, createdAt: '', startedAt: null, completedAt: null,
}

const baseProps = {
  modelValue: true,
  task,
  receiptNumber: 'REC-2026-0001',
  supplierName: 'Fornecedor Exemplo',
  items: [{ code: 'P1', name: 'Produto 1', quantity: '10', lotNumber: null, segregationGroup: null }],
}

describe('SimpleTaskActionModal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ao confirmar, chama warehouseTaskService.complete com o id da tarefa e emite completed', async () => {
    vi.mocked(warehouseTaskService.complete).mockResolvedValue({ data: { status: 'success', data: task } } as any)

    const wrapper = mount(SimpleTaskActionModal, { props: baseProps })
    await wrapper.find('button.bg-primary-600').trigger('click')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(warehouseTaskService.complete).toHaveBeenCalledWith('t1')
    expect(wrapper.emitted('completed')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.pop()).toEqual([false])
  })

  it('em erro, mostra a mensagem e NÃO emite completed', async () => {
    vi.mocked(warehouseTaskService.complete).mockRejectedValue({
      response: { data: { message: 'Tarefa já concluída' } },
    })

    const wrapper = mount(SimpleTaskActionModal, { props: baseProps })
    await wrapper.find('button.bg-primary-600').trigger('click')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.text()).toContain('Tarefa já concluída')
    expect(wrapper.emitted('completed')).toBeFalsy()
  })
})
```

- [ ] **Step 3: Rodar os testes**

Run: `npx vitest run src/components/wms/__tests__/SimpleTaskActionModal.spec.ts`
Expected: PASS — 2/2 testes.

- [ ] **Step 4: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem do baseline.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/wms/SimpleTaskActionModal.vue frontend/src/components/wms/__tests__/SimpleTaskActionModal.spec.ts
git commit -m "feat(frontend): adiciona modal de conclusao simples de etapa

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Frontend — mini-formulário de Alocação (`PutawayActionModal.vue`)

**Files:**
- Create: `frontend/src/components/wms/PutawayActionModal.vue`
- Test: `frontend/src/components/wms/__tests__/PutawayActionModal.spec.ts`

**Interfaces:**
- Consumes: `AppModal`, `FormField` (já existentes); `storageRuleService.suggestPosition`, `storagePositionService.getPositionByCode` (Task 2); `buildTaskSupportDocument` (Task 4); `warehouseTaskService.putaway` (Task 2).
- Produces: componente com props `modelValue: boolean`, `task: WarehouseTask`, `receiptNumber: string`, `supplierName: string`, `items: (TaskSupportDocumentItem & { receiptItemId: string; productId: string })[]`; emits `update:modelValue`, `completed` — Task 7 monta para o tipo `ALOCACAO`.

**Nota de escopo (ver Global Constraints):** não existe tela de endereçamento no frontend hoje — este é o primeiro mini-formulário de putaway do projeto. Cobre o caso mais comum (endereçar UM item do recebimento por vez, escolhendo a posição sugerida ou digitando um código) — não tenta reproduzir toda a superfície de `/putaway` (que suporta múltiplas chamadas parciais por item); reabrir o modal para o próximo item/posição é o fluxo esperado.

- [ ] **Step 1: Implementar**

Create `frontend/src/components/wms/PutawayActionModal.vue`:

```vue
<template>
  <AppModal :model-value="modelValue" title="Alocação" size="md" @update:model-value="emit('update:modelValue', $event)">
    <p class="text-sm text-gray-700 mb-4">
      Endereçar itens do recebimento <strong>{{ receiptNumber }}</strong>.
    </p>

    <button type="button" class="text-sm text-primary-600 hover:underline mb-4" @click="printSupportDocument">
      🖨️ Imprimir documento de apoio
    </button>

    <FormField label="Item" required class="mb-3">
      <select v-model="selectedItemId" class="w-full rounded-md border-gray-300 text-sm" @change="onItemChange">
        <option v-for="item in items" :key="item.receiptItemId" :value="item.receiptItemId">
          {{ item.code }} — {{ item.name }} ({{ item.quantity }})
        </option>
      </select>
    </FormField>

    <FormField label="Posição sugerida" hint="Clique para usar, ou digite outro código abaixo" class="mb-3">
      <p v-if="loadingSuggestion" class="text-xs text-gray-500">Buscando sugestão...</p>
      <button
        v-else-if="suggestion"
        type="button"
        class="text-sm border border-primary-300 rounded-md px-3 py-1 bg-primary-50 hover:bg-primary-100"
        @click="positionCode = suggestion!.code; storagePositionId = suggestion!.positionId"
      >
        {{ suggestion.code }} (score {{ suggestion.score }})
      </button>
      <p v-else class="text-xs text-gray-500">Nenhuma sugestão disponível — informe a posição manualmente.</p>
    </FormField>

    <FormField label="Posição (código)" required class="mb-3">
      <input
        v-model="positionCode"
        type="text"
        class="w-full rounded-md border-gray-300 text-sm"
        placeholder="ARM-RUA-AA-PP"
        @blur="resolvePositionCode"
      />
      <p v-if="positionResolutionError" class="text-xs text-red-600 mt-1">{{ positionResolutionError }}</p>
    </FormField>

    <FormField label="Quantidade" required class="mb-3">
      <input v-model.number="quantity" type="number" min="0" step="0.01" class="w-full rounded-md border-gray-300 text-sm" />
    </FormField>

    <div v-if="errorMessage" class="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button type="button" class="px-4 py-2 text-sm text-gray-700" @click="emit('update:modelValue', false)">
          Fechar
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          :disabled="submitting || !storagePositionId || !quantity"
          @click="handleConfirm"
        >
          {{ submitting ? 'Endereçando...' : 'Endereçar' }}
        </button>
      </div>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AppModal from '@/components/common/AppModal.vue'
import FormField from '@/components/common/FormField.vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import storageRuleService from '@/services/storage-rule.service'
import { storagePositionService } from '@/services/storage-position.service'
import { buildTaskSupportDocument } from '@/utils/task-support-document'
import type { WarehouseTask } from '@/types/warehouse-task.types'
import type { PositionSuggestion } from '@/services/storage-rule.service'
import type { TaskSupportDocumentItem } from '@/utils/task-support-document'

type PutawayItem = TaskSupportDocumentItem & { receiptItemId: string; productId: string }

const props = defineProps<{
  modelValue: boolean
  task: WarehouseTask
  receiptNumber: string
  supplierName: string
  items: PutawayItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  completed: []
}>()

const selectedItemId = ref(props.items[0]?.receiptItemId ?? '')
const positionCode = ref('')
const storagePositionId = ref('')
const quantity = ref<number | null>(null)
const suggestion = ref<PositionSuggestion | null>(null)
const loadingSuggestion = ref(false)
const positionResolutionError = ref('')
const errorMessage = ref('')
const submitting = ref(false)

function currentItem(): PutawayItem | undefined {
  return props.items.find((item) => item.receiptItemId === selectedItemId.value)
}

async function onItemChange(): Promise<void> {
  suggestion.value = null
  storagePositionId.value = ''
  positionCode.value = ''
  positionResolutionError.value = ''
  const item = currentItem()
  if (!item) return

  quantity.value = Number(item.quantity)
  loadingSuggestion.value = true
  try {
    const response = await storageRuleService.suggestPosition(item.productId, Number(item.quantity))
    suggestion.value = response.data.data.suggestion
  } catch {
    // Sugestão é best-effort — falha aqui não impede o endereçamento manual.
    suggestion.value = null
  } finally {
    loadingSuggestion.value = false
  }
}

async function resolvePositionCode(): Promise<void> {
  positionResolutionError.value = ''
  if (!positionCode.value.trim()) return

  try {
    const response = await storagePositionService.getPositionByCode(positionCode.value.trim())
    storagePositionId.value = response.data.id
  } catch {
    storagePositionId.value = ''
    positionResolutionError.value = 'Posição não encontrada com este código.'
  }
}

function printSupportDocument(): void {
  const doc = buildTaskSupportDocument({
    taskType: 'ALOCACAO',
    receiptNumber: props.receiptNumber,
    supplierName: props.supplierName,
    items: props.items,
    positions: props.items.map((item) => ({
      productCode: item.code,
      suggestedCode: item.receiptItemId === selectedItemId.value ? suggestion.value?.code ?? null : null,
    })),
  })
  doc.save(`alocacao-${props.receiptNumber}.pdf`)
}

async function handleConfirm(): Promise<void> {
  const item = currentItem()
  if (!item || !storagePositionId.value || !quantity.value) return

  submitting.value = true
  errorMessage.value = ''
  try {
    await warehouseTaskService.putaway(props.task.id, {
      receiptItemId: item.receiptItemId,
      storagePositionId: storagePositionId.value,
      quantity: quantity.value,
    })
    emit('completed')
    emit('update:modelValue', false)
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.message ?? 'Erro ao endereçar o item.'
  } finally {
    submitting.value = false
  }
}

watch(() => props.modelValue, (visible) => {
  if (visible) {
    selectedItemId.value = props.items[0]?.receiptItemId ?? ''
    onItemChange()
  }
})
</script>
```

- [ ] **Step 2: Escrever o teste**

Create `frontend/src/components/wms/__tests__/PutawayActionModal.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PutawayActionModal from '../PutawayActionModal.vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import storageRuleService from '@/services/storage-rule.service'
import { storagePositionService } from '@/services/storage-position.service'

vi.mock('@/services/warehouse-task.service', () => ({ default: { putaway: vi.fn() } }))
vi.mock('@/services/storage-rule.service', () => ({ default: { suggestPosition: vi.fn() } }))
vi.mock('@/services/storage-position.service', () => ({
  storagePositionService: { getPositionByCode: vi.fn() },
}))

const task = {
  id: 't1', type: 'ALOCACAO' as const, status: 'IN_PROGRESS' as const, reference: 'r1',
  referenceType: 'PURCHASE_RECEIPT', sequence: 5, assignedTo: 'me', assignee: null,
  productId: null, quantity: null, fromPositionId: null, toPositionId: null,
  version: 0, createdAt: '', startedAt: null, completedAt: null,
}

const baseProps = {
  modelValue: true,
  task,
  receiptNumber: 'REC-2026-0001',
  supplierName: 'Fornecedor Exemplo',
  items: [{ receiptItemId: 'ri1', productId: 'p1', code: 'PROD-001', name: 'Produto 1', quantity: '10', lotNumber: null, segregationGroup: null }],
}

describe('PutawayActionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(storageRuleService.suggestPosition).mockResolvedValue({
      data: { status: 'success', data: { suggestion: { positionId: 'pos1', code: 'ARM-A-01-01', positionType: 'RUA', currentQuantity: '0', score: 10, reasons: [] }, alternatives: [], rejected: [], productId: 'p1', quantity: '10', appliedRuleId: null } },
    } as any)
  })

  it('ao selecionar a sugestão e confirmar, chama putaway com a posição sugerida', async () => {
    vi.mocked(warehouseTaskService.putaway).mockResolvedValue({ data: { status: 'success', data: { receiptCompleted: false } } } as any)

    const wrapper = mount(PutawayActionModal, { props: baseProps })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    const suggestionButton = wrapper.findAll('button').find((b) => b.text().includes('ARM-A-01-01'))
    expect(suggestionButton).toBeTruthy()
    await suggestionButton!.trigger('click')

    const confirmButton = wrapper.findAll('button').find((b) => b.text().includes('Endereçar'))!
    await confirmButton.trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(warehouseTaskService.putaway).toHaveBeenCalledWith('t1', {
      receiptItemId: 'ri1',
      storagePositionId: 'pos1',
      quantity: 10,
    })
    expect(wrapper.emitted('completed')).toBeTruthy()
  })

  it('digitar um código manual resolve o id da posição via getPositionByCode no blur', async () => {
    vi.mocked(storagePositionService.getPositionByCode).mockResolvedValue({ data: { id: 'pos2', code: 'ARM-B-02-02' } } as any)

    const wrapper = mount(PutawayActionModal, { props: baseProps })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const input = wrapper.find('input[placeholder="ARM-RUA-AA-PP"]')
    await input.setValue('ARM-B-02-02')
    await input.trigger('blur')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(storagePositionService.getPositionByCode).toHaveBeenCalledWith('ARM-B-02-02')
  })

  it('código de posição inválido mostra erro e não deixa confirmar', async () => {
    vi.mocked(storagePositionService.getPositionByCode).mockRejectedValue(new Error('not found'))

    const wrapper = mount(PutawayActionModal, { props: baseProps })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const input = wrapper.find('input[placeholder="ARM-RUA-AA-PP"]')
    await input.setValue('CODIGO-INEXISTENTE')
    await input.trigger('blur')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.text()).toContain('Posição não encontrada')
    const confirmButton = wrapper.findAll('button').find((b) => b.text().includes('Endereçar'))!
    expect(confirmButton.attributes('disabled')).toBeDefined()
  })
})
```

- [ ] **Step 3: Rodar os testes**

Run: `npx vitest run src/components/wms/__tests__/PutawayActionModal.spec.ts`
Expected: PASS — 3/3 testes.

- [ ] **Step 4: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem do baseline.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/wms/PutawayActionModal.vue frontend/src/components/wms/__tests__/PutawayActionModal.spec.ts
git commit -m "feat(frontend): adiciona mini-formulario de alocacao do painel de operacoes

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Frontend — `OperationsPanelView.vue` (a tela), rotas e Dashboard

**Files:**
- Create: `frontend/src/views/wms/OperationsPanelView.vue`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`
- Test: `frontend/src/views/wms/__tests__/operations-panel-grouping.spec.ts`

**Interfaces:**
- Consumes: `useWarehouseTaskPanelStore` (Task 2); `TaskRectangle.vue`, `computeTaskRectangleState` (Task 3); `SimpleTaskActionModal.vue` (Task 5); `PutawayActionModal.vue` (Task 6); `warehouseTaskService.start` (Task 2); `AppLayout`, `AppModal` (já existentes).
- Produces: rota `/wms/operations` (com alternância "Todas"/"Minhas" na própria tela, via query `?scope=`).

**Nota de escopo:** o modal de confirmação "Pegar esta tarefa?" chama `POST /warehouse-tasks/:id/start` (já existe, F4.11) — que atribui ao usuário atual E marca `IN_PROGRESS` numa chamada só; o modal de ação (simples ou Alocação) só abre DEPOIS dessa confirmação, quando a tarefa já não é mais "sem dono".

- [ ] **Step 1: Extrair a lógica de item do recebimento pra alimentar os modais (função pura, testável sem montar a view)**

Create `frontend/src/views/wms/operations-panel-items.ts`:

```ts
export interface ReceiptItemLike {
  id: string
  productId: string
  quantity: number
  lotNumber: string | null
  product: { code: string; name: string; segregationGroup?: string | null }
}

export interface OperationItemForDocument {
  receiptItemId: string
  productId: string
  code: string
  name: string
  quantity: string
  lotNumber: string | null
  segregationGroup: string | null
}

/** Converte os itens de `GET /purchase-receipts/:id` para o formato que os modais de ação e o gerador de documento consomem. */
export function toOperationItems(items: ReceiptItemLike[]): OperationItemForDocument[] {
  return items.map((item) => ({
    receiptItemId: item.id,
    productId: item.productId,
    code: item.product.code,
    name: item.product.name,
    quantity: String(item.quantity),
    lotNumber: item.lotNumber,
    segregationGroup: item.product.segregationGroup ?? null,
  }))
}
```

- [ ] **Step 2: Escrever o teste da conversão**

Create `frontend/src/views/wms/__tests__/operations-panel-items.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toOperationItems } from '../operations-panel-items'

describe('toOperationItems', () => {
  it('converte item do recebimento para o formato de documento/modal', () => {
    const result = toOperationItems([
      { id: 'ri1', productId: 'p1', quantity: 10, lotNumber: 'L-01', product: { code: 'PROD-001', name: 'Parafuso', segregationGroup: 'QUIMICO' } },
    ])

    expect(result).toEqual([
      { receiptItemId: 'ri1', productId: 'p1', code: 'PROD-001', name: 'Parafuso', quantity: '10', lotNumber: 'L-01', segregationGroup: 'QUIMICO' },
    ])
  })

  it('produto sem segregationGroup vira null, não undefined', () => {
    const result = toOperationItems([
      { id: 'ri1', productId: 'p1', quantity: 5, lotNumber: null, product: { code: 'PROD-002', name: 'Chapa' } },
    ])

    expect(result[0].segregationGroup).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar e confirmar que passa (a função já é trivial o bastante para escrever direto — TDD aqui é rápido)**

Run: `npx vitest run src/views/wms/__tests__/operations-panel-items.spec.ts`
Expected: PASS — 2/2 testes (implementar `operations-panel-items.ts` do Step 1 antes de rodar, se ainda não passar).

- [ ] **Step 4: A view**

Create `frontend/src/views/wms/OperationsPanelView.vue`:

```vue
<template>
  <AppLayout title="Operações Ativas" subtitle="Recebimento — WMS">
    <template #actions>
      <div class="flex gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md"
          :class="scope === 'all' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'"
          @click="setScope('all')"
        >
          Todas
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded-md"
          :class="scope === 'mine' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'"
          @click="setScope('mine')"
        >
          Minhas
        </button>
      </div>
    </template>

    <div v-if="store.error" class="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      {{ store.error }}
    </div>

    <div v-if="store.loading && store.operations.length === 0" class="text-center py-12 text-gray-500">
      Carregando...
    </div>

    <div v-else-if="store.operations.length === 0" class="text-center py-12 text-gray-500">
      Nenhuma operação ativa {{ scope === 'mine' ? 'para você' : '' }} no momento.
    </div>

    <div v-else class="space-y-4">
      <div v-for="operation in store.operations" :key="operation.receiptId" class="border border-gray-200 rounded-lg p-4">
        <p class="text-sm font-medium text-gray-700 mb-3">{{ operation.receiptNumber }}</p>
        <div class="flex gap-2 flex-wrap">
          <TaskRectangle
            v-for="task in operation.tasks"
            :key="task.id"
            :task="task"
            :state="computeTaskRectangleState(operation.tasks, task, authStore.userId ?? '')"
            @click="handleRectangleClick(operation, task)"
          />
        </div>
      </div>
    </div>

    <!-- Confirmação de "pegar tarefa" -->
    <AppModal v-model="confirmPickupOpen" title="Pegar esta tarefa?" size="sm">
      <p class="text-sm text-gray-700">
        Você vai assumir a etapa <strong>{{ pendingTask ? WAREHOUSE_TASK_TYPE_LABELS[pendingTask.type] : '' }}</strong>.
      </p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button type="button" class="px-4 py-2 text-sm text-gray-700" @click="confirmPickupOpen = false">Cancelar</button>
          <button type="button" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md" @click="confirmPickup">
            Pegar tarefa
          </button>
        </div>
      </template>
    </AppModal>

    <!-- Detalhe só-leitura (concluída, ou ativa de outro operador) -->
    <AppModal v-model="detailOpen" title="Detalhe da etapa" size="sm">
      <div v-if="detailTask" class="text-sm text-gray-700 space-y-2">
        <p><strong>Tipo:</strong> {{ WAREHOUSE_TASK_TYPE_LABELS[detailTask.type] }}</p>
        <p><strong>Status:</strong> {{ detailTask.status }}</p>
        <p v-if="detailTask.assignee"><strong>Responsável:</strong> {{ detailTask.assignee.name }}</p>
        <p v-if="detailTask.completedAt"><strong>Concluída em:</strong> {{ new Date(detailTask.completedAt).toLocaleString('pt-BR') }}</p>
      </div>
    </AppModal>

    <SimpleTaskActionModal
      v-if="actionOperation && actionTask && actionTask.type !== 'ALOCACAO'"
      v-model="simpleActionOpen"
      :task="actionTask"
      :receipt-number="actionOperation.receiptNumber"
      :supplier-name="actionSupplierName"
      :items="actionItems"
      @completed="handleActionCompleted"
    />

    <PutawayActionModal
      v-if="actionOperation && actionTask && actionTask.type === 'ALOCACAO'"
      v-model="putawayActionOpen"
      :task="actionTask"
      :receipt-number="actionOperation.receiptNumber"
      :supplier-name="actionSupplierName"
      :items="actionItems"
      @completed="handleActionCompleted"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import TaskRectangle from '@/components/wms/TaskRectangle.vue'
import SimpleTaskActionModal from '@/components/wms/SimpleTaskActionModal.vue'
import PutawayActionModal from '@/components/wms/PutawayActionModal.vue'
import { computeTaskRectangleState } from '@/components/wms/task-rectangle-state'
import { toOperationItems } from './operations-panel-items'
import { useWarehouseTaskPanelStore } from '@/stores/warehouse-task-panel.store'
import { useAuthStore } from '@/stores/auth.store'
import warehouseTaskService from '@/services/warehouse-task.service'
import purchaseReceiptService from '@/services/purchase-receipt.service'
import { WAREHOUSE_TASK_TYPE_LABELS } from '@/types/warehouse-task.types'
import type { WarehouseTask, ReceiptOperation, PanelScope } from '@/types/warehouse-task.types'
import type { OperationItemForDocument } from './operations-panel-items'

const POLL_INTERVAL_MS = 25000

const route = useRoute()
const router = useRouter()
const store = useWarehouseTaskPanelStore()
const authStore = useAuthStore()

const scope = computed<PanelScope>(() => (route.query.scope === 'mine' ? 'mine' : 'all'))

function setScope(next: PanelScope): void {
  router.replace({ query: { ...route.query, scope: next } })
}

let pollHandle: ReturnType<typeof setInterval> | undefined

async function load(): Promise<void> {
  await store.fetchPanel(scope.value)
}

onMounted(() => {
  load()
  pollHandle = setInterval(load, POLL_INTERVAL_MS)
})

onUnmounted(() => {
  if (pollHandle) clearInterval(pollHandle)
})

// Recarrega quando o usuário troca de aba (scope), sem esperar o próximo poll.
watch(scope, load)

// ---- Confirmação de "pegar tarefa" -------------------------------------
const confirmPickupOpen = ref(false)
const pendingOperation = ref<ReceiptOperation | null>(null)
const pendingTask = ref<WarehouseTask | null>(null)

// ---- Detalhe só-leitura ---------------------------------------------------
const detailOpen = ref(false)
const detailTask = ref<WarehouseTask | null>(null)

// ---- Modal de ação (simples ou Alocação) ----------------------------------
const simpleActionOpen = ref(false)
const putawayActionOpen = ref(false)
const actionOperation = ref<ReceiptOperation | null>(null)
const actionTask = ref<WarehouseTask | null>(null)
const actionItems = ref<OperationItemForDocument[]>([])
const actionSupplierName = ref('')

function handleRectangleClick(operation: ReceiptOperation, task: WarehouseTask): void {
  const state = computeTaskRectangleState(operation.tasks, task, authStore.userId ?? '')

  if (state === 'completed' || state === 'active-other') {
    detailTask.value = task
    detailOpen.value = true
    return
  }

  if (state !== 'active-mine') return

  if (task.assignedTo === null) {
    pendingOperation.value = operation
    pendingTask.value = task
    confirmPickupOpen.value = true
    return
  }

  openAction(operation, task)
}

async function confirmPickup(): Promise<void> {
  if (!pendingTask.value || !pendingOperation.value) return
  await warehouseTaskService.start(pendingTask.value.id)
  const operation = pendingOperation.value
  const task = pendingTask.value
  confirmPickupOpen.value = false
  pendingOperation.value = null
  pendingTask.value = null
  await load()
  openAction(operation, task)
}

async function openAction(operation: ReceiptOperation, task: WarehouseTask): Promise<void> {
  const response = await purchaseReceiptService.getById(operation.receiptId)
  const receipt = response.data.data
  actionOperation.value = operation
  actionTask.value = task
  actionItems.value = toOperationItems(
    receipt.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.acceptedQty,
      lotNumber: item.lotNumber,
      product: item.product,
    }))
  )
  actionSupplierName.value = receipt.order?.supplier?.name ?? ''

  if (task.type === 'ALOCACAO') {
    putawayActionOpen.value = true
  } else {
    simpleActionOpen.value = true
  }
}

function handleActionCompleted(): void {
  load()
}
</script>
```

- [ ] **Step 5: Rota**

Em `frontend/src/router/index.ts`, adicionar (mesma convenção `meta` das rotas de WMS vizinhas — ler o arquivo real antes de escrever, mesma disciplina já usada nos outros projetos deste padrão):

```ts
{
  path: '/wms/operations',
  name: 'wms-operations',
  component: () => import('../views/wms/OperationsPanelView.vue'),
  meta: { requiresAuth: true },
},
```

- [ ] **Step 6: Card no Dashboard**

Em `frontend/src/views/DashboardView.vue`, na aba WMS, trocar o card placeholder de "Recebimento" — não, **manter esse card como está** (é de outro projeto, PR #8) — em vez disso, adicionar um card NOVO logo depois de "Estruturas de Armazém" (ler o arquivo real primeiro para confirmar a posição exata e a classe Tailwind exata dos cards vizinhos, mesma disciplina das outras tasks deste padrão):

```html
<RouterLink
  to="/wms/operations"
  class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
>
  <div class="text-center">
    <div class="text-3xl mb-2">📋</div>
    <p class="text-sm font-medium text-gray-700">Operações Ativas</p>
  </div>
</RouterLink>
```

- [ ] **Step 7: Rodar os testes e o type-check**

Run: `npx vitest run`
Expected: PASS — toda a suíte, incluindo os arquivos novos deste plano.

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem do baseline (Task 2).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/views/wms/OperationsPanelView.vue frontend/src/views/wms/operations-panel-items.ts frontend/src/views/wms/__tests__/operations-panel-items.spec.ts frontend/src/router/index.ts frontend/src/views/DashboardView.vue
git commit -m "feat(frontend): adiciona a tela do painel de operacoes do WMS e navegacao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final check (após a Task 7, antes de finalizar a branch)

- [ ] Rodar a suíte completa do backend (`npm run test:integration`, de `backend/`) e confirmar zero regressão.
- [ ] Rodar `npx vue-tsc --noEmit` e `npx vitest run` completos (de `frontend/`) e confirmar zero regressão.
- [ ] Verificar se `/purchase-receipts/:id` (consumido via `purchaseReceiptService.getById`, Task 2, dentro de `OperationsPanelView.vue::openAction`) continua acessível com a permissão `recebimentos_compra:visualizar` que o usuário do painel já tem — não deveria precisar de nada novo, mas confirmar.
- [ ] Verificação manual/visual, de volta ao checkout principal com os containers Docker ativos (mesma nota operacional dos projetos anteriores — worktree isolado não alcança os containers): logar, abrir `/wms/operations`, criar um recebimento de teste com WMS licenciado, percorrer a cadeia (Descarga → Conferência → Etiquetagem → Quarentena → Alocação) clicando nos retângulos, confirmar que o diálogo de "pegar tarefa" aparece só quando a etapa está livre, que os modais de ação chamam os endpoints certos, que o documento de apoio imprime com o conteúdo certo por tipo, e que a atualização automática (polling) reflete o que outro usuário concluiu.
- [ ] Confirmar que, quando o PR #9 (workflow dinâmico) for mesclado e alguém configurar um template usando `SEGREGACAO`/`AMOSTRAGEM`, o painel exibe esses retângulos corretamente sem precisar de mudança de código — os tipos já existem no frontend (Task 2), só faltava o backend produzir tarefas desses tipos.
