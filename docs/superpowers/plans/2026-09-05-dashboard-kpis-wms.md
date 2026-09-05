# Dashboard de KPIs do WMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um dashboard de KPIs do WMS (`/wms/kpis`) para gestor/administração acompanharem volume, tempo de ciclo, produtividade, gargalos e ocupação de armazém — visão analítica, complementar ao painel operacional (PR #10).

**Architecture:** Dois endpoints agregados por domínio de dados: `GET /warehouse-tasks/kpis?days=N` (4 abas sobre `WarehouseTask`, com filtro de período) e `GET /storage-positions/occupancy` (1 aba sobre `StoragePosition`/`StockPositionBalance`, sem período). Frontend com uma única view de abas internas seguindo o padrão visual já estabelecido em `PCPDashboardView.vue` (cards de KPI + Chart.js), sem store dedicado.

**Tech Stack:** Express + Prisma + Joi + Jest/ts-jest (backend); Vue 3 `<script setup>` + TypeScript + Tailwind + Chart.js já existente (frontend, sem dependência nova).

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-09-05-dashboard-kpis-wms-design.md`.
- Escopo: as 4 abas de Recebimento (Volume/Status, Tempo de Ciclo, Produtividade, Gargalos) filtram só `WarehouseTask.referenceType = 'PURCHASE_RECEIPT'` — a única cadeia que gera tarefas hoje. A aba de Ocupação não tem esse filtro (é sobre `StoragePosition`, não sobre tarefas).
- "Tempo de ciclo por etapa" = `completedAt - createdAt` (inclui espera na fila) — decisão deliberada da spec, diferente de "tempo de execução por operador" na aba Produtividade, que é `completedAt - startedAt` (só tempo ativo).
- "Tempo médio do recebimento completo" só considera recebimentos cuja cadeia INTEIRA já fechou (nenhuma tarefa em `PENDING`/`IN_PROGRESS`), usando o menor `createdAt` entre todas as tarefas da cadeia e o maior `completedAt` entre as concluídas — não assume ordem linear (etapas paralelas têm a mesma `sequence`, já suportado pelo modelo).
- Gargalos: limiar vem de `getSetting('wms.task_delay_threshold_hours', 24)` (`backend/src/services/system-setting.service.ts`, já implementado) — nunca hardcoded. Gargalo é sempre "agora" (não filtrado por `days`), mesmo estando na mesma resposta que as abas com período — aceito porque a fonte de dados (`WarehouseTask`) é a mesma.
- RBAC: `GET /warehouse-tasks/kpis` reaproveita `tarefas_armazem:visualizar` (mesmo recurso de `GET /warehouse-tasks/my`); `GET /storage-positions/occupancy` reaproveita `estruturas_armazem:visualizar` (mesmo recurso das demais leituras de posição). Nenhum recurso RBAC novo. Ambas as rotas já ficam sob `requireModule('WMS')` pelo ponto de montagem em `routes/index.ts` — nada a mudar lá.
- Resposta de erro: `warehouse-task.controller.ts` usa `{ status: 'success', data }`; `storage-position.controller.ts` usa `{ success: true, data }` — cada task segue o padrão do ARQUIVO que está estendendo, não um padrão universal (inconsistência pré-existente do projeto, documentada, não corrigida aqui).
- IDs/IDs de referência: `WarehouseTask.reference` é o `PurchaseReceipt.id` quando `referenceType = 'PURCHASE_RECEIPT'` — sempre precisa de um segundo `findMany` em `PurchaseReceipt` para resolver `receiptNumber` (mesmo padrão de `listActiveReceiptOperations`, que já faz exatamente isso).
- Frontend: `AppLayout` + Chart.js (`chart.js/auto`, já usado em `PCPDashboardView.vue`, sem nova dependência) + `Card`/`Button` (`frontend/src/components/common/`). Todos os canvas de todas as 5 abas ficam montados no DOM o tempo todo (usar `v-show` para trocar de aba, não `v-if`) — evita ter que recriar os `Chart` do Chart.js sempre que o usuário troca de aba; os gráficos são todos criados uma vez, depois do carregamento inicial dos 2 endpoints.

---

## Task 1: Backend — `wms-kpi.service.ts` (as 4 abas de Recebimento)

**Files:**
- Create: `backend/src/services/wms-kpi.service.ts`
- Test: `backend/tests/services/wms-kpi.service.test.ts`

**Interfaces:**
- Consumes: `RECEIPT_TASK_REFERENCE_TYPE` (exportado de `backend/src/services/warehouse-task.service.ts`), `getSetting` (`backend/src/services/system-setting.service.ts`), `prisma` (`backend/src/config/database`).
- Produces: `getTaskKpis(days: number): Promise<WmsTaskKpis>` e os tipos `WmsTaskKpis`/`VolumeStatus`/`CycleTime`/`ProductivityEntry`/`Bottlenecks`. Task 2 (controller) importa `getTaskKpis` e os tipos.

- [ ] **Step 1: Escrever os testes que falham**

Create `backend/tests/services/wms-kpi.service.test.ts`:

```ts
import request from 'supertest';
import { app } from '../../src/app';
import { getTaskKpis } from '../../src/services/wms-kpi.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestProduct, createTestPurchaseOrder, createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import { clearSettingCache } from '../../src/services/system-setting.service';

/**
 * wms-kpi.service.ts::getTaskKpis — as 4 abas de Recebimento do Dashboard de
 * KPIs do WMS. Mesmo padrão de setup de `wms-operations-panel.test.ts`
 * (criar a cadeia via API real, não fixture direta, para não esconder um bug
 * de agregação atrás de um fixture já "arrumado") — depois ajustar
 * createdAt/startedAt/completedAt via `testPrisma.warehouseTask.update` para
 * simular tarefas antigas/concluídas, o que a API não permite fazer
 * diretamente (não dá para "voltar no tempo" via HTTP).
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

const HOUR = 60 * 60 * 1000;

describe('wms-kpi.service — getTaskKpis', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
    await setModule('COMPRAS', true);
    await setModule('WMS', true);
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
    clearSettingCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('volumeStatus', () => {
    it('agrupa por type e status dentro do período, e conta recebimentos ativos vs finalizados', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const kpis = await getTaskKpis(30);

      const descarga = kpis.volumeStatus.byTypeAndStatus.find(
        (e) => e.type === 'DESCARGA' && e.status === 'PENDING'
      );
      expect(descarga?.count).toBe(1);
      expect(kpis.volumeStatus.receiptsActive).toBe(1);
      expect(kpis.volumeStatus.receiptsFinished).toBe(0);
    });

    it('conta como finalizado um recebimento cuja cadeia inteira já fechou', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      await testPrisma.warehouseTask.updateMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const kpis = await getTaskKpis(30);
      expect(kpis.volumeStatus.receiptsActive).toBe(0);
      expect(kpis.volumeStatus.receiptsFinished).toBe(1);
    });

    it('não conta uma tarefa criada fora do período', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      await testPrisma.warehouseTask.updateMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        data: { createdAt: new Date(Date.now() - 40 * 24 * HOUR) },
      });

      const kpis = await getTaskKpis(30);
      expect(kpis.volumeStatus.receiptsActive).toBe(0);
      expect(kpis.volumeStatus.receiptsFinished).toBe(0);
    });
  });

  describe('cycleTime', () => {
    it('calcula a média de completedAt-createdAt por tipo, só tarefas COMPLETED concluídas no período', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      const descarga = tasks[0];
      const createdAt = new Date(Date.now() - 10 * HOUR);
      const completedAt = new Date(Date.now() - 4 * HOUR); // 6h de ciclo
      await testPrisma.warehouseTask.update({
        where: { id: descarga.id },
        data: { status: 'COMPLETED', createdAt, completedAt },
      });

      const kpis = await getTaskKpis(30);
      const entry = kpis.cycleTime.byType.find((e) => e.type === 'DESCARGA');
      expect(entry?.avgHours).toBe(6);
    });

    it('fullReceiptAvgHours só considera recebimento com a cadeia inteira fechada', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      const firstCreatedAt = new Date(Date.now() - 20 * HOUR);
      const lastCompletedAt = new Date(Date.now() - 2 * HOUR); // 18h de recebimento completo

      // Todas as tarefas nascem em firstCreatedAt; todas concluídas, a última em lastCompletedAt.
      for (const [index, task] of tasks.entries()) {
        await testPrisma.warehouseTask.update({
          where: { id: task.id },
          data: {
            createdAt: firstCreatedAt,
            status: 'COMPLETED',
            completedAt: index === tasks.length - 1 ? lastCompletedAt : new Date(Date.now() - 15 * HOUR),
          },
        });
      }

      const kpis = await getTaskKpis(30);
      expect(kpis.cycleTime.fullReceiptAvgHours).toBe(18);
    });

    it('não inclui no fullReceiptAvgHours um recebimento com etapa ainda aberta', async () => {
      const { user, token } = await loginReceiptUser();
      await createReceipt(token, user.id, 100);
      // Cadeia recém-criada: todas PENDING, nenhuma COMPLETED.

      const kpis = await getTaskKpis(30);
      expect(kpis.cycleTime.fullReceiptAvgHours).toBe(0);
    });
  });

  describe('productivity', () => {
    it('agrupa tarefas concluídas por operador, com tempo médio de execução (startedAt→completedAt)', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      const startedAt = new Date(Date.now() - 5 * HOUR);
      const completedAt = new Date(Date.now() - 3 * HOUR); // 2h de execução
      await testPrisma.warehouseTask.update({
        where: { id: tasks[0].id },
        data: { assignedTo: user.id, status: 'COMPLETED', startedAt, completedAt },
      });

      const kpis = await getTaskKpis(30);
      const entry = kpis.productivity.find((p) => p.userId === user.id);
      expect(entry?.tasksCompleted).toBe(1);
      expect(entry?.avgExecutionHours).toBe(2);
      expect(entry?.userName).toBe(user.name);
    });

    it('ignora tarefa concluída sem assignedTo/startedAt', async () => {
      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
      });
      await testPrisma.warehouseTask.update({
        where: { id: tasks[0].id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      const kpis = await getTaskKpis(30);
      expect(kpis.productivity).toHaveLength(0);
    });
  });

  describe('bottlenecks', () => {
    it('usa wms.task_delay_threshold_hours do banco, não o default de 24h, e ordena do mais parado', async () => {
      await testPrisma.systemSetting.create({
        data: {
          key: 'wms.task_delay_threshold_hours',
          value: '10',
          type: 'NUMBER',
          category: 'wms',
          label: 'Limiar de tarefa atrasada (horas)',
        },
      });
      clearSettingCache();

      const { user, token } = await loginReceiptUser();
      const { res } = await createReceipt(token, user.id, 100);

      const tasks = await testPrisma.warehouseTask.findMany({
        where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
        orderBy: { sequence: 'asc' },
      });
      // 15h parada: com o default (24h) NÃO apareceria; com 10h (do banco) aparece.
      await testPrisma.warehouseTask.update({
        where: { id: tasks[0].id },
        data: { createdAt: new Date(Date.now() - 15 * HOUR) },
      });

      const kpis = await getTaskKpis(30);
      expect(kpis.bottlenecks.byType.find((b) => b.type === 'DESCARGA')?.count).toBe(1);
      expect(kpis.bottlenecks.affected).toHaveLength(1);
      expect(kpis.bottlenecks.affected[0].receiptNumber).toBe(res.body.data.receiptNumber);
      expect(kpis.bottlenecks.affected[0].hoursStuck).toBeGreaterThanOrEqual(15);
    });

    it('não lista tarefa PENDING dentro do limiar', async () => {
      const { user, token } = await loginReceiptUser();
      await createReceipt(token, user.id, 100);
      // Tarefas recém-criadas: bem dentro do limiar default de 24h.

      const kpis = await getTaskKpis(30);
      expect(kpis.bottlenecks.affected).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/services/wms-kpi.service.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/wms-kpi.service'`.

- [ ] **Step 3: Implementar**

Create `backend/src/services/wms-kpi.service.ts`:

```ts
import { WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';
import { prisma } from '../config/database';
import { getSetting } from './system-setting.service';
import { RECEIPT_TASK_REFERENCE_TYPE } from './warehouse-task.service';

/**
 * Dashboard de KPIs do WMS — as 4 abas sobre a cadeia de Recebimento
 * (Volume/Status, Tempo de Ciclo, Produtividade, Gargalos). A aba de
 * Ocupação (StoragePosition) mora em storage-position.service.ts, domínio de
 * dados diferente — ver docs/superpowers/specs/2026-09-05-dashboard-kpis-wms-design.md.
 */

const MS_PER_HOUR = 60 * 60 * 1000;

const OPEN_STATUSES: WarehouseTaskStatus[] = [
  WarehouseTaskStatus.PENDING,
  WarehouseTaskStatus.IN_PROGRESS,
];

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface VolumeStatusEntry {
  type: WarehouseTaskType;
  status: WarehouseTaskStatus;
  count: number;
}

export interface VolumeStatus {
  byTypeAndStatus: VolumeStatusEntry[];
  receiptsActive: number;
  receiptsFinished: number;
}

export interface CycleTimeByType {
  type: WarehouseTaskType;
  avgHours: number;
}

export interface CycleTime {
  byType: CycleTimeByType[];
  fullReceiptAvgHours: number;
}

export interface ProductivityEntry {
  userId: string;
  userName: string;
  tasksCompleted: number;
  avgExecutionHours: number;
}

export interface BottleneckByType {
  type: WarehouseTaskType;
  count: number;
}

export interface BottleneckAffected {
  receiptId: string;
  receiptNumber: string;
  taskType: WarehouseTaskType;
  hoursStuck: number;
}

export interface Bottlenecks {
  byType: BottleneckByType[];
  affected: BottleneckAffected[];
}

export interface WmsTaskKpis {
  period: { days: number };
  volumeStatus: VolumeStatus;
  cycleTime: CycleTime;
  productivity: ProductivityEntry[];
  bottlenecks: Bottlenecks;
}

async function getVolumeStatus(since: Date): Promise<VolumeStatus> {
  const grouped = await prisma.warehouseTask.groupBy({
    by: ['type', 'status'],
    where: { referenceType: RECEIPT_TASK_REFERENCE_TYPE, createdAt: { gte: since } },
    _count: { id: true },
  });
  const byTypeAndStatus = grouped.map((g) => ({ type: g.type, status: g.status, count: g._count.id }));

  const allRefs = await prisma.warehouseTask.findMany({
    where: { referenceType: RECEIPT_TASK_REFERENCE_TYPE, createdAt: { gte: since } },
    select: { reference: true },
    distinct: ['reference'],
  });
  const activeRefs = await prisma.warehouseTask.findMany({
    where: {
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      createdAt: { gte: since },
      status: { in: OPEN_STATUSES },
    },
    select: { reference: true },
    distinct: ['reference'],
  });
  const activeSet = new Set(activeRefs.map((r) => r.reference));
  const receiptsActive = activeSet.size;
  const receiptsFinished = allRefs.filter((r) => r.reference && !activeSet.has(r.reference)).length;

  return { byTypeAndStatus, receiptsActive, receiptsFinished };
}

async function getCycleTime(since: Date): Promise<CycleTime> {
  const tasks = await prisma.warehouseTask.findMany({
    where: { referenceType: RECEIPT_TASK_REFERENCE_TYPE, reference: { not: null } },
    select: { type: true, status: true, reference: true, createdAt: true, completedAt: true },
  });

  const hoursByType = new Map<WarehouseTaskType, number[]>();
  for (const task of tasks) {
    if (task.status !== WarehouseTaskStatus.COMPLETED || !task.completedAt) continue;
    if (task.completedAt < since) continue;
    const hours = (task.completedAt.getTime() - task.createdAt.getTime()) / MS_PER_HOUR;
    const list = hoursByType.get(task.type) ?? [];
    list.push(hours);
    hoursByType.set(task.type, list);
  }
  const byType: CycleTimeByType[] = [...hoursByType.entries()].map(([type, hours]) => ({
    type,
    avgHours: round1(average(hours)),
  }));

  const byReceipt = new Map<string, typeof tasks>();
  for (const task of tasks) {
    if (!task.reference) continue;
    const list = byReceipt.get(task.reference) ?? [];
    list.push(task);
    byReceipt.set(task.reference, list);
  }

  const fullReceiptHours: number[] = [];
  for (const receiptTasks of byReceipt.values()) {
    const stillOpen = receiptTasks.some((t) => OPEN_STATUSES.includes(t.status));
    if (stillOpen) continue;
    const completedOnes = receiptTasks.filter(
      (t): t is typeof t & { completedAt: Date } => t.completedAt !== null
    );
    if (completedOnes.length === 0) continue;
    const earliestCreated = Math.min(...receiptTasks.map((t) => t.createdAt.getTime()));
    const latestCompleted = Math.max(...completedOnes.map((t) => t.completedAt.getTime()));
    if (latestCompleted < since.getTime()) continue;
    fullReceiptHours.push((latestCompleted - earliestCreated) / MS_PER_HOUR);
  }

  return { byType, fullReceiptAvgHours: round1(average(fullReceiptHours)) };
}

async function getProductivity(since: Date): Promise<ProductivityEntry[]> {
  const tasks = await prisma.warehouseTask.findMany({
    where: {
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      status: WarehouseTaskStatus.COMPLETED,
      completedAt: { gte: since },
      assignedTo: { not: null },
      startedAt: { not: null },
    },
    select: { assignedTo: true, startedAt: true, completedAt: true },
  });

  const byUser = new Map<string, { count: number; hours: number[] }>();
  for (const task of tasks) {
    if (!task.assignedTo || !task.startedAt || !task.completedAt) continue;
    const entry = byUser.get(task.assignedTo) ?? { count: 0, hours: [] };
    entry.count += 1;
    entry.hours.push((task.completedAt.getTime() - task.startedAt.getTime()) / MS_PER_HOUR);
    byUser.set(task.assignedTo, entry);
  }

  const userIds = [...byUser.keys()];
  if (userIds.length === 0) return [];

  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return userIds
    .map((userId) => {
      const entry = byUser.get(userId)!;
      return {
        userId,
        userName: nameById.get(userId) ?? 'Desconhecido',
        tasksCompleted: entry.count,
        avgExecutionHours: round1(average(entry.hours)),
      };
    })
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted);
}

async function getBottlenecks(): Promise<Bottlenecks> {
  const thresholdHours = await getSetting('wms.task_delay_threshold_hours', 24);
  const cutoff = new Date(Date.now() - thresholdHours * MS_PER_HOUR);

  const stuckTasks = await prisma.warehouseTask.findMany({
    where: {
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      status: { in: OPEN_STATUSES },
      createdAt: { lt: cutoff },
    },
    select: { type: true, reference: true, createdAt: true },
  });

  const byTypeMap = new Map<WarehouseTaskType, number>();
  for (const task of stuckTasks) {
    byTypeMap.set(task.type, (byTypeMap.get(task.type) ?? 0) + 1);
  }
  const byType = [...byTypeMap.entries()].map(([type, count]) => ({ type, count }));

  const receiptIds = [...new Set(stuckTasks.map((t) => t.reference).filter((r): r is string => r !== null))];
  const receipts =
    receiptIds.length > 0
      ? await prisma.purchaseReceipt.findMany({
          where: { id: { in: receiptIds } },
          select: { id: true, receiptNumber: true },
        })
      : [];
  const receiptById = new Map(receipts.map((r) => [r.id, r.receiptNumber]));

  const affected = stuckTasks
    .filter((t): t is typeof t & { reference: string } => t.reference !== null)
    .map((t) => ({
      receiptId: t.reference,
      receiptNumber: receiptById.get(t.reference) ?? '—',
      taskType: t.type,
      hoursStuck: round1((Date.now() - t.createdAt.getTime()) / MS_PER_HOUR),
    }))
    .sort((a, b) => b.hoursStuck - a.hoursStuck);

  return { byType, affected };
}

export async function getTaskKpis(days: number): Promise<WmsTaskKpis> {
  const since = new Date(Date.now() - days * 24 * MS_PER_HOUR);

  const [volumeStatus, cycleTime, productivity, bottlenecks] = await Promise.all([
    getVolumeStatus(since),
    getCycleTime(since),
    getProductivity(since),
    getBottlenecks(),
  ]);

  return { period: { days }, volumeStatus, cycleTime, productivity, bottlenecks };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd backend && node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/services/wms-kpi.service.test.ts`
Expected: PASS, 10 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/wms-kpi.service.ts backend/tests/services/wms-kpi.service.test.ts
git commit -m "feat(backend): adiciona wms-kpi.service com as 4 abas de Recebimento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Backend — `GET /warehouse-tasks/kpis`

**Files:**
- Modify: `backend/src/controllers/warehouse-task.controller.ts`
- Modify: `backend/src/routes/warehouse-task.routes.ts`
- Modify: `backend/src/validators/warehouse-task.validator.ts`
- Test: `backend/tests/integration/wms-kpi.test.ts`

**Interfaces:**
- Consumes: `getTaskKpis` (Task 1).
- Produces: a rota `GET /warehouse-tasks/kpis?days=7|30|90`. Task 4 (frontend service) consome o contrato JSON.

- [ ] **Step 1: Escrever os testes de integração que falham**

Create `backend/tests/integration/wms-kpi.test.ts`:

```ts
import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestProduct, createTestPurchaseOrder, createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

const loginWith = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return { user, token: res.body.data.accessToken as string };
};

const createReceipt = async (token: string, userId: string) => {
  const product = await createTestProduct();
  const { order } = await createTestPurchaseOrder(userId, [
    { productId: product.id, quantity: 100, unitPrice: 10 },
  ]);
  return request(app)
    .post('/api/v1/purchase-receipts')
    .set('Authorization', `Bearer ${token}`)
    .send({
      purchaseOrderId: order.id,
      receiptDate: new Date().toISOString(),
      items: [{ orderItemId: order.items[0].id, productId: product.id, quantityReceived: 100 }],
    });
};

describe('Integração: GET /api/v1/warehouse-tasks/kpis', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
    await setModule('COMPRAS', true);
    await setModule('WMS', true);
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('devolve os KPIs para quem tem tarefas_armazem:visualizar', async () => {
    const { user, token } = await loginWith([
      { resource: 'tarefas_armazem', action: 'visualizar' },
      { resource: 'recebimentos_compra', action: 'visualizar' },
      { resource: 'recebimentos_compra', action: 'criar' },
    ]);
    const res = await createReceipt(token, user.id);
    expect(res.status).toBe(201);

    const kpis = await request(app)
      .get('/api/v1/warehouse-tasks/kpis?days=30')
      .set('Authorization', `Bearer ${token}`);

    expect(kpis.status).toBe(200);
    expect(kpis.body.data.period.days).toBe(30);
    expect(kpis.body.data.volumeStatus.receiptsActive).toBe(1);
  });

  it('nega 403 para quem não tem tarefas_armazem:visualizar', async () => {
    const { token } = await loginWith([{ resource: 'outra_coisa', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/warehouse-tasks/kpis')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('usa days=30 como default quando o parâmetro está ausente', async () => {
    const { token } = await loginWith([{ resource: 'tarefas_armazem', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/warehouse-tasks/kpis')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.period.days).toBe(30);
  });

  it('rejeita days fora de 7/30/90 com 400', async () => {
    const { token } = await loginWith([{ resource: 'tarefas_armazem', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/warehouse-tasks/kpis?days=15')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('404 sem WMS licenciado', async () => {
    await testPrisma.licensedModule.updateMany({ where: { code: 'WMS' }, data: { enabled: false } });
    clearLicensedModuleCache();
    const { token } = await loginWith([{ resource: 'tarefas_armazem', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/warehouse-tasks/kpis')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/integration/wms-kpi.test.ts`
Expected: FAIL — `Cannot GET /api/v1/warehouse-tasks/kpis` (rota ainda não existe).

- [ ] **Step 3: Adicionar o schema de validação de query**

Modify `backend/src/validators/warehouse-task.validator.ts` — adicionar ao final do arquivo:

```ts
/**
 * `GET /warehouse-tasks/kpis`. `days` só aceita os 3 valores do seletor de
 * período da tela (7/30/90); qualquer outro valor é 400, não um fallback
 * silencioso — evita a tela mostrar "período de 15 dias" por engano de URL.
 * Ausente = o controller aplica o default de 30.
 */
export const kpisQuerySchema = Joi.object({
  days: Joi.number().valid(7, 30, 90),
}).unknown(true);
```

- [ ] **Step 4: Adicionar o controller**

Modify `backend/src/controllers/warehouse-task.controller.ts` — adicionar ao topo o import e, dentro da classe `WarehouseTaskController`, o método (logo após `getPanel`):

```ts
import warehouseTaskService from '../services/warehouse-task.service';
import { getTaskKpis } from '../services/wms-kpi.service';
```

(o import de `warehouseTaskService` já existe no arquivo — só adicionar o de `getTaskKpis` ao lado.)

```ts
  /** Dashboard de KPIs do WMS — as 4 abas de Recebimento (Volume/Status, Tempo de Ciclo, Produtividade, Gargalos). */
  async getKpis(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const days = Number(req.query.days) || 30;
      const data = await getTaskKpis(days);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }
```

- [ ] **Step 5: Registrar a rota**

Modify `backend/src/routes/warehouse-task.routes.ts` — adicionar ao import de validators:

```ts
import {
  assignWarehouseTaskSchema,
  completeWarehouseTaskSchema,
  executeWarehouseTaskSchema,
  kpisQuerySchema,
  myWarehouseTasksQuerySchema,
  panelQuerySchema,
  putawayWarehouseTaskSchema,
  scanWarehouseTaskSchema,
} from '../validators/warehouse-task.validator';
```

E adicionar a rota logo após `/panel` (segmento fixo, mesma disciplina do arquivo — antes das paramétricas):

```ts
// Dashboard de KPIs do WMS — as 4 abas de Recebimento. RBAC:
// `tarefas_armazem:visualizar`, mesmo recurso de `GET /my` — é leitura
// agregada, não dado sensível a mais que o painel operacional já expõe.
router.get(
  '/kpis',
  requirePermission('tarefas_armazem', 'visualizar'),
  validateQuery(kpisQuerySchema),
  warehouseTaskController.getKpis
);
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `cd backend && node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/integration/wms-kpi.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 7: Rodar a suíte completa de backend**

Run: `cd backend && node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest --runInBand`
Expected: todos os testes passam (baseline + os novos desta task e da Task 1).

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/warehouse-task.controller.ts backend/src/routes/warehouse-task.routes.ts backend/src/validators/warehouse-task.validator.ts backend/tests/integration/wms-kpi.test.ts
git commit -m "feat(backend): adiciona GET /warehouse-tasks/kpis

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Backend — `GET /storage-positions/occupancy`

**Files:**
- Modify: `backend/src/services/storage-position.service.ts`
- Modify: `backend/src/controllers/storage-position.controller.ts`
- Modify: `backend/src/routes/storage-position.routes.ts`
- Test: `backend/tests/integration/storage-position-occupancy.test.ts`

**Interfaces:**
- Consumes: `prisma` (`backend/src/config/database`).
- Produces: `getOccupancy(): Promise<OccupancyResponse>` e a rota `GET /storage-positions/occupancy`. Task 4 (frontend service) consome o contrato JSON.

- [ ] **Step 1: Escrever os testes de integração que falham**

Create `backend/tests/integration/storage-position-occupancy.test.ts`:

```ts
import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import {
  createTestPositions,
  createTestPositionBalance,
  createTestProduct,
  createTestLot,
  createUserWithPermissions,
} from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

const loginWith = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return res.body.data.accessToken as string;
};

describe('Integração: GET /api/v1/storage-positions/occupancy', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
    await setModule('WMS', true);
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('classifica posições em occupied/free/blocked por armazém', async () => {
    const token = await loginWith([{ resource: 'estruturas_armazem', action: 'visualizar' }]);
    const product = await createTestProduct();
    const { positions } = await createTestPositions(3);

    // posições[0]: ocupada (tem saldo > 0)
    await createTestPositionBalance(product.id, positions[0].id, 50);
    // posições[1]: bloqueada (sem saldo)
    await testPrisma.storagePosition.update({ where: { id: positions[1].id }, data: { blocked: true } });
    // posições[2]: livre (sem saldo, sem bloqueio)

    const res = await request(app)
      .get('/api/v1/storage-positions/occupancy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const warehouseCode = positions[0].warehouseCode;
    const entry = res.body.data.byWarehouse.find((w: any) => w.warehouseCode === warehouseCode);
    expect(entry).toMatchObject({ occupied: 1, blocked: 1, free: 1, total: 3 });
  });

  it('posição com saldo só em um dos lotes (múltiplas linhas de saldo) ainda conta como occupied', async () => {
    const token = await loginWith([{ resource: 'estruturas_armazem', action: 'visualizar' }]);
    const product = await createTestProduct({ lotTracked: true });
    const { positions } = await createTestPositions(1);
    const lot = await createTestLot(product.id, { expiresAt: null });

    // Uma linha SEM lote com saldo zerado, outra COM lote com saldo real —
    // a posição tem duas linhas de StockPositionBalance (chave composta
    // produto+posição+lote), e a sem-lote (zerada) não pode mascarar a outra.
    await createTestPositionBalance(product.id, positions[0].id, 0, null);
    await createTestPositionBalance(product.id, positions[0].id, 20, lot.id);

    const res = await request(app)
      .get('/api/v1/storage-positions/occupancy')
      .set('Authorization', `Bearer ${token}`);

    const entry = res.body.data.byWarehouse.find((w: any) => w.warehouseCode === positions[0].warehouseCode);
    expect(entry).toMatchObject({ occupied: 1, blocked: 0, free: 0, total: 1 });
  });

  it('posição bloqueada COM saldo conta como blocked, não occupied', async () => {
    const token = await loginWith([{ resource: 'estruturas_armazem', action: 'visualizar' }]);
    const product = await createTestProduct();
    const { positions } = await createTestPositions(1);

    await createTestPositionBalance(product.id, positions[0].id, 50);
    await testPrisma.storagePosition.update({ where: { id: positions[0].id }, data: { blocked: true } });

    const res = await request(app)
      .get('/api/v1/storage-positions/occupancy')
      .set('Authorization', `Bearer ${token}`);

    const entry = res.body.data.byWarehouse.find((w: any) => w.warehouseCode === positions[0].warehouseCode);
    expect(entry).toMatchObject({ occupied: 0, blocked: 1, free: 0, total: 1 });
  });

  it('nega 403 para quem não tem estruturas_armazem:visualizar', async () => {
    const token = await loginWith([{ resource: 'outra_coisa', action: 'visualizar' }]);

    const res = await request(app)
      .get('/api/v1/storage-positions/occupancy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd backend && node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/integration/storage-position-occupancy.test.ts`
Expected: FAIL — `Cannot GET /api/v1/storage-positions/occupancy`.

- [ ] **Step 3: Adicionar o service**

Modify `backend/src/services/storage-position.service.ts` — adicionar ao final do arquivo:

```ts
export interface WarehouseOccupancy {
  warehouseCode: string;
  occupied: number;
  free: number;
  blocked: number;
  total: number;
}

export interface OccupancyResponse {
  byWarehouse: WarehouseOccupancy[];
}

/**
 * Dashboard de KPIs do WMS — aba Ocupação. Sem período (ocupação é sempre
 * "agora"), agrupado só por armazém nesta v1 (não por rua/estrutura — ver
 * docs/superpowers/specs/2026-09-05-dashboard-kpis-wms-design.md).
 *
 * Classificação: BLOQUEADA tem prioridade sobre ocupada — uma posição
 * bloqueada com saldo residual conta como bloqueada, não ocupada (é a mesma
 * posição impedida de operar, o saldo nela é um problema à parte, não
 * "capacidade em uso").
 */
export const getOccupancy = async (): Promise<OccupancyResponse> => {
  // SEM `take` aqui: uma posição pode ter mais de uma linha de saldo (uma por
  // lote, ver StockPositionBalance) — trazer só a primeira classificaria
  // errado uma posição com saldo real só num lote diferente do que calhou de
  // vir primeiro. O volume por posição é pequeno o bastante (poucas linhas por
  // endereço) para trazer todas sem paginação nesta v1.
  const positions = await prisma.storagePosition.findMany({
    select: {
      warehouseCode: true,
      blocked: true,
      stockPositionBalances: { select: { quantity: true } },
    },
  });

  const byWarehouseMap = new Map<string, WarehouseOccupancy>();
  for (const position of positions) {
    const entry = byWarehouseMap.get(position.warehouseCode) ?? {
      warehouseCode: position.warehouseCode,
      occupied: 0,
      free: 0,
      blocked: 0,
      total: 0,
    };
    entry.total += 1;
    const hasBalance = position.stockPositionBalances.some((b) => Number(b.quantity) > 0);
    if (position.blocked) {
      entry.blocked += 1;
    } else if (hasBalance) {
      entry.occupied += 1;
    } else {
      entry.free += 1;
    }
    byWarehouseMap.set(position.warehouseCode, entry);
  }

  return { byWarehouse: [...byWarehouseMap.values()].sort((a, b) => a.warehouseCode.localeCompare(b.warehouseCode)) };
};
```

(O campo de relação inversa em `StoragePosition` é `stockPositionBalances` — confirmado em `backend/prisma/schema.prisma:1443`.)

- [ ] **Step 4: Adicionar o controller**

Modify `backend/src/controllers/storage-position.controller.ts` — adicionar ao final do arquivo:

```ts
export const getOccupancy = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await storagePositionService.getOccupancy();
    res.json({ success: true, data });
  } catch (error: any) {
    next(error);
  }
};
```

- [ ] **Step 5: Registrar a rota**

Modify `backend/src/routes/storage-position.routes.ts` — adicionar, ANTES de `/:structureId` (segmento fixo, mesma disciplina já documentada no arquivo para `/by-code/:code` e `/:id/movements`):

```ts
// Dashboard de KPIs do WMS — aba Ocupação. Declarada antes de '/:structureId'
// pela mesma razão de '/by-code/:code' e '/:id/movements' acima: rota
// específica antes da paramétrica. RBAC: `estruturas_armazem:visualizar`,
// mesmo recurso das demais leituras de posição deste arquivo.
router.get(
  '/occupancy',
  requirePermission('estruturas_armazem', 'visualizar'),
  storagePositionController.getOccupancy
);
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `cd backend && node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/integration/storage-position-occupancy.test.ts`
Expected: PASS, 4 testes.

- [ ] **Step 7: Rodar a suíte completa de backend**

Run: `cd backend && node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest --runInBand`
Expected: todos os testes passam (baseline + os novos das Tasks 1-3).

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/storage-position.service.ts backend/src/controllers/storage-position.controller.ts backend/src/routes/storage-position.routes.ts backend/tests/integration/storage-position-occupancy.test.ts
git commit -m "feat(backend): adiciona GET /storage-positions/occupancy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Frontend — service

**Files:**
- Create: `frontend/src/types/wms-kpi.types.ts`
- Create: `frontend/src/services/wms-kpi.service.ts`
- Test: `frontend/src/services/__tests__/wms-kpi.service.spec.ts`

**Interfaces:**
- Consumes: `api` de `@/services/api.service` (mesmo cliente axios de `system-setting.service.ts`).
- Produces: os tipos `WmsTaskKpis`/`OccupancyResponse` (espelhando o backend) e `wmsKpiService.getTaskKpis(days)`/`getOccupancy()`. Task 5 (view) consome estes.

- [ ] **Step 1: Criar os tipos**

Create `frontend/src/types/wms-kpi.types.ts`:

```ts
export type WarehouseTaskType =
  | 'DESCARGA'
  | 'CONFERENCIA'
  | 'ETIQUETAGEM'
  | 'QUARENTENA'
  | 'SEGREGACAO'
  | 'AMOSTRAGEM'
  | 'ALOCACAO'
  | 'PICKING'
  | 'REPLENISHMENT'

export type WarehouseTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface VolumeStatusEntry {
  type: WarehouseTaskType
  status: WarehouseTaskStatus
  count: number
}

export interface VolumeStatus {
  byTypeAndStatus: VolumeStatusEntry[]
  receiptsActive: number
  receiptsFinished: number
}

export interface CycleTimeByType {
  type: WarehouseTaskType
  avgHours: number
}

export interface CycleTime {
  byType: CycleTimeByType[]
  fullReceiptAvgHours: number
}

export interface ProductivityEntry {
  userId: string
  userName: string
  tasksCompleted: number
  avgExecutionHours: number
}

export interface BottleneckByType {
  type: WarehouseTaskType
  count: number
}

export interface BottleneckAffected {
  receiptId: string
  receiptNumber: string
  taskType: WarehouseTaskType
  hoursStuck: number
}

export interface Bottlenecks {
  byType: BottleneckByType[]
  affected: BottleneckAffected[]
}

export interface WmsTaskKpis {
  period: { days: number }
  volumeStatus: VolumeStatus
  cycleTime: CycleTime
  productivity: ProductivityEntry[]
  bottlenecks: Bottlenecks
}

export interface WarehouseOccupancy {
  warehouseCode: string
  occupied: number
  free: number
  blocked: number
  total: number
}

export interface OccupancyResponse {
  byWarehouse: WarehouseOccupancy[]
}
```

- [ ] **Step 2: Escrever o teste do service que falha**

Create `frontend/src/services/__tests__/wms-kpi.service.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import wmsKpiService from '../wms-kpi.service'
import api from '../api.service'

vi.mock('../api.service', () => ({
  default: { get: vi.fn() },
}))

describe('wms-kpi.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getTaskKpis chama /warehouse-tasks/kpis com o parâmetro days', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'success', data: { period: { days: 30 } } } })

    await wmsKpiService.getTaskKpis(30)

    expect(api.get).toHaveBeenCalledWith('/warehouse-tasks/kpis', { params: { days: 30 } })
  })

  it('getOccupancy chama /storage-positions/occupancy sem parâmetros', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { byWarehouse: [] } } })

    await wmsKpiService.getOccupancy()

    expect(api.get).toHaveBeenCalledWith('/storage-positions/occupancy')
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run (de `frontend/`): `npx vitest run src/services/__tests__/wms-kpi.service.spec.ts`
Expected: FAIL — `Cannot find module '../wms-kpi.service'`.

- [ ] **Step 4: Implementar o service**

Create `frontend/src/services/wms-kpi.service.ts`:

```ts
import api from './api.service'
import type { WmsTaskKpis, OccupancyResponse } from '@/types/wms-kpi.types'

interface ApiEnvelope<T> {
  data: T
}

class WmsKpiService {
  async getTaskKpis(days: number): Promise<WmsTaskKpis> {
    const response = await api.get<{ status: string; data: WmsTaskKpis }>('/warehouse-tasks/kpis', {
      params: { days },
    })
    return response.data.data
  }

  async getOccupancy(): Promise<OccupancyResponse> {
    const response = await api.get<{ success: boolean; data: OccupancyResponse }>('/storage-positions/occupancy')
    return response.data.data
  }
}

export default new WmsKpiService()
```

(A interface `ApiEnvelope` local não é usada diretamente — os dois métodos tipam a resposta inline porque os dois endpoints do backend usam envelopes DIFERENTES, `{status,data}` vs `{success,data}`, conforme documentado nas Global Constraints do plano; remover `ApiEnvelope` se o linter reclamar de tipo não usado.)

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/services/__tests__/wms-kpi.service.spec.ts`
Expected: PASS, 2 testes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/wms-kpi.types.ts frontend/src/services/wms-kpi.service.ts frontend/src/services/__tests__/wms-kpi.service.spec.ts
git commit -m "feat(frontend): adiciona tipos e service do Dashboard de KPIs do WMS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Frontend — tela, rota e card no Dashboard

**Files:**
- Create: `frontend/src/views/wms/WmsKpiDashboardView.vue`
- Create: `frontend/src/views/wms/__tests__/WmsKpiDashboardView.spec.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `wmsKpiService` (Task 4).
- Produces: rota `/wms/kpis`. Nenhuma outra task depende disto.

- [ ] **Step 1: Escrever o teste da view que falha**

Create `frontend/src/views/wms/__tests__/WmsKpiDashboardView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import WmsKpiDashboardView from '../WmsKpiDashboardView.vue'
import wmsKpiService from '@/services/wms-kpi.service'

vi.mock('@/services/wms-kpi.service', () => ({
  default: { getTaskKpis: vi.fn(), getOccupancy: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

const mockTaskKpis = {
  period: { days: 30 },
  volumeStatus: { byTypeAndStatus: [{ type: 'DESCARGA', status: 'PENDING', count: 3 }], receiptsActive: 2, receiptsFinished: 5 },
  cycleTime: { byType: [{ type: 'DESCARGA', avgHours: 4.5 }], fullReceiptAvgHours: 20.1 },
  productivity: [{ userId: 'u1', userName: 'João', tasksCompleted: 10, avgExecutionHours: 1.2 }],
  bottlenecks: { byType: [{ type: 'QUARENTENA', count: 1 }], affected: [{ receiptId: 'r1', receiptNumber: 'REC-2026-0001', taskType: 'QUARENTENA', hoursStuck: 30 }] },
}

const mockOccupancy = {
  byWarehouse: [{ warehouseCode: 'WH1', occupied: 10, free: 5, blocked: 1, total: 16 }],
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/wms/kpis', component: WmsKpiDashboardView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('WmsKpiDashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('carrega e exibe os KPIs de volume/status e ocupação ao montar', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockResolvedValue(mockTaskKpis as any)
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wmsKpiService.getTaskKpis).toHaveBeenCalledWith(30)
    expect(wmsKpiService.getOccupancy).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Recebimentos ativos')
  })

  it('troca de aba sem perder os dados já carregados de outra', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockResolvedValue(mockTaskKpis as any)
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    const bottleneckTab = wrapper.findAll('button').find((b) => b.text().includes('Gargalos'))!
    await bottleneckTab.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('REC-2026-0001')
    expect(wmsKpiService.getTaskKpis).toHaveBeenCalledTimes(1)
  })

  it('trocar o período dispara nova chamada a getTaskKpis, não a getOccupancy', async () => {
    vi.mocked(wmsKpiService.getTaskKpis).mockResolvedValue(mockTaskKpis as any)
    vi.mocked(wmsKpiService.getOccupancy).mockResolvedValue(mockOccupancy as any)

    const router = makeRouter()
    router.push('/wms/kpis')
    await router.isReady()

    const wrapper = mount(WmsKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    const select = wrapper.find('select')
    await select.setValue('90')
    await flushPromises()

    expect(wmsKpiService.getTaskKpis).toHaveBeenLastCalledWith(90)
    expect(wmsKpiService.getOccupancy).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run (de `frontend/`): `npx vitest run src/views/wms/__tests__/WmsKpiDashboardView.spec.ts`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Implementar a view**

Create `frontend/src/views/wms/WmsKpiDashboardView.vue`:

```vue
<template>
  <AppLayout title="Dashboard de KPIs do WMS" subtitle="Volume, tempo de ciclo, produtividade, gargalos e ocupação">
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600">Carregando dashboard...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p class="text-red-600">{{ error }}</p>
      <Button @click="loadAll" class="mt-4">Tentar Novamente</Button>
    </div>

    <div v-else>
      <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
        <nav class="flex gap-2">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="px-3 py-1.5 rounded-md text-sm font-medium"
            :class="activeTab === tab.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>
        <div class="flex items-center gap-2">
          <select v-if="activeTab !== 'ocupacao'" v-model.number="days" class="rounded-md border-gray-300 text-sm">
            <option :value="7">7 dias</option>
            <option :value="30">30 dias</option>
            <option :value="90">90 dias</option>
          </select>
          <Button @click="loadAll">Atualizar</Button>
        </div>
      </div>

      <div v-show="activeTab === 'volume'">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p class="text-sm text-gray-600">Recebimentos ativos</p>
            <p class="text-3xl font-bold text-gray-900">{{ taskKpis?.volumeStatus.receiptsActive ?? 0 }}</p>
          </div>
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p class="text-sm text-gray-600">Recebimentos finalizados</p>
            <p class="text-3xl font-bold text-gray-900">{{ taskKpis?.volumeStatus.receiptsFinished ?? 0 }}</p>
          </div>
        </div>
        <Card title="Volume por tipo e status">
          <div class="h-72"><canvas ref="volumeChartRef"></canvas></div>
        </Card>
      </div>

      <div v-show="activeTab === 'ciclo'">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <p class="text-sm text-gray-600">Tempo médio do recebimento completo</p>
          <p class="text-3xl font-bold text-gray-900">{{ taskKpis?.cycleTime.fullReceiptAvgHours ?? 0 }}h</p>
        </div>
        <Card title="Tempo médio por etapa (horas)">
          <div class="h-72"><canvas ref="cycleChartRef"></canvas></div>
        </Card>
      </div>

      <div v-show="activeTab === 'produtividade'">
        <Card title="Produtividade por operador">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Operador</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tarefas concluídas</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Tempo médio de execução</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in taskKpis?.productivity ?? []" :key="entry.userId">
                <td class="px-4 py-2">{{ entry.userName }}</td>
                <td class="px-4 py-2">{{ entry.tasksCompleted }}</td>
                <td class="px-4 py-2">{{ entry.avgExecutionHours }}h</td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div v-show="activeTab === 'gargalos'">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div
            v-for="entry in taskKpis?.bottlenecks.byType ?? []"
            :key="entry.type"
            class="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
            <p class="text-sm text-gray-600">{{ entry.type }}</p>
            <p class="text-3xl font-bold text-red-600">{{ entry.count }}</p>
          </div>
        </div>
        <Card title="Recebimentos afetados">
          <table class="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Recebimento</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Etapa</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Horas parada</th>
                <th class="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in taskKpis?.bottlenecks.affected ?? []" :key="row.receiptId + row.taskType">
                <td class="px-4 py-2">{{ row.receiptNumber }}</td>
                <td class="px-4 py-2">{{ row.taskType }}</td>
                <td class="px-4 py-2">{{ row.hoursStuck }}h</td>
                <td class="px-4 py-2">
                  <RouterLink to="/wms/operations" class="text-primary-600 hover:underline">Ver no painel</RouterLink>
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      </div>

      <div v-show="activeTab === 'ocupacao'">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <p class="text-sm text-gray-600">% de ocupação geral</p>
          <p class="text-3xl font-bold text-gray-900">{{ overallOccupancyPercent }}%</p>
        </div>
        <Card title="Ocupação por armazém">
          <div class="h-72"><canvas ref="occupancyChartRef"></canvas></div>
        </Card>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import wmsKpiService from '@/services/wms-kpi.service'
import type { WmsTaskKpis, OccupancyResponse } from '@/types/wms-kpi.types'
import Chart from 'chart.js/auto'

type TabKey = 'volume' | 'ciclo' | 'produtividade' | 'gargalos' | 'ocupacao'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'volume', label: 'Volume/Status' },
  { key: 'ciclo', label: 'Tempo de Ciclo' },
  { key: 'produtividade', label: 'Produtividade' },
  { key: 'gargalos', label: 'Gargalos' },
  { key: 'ocupacao', label: 'Ocupação' },
]

const activeTab = ref<TabKey>('volume')
const days = ref(30)
const loading = ref(true)
const error = ref('')

const taskKpis = ref<WmsTaskKpis | null>(null)
const occupancy = ref<OccupancyResponse | null>(null)

const overallOccupancyPercent = computed(() => {
  const rows = occupancy.value?.byWarehouse ?? []
  const total = rows.reduce((sum, r) => sum + r.total, 0)
  const occupied = rows.reduce((sum, r) => sum + r.occupied, 0)
  return total > 0 ? Math.round((occupied / total) * 1000) / 10 : 0
})

const volumeChartRef = ref<HTMLCanvasElement | null>(null)
const cycleChartRef = ref<HTMLCanvasElement | null>(null)
const occupancyChartRef = ref<HTMLCanvasElement | null>(null)

let volumeChart: Chart | null = null
let cycleChart: Chart | null = null
let occupancyChart: Chart | null = null

async function loadTaskKpis(): Promise<void> {
  taskKpis.value = await wmsKpiService.getTaskKpis(days.value)
}

async function loadAll(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [taskData, occupancyData] = await Promise.all([
      wmsKpiService.getTaskKpis(days.value),
      wmsKpiService.getOccupancy(),
    ])
    taskKpis.value = taskData
    occupancy.value = occupancyData
    setTimeout(createCharts, 100)
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao carregar dashboard'
  } finally {
    loading.value = false
  }
}

watch(days, async () => {
  await loadTaskKpis()
  setTimeout(createCharts, 100)
})

function destroyCharts(): void {
  volumeChart?.destroy()
  cycleChart?.destroy()
  occupancyChart?.destroy()
}

function createCharts(): void {
  destroyCharts()

  if (volumeChartRef.value && taskKpis.value) {
    const byType = new Map<string, Record<string, number>>()
    for (const entry of taskKpis.value.volumeStatus.byTypeAndStatus) {
      const row = byType.get(entry.type) ?? {}
      row[entry.status] = entry.count
      byType.set(entry.type, row)
    }
    const labels = [...byType.keys()]
    const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
    const colors: Record<string, string> = {
      PENDING: '#FCD34D',
      IN_PROGRESS: '#3B82F6',
      COMPLETED: '#10B981',
      CANCELLED: '#EF4444',
    }
    volumeChart = new Chart(volumeChartRef.value, {
      type: 'bar',
      data: {
        labels,
        datasets: statuses.map((status) => ({
          label: status,
          data: labels.map((type) => byType.get(type)?.[status] ?? 0),
          backgroundColor: colors[status],
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      },
    })
  }

  if (cycleChartRef.value && taskKpis.value) {
    const labels = taskKpis.value.cycleTime.byType.map((e) => e.type)
    const data = taskKpis.value.cycleTime.byType.map((e) => e.avgHours)
    cycleChart = new Chart(cycleChartRef.value, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Horas', data, backgroundColor: '#8B5CF6' }] },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } },
      },
    })
  }

  if (occupancyChartRef.value && occupancy.value) {
    const labels = occupancy.value.byWarehouse.map((w) => w.warehouseCode)
    occupancyChart = new Chart(occupancyChartRef.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Ocupado', data: occupancy.value.byWarehouse.map((w) => w.occupied), backgroundColor: '#3B82F6' },
          { label: 'Livre', data: occupancy.value.byWarehouse.map((w) => w.free), backgroundColor: '#10B981' },
          { label: 'Bloqueado', data: occupancy.value.byWarehouse.map((w) => w.blocked), backgroundColor: '#EF4444' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      },
    })
  }
}

onMounted(loadAll)
onUnmounted(destroyCharts)
</script>
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/views/wms/__tests__/WmsKpiDashboardView.spec.ts`
Expected: PASS, 3 testes.

- [ ] **Step 5: Registrar a rota**

Modify `frontend/src/router/index.ts` — adicionar, junto das demais rotas do WMS (perto de `/wms/operations`):

```ts
  {
    path: '/wms/kpis',
    name: 'wms-kpis',
    component: () => import('../views/wms/WmsKpiDashboardView.vue'),
    meta: { requiresAuth: true },
  },
```

- [ ] **Step 6: Adicionar o card no Dashboard**

Modify `frontend/src/views/DashboardView.vue` — na aba WMS (`v-else-if="activeTab === 'wms' && authStore.canViewWMS"`), adicionar um `RouterLink` novo (junto dos existentes de Workflows/Operações Ativas/Recebimento):

```html
            <RouterLink
              to="/wms/kpis"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700">Dashboard de KPIs</p>
              </div>
            </RouterLink>
```

- [ ] **Step 7: Rodar a suíte completa de frontend e o type-check**

Run (de `frontend/`): `npx vitest run`
Expected: todos os testes passam (baseline + os novos desta task e da Task 4).

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem de erros pré-existente do baseline do projeto.

- [ ] **Step 8: Verificação visual manual**

Com os containers Docker rodando, adicionar `'wms-kpis': '/wms/kpis'` a `ROUTES` em `frontend/scripts/screenshot.mjs` e rodar:

```bash
node scripts/screenshot.mjs dashboard wms-kpis
```

Expected: `dashboard.png` mostra o novo card "Dashboard de KPIs" na aba WMS; `wms-kpis.png` mostra a aba Volume/Status por padrão, com os 2 cards de KPI e o gráfico de barras empilhadas (mesmo sem dados reais de teste no ambiente, a tela deve renderizar sem erro, com zeros/vazio).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/views/wms/WmsKpiDashboardView.vue frontend/src/views/wms/__tests__/WmsKpiDashboardView.spec.ts frontend/src/router/index.ts frontend/src/views/DashboardView.vue frontend/scripts/screenshot.mjs docs/fase-2026-09-modernizacao/screenshots/dashboard.png docs/fase-2026-09-modernizacao/screenshots/wms-kpis.png
git commit -m "feat(frontend): adiciona Dashboard de KPIs do WMS, rota e card no Dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final Check

- [ ] Rodar `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest --runInBand` em `backend/` — todos os testes passam (baseline + todos os novos deste plano).
- [ ] Rodar `npx vitest run` em `frontend/` — todos os testes passam.
- [ ] Rodar `npx vue-tsc --noEmit` em `frontend/` e `npx tsc --noEmit` em `backend/` — mesma contagem de erros do baseline do projeto.
- [ ] Verificação manual: logar como ADMIN, abrir `/wms/kpis`, criar um recebimento real (ou usar dados de seed/dev existentes), confirmar que a aba Volume/Status reflete a tarefa criada; trocar o período (7/30/90) e confirmar que só as 4 abas de Recebimento recarregam; abrir a aba Ocupação e confirmar que ela não depende do seletor de período.
- [ ] Revisão final de branch inteira — atenção especial a: (1) se `wms-kpi.service.ts` (Task 1) e `getOccupancy` (Task 3) usam exatamente as mesmas chaves/nomes que o frontend (Task 4/5) espera; (2) se o cálculo de `fullReceiptAvgHours` se comporta corretamente contra dados reais de recebimentos com etapas paralelas (mesma `sequence`); (3) se a rota `/wms/kpis` e o card do Dashboard não colidem com nada que uma eventual Task futura de PR ainda não mesclado tenha adicionado na aba WMS.
