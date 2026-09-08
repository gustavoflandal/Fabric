# YMS — Operação de Doca (Carga/Descarga, Checkout) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o ciclo de vida da visita (`YardVisit`, Etapas 2/3): mover para uma doca livre, marcar início/término de carga-descarga, e finalizar/liberar (checkout) — calculando o "Tempo Total da Operação". Status de doca (OC/DP) continua derivado, nunca persistido.

**Architecture:** Sem model novo — só estende `YardVisit` (campos + 2 valores de enum) e o service/controller/routes/validator já existentes de `yard-visit.*` (Etapas 2/3), seguindo os mesmos padrões (RBAC via `requirePermission`, licenciamento via `requireModule`, campos calculados nunca persistidos).

**Tech Stack:** Node.js + TypeScript + Express + Prisma + MySQL (backend), Vue 3 Composition API + Pinia + TailwindCSS (frontend), Jest (backend tests), Vitest (frontend tests).

## Global Constraints

- **Pré-requisito**: Etapas 1, 2 e 3 do YMS precisam estar implementadas.
- Status de doca (OC/DP) **nunca é persistido** — sempre derivado de existir ou não uma `YardVisit` com `status: AT_DOCK` referenciando aquele `yardDockId`.
- `loadingStartedAt`/`loadingEndedAt` são timestamps dentro do MESMO status `AT_DOCK` — não criar estados novos pra eles.
- Não existe ação de "retornar pra portaria" a partir de `AT_DOCK` — a única saída é o checkout (`complete`).
- Checkout (`complete`) NÃO exige que `loadingStartedAt`/`loadingEndedAt` estejam preenchidos.
- `move-to-dock` é válido a partir de `IN_YARD` OU `CHECKED_IN` (quando `YardWarehouseParams.useYard = false` do armazém da visita).
- Doca de destino precisa ter `serviceType` compatível com `visit.serviceType` (igual, ou um dos dois `MULTIUSO`) e pertencer ao MESMO armazém da visita.
- "Tempo Total da Operação" = `completedAt - checkedInAt`, calculado, nunca persistido.
- Sem RBAC novo — tudo sob `yard:executar` (já existente).
- `requireModule('YMS')` já montado — só adicionar rotas à lista existente.
- Migrations via `npx prisma migrate dev --name <nome>` a partir de `backend`; `npx prisma generate` depois.

---

### Task 1: Schema — estende `YardVisit` com os campos de doca

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Consumes: `YardDock` (Etapa 1), `YardVisit`/`YardVisitStatus` (Etapas 2/3, serão estendidos).
- Produces: `YardVisit` com `yardDockId`/`dockArrivedAt`/`loadingStartedAt`/`loadingEndedAt`/`completedAt`; `YardVisitStatus` com `AT_DOCK`/`COMPLETED`. Usados pela Task 2.

- [ ] **Step 1: Estender `YardVisitStatus`**

No enum `YardVisitStatus` já existente (Etapas 2/3), adicionar `AT_DOCK` e `COMPLETED` antes de `CANCELLED`:

```prisma
enum YardVisitStatus {
  SCHEDULED
  CHECKED_IN
  IN_YARD
  AT_DOCK
  COMPLETED
  CANCELLED
}
```

- [ ] **Step 2: Estender o model `YardVisit`**

No model `YardVisit` já existente, adicionar os campos:

```prisma
  yardDockId       String?
  dockArrivedAt    DateTime?
  loadingStartedAt DateTime?
  loadingEndedAt   DateTime?
  completedAt      DateTime?
```

E a relação:

```prisma
  yardDock YardDock? @relation(fields: [yardDockId], references: [id])
```

- [ ] **Step 3: Adicionar a relação reversa em `YardDock`**

No model `YardDock` já existente (Etapa 1), adicionar:

```prisma
  yardVisits YardVisit[]
```

- [ ] **Step 4: Gerar e aplicar a migration no banco de DEV**

```bash
npx prisma migrate dev --name add_yard_visit_dock_operation
```

- [ ] **Step 5: Regenerar o Prisma Client**

```bash
npx prisma generate
```

- [ ] **Step 6: Rodar a suíte de integração para confirmar não-regressão**

```bash
npm run test:integration
```

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(yms): estende YardVisit com campos de operacao de doca (AT_DOCK/COMPLETED)"
```

---

### Task 2: Backend — mover para doca, carga/descarga, checkout

**Files:**
- Modify: `backend/src/services/yard-visit.service.ts`
- Modify: `backend/src/controllers/yard-visit.controller.ts`
- Modify: `backend/src/routes/yard-visit.routes.ts`
- Modify: `backend/src/validators/yard-visit.validator.ts`
- Modify: `backend/tests/services/yard-visit.service.test.ts`

**Interfaces:**
- Consumes: `prisma.yardDock` (Etapa 1); `yardWarehouseParamsService.getByWarehouseId` (já importado no arquivo desde a Etapa 2).
- Produces: `yardVisitService.moveToDock`, `.startLoading`, `.endLoading`, `.complete`, expostos em `PATCH /yard-visits/:id/move-to-dock`, `/start-loading`, `/end-loading`, `/complete`. Nenhuma outra task deste plano depende destes métodos.

- [ ] **Step 1: Adicionar os testes que falham**

No arquivo `backend/tests/services/yard-visit.service.test.ts` (já existente), adicionar este `describe` novo, antes do `});` final:

```typescript
describe('operação de doca', () => {
  async function setupCheckedInVisitAtDock() {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: false, delayToleranceMinutes: 15 } });
    const dock = await testPrisma.yardDock.create({ data: { warehouseId: warehouse.id, code: 'DOCA-OP-01', serviceType: 'RECEBIMENTO' } });
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'M-Doca', cpf: '11133355577', supplierId: supplier.id });
    const vehicle = await vehicleService.create({ plate: 'DCK1234', type: 'TRUCK', supplierId: supplier.id });
    const visit = await yardVisitService.create({
      warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });
    return { warehouse, dock, visit };
  }

  it('move uma visita CHECKED_IN direto pra doca quando o armazém não usa pátio', async () => {
    const { dock, visit } = await setupCheckedInVisitAtDock();

    const moved = await yardVisitService.moveToDock(visit.id, dock.id);

    expect(moved.status).toBe('AT_DOCK');
    expect(moved.yardDockId).toBe(dock.id);
    expect(moved.dockArrivedAt).not.toBeNull();
  });

  it('rejeita mover pra uma doca com tipo de serviço incompatível', async () => {
    const { warehouse, visit } = await setupCheckedInVisitAtDock();
    const expeditionDock = await testPrisma.yardDock.create({ data: { warehouseId: warehouse.id, code: 'DOCA-OP-02', serviceType: 'EXPEDICAO' } });

    await expect(yardVisitService.moveToDock(visit.id, expeditionDock.id)).rejects.toThrow(
      'Tipo de serviço da doca incompatível com a visita'
    );
  });

  it('permite mover pra uma doca MULTIUSO independente do tipo de serviço da visita', async () => {
    const { warehouse, visit } = await setupCheckedInVisitAtDock();
    const multiDock = await testPrisma.yardDock.create({ data: { warehouseId: warehouse.id, code: 'DOCA-OP-03', serviceType: 'MULTIUSO' } });

    await expect(yardVisitService.moveToDock(visit.id, multiDock.id)).resolves.toMatchObject({ status: 'AT_DOCK' });
  });

  it('rejeita mover pra uma doca já ocupada por outra visita', async () => {
    const { dock, visit: visit1 } = await setupCheckedInVisitAtDock();
    await yardVisitService.moveToDock(visit1.id, dock.id);

    // Segunda visita CHECKED_IN no MESMO armazém do dock já ocupado por visit1.
    const supplier = await createTestSupplier();
    const driver2 = await driverService.create({ name: 'D2', cpf: '22244466688', supplierId: supplier.id });
    const vehicle2 = await vehicleService.create({ plate: 'DCK5678', type: 'TRUCK', supplierId: supplier.id });
    const visit2 = await yardVisitService.create({
      warehouseId: dock.warehouseId, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
    });
    await yardVisitService.checkIn(visit2.id, { driverId: driver2.id, vehicleId: vehicle2.id });

    await expect(yardVisitService.moveToDock(visit2.id, dock.id)).rejects.toThrow('Doca já está ocupada');
  });

  it('inicia e conclui a carga/descarga, e finaliza com checkout preenchendo completedAt', async () => {
    const { dock, visit } = await setupCheckedInVisitAtDock();
    await yardVisitService.moveToDock(visit.id, dock.id);

    const started = await yardVisitService.startLoading(visit.id);
    expect(started.loadingStartedAt).not.toBeNull();

    const ended = await yardVisitService.endLoading(visit.id);
    expect(ended.loadingEndedAt).not.toBeNull();

    const completed = await yardVisitService.complete(visit.id);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).not.toBeNull();
  });

  it('rejeita iniciar carga duas vezes', async () => {
    const { dock, visit } = await setupCheckedInVisitAtDock();
    await yardVisitService.moveToDock(visit.id, dock.id);
    await yardVisitService.startLoading(visit.id);

    await expect(yardVisitService.startLoading(visit.id)).rejects.toThrow('Carga/descarga já foi iniciada');
  });

  it('rejeita concluir carga sem ter iniciado', async () => {
    const { dock, visit } = await setupCheckedInVisitAtDock();
    await yardVisitService.moveToDock(visit.id, dock.id);

    await expect(yardVisitService.endLoading(visit.id)).rejects.toThrow('Carga/descarga ainda não foi iniciada');
  });

  it('permite checkout mesmo sem carga formalmente iniciada/concluída', async () => {
    const { dock, visit } = await setupCheckedInVisitAtDock();
    await yardVisitService.moveToDock(visit.id, dock.id);

    await expect(yardVisitService.complete(visit.id)).resolves.toMatchObject({ status: 'COMPLETED' });
  });

  it('libera a doca (volta a ficar livre) depois do checkout', async () => {
    const { dock, visit } = await setupCheckedInVisitAtDock();
    await yardVisitService.moveToDock(visit.id, dock.id);
    await yardVisitService.complete(visit.id);

    const occupied = await testPrisma.yardVisit.findFirst({ where: { yardDockId: dock.id, status: 'AT_DOCK' } });
    expect(occupied).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```bash
npm run test:integration -- yard-visit.service.test.ts
```

Esperado: FAIL (`yardVisitService.moveToDock is not a function`).

- [ ] **Step 3: Adicionar os schemas ao validator**

Em `backend/src/validators/yard-visit.validator.ts` (já existente), adicionar:

```typescript
export const moveToDockYardVisitSchema = Joi.object({
  yardDockId: Joi.string().uuid().required().messages({
    'string.guid': 'ID da doca inválido',
    'any.required': 'Doca é obrigatória',
  }),
});
```

(`start-loading`, `end-loading` e `complete` não recebem corpo — sem schema novo pra eles, as rotas correspondentes não usam `validate()`.)

- [ ] **Step 4: Adicionar os métodos ao service**

Em `backend/src/services/yard-visit.service.ts` (já existente), adicionar os métodos dentro da classe `YardVisitService`, depois de `allocateSpot` (Etapa 3):

```typescript
  async moveToDock(id: string, yardDockId: string) {
    const visit = await prisma.yardVisit.findUnique({ where: { id } });
    if (!visit) throw new AppError(404, 'Visita não encontrada');

    if (visit.status === 'CHECKED_IN') {
      const params = await yardWarehouseParamsService.getByWarehouseId(visit.warehouseId);
      if (params.useYard) {
        throw new AppError(400, 'Este armazém usa pátio — aloque uma vaga antes de mover para a doca');
      }
    } else if (visit.status !== 'IN_YARD') {
      throw new AppError(400, 'Só é possível mover para a doca a partir do pátio ou, sem uso de pátio, direto do check-in');
    }

    const dock = await prisma.yardDock.findUnique({ where: { id: yardDockId } });
    if (!dock) throw new AppError(400, 'Doca informada não existe');
    if (!dock.active) throw new AppError(400, 'Doca está inativa');
    if (dock.warehouseId !== visit.warehouseId) throw new AppError(400, 'A doca informada pertence a outro armazém');
    if (dock.serviceType !== 'MULTIUSO' && visit.serviceType !== 'MULTIUSO' && dock.serviceType !== visit.serviceType) {
      throw new AppError(400, 'Tipo de serviço da doca incompatível com a visita');
    }

    const occupied = await prisma.yardVisit.findFirst({ where: { yardDockId, status: 'AT_DOCK' } });
    if (occupied) throw new AppError(400, 'Doca já está ocupada');

    return prisma.yardVisit.update({
      where: { id },
      data: { status: 'AT_DOCK', yardDockId, dockArrivedAt: new Date() },
    });
  }

  async startLoading(id: string) {
    const visit = await prisma.yardVisit.findUnique({ where: { id } });
    if (!visit) throw new AppError(404, 'Visita não encontrada');
    if (visit.status !== 'AT_DOCK') throw new AppError(400, 'Só é possível iniciar carga/descarga com a visita na doca');
    if (visit.loadingStartedAt) throw new AppError(400, 'Carga/descarga já foi iniciada');

    return prisma.yardVisit.update({ where: { id }, data: { loadingStartedAt: new Date() } });
  }

  async endLoading(id: string) {
    const visit = await prisma.yardVisit.findUnique({ where: { id } });
    if (!visit) throw new AppError(404, 'Visita não encontrada');
    if (visit.status !== 'AT_DOCK') throw new AppError(400, 'Só é possível concluir carga/descarga com a visita na doca');
    if (!visit.loadingStartedAt) throw new AppError(400, 'Carga/descarga ainda não foi iniciada');
    if (visit.loadingEndedAt) throw new AppError(400, 'Carga/descarga já foi concluída');

    return prisma.yardVisit.update({ where: { id }, data: { loadingEndedAt: new Date() } });
  }

  async complete(id: string) {
    const visit = await prisma.yardVisit.findUnique({ where: { id } });
    if (!visit) throw new AppError(404, 'Visita não encontrada');
    if (visit.status !== 'AT_DOCK') throw new AppError(400, 'Só é possível finalizar/liberar com a visita na doca');

    return prisma.yardVisit.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
  }
```

- [ ] **Step 5: Adicionar os métodos ao controller**

Em `backend/src/controllers/yard-visit.controller.ts` (já existente), adicionar dentro da classe `YardVisitController`, depois de `allocateSpot`:

```typescript
  async moveToDock(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.moveToDock(req.params.id, req.body.yardDockId);
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }

  async startLoading(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.startLoading(req.params.id);
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }

  async endLoading(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.endLoading(req.params.id);
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.complete(req.params.id);
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }
```

- [ ] **Step 6: Adicionar as rotas**

Em `backend/src/routes/yard-visit.routes.ts` (já existente), adicionar o import de `moveToDockYardVisitSchema` junto aos demais, e as rotas logo abaixo de `router.patch('/:id/allocate-spot', ...)` (Etapa 3):

```typescript
router.patch(
  '/:id/move-to-dock',
  requirePermission('yard', 'executar'),
  validate(moveToDockYardVisitSchema),
  yardVisitController.moveToDock
);
router.patch('/:id/start-loading', requirePermission('yard', 'executar'), yardVisitController.startLoading);
router.patch('/:id/end-loading', requirePermission('yard', 'executar'), yardVisitController.endLoading);
router.patch('/:id/complete', requirePermission('yard', 'executar'), yardVisitController.complete);
```

- [ ] **Step 7: Rodar os testes e verificar que passam**

```bash
npm run test:integration -- yard-visit.service.test.ts
```

Esperado: 29/29 (20 das Etapas 2/3 + 9 novos desta task).

- [ ] **Step 8: Rodar a suíte completa para confirmar não-regressão**

```bash
npm run test:integration
```

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/yard-visit.service.ts backend/src/controllers/yard-visit.controller.ts backend/src/routes/yard-visit.routes.ts backend/src/validators/yard-visit.validator.ts backend/tests/services/yard-visit.service.test.ts
git commit -m "feat(yms): adiciona operacao de doca (mover, carga/descarga, checkout)"
```

---

### Task 3: Frontend — mover para doca, carga/descarga, checkout

**Files:**
- Modify: `frontend/src/services/yard-visit.service.ts`
- Modify: `frontend/src/stores/yard-visit.store.ts`
- Modify: `frontend/src/views/yard/YardVisitListView.vue`
- Modify: `frontend/src/views/yard/__tests__/YardVisitListView.spec.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `PATCH /yard-visits/:id/move-to-dock` + `/start-loading` + `/end-loading` + `/complete` (Task 2); `yardDockService` (Etapa 1, frontend — `getAll({ warehouseId, serviceType, active })`, já existe).
- Produces: nenhuma outra task deste plano depende deste arquivo.

- [ ] **Step 1: Adicionar os métodos ao `yard-visit.service.ts`**

Em `frontend/src/services/yard-visit.service.ts` (já existente), adicionar à classe `YardVisitService`:

```typescript
  async moveToDock(id: string, yardDockId: string) {
    return api.patch(`${this.basePath}/${id}/move-to-dock`, { yardDockId })
  }

  async startLoading(id: string) {
    return api.patch(`${this.basePath}/${id}/start-loading`)
  }

  async endLoading(id: string) {
    return api.patch(`${this.basePath}/${id}/end-loading`)
  }

  async complete(id: string) {
    return api.patch(`${this.basePath}/${id}/complete`)
  }
```

Atualizar `YardVisitStatus` para incluir os 2 valores novos:

```typescript
export type YardVisitStatus = 'SCHEDULED' | 'CHECKED_IN' | 'IN_YARD' | 'AT_DOCK' | 'COMPLETED' | 'CANCELLED'
```

E adicionar os campos novos à interface `YardVisit` (junto a `yardSpotId`):

```typescript
  yardDockId: string | null
  dockArrivedAt: string | null
  loadingStartedAt: string | null
  loadingEndedAt: string | null
  completedAt: string | null
```

- [ ] **Step 2: Adicionar as actions à store**

Em `frontend/src/stores/yard-visit.store.ts` (já existente), adicionar, seguindo o mesmo padrão de `allocateSpot`:

```typescript
  const moveToDock = async (id: string, yardDockId: string) => {
    try {
      loading.value = true
      error.value = null
      await yardVisitService.moveToDock(id, yardDockId)
      await fetchVisits()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao mover para a doca'
      throw err
    } finally {
      loading.value = false
    }
  }

  const startLoading = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardVisitService.startLoading(id)
      await fetchVisits()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao iniciar carga/descarga'
      throw err
    } finally {
      loading.value = false
    }
  }

  const endLoading = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardVisitService.endLoading(id)
      await fetchVisits()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao concluir carga/descarga'
      throw err
    } finally {
      loading.value = false
    }
  }

  const completeVisit = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardVisitService.complete(id)
      await fetchVisits()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao finalizar/liberar visita'
      throw err
    } finally {
      loading.value = false
    }
  }
```

E adicionar `moveToDock, startLoading, endLoading, completeVisit` ao `return { ... }` do final da store.

- [ ] **Step 3: Adicionar os testes que falham**

No arquivo `frontend/src/views/yard/__tests__/YardVisitListView.spec.ts` (já existente), adicionar `moveToDock: vi.fn(), startLoading: vi.fn(), endLoading: vi.fn(), complete: vi.fn()` ao mock de `yard-visit.service` já existente no topo, e adicionar o mock de `yard-dock.service`:

```typescript
vi.mock('@/services/yard-dock.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
```

E, no `beforeEach`, o mock de resposta default:

```typescript
    vi.mocked(yardDockService.getAll).mockResolvedValue({
      data: { status: 'success', data: [{ id: 'dock-1', code: 'DOCA-01', serviceType: 'RECEBIMENTO', warehouseId: 'wh-1', storagePositionId: null, active: true, createdAt: '', updatedAt: '' }], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
```

(Precisa importar `yardDockService` no topo do arquivo.)

Adicionar este teste, junto aos demais `it(...)`:

```typescript
  it('move uma visita alocada em pátio (IN_YARD) para uma doca', async () => {
    const inYardVisit = { ...mockVisit, status: 'IN_YARD', driverId: 'drv-1', vehicleId: 'veh-1', yardSpotId: 'spot-1' }
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [inYardVisit], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(yardVisitService.moveToDock).mockResolvedValue({ data: { status: 'success', data: { ...inYardVisit, status: 'AT_DOCK' } } } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const moveButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Mover para Doca')!
    await moveButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#move-to-dock-select').setValue('dock-1')
    await body.find('#move-to-dock-form').trigger('submit.prevent')
    await flushPromises()

    expect(yardVisitService.moveToDock).toHaveBeenCalledWith('visit-1', 'dock-1')
  })

  it('exibe as ações de carga/descarga e checkout para uma visita AT_DOCK', async () => {
    const atDockVisit = {
      ...mockVisit, status: 'AT_DOCK', driverId: 'drv-1', vehicleId: 'veh-1', yardDockId: 'dock-1',
      loadingStartedAt: null, loadingEndedAt: null,
    }
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [atDockVisit], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.findAll('button').some((b) => b.text().trim() === 'Iniciar Carga/Descarga')).toBe(true)
    expect(wrapper.findAll('button').some((b) => b.text().trim() === 'Finalizar e Liberar')).toBe(true)
  })
```

- [ ] **Step 4: Rodar o teste e verificar que falha**

```bash
npx vitest run src/views/yard/__tests__/YardVisitListView.spec.ts
```

Esperado: FAIL (os botões novos ainda não existem).

- [ ] **Step 5: Adicionar as ações de doca a `YardVisitListView.vue`**

No `<template #row="{ item }">` de `frontend/src/views/yard/YardVisitListView.vue` (já existente), trocar o bloco `v-else-if="asItem(item).status === 'IN_YARD'"` (se a Task 5 da Etapa 3 o criou; caso a visita `IN_YARD` ainda não tivesse nenhuma ação própria além da herdada de `CHECKED_IN`, adicionar o bloco do zero) para incluir "Mover para Doca", e adicionar os blocos para `CHECKED_IN` (quando o armazém não usa pátio) e `AT_DOCK`:

```vue
          <template v-else-if="asItem(item).status === 'CHECKED_IN' && !warehouseUsesYard[asItem(item).warehouseId]">
            <button @click="openMoveToDockModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Mover para Doca</button>
            <button @click="handleCancel(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Cancelar</button>
          </template>
          <template v-else-if="asItem(item).status === 'IN_YARD'">
            <button @click="openMoveToDockModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Mover para Doca</button>
            <button @click="handleCancel(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Cancelar</button>
          </template>
          <template v-else-if="asItem(item).status === 'AT_DOCK'">
            <button
              v-if="!asItem(item).loadingStartedAt"
              @click="handleStartLoading(asItem(item))"
              class="text-primary-600 hover:text-primary-900"
            >
              Iniciar Carga/Descarga
            </button>
            <button
              v-else-if="!asItem(item).loadingEndedAt"
              @click="handleEndLoading(asItem(item))"
              class="text-primary-600 hover:text-primary-900"
            >
              Concluir Carga/Descarga
            </button>
            <button @click="handleComplete(asItem(item))" class="text-green-600 hover:text-green-900">Finalizar e Liberar</button>
          </template>
          <template v-else-if="asItem(item).status === 'COMPLETED'">
            <span class="text-sm text-gray-500 dark:text-gray-400">{{ formatDuration(asItem(item).checkedInAt, asItem(item).completedAt) }}</span>
          </template>
```

Nota: o bloco `v-else-if="asItem(item).status === 'CHECKED_IN'"` que já existia (com "Alocar Vaga"/"Cancelar", da Etapa 3) precisa continuar existindo ANTES deste novo bloco condicional de `CHECKED_IN` sem pátio — os dois são mutuamente exclusivos por `warehouseUsesYard`, mas o Vue avalia `v-else-if` em ordem, então o bloco original (Etapa 3, que mostra "Alocar Vaga" quando `warehouseUsesYard[...]` é `true`) deve vir ANTES deste. Confira a ordem real dos blocos no arquivo antes de inserir — o objetivo final é: `CHECKED_IN` com pátio → Alocar Vaga; `CHECKED_IN` sem pátio → Mover para Doca; `IN_YARD` → Mover para Doca; `AT_DOCK` → ações de carga/checkout; `COMPLETED` → tempo total.

Adicionar, antes do `</AppLayout>` de fechamento, o modal de mover pra doca:

```vue
    <AppModal v-model="showMoveToDockModal" title="Mover para Doca" @close="closeMoveToDockModal">
      <form id="move-to-dock-form" @submit.prevent="handleConfirmMoveToDock" class="space-y-4">
        <FormField id="move-to-dock-select" label="Doca livre" required>
          <select v-model="moveToDockId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="dock in availableDocksForMove" :key="dock.id" :value="dock.id">{{ dock.code }}</option>
          </select>
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeMoveToDockModal" class="flex-1">Cancelar</Button>
          <Button type="submit" class="flex-1">Mover</Button>
        </div>
      </form>
    </AppModal>
```

No `<script setup>`, adicionar o import:

```typescript
import yardDockService, { type YardDock } from '@/services/yard-dock.service'
```

Adicionar `AT_DOCK: 'Na doca'` e `COMPLETED: 'Concluída'` a `STATUS_LABELS`/`STATUS_TONES` (já existentes, ganharam `IN_YARD` na Etapa 3):

```typescript
const STATUS_LABELS: Record<YardVisitStatus, string> = {
  SCHEDULED: 'Agendado',
  CHECKED_IN: 'Check-in feito',
  IN_YARD: 'No pátio',
  AT_DOCK: 'Na doca',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelado',
}
const STATUS_TONES: Record<YardVisitStatus, 'success' | 'warning' | 'danger'> = {
  SCHEDULED: 'warning',
  CHECKED_IN: 'success',
  IN_YARD: 'success',
  AT_DOCK: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}
```

Adicionar o estado novo:

```typescript
const showMoveToDockModal = ref(false)
const movingVisit = ref<YardVisit | null>(null)
const moveToDockId = ref('')
const availableDocksForMove = ref<YardDock[]>([])
```

Adicionar as funções novas:

```typescript
const openMoveToDockModal = async (visit: YardVisit) => {
  movingVisit.value = visit
  moveToDockId.value = ''
  showMoveToDockModal.value = true
  const result = await yardDockService.getAll(1, 100, { warehouseId: visit.warehouseId, active: true })
  availableDocksForMove.value = (result.data.data as YardDock[]).filter(
    (d) => d.serviceType === 'MULTIUSO' || visit.serviceType === 'MULTIUSO' || d.serviceType === visit.serviceType
  )
}
const closeMoveToDockModal = () => { showMoveToDockModal.value = false; movingVisit.value = null }

const handleConfirmMoveToDock = async () => {
  if (!movingVisit.value || !moveToDockId.value) return
  try {
    await yardVisitStore.moveToDock(movingVisit.value.id, moveToDockId.value)
    toast.success('Visita movida para a doca com sucesso!')
    closeMoveToDockModal()
    await loadVisits()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao mover para a doca')
  }
}

const handleStartLoading = async (visit: YardVisit) => {
  try {
    await yardVisitStore.startLoading(visit.id)
    toast.success('Carga/descarga iniciada!')
    await loadVisits()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao iniciar carga/descarga')
  }
}

const handleEndLoading = async (visit: YardVisit) => {
  try {
    await yardVisitStore.endLoading(visit.id)
    toast.success('Carga/descarga concluída!')
    await loadVisits()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao concluir carga/descarga')
  }
}

const handleComplete = async (visit: YardVisit) => {
  if (await confirmDialog('Confirma finalizar e liberar esta visita?')) {
    try {
      await yardVisitStore.completeVisit(visit.id)
      toast.success('Visita finalizada e doca liberada!')
      await loadVisits()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao finalizar visita')
    }
  }
}

const formatDuration = (start: string | null, end: string | null) => {
  if (!start || !end) return '-'
  const minutes = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000)
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return hours > 0 ? `${hours}h${remainingMinutes.toString().padStart(2, '0')}min` : `${remainingMinutes}min`
}
```

- [ ] **Step 6: Remover o card "Check-in/out" da aba "Pátio" do Dashboard**

Em `frontend/src/views/DashboardView.vue`, dentro do bloco `activeTab === 'yms'`, REMOVER o card estático "Check-in/out" (um dos 3 "Em breve" restantes):

```vue
            <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed dark:border-gray-700 dark:bg-gray-900">
              <div class="text-center">
                <div class="text-3xl mb-2">📋</div>
                <p class="text-sm font-medium text-gray-500">Check-in/out</p>
                <p class="text-xs text-gray-400 mt-1">Em breve</p>
              </div>
            </div>
```

Restam "Em breve": Tempo de Pátio, Relatórios YMS (Etapa 5).

- [ ] **Step 7: Rodar o teste e verificar que passa**

```bash
npx vitest run src/views/yard/__tests__/YardVisitListView.spec.ts
```

Esperado: 7/7 (5 das Etapas 2/3 + 2 novos).

- [ ] **Step 8: Rodar a suíte completa do frontend + type-check**

```bash
npx vitest run && npx vue-tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/services/yard-visit.service.ts frontend/src/stores/yard-visit.store.ts frontend/src/views/yard/YardVisitListView.vue frontend/src/views/yard/__tests__/YardVisitListView.spec.ts frontend/src/views/DashboardView.vue
git commit -m "feat(yms): adiciona operacao de doca ao frontend (mover, carga/descarga, checkout)"
```

---

### Task 4: Verificação end-to-end real

**Files:** nenhum (task de verificação, sem mudança de código).

**Interfaces:** nenhuma.

- [ ] **Step 1: Ambiente**

Confirme (peça aprovação explícita do usuário) os containers apontando para este worktree/branch.

- [ ] **Step 2: Migração + seed no banco real**

```bash
npx prisma migrate deploy
npm run prisma:seed
```

- [ ] **Step 3: Fluxo completo via UI real (login como admin)**

1. Confirme que o card "Check-in/out" sumiu da aba "Pátio".
2. `/yard/visits`: fazer check-in de uma visita num armazém com `useYard: false` — confirmar que "Mover para Doca" aparece diretamente (sem passar por "Alocar Vaga").
3. Mover pra uma doca do tipo de serviço compatível. Confirmar que a doca não aparece mais como opção pra outra visita (ocupada).
4. Clicar "Iniciar Carga/Descarga", depois "Concluir Carga/Descarga", depois "Finalizar e Liberar". Confirmar que a visita mostra "Concluída" com o tempo total calculado.
5. Confirmar que a doca volta a aparecer como disponível pra uma nova visita depois do checkout.
6. Repetir o fluxo com um armazém `useYard: true`: check-in → Alocar Vaga → Mover para Doca (a partir de `IN_YARD`) → checkout.
7. Tentar mover uma visita pra uma doca de tipo de serviço incompatível — confirmar o erro.

- [ ] **Step 4: RBAC e licenciamento negativos**

Mesmo roteiro das etapas anteriores.

- [ ] **Step 5: Relato final**

Sem commit neste task. Relate o resultado de cada step.

---

## Pós-plano: o que ainda fica pendente do YMS

Esta etapa fecha o ciclo operacional da visita. Falta só a Etapa 5 (Dashboard/KPIs consolidado) — ver `docs/superpowers/specs/2026-09-08-yms-operacao-doca-design.md`, seção 2.5.
