# Manutenção (Fase 4, subsistema 1 de 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Manutenção module end-to-end: cadastro de equipamentos vinculados a Centros de Trabalho, planos de manutenção preventiva por calendário com geração automática de ordens de serviço, ordens corretivas manuais, indicadores MTBF/MTTR, notificações de atraso, RBAC, licenciamento de módulo, e a interface completa (nova aba no Dashboard + 4 telas).

**Architecture:** Segue exatamente os padrões já estabelecidos no backend Express+Prisma (service/controller/routes/validator por recurso, RBAC via `requirePermission`, licenciamento via `requireModule`, jobs agendados via `node-cron` em arquivo próprio) e no frontend Vue3+Pinia (service/store/view por recurso, `DataTable.vue`+`AppModal.vue` para CRUD, mesmo padrão visual de `WorkCentersView.vue` e `WmsKpiDashboardView.vue`).

**Tech Stack:** Node.js + TypeScript + Express + Prisma + MySQL (backend), Vue 3 Composition API + Pinia + TailwindCSS + Chart.js (frontend), Jest (backend tests), Vitest (frontend tests).

## Global Constraints

- Manutenção é um **módulo licenciável por instalação** (como WMS/YMS/Compras), não sempre-ligado como o núcleo PCP — toda rota nova é montada com `requireModule('MANUTENCAO')` no ponto de mount (`routes/index.ts`), nunca rota a rota.
- RBAC: recurso `manutencao` com ações `visualizar` (leitura), `executar` (iniciar/concluir ordens, abrir corretiva), `gerenciar` (CRUD de equipamento/plano, cancelar/reatribuir ordem). Permissão de módulo `modules.view_manutencao`.
- Geração de ordem preventiva é **só por calendário** (`frequencyDays`), nunca por uso/horas de operação — não existe mecanismo de apontamento de uso de equipamento neste projeto e não deve ser criado nesta fase.
- Ordem corretiva **não interage** automaticamente com `ProductionOrder` — nenhuma pausa/alerta automático nesta fase.
- Todo cálculo de KPI (MTTR/MTBF) segue o padrão de delta de timestamp já usado em `wms-kpi.service.ts` — nunca retornar `0` quando não há dados suficientes (retornar `null`).
- Job agendado roda diariamente (`0 6 * * *`), mesmo horário do `lot-expiry.job.ts`, e verifica `isModuleEnabled('MANUTENCAO')` no início do `run()` — mesmo padrão desse arquivo, não o do `NotificationSchedulerService` do núcleo.
- Frontend não consulta licenciamento — o gate de UI é só a permissão RBAC (`modules.view_manutencao`), igual a WMS/YMS.
- Toda tela nova nasce com suporte a dark mode desde o primeiro commit (`dark:` classes já presentes), usando a receita documentada em `docs/superpowers/specs/2026-09-07-dark-mode-fase1-design.md` — não é um retrofit posterior.
- Migrations: gerar contra o banco de DEV (`.env`, não `.env.test`) via `npx prisma migrate dev --name <nome>` a partir do diretório `backend`. Depois de mesclar o novo model, sempre rodar `npx prisma generate` antes de qualquer outro comando (host e, se aplicável, dentro do container `fabric-backend`).

---

### Task 1: Schema Prisma + licenciamento de módulo + RBAC

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/services/licensed-module.service.ts`
- Modify: `backend/prisma/seed.ts`
- Create: `backend/prisma/migrations/<timestamp>_add_manutencao_models/migration.sql` (gerada pelo Prisma, não escrita à mão)

**Interfaces:**
- Produces: models `Equipment`, `MaintenancePlan`, `MaintenanceOrder` (+ enums `MaintenanceOrderType`, `MaintenanceOrderStatus`) disponíveis via `prisma.equipment`/`prisma.maintenancePlan`/`prisma.maintenanceOrder`; `WorkCenter.equipment` e `User.maintenanceOrders` como relações inversas; código de módulo `'MANUTENCAO'` reconhecido por `isModuleEnabled()`/`requireModule()`; permissões `manutencao:visualizar`/`manutencao:executar`/`manutencao:gerenciar` e `modules:view_manutencao` existentes no banco após `npm run prisma:seed`.

- [ ] **Step 1: Adicionar os models ao schema**

Em `backend/prisma/schema.prisma`, localize `model WorkCenter {` e adicione a relação inversa dentro dele (antes do `@@map`):

```prisma
  equipment Equipment[]
```

Localize `model User {` e adicione a relação inversa dentro dele (antes do `@@map`), próximo de outras relações inversas já existentes:

```prisma
  maintenanceOrders MaintenanceOrder[]
```

No final do arquivo, adicione os 3 models novos e os 2 enums:

```prisma
model Equipment {
  id           String   @id @default(uuid())
  code         String   @unique
  name         String
  workCenterId String
  manufacturer String?
  model        String?
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  workCenter WorkCenter         @relation(fields: [workCenterId], references: [id])
  plans      MaintenancePlan[]
  orders     MaintenanceOrder[]

  @@map("equipment")
}

model MaintenancePlan {
  id            String   @id @default(uuid())
  equipmentId   String
  name          String
  description   String?
  frequencyDays Int
  nextDueDate   DateTime
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  equipment Equipment          @relation(fields: [equipmentId], references: [id])
  orders    MaintenanceOrder[]

  @@map("maintenance_plans")
}

enum MaintenanceOrderType {
  PREVENTIVE
  CORRECTIVE
}

enum MaintenanceOrderStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model MaintenanceOrder {
  id                 String                 @id @default(uuid())
  equipmentId        String
  planId             String?
  type               MaintenanceOrderType
  status             MaintenanceOrderStatus @default(PENDING)
  problemDescription String?
  resolutionNotes    String?
  assignedTo         String?
  createdAt          DateTime               @default(now())
  startedAt          DateTime?
  completedAt        DateTime?

  equipment Equipment        @relation(fields: [equipmentId], references: [id])
  plan      MaintenancePlan? @relation(fields: [planId], references: [id])
  assignee  User?            @relation(fields: [assignedTo], references: [id])

  @@map("maintenance_orders")
}
```

- [ ] **Step 2: Gerar e aplicar a migration no banco de DEV**

Run (a partir de `backend/`): `npx prisma migrate dev --name add_manutencao_models`
Expected: cria a pasta `prisma/migrations/<timestamp>_add_manutencao_models/migration.sql` e aplica no banco de DEV local. Se o comando travar pedindo TTY (sandbox sem TTY), use o fallback já documentado no projeto: `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > /tmp/diff.sql` não se aplica aqui (schema já teria a mudança) — em vez disso, gere o diff ANTES de rodar `migrate dev` comparando o schema atual (sem os models) contra o schema com os models, coloque o SQL resultante manualmente em `prisma/migrations/<timestamp>_add_manutencao_models/migration.sql`, e aplique com `npx prisma migrate deploy`.

- [ ] **Step 3: Regenerar o Prisma Client**

Run: `npx prisma generate` (a partir de `backend/`)
Expected: sem erros; `prisma.equipment`, `prisma.maintenancePlan`, `prisma.maintenanceOrder` agora existem no client tipado.

- [ ] **Step 4: Registrar o módulo licenciável**

Em `backend/src/services/licensed-module.service.ts`, altere:

```typescript
export const MODULE_CODES = ['PCP', 'COMPRAS', 'WMS', 'YMS'] as const;
```

para:

```typescript
export const MODULE_CODES = ['PCP', 'COMPRAS', 'WMS', 'YMS', 'MANUTENCAO'] as const;
```

- [ ] **Step 5: Seed do módulo licenciado**

Em `backend/prisma/seed.ts`, localize o array `licensedModules` (dentro do bloco `console.log('🧩 Configurando módulos licenciados...')`) e adicione uma linha:

```typescript
  const licensedModules = [
    { code: 'PCP', enabled: true, core: true },
    { code: 'COMPRAS', enabled: true, core: false },
    { code: 'WMS', enabled: true, core: false },
    { code: 'YMS', enabled: false, core: false },
    { code: 'MANUTENCAO', enabled: true, core: false },
  ];
```

- [ ] **Step 6: Seed das permissões RBAC**

Em `backend/prisma/seed.ts`, localize o array `permissions` (começa em `const permissions = [`) e, logo após a linha `{ resource: 'assistente_ia', action: 'usar', ... }`, adicione:

```typescript
    // Manutenção (Fase 4)
    { resource: 'manutencao', action: 'visualizar', description: 'Visualizar equipamentos, planos e ordens de manutenção' },
    { resource: 'manutencao', action: 'executar', description: 'Iniciar/concluir ordens de manutenção e abrir corretivas' },
    { resource: 'manutencao', action: 'gerenciar', description: 'Gerenciar equipamentos, planos, cancelar/reatribuir ordens de manutenção' },
```

No bloco de permissões `modules` (linhas com `{ resource: 'modules', action: 'view_wms', ... }` etc.), adicione logo depois de `view_yms`:

```typescript
    { resource: 'modules', action: 'view_manutencao', description: 'Acessar módulo Manutenção' },
```

No objeto `managerPermissions` (`const managerPermissions: Record<string, string[]> = {`), adicione:

```typescript
    manutencao: ['visualizar', 'executar', 'gerenciar'],
```

e no array `modules` já existente dentro de `managerPermissions`, adicione `'view_manutencao'`:

```typescript
    modules: ['view_general', 'view_pcp', 'view_wms', 'view_yms', 'view_manutencao'],
```

No objeto `operatorPermissions` (mesma estrutura, mais abaixo no arquivo), adicione (sem `'gerenciar'` — operador executa, não gerencia cadastro):

```typescript
    manutencao: ['visualizar', 'executar'],
```

e adicione `'view_manutencao'` ao array `modules` já existente dentro de `operatorPermissions`:

```typescript
    modules: ['view_general', 'view_pcp', 'view_wms', 'view_yms', 'view_manutencao'],
```

(ADMIN recebe todas as permissões automaticamente via `allPermissions` — nenhuma mudança necessária para ADMIN.)

- [ ] **Step 7: Rodar o seed e verificar**

Run: `npm run prisma:seed` (a partir de `backend/`, contra o banco de DEV)
Expected: log final lista `MANUTENCAO=on` entre os módulos licenciados, e `MANAGER: N permissões atribuídas` / `OPERATOR: N permissões atribuídas` sem nenhum aviso `ignoradas (inexistentes)` mencionando `manutencao` ou `view_manutencao`.

- [ ] **Step 8: Rodar a suíte de integração para confirmar que nada quebrou**

Run: `cd backend && npm run test:integration`
Expected: mesma contagem de testes da baseline atual, todos passando (este task não adiciona nenhum teste novo — é só schema/seed/config; os testes de comportamento vêm nos próximos tasks).

- [ ] **Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/services/licensed-module.service.ts backend/prisma/seed.ts
git commit -m "feat(manutencao): adiciona schema, licenciamento de modulo e RBAC

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — CRUD de Equipment

**Files:**
- Create: `backend/src/validators/equipment.validator.ts`
- Create: `backend/src/services/equipment.service.ts`
- Create: `backend/src/controllers/equipment.controller.ts`
- Create: `backend/src/routes/equipment.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/equipment.service.test.ts`

**Interfaces:**
- Consumes: `manutencao` RBAC resource e módulo `MANUTENCAO` (Task 1).
- Produces: `equipmentService` com `create(dto)`, `getAll(page, limit, filters)`, `getById(id)`, `update(id, dto)`, `delete(id)`, `toggleActive(id)` — consumido por `maintenance-plan.service.ts` (Task 3) e `maintenance-order.service.ts` (Task 4) para validar `equipmentId`. Rotas montadas em `/equipment`.

- [ ] **Step 1: Validator**

Create `backend/src/validators/equipment.validator.ts`:

```typescript
import Joi from 'joi';

export const createEquipmentSchema = Joi.object({
  code: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Código é obrigatório',
    'any.required': 'Código é obrigatório',
  }),
  name: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Nome é obrigatório',
    'any.required': 'Nome é obrigatório',
  }),
  workCenterId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do centro de trabalho inválido',
    'any.required': 'Centro de trabalho é obrigatório',
  }),
  manufacturer: Joi.string().trim().allow('', null),
  model: Joi.string().trim().allow('', null),
  active: Joi.boolean().default(true),
});

export const updateEquipmentSchema = Joi.object({
  code: Joi.string().trim().min(1),
  name: Joi.string().trim().min(1),
  workCenterId: Joi.string().uuid().messages({
    'string.guid': 'ID do centro de trabalho inválido',
  }),
  manufacturer: Joi.string().trim().allow('', null),
  model: Joi.string().trim().allow('', null),
  active: Joi.boolean(),
}).min(1);

export const listEquipmentQuerySchema = Joi.object({
  workCenterId: Joi.string().uuid(),
  active: Joi.boolean(),
  search: Joi.string(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
```

- [ ] **Step 2: Service**

Create `backend/src/services/equipment.service.ts`:

```typescript
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateEquipmentDto {
  code: string;
  name: string;
  workCenterId: string;
  manufacturer?: string | null;
  model?: string | null;
  active?: boolean;
}

export interface UpdateEquipmentDto extends Partial<CreateEquipmentDto> {}

export interface EquipmentFilters {
  workCenterId?: string;
  active?: boolean;
  search?: string;
}

const assertWorkCenterExists = async (workCenterId: string) => {
  const workCenter = await prisma.workCenter.findUnique({ where: { id: workCenterId } });
  if (!workCenter) {
    throw new AppError(400, 'Centro de trabalho informado não existe');
  }
};

export class EquipmentService {
  async create(data: CreateEquipmentDto) {
    await assertWorkCenterExists(data.workCenterId);
    return prisma.equipment.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: EquipmentFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.workCenterId) where.workCenterId = filters.workCenterId;
    if (filters?.active !== undefined) where.active = filters.active;
    if (filters?.search) {
      where.OR = [
        { code: { contains: filters.search } },
        { name: { contains: filters.search } },
      ];
    }

    const [equipment, total] = await Promise.all([
      prisma.equipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { workCenter: { select: { id: true, code: true, name: true } } },
      }),
      prisma.equipment.count({ where }),
    ]);

    return { data: equipment, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.equipment.findUnique({
      where: { id },
      include: { workCenter: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, data: UpdateEquipmentDto) {
    if (data.workCenterId) {
      await assertWorkCenterExists(data.workCenterId);
    }
    return prisma.equipment.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.equipment.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const equipment = await this.getById(id);
    if (!equipment) throw new AppError(404, 'Equipamento não encontrado');
    return this.update(id, { active: !equipment.active });
  }
}

export default new EquipmentService();
```

- [ ] **Step 3: Controller**

Create `backend/src/controllers/equipment.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import equipmentService from '../services/equipment.service';

export class EquipmentController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const equipment = await equipmentService.create(req.body);
      res.status(201).json({ status: 'success', data: equipment });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        workCenterId: req.query.workCenterId as string,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
        search: req.query.search as string,
      };
      const result = await equipmentService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const equipment = await equipmentService.getById(req.params.id);
      if (!equipment) {
        return res.status(404).json({ status: 'error', message: 'Equipamento não encontrado' });
      }
      res.status(200).json({ status: 'success', data: equipment });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const equipment = await equipmentService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: equipment });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await equipmentService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const equipment = await equipmentService.toggleActive(req.params.id);
      res.status(200).json({ status: 'success', data: equipment });
    } catch (error) {
      next(error);
    }
  }
}

export default new EquipmentController();
```

- [ ] **Step 4: Routes**

Create `backend/src/routes/equipment.routes.ts`:

```typescript
import { Router } from 'express';
import equipmentController from '../controllers/equipment.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createEquipmentSchema,
  listEquipmentQuerySchema,
  updateEquipmentSchema,
} from '../validators/equipment.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('manutencao', 'visualizar'),
  validateQuery(listEquipmentQuerySchema),
  equipmentController.getAll
);
router.get('/:id', requirePermission('manutencao', 'visualizar'), equipmentController.getById);
router.post(
  '/',
  requirePermission('manutencao', 'gerenciar'),
  validate(createEquipmentSchema),
  equipmentController.create
);
router.put(
  '/:id',
  requirePermission('manutencao', 'gerenciar'),
  validate(updateEquipmentSchema),
  equipmentController.update
);
router.delete('/:id', requirePermission('manutencao', 'gerenciar'), equipmentController.delete);
router.patch(
  '/:id/toggle-active',
  requirePermission('manutencao', 'gerenciar'),
  equipmentController.toggleActive
);

export default router;
```

- [ ] **Step 5: Montar a rota sob `requireModule('MANUTENCAO')`**

Em `backend/src/routes/index.ts`, adicione o import junto aos outros imports de rotas:

```typescript
import equipmentRoutes from './equipment.routes';
```

E adicione, num bloco novo comentado (mesmo estilo do bloco `// MÓDULO WMS (licenciável por instalação)` já existente), próximo aos outros módulos licenciáveis:

```typescript
// MÓDULO MANUTENÇÃO (licenciável por instalação)
router.use('/equipment', requireModule('MANUTENCAO'), equipmentRoutes);
```

- [ ] **Step 6: Escrever os testes**

Create `backend/tests/services/equipment.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestWorkCenter } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';

describe('EquipmentService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria um equipamento vinculado a um centro de trabalho existente', async () => {
    const workCenter = await createTestWorkCenter();

    const equipment = await equipmentService.create({
      code: 'EQP-001',
      name: 'Torno CNC 1',
      workCenterId: workCenter.id,
      manufacturer: 'Romi',
    });

    expect(equipment.code).toBe('EQP-001');
    expect(equipment.workCenterId).toBe(workCenter.id);
    expect(equipment.active).toBe(true);
  });

  it('rejeita criar equipamento com workCenterId inexistente', async () => {
    await expect(
      equipmentService.create({
        code: 'EQP-002',
        name: 'Torno CNC 2',
        workCenterId: 'id-que-nao-existe',
      })
    ).rejects.toThrow('Centro de trabalho informado não existe');
  });

  it('lista equipamentos filtrando por centro de trabalho', async () => {
    const wc1 = await createTestWorkCenter();
    const wc2 = await createTestWorkCenter();
    await equipmentService.create({ code: 'EQP-A', name: 'A', workCenterId: wc1.id });
    await equipmentService.create({ code: 'EQP-B', name: 'B', workCenterId: wc2.id });

    const result = await equipmentService.getAll(1, 100, { workCenterId: wc1.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].code).toBe('EQP-A');
  });

  it('toggleActive inverte o campo active', async () => {
    const workCenter = await createTestWorkCenter();
    const equipment = await equipmentService.create({
      code: 'EQP-003',
      name: 'Prensa 1',
      workCenterId: workCenter.id,
    });

    const toggled = await equipmentService.toggleActive(equipment.id);
    expect(toggled.active).toBe(false);
  });

  it('rejeita atualizar para um workCenterId inexistente', async () => {
    const workCenter = await createTestWorkCenter();
    const equipment = await equipmentService.create({
      code: 'EQP-004',
      name: 'Prensa 2',
      workCenterId: workCenter.id,
    });

    await expect(
      equipmentService.update(equipment.id, { workCenterId: 'id-invalido' })
    ).rejects.toThrow('Centro de trabalho informado não existe');
  });
});
```

- [ ] **Step 7: Rodar os testes**

Run: `cd backend && npm run test:integration -- equipment.service.test.ts`
Expected: 5/5 passando.

- [ ] **Step 8: Rodar a suíte completa para confirmar não-regressão**

Run: `cd backend && npm run test:integration`
Expected: baseline + 5 (só os testes novos deste task).

- [ ] **Step 9: Commit**

```bash
git add backend/src/validators/equipment.validator.ts backend/src/services/equipment.service.ts backend/src/controllers/equipment.controller.ts backend/src/routes/equipment.routes.ts backend/src/routes/index.ts backend/tests/services/equipment.service.test.ts
git commit -m "feat(manutencao): adiciona CRUD de Equipment

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Backend — CRUD de MaintenancePlan

**Files:**
- Create: `backend/src/validators/maintenance-plan.validator.ts`
- Create: `backend/src/services/maintenance-plan.service.ts`
- Create: `backend/src/controllers/maintenance-plan.controller.ts`
- Create: `backend/src/routes/maintenance-plan.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/maintenance-plan.service.test.ts`

**Interfaces:**
- Consumes: `equipmentService` (Task 2, para validar `equipmentId`); `manutencao` RBAC; módulo `MANUTENCAO`.
- Produces: `maintenancePlanService` com `create(dto)`, `getAll(page, limit, filters)`, `getById(id)`, `update(id, dto)`, `delete(id)`, `toggleActive(id)`. `MaintenancePlan.nextDueDate` — consumido pelo job da Task 5 (`maintenance.job.ts`) via `prisma.maintenancePlan.findMany({ where: { active: true, nextDueDate: { lte: now } } })`. Rotas montadas em `/maintenance-plans`.

- [ ] **Step 1: Validator**

Create `backend/src/validators/maintenance-plan.validator.ts`:

```typescript
import Joi from 'joi';

export const createMaintenancePlanSchema = Joi.object({
  equipmentId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do equipamento inválido',
    'any.required': 'Equipamento é obrigatório',
  }),
  name: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Nome é obrigatório',
    'any.required': 'Nome é obrigatório',
  }),
  description: Joi.string().trim().allow('', null),
  frequencyDays: Joi.number().integer().greater(0).required().messages({
    'number.greater': 'Frequência deve ser maior que zero dias',
    'any.required': 'Frequência é obrigatória',
  }),
  // Opcional: se ausente, o service calcula now() + frequencyDays.
  nextDueDate: Joi.date().iso(),
  active: Joi.boolean().default(true),
});

export const updateMaintenancePlanSchema = Joi.object({
  equipmentId: Joi.string().uuid().messages({
    'string.guid': 'ID do equipamento inválido',
  }),
  name: Joi.string().trim().min(1),
  description: Joi.string().trim().allow('', null),
  frequencyDays: Joi.number().integer().greater(0).messages({
    'number.greater': 'Frequência deve ser maior que zero dias',
  }),
  nextDueDate: Joi.date().iso(),
  active: Joi.boolean(),
}).min(1);

export const listMaintenancePlanQuerySchema = Joi.object({
  equipmentId: Joi.string().uuid(),
  active: Joi.boolean(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
```

- [ ] **Step 2: Service**

Create `backend/src/services/maintenance-plan.service.ts`:

```typescript
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CreateMaintenancePlanDto {
  equipmentId: string;
  name: string;
  description?: string | null;
  frequencyDays: number;
  nextDueDate?: Date | string;
  active?: boolean;
}

export interface UpdateMaintenancePlanDto extends Partial<CreateMaintenancePlanDto> {}

export interface MaintenancePlanFilters {
  equipmentId?: string;
  active?: boolean;
}

const assertEquipmentExists = async (equipmentId: string) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) {
    throw new AppError(400, 'Equipamento informado não existe');
  }
};

export class MaintenancePlanService {
  async create(data: CreateMaintenancePlanDto) {
    await assertEquipmentExists(data.equipmentId);

    // `nextDueDate` explícito (ex.: primeira execução agendada para uma data
    // futura específica) tem prioridade; na ausência, o plano já nasce
    // vencendo em `frequencyDays` a partir de agora.
    const nextDueDate = data.nextDueDate
      ? new Date(data.nextDueDate)
      : new Date(Date.now() + data.frequencyDays * MS_PER_DAY);

    return prisma.maintenancePlan.create({
      data: {
        equipmentId: data.equipmentId,
        name: data.name,
        description: data.description ?? null,
        frequencyDays: data.frequencyDays,
        nextDueDate,
        active: data.active ?? true,
      },
    });
  }

  async getAll(page = 1, limit = 100, filters?: MaintenancePlanFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.equipmentId) where.equipmentId = filters.equipmentId;
    if (filters?.active !== undefined) where.active = filters.active;

    const [plans, total] = await Promise.all([
      prisma.maintenancePlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nextDueDate: 'asc' },
        include: { equipment: { select: { id: true, code: true, name: true } } },
      }),
      prisma.maintenancePlan.count({ where }),
    ]);

    return { data: plans, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.maintenancePlan.findUnique({
      where: { id },
      include: { equipment: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, data: UpdateMaintenancePlanDto) {
    if (data.equipmentId) {
      await assertEquipmentExists(data.equipmentId);
    }
    const { nextDueDate, ...rest } = data;
    return prisma.maintenancePlan.update({
      where: { id },
      data: { ...rest, ...(nextDueDate ? { nextDueDate: new Date(nextDueDate) } : {}) },
    });
  }

  async delete(id: string) {
    return prisma.maintenancePlan.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const plan = await this.getById(id);
    if (!plan) throw new AppError(404, 'Plano de manutenção não encontrado');
    return this.update(id, { active: !plan.active });
  }
}

export default new MaintenancePlanService();
```

- [ ] **Step 3: Controller**

Create `backend/src/controllers/maintenance-plan.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import maintenancePlanService from '../services/maintenance-plan.service';

export class MaintenancePlanController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await maintenancePlanService.create(req.body);
      res.status(201).json({ status: 'success', data: plan });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        equipmentId: req.query.equipmentId as string,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
      };
      const result = await maintenancePlanService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await maintenancePlanService.getById(req.params.id);
      if (!plan) {
        return res.status(404).json({ status: 'error', message: 'Plano de manutenção não encontrado' });
      }
      res.status(200).json({ status: 'success', data: plan });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await maintenancePlanService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: plan });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await maintenancePlanService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async toggleActive(req: Request, res: Response, next: NextFunction) {
    try {
      const plan = await maintenancePlanService.toggleActive(req.params.id);
      res.status(200).json({ status: 'success', data: plan });
    } catch (error) {
      next(error);
    }
  }
}

export default new MaintenancePlanController();
```

- [ ] **Step 4: Routes**

Create `backend/src/routes/maintenance-plan.routes.ts`:

```typescript
import { Router } from 'express';
import maintenancePlanController from '../controllers/maintenance-plan.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createMaintenancePlanSchema,
  listMaintenancePlanQuerySchema,
  updateMaintenancePlanSchema,
} from '../validators/maintenance-plan.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('manutencao', 'visualizar'),
  validateQuery(listMaintenancePlanQuerySchema),
  maintenancePlanController.getAll
);
router.get('/:id', requirePermission('manutencao', 'visualizar'), maintenancePlanController.getById);
router.post(
  '/',
  requirePermission('manutencao', 'gerenciar'),
  validate(createMaintenancePlanSchema),
  maintenancePlanController.create
);
router.put(
  '/:id',
  requirePermission('manutencao', 'gerenciar'),
  validate(updateMaintenancePlanSchema),
  maintenancePlanController.update
);
router.delete('/:id', requirePermission('manutencao', 'gerenciar'), maintenancePlanController.delete);
router.patch(
  '/:id/toggle-active',
  requirePermission('manutencao', 'gerenciar'),
  maintenancePlanController.toggleActive
);

export default router;
```

- [ ] **Step 5: Montar a rota**

Em `backend/src/routes/index.ts`, adicione o import:

```typescript
import maintenancePlanRoutes from './maintenance-plan.routes';
```

E, logo abaixo da linha `router.use('/equipment', requireModule('MANUTENCAO'), equipmentRoutes);` adicionada no Task 2:

```typescript
router.use('/maintenance-plans', requireModule('MANUTENCAO'), maintenancePlanRoutes);
```

- [ ] **Step 6: Escrever os testes**

Create `backend/tests/services/maintenance-plan.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestWorkCenter } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';
import maintenancePlanService from '../../src/services/maintenance-plan.service';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('MaintenancePlanService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const createEquipment = async () => {
    const workCenter = await createTestWorkCenter();
    return equipmentService.create({ code: 'EQP-PLAN', name: 'Equipamento Teste', workCenterId: workCenter.id });
  };

  it('calcula nextDueDate como agora + frequencyDays quando não informado', async () => {
    const equipment = await createEquipment();
    const before = Date.now();

    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Troca de óleo',
      frequencyDays: 30,
    });

    const expectedMin = before + 30 * DAY - HOUR; // folga de 1h para o tempo de execução do teste
    const expectedMax = before + 30 * DAY + HOUR;
    expect(plan.nextDueDate.getTime()).toBeGreaterThan(expectedMin);
    expect(plan.nextDueDate.getTime()).toBeLessThan(expectedMax);
  });

  it('usa nextDueDate explícito quando informado', async () => {
    const equipment = await createEquipment();
    const explicitDate = new Date(Date.now() + 5 * DAY);

    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Calibração',
      frequencyDays: 90,
      nextDueDate: explicitDate,
    });

    expect(plan.nextDueDate.getTime()).toBe(explicitDate.getTime());
  });

  it('rejeita criar plano com equipmentId inexistente', async () => {
    await expect(
      maintenancePlanService.create({
        equipmentId: 'id-inexistente',
        name: 'Plano X',
        frequencyDays: 15,
      })
    ).rejects.toThrow('Equipamento informado não existe');
  });

  it('lista planos ordenados por nextDueDate ascendente', async () => {
    const equipment = await createEquipment();
    await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano distante',
      frequencyDays: 90,
    });
    await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano próximo',
      frequencyDays: 5,
    });

    const result = await maintenancePlanService.getAll();

    expect(result.data[0].name).toBe('Plano próximo');
    expect(result.data[1].name).toBe('Plano distante');
  });

  it('toggleActive inverte o campo active', async () => {
    const equipment = await createEquipment();
    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano Y',
      frequencyDays: 30,
    });

    const toggled = await maintenancePlanService.toggleActive(plan.id);
    expect(toggled.active).toBe(false);
  });
});
```

- [ ] **Step 7: Rodar os testes**

Run: `cd backend && npm run test:integration -- maintenance-plan.service.test.ts`
Expected: 5/5 passando.

- [ ] **Step 8: Rodar a suíte completa**

Run: `cd backend && npm run test:integration`
Expected: baseline (após Task 2) + 5.

- [ ] **Step 9: Commit**

```bash
git add backend/src/validators/maintenance-plan.validator.ts backend/src/services/maintenance-plan.service.ts backend/src/controllers/maintenance-plan.controller.ts backend/src/routes/maintenance-plan.routes.ts backend/src/routes/index.ts backend/tests/services/maintenance-plan.service.test.ts
git commit -m "feat(manutencao): adiciona CRUD de MaintenancePlan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Backend — MaintenanceOrder (ciclo de vida corretiva/preventiva)

**Files:**
- Create: `backend/src/validators/maintenance-order.validator.ts`
- Create: `backend/src/services/maintenance-order.service.ts`
- Create: `backend/src/controllers/maintenance-order.controller.ts`
- Create: `backend/src/routes/maintenance-order.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/maintenance-order.service.test.ts`

**Interfaces:**
- Consumes: `equipmentService`/`prisma.equipment` (Task 2), `prisma.maintenancePlan` (Task 3).
- Produces: `maintenanceOrderService` com `createCorrective(dto)` (exposto via API), `createPreventiveFromPlan(planId)` (função interna, **não exposta por rota HTTP** — só a Task 5, o job, a chama diretamente), `start(id)`, `complete(id, resolutionNotes)`, `cancel(id, reason?)`, `updateAssignee(id, assignedTo)`, `getAll(page, limit, filters)`, `getById(id)`. Consumido por `maintenance.job.ts` (Task 5, via `createPreventiveFromPlan`) e por `maintenance-kpi.service.ts` (Task 6, via `prisma.maintenanceOrder` diretamente para os cálculos de MTTR/MTBF).

- [ ] **Step 1: Validator**

Create `backend/src/validators/maintenance-order.validator.ts`:

```typescript
import Joi from 'joi';

// Só corretiva é criável via API — preventiva só nasce do job (Task 5).
export const createMaintenanceOrderSchema = Joi.object({
  equipmentId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do equipamento inválido',
    'any.required': 'Equipamento é obrigatório',
  }),
  problemDescription: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Descrição do problema é obrigatória',
    'any.required': 'Descrição do problema é obrigatória',
  }),
  assignedTo: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do responsável inválido',
  }),
});

export const completeMaintenanceOrderSchema = Joi.object({
  resolutionNotes: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Descreva a solução aplicada',
    'any.required': 'Descreva a solução aplicada',
  }),
});

export const cancelMaintenanceOrderSchema = Joi.object({
  reason: Joi.string().trim().allow('', null),
});

export const updateMaintenanceOrderSchema = Joi.object({
  assignedTo: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do responsável inválido',
  }),
}).min(1);

export const listMaintenanceOrderQuerySchema = Joi.object({
  equipmentId: Joi.string().uuid(),
  type: Joi.string().valid('PREVENTIVE', 'CORRECTIVE'),
  status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
```

- [ ] **Step 2: Service**

Create `backend/src/services/maintenance-order.service.ts`:

```typescript
import { MaintenanceOrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateCorrectiveOrderDto {
  equipmentId: string;
  problemDescription: string;
  assignedTo?: string | null;
}

export interface MaintenanceOrderFilters {
  equipmentId?: string;
  type?: 'PREVENTIVE' | 'CORRECTIVE';
  status?: MaintenanceOrderStatus;
}

const orderInclude = {
  equipment: { select: { id: true, code: true, name: true } },
  plan: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, email: true } },
} as const;

const assertEquipmentExists = async (equipmentId: string) => {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!equipment) {
    throw new AppError(400, 'Equipamento informado não existe');
  }
};

export class MaintenanceOrderService {
  async createCorrective(data: CreateCorrectiveOrderDto) {
    await assertEquipmentExists(data.equipmentId);

    return prisma.maintenanceOrder.create({
      data: {
        equipmentId: data.equipmentId,
        type: 'CORRECTIVE',
        status: 'PENDING',
        problemDescription: data.problemDescription,
        assignedTo: data.assignedTo ?? null,
      },
      include: orderInclude,
    });
  }

  /**
   * Chamada só pelo job de manutenção (Task 5) — nunca por uma rota HTTP.
   * `planId` sempre preenchido, `type` sempre PREVENTIVE.
   */
  async createPreventiveFromPlan(planId: string) {
    const plan = await prisma.maintenancePlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new AppError(404, 'Plano de manutenção não encontrado');
    }

    return prisma.maintenanceOrder.create({
      data: {
        equipmentId: plan.equipmentId,
        planId: plan.id,
        type: 'PREVENTIVE',
        status: 'PENDING',
      },
      include: orderInclude,
    });
  }

  /** Existe uma ordem PENDING/IN_PROGRESS ainda aberta para este plano? */
  async hasOpenOrderForPlan(planId: string): Promise<boolean> {
    const count = await prisma.maintenanceOrder.count({
      where: { planId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    return count > 0;
  }

  async getAll(page = 1, limit = 100, filters?: MaintenanceOrderFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.equipmentId) where.equipmentId = filters.equipmentId;
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;

    const [orders, total] = await Promise.all([
      prisma.maintenanceOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: orderInclude,
      }),
      prisma.maintenanceOrder.count({ where }),
    ]);

    return { data: orders, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.maintenanceOrder.findUnique({ where: { id }, include: orderInclude });
  }

  private async getOrThrow(id: string) {
    const order = await prisma.maintenanceOrder.findUnique({ where: { id } });
    if (!order) throw new AppError(404, 'Ordem de manutenção não encontrada');
    return order;
  }

  async start(id: string) {
    const order = await this.getOrThrow(id);
    if (order.status !== 'PENDING') {
      throw new AppError(400, `Ordem não está pendente (status atual: ${order.status})`);
    }
    return prisma.maintenanceOrder.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
      include: orderInclude,
    });
  }

  async complete(id: string, resolutionNotes: string) {
    const order = await this.getOrThrow(id);
    if (order.status !== 'IN_PROGRESS') {
      throw new AppError(400, `Ordem não está em execução (status atual: ${order.status})`);
    }
    return prisma.maintenanceOrder.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date(), resolutionNotes },
      include: orderInclude,
    });
  }

  async cancel(id: string, reason?: string | null) {
    const order = await this.getOrThrow(id);
    if (order.status !== 'PENDING' && order.status !== 'IN_PROGRESS') {
      throw new AppError(400, `Ordem não pode ser cancelada (status atual: ${order.status})`);
    }
    return prisma.maintenanceOrder.update({
      where: { id },
      data: { status: 'CANCELLED', resolutionNotes: reason ?? undefined },
      include: orderInclude,
    });
  }

  async updateAssignee(id: string, assignedTo: string | null) {
    await this.getOrThrow(id);
    return prisma.maintenanceOrder.update({
      where: { id },
      data: { assignedTo },
      include: orderInclude,
    });
  }
}

export default new MaintenanceOrderService();
```

- [ ] **Step 3: Controller**

Create `backend/src/controllers/maintenance-order.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import maintenanceOrderService from '../services/maintenance-order.service';

export class MaintenanceOrderController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.createCorrective(req.body);
      res.status(201).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        equipmentId: req.query.equipmentId as string,
        type: req.query.type as 'PREVENTIVE' | 'CORRECTIVE' | undefined,
        status: req.query.status as any,
      };
      const result = await maintenanceOrderService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.getById(req.params.id);
      if (!order) {
        return res.status(404).json({ status: 'error', message: 'Ordem de manutenção não encontrada' });
      }
      res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }

  async start(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.start(req.params.id);
      res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.complete(req.params.id, req.body.resolutionNotes);
      res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.cancel(req.params.id, req.body.reason);
      res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await maintenanceOrderService.updateAssignee(req.params.id, req.body.assignedTo ?? null);
      res.status(200).json({ status: 'success', data: order });
    } catch (error) {
      next(error);
    }
  }
}

export default new MaintenanceOrderController();
```

- [ ] **Step 4: Routes**

Create `backend/src/routes/maintenance-order.routes.ts`:

```typescript
import { Router } from 'express';
import maintenanceOrderController from '../controllers/maintenance-order.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  cancelMaintenanceOrderSchema,
  completeMaintenanceOrderSchema,
  createMaintenanceOrderSchema,
  listMaintenanceOrderQuerySchema,
  updateMaintenanceOrderSchema,
} from '../validators/maintenance-order.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('manutencao', 'visualizar'),
  validateQuery(listMaintenanceOrderQuerySchema),
  maintenanceOrderController.getAll
);
router.get('/:id', requirePermission('manutencao', 'visualizar'), maintenanceOrderController.getById);
router.post(
  '/',
  requirePermission('manutencao', 'gerenciar'),
  validate(createMaintenanceOrderSchema),
  maintenanceOrderController.create
);
router.put(
  '/:id',
  requirePermission('manutencao', 'gerenciar'),
  validate(updateMaintenanceOrderSchema),
  maintenanceOrderController.update
);
router.patch('/:id/start', requirePermission('manutencao', 'executar'), maintenanceOrderController.start);
router.patch(
  '/:id/complete',
  requirePermission('manutencao', 'executar'),
  validate(completeMaintenanceOrderSchema),
  maintenanceOrderController.complete
);
router.patch(
  '/:id/cancel',
  requirePermission('manutencao', 'gerenciar'),
  validate(cancelMaintenanceOrderSchema),
  maintenanceOrderController.cancel
);

export default router;
```

- [ ] **Step 5: Montar a rota**

Em `backend/src/routes/index.ts`, adicione o import:

```typescript
import maintenanceOrderRoutes from './maintenance-order.routes';
```

E, logo abaixo da linha de `maintenance-plans` adicionada no Task 3:

```typescript
router.use('/maintenance-orders', requireModule('MANUTENCAO'), maintenanceOrderRoutes);
```

- [ ] **Step 6: Escrever os testes**

Create `backend/tests/services/maintenance-order.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestWorkCenter, createTestUser } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';
import maintenancePlanService from '../../src/services/maintenance-plan.service';
import maintenanceOrderService from '../../src/services/maintenance-order.service';

describe('MaintenanceOrderService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const createEquipment = async () => {
    const workCenter = await createTestWorkCenter();
    return equipmentService.create({ code: 'EQP-ORD', name: 'Equipamento Teste', workCenterId: workCenter.id });
  };

  describe('createCorrective', () => {
    it('cria uma ordem corretiva PENDING, sem planId', async () => {
      const equipment = await createEquipment();

      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'Ruído anormal no motor',
      });

      expect(order.type).toBe('CORRECTIVE');
      expect(order.status).toBe('PENDING');
      expect(order.planId).toBeNull();
    });

    it('rejeita criar corretiva com equipmentId inexistente', async () => {
      await expect(
        maintenanceOrderService.createCorrective({
          equipmentId: 'id-inexistente',
          problemDescription: 'X',
        })
      ).rejects.toThrow('Equipamento informado não existe');
    });
  });

  describe('createPreventiveFromPlan', () => {
    it('cria uma ordem preventiva PENDING vinculada ao plano', async () => {
      const equipment = await createEquipment();
      const plan = await maintenancePlanService.create({
        equipmentId: equipment.id,
        name: 'Lubrificação',
        frequencyDays: 30,
      });

      const order = await maintenanceOrderService.createPreventiveFromPlan(plan.id);

      expect(order.type).toBe('PREVENTIVE');
      expect(order.status).toBe('PENDING');
      expect(order.planId).toBe(plan.id);
      expect(order.equipmentId).toBe(equipment.id);
    });
  });

  describe('hasOpenOrderForPlan', () => {
    it('retorna true com ordem PENDING/IN_PROGRESS aberta, false após concluída', async () => {
      const equipment = await createEquipment();
      const plan = await maintenancePlanService.create({
        equipmentId: equipment.id,
        name: 'Inspeção',
        frequencyDays: 15,
      });
      const order = await maintenanceOrderService.createPreventiveFromPlan(plan.id);

      expect(await maintenanceOrderService.hasOpenOrderForPlan(plan.id)).toBe(true);

      await maintenanceOrderService.start(order.id);
      expect(await maintenanceOrderService.hasOpenOrderForPlan(plan.id)).toBe(true);

      await maintenanceOrderService.complete(order.id, 'Feito');
      expect(await maintenanceOrderService.hasOpenOrderForPlan(plan.id)).toBe(false);
    });
  });

  describe('transições de status', () => {
    it('start: PENDING -> IN_PROGRESS com startedAt preenchido', async () => {
      const equipment = await createEquipment();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'Vazamento',
      });

      const started = await maintenanceOrderService.start(order.id);

      expect(started.status).toBe('IN_PROGRESS');
      expect(started.startedAt).not.toBeNull();
    });

    it('rejeita start de uma ordem que não está PENDING', async () => {
      const equipment = await createEquipment();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'X',
      });
      await maintenanceOrderService.start(order.id);

      await expect(maintenanceOrderService.start(order.id)).rejects.toThrow('Ordem não está pendente');
    });

    it('complete: IN_PROGRESS -> COMPLETED com completedAt e resolutionNotes', async () => {
      const equipment = await createEquipment();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'Correia partida',
      });
      await maintenanceOrderService.start(order.id);

      const completed = await maintenanceOrderService.complete(order.id, 'Correia trocada');

      expect(completed.status).toBe('COMPLETED');
      expect(completed.completedAt).not.toBeNull();
      expect(completed.resolutionNotes).toBe('Correia trocada');
    });

    it('rejeita complete de uma ordem PENDING (precisa estar IN_PROGRESS)', async () => {
      const equipment = await createEquipment();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'X',
      });

      await expect(maintenanceOrderService.complete(order.id, 'Y')).rejects.toThrow(
        'Ordem não está em execução'
      );
    });

    it('cancel: permitido a partir de PENDING e de IN_PROGRESS', async () => {
      const equipment = await createEquipment();
      const orderA = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'A',
      });
      const cancelledA = await maintenanceOrderService.cancel(orderA.id, 'Falso alarme');
      expect(cancelledA.status).toBe('CANCELLED');

      const orderB = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'B',
      });
      await maintenanceOrderService.start(orderB.id);
      const cancelledB = await maintenanceOrderService.cancel(orderB.id);
      expect(cancelledB.status).toBe('CANCELLED');
    });

    it('rejeita cancel de uma ordem já COMPLETED', async () => {
      const equipment = await createEquipment();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'X',
      });
      await maintenanceOrderService.start(order.id);
      await maintenanceOrderService.complete(order.id, 'Feito');

      await expect(maintenanceOrderService.cancel(order.id)).rejects.toThrow(
        'Ordem não pode ser cancelada'
      );
    });
  });

  describe('updateAssignee', () => {
    it('atribui e depois desatribui (null) sem exigir transição de status', async () => {
      const equipment = await createEquipment();
      const user = await createTestUser();
      const order = await maintenanceOrderService.createCorrective({
        equipmentId: equipment.id,
        problemDescription: 'X',
      });

      const assigned = await maintenanceOrderService.updateAssignee(order.id, user.id);
      expect(assigned.assignedTo).toBe(user.id);
      expect(assigned.status).toBe('PENDING'); // status não muda

      const unassigned = await maintenanceOrderService.updateAssignee(order.id, null);
      expect(unassigned.assignedTo).toBeNull();
    });
  });
});
```

- [ ] **Step 7: Rodar os testes**

Run: `cd backend && npm run test:integration -- maintenance-order.service.test.ts`
Expected: 12/12 passando.

- [ ] **Step 8: Rodar a suíte completa**

Run: `cd backend && npm run test:integration`
Expected: baseline (após Task 3) + 12.

- [ ] **Step 9: Commit**

```bash
git add backend/src/validators/maintenance-order.validator.ts backend/src/services/maintenance-order.service.ts backend/src/controllers/maintenance-order.controller.ts backend/src/routes/maintenance-order.routes.ts backend/src/routes/index.ts backend/tests/services/maintenance-order.service.test.ts
git commit -m "feat(manutencao): adiciona MaintenanceOrder (corretiva/preventiva, ciclo de vida)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Job agendado — geração de preventivas + notificação de atraso

**Files:**
- Modify: `backend/src/services/system-setting.service.ts`
- Modify: `backend/prisma/seed.ts`
- Modify: `backend/src/services/notification-detector.service.ts`
- Create: `backend/src/jobs/maintenance.job.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/tests/jobs/maintenance.job.test.ts`
- Test: extensão em `backend/tests/services/notification-detector.service.test.ts` (se o arquivo não existir com este nome exato, verifique `backend/tests/services/` por um arquivo de teste do detector já existente e adicione lá — não crie um segundo arquivo de teste para o mesmo service)

**Interfaces:**
- Consumes: `maintenanceOrderService.createPreventiveFromPlan`/`hasOpenOrderForPlan` (Task 4), `isModuleEnabled` (Task 1), `getSetting` (`system-setting.service.ts`, já existente).
- Produces: `maintenanceJob` (singleton) com `start()`/`stop()`/`run()`/`runManually()`, registrado em `server.ts`. `notificationDetector.detectOverdueMaintenance()` reutilizável fora do job (mesmo padrão de `checkExpiringLots()`).

- [ ] **Step 1: Bounds numéricos e seed da configuração**

Em `backend/src/services/system-setting.service.ts`, localize `KEY_NUMERIC_BOUNDS` e adicione:

```typescript
  'manutencao.ordem_atraso_horas': { min: 1 },
```

Em `backend/prisma/seed.ts`, localize o array de `SystemSetting` (mesmo bloco de `wms.task_delay_threshold_hours`/`wms.lot_expiry_alert_days`) e adicione, logo após a entrada de `wms.lot_expiry_alert_days`:

```typescript
    {
      key: 'manutencao.ordem_atraso_horas',
      value: '48',
      type: 'NUMBER' as const,
      category: 'manutencao',
      label: 'Limiar de ordem de manutenção atrasada (horas)',
      description:
        'A partir de quantas horas aberta (PENDING/IN_PROGRESS) uma ordem de manutenção é sinalizada como atrasada.',
    },
```

Run: `cd backend && npm run prisma:seed`
Expected: sem erros; nenhum novo aviso de bounds/validação.

- [ ] **Step 2: `detectOverdueMaintenance()` no detector de notificações**

Em `backend/src/services/notification-detector.service.ts`, adicione o método à classe `NotificationDetectorService` (pode ir logo após `checkExpiringLots()`, mesmo bloco de imports já cobre `isModuleEnabled`/`getSetting`/`notificationService`):

```typescript
  /**
   * Ordens de manutenção PENDING/IN_PROGRESS abertas há mais tempo que o
   * limiar configurado. Mesmo padrão de `checkExpiringLots()`: fail-closed
   * por licença ANTES da consulta, limiar vindo de `SystemSetting` com
   * fallback de config, dedupe por (eventType, resourceId) para não repetir
   * notificação a cada execução do job enquanto a ordem seguir aberta.
   */
  async detectOverdueMaintenance() {
    if (!(await isModuleEnabled('MANUTENCAO'))) {
      return [];
    }

    const thresholdHours = await getSetting('manutencao.ordem_atraso_horas', 48);
    const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

    const overdueOrders = await prisma.maintenanceOrder.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        createdAt: { lt: cutoff },
      },
      include: {
        equipment: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (overdueOrders.length === 0) {
      return overdueOrders;
    }

    const recipients = await this.getUsersByRole('MANAGER');
    if (recipients.length === 0) {
      return overdueOrders;
    }

    for (const order of overdueOrders) {
      const alreadyNotified = await notificationService.checkRecentNotification(
        'MAINTENANCE_ORDER_OVERDUE',
        order.id,
        thresholdHours
      );
      if (alreadyNotified) {
        continue;
      }

      const hoursOpen = Math.floor((Date.now() - order.createdAt.getTime()) / (60 * 60 * 1000));

      await notificationService.createBulk(
        recipients.map((u) => u.id),
        {
          type: 'WARNING',
          category: 'MAINTENANCE',
          eventType: 'MAINTENANCE_ORDER_OVERDUE',
          title: 'Ordem de manutenção atrasada',
          message: `${order.equipment.code} - ${order.equipment.name}: ordem ${order.type === 'PREVENTIVE' ? 'preventiva' : 'corretiva'} aberta há ${hoursOpen}h (limiar: ${thresholdHours}h)`,
          data: {
            orderId: order.id,
            equipmentCode: order.equipment.code,
            type: order.type,
            hoursOpen,
          },
          resourceType: 'MaintenanceOrder',
          resourceId: order.id,
          priority: 3,
        }
      );
    }

    return overdueOrders;
  }
```

- [ ] **Step 3: O job**

Create `backend/src/jobs/maintenance.job.ts`:

```typescript
/**
 * Job da Manutenção (Fase 4). Duas responsabilidades na mesma execução
 * diária, mesmo padrão de `lot-expiry.job.ts` (arquivo próprio, não o
 * NotificationSchedulerService do núcleo, porque MANUTENCAO é módulo
 * licenciável):
 *
 *   1. gerar ordens preventivas a partir de MaintenancePlan vencidos;
 *   2. detectar ordens de manutenção atrasadas e notificar.
 *
 * PERIODICIDADE — uma vez por dia, às 6h (`0 6 * * *`): vencimento de plano é
 * função da DATA, mesmo raciocínio de `lot-expiry.job.ts` — rodar mais
 * seguido não descobriria nada de novo entre uma execução e a seguinte.
 */
import cron from 'node-cron';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import { isModuleEnabled } from '../services/licensed-module.service';
import maintenanceOrderService from '../services/maintenance-order.service';
import notificationDetector from '../services/notification-detector.service';

export class MaintenanceJob {
  private job: ReturnType<typeof cron.schedule> | null = null;

  start() {
    this.job = cron.schedule('0 6 * * *', async () => {
      await this.run();
    });

    logger.info('✅ Job de manutenção iniciado (diariamente às 6h)');
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('🛑 Job de manutenção parado');
    }
  }

  async run() {
    try {
      if (!(await isModuleEnabled('MANUTENCAO'))) {
        return;
      }

      await this.generateDuePreventiveOrders();
      await notificationDetector.detectOverdueMaintenance();
    } catch (error) {
      logger.error('❌ Erro no job de manutenção:', error);
    }
  }

  private async generateDuePreventiveOrders() {
    const now = new Date();
    const duePlans = await prisma.maintenancePlan.findMany({
      where: { active: true, nextDueDate: { lte: now } },
    });

    let generated = 0;
    for (const plan of duePlans) {
      const alreadyOpen = await maintenanceOrderService.hasOpenOrderForPlan(plan.id);
      if (alreadyOpen) {
        continue;
      }

      await maintenanceOrderService.createPreventiveFromPlan(plan.id);

      // Avança a partir do nextDueDate ANTERIOR, não de `now()` — calendário
      // fixo, não relativo à execução (evita acumular atraso silencioso a
      // cada execução perdida do job).
      const newNextDueDate = new Date(plan.nextDueDate.getTime() + plan.frequencyDays * 24 * 60 * 60 * 1000);
      await prisma.maintenancePlan.update({
        where: { id: plan.id },
        data: { nextDueDate: newNextDueDate },
      });

      generated += 1;
    }

    if (generated > 0) {
      logger.info(`🔧 Manutenção: ${generated} ordem(ns) preventiva(s) gerada(s)`);
    }
  }

  /** Execução manual (testes e apuração sob demanda). */
  async runManually() {
    logger.info('🔧 Executando job de manutenção manualmente...');
    return this.run();
  }
}

export default new MaintenanceJob();
```

- [ ] **Step 4: Registrar o job em `server.ts`**

Em `backend/src/server.ts`, localize o import de `lotExpiryJob`:

```typescript
import lotExpiryJob from './jobs/lot-expiry.job';
```

E adicione logo abaixo:

```typescript
import lotExpiryJob from './jobs/lot-expiry.job';
import maintenanceJob from './jobs/maintenance.job';
```

Localize a chamada de start:

```typescript
    // Fase 5: alerta de validade de lote (a vencer e já vencido com saldo).
    // Mesmo padrão dos dois jobs acima — sai cedo sem WMS licenciado.
    lotExpiryJob.start();
```

E adicione logo abaixo:

```typescript
    // Fase 5: alerta de validade de lote (a vencer e já vencido com saldo).
    // Mesmo padrão dos dois jobs acima — sai cedo sem WMS licenciado.
    lotExpiryJob.start();

    // Fase 4: geracao de ordens preventivas + deteccao de atraso.
    // Mesmo padrao dos jobs WMS acima — sai cedo sem MANUTENCAO licenciada.
    maintenanceJob.start();
```

Localize as DUAS ocorrências (uma no handler `SIGTERM`, outra no `SIGINT`) de:

```typescript
  stockPositionReconciliationJob.stop();
  replenishmentJob.stop();
  lotExpiryJob.stop();
  await prisma.$disconnect();
```

E, em cada uma das duas, adicione `maintenanceJob.stop();` logo após `lotExpiryJob.stop();`:

```typescript
  stockPositionReconciliationJob.stop();
  replenishmentJob.stop();
  lotExpiryJob.stop();
  maintenanceJob.stop();
  await prisma.$disconnect();
```

- [ ] **Step 5: Testes do job**

Create `backend/tests/jobs/maintenance.job.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestWorkCenter } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';
import maintenancePlanService from '../../src/services/maintenance-plan.service';
import maintenanceOrderService from '../../src/services/maintenance-order.service';
import maintenanceJob from '../../src/jobs/maintenance.job';

const DAY = 24 * 60 * 60 * 1000;

describe('MaintenanceJob', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const createEquipment = async () => {
    const workCenter = await createTestWorkCenter();
    return equipmentService.create({ code: 'EQP-JOB', name: 'Equipamento Job', workCenterId: workCenter.id });
  };

  it('gera uma ordem preventiva para plano vencido e avança nextDueDate a partir do valor anterior', async () => {
    const equipment = await createEquipment();
    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano vencido',
      frequencyDays: 10,
      nextDueDate: new Date(Date.now() - 2 * DAY), // venceu há 2 dias
    });
    const originalNextDueDate = plan.nextDueDate;

    await maintenanceJob.runManually();

    const orders = await testPrisma.maintenanceOrder.findMany({ where: { planId: plan.id } });
    expect(orders).toHaveLength(1);
    expect(orders[0].type).toBe('PREVENTIVE');
    expect(orders[0].status).toBe('PENDING');

    const updatedPlan = await testPrisma.maintenancePlan.findUnique({ where: { id: plan.id } });
    // Avançou a partir do nextDueDate ANTERIOR (não de agora): originalNextDueDate + 10 dias.
    expect(updatedPlan!.nextDueDate.getTime()).toBe(originalNextDueDate.getTime() + 10 * DAY);
  });

  it('não duplica ordem quando já existe uma PENDING aberta para o plano', async () => {
    const equipment = await createEquipment();
    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano com ordem aberta',
      frequencyDays: 10,
      nextDueDate: new Date(Date.now() - 1 * DAY),
    });
    await maintenanceOrderService.createPreventiveFromPlan(plan.id);

    await maintenanceJob.runManually();

    const orders = await testPrisma.maintenanceOrder.findMany({ where: { planId: plan.id } });
    expect(orders).toHaveLength(1); // continua só a que já existia
  });

  it('não gera ordem para plano inativo, mesmo vencido', async () => {
    const equipment = await createEquipment();
    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano inativo',
      frequencyDays: 10,
      nextDueDate: new Date(Date.now() - 1 * DAY),
      active: false,
    });

    await maintenanceJob.runManually();

    const orders = await testPrisma.maintenanceOrder.findMany({ where: { planId: plan.id } });
    expect(orders).toHaveLength(0);
  });

  it('não gera ordem para plano ainda não vencido', async () => {
    const equipment = await createEquipment();
    const plan = await maintenancePlanService.create({
      equipmentId: equipment.id,
      name: 'Plano futuro',
      frequencyDays: 10,
      nextDueDate: new Date(Date.now() + 5 * DAY),
    });

    await maintenanceJob.runManually();

    const orders = await testPrisma.maintenanceOrder.findMany({ where: { planId: plan.id } });
    expect(orders).toHaveLength(0);
  });
});
```

- [ ] **Step 6: Teste do detector de notificação**

O arquivo de teste existente do `notification-detector.service.ts` é `backend/tests/services/notification-detector.service.test.ts` — já importa `testPrisma`, `cleanDatabase`, `createTestUser`, `createTestWorkCenter` e `notificationDetector` (não precisa adicionar nenhum import novo). Adicione um `describe('detectOverdueMaintenance', ...)` novo, ao final do arquivo:

```typescript
describe('detectOverdueMaintenance', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  it('notifica MANAGER quando uma ordem está aberta além do limiar configurado', async () => {
    const manager = await createTestManager();

    const workCenter = await createTestWorkCenter();
    const equipment = await testPrisma.equipment.create({
      data: { code: 'EQP-OVERDUE', name: 'Equipamento Atrasado', workCenterId: workCenter.id },
    });
    await testPrisma.maintenanceOrder.create({
      data: {
        equipmentId: equipment.id,
        type: 'CORRECTIVE',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000), // 50h atrás, > limiar default de 48h
      },
    });

    const findings = await notificationDetector.detectOverdueMaintenance();

    expect(findings).toHaveLength(1);
    const notifications = await testPrisma.notification.findMany({ where: { userId: manager.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].eventType).toBe('MAINTENANCE_ORDER_OVERDUE');
  });

  it('não notifica ordem aberta há menos tempo que o limiar', async () => {
    const workCenter = await createTestWorkCenter();
    const equipment = await testPrisma.equipment.create({
      data: { code: 'EQP-RECENT', name: 'Equipamento Recente', workCenterId: workCenter.id },
    });
    await testPrisma.maintenanceOrder.create({
      data: {
        equipmentId: equipment.id,
        type: 'CORRECTIVE',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1h atrás
      },
    });

    const findings = await notificationDetector.detectOverdueMaintenance();

    expect(findings).toHaveLength(0);
  });
});
```

- [ ] **Step 7: Rodar os testes**

Run: `cd backend && npm run test:integration -- maintenance.job.test.ts`
Expected: 4/4 passando.

Run: `cd backend && npm run test:integration -- notification-detector`
Expected: todos os testes do detector (existentes + os 2 novos) passando.

- [ ] **Step 8: Rodar a suíte completa**

Run: `cd backend && npm run test:integration`
Expected: baseline (após Task 4) + 4 (job) + 2 (detector) = +6.

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/system-setting.service.ts backend/prisma/seed.ts backend/src/services/notification-detector.service.ts backend/src/jobs/maintenance.job.ts backend/src/server.ts backend/tests/jobs/maintenance.job.test.ts backend/tests/services/notification-detector.service.test.ts
git commit -m "feat(manutencao): adiciona job de geracao de preventivas e notificacao de atraso

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Backend — Indicadores MTBF/MTTR (`maintenance-kpi.service.ts`)

**Files:**
- Create: `backend/src/services/maintenance-kpi.service.ts`
- Create: `backend/src/controllers/maintenance-kpi.controller.ts`
- Create: `backend/src/routes/maintenance-kpi.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/maintenance-kpi.service.test.ts`

**Interfaces:**
- Consumes: `prisma.maintenanceOrder`/`prisma.maintenancePlan` diretamente (mesmo padrão de `wms-kpi.service.ts`, que não passa pelos outros services).
- Produces: `getMaintenanceKpis()` retornando `{ mttrHours: number | null, mtbfByEquipment: { equipmentId, equipmentCode, equipmentName, mtbfHours: number | null }[], preventiveComplianceRate: number, ordersByStatusAndType: { status, type, count }[] }`. Endpoint único `GET /maintenance/kpis` (RBAC `manutencao:visualizar`). Consumido pelo frontend na Task 10 (`MaintenanceKpiDashboardView.vue`).

- [ ] **Step 1: Service**

Create `backend/src/services/maintenance-kpi.service.ts`:

```typescript
import { MaintenanceOrderStatus, MaintenanceOrderType } from '@prisma/client';
import { prisma } from '../config/database';

const MS_PER_HOUR = 60 * 60 * 1000;

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface MtbfEntry {
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  /** `null` quando o equipamento tem menos de 2 corretivas no histórico — não é "zero falhas", é "dado insuficiente". */
  mtbfHours: number | null;
}

export interface OrdersByStatusAndType {
  status: MaintenanceOrderStatus;
  type: MaintenanceOrderType;
  count: number;
}

export interface MaintenanceKpis {
  /** `null` quando não há nenhuma ordem COMPLETED com startedAt/completedAt no histórico. */
  mttrHours: number | null;
  mtbfByEquipment: MtbfEntry[];
  /** % de MaintenancePlan ativos cujo nextDueDate atual está no futuro. */
  preventiveComplianceRate: number;
  ordersByStatusAndType: OrdersByStatusAndType[];
}

/**
 * MTTR (tempo médio de reparo): média de completedAt-startedAt entre TODAS as
 * ordens COMPLETED (preventivas e corretivas) — mesmo padrão de delta de
 * timestamp de wms-kpi.service.ts.
 */
async function computeMttr(): Promise<number | null> {
  const completedOrders = await prisma.maintenanceOrder.findMany({
    where: { status: 'COMPLETED', startedAt: { not: null }, completedAt: { not: null } },
    select: { startedAt: true, completedAt: true },
  });

  if (completedOrders.length === 0) return null;

  const hours = completedOrders.map(
    (o) => (o.completedAt!.getTime() - o.startedAt!.getTime()) / MS_PER_HOUR
  );
  return round1(average(hours));
}

/**
 * MTBF (tempo médio entre falhas), por equipamento: média dos intervalos
 * entre createdAt de ordens CORRECTIVE consecutivas daquele equipamento.
 * Exige pelo menos 2 corretivas para produzir um valor.
 */
async function computeMtbfByEquipment(): Promise<MtbfEntry[]> {
  const equipmentList = await prisma.equipment.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: 'asc' },
  });

  const correctiveOrders = await prisma.maintenanceOrder.findMany({
    where: { type: 'CORRECTIVE' },
    select: { equipmentId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const byEquipment = new Map<string, Date[]>();
  for (const order of correctiveOrders) {
    const list = byEquipment.get(order.equipmentId) ?? [];
    list.push(order.createdAt);
    byEquipment.set(order.equipmentId, list);
  }

  return equipmentList.map((equipment) => {
    const timestamps = byEquipment.get(equipment.id) ?? [];
    if (timestamps.length < 2) {
      return {
        equipmentId: equipment.id,
        equipmentCode: equipment.code,
        equipmentName: equipment.name,
        mtbfHours: null,
      };
    }

    const gaps: number[] = [];
    for (let i = 1; i < timestamps.length; i += 1) {
      gaps.push((timestamps[i].getTime() - timestamps[i - 1].getTime()) / MS_PER_HOUR);
    }

    return {
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      equipmentName: equipment.name,
      mtbfHours: round1(average(gaps)),
    };
  });
}

async function computePreventiveComplianceRate(): Promise<number> {
  const activePlans = await prisma.maintenancePlan.findMany({
    where: { active: true },
    select: { nextDueDate: true },
  });

  if (activePlans.length === 0) return 100;

  const now = new Date();
  const notOverdue = activePlans.filter((p) => p.nextDueDate.getTime() > now.getTime()).length;
  return round1((notOverdue / activePlans.length) * 100);
}

async function computeOrdersByStatusAndType(): Promise<OrdersByStatusAndType[]> {
  const grouped = await prisma.maintenanceOrder.groupBy({
    by: ['status', 'type'],
    _count: { _all: true },
  });

  return grouped.map((g) => ({ status: g.status, type: g.type, count: g._count._all }));
}

export async function getMaintenanceKpis(): Promise<MaintenanceKpis> {
  const [mttrHours, mtbfByEquipment, preventiveComplianceRate, ordersByStatusAndType] = await Promise.all([
    computeMttr(),
    computeMtbfByEquipment(),
    computePreventiveComplianceRate(),
    computeOrdersByStatusAndType(),
  ]);

  return { mttrHours, mtbfByEquipment, preventiveComplianceRate, ordersByStatusAndType };
}
```

- [ ] **Step 2: Controller**

Create `backend/src/controllers/maintenance-kpi.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { getMaintenanceKpis } from '../services/maintenance-kpi.service';

export class MaintenanceKpiController {
  async getKpis(_req: Request, res: Response, next: NextFunction) {
    try {
      const kpis = await getMaintenanceKpis();
      res.status(200).json({ status: 'success', data: kpis });
    } catch (error) {
      next(error);
    }
  }
}

export default new MaintenanceKpiController();
```

- [ ] **Step 3: Routes**

Create `backend/src/routes/maintenance-kpi.routes.ts`:

```typescript
import { Router } from 'express';
import maintenanceKpiController from '../controllers/maintenance-kpi.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';

const router = Router();
router.use(authMiddleware);

router.get('/kpis', requirePermission('manutencao', 'visualizar'), maintenanceKpiController.getKpis);

export default router;
```

- [ ] **Step 4: Montar a rota**

Em `backend/src/routes/index.ts`, adicione o import:

```typescript
import maintenanceKpiRoutes from './maintenance-kpi.routes';
```

E, logo abaixo da linha de `maintenance-orders` adicionada no Task 4:

```typescript
router.use('/maintenance', requireModule('MANUTENCAO'), maintenanceKpiRoutes);
```

(A rota final fica `GET /api/v1/maintenance/kpis` — mesmo estilo de `GET /warehouse-tasks/kpis` já existente no WMS.)

- [ ] **Step 5: Testes**

Create `backend/tests/services/maintenance-kpi.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestWorkCenter } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';
import maintenancePlanService from '../../src/services/maintenance-plan.service';
import { getMaintenanceKpis } from '../../src/services/maintenance-kpi.service';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('maintenance-kpi.service', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  const createEquipment = async (code = 'EQP-KPI') => {
    const workCenter = await createTestWorkCenter();
    return equipmentService.create({ code, name: `Equipamento ${code}`, workCenterId: workCenter.id });
  };

  describe('mttrHours', () => {
    it('retorna null quando não há nenhuma ordem COMPLETED', async () => {
      await createEquipment();
      const kpis = await getMaintenanceKpis();
      expect(kpis.mttrHours).toBeNull();
    });

    it('calcula a média de completedAt-startedAt entre ordens COMPLETED', async () => {
      const equipment = await createEquipment();
      const now = Date.now();
      // Ordem 1: 2h de reparo. Ordem 2: 4h de reparo. Média = 3h.
      await testPrisma.maintenanceOrder.create({
        data: {
          equipmentId: equipment.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          startedAt: new Date(now - 10 * HOUR),
          completedAt: new Date(now - 8 * HOUR),
        },
      });
      await testPrisma.maintenanceOrder.create({
        data: {
          equipmentId: equipment.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          startedAt: new Date(now - 20 * HOUR),
          completedAt: new Date(now - 16 * HOUR),
        },
      });

      const kpis = await getMaintenanceKpis();
      expect(kpis.mttrHours).toBe(3);
    });
  });

  describe('mtbfByEquipment', () => {
    it('retorna mtbfHours null para equipamento com menos de 2 corretivas', async () => {
      const equipment = await createEquipment();
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'CORRECTIVE', status: 'COMPLETED' },
      });

      const kpis = await getMaintenanceKpis();
      const entry = kpis.mtbfByEquipment.find((e) => e.equipmentId === equipment.id);
      expect(entry!.mtbfHours).toBeNull();
    });

    it('calcula a média dos intervalos entre corretivas consecutivas', async () => {
      const equipment = await createEquipment();
      const now = Date.now();
      // 3 corretivas: gaps de 48h e 96h entre elas -> média 72h.
      await testPrisma.maintenanceOrder.create({
        data: {
          equipmentId: equipment.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          createdAt: new Date(now - 10 * DAY),
        },
      });
      await testPrisma.maintenanceOrder.create({
        data: {
          equipmentId: equipment.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          createdAt: new Date(now - 8 * DAY), // 48h depois da primeira
        },
      });
      await testPrisma.maintenanceOrder.create({
        data: {
          equipmentId: equipment.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          createdAt: new Date(now - 4 * DAY), // 96h depois da segunda
        },
      });

      const kpis = await getMaintenanceKpis();
      const entry = kpis.mtbfByEquipment.find((e) => e.equipmentId === equipment.id);
      expect(entry!.mtbfHours).toBe(72);
    });

    it('ignora ordens PREVENTIVE no cálculo de MTBF', async () => {
      const equipment = await createEquipment();
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'PREVENTIVE', status: 'COMPLETED' },
      });
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'PREVENTIVE', status: 'COMPLETED' },
      });

      const kpis = await getMaintenanceKpis();
      const entry = kpis.mtbfByEquipment.find((e) => e.equipmentId === equipment.id);
      expect(entry!.mtbfHours).toBeNull();
    });
  });

  describe('preventiveComplianceRate', () => {
    it('retorna 100 quando não há nenhum plano ativo', async () => {
      const kpis = await getMaintenanceKpis();
      expect(kpis.preventiveComplianceRate).toBe(100);
    });

    it('calcula a % de planos ativos com nextDueDate no futuro', async () => {
      const equipment = await createEquipment();
      await maintenancePlanService.create({
        equipmentId: equipment.id,
        name: 'Em dia',
        frequencyDays: 30,
        nextDueDate: new Date(Date.now() + 10 * DAY),
      });
      await maintenancePlanService.create({
        equipmentId: equipment.id,
        name: 'Atrasado',
        frequencyDays: 30,
        nextDueDate: new Date(Date.now() - 1 * DAY),
      });

      const kpis = await getMaintenanceKpis();
      expect(kpis.preventiveComplianceRate).toBe(50);
    });
  });

  describe('ordersByStatusAndType', () => {
    it('agrupa contagem por status e tipo', async () => {
      const equipment = await createEquipment();
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'CORRECTIVE', status: 'PENDING' },
      });
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'CORRECTIVE', status: 'PENDING' },
      });
      await testPrisma.maintenanceOrder.create({
        data: { equipmentId: equipment.id, type: 'PREVENTIVE', status: 'COMPLETED' },
      });

      const kpis = await getMaintenanceKpis();
      const pendingCorrective = kpis.ordersByStatusAndType.find(
        (e) => e.status === 'PENDING' && e.type === 'CORRECTIVE'
      );
      const completedPreventive = kpis.ordersByStatusAndType.find(
        (e) => e.status === 'COMPLETED' && e.type === 'PREVENTIVE'
      );
      expect(pendingCorrective?.count).toBe(2);
      expect(completedPreventive?.count).toBe(1);
    });
  });
});
```

- [ ] **Step 6: Rodar os testes**

Run: `cd backend && npm run test:integration -- maintenance-kpi.service.test.ts`
Expected: 8/8 passando.

- [ ] **Step 7: Rodar a suíte completa**

Run: `cd backend && npm run test:integration`
Expected: baseline (após Task 5) + 8.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/maintenance-kpi.service.ts backend/src/controllers/maintenance-kpi.controller.ts backend/src/routes/maintenance-kpi.routes.ts backend/src/routes/index.ts backend/tests/services/maintenance-kpi.service.test.ts
git commit -m "feat(manutencao): adiciona indicadores MTBF/MTTR e endpoint de KPIs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Frontend — infraestrutura de navegação + CRUD de Equipamentos

**Files:**
- Modify: `frontend/src/stores/auth.store.ts`
- Modify: `frontend/src/views/DashboardView.vue`
- Modify: `frontend/src/router/index.ts`
- Create: `frontend/src/services/equipment.service.ts`
- Create: `frontend/src/stores/equipment.store.ts`
- Create: `frontend/src/views/maintenance/EquipmentListView.vue`
- Test: `frontend/src/views/maintenance/__tests__/EquipmentListView.spec.ts`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE/PATCH /equipment` (Task 2); `authStore.permissions` (já existente).
- Produces: `authStore.canViewManutencao`; nova aba "Manutenção" no Dashboard; rotas `/maintenance/equipment`, `/maintenance/plans`, `/maintenance/orders`, `/maintenance/kpis` registradas (as 3 últimas apontam para componentes que só existirão a partir das Tasks 8-10 — registre todas as 4 rotas agora, mesmo que 3 apontem para arquivos que ainda não existem, para o import lazy do Vue Router não quebrar build enquanto as próximas tasks não rodarem **na mesma sessão de implementação** — se este task for revisado isoladamente antes das Tasks 8-10 existirem, espere erro de build nas 3 rotas restantes até elas serem criadas; não é uma regressão deste task, é a ordem natural do plano); `useEquipmentStore` reaproveitado pela Task 8 (`MaintenancePlanListView` precisa listar equipamentos no formulário).

- [ ] **Step 1: `authStore.canViewManutencao`**

Em `frontend/src/stores/auth.store.ts`, localize:

```typescript
  const canViewYMS = computed(() => permissions.value.includes('modules.view_yms'))
```

E adicione logo abaixo:

```typescript
  const canViewManutencao = computed(() => permissions.value.includes('modules.view_manutencao'))
```

No `return` da store, adicione `canViewManutencao` junto aos outros `canView*` já retornados.

- [ ] **Step 2: Nova aba "Manutenção" no Dashboard**

Em `frontend/src/views/DashboardView.vue`, localize o botão da aba YMS:

```vue
              <button
                v-if="authStore.canViewYMS"
                @click="activeTab = 'yms'"
                :class="[
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === 'yms'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                YMS
              </button>
            </nav>
          </div>
```

E adicione um botão novo entre o de YMS e o `</nav>`:

```vue
              <button
                v-if="authStore.canViewYMS"
                @click="activeTab = 'yms'"
                :class="[
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === 'yms'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                YMS
              </button>
              <button
                v-if="authStore.canViewManutencao"
                @click="activeTab = 'manutencao'"
                :class="[
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === 'manutencao'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                Manutenção
              </button>
            </nav>
          </div>
```

Localize o final do bloco de conteúdo da aba YMS (o último `</div>` do `v-else-if="activeTab === 'yms' ...`, imediatamente antes do `</Card>` que fecha "Módulos do Sistema"):

```vue
            <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700">Relatórios YMS</p>
                <p class="text-xs text-gray-400 mt-1">Em breve</p>
              </div>
            </div>
          </div>
        </Card>
```

E adicione um novo bloco de conteúdo de aba logo depois, ainda dentro do `<Card>`:

```vue
            <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700">Relatórios YMS</p>
                <p class="text-xs text-gray-400 mt-1">Em breve</p>
              </div>
            </div>
          </div>

          <!-- Tab Content: Manutenção -->
          <div v-else-if="activeTab === 'manutencao' && authStore.canViewManutencao" class="grid grid-cols-3 gap-3">
            <RouterLink
              to="/maintenance/equipment"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🔧</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Equipamentos</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/maintenance/plans"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🗓️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Planos de Manutenção</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/maintenance/orders"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🛠️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Ordens de Manutenção</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/maintenance/kpis"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard de KPIs</p>
              </div>
            </RouterLink>
          </div>
        </Card>
```

Nota: os cards novos já nascem com `dark:` (receita do dark mode: `border-gray-200`→`dark:border-gray-700`, `hover:border-primary-400`→`+dark:hover:border-primary-500`, `hover:bg-primary-50`→`+dark:hover:bg-gray-800`, `text-gray-700`→`+dark:text-gray-300`) — mesmo padrão já aplicado aos outros cards desta view na Fase 1 do dark mode (Task 6 daquele plano). Os cards dos módulos Geral/PCP/WMS/YMS ao lado NÃO têm essas classes (foram excluídos do escopo do dark mode Fase 1) — não as adicione a eles neste task, isso seria escopo de um lote futuro do dark mode, não deste plano.

Localize o `onMounted` e a seleção automática de aba:

```typescript
  if (authStore.canViewGeneral) {
    activeTab.value = 'geral'
  } else if (authStore.canViewPCP) {
    activeTab.value = 'pcp'
  } else if (authStore.canViewWMS) {
    activeTab.value = 'wms'
  } else if (authStore.canViewYMS) {
    activeTab.value = 'yms'
  }
```

Substitua por:

```typescript
  if (authStore.canViewGeneral) {
    activeTab.value = 'geral'
  } else if (authStore.canViewPCP) {
    activeTab.value = 'pcp'
  } else if (authStore.canViewWMS) {
    activeTab.value = 'wms'
  } else if (authStore.canViewYMS) {
    activeTab.value = 'yms'
  } else if (authStore.canViewManutencao) {
    activeTab.value = 'manutencao'
  }
```

- [ ] **Step 3: Rotas**

Em `frontend/src/router/index.ts`, adicione, no mesmo bloco de rotas autenticadas (junto a `/work-centers`, `/warehouses` etc.):

```typescript
  {
    path: '/maintenance/equipment',
    name: 'maintenance-equipment',
    component: () => import('../views/maintenance/EquipmentListView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/maintenance/plans',
    name: 'maintenance-plans',
    component: () => import('../views/maintenance/MaintenancePlanListView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/maintenance/orders',
    name: 'maintenance-orders',
    component: () => import('../views/maintenance/MaintenanceOrderListView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/maintenance/kpis',
    name: 'maintenance-kpis',
    component: () => import('../views/maintenance/MaintenanceKpiDashboardView.vue'),
    meta: { requiresAuth: true }
  },
```

- [ ] **Step 4: `equipment.service.ts`**

Create `frontend/src/services/equipment.service.ts`:

```typescript
import api from './api.service'

export interface WorkCenterRef {
  id: string
  code: string
  name: string
}

export interface Equipment {
  id: string
  code: string
  name: string
  workCenterId: string
  manufacturer?: string | null
  model?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  workCenter?: WorkCenterRef
}

export interface CreateEquipmentDto {
  code: string
  name: string
  workCenterId: string
  manufacturer?: string | null
  model?: string | null
  active?: boolean
}

export interface UpdateEquipmentDto extends Partial<CreateEquipmentDto> {}

class EquipmentService {
  private readonly basePath = '/equipment'

  async getAll(page = 1, limit = 100, filters?: { workCenterId?: string; active?: boolean; search?: string }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.workCenterId) params.append('workCenterId', filters.workCenterId)
    if (filters?.active !== undefined) params.append('active', filters.active.toString())
    if (filters?.search) params.append('search', filters.search)
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`)
  }

  async create(data: CreateEquipmentDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateEquipmentDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async toggleActive(id: string) {
    return api.patch(`${this.basePath}/${id}/toggle-active`)
  }
}

export default new EquipmentService()
```

- [ ] **Step 5: `equipment.store.ts`**

Create `frontend/src/stores/equipment.store.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import equipmentService, { type Equipment, type CreateEquipmentDto, type UpdateEquipmentDto } from '@/services/equipment.service'

export const useEquipmentStore = defineStore('equipment', () => {
  const equipment = ref<Equipment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchEquipment = async (page = 1, limit = 100, filters?: { workCenterId?: string; active?: boolean; search?: string }) => {
    try {
      loading.value = true
      error.value = null
      const response = await equipmentService.getAll(page, limit, filters)
      equipment.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar equipamentos'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createEquipment = async (data: CreateEquipmentDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await equipmentService.create(data)
      await fetchEquipment()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar equipamento'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateEquipment = async (id: string, data: UpdateEquipmentDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await equipmentService.update(id, data)
      await fetchEquipment()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar equipamento'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteEquipment = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await equipmentService.delete(id)
      await fetchEquipment()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir equipamento'
      throw err
    } finally {
      loading.value = false
    }
  }

  const toggleActive = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await equipmentService.toggleActive(id)
      await fetchEquipment()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar status'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { equipment, loading, error, fetchEquipment, createEquipment, updateEquipment, deleteEquipment, toggleActive }
})
```

- [ ] **Step 6: `EquipmentListView.vue`**

Create `frontend/src/views/maintenance/EquipmentListView.vue`, seguindo exatamente o padrão de `frontend/src/views/work-centers/WorkCentersView.vue` (`AppLayout` + `Card` de filtros + `DataTable` + `AppModal` de formulário), adaptado para os campos de `Equipment` e com um `<select>` de Centro de Trabalho (via `useWorkCenterStore`, já existente) no lugar do `<select>` de tipo:

```vue
<template>
  <AppLayout title="Equipamentos" subtitle="Gerencie os equipamentos de manutenção do sistema">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Equipamento</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="eq-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Código ou nome..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="eq-filter-work-center" label="Centro de Trabalho">
          <select
            v-model="filters.workCenterId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="wc in workCenterStore.workCenters" :key="wc.id" :value="wc.id">{{ wc.name }}</option>
          </select>
        </FormField>
        <FormField id="eq-filter-active" label="Status">
          <select
            v-model="filters.active"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="equipmentList"
      :pagination="pagination"
      empty-title="Nenhum equipamento encontrado"
      empty-hint="Ajuste os filtros ou cadastre um novo equipamento."
      @retry="loadEquipment"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Equipamento</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Código</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Centro de Trabalho</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fabricante/Modelo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ asItem(item).code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ asItem(item).workCenter?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatManufacturer(asItem(item)) }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).active ? 'Ativo' : 'Inativo'"
            :tone="asItem(item).active ? 'success' : 'danger'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button @click="handleToggleActive(asItem(item))" class="text-yellow-600 hover:text-yellow-900">
            {{ asItem(item).active ? 'Desativar' : 'Ativar' }}
          </button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingEquipment ? 'Editar Equipamento' : 'Novo Equipamento'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="eq-form-code" label="Código" required>
            <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="eq-form-name" label="Nome" required>
            <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <FormField id="eq-form-work-center" label="Centro de Trabalho" required>
          <select v-model="formData.workCenterId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="wc in workCenterStore.workCenters" :key="wc.id" :value="wc.id">{{ wc.name }}</option>
          </select>
        </FormField>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="eq-form-manufacturer" label="Fabricante">
            <input v-model="formData.manufacturer" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="eq-form-model" label="Modelo">
            <input v-model="formData.model" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <div class="flex items-center">
          <input v-model="formData.active" type="checkbox" id="eq-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="eq-form-active" class="ml-2 text-sm text-gray-700">Ativo</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingEquipment ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useEquipmentStore } from '@/stores/equipment.store'
import { useWorkCenterStore } from '@/stores/work-center.store'
import type { Equipment } from '@/services/equipment.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'
import { useDebounce } from '@/composables/useDebounce'

const equipmentStore = useEquipmentStore()
const workCenterStore = useWorkCenterStore()
const toast = useToast()

const equipmentList = ref<Equipment[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const editingEquipment = ref<Equipment | null>(null)
const filters = ref({ search: '', workCenterId: '', active: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({
  code: '',
  name: '',
  workCenterId: '',
  manufacturer: '',
  model: '',
  active: true,
})

const loadEquipment = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await equipmentStore.fetchEquipment(pagination.value.page, pagination.value.limit, {
      workCenterId: filters.value.workCenterId || undefined,
      active: filters.value.active ? filters.value.active === 'true' : undefined,
      search: filters.value.search || undefined,
    })
    equipmentList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar equipamentos'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadEquipment() }
const debouncedFilterChange = useDebounce(handleFilterChange, 350)
const changePage = (page: number) => { pagination.value.page = page; loadEquipment() }
const resetFormData = () => ({ code: '', name: '', workCenterId: '', manufacturer: '', model: '', active: true })
const openCreateModal = () => { editingEquipment.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (eq: Equipment) => {
  editingEquipment.value = eq
  formData.value = {
    code: eq.code,
    name: eq.name,
    workCenterId: eq.workCenterId,
    manufacturer: eq.manufacturer || '',
    model: eq.model || '',
    active: eq.active,
  }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingEquipment.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    const data = {
      ...formData.value,
      manufacturer: formData.value.manufacturer || null,
      model: formData.value.model || null,
    }
    if (editingEquipment.value) {
      await equipmentStore.updateEquipment(editingEquipment.value.id, data)
      toast.success('Equipamento atualizado com sucesso!')
    } else {
      await equipmentStore.createEquipment(data)
      toast.success('Equipamento criado com sucesso!')
    }
    closeModal()
    await loadEquipment()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar equipamento')
  } finally {
    saving.value = false
  }
}

const handleToggleActive = async (eq: Equipment) => {
  if (await confirmDialog(`Deseja ${eq.active ? 'desativar' : 'ativar'} o equipamento "${eq.name}"?`)) {
    const acao = eq.active ? 'desativado' : 'ativado'
    try {
      await equipmentStore.toggleActive(eq.id)
      toast.success(`Equipamento ${acao} com sucesso!`)
      await loadEquipment()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao alterar status')
    }
  }
}

const handleDelete = async (eq: Equipment) => {
  if (await confirmDialog(`Deseja realmente excluir o equipamento "${eq.name}"?`)) {
    try {
      await equipmentStore.deleteEquipment(eq.id)
      toast.success('Equipamento excluído com sucesso!')
      await loadEquipment()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir equipamento')
    }
  }
}

const asItem = (item: unknown) => item as Equipment

const formatManufacturer = (eq: Equipment) => {
  if (eq.manufacturer && eq.model) return `${eq.manufacturer} / ${eq.model}`
  return eq.manufacturer || eq.model || '-'
}

onMounted(async () => {
  await workCenterStore.fetchWorkCenters()
  await loadEquipment()
})
</script>
```

- [ ] **Step 7: Teste da view**

Create `frontend/src/views/maintenance/__tests__/EquipmentListView.spec.ts`, seguindo o mesmo padrão de teste já usado em views de CRUD deste projeto (mock de `vue-router`, `@/stores/auth.store`, `@/stores/theme.store` — necessário porque a view renderiza `AppLayout`, que renderiza `ThemeToggle` — e das stores de dados):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import EquipmentListView from '../EquipmentListView.vue'
import equipmentService from '@/services/equipment.service'
import workCenterService from '@/services/work-center.service'

vi.mock('@/services/equipment.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), toggleActive: vi.fn() },
}))

vi.mock('@/services/work-center.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockWorkCenter = { id: 'wc-1', code: 'WC-1', name: 'Usinagem', type: 'machine', efficiency: 1, active: true, createdAt: '', updatedAt: '' }

const mockEquipment = {
  id: 'eq-1',
  code: 'EQP-001',
  name: 'Torno CNC 1',
  workCenterId: 'wc-1',
  manufacturer: 'Romi',
  model: 'GL-240',
  active: true,
  createdAt: '',
  updatedAt: '',
  workCenter: { id: 'wc-1', code: 'WC-1', name: 'Usinagem' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/maintenance/equipment', component: EquipmentListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('EquipmentListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workCenterService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockWorkCenter], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  it('carrega e exibe a lista de equipamentos', async () => {
    vi.mocked(equipmentService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockEquipment], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/maintenance/equipment')
    await router.isReady()

    const wrapper = mount(EquipmentListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('EQP-001')
    expect(wrapper.text()).toContain('Torno CNC 1')
    expect(wrapper.text()).toContain('Usinagem')
    expect(wrapper.text()).toContain('Romi / GL-240')
  })

  it('cria um equipamento novo pelo formulário', async () => {
    vi.mocked(equipmentService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(equipmentService.create).mockResolvedValue({ data: { status: 'success', data: mockEquipment } } as any)

    const router = makeRouter()
    router.push('/maintenance/equipment')
    await router.isReady()

    const wrapper = mount(EquipmentListView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('button:not([type="submit"])').trigger('click') // "+ Novo Equipamento" nas actions
    await wrapper.vm.$nextTick()

    await wrapper.find('#eq-form-code').setValue('EQP-002')
    await wrapper.find('#eq-form-name').setValue('Prensa Hidráulica')
    await wrapper.find('#eq-form-work-center').setValue('wc-1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(equipmentService.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EQP-002', name: 'Prensa Hidráulica', workCenterId: 'wc-1' })
    )
  })
})
```

- [ ] **Step 8: Rodar os testes**

Run: `cd frontend && npx vitest run src/views/maintenance/__tests__/EquipmentListView.spec.ts`
Expected: 2/2 passando.

- [ ] **Step 9: Rodar a suíte completa do frontend + type-check**

Run: `cd frontend && npm test`
Expected: baseline + 2 (nenhum teste de `MaintenancePlanListView`/`MaintenanceOrderListView`/`MaintenanceKpiDashboardView` ainda existe — normal, vêm nas Tasks 8-10).

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: baseline de 48 erros — **mas as 3 rotas lazy-import de `router/index.ts` apontando para `MaintenancePlanListView.vue`/`MaintenanceOrderListView.vue`/`MaintenanceKpiDashboardView.vue` (que ainda não existem neste ponto do plano) VÃO gerar novos erros de módulo não encontrado.** Isso é esperado e temporário — resolve-se sozinho ao final da Task 9 (Task 8 e 9 destravam 2 dos 3; Task 10 destrava o terceiro). Não tente "corrigir" isso criando arquivos vazios — as próprias Tasks 8, 9 e 10 criam os arquivos reais.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/stores/auth.store.ts frontend/src/views/DashboardView.vue frontend/src/router/index.ts frontend/src/services/equipment.service.ts frontend/src/stores/equipment.store.ts frontend/src/views/maintenance/EquipmentListView.vue frontend/src/views/maintenance/__tests__/EquipmentListView.spec.ts
git commit -m "feat(manutencao): adiciona aba Manutencao no Dashboard e CRUD de Equipamentos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Frontend — CRUD de Planos de Manutenção

**Files:**
- Create: `frontend/src/services/maintenance-plan.service.ts`
- Create: `frontend/src/stores/maintenance-plan.store.ts`
- Create: `frontend/src/views/maintenance/MaintenancePlanListView.vue`
- Test: `frontend/src/views/maintenance/__tests__/MaintenancePlanListView.spec.ts`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE/PATCH /maintenance-plans` (Task 3); `useEquipmentStore` (Task 7, para o `<select>` de equipamento).
- Produces: nenhuma outra task depende deste arquivo diretamente — encerra a cadeia de CRUDs de cadastro.

- [ ] **Step 1: `maintenance-plan.service.ts`**

Create `frontend/src/services/maintenance-plan.service.ts`:

```typescript
import api from './api.service'

export interface EquipmentRef {
  id: string
  code: string
  name: string
}

export interface MaintenancePlan {
  id: string
  equipmentId: string
  name: string
  description?: string | null
  frequencyDays: number
  nextDueDate: string
  active: boolean
  createdAt: string
  updatedAt: string
  equipment?: EquipmentRef
}

export interface CreateMaintenancePlanDto {
  equipmentId: string
  name: string
  description?: string | null
  frequencyDays: number
  nextDueDate?: string
  active?: boolean
}

export interface UpdateMaintenancePlanDto extends Partial<CreateMaintenancePlanDto> {}

class MaintenancePlanService {
  private readonly basePath = '/maintenance-plans'

  async getAll(page = 1, limit = 100, filters?: { equipmentId?: string; active?: boolean }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.equipmentId) params.append('equipmentId', filters.equipmentId)
    if (filters?.active !== undefined) params.append('active', filters.active.toString())
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async getById(id: string) {
    return api.get(`${this.basePath}/${id}`)
  }

  async create(data: CreateMaintenancePlanDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateMaintenancePlanDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async toggleActive(id: string) {
    return api.patch(`${this.basePath}/${id}/toggle-active`)
  }
}

export default new MaintenancePlanService()
```

- [ ] **Step 2: `maintenance-plan.store.ts`**

Create `frontend/src/stores/maintenance-plan.store.ts` — idêntico em estrutura a `frontend/src/stores/equipment.store.ts` (Task 7), trocando `equipmentService`/`Equipment` por `maintenancePlanService`/`MaintenancePlan`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import maintenancePlanService, {
  type MaintenancePlan,
  type CreateMaintenancePlanDto,
  type UpdateMaintenancePlanDto,
} from '@/services/maintenance-plan.service'

export const useMaintenancePlanStore = defineStore('maintenancePlan', () => {
  const plans = ref<MaintenancePlan[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchPlans = async (page = 1, limit = 100, filters?: { equipmentId?: string; active?: boolean }) => {
    try {
      loading.value = true
      error.value = null
      const response = await maintenancePlanService.getAll(page, limit, filters)
      plans.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar planos de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createPlan = async (data: CreateMaintenancePlanDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await maintenancePlanService.create(data)
      await fetchPlans()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar plano de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updatePlan = async (id: string, data: UpdateMaintenancePlanDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await maintenancePlanService.update(id, data)
      await fetchPlans()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar plano de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deletePlan = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await maintenancePlanService.delete(id)
      await fetchPlans()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir plano de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const toggleActive = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await maintenancePlanService.toggleActive(id)
      await fetchPlans()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar status'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { plans, loading, error, fetchPlans, createPlan, updatePlan, deletePlan, toggleActive }
})
```

- [ ] **Step 3: `MaintenancePlanListView.vue`**

Create `frontend/src/views/maintenance/MaintenancePlanListView.vue`, mesmo padrão de `EquipmentListView.vue` (Task 7): `AppLayout` + `Card` de filtros + `DataTable` + `AppModal`. Coluna extra "Próxima execução" formatada em `pt-BR`; campo `frequencyDays` numérico no formulário; `equipmentId` via `<select>` alimentado por `useEquipmentStore` (já carregado — reaproveita o mesmo store da Task 7, sem duplicar a chamada `fetchEquipment()` se a navegação vier de dentro da sessão, mas chama de novo no `onMounted` por segurança, já que o usuário pode entrar direto nesta URL):

```vue
<template>
  <AppLayout title="Planos de Manutenção" subtitle="Gerencie os planos de manutenção preventiva">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Plano</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="mp-filter-equipment" label="Equipamento">
          <select
            v-model="filters.equipmentId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="eq in equipmentStore.equipment" :key="eq.id" :value="eq.id">{{ eq.code }} - {{ eq.name }}</option>
          </select>
        </FormField>
        <FormField id="mp-filter-active" label="Status">
          <select
            v-model="filters.active"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="planList"
      :pagination="pagination"
      empty-title="Nenhum plano de manutenção encontrado"
      empty-hint="Cadastre um plano para começar a gerar ordens preventivas automaticamente."
      @retry="loadPlans"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Plano</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Equipamento</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Frequência</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Próxima execução</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ asItem(item).equipment?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">a cada {{ asItem(item).frequencyDays }} dia(s)</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ formatDate(asItem(item).nextDueDate) }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).active ? 'Ativo' : 'Inativo'"
            :tone="asItem(item).active ? 'success' : 'danger'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button @click="handleToggleActive(asItem(item))" class="text-yellow-600 hover:text-yellow-900">
            {{ asItem(item).active ? 'Desativar' : 'Ativar' }}
          </button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingPlan ? 'Editar Plano de Manutenção' : 'Novo Plano de Manutenção'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="mp-form-equipment" label="Equipamento" required>
          <select v-model="formData.equipmentId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="eq in equipmentStore.equipment" :key="eq.id" :value="eq.id">{{ eq.code }} - {{ eq.name }}</option>
          </select>
        </FormField>

        <FormField id="mp-form-name" label="Nome" required>
          <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <FormField id="mp-form-description" label="Descrição">
          <textarea v-model="formData.description" rows="2" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <FormField id="mp-form-frequency" label="Frequência (dias)" required>
          <input v-model.number="formData.frequencyDays" type="number" min="1" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <div class="flex items-center">
          <input v-model="formData.active" type="checkbox" id="mp-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="mp-form-active" class="ml-2 text-sm text-gray-700">Ativo</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingPlan ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMaintenancePlanStore } from '@/stores/maintenance-plan.store'
import { useEquipmentStore } from '@/stores/equipment.store'
import type { MaintenancePlan } from '@/services/maintenance-plan.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const planStore = useMaintenancePlanStore()
const equipmentStore = useEquipmentStore()
const toast = useToast()

const planList = ref<MaintenancePlan[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const editingPlan = ref<MaintenancePlan | null>(null)
const filters = ref({ equipmentId: '', active: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({ equipmentId: '', name: '', description: '', frequencyDays: 30, active: true })

const loadPlans = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await planStore.fetchPlans(pagination.value.page, pagination.value.limit, {
      equipmentId: filters.value.equipmentId || undefined,
      active: filters.value.active ? filters.value.active === 'true' : undefined,
    })
    planList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar planos de manutenção'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadPlans() }
const changePage = (page: number) => { pagination.value.page = page; loadPlans() }
const resetFormData = () => ({ equipmentId: '', name: '', description: '', frequencyDays: 30, active: true })
const openCreateModal = () => { editingPlan.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (plan: MaintenancePlan) => {
  editingPlan.value = plan
  formData.value = {
    equipmentId: plan.equipmentId,
    name: plan.name,
    description: plan.description || '',
    frequencyDays: plan.frequencyDays,
    active: plan.active,
  }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingPlan.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    const data = { ...formData.value, description: formData.value.description || null }
    if (editingPlan.value) {
      await planStore.updatePlan(editingPlan.value.id, data)
      toast.success('Plano de manutenção atualizado com sucesso!')
    } else {
      await planStore.createPlan(data)
      toast.success('Plano de manutenção criado com sucesso!')
    }
    closeModal()
    await loadPlans()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar plano de manutenção')
  } finally {
    saving.value = false
  }
}

const handleToggleActive = async (plan: MaintenancePlan) => {
  if (await confirmDialog(`Deseja ${plan.active ? 'desativar' : 'ativar'} o plano "${plan.name}"?`)) {
    const acao = plan.active ? 'desativado' : 'ativado'
    try {
      await planStore.toggleActive(plan.id)
      toast.success(`Plano ${acao} com sucesso!`)
      await loadPlans()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao alterar status')
    }
  }
}

const handleDelete = async (plan: MaintenancePlan) => {
  if (await confirmDialog(`Deseja realmente excluir o plano "${plan.name}"?`)) {
    try {
      await planStore.deletePlan(plan.id)
      toast.success('Plano de manutenção excluído com sucesso!')
      await loadPlans()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir plano de manutenção')
    }
  }
}

const asItem = (item: unknown) => item as MaintenancePlan
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR')

onMounted(async () => {
  await equipmentStore.fetchEquipment()
  await loadPlans()
})
</script>
```

- [ ] **Step 4: Teste da view**

Create `frontend/src/views/maintenance/__tests__/MaintenancePlanListView.spec.ts`, mesmo padrão de `EquipmentListView.spec.ts` (Task 7):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import MaintenancePlanListView from '../MaintenancePlanListView.vue'
import maintenancePlanService from '@/services/maintenance-plan.service'
import equipmentService from '@/services/equipment.service'

vi.mock('@/services/maintenance-plan.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), toggleActive: vi.fn() },
}))

vi.mock('@/services/equipment.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockEquipment = { id: 'eq-1', code: 'EQP-001', name: 'Torno CNC 1', workCenterId: 'wc-1', active: true, createdAt: '', updatedAt: '' }

const mockPlan = {
  id: 'plan-1',
  equipmentId: 'eq-1',
  name: 'Lubrificação mensal',
  description: null,
  frequencyDays: 30,
  nextDueDate: '2026-10-01T00:00:00.000Z',
  active: true,
  createdAt: '',
  updatedAt: '',
  equipment: { id: 'eq-1', code: 'EQP-001', name: 'Torno CNC 1' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/maintenance/plans', component: MaintenancePlanListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('MaintenancePlanListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(equipmentService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockEquipment], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  it('carrega e exibe a lista de planos com o nome do equipamento e a frequência', async () => {
    vi.mocked(maintenancePlanService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockPlan], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/maintenance/plans')
    await router.isReady()

    const wrapper = mount(MaintenancePlanListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Lubrificação mensal')
    expect(wrapper.text()).toContain('Torno CNC 1')
    expect(wrapper.text()).toContain('a cada 30 dia(s)')
  })

  it('cria um plano novo pelo formulário', async () => {
    vi.mocked(maintenancePlanService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(maintenancePlanService.create).mockResolvedValue({ data: { status: 'success', data: mockPlan } } as any)

    const router = makeRouter()
    router.push('/maintenance/plans')
    await router.isReady()

    const wrapper = mount(MaintenancePlanListView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('button:not([type="submit"])').trigger('click')
    await wrapper.vm.$nextTick()

    await wrapper.find('#mp-form-equipment').setValue('eq-1')
    await wrapper.find('#mp-form-name').setValue('Inspeção trimestral')
    await wrapper.find('#mp-form-frequency').setValue(90)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(maintenancePlanService.create).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentId: 'eq-1', name: 'Inspeção trimestral', frequencyDays: 90 })
    )
  })
})
```

- [ ] **Step 5: Rodar os testes**

Run: `cd frontend && npx vitest run src/views/maintenance/__tests__/MaintenancePlanListView.spec.ts`
Expected: 2/2 passando.

- [ ] **Step 6: Rodar a suíte completa + type-check**

Run: `cd frontend && npm test`
Expected: baseline (após Task 7) + 2.

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: 48 + 2 (as 2 rotas ainda pendentes — `MaintenanceOrderListView.vue`/`MaintenanceKpiDashboardView.vue` — mesma situação transitória explicada na Task 7).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/maintenance-plan.service.ts frontend/src/stores/maintenance-plan.store.ts frontend/src/views/maintenance/MaintenancePlanListView.vue frontend/src/views/maintenance/__tests__/MaintenancePlanListView.spec.ts
git commit -m "feat(manutencao): adiciona CRUD de Planos de Manutencao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Frontend — Ordens de Manutenção (listagem + ciclo de vida)

**Files:**
- Create: `frontend/src/services/maintenance-order.service.ts`
- Create: `frontend/src/stores/maintenance-order.store.ts`
- Create: `frontend/src/views/maintenance/MaintenanceOrderListView.vue`
- Test: `frontend/src/views/maintenance/__tests__/MaintenanceOrderListView.spec.ts`

**Interfaces:**
- Consumes: `GET/POST/PUT/PATCH /maintenance-orders` (Task 4); `useEquipmentStore` (Task 7); `userService.getAll()` (`frontend/src/services/user.service.ts`, já existente — note que `userService.getAll()` já devolve `response.data` diretamente, isto é, `{ status, data, pagination }` — diferente de `equipmentService.getAll()`, que devolve a resposta crua do axios; use `const result = await userService.getAll(); result.data` para o array de usuários, não `result.data.data`).
- Produces: nenhuma outra task depende deste arquivo.

- [ ] **Step 1: `maintenance-order.service.ts`**

Create `frontend/src/services/maintenance-order.service.ts`:

```typescript
import api from './api.service'

export type MaintenanceOrderType = 'PREVENTIVE' | 'CORRECTIVE'
export type MaintenanceOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export interface MaintenanceOrder {
  id: string
  equipmentId: string
  planId: string | null
  type: MaintenanceOrderType
  status: MaintenanceOrderStatus
  problemDescription: string | null
  resolutionNotes: string | null
  assignedTo: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  equipment?: { id: string; code: string; name: string }
  plan?: { id: string; name: string } | null
  assignee?: { id: string; name: string; email: string } | null
}

export interface CreateCorrectiveOrderDto {
  equipmentId: string
  problemDescription: string
  assignedTo?: string | null
}

class MaintenanceOrderService {
  private readonly basePath = '/maintenance-orders'

  async getAll(
    page = 1,
    limit = 100,
    filters?: { equipmentId?: string; type?: MaintenanceOrderType; status?: MaintenanceOrderStatus }
  ) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.equipmentId) params.append('equipmentId', filters.equipmentId)
    if (filters?.type) params.append('type', filters.type)
    if (filters?.status) params.append('status', filters.status)
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateCorrectiveOrderDto) {
    return api.post(this.basePath, data)
  }

  async start(id: string) {
    return api.patch(`${this.basePath}/${id}/start`)
  }

  async complete(id: string, resolutionNotes: string) {
    return api.patch(`${this.basePath}/${id}/complete`, { resolutionNotes })
  }

  async cancel(id: string, reason?: string) {
    return api.patch(`${this.basePath}/${id}/cancel`, { reason })
  }
}

export default new MaintenanceOrderService()
```

- [ ] **Step 2: `maintenance-order.store.ts`**

Create `frontend/src/stores/maintenance-order.store.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import maintenanceOrderService, {
  type MaintenanceOrder,
  type CreateCorrectiveOrderDto,
  type MaintenanceOrderType,
  type MaintenanceOrderStatus,
} from '@/services/maintenance-order.service'

export const useMaintenanceOrderStore = defineStore('maintenanceOrder', () => {
  const orders = ref<MaintenanceOrder[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchOrders = async (
    page = 1,
    limit = 100,
    filters?: { equipmentId?: string; type?: MaintenanceOrderType; status?: MaintenanceOrderStatus }
  ) => {
    try {
      loading.value = true
      error.value = null
      const response = await maintenanceOrderService.getAll(page, limit, filters)
      orders.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar ordens de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createOrder = async (data: CreateCorrectiveOrderDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await maintenanceOrderService.create(data)
      await fetchOrders()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao abrir ordem de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const startOrder = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await maintenanceOrderService.start(id)
      await fetchOrders()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao iniciar ordem'
      throw err
    } finally {
      loading.value = false
    }
  }

  const completeOrder = async (id: string, resolutionNotes: string) => {
    try {
      loading.value = true
      error.value = null
      await maintenanceOrderService.complete(id, resolutionNotes)
      await fetchOrders()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao concluir ordem'
      throw err
    } finally {
      loading.value = false
    }
  }

  const cancelOrder = async (id: string, reason?: string) => {
    try {
      loading.value = true
      error.value = null
      await maintenanceOrderService.cancel(id, reason)
      await fetchOrders()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao cancelar ordem'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { orders, loading, error, fetchOrders, createOrder, startOrder, completeOrder, cancelOrder }
})
```

- [ ] **Step 3: `MaintenanceOrderListView.vue`**

Create `frontend/src/views/maintenance/MaintenanceOrderListView.vue`. Duas diferenças em relação às telas de CRUD das Tasks 7/8: (1) não há "Editar" — o ciclo de vida é por ação (Iniciar/Concluir/Cancelar), não por formulário livre; (2) "Concluir" abre um segundo modal pedindo `resolutionNotes` (texto obrigatório), não um `confirmDialog` simples, porque a API exige essa informação:

```vue
<template>
  <AppLayout title="Ordens de Manutenção" subtitle="Acompanhe e execute as ordens de manutenção preventiva e corretiva">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Ordem Corretiva</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="mo-filter-equipment" label="Equipamento">
          <select
            v-model="filters.equipmentId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="eq in equipmentStore.equipment" :key="eq.id" :value="eq.id">{{ eq.code }} - {{ eq.name }}</option>
          </select>
        </FormField>
        <FormField id="mo-filter-type" label="Tipo">
          <select
            v-model="filters.type"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="PREVENTIVE">Preventiva</option>
            <option value="CORRECTIVE">Corretiva</option>
          </select>
        </FormField>
        <FormField id="mo-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendente</option>
            <option value="IN_PROGRESS">Em execução</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="orderList"
      :pagination="pagination"
      empty-title="Nenhuma ordem de manutenção encontrada"
      empty-hint="Ajuste os filtros ou abra uma nova ordem corretiva."
      @retry="loadOrders"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Ordem Corretiva</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Equipamento</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tipo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Descrição</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Responsável</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ asItem(item).equipment?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).type === 'PREVENTIVE' ? 'Preventiva' : 'Corretiva'"
            :tone="asItem(item).type === 'PREVENTIVE' ? 'info' : 'warning'"
          />
        </td>
        <td class="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{{ asItem(item).problemDescription || asItem(item).plan?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ asItem(item).assignee?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="statusLabel(asItem(item).status)" :tone="statusTone(asItem(item).status)" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button
            v-if="asItem(item).status === 'PENDING'"
            @click="handleStart(asItem(item))"
            class="text-primary-600 hover:text-primary-900"
          >
            Iniciar
          </button>
          <button
            v-if="asItem(item).status === 'IN_PROGRESS'"
            @click="openCompleteModal(asItem(item))"
            class="text-green-600 hover:text-green-900"
          >
            Concluir
          </button>
          <button
            v-if="asItem(item).status === 'PENDING' || asItem(item).status === 'IN_PROGRESS'"
            @click="handleCancel(asItem(item))"
            class="text-red-600 hover:text-red-900"
          >
            Cancelar
          </button>
        </td>
      </template>
    </DataTable>

    <AppModal v-model="showCreateModal" title="Nova Ordem Corretiva" @close="closeCreateModal">
      <form @submit.prevent="handleCreateSubmit" class="space-y-4">
        <FormField id="mo-form-equipment" label="Equipamento" required>
          <select v-model="createFormData.equipmentId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="eq in equipmentStore.equipment" :key="eq.id" :value="eq.id">{{ eq.code }} - {{ eq.name }}</option>
          </select>
        </FormField>

        <FormField id="mo-form-problem" label="Descrição do problema" required>
          <textarea v-model="createFormData.problemDescription" rows="3" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <FormField id="mo-form-assignee" label="Responsável">
          <select v-model="createFormData.assignedTo" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Sem responsável definido</option>
            <option v-for="user in users" :key="user.id" :value="user.id">{{ user.name }}</option>
          </select>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeCreateModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">Abrir Ordem</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showCompleteModal" title="Concluir Ordem de Manutenção" @close="closeCompleteModal">
      <form @submit.prevent="handleCompleteSubmit" class="space-y-4">
        <FormField id="mo-form-resolution" label="Solução aplicada" required>
          <textarea v-model="resolutionNotes" rows="3" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeCompleteModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">Concluir</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMaintenanceOrderStore } from '@/stores/maintenance-order.store'
import { useEquipmentStore } from '@/stores/equipment.store'
import userService, { type User } from '@/services/user.service'
import type { MaintenanceOrder, MaintenanceOrderStatus } from '@/services/maintenance-order.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const orderStore = useMaintenanceOrderStore()
const equipmentStore = useEquipmentStore()
const toast = useToast()

const orderList = ref<MaintenanceOrder[]>([])
const users = ref<User[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showCreateModal = ref(false)
const showCompleteModal = ref(false)
const completingOrder = ref<MaintenanceOrder | null>(null)
const resolutionNotes = ref('')
const filters = ref({ equipmentId: '', type: '', status: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const createFormData = ref({ equipmentId: '', problemDescription: '', assignedTo: '' })

const loadOrders = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await orderStore.fetchOrders(pagination.value.page, pagination.value.limit, {
      equipmentId: filters.value.equipmentId || undefined,
      type: (filters.value.type || undefined) as any,
      status: (filters.value.status || undefined) as any,
    })
    orderList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar ordens de manutenção'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadOrders() }
const changePage = (page: number) => { pagination.value.page = page; loadOrders() }

const openCreateModal = () => {
  createFormData.value = { equipmentId: '', problemDescription: '', assignedTo: '' }
  showCreateModal.value = true
}
const closeCreateModal = () => { showCreateModal.value = false }

const handleCreateSubmit = async () => {
  try {
    saving.value = true
    await orderStore.createOrder({
      equipmentId: createFormData.value.equipmentId,
      problemDescription: createFormData.value.problemDescription,
      assignedTo: createFormData.value.assignedTo || null,
    })
    toast.success('Ordem corretiva aberta com sucesso!')
    closeCreateModal()
    await loadOrders()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao abrir ordem corretiva')
  } finally {
    saving.value = false
  }
}

const handleStart = async (order: MaintenanceOrder) => {
  if (await confirmDialog(`Iniciar a ordem de manutenção do equipamento "${order.equipment?.name}"?`)) {
    try {
      await orderStore.startOrder(order.id)
      toast.success('Ordem iniciada!')
      await loadOrders()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao iniciar ordem')
    }
  }
}

const openCompleteModal = (order: MaintenanceOrder) => {
  completingOrder.value = order
  resolutionNotes.value = ''
  showCompleteModal.value = true
}
const closeCompleteModal = () => { showCompleteModal.value = false; completingOrder.value = null }

const handleCompleteSubmit = async () => {
  if (!completingOrder.value) return
  try {
    saving.value = true
    await orderStore.completeOrder(completingOrder.value.id, resolutionNotes.value)
    toast.success('Ordem concluída!')
    closeCompleteModal()
    await loadOrders()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao concluir ordem')
  } finally {
    saving.value = false
  }
}

const handleCancel = async (order: MaintenanceOrder) => {
  if (await confirmDialog(`Cancelar a ordem de manutenção do equipamento "${order.equipment?.name}"?`)) {
    try {
      await orderStore.cancelOrder(order.id)
      toast.success('Ordem cancelada!')
      await loadOrders()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao cancelar ordem')
    }
  }
}

const asItem = (item: unknown) => item as MaintenanceOrder

const statusLabel = (status: MaintenanceOrderStatus) => {
  const labels: Record<MaintenanceOrderStatus, string> = {
    PENDING: 'Pendente',
    IN_PROGRESS: 'Em execução',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  }
  return labels[status]
}

const statusTone = (status: MaintenanceOrderStatus): 'success' | 'warning' | 'danger' | 'info' => {
  const tones: Record<MaintenanceOrderStatus, 'success' | 'warning' | 'danger' | 'info'> = {
    PENDING: 'warning',
    IN_PROGRESS: 'info',
    COMPLETED: 'success',
    CANCELLED: 'danger',
  }
  return tones[status]
}

onMounted(async () => {
  await equipmentStore.fetchEquipment()
  const usersResult = await userService.getAll()
  users.value = usersResult.data
  await loadOrders()
})
</script>
```

- [ ] **Step 4: Teste da view**

Create `frontend/src/views/maintenance/__tests__/MaintenanceOrderListView.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import MaintenanceOrderListView from '../MaintenanceOrderListView.vue'
import maintenanceOrderService from '@/services/maintenance-order.service'
import equipmentService from '@/services/equipment.service'
import userService from '@/services/user.service'

vi.mock('@/services/maintenance-order.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), start: vi.fn(), complete: vi.fn(), cancel: vi.fn() },
}))

vi.mock('@/services/equipment.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/services/user.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

vi.mock('@/composables/useConfirm', () => ({
  confirmDialog: vi.fn().mockResolvedValue(true),
}))

const mockEquipment = { id: 'eq-1', code: 'EQP-001', name: 'Torno CNC 1', workCenterId: 'wc-1', active: true, createdAt: '', updatedAt: '' }

const mockOrderPending = {
  id: 'order-1',
  equipmentId: 'eq-1',
  planId: null,
  type: 'CORRECTIVE' as const,
  status: 'PENDING' as const,
  problemDescription: 'Ruído anormal',
  resolutionNotes: null,
  assignedTo: null,
  createdAt: '',
  startedAt: null,
  completedAt: null,
  equipment: { id: 'eq-1', code: 'EQP-001', name: 'Torno CNC 1' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/maintenance/orders', component: MaintenanceOrderListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('MaintenanceOrderListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(equipmentService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockEquipment], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(userService.getAll).mockResolvedValue({ status: 'success', data: [], pagination: {} } as any)
  })

  it('carrega e exibe a lista de ordens com o botão Iniciar para uma ordem PENDING', async () => {
    vi.mocked(maintenanceOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockOrderPending], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/maintenance/orders')
    await router.isReady()

    const wrapper = mount(MaintenanceOrderListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Torno CNC 1')
    expect(wrapper.text()).toContain('Ruído anormal')
    expect(wrapper.text()).toContain('Iniciar')
    expect(wrapper.text()).not.toContain('Concluir')
  })

  it('chama startOrder ao clicar em Iniciar', async () => {
    vi.mocked(maintenanceOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockOrderPending], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(maintenanceOrderService.start).mockResolvedValue({ data: { status: 'success', data: {} } } as any)

    const router = makeRouter()
    router.push('/maintenance/orders')
    await router.isReady()

    const wrapper = mount(MaintenanceOrderListView, { global: { plugins: [router] } })
    await flushPromises()

    const startButton = wrapper.findAll('button').find((b) => b.text() === 'Iniciar')!
    await startButton.trigger('click')
    await flushPromises()

    expect(maintenanceOrderService.start).toHaveBeenCalledWith('order-1')
  })

  it('abre uma ordem corretiva pelo formulário', async () => {
    vi.mocked(maintenanceOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(maintenanceOrderService.create).mockResolvedValue({ data: { status: 'success', data: mockOrderPending } } as any)

    const router = makeRouter()
    router.push('/maintenance/orders')
    await router.isReady()

    const wrapper = mount(MaintenanceOrderListView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('button:not([type="submit"])').trigger('click') // "+ Nova Ordem Corretiva"
    await wrapper.vm.$nextTick()

    await wrapper.find('#mo-form-equipment').setValue('eq-1')
    await wrapper.find('#mo-form-problem').setValue('Vazamento de óleo')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(maintenanceOrderService.create).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentId: 'eq-1', problemDescription: 'Vazamento de óleo' })
    )
  })
})
```

- [ ] **Step 5: Rodar os testes**

Run: `cd frontend && npx vitest run src/views/maintenance/__tests__/MaintenanceOrderListView.spec.ts`
Expected: 3/3 passando.

- [ ] **Step 6: Rodar a suíte completa + type-check**

Run: `cd frontend && npm test`
Expected: baseline (após Task 8) + 3.

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: 48 + 1 (só falta `MaintenanceKpiDashboardView.vue`, criado na Task 10).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/maintenance-order.service.ts frontend/src/stores/maintenance-order.store.ts frontend/src/views/maintenance/MaintenanceOrderListView.vue frontend/src/views/maintenance/__tests__/MaintenanceOrderListView.spec.ts
git commit -m "feat(manutencao): adiciona listagem e ciclo de vida de Ordens de Manutencao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Frontend — Dashboard de KPIs de Manutenção (nativo em dark mode)

**Files:**
- Create: `frontend/src/services/maintenance-kpi.service.ts`
- Create: `frontend/src/views/maintenance/MaintenanceKpiDashboardView.vue`
- Test: `frontend/src/views/maintenance/__tests__/MaintenanceKpiDashboardView.spec.ts`

**Interfaces:**
- Consumes: `GET /maintenance/kpis` (Task 6); `useThemeStore` (`frontend/src/stores/theme.store.ts`, já existente desde a Fase 1 do dark mode — `isDark` usado para colorir os gráficos Chart.js, mesmo padrão de `WmsKpiDashboardView.vue`).
- Produces: nenhuma outra task depende deste arquivo — última peça do módulo.

- [ ] **Step 1: `maintenance-kpi.service.ts`**

Create `frontend/src/services/maintenance-kpi.service.ts`:

```typescript
import api from './api.service'

export interface MtbfEntry {
  equipmentId: string
  equipmentCode: string
  equipmentName: string
  mtbfHours: number | null
}

export interface OrdersByStatusAndType {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  type: 'PREVENTIVE' | 'CORRECTIVE'
  count: number
}

export interface MaintenanceKpis {
  mttrHours: number | null
  mtbfByEquipment: MtbfEntry[]
  preventiveComplianceRate: number
  ordersByStatusAndType: OrdersByStatusAndType[]
}

class MaintenanceKpiService {
  async getKpis() {
    return api.get('/maintenance/kpis')
  }
}

export default new MaintenanceKpiService()
```

- [ ] **Step 2: `MaintenanceKpiDashboardView.vue`**

Create `frontend/src/views/maintenance/MaintenanceKpiDashboardView.vue`. Estrutura: 3 cards de estatística (MTTR, Taxa de cumprimento preventivo, Ordens abertas) + 1 gráfico de barras empilhadas (ordens por status, uma série por tipo) + 1 tabela de MTBF por equipamento. Já nasce com `dark:` (receita do spec do dark mode) e com o mesmo mecanismo de recoloração de gráfico Chart.js reativo ao tema que `WmsKpiDashboardView.vue` já usa:

```vue
<template>
  <AppLayout title="Dashboard de KPIs de Manutenção" subtitle="MTTR, MTBF, cumprimento do preventivo e ordens em aberto">
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">Carregando dashboard...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center dark:bg-red-950 dark:border-red-900">
      <p class="text-red-600 dark:text-red-400">{{ error }}</p>
      <Button @click="loadKpis" class="mt-4">Tentar Novamente</Button>
    </div>

    <div v-else>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
          <p class="text-sm text-gray-600 dark:text-gray-400">MTTR (tempo médio de reparo)</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {{ kpis?.mttrHours != null ? `${kpis.mttrHours}h` : '-' }}
          </p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
          <p class="text-sm text-gray-600 dark:text-gray-400">Cumprimento do preventivo</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ kpis?.preventiveComplianceRate ?? 0 }}%</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
          <p class="text-sm text-gray-600 dark:text-gray-400">Ordens abertas (pendente + em execução)</p>
          <p class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ openOrdersCount }}</p>
        </div>
      </div>

      <Card title="Ordens por status e tipo" class="mb-4">
        <div class="h-72"><canvas ref="ordersChartRef"></canvas></div>
      </Card>

      <Card title="MTBF por equipamento (horas entre falhas)">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead>
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">Equipamento</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase dark:text-gray-400">MTBF</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="entry in kpis?.mtbfByEquipment ?? []" :key="entry.equipmentId">
              <td class="px-4 py-2">{{ entry.equipmentCode }} - {{ entry.equipmentName }}</td>
              <td class="px-4 py-2">{{ entry.mtbfHours != null ? `${entry.mtbfHours}h` : 'Dado insuficiente' }}</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import maintenanceKpiService from '@/services/maintenance-kpi.service'
import type { MaintenanceKpis } from '@/services/maintenance-kpi.service'
import Chart from 'chart.js/auto'
import { useThemeStore } from '@/stores/theme.store'

const themeStore = useThemeStore()
const chartTextColor = computed(() => (themeStore.isDark ? '#e5e7eb' : '#374151'))
const chartGridColor = computed(() => (themeStore.isDark ? '#374151' : '#e5e7eb'))

const loading = ref(true)
const error = ref('')
const kpis = ref<MaintenanceKpis | null>(null)

const openOrdersCount = computed(() => {
  const rows = kpis.value?.ordersByStatusAndType ?? []
  return rows
    .filter((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS')
    .reduce((sum, r) => sum + r.count, 0)
})

const ordersChartRef = ref<HTMLCanvasElement | null>(null)
let ordersChart: Chart | null = null

function destroyChart(): void {
  ordersChart?.destroy()
}

function createChart(): void {
  destroyChart()
  if (!ordersChartRef.value || !kpis.value) return

  const rows = kpis.value.ordersByStatusAndType
  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
  const statusLabels: Record<string, string> = {
    PENDING: 'Pendente',
    IN_PROGRESS: 'Em execução',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  }
  const types = ['PREVENTIVE', 'CORRECTIVE']
  const typeLabels: Record<string, string> = { PREVENTIVE: 'Preventiva', CORRECTIVE: 'Corretiva' }
  const typeColors: Record<string, string> = { PREVENTIVE: '#3B82F6', CORRECTIVE: '#F59E0B' }

  ordersChart = new Chart(ordersChartRef.value, {
    type: 'bar',
    data: {
      labels: statuses.map((s) => statusLabels[s]),
      datasets: types.map((type) => ({
        label: typeLabels[type],
        data: statuses.map((status) => rows.find((r) => r.status === status && r.type === type)?.count ?? 0),
        backgroundColor: typeColors[type],
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, ticks: { color: chartTextColor.value }, grid: { color: chartGridColor.value } },
        y: { stacked: true, beginAtZero: true, ticks: { color: chartTextColor.value }, grid: { color: chartGridColor.value } },
      },
      plugins: { legend: { labels: { color: chartTextColor.value } } },
    },
  })
}

async function loadKpis(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const response = await maintenanceKpiService.getKpis()
    kpis.value = response.data.data
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao carregar KPIs de manutenção'
  } finally {
    loading.value = false
    setTimeout(createChart, 100)
  }
}

watch(
  () => themeStore.isDark,
  () => {
    if (!loading.value) createChart()
  }
)

onMounted(loadKpis)
onUnmounted(destroyChart)
</script>
```

- [ ] **Step 3: Teste da view**

Create `frontend/src/views/maintenance/__tests__/MaintenanceKpiDashboardView.spec.ts`, mesmo padrão de mock de Chart.js já usado em `WmsKpiDashboardView.spec.ts` (captura a config em vez de renderizar de verdade, porque jsdom não tem contexto 2D real):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import MaintenanceKpiDashboardView from '../MaintenanceKpiDashboardView.vue'
import maintenanceKpiService from '@/services/maintenance-kpi.service'

vi.mock('@/services/maintenance-kpi.service', () => ({
  default: { getKpis: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: vi.fn(() => ({ mode: 'system', isDark: false, setMode: vi.fn() })),
}))

const { chartInstances, MockChart } = vi.hoisted(() => {
  const instances: any[] = []
  class MockChart {
    config: any
    destroy = vi.fn()
    constructor(_target: unknown, config: any) {
      this.config = config
      instances.push(this)
    }
  }
  return { chartInstances: instances, MockChart }
})

vi.mock('chart.js/auto', () => ({ default: MockChart }))

const mockKpis = {
  mttrHours: 3.5,
  preventiveComplianceRate: 80,
  mtbfByEquipment: [
    { equipmentId: 'eq-1', equipmentCode: 'EQP-001', equipmentName: 'Torno CNC 1', mtbfHours: 120 },
    { equipmentId: 'eq-2', equipmentCode: 'EQP-002', equipmentName: 'Prensa 1', mtbfHours: null },
  ],
  ordersByStatusAndType: [
    { status: 'PENDING', type: 'CORRECTIVE', count: 2 },
    { status: 'IN_PROGRESS', type: 'PREVENTIVE', count: 1 },
    { status: 'COMPLETED', type: 'PREVENTIVE', count: 5 },
  ],
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/maintenance/kpis', component: MaintenanceKpiDashboardView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('MaintenanceKpiDashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chartInstances.length = 0
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('carrega e exibe os KPIs de manutenção', async () => {
    vi.mocked(maintenanceKpiService.getKpis).mockResolvedValue({ data: { status: 'success', data: mockKpis } } as any)

    const router = makeRouter()
    router.push('/maintenance/kpis')
    await router.isReady()

    const wrapper = mount(MaintenanceKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('3.5h')
    expect(wrapper.text()).toContain('80%')
    expect(wrapper.text()).toContain('Torno CNC 1')
    expect(wrapper.text()).toContain('Dado insuficiente')
  })

  it('soma PENDING + IN_PROGRESS para "Ordens abertas"', async () => {
    vi.mocked(maintenanceKpiService.getKpis).mockResolvedValue({ data: { status: 'success', data: mockKpis } } as any)

    const router = makeRouter()
    router.push('/maintenance/kpis')
    await router.isReady()

    const wrapper = mount(MaintenanceKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Ordens abertas (pendente + em execução)')
    // 2 (PENDING/CORRECTIVE) + 1 (IN_PROGRESS/PREVENTIVE) = 3; COMPLETED não conta.
    const card = wrapper.findAll('.bg-white').find((c) => c.text().includes('Ordens abertas'))!
    expect(card.text()).toContain('3')
  })

  it('monta o gráfico com as 4 colunas de status e datasets por tipo', async () => {
    vi.mocked(maintenanceKpiService.getKpis).mockResolvedValue({ data: { status: 'success', data: mockKpis } } as any)

    const router = makeRouter()
    router.push('/maintenance/kpis')
    await router.isReady()

    mount(MaintenanceKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()
    vi.advanceTimersByTime(100)
    await flushPromises()

    expect(chartInstances).toHaveLength(1)
    const [chart] = chartInstances
    expect(chart.config.data.labels).toEqual(['Pendente', 'Em execução', 'Concluída', 'Cancelada'])
    const datasets = Object.fromEntries(chart.config.data.datasets.map((d: any) => [d.label, d.data]))
    expect(datasets['Corretiva']).toEqual([2, 0, 0, 0])
    expect(datasets['Preventiva']).toEqual([0, 1, 5, 0])
  });

  it('usa cores claras no gráfico quando o tema está escuro', async () => {
    vi.mocked(maintenanceKpiService.getKpis).mockResolvedValue({ data: { status: 'success', data: mockKpis } } as any)
    vi.mocked(useThemeStore).mockReturnValue({ mode: 'dark', isDark: true, setMode: vi.fn() } as any)

    const router = makeRouter()
    router.push('/maintenance/kpis')
    await router.isReady()

    mount(MaintenanceKpiDashboardView, { global: { plugins: [router] } })
    await flushPromises()
    vi.advanceTimersByTime(100)
    await flushPromises()

    const [chart] = chartInstances
    expect(chart.config.options.scales.x.ticks.color).toBe('#e5e7eb')
    expect(chart.config.options.scales.x.grid.color).toBe('#374151')
  })
})
```

Este arquivo precisa importar `useThemeStore` no topo (`import { useThemeStore } from '@/stores/theme.store'`) para o último teste poder chamar `vi.mocked(useThemeStore).mockReturnValue(...)` — adicione o import junto aos outros.

- [ ] **Step 4: Rodar os testes**

Run: `cd frontend && npx vitest run src/views/maintenance/__tests__/MaintenanceKpiDashboardView.spec.ts`
Expected: 4/4 passando.

- [ ] **Step 5: Rodar a suíte completa + type-check (agora sem nenhuma rota pendente)**

Run: `cd frontend && npm test`
Expected: baseline (após Task 9) + 4.

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: de volta a 48 erros (baseline original) — as 4 rotas de `router/index.ts` agora resolvem para arquivos reais.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/maintenance-kpi.service.ts frontend/src/views/maintenance/MaintenanceKpiDashboardView.vue frontend/src/views/maintenance/__tests__/MaintenanceKpiDashboardView.spec.ts
git commit -m "feat(manutencao): adiciona dashboard de KPIs (MTTR/MTBF), nativo em dark mode

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Verificação end-to-end real

**Files:** nenhum (task de verificação, sem mudança de código).

**Interfaces:** nenhuma.

- [ ] **Step 1: Ambiente**

Confirme (peça aprovação explícita do usuário antes de recriar containers, mesmo padrão já usado neste projeto): os containers `fabric-backend`/`fabric-frontend` precisam estar rodando o código deste worktree/branch, não o checkout `main`. Se estiverem apontando para `main`, recrie com:

```bash
docker compose -f <worktree>/docker-compose.yml -f <worktree>/docker-compose.ai.yml -p fabric up -d --force-recreate backend frontend
```

- [ ] **Step 2: Migração + seed no banco real**

Dentro do container (ou via host apontando para o banco de dev real):

```bash
npx prisma migrate deploy
npm run prisma:seed
```

Expected: sem erros; log do seed lista `MANUTENCAO=on`.

- [ ] **Step 3: Fluxo completo via UI real (login como admin)**

1. Login como `admin@fabric.com`. Confirme que a aba "Manutenção" aparece no Dashboard.
2. `/maintenance/equipment`: criar um Centro de Trabalho de teste primeiro se necessário (via `/work-centers`), depois criar um Equipamento vinculado a ele.
3. `/maintenance/plans`: criar um Plano de Manutenção para esse equipamento com `frequencyDays` pequeno (ex.: 1) — anote que `nextDueDate` calculado é "hoje + 1 dia" (ainda não vencido).
4. `/maintenance/orders`: abrir uma Ordem Corretiva manual para o mesmo equipamento, com uma descrição de problema. Confirmar que aparece na lista com status "Pendente" e botão "Iniciar".
5. Clicar "Iniciar" — confirmar transição para "Em execução" e que o botão vira "Concluir".
6. Clicar "Concluir", preencher a solução aplicada — confirmar transição para "Concluída".
7. `/maintenance/kpis`: confirmar que o dashboard carrega sem erro (MTTR pode aparecer com valor real agora, já que existe 1 ordem COMPLETED com `startedAt`/`completedAt`; MTBF continua "Dado insuficiente" para esse equipamento, já que só há 1 corretiva no histórico — são necessárias 2 para calcular).

- [ ] **Step 4: Geração automática de preventiva (via execução manual do job)**

Como o job só roda automaticamente às 6h, force uma execução manual para confirmar o comportamento sem esperar até o dia seguinte. Dentro do container `fabric-backend`:

```bash
docker exec fabric-backend node -e "require('./dist/jobs/maintenance.job').default.runManually().then(() => process.exit(0))"
```

(Se o projeto rodar via `ts-node`/`tsx` em dev em vez de `dist/` compilado, ajuste o comando para o entrypoint real usado em desenvolvimento — verifique `package.json`'s `scripts.dev` antes de rodar.)

Como o plano criado no Step 3 tem `nextDueDate` no futuro (frequência de 1 dia, criado hoje), ele NÃO deve gerar ordem ainda nesta execução — esse é o resultado esperado e correto, não uma falha. Para testar a geração de fato, edite o plano via UI (`/maintenance/plans`, "Editar") mudando a frequência para forçar uma data vencida não é possível pelo formulário atual (não há campo de `nextDueDate` editável na UI, só `frequencyDays` — ver Task 8, nota de escopo). Em vez disso, valide a geração automática pelo teste automatizado já escrito na Task 5 (`maintenance.job.test.ts`), que cobre exatamente esse caminho manipulando `nextDueDate` direto no banco de teste — não é necessário repetir manualmente aqui.

- [ ] **Step 5: RBAC negativo**

Crie temporariamente um usuário/papel sem a permissão `modules.view_manutencao` (ou remova-a temporariamente de um papel de teste) e confirme que a aba "Manutenção" não aparece no Dashboard para esse usuário. Restaure a permissão depois do teste.

- [ ] **Step 6: Licenciamento negativo**

Via um script ou console do Prisma Studio, defina `LicensedModule.enabled = false` para `code = 'MANUTENCAO'`, reinicie o backend (para recarregar o cache — ou chame `reloadLicensedModules()` se houver um endpoint/script para isso) e confirme que `GET /api/v1/equipment` retorna 404 mesmo para um usuário com todas as permissões RBAC de manutenção. Restaure `enabled = true` depois do teste.

- [ ] **Step 7: Relato final**

Sem commit neste task. Relate o resultado de cada step acima. Se algum problema for encontrado, corrija como um commit pequeno e focado no arquivo/comportamento específico identificado, e re-rode o step afetado.

---

## Pós-plano: o que ainda fica pendente da Fase 4

Este plano cobre só o subsistema de Manutenção — o primeiro dos 3 decompostos no brainstorm (`docs/superpowers/specs/2026-09-07-manutencao-fase4-design.md`). Qualidade (inspeções, não-conformidades, ações corretivas) e Indicadores/Relatórios (motor de KPI genérico + exportação PDF/Excel) continuam como itens de fila separados, cada um com seu próprio ciclo spec → plano → implementação quando for a vez deles.
