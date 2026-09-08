# YMS — Dashboard Consolidado e KPIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o dashboard consolidado do YMS: totais por local (Portaria/Pátio/Doca), ocupação % de Pátio/Doca, e uma grade detalhada de visitas — em modo tempo real (visitas abertas) ou histórico (`days`), agregando dados já produzidos pelas Etapas 1-4, sem nenhum model novo.

**Architecture:** Etapa só de leitura — um único endpoint agregador (`yard-dashboard.service.ts`) consulta `YardVisit`, `YardSpot`, `YardDock` e o `AuditLog` genérico do projeto (já existente, fora do YMS) diretamente via Prisma, sem tocar nos services das etapas anteriores. Segue o padrão de `days` já usado em `maintenance-kpi.service.ts`/`wms-kpi.service.ts`.

**Tech Stack:** Node.js + TypeScript + Express + Prisma + MySQL (backend), Vue 3 Composition API + Pinia + TailwindCSS (frontend), Jest (backend tests), Vitest (frontend tests).

## Global Constraints

- **Pré-requisito**: Etapas 1-4 do YMS precisam estar implementadas (consome `YardVisit`, `YardSpot`, `YardArea`, `YardDock` de todas elas).
- Sem model novo — nenhuma migration nesta etapa.
- `warehouseId` é **obrigatório** no endpoint (`400` se ausente) — sem ele, ocupação % não tem denominador único.
- `days` é **opcional**: ausente = modo tempo real (visitas com `status IN (CHECKED_IN, IN_YARD, AT_DOCK)`); presente = modo histórico (`createdAt >= now - days`, inclui `COMPLETED`/`CANCELLED`).
- Ocupação % é `null` (nunca `0`) quando o armazém não tem nenhuma `YardSpot`/`YardDock` ativa cadastrada.
- Portaria **nunca** tem ocupação % — só o card de total.
- "Responsável" vem do `AuditLog` (já existente, model **fora** do YMS, não confundir com um model deste plano), filtrado por `resource IN ('check-in','allocate-spot','move-to-dock','start-loading','end-loading','complete','cancel')` (indexado via `@@index([resource])` já existente no schema) e o UUID da visita extraído de `endpoint` via regex — nunca por `resourceId` (não é preenchido pela captura automática do middleware, confirmado no spec).
- Sem RBAC novo — `yard:visualizar` (já existente) é suficiente, é só leitura.
- `requireModule('YMS')` já montado — só adicionar a rota nova à lista existente.
- Tela nova nasce com dark mode desde o primeiro commit.

---

### Task 1: Backend — endpoint agregador do dashboard

**Files:**
- Create: `backend/src/services/yard-dashboard.service.ts`
- Create: `backend/src/controllers/yard-dashboard.controller.ts`
- Create: `backend/src/routes/yard-dashboard.routes.ts`
- Create: `backend/src/validators/yard-dashboard.validator.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/yard-dashboard.service.test.ts`

**Interfaces:**
- Consumes: `prisma.yardVisit`, `prisma.yardSpot`, `prisma.yardDock`, `prisma.auditLog` (todos já existentes — os 3 primeiros das Etapas 1/3/4, `auditLog` é do núcleo do projeto).
- Produces: `YardDashboardService.getDashboard(warehouseId, days?)`, montado em `GET /yard-dashboard`. Nenhuma outra task deste plano depende deste arquivo.

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/tests/services/yard-dashboard.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestPositions, createTestSupplier, createTestManager } from '../helpers/fixtures';
import yardDashboardService from '../../src/services/yard-dashboard.service';
import yardVisitService from '../../src/services/yard-visit.service';
import driverService from '../../src/services/driver.service';
import vehicleService from '../../src/services/vehicle.service';

async function setupWarehouseWithParams(useYard = false) {
  const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
  await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard, delayToleranceMinutes: 15 } });
  return warehouse;
}

describe('YardDashboardService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('modo tempo real: conta só visitas abertas (CHECKED_IN/IN_YARD/AT_DOCK)', async () => {
    const warehouse = await setupWarehouseWithParams();
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'D1', cpf: '11111111111', supplierId: supplier.id });
    const vehicle = await vehicleService.create({ plate: 'DSH1111', type: 'TRUCK', supplierId: supplier.id });
    const openVisit = await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(openVisit.id, { driverId: driver.id, vehicleId: vehicle.id });

    const driver2 = await driverService.create({ name: 'D2', cpf: '22222222222', supplierId: supplier.id });
    const vehicle2 = await vehicleService.create({ plate: 'DSH2222', type: 'TRUCK', supplierId: supplier.id });
    const cancelledVisit = await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(cancelledVisit.id, { driverId: driver2.id, vehicleId: vehicle2.id });
    await yardVisitService.cancel(cancelledVisit.id);

    const dashboard = await yardDashboardService.getDashboard(warehouse.id);

    expect(dashboard.mode).toBe('REALTIME');
    expect(dashboard.totals.portaria).toBe(1);
    expect(dashboard.visits).toHaveLength(1);
  });

  it('modo histórico: inclui COMPLETED/CANCELLED dentro da janela de days', async () => {
    const warehouse = await setupWarehouseWithParams();
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'D3', cpf: '33333333333', supplierId: supplier.id });
    const vehicle = await vehicleService.create({ plate: 'DSH3333', type: 'TRUCK', supplierId: supplier.id });
    const visit = await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });
    await yardVisitService.cancel(visit.id);

    const dashboard = await yardDashboardService.getDashboard(warehouse.id, 30);

    expect(dashboard.mode).toBe('HISTORICAL');
    expect(dashboard.visits).toHaveLength(1);
    expect(dashboard.visits[0].currentLocation).toBe('CANCELADA');
  });

  it('ocupação de pátio é null quando o armazém não tem nenhuma vaga cadastrada', async () => {
    const warehouse = await setupWarehouseWithParams();

    const dashboard = await yardDashboardService.getDashboard(warehouse.id);

    expect(dashboard.occupancy.patioPercent).toBeNull();
    expect(dashboard.occupancy.patioRatio).toBeNull();
  });

  it('calcula ocupação de pátio corretamente quando há vagas', async () => {
    const warehouse = await setupWarehouseWithParams(true);
    const area = await testPrisma.yardArea.create({ data: { warehouseId: warehouse.id, code: 'SETOR-DASH', name: 'Setor Dashboard' } });
    await testPrisma.yardSpot.createMany({
      data: [1, 2, 3, 4].map((n) => ({ areaId: area.id, code: `SETOR-DASH-0${n}` })),
    });
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'D4', cpf: '44444444444', supplierId: supplier.id });
    const vehicle = await vehicleService.create({ plate: 'DSH4444', type: 'TRUCK', supplierId: supplier.id });
    const visit = await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });
    const spot = await testPrisma.yardSpot.findFirst({ where: { areaId: area.id } });
    await yardVisitService.allocateSpot(visit.id, spot!.id);

    const dashboard = await yardDashboardService.getDashboard(warehouse.id);

    expect(dashboard.occupancy.patioPercent).toBe(25); // 1/4
    expect(dashboard.occupancy.patioRatio).toBe('1/4');
  });

  it('deriva a origem do registro (MANUAL vs PURCHASE_ORDER)', async () => {
    const warehouse = await setupWarehouseWithParams();
    const supplier = await createTestSupplier();
    const manager = await createTestManager();
    const po = await testPrisma.purchaseOrder.create({
      data: { orderNumber: `PO-DASH-${Date.now()}`, supplierId: supplier.id, expectedDate: new Date(), totalValue: 0, createdBy: manager.id },
    });
    await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', purchaseOrderId: po.id, scheduledAt: new Date(),
    });
    await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'EXPEDICAO', supplierId: supplier.id, scheduledAt: new Date(),
    });

    const dashboard = await yardDashboardService.getDashboard(warehouse.id, 1);

    const origins = dashboard.visits.map((v) => v.origin).sort();
    expect(origins).toEqual(['MANUAL', 'PURCHASE_ORDER']);
  });

  it('rejeita chamar sem warehouseId', async () => {
    await expect(yardDashboardService.getDashboard('')).rejects.toThrow('Armazém é obrigatório');
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```bash
npm run test:integration -- yard-dashboard.service.test.ts
```

Esperado: FAIL (`Cannot find module '../../src/services/yard-dashboard.service'`).

- [ ] **Step 3: `yard-dashboard.validator.ts`**

Criar `backend/src/validators/yard-dashboard.validator.ts`:

```typescript
import Joi from 'joi';

export const getYardDashboardQuerySchema = Joi.object({
  warehouseId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do armazém inválido',
    'any.required': 'Armazém é obrigatório',
  }),
  days: Joi.number().integer().min(1).max(365),
}).unknown(true);
```

- [ ] **Step 4: `yard-dashboard.service.ts`**

Criar `backend/src/services/yard-dashboard.service.ts`:

```typescript
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export type PunctualityStatus = 'NO_HORARIO' | 'ANTECIPADO' | 'ATRASADO' | null;

export interface YardDashboardVisitRow {
  id: string;
  plate: string | null;
  driverName: string | null;
  vehicleModel: string | null;
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  supplierName: string | null;
  origin: 'MANUAL' | 'PURCHASE_ORDER';
  currentLocation: 'PORTARIA' | 'PATIO' | 'DOCA' | 'CONCLUIDA' | 'CANCELADA';
  scheduledAt: Date;
  punctuality: PunctualityStatus;
  performedBy: string | null;
  notes: string | null;
  totalDurationMinutes: number | null;
}

const LOCATION_BY_STATUS: Record<string, YardDashboardVisitRow['currentLocation']> = {
  SCHEDULED: 'PORTARIA', // não deveria aparecer na grade (nem tempo real nem histórico filtram SCHEDULED), mantido só por completude do map
  CHECKED_IN: 'PORTARIA',
  IN_YARD: 'PATIO',
  AT_DOCK: 'DOCA',
  COMPLETED: 'CONCLUIDA',
  CANCELLED: 'CANCELADA',
};

const VISIT_LIFECYCLE_ACTIONS = [
  'check-in', 'allocate-spot', 'move-to-dock', 'start-loading', 'end-loading', 'complete', 'cancel',
];
const VISIT_ID_IN_ENDPOINT = /\/yard-visits\/([a-f0-9-]{36})/i;

function computePunctuality(scheduledAt: Date, referenceTime: Date, toleranceMinutes: number): PunctualityStatus {
  const diffMinutes = (referenceTime.getTime() - scheduledAt.getTime()) / 60_000;
  if (Math.abs(diffMinutes) <= toleranceMinutes) return 'NO_HORARIO';
  return diffMinutes < 0 ? 'ANTECIPADO' : 'ATRASADO';
}

async function getLatestPerformerByVisit(visitIds: string[]): Promise<Map<string, string>> {
  if (visitIds.length === 0) return new Map();

  const logs = await prisma.auditLog.findMany({
    where: { resource: { in: VISIT_LIFECYCLE_ACTIONS } },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  });

  const relevantIds = new Set(visitIds);
  const map = new Map<string, string>();
  for (const log of logs) {
    const match = log.endpoint?.match(VISIT_ID_IN_ENDPOINT);
    const visitId = match?.[1];
    if (visitId && relevantIds.has(visitId) && !map.has(visitId) && log.user) {
      map.set(visitId, log.user.name);
    }
  }
  return map;
}

export class YardDashboardService {
  async getDashboard(warehouseId: string, days?: number) {
    if (!warehouseId) {
      throw new AppError(400, 'Armazém é obrigatório');
    }

    const mode: 'REALTIME' | 'HISTORICAL' = days ? 'HISTORICAL' : 'REALTIME';
    const where = days
      ? { warehouseId, createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
      : { warehouseId, status: { in: ['CHECKED_IN', 'IN_YARD', 'AT_DOCK'] as const } };

    const [visits, params, activeSpots, activeDocks] = await Promise.all([
      prisma.yardVisit.findMany({
        where,
        include: { supplier: true, driver: true, vehicle: true },
        orderBy: { scheduledAt: 'desc' },
      }),
      prisma.yardWarehouseParams.findUnique({ where: { warehouseId } }),
      prisma.yardSpot.count({ where: { active: true, blocked: false, area: { warehouseId, active: true, blocked: false } } }),
      prisma.yardDock.count({ where: { warehouseId, active: true } }),
    ]);

    const toleranceMinutes = params?.delayToleranceMinutes ?? 15;

    const totals = {
      portaria: visits.filter((v) => v.status === 'CHECKED_IN').length,
      patio: visits.filter((v) => v.status === 'IN_YARD').length,
      doca: visits.filter((v) => v.status === 'AT_DOCK').length,
    };

    const occupancy = {
      patioPercent: activeSpots > 0 ? Math.round((totals.patio / activeSpots) * 100) : null,
      docaPercent: activeDocks > 0 ? Math.round((totals.doca / activeDocks) * 100) : null,
      patioRatio: activeSpots > 0 ? `${totals.patio}/${activeSpots}` : null,
      docaRatio: activeDocks > 0 ? `${totals.doca}/${activeDocks}` : null,
    };

    const performedByMap = await getLatestPerformerByVisit(visits.map((v) => v.id));

    const rows: YardDashboardVisitRow[] = visits.map((v) => ({
      id: v.id,
      plate: v.vehicle?.plate ?? null,
      driverName: v.driver?.name ?? null,
      vehicleModel: v.vehicle?.model ?? null,
      serviceType: v.serviceType as YardDashboardVisitRow['serviceType'],
      supplierName: v.supplier?.name ?? null,
      origin: v.purchaseOrderId ? 'PURCHASE_ORDER' : 'MANUAL',
      currentLocation: LOCATION_BY_STATUS[v.status],
      scheduledAt: v.scheduledAt,
      punctuality:
        v.status === 'CANCELLED'
          ? null
          : computePunctuality(v.scheduledAt, v.checkedInAt ?? v.completedAt ?? new Date(), toleranceMinutes),
      performedBy: performedByMap.get(v.id) ?? null,
      notes: v.notes,
      totalDurationMinutes:
        v.status === 'COMPLETED' && v.checkedInAt && v.completedAt
          ? Math.round((v.completedAt.getTime() - v.checkedInAt.getTime()) / 60_000)
          : null,
    }));

    return { mode, totals, occupancy, visits: rows };
  }
}

export default new YardDashboardService();
```

- [ ] **Step 5: `yard-dashboard.controller.ts`**

Criar `backend/src/controllers/yard-dashboard.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import yardDashboardService from '../services/yard-dashboard.service';

export class YardDashboardController {
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const warehouseId = req.query.warehouseId as string;
      const days = req.query.days ? Number(req.query.days) : undefined;
      const dashboard = await yardDashboardService.getDashboard(warehouseId, days);
      res.status(200).json({ status: 'success', data: dashboard });
    } catch (error) {
      next(error);
    }
  }
}

export default new YardDashboardController();
```

- [ ] **Step 6: `yard-dashboard.routes.ts`**

Criar `backend/src/routes/yard-dashboard.routes.ts`:

```typescript
import { Router } from 'express';
import yardDashboardController from '../controllers/yard-dashboard.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validateQuery } from '../middleware/validation.middleware';
import { getYardDashboardQuerySchema } from '../validators/yard-dashboard.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(getYardDashboardQuerySchema),
  yardDashboardController.getDashboard
);

export default router;
```

- [ ] **Step 7: Montar a rota sob `requireModule('YMS')`**

Em `backend/src/routes/index.ts`, adicionar o import junto aos demais:

```typescript
import yardDashboardRoutes from './yard-dashboard.routes';
```

E adicionar, logo abaixo da última rota YMS já montada (`yard-visits`, Etapa 2, ou a mais recente adicionada pelas Etapas 3/4):

```typescript
router.use('/yard-dashboard', requireModule('YMS'), yardDashboardRoutes);
```

- [ ] **Step 8: Rodar os testes e verificar que passam**

```bash
npm run test:integration -- yard-dashboard.service.test.ts
```

Esperado: 6/6.

- [ ] **Step 9: Rodar a suíte completa para confirmar não-regressão**

```bash
npm run test:integration
```

Esperado: **backend do YMS (Etapas 1-5) completo.**

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/yard-dashboard.service.ts backend/src/controllers/yard-dashboard.controller.ts backend/src/routes/yard-dashboard.routes.ts backend/src/validators/yard-dashboard.validator.ts backend/src/routes/index.ts backend/tests/services/yard-dashboard.service.test.ts
git commit -m "feat(yms): adiciona dashboard consolidado (totais, ocupacao, grade detalhada)"
```

---

### Task 2: Frontend — tela de Dashboard Consolidado

**Files:**
- Create: `frontend/src/services/yard-dashboard.service.ts`
- Create: `frontend/src/views/yard/YardDashboardView.vue`
- Create: `frontend/src/views/yard/__tests__/YardDashboardView.spec.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `GET /yard-dashboard` (Task 1); `useWarehouseStore` (já existente).
- Produces: nenhuma outra task deste plano depende deste arquivo.

- [ ] **Step 1: `yard-dashboard.service.ts`**

Criar `frontend/src/services/yard-dashboard.service.ts`:

```typescript
import api from './api.service'

export type PunctualityStatus = 'NO_HORARIO' | 'ANTECIPADO' | 'ATRASADO' | null

export interface YardDashboardVisitRow {
  id: string
  plate: string | null
  driverName: string | null
  vehicleModel: string | null
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'
  supplierName: string | null
  origin: 'MANUAL' | 'PURCHASE_ORDER'
  currentLocation: 'PORTARIA' | 'PATIO' | 'DOCA' | 'CONCLUIDA' | 'CANCELADA'
  scheduledAt: string
  punctuality: PunctualityStatus
  performedBy: string | null
  notes: string | null
  totalDurationMinutes: number | null
}

export interface YardDashboardResponse {
  mode: 'REALTIME' | 'HISTORICAL'
  totals: { portaria: number; patio: number; doca: number }
  occupancy: {
    patioPercent: number | null
    docaPercent: number | null
    patioRatio: string | null
    docaRatio: string | null
  }
  visits: YardDashboardVisitRow[]
}

class YardDashboardService {
  private readonly basePath = '/yard-dashboard'

  async getDashboard(warehouseId: string, days?: number) {
    const params = new URLSearchParams()
    params.append('warehouseId', warehouseId)
    if (days) params.append('days', days.toString())
    return api.get(`${this.basePath}?${params.toString()}`)
  }
}

export default new YardDashboardService()
```

- [ ] **Step 2: Escrever o teste da view**

Criar `frontend/src/views/yard/__tests__/YardDashboardView.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import YardDashboardView from '../YardDashboardView.vue'
import yardDashboardService from '@/services/yard-dashboard.service'
import warehouseService from '@/services/warehouse.service'

vi.mock('@/services/yard-dashboard.service', () => ({
  default: { getDashboard: vi.fn() },
}))
vi.mock('@/services/warehouse.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))
vi.mock('@/stores/theme.store', () => ({ useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }) }))

const mockWarehouse = { id: 'wh-1', code: 'WH-1', name: 'Armazém Central', active: true, createdAt: '', updatedAt: '' }

const mockDashboard = {
  mode: 'REALTIME',
  totals: { portaria: 2, patio: 1, doca: 3 },
  occupancy: { patioPercent: 10, docaPercent: 60, patioRatio: '1/10', docaRatio: '3/5' },
  visits: [
    {
      id: 'visit-1', plate: 'ABC1D23', driverName: 'João da Silva', vehicleModel: 'Volvo FH',
      serviceType: 'RECEBIMENTO', supplierName: 'Transportadora Alfa', origin: 'MANUAL',
      currentLocation: 'DOCA', scheduledAt: new Date().toISOString(), punctuality: 'NO_HORARIO',
      performedBy: 'Admin', notes: null, totalDurationMinutes: null,
    },
  ],
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/dashboard', component: YardDashboardView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('YardDashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(warehouseService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockWarehouse], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  it('carrega o dashboard do primeiro armazém e exibe totais, ocupação e a grade', async () => {
    vi.mocked(yardDashboardService.getDashboard).mockResolvedValue({ data: { status: 'success', data: mockDashboard } } as any)

    const router = makeRouter()
    router.push('/yard/dashboard')
    await router.isReady()

    const wrapper = mount(YardDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    expect(yardDashboardService.getDashboard).toHaveBeenCalledWith('wh-1', undefined)
    expect(wrapper.text()).toContain('ABC1D23')
    expect(wrapper.text()).toContain('João da Silva')
    expect(wrapper.text()).toContain('Volvo FH')
    expect(wrapper.text()).toContain('1/10')
  })

  it('recarrega com o período (days) quando o usuário escolhe o modo histórico', async () => {
    vi.mocked(yardDashboardService.getDashboard).mockResolvedValue({ data: { status: 'success', data: mockDashboard } } as any)

    const router = makeRouter()
    router.push('/yard/dashboard')
    await router.isReady()

    const wrapper = mount(YardDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('#dashboard-days-select').setValue('30')
    await flushPromises()

    expect(yardDashboardService.getDashboard).toHaveBeenCalledWith('wh-1', 30)
  })
})
```

- [ ] **Step 3: Rodar o teste e verificar que falha**

```bash
npx vitest run src/views/yard/__tests__/YardDashboardView.spec.ts
```

Esperado: FAIL (`Cannot find module '../YardDashboardView.vue'`).

- [ ] **Step 4: `YardDashboardView.vue`**

Criar `frontend/src/views/yard/YardDashboardView.vue`:

```vue
<template>
  <AppLayout title="Dashboard do Pátio" subtitle="Totais, ocupação e visitas em tempo real ou por período">
    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField id="dashboard-warehouse-select" label="Armazém">
          <select
            v-model="selectedWarehouseId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="loadDashboard"
          >
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
          </select>
        </FormField>
        <FormField id="dashboard-days-select" label="Período">
          <select
            v-model="selectedDays"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="loadDashboard"
          >
            <option value="">Tempo real</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </FormField>
      </div>
    </Card>

    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">Carregando dashboard...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center dark:bg-red-950 dark:border-red-900">
      <p class="text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <template v-else-if="dashboard">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <p class="text-sm text-gray-500 dark:text-gray-400">Portaria</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ dashboard.totals.portaria }}</p>
        </Card>
        <Card>
          <p class="text-sm text-gray-500 dark:text-gray-400">Pátio</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ dashboard.totals.patio }}</p>
          <p v-if="dashboard.occupancy.patioRatio" class="text-sm text-gray-500 dark:text-gray-400">
            Ocupação: {{ dashboard.occupancy.patioRatio }} ({{ dashboard.occupancy.patioPercent }}%)
          </p>
          <p v-else class="text-sm text-gray-400">Sem vagas cadastradas</p>
        </Card>
        <Card>
          <p class="text-sm text-gray-500 dark:text-gray-400">Doca</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ dashboard.totals.doca }}</p>
          <p v-if="dashboard.occupancy.docaRatio" class="text-sm text-gray-500 dark:text-gray-400">
            Ocupação: {{ dashboard.occupancy.docaRatio }} ({{ dashboard.occupancy.docaPercent }}%)
          </p>
          <p v-else class="text-sm text-gray-400">Sem docas cadastradas</p>
        </Card>
      </div>

      <DataTable :loading="false" :error="''" :items="dashboard.visits" empty-title="Nenhuma visita no período">
        <template #head>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Placa</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Motorista</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Modelo</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Serviço</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fornecedor</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Origem</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Local</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Pontualidade</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Responsável</th>
          <th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tempo Total</th>
        </template>

        <template #row="{ item }">
          <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asRow(item).plate || '-' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asRow(item).driverName || '-' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asRow(item).vehicleModel || '-' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ SERVICE_TYPE_LABELS[asRow(item).serviceType] }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asRow(item).supplierName || '-' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ ORIGIN_LABELS[asRow(item).origin] }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ LOCATION_LABELS[asRow(item).currentLocation] }}</td>
          <td class="px-4 py-3 whitespace-nowrap">
            <StatusBadge
              v-if="asRow(item).punctuality"
              :label="PUNCTUALITY_LABELS[asRow(item).punctuality!]"
              :tone="PUNCTUALITY_TONES[asRow(item).punctuality!]"
            />
            <span v-else class="text-sm text-gray-400">-</span>
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asRow(item).performedBy || '-' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
            {{ asRow(item).totalDurationMinutes !== null ? formatDuration(asRow(item).totalDurationMinutes!) : '-' }}
          </td>
        </template>
      </DataTable>
    </template>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWarehouseStore } from '@/stores/warehouse.store'
import yardDashboardService, { type YardDashboardResponse, type YardDashboardVisitRow, type PunctualityStatus } from '@/services/yard-dashboard.service'
import AppLayout from '@/components/common/AppLayout.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

const SERVICE_TYPE_LABELS: Record<YardDashboardVisitRow['serviceType'], string> = {
  RECEBIMENTO: 'Recebimento', EXPEDICAO: 'Expedição', MULTIUSO: 'Multiuso',
}
const ORIGIN_LABELS: Record<YardDashboardVisitRow['origin'], string> = {
  MANUAL: 'Manual', PURCHASE_ORDER: 'Pedido de Compra',
}
const LOCATION_LABELS: Record<YardDashboardVisitRow['currentLocation'], string> = {
  PORTARIA: 'Portaria', PATIO: 'Pátio', DOCA: 'Doca', CONCLUIDA: 'Concluída', CANCELADA: 'Cancelada',
}
const PUNCTUALITY_LABELS: Record<Exclude<PunctualityStatus, null>, string> = {
  NO_HORARIO: 'No horário', ANTECIPADO: 'Antecipado', ATRASADO: 'Atrasado',
}
const PUNCTUALITY_TONES: Record<Exclude<PunctualityStatus, null>, 'success' | 'warning' | 'danger'> = {
  NO_HORARIO: 'success', ANTECIPADO: 'warning', ATRASADO: 'danger',
}

const warehouseStore = useWarehouseStore()

const selectedWarehouseId = ref('')
const selectedDays = ref('')
const loading = ref(false)
const error = ref('')
const dashboard = ref<YardDashboardResponse | null>(null)

const loadDashboard = async () => {
  if (!selectedWarehouseId.value) return
  try {
    loading.value = true
    error.value = ''
    const days = selectedDays.value ? Number(selectedDays.value) : undefined
    const result = await yardDashboardService.getDashboard(selectedWarehouseId.value, days)
    dashboard.value = result.data.data
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao carregar dashboard'
  } finally {
    loading.value = false
  }
}

const asRow = (item: unknown) => item as YardDashboardVisitRow

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return hours > 0 ? `${hours}h${remaining.toString().padStart(2, '0')}min` : `${remaining}min`
}

onMounted(async () => {
  await warehouseStore.fetchWarehouses()
  if (warehouseStore.warehouses.length > 0) {
    selectedWarehouseId.value = warehouseStore.warehouses[0].id
    await loadDashboard()
  }
})
</script>
```

- [ ] **Step 5: Rodar o teste e verificar que passa**

```bash
npx vitest run src/views/yard/__tests__/YardDashboardView.spec.ts
```

Esperado: 2/2.

- [ ] **Step 6: Montar a rota**

Em `frontend/src/router/index.ts`, adicionar:

```typescript
  {
    path: '/yard/dashboard',
    name: 'yard-dashboard',
    component: () => import('../views/yard/YardDashboardView.vue'),
    meta: { requiresAuth: true }
  },
```

- [ ] **Step 7: Trocar os 2 cards "Em breve" restantes por 1 card "Dashboard"**

Em `frontend/src/views/DashboardView.vue`, dentro do bloco `activeTab === 'yms'`, REMOVER os 2 cards estáticos "Tempo de Pátio" e "Relatórios YMS":

```vue
            <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed dark:border-gray-700 dark:bg-gray-900">
              <div class="text-center">
                <div class="text-3xl mb-2">⏱️</div>
                <p class="text-sm font-medium text-gray-500">Tempo de Pátio</p>
                <p class="text-xs text-gray-400 mt-1">Em breve</p>
              </div>
            </div>
            <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed dark:border-gray-700 dark:bg-gray-900">
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Relatórios YMS</p>
                <p class="text-xs text-gray-400 mt-1">Em breve</p>
              </div>
            </div>
```

E adicionar, no lugar dos dois, UM `RouterLink`:

```vue
            <RouterLink
              to="/yard/dashboard"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard</p>
              </div>
            </RouterLink>
```

**A aba "Pátio" do Dashboard fica com todos os cards ativos** — Agendamento (Etapa 2), Docas (Etapa 1), Motoristas (Etapa 1), Frotas (Etapa 1), Veículos (Etapa 1), Áreas e Vagas (Etapa 3), Dashboard (esta etapa). Nenhum "Em breve" restante.

- [ ] **Step 8: Rodar a suíte completa do frontend + type-check**

```bash
npx vitest run && npx vue-tsc --noEmit
```

Esperado: **frontend do YMS (Etapas 1-5) completo.**

- [ ] **Step 9: Commit**

```bash
git add frontend/src/services/yard-dashboard.service.ts frontend/src/views/yard/YardDashboardView.vue frontend/src/views/yard/__tests__/YardDashboardView.spec.ts frontend/src/router/index.ts frontend/src/views/DashboardView.vue
git commit -m "feat(yms): adiciona dashboard consolidado ao frontend"
```

---

### Task 3: Verificação end-to-end real

**Files:** nenhum (task de verificação, sem mudança de código).

**Interfaces:** nenhuma.

- [ ] **Step 1: Ambiente**

Confirme (peça aprovação explícita do usuário) os containers apontando para este worktree/branch.

- [ ] **Step 2: Migração + seed no banco real**

```bash
npx prisma migrate deploy
npm run prisma:seed
```

(Sem migration nova nesta etapa — este step confirma que o banco já está atualizado das etapas anteriores.)

- [ ] **Step 3: Fluxo completo via UI real (login como admin)**

1. Confirme que a aba "Pátio" não tem mais nenhum card "Em breve".
2. `/yard/dashboard`: com o fluxo completo já percorrido nas verificações e2e das Etapas 2-4 (ou repetindo um ciclo agendar→check-in→pátio→doca→checkout agora), confirmar que os totais e a grade refletem o estado real.
3. Confirmar que "Responsável" na grade mostra o nome de quem fez o check-in/moveu a visita (usuário logado no momento de cada ação).
4. Trocar o período pra "Últimos 7 dias" — confirmar que visitas já `COMPLETED`/`CANCELLED` aparecem, e que o modo muda pra histórico.
5. Confirmar que a ocupação de Pátio/Doca bate com o que as telas de Áreas/Vagas e Docas mostram.
6. Testar com um armazém sem nenhuma vaga/doca cadastrada — confirmar "Sem vagas cadastradas"/"Sem docas cadastradas" em vez de "0%".

- [ ] **Step 4: RBAC e licenciamento negativos**

Mesmo roteiro das etapas anteriores — `yard:visualizar` é suficiente pro dashboard (sem `executar`/`gerenciar` envolvidos).

- [ ] **Step 5: Relato final**

Sem commit neste task. Relate o resultado de cada step. **Esta é a verificação final do YMS inteiro (Etapas 1-5)** — se tudo passar, o módulo está completo ponta a ponta.

---

## YMS completo

Com esta etapa, as 5 fases planejadas do YMS (Cadastros Base, Agendamento + Check-in, Pátio, Operação de Doca, Dashboard/KPIs) têm spec e plano prontos, documentando o módulo inteiro do jeito que o documento de referência (`YMS Gestão de Pátio.pdf`) descreveu — com os ajustes de escopo decididos ao longo do caminho (TMS fora, chamada automática fora, restrição por planta fora) registrados em cada spec. Nenhuma implementação foi executada — os 5 planos ficam prontos pra quando a prioridade permitir.
