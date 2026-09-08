# YMS — Cadastros Base (Docas, Motoristas/Veículos/Frotas, Parâmetros) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir os cadastros base do YMS (Yard Management System): Docas (`YardDock`, vinculadas opcionalmente a `StoragePosition` do WMS), Motoristas (`Driver`), Veículos (`Vehicle`) e Frotas (`Fleet`) — todos vinculados a `Supplier` — e Parâmetros de Pátio por Armazém (`YardWarehouseParams`), incluindo licenciamento de módulo, RBAC e as 4 telas de frontend.

**Architecture:** Segue exatamente os padrões já estabelecidos no backend Express+Prisma (service/controller/routes/validator por recurso, RBAC via `requirePermission`, licenciamento via `requireModule`) e no frontend Vue3+Pinia (service/store/view por recurso, `DataTable.vue`+`AppModal.vue` para CRUD), mesmo padrão visual de `EquipmentListView.vue`/`WorkCentersView.vue`. `YardDock` referencia opcionalmente uma `StoragePosition` já existente do WMS (mesmo endereço físico) em vez de duplicar cadastro.

**Tech Stack:** Node.js + TypeScript + Express + Prisma + MySQL (backend), Vue 3 Composition API + Pinia + TailwindCSS (frontend), Jest (backend tests), Vitest (frontend tests).

> **Retroagido em 2026-09-08, durante a Etapa 5 (Dashboard/KPIs):** `Vehicle` ganhou o campo opcional `model` (marca/modelo, ex. "Volvo FH") — a grade detalhada do dashboard da Etapa 5 precisa exibir isso, e como esta etapa ainda não tinha sido implementada, foi mais barato corrigir aqui do que criar uma migration extra depois. Já refletido no schema (Task 1) e na Task 5 (backend + frontend de Veículos) deste documento.

## Global Constraints

- YMS é um **módulo licenciável por instalação** (como WMS/Compras/Manutenção) — toda rota nova é montada com `requireModule('YMS')` no ponto de mount (`routes/index.ts`), nunca rota a rota. `'YMS'` já está em `MODULE_CODES` (`backend/src/services/licensed-module.service.ts:24`) — não precisa ser adicionado.
- RBAC: recurso `yard` com ações `visualizar` (leitura) e `gerenciar` (CRUD de docas/motoristas/veículos/frotas, bloquear/desbloquear, editar parâmetros). Permissão de módulo `modules.view_yms` **já existe no seed** (`backend/prisma/seed.ts:194`) e já está atribuída a ADMIN/MANAGER — não precisa ser criada.
- `YardDock.storagePositionId` é vínculo **opcional** a uma `StoragePosition` existente do WMS (mesmo endereço físico) — nunca um campo obrigatório, nunca uma extensão de `StoragePosition`.
- `Vehicle.fleetId`, se informado, DEVE referenciar uma `Fleet` do MESMO `supplierId` do veículo — validado no service (Prisma não expressa FK cruzada condicional), erro 400 claro se violado.
- Placa de veículo aceita 2 formatos, sem hífen: Mercosul (`/^[A-Z]{3}\d[A-Z]\d{2}$/`, ex. `ABC1D23`) e antigo (`/^[A-Z]{3}\d{4}$/`, ex. `ABC1234`) — normalizada para maiúsculas antes de validar/salvar.
- `YardWarehouseParams` é 1:1 com `Warehouse` (`warehouseId @unique`) — parâmetros por armazém, nunca uma configuração global única.
- Auditoria de mudança de parâmetros **não precisa de tabela nova** — `AuditLog` + `audit.middleware.ts` já capturam usuário/data/valor antigo/valor novo automaticamente em rotas mutantes.
- Bloqueio de motorista/veículo/frota é um campo `blocked: boolean` + `blockedReason: string?` na própria entidade — bloquear uma `Fleet` bloqueia implicitamente todos os `Vehicle`s vinculados a ela (checado na leitura/validação, nunca duplicado como campo em cada veículo).
- Migrations: gerar contra o banco de DEV (`.env`, não `.env.test`) via `npx prisma migrate dev --name <nome>` a partir do diretório `backend`. Depois de mesclar novos models, sempre rodar `npx prisma generate` antes de qualquer outro comando.
- Toda tela nova nasce com suporte a dark mode desde o primeiro commit (`dark:` classes já presentes), usando a receita documentada em `docs/superpowers/specs/2026-09-07-dark-mode-fase1-design.md` — não é um retrofit posterior.
- Fora de escopo (não implementar nesta rodada, ver spec seção 2.5): agendamento/check-in, alocação de vaga de pátio, status operacional de doca (OC/DP), dashboard/KPIs do YMS, restrição de visibilidade por planta (usuário↔armazém).

---

### Task 1: Schema Prisma + licenciamento de módulo + RBAC

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Consumes: `Warehouse`, `Supplier`, `StoragePosition` (models já existentes).
- Produces: models `YardWarehouseParams`, `YardDock`, `Fleet`, `Driver`, `Vehicle` e enums `DockServiceType`, `VehicleType`, usados por todas as tasks seguintes. Permissões `yard:visualizar`/`yard:gerenciar` no banco, usadas pelas rotas das Tasks 2-6.

- [ ] **Step 1: Adicionar os models e enums ao schema**

Em `backend/prisma/schema.prisma`, adicionar ao final do arquivo:

```prisma
enum DockServiceType {
  RECEBIMENTO
  EXPEDICAO
  MULTIUSO
}

enum VehicleType {
  TRUCK
  TOCO
  CAVALO
  MECANICO
  VAN
  UTILITARIO
  OUTROS
}

model YardWarehouseParams {
  id                    String   @id @default(uuid())
  warehouseId           String   @unique
  useYard               Boolean  @default(true)
  delayToleranceMinutes Int      @default(15)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  warehouse Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)

  @@map("yard_warehouse_params")
}

model YardDock {
  id                String          @id @default(uuid())
  code              String
  serviceType       DockServiceType
  warehouseId       String
  storagePositionId String?         @unique
  active            Boolean         @default(true)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  warehouse       Warehouse        @relation(fields: [warehouseId], references: [id])
  storagePosition StoragePosition? @relation(fields: [storagePositionId], references: [id], onDelete: SetNull)

  @@unique([warehouseId, code])
  @@map("yard_docks")
}

model Fleet {
  id            String   @id @default(uuid())
  name          String
  supplierId    String
  blocked       Boolean  @default(false)
  blockedReason String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  supplier Supplier  @relation(fields: [supplierId], references: [id])
  vehicles Vehicle[]

  @@map("fleets")
}

model Driver {
  id            String   @id @default(uuid())
  name          String
  cpf           String   @unique
  supplierId    String
  blocked       Boolean  @default(false)
  blockedReason String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  supplier Supplier @relation(fields: [supplierId], references: [id])

  @@map("drivers")
}

model Vehicle {
  id            String      @id @default(uuid())
  plate         String      @unique
  type          VehicleType
  model         String?
  supplierId    String
  fleetId       String?
  blocked       Boolean     @default(false)
  blockedReason String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  supplier Supplier @relation(fields: [supplierId], references: [id])
  fleet    Fleet?   @relation(fields: [fleetId], references: [id], onDelete: SetNull)

  @@map("vehicles")
}
```

- [ ] **Step 2: Adicionar as relações reversas nos models existentes**

Em `backend/prisma/schema.prisma`, no model `Warehouse` (linha ~1341-1364), adicionar dentro do corpo do model, junto ao campo `structures` já existente:

```prisma
  yardParams YardWarehouseParams?
  yardDocks  YardDock[]
```

No model `Supplier`, adicionar:

```prisma
  fleets   Fleet[]
  drivers  Driver[]
  vehicles Vehicle[]
```

No model `StoragePosition` (linha ~1393-1450), adicionar:

```prisma
  yardDock YardDock?
```

- [ ] **Step 3: Gerar e aplicar a migration no banco de DEV**

A partir do diretório `backend`:

```bash
npx prisma migrate dev --name add_yms_cadastros_base
```

Esperado: migration criada e aplicada sem erro, todos os models novos e as relações reversas refletidas no `WHERE` gerado.

- [ ] **Step 4: Regenerar o Prisma Client**

```bash
npx prisma generate
```

- [ ] **Step 5: Habilitar o módulo YMS no seed (ambiente de dev)**

Em `backend/prisma/seed.ts`, no array `licensedModules` (linha ~38-44), trocar:

```typescript
    { code: 'YMS', enabled: false, core: false },
```

por:

```typescript
    { code: 'YMS', enabled: true, core: false },
```

- [ ] **Step 6: Adicionar as permissões RBAC do recurso `yard`**

Em `backend/prisma/seed.ts`, no array `permissions` (mesma seção onde está `{ resource: 'manutencao', action: 'visualizar', ... }`, linha ~152), adicionar:

```typescript
    { resource: 'yard', action: 'visualizar', description: 'Visualizar docas, motoristas, veículos e frotas do pátio' },
    { resource: 'yard', action: 'gerenciar', description: 'Gerenciar docas, motoristas, veículos, frotas e parâmetros de pátio' },
```

- [ ] **Step 7: Atribuir as permissões a MANAGER e OPERATOR**

Em `backend/prisma/seed.ts`, no `managerPermissions` (linha ~493-528), adicionar (junto a `manutencao: ['visualizar', 'executar', 'gerenciar'],`):

```typescript
    yard: ['visualizar', 'gerenciar'],
```

No `operatorPermissions` (linha ~530-562), adicionar:

```typescript
    yard: ['visualizar'],
```

- [ ] **Step 8: Rodar o seed e verificar**

Dentro do container `fabric-backend` (ou host, se apontar pro banco de dev real):

```bash
npm run prisma:seed
```

Esperado: log confirma `YMS=on` na linha de módulos licenciados, sem erros.

- [ ] **Step 9: Rodar a suíte de integração para confirmar não-regressão**

```bash
npm run test:integration
```

Esperado: nenhuma queda em relação à baseline atual (mudança é só schema/seed, zero testes novos esperados nesta task — mesmo padrão da Task 1 do plano de Manutenção).

- [ ] **Step 10: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/seed.ts backend/prisma/migrations
git commit -m "feat(yms): adiciona schema, licenciamento de módulo e RBAC"
```

---

### Task 2: Backend — CRUD de YardDock (Docas)

**Files:**
- Create: `backend/src/services/yard-dock.service.ts`
- Create: `backend/src/controllers/yard-dock.controller.ts`
- Create: `backend/src/routes/yard-dock.routes.ts`
- Create: `backend/src/validators/yard-dock.validator.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/yard-dock.service.test.ts`

**Interfaces:**
- Consumes: `prisma.warehouse`, `prisma.storagePosition` (já existentes); `helpers/fixtures.ts::createTestPositions` (já existente, cria `Warehouse`+`WarehouseStructure`+`StoragePosition`, aceita `positionType` como opção).
- Produces: `YardDockService` (`create`, `getAll`, `getById`, `update`, `delete`), montado em `/yard-docks`. Nenhuma outra task deste plano depende deste arquivo (Driver/Fleet/Vehicle são independentes; Vehicle não referencia doca).

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/tests/services/yard-dock.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestPositions } from '../helpers/fixtures';
import yardDockService from '../../src/services/yard-dock.service';

describe('YardDockService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria uma doca sem vínculo com StoragePosition', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });

    const dock = await yardDockService.create({
      code: 'DOCA-01',
      serviceType: 'RECEBIMENTO',
      warehouseId: warehouse.id,
    });

    expect(dock.code).toBe('DOCA-01');
    expect(dock.storagePositionId).toBeNull();
    expect(dock.active).toBe(true);
  });

  it('cria uma doca vinculada a uma StoragePosition existente do tipo DOCA', async () => {
    const { warehouse, positions } = await createTestPositions(1, { positionType: 'DOCA' });

    const dock = await yardDockService.create({
      code: 'DOCA-02',
      serviceType: 'EXPEDICAO',
      warehouseId: warehouse.id,
      storagePositionId: positions[0].id,
    });

    expect(dock.storagePositionId).toBe(positions[0].id);
  });

  it('rejeita vincular a uma StoragePosition que não é do tipo DOCA', async () => {
    const { warehouse, positions } = await createTestPositions(1, { positionType: 'PORTA_PALETES' });

    await expect(
      yardDockService.create({
        code: 'DOCA-03',
        serviceType: 'MULTIUSO',
        warehouseId: warehouse.id,
        storagePositionId: positions[0].id,
      })
    ).rejects.toThrow('A posição informada não é do tipo DOCA');
  });

  it('rejeita código de doca duplicado no mesmo armazém', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    await yardDockService.create({ code: 'DOCA-04', serviceType: 'RECEBIMENTO', warehouseId: warehouse.id });

    await expect(
      yardDockService.create({ code: 'DOCA-04', serviceType: 'EXPEDICAO', warehouseId: warehouse.id })
    ).rejects.toThrow('Já existe uma doca com este código neste armazém');
  });

  it('permite o mesmo código de doca em armazéns diferentes', async () => {
    const { warehouse: wh1 } = await createTestPositions(1, { positionType: 'DOCA' });
    const { warehouse: wh2 } = await createTestPositions(1, { positionType: 'DOCA' });
    await yardDockService.create({ code: 'DOCA-05', serviceType: 'RECEBIMENTO', warehouseId: wh1.id });

    await expect(
      yardDockService.create({ code: 'DOCA-05', serviceType: 'RECEBIMENTO', warehouseId: wh2.id })
    ).resolves.toBeDefined();
  });

  it('lista docas filtrando por armazém', async () => {
    const { warehouse: wh1 } = await createTestPositions(1, { positionType: 'DOCA' });
    const { warehouse: wh2 } = await createTestPositions(1, { positionType: 'DOCA' });
    await yardDockService.create({ code: 'DOCA-A', serviceType: 'RECEBIMENTO', warehouseId: wh1.id });
    await yardDockService.create({ code: 'DOCA-B', serviceType: 'RECEBIMENTO', warehouseId: wh2.id });

    const result = await yardDockService.getAll(1, 100, { warehouseId: wh1.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].code).toBe('DOCA-A');
  });

  it('toggleActive-like: update altera active', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    const dock = await yardDockService.create({ code: 'DOCA-06', serviceType: 'RECEBIMENTO', warehouseId: warehouse.id });

    const updated = await yardDockService.update(dock.id, { active: false });
    expect(updated.active).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```bash
npm run test:integration -- yard-dock.service.test.ts
```

Esperado: FAIL (`Cannot find module '../../src/services/yard-dock.service'`).

- [ ] **Step 3: `yard-dock.validator.ts`**

Criar `backend/src/validators/yard-dock.validator.ts`:

```typescript
import Joi from 'joi';

export const createYardDockSchema = Joi.object({
  code: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Código é obrigatório',
    'any.required': 'Código é obrigatório',
  }),
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO').required().messages({
    'any.only': 'Tipo de serviço inválido',
    'any.required': 'Tipo de serviço é obrigatório',
  }),
  warehouseId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do armazém inválido',
    'any.required': 'Armazém é obrigatório',
  }),
  storagePositionId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID da posição de armazenagem inválido',
  }),
  active: Joi.boolean().default(true),
});

export const updateYardDockSchema = Joi.object({
  code: Joi.string().trim().min(1),
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO').messages({
    'any.only': 'Tipo de serviço inválido',
  }),
  storagePositionId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID da posição de armazenagem inválido',
  }),
  active: Joi.boolean(),
}).min(1);

export const listYardDockQuerySchema = Joi.object({
  warehouseId: Joi.string().uuid(),
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO'),
  active: Joi.boolean(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
```

- [ ] **Step 4: `yard-dock.service.ts`**

Criar `backend/src/services/yard-dock.service.ts`:

```typescript
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateYardDockDto {
  code: string;
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  warehouseId: string;
  storagePositionId?: string | null;
  active?: boolean;
}

export interface UpdateYardDockDto extends Partial<Omit<CreateYardDockDto, 'warehouseId'>> {}

export interface YardDockFilters {
  warehouseId?: string;
  serviceType?: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  active?: boolean;
}

const assertWarehouseExists = async (warehouseId: string) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    throw new AppError(400, 'Armazém informado não existe');
  }
};

const assertStoragePositionIsDock = async (storagePositionId: string) => {
  const position = await prisma.storagePosition.findUnique({ where: { id: storagePositionId } });
  if (!position) {
    throw new AppError(400, 'Posição de armazenagem informada não existe');
  }
  if (position.positionType !== 'DOCA') {
    throw new AppError(400, 'A posição informada não é do tipo DOCA');
  }
};

const assertCodeUniqueInWarehouse = async (warehouseId: string, code: string, excludeId?: string) => {
  const existing = await prisma.yardDock.findFirst({
    where: { warehouseId, code, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new AppError(400, 'Já existe uma doca com este código neste armazém');
  }
};

export class YardDockService {
  async create(data: CreateYardDockDto) {
    await assertWarehouseExists(data.warehouseId);
    if (data.storagePositionId) {
      await assertStoragePositionIsDock(data.storagePositionId);
    }
    await assertCodeUniqueInWarehouse(data.warehouseId, data.code);
    return prisma.yardDock.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: YardDockFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters?.serviceType) where.serviceType = filters.serviceType;
    if (filters?.active !== undefined) where.active = filters.active;

    const [docks, total] = await Promise.all([
      prisma.yardDock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          storagePosition: { select: { id: true, code: true } },
        },
      }),
      prisma.yardDock.count({ where }),
    ]);

    return { data: docks, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.yardDock.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        storagePosition: { select: { id: true, code: true } },
      },
    });
  }

  async update(id: string, data: UpdateYardDockDto) {
    const current = await prisma.yardDock.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Doca não encontrada');

    if (data.storagePositionId) {
      await assertStoragePositionIsDock(data.storagePositionId);
    }
    if (data.code) {
      await assertCodeUniqueInWarehouse(current.warehouseId, data.code, id);
    }
    return prisma.yardDock.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.yardDock.delete({ where: { id } });
  }
}

export default new YardDockService();
```

- [ ] **Step 5: `yard-dock.controller.ts`**

Criar `backend/src/controllers/yard-dock.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import yardDockService from '../services/yard-dock.service';

export class YardDockController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const dock = await yardDockService.create(req.body);
      res.status(201).json({ status: 'success', data: dock });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        warehouseId: req.query.warehouseId as string,
        serviceType: req.query.serviceType as 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO' | undefined,
        active: req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined,
      };
      const result = await yardDockService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const dock = await yardDockService.getById(req.params.id);
      if (!dock) {
        return res.status(404).json({ status: 'error', message: 'Doca não encontrada' });
      }
      res.status(200).json({ status: 'success', data: dock });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const dock = await yardDockService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: dock });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await yardDockService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

export default new YardDockController();
```

- [ ] **Step 6: `yard-dock.routes.ts`**

Criar `backend/src/routes/yard-dock.routes.ts`:

```typescript
import { Router } from 'express';
import yardDockController from '../controllers/yard-dock.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createYardDockSchema,
  listYardDockQuerySchema,
  updateYardDockSchema,
} from '../validators/yard-dock.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(listYardDockQuerySchema),
  yardDockController.getAll
);
router.get('/:id', requirePermission('yard', 'visualizar'), yardDockController.getById);
router.post(
  '/',
  requirePermission('yard', 'gerenciar'),
  validate(createYardDockSchema),
  yardDockController.create
);
router.put(
  '/:id',
  requirePermission('yard', 'gerenciar'),
  validate(updateYardDockSchema),
  yardDockController.update
);
router.delete('/:id', requirePermission('yard', 'gerenciar'), yardDockController.delete);

export default router;
```

- [ ] **Step 7: Montar a rota sob `requireModule('YMS')`**

Em `backend/src/routes/index.ts`, adicionar o import junto aos demais (perto de `import equipmentRoutes from './equipment.routes';`):

```typescript
import yardDockRoutes from './yard-dock.routes';
```

E adicionar, após o bloco `MÓDULO MANUTENÇÃO` (linha ~136):

```typescript
// ============================================
// MÓDULO YMS (licenciável por instalação)
// ============================================
router.use('/yard-docks', requireModule('YMS'), yardDockRoutes);
```

- [ ] **Step 8: Rodar os testes e verificar que passam**

```bash
npm run test:integration -- yard-dock.service.test.ts
```

Esperado: 7/7.

- [ ] **Step 9: Rodar a suíte completa para confirmar não-regressão**

```bash
npm run test:integration
```

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/yard-dock.service.ts backend/src/controllers/yard-dock.controller.ts backend/src/routes/yard-dock.routes.ts backend/src/validators/yard-dock.validator.ts backend/src/routes/index.ts backend/tests/services/yard-dock.service.test.ts
git commit -m "feat(yms): adiciona CRUD de Docas (YardDock)"
```

---

### Task 3: Backend — CRUD de Driver (Motoristas)

**Files:**
- Modify: `backend/tests/helpers/fixtures.ts`
- Create: `backend/src/services/driver.service.ts`
- Create: `backend/src/controllers/driver.controller.ts`
- Create: `backend/src/routes/driver.routes.ts`
- Create: `backend/src/validators/driver.validator.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/driver.service.test.ts`

**Interfaces:**
- Consumes: `prisma.supplier` (já existente).
- Produces: `createTestSupplier()` em `helpers/fixtures.ts` — **usado pelas Tasks 4 e 5** (Fleet e Vehicle também precisam de um Supplier de teste). `DriverService`, montado em `/drivers`.

- [ ] **Step 1: Adicionar a fixture `createTestSupplier`**

Em `backend/tests/helpers/fixtures.ts`, não existe hoje uma fixture standalone de fornecedor (só criação inline dentro de `createTestPurchaseOrder`, linha ~358). Adicionar, próximo ao `supplierCounter` já existente (linha ~339):

```typescript
export async function createTestSupplier() {
  supplierCounter += 1;
  return testPrisma.supplier.create({
    data: { code: `SUP-TEST-${supplierCounter}`, name: `Fornecedor de Teste ${supplierCounter}` },
  });
}
```

Não remover nem alterar a criação inline dentro de `createTestPurchaseOrder` — ela continua usando seu próprio incremento do mesmo `supplierCounter`, sem conflito (contadores são só para gerar `code` único, nunca comparados entre si).

- [ ] **Step 2: Escrever os testes que falham**

Criar `backend/tests/services/driver.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestSupplier } from '../helpers/fixtures';
import driverService from '../../src/services/driver.service';

describe('DriverService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria um motorista vinculado a um fornecedor existente', async () => {
    const supplier = await createTestSupplier();

    const driver = await driverService.create({
      name: 'João da Silva',
      cpf: '12345678901',
      supplierId: supplier.id,
    });

    expect(driver.name).toBe('João da Silva');
    expect(driver.supplierId).toBe(supplier.id);
    expect(driver.blocked).toBe(false);
  });

  it('rejeita criar motorista com supplierId inexistente', async () => {
    await expect(
      driverService.create({ name: 'Maria Souza', cpf: '10987654321', supplierId: 'id-que-nao-existe' })
    ).rejects.toThrow('Fornecedor informado não existe');
  });

  it('rejeita CPF duplicado com mensagem clara', async () => {
    const supplier = await createTestSupplier();
    await driverService.create({ name: 'Motorista 1', cpf: '11111111111', supplierId: supplier.id });

    await expect(
      driverService.create({ name: 'Motorista 2', cpf: '11111111111', supplierId: supplier.id })
    ).rejects.toThrow('Já existe um motorista cadastrado com este CPF');
  });

  it('rejeita atualizar para um CPF já usado por outro motorista', async () => {
    const supplier = await createTestSupplier();
    await driverService.create({ name: 'Motorista 1', cpf: '66666666666', supplierId: supplier.id });
    const driver2 = await driverService.create({ name: 'Motorista 2', cpf: '77777777777', supplierId: supplier.id });

    await expect(driverService.update(driver2.id, { cpf: '66666666666' })).rejects.toThrow(
      'Já existe um motorista cadastrado com este CPF'
    );
  });

  it('bloqueia um motorista com motivo', async () => {
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'Motorista 3', cpf: '22222222222', supplierId: supplier.id });

    const blocked = await driverService.setBlocked(driver.id, true, 'CNH vencida');

    expect(blocked.blocked).toBe(true);
    expect(blocked.blockedReason).toBe('CNH vencida');
  });

  it('desbloqueia um motorista, limpando o motivo', async () => {
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'Motorista 4', cpf: '33333333333', supplierId: supplier.id });
    await driverService.setBlocked(driver.id, true, 'Motivo qualquer');

    const unblocked = await driverService.setBlocked(driver.id, false, null);

    expect(unblocked.blocked).toBe(false);
    expect(unblocked.blockedReason).toBeNull();
  });

  it('lista motoristas filtrando por fornecedor', async () => {
    const sup1 = await createTestSupplier();
    const sup2 = await createTestSupplier();
    await driverService.create({ name: 'A', cpf: '44444444444', supplierId: sup1.id });
    await driverService.create({ name: 'B', cpf: '55555555555', supplierId: sup2.id });

    const result = await driverService.getAll(1, 100, { supplierId: sup1.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('A');
  });
});
```

- [ ] **Step 3: Rodar os testes e verificar que falham**

```bash
npm run test:integration -- driver.service.test.ts
```

Esperado: FAIL (`Cannot find module '../../src/services/driver.service'`).

- [ ] **Step 4: `driver.validator.ts`**

Criar `backend/src/validators/driver.validator.ts`:

```typescript
import Joi from 'joi';

export const createDriverSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Nome é obrigatório',
    'any.required': 'Nome é obrigatório',
  }),
  cpf: Joi.string().trim().pattern(/^\d{11}$/).required().messages({
    'string.pattern.base': 'CPF deve conter 11 dígitos numéricos, sem pontuação',
    'any.required': 'CPF é obrigatório',
  }),
  supplierId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do fornecedor inválido',
    'any.required': 'Fornecedor é obrigatório',
  }),
});

export const updateDriverSchema = Joi.object({
  name: Joi.string().trim().min(1),
  cpf: Joi.string().trim().pattern(/^\d{11}$/).messages({
    'string.pattern.base': 'CPF deve conter 11 dígitos numéricos, sem pontuação',
  }),
  supplierId: Joi.string().uuid().messages({
    'string.guid': 'ID do fornecedor inválido',
  }),
}).min(1);

export const setDriverBlockedSchema = Joi.object({
  blocked: Joi.boolean().required(),
  blockedReason: Joi.string().trim().allow('', null),
});

export const listDriverQuerySchema = Joi.object({
  supplierId: Joi.string().uuid(),
  blocked: Joi.boolean(),
  search: Joi.string(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
```

- [ ] **Step 5: `driver.service.ts`**

Criar `backend/src/services/driver.service.ts`:

```typescript
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateDriverDto {
  name: string;
  cpf: string;
  supplierId: string;
}

export interface UpdateDriverDto extends Partial<CreateDriverDto> {}

export interface DriverFilters {
  supplierId?: string;
  blocked?: boolean;
  search?: string;
}

const assertSupplierExists = async (supplierId: string) => {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    throw new AppError(400, 'Fornecedor informado não existe');
  }
};

const assertCpfNotTaken = async (cpf: string, excludeId?: string) => {
  const existing = await prisma.driver.findFirst({
    where: { cpf, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new AppError(400, 'Já existe um motorista cadastrado com este CPF');
  }
};

export class DriverService {
  async create(data: CreateDriverDto) {
    await assertSupplierExists(data.supplierId);
    await assertCpfNotTaken(data.cpf);
    return prisma.driver.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: DriverFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.blocked !== undefined) where.blocked = filters.blocked;
    if (filters?.search) {
      where.OR = [{ name: { contains: filters.search } }, { cpf: { contains: filters.search } }];
    }

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { supplier: { select: { id: true, code: true, name: true } } },
      }),
      prisma.driver.count({ where }),
    ]);

    return { data: drivers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.driver.findUnique({
      where: { id },
      include: { supplier: { select: { id: true, code: true, name: true } } },
    });
  }

  async update(id: string, data: UpdateDriverDto) {
    if (data.supplierId) {
      await assertSupplierExists(data.supplierId);
    }
    if (data.cpf) {
      await assertCpfNotTaken(data.cpf, id);
    }
    return prisma.driver.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.driver.delete({ where: { id } });
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return prisma.driver.update({ where: { id }, data: { blocked, blockedReason: blocked ? blockedReason : null } });
  }
}

export default new DriverService();
```

- [ ] **Step 6: `driver.controller.ts`**

Criar `backend/src/controllers/driver.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import driverService from '../services/driver.service';

export class DriverController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.create(req.body);
      res.status(201).json({ status: 'success', data: driver });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        supplierId: req.query.supplierId as string,
        blocked: req.query.blocked === 'true' ? true : req.query.blocked === 'false' ? false : undefined,
        search: req.query.search as string,
      };
      const result = await driverService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.getById(req.params.id);
      if (!driver) {
        return res.status(404).json({ status: 'error', message: 'Motorista não encontrado' });
      }
      res.status(200).json({ status: 'success', data: driver });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: driver });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await driverService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setBlocked(req: Request, res: Response, next: NextFunction) {
    try {
      const driver = await driverService.setBlocked(req.params.id, req.body.blocked, req.body.blockedReason ?? null);
      res.status(200).json({ status: 'success', data: driver });
    } catch (error) {
      next(error);
    }
  }
}

export default new DriverController();
```

- [ ] **Step 7: `driver.routes.ts`**

Criar `backend/src/routes/driver.routes.ts`:

```typescript
import { Router } from 'express';
import driverController from '../controllers/driver.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createDriverSchema,
  listDriverQuerySchema,
  setDriverBlockedSchema,
  updateDriverSchema,
} from '../validators/driver.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(listDriverQuerySchema),
  driverController.getAll
);
router.get('/:id', requirePermission('yard', 'visualizar'), driverController.getById);
router.post(
  '/',
  requirePermission('yard', 'gerenciar'),
  validate(createDriverSchema),
  driverController.create
);
router.put(
  '/:id',
  requirePermission('yard', 'gerenciar'),
  validate(updateDriverSchema),
  driverController.update
);
router.delete('/:id', requirePermission('yard', 'gerenciar'), driverController.delete);
router.patch(
  '/:id/blocked',
  requirePermission('yard', 'gerenciar'),
  validate(setDriverBlockedSchema),
  driverController.setBlocked
);

export default router;
```

- [ ] **Step 8: Montar a rota sob `requireModule('YMS')`**

Em `backend/src/routes/index.ts`, adicionar o import junto ao de `yardDockRoutes`:

```typescript
import driverRoutes from './driver.routes';
```

E adicionar, logo abaixo de `router.use('/yard-docks', requireModule('YMS'), yardDockRoutes);`:

```typescript
router.use('/drivers', requireModule('YMS'), driverRoutes);
```

- [ ] **Step 9: Rodar os testes e verificar que passam**

```bash
npm run test:integration -- driver.service.test.ts
```

Esperado: 7/7.

- [ ] **Step 10: Rodar a suíte completa para confirmar não-regressão**

```bash
npm run test:integration
```

- [ ] **Step 11: Commit**

```bash
git add backend/tests/helpers/fixtures.ts backend/src/services/driver.service.ts backend/src/controllers/driver.controller.ts backend/src/routes/driver.routes.ts backend/src/validators/driver.validator.ts backend/src/routes/index.ts backend/tests/services/driver.service.test.ts
git commit -m "feat(yms): adiciona CRUD de Motoristas (Driver)"
```

---

### Task 4: Backend — CRUD de Fleet (Frotas)

**Files:**
- Create: `backend/src/services/fleet.service.ts`
- Create: `backend/src/controllers/fleet.controller.ts`
- Create: `backend/src/routes/fleet.routes.ts`
- Create: `backend/src/validators/fleet.validator.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/fleet.service.test.ts`

**Interfaces:**
- Consumes: `prisma.supplier`; `createTestSupplier()` (Task 3, `helpers/fixtures.ts`).
- Produces: `FleetService`, montado em `/fleets`. **Task 5 (Vehicle) depende de `fleet.service.ts` existir** (usa `prisma.fleet.findUnique` diretamente para a validação cruzada fleet/supplier, não importa o service).

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/tests/services/fleet.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestSupplier } from '../helpers/fixtures';
import fleetService from '../../src/services/fleet.service';

describe('FleetService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria uma frota vinculada a um fornecedor existente', async () => {
    const supplier = await createTestSupplier();

    const fleet = await fleetService.create({ name: 'Frota Refrigerada', supplierId: supplier.id });

    expect(fleet.name).toBe('Frota Refrigerada');
    expect(fleet.supplierId).toBe(supplier.id);
    expect(fleet.blocked).toBe(false);
  });

  it('rejeita criar frota com supplierId inexistente', async () => {
    await expect(
      fleetService.create({ name: 'Frota X', supplierId: 'id-que-nao-existe' })
    ).rejects.toThrow('Fornecedor informado não existe');
  });

  it('bloqueia uma frota com motivo', async () => {
    const supplier = await createTestSupplier();
    const fleet = await fleetService.create({ name: 'Frota Seca', supplierId: supplier.id });

    const blocked = await fleetService.setBlocked(fleet.id, true, 'Inadimplência do fornecedor');

    expect(blocked.blocked).toBe(true);
    expect(blocked.blockedReason).toBe('Inadimplência do fornecedor');
  });

  it('lista frotas filtrando por fornecedor', async () => {
    const sup1 = await createTestSupplier();
    const sup2 = await createTestSupplier();
    await fleetService.create({ name: 'Frota A', supplierId: sup1.id });
    await fleetService.create({ name: 'Frota B', supplierId: sup2.id });

    const result = await fleetService.getAll(1, 100, { supplierId: sup1.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Frota A');
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```bash
npm run test:integration -- fleet.service.test.ts
```

Esperado: FAIL (`Cannot find module '../../src/services/fleet.service'`).

- [ ] **Step 3: `fleet.validator.ts`**

Criar `backend/src/validators/fleet.validator.ts`:

```typescript
import Joi from 'joi';

export const createFleetSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Nome é obrigatório',
    'any.required': 'Nome é obrigatório',
  }),
  supplierId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do fornecedor inválido',
    'any.required': 'Fornecedor é obrigatório',
  }),
});

export const updateFleetSchema = Joi.object({
  name: Joi.string().trim().min(1),
}).min(1);

export const setFleetBlockedSchema = Joi.object({
  blocked: Joi.boolean().required(),
  blockedReason: Joi.string().trim().allow('', null),
});

export const listFleetQuerySchema = Joi.object({
  supplierId: Joi.string().uuid(),
  blocked: Joi.boolean(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
```

Note que `updateFleetSchema` não permite trocar `supplierId` — mudar o fornecedor de uma frota já criada exigiria decidir o que acontece com os veículos já vinculados a ela (ver Task 5), fora do escopo desta rodada. Se precisar trocar o fornecedor, o caminho é criar uma nova frota.

- [ ] **Step 4: `fleet.service.ts`**

Criar `backend/src/services/fleet.service.ts`:

```typescript
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateFleetDto {
  name: string;
  supplierId: string;
}

export interface UpdateFleetDto {
  name?: string;
}

export interface FleetFilters {
  supplierId?: string;
  blocked?: boolean;
}

const assertSupplierExists = async (supplierId: string) => {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    throw new AppError(400, 'Fornecedor informado não existe');
  }
};

export class FleetService {
  async create(data: CreateFleetDto) {
    await assertSupplierExists(data.supplierId);
    return prisma.fleet.create({ data });
  }

  async getAll(page = 1, limit = 100, filters?: FleetFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.blocked !== undefined) where.blocked = filters.blocked;

    const [fleets, total] = await Promise.all([
      prisma.fleet.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: { supplier: { select: { id: true, code: true, name: true } }, _count: { select: { vehicles: true } } },
      }),
      prisma.fleet.count({ where }),
    ]);

    return { data: fleets, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.fleet.findUnique({
      where: { id },
      include: { supplier: { select: { id: true, code: true, name: true } }, _count: { select: { vehicles: true } } },
    });
  }

  async update(id: string, data: UpdateFleetDto) {
    return prisma.fleet.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.fleet.delete({ where: { id } });
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return prisma.fleet.update({ where: { id }, data: { blocked, blockedReason: blocked ? blockedReason : null } });
  }
}

export default new FleetService();
```

`_count: { select: { vehicles: true } }` em `getAll`/`getById` é para o frontend (Task 9) mostrar "quantos veículos serão afetados" ao bloquear uma frota, sem precisar de uma segunda chamada.

- [ ] **Step 5: `fleet.controller.ts`**

Criar `backend/src/controllers/fleet.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import fleetService from '../services/fleet.service';

export class FleetController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const fleet = await fleetService.create(req.body);
      res.status(201).json({ status: 'success', data: fleet });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        supplierId: req.query.supplierId as string,
        blocked: req.query.blocked === 'true' ? true : req.query.blocked === 'false' ? false : undefined,
      };
      const result = await fleetService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const fleet = await fleetService.getById(req.params.id);
      if (!fleet) {
        return res.status(404).json({ status: 'error', message: 'Frota não encontrada' });
      }
      res.status(200).json({ status: 'success', data: fleet });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const fleet = await fleetService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: fleet });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await fleetService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setBlocked(req: Request, res: Response, next: NextFunction) {
    try {
      const fleet = await fleetService.setBlocked(req.params.id, req.body.blocked, req.body.blockedReason ?? null);
      res.status(200).json({ status: 'success', data: fleet });
    } catch (error) {
      next(error);
    }
  }
}

export default new FleetController();
```

- [ ] **Step 6: `fleet.routes.ts`**

Criar `backend/src/routes/fleet.routes.ts`:

```typescript
import { Router } from 'express';
import fleetController from '../controllers/fleet.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createFleetSchema,
  listFleetQuerySchema,
  setFleetBlockedSchema,
  updateFleetSchema,
} from '../validators/fleet.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(listFleetQuerySchema),
  fleetController.getAll
);
router.get('/:id', requirePermission('yard', 'visualizar'), fleetController.getById);
router.post(
  '/',
  requirePermission('yard', 'gerenciar'),
  validate(createFleetSchema),
  fleetController.create
);
router.put(
  '/:id',
  requirePermission('yard', 'gerenciar'),
  validate(updateFleetSchema),
  fleetController.update
);
router.delete('/:id', requirePermission('yard', 'gerenciar'), fleetController.delete);
router.patch(
  '/:id/blocked',
  requirePermission('yard', 'gerenciar'),
  validate(setFleetBlockedSchema),
  fleetController.setBlocked
);

export default router;
```

- [ ] **Step 7: Montar a rota sob `requireModule('YMS')`**

Em `backend/src/routes/index.ts`, adicionar o import junto aos demais:

```typescript
import fleetRoutes from './fleet.routes';
```

E adicionar, logo abaixo de `router.use('/drivers', requireModule('YMS'), driverRoutes);`:

```typescript
router.use('/fleets', requireModule('YMS'), fleetRoutes);
```

- [ ] **Step 8: Rodar os testes e verificar que passam**

```bash
npm run test:integration -- fleet.service.test.ts
```

Esperado: 4/4.

- [ ] **Step 9: Rodar a suíte completa para confirmar não-regressão**

```bash
npm run test:integration
```

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/fleet.service.ts backend/src/controllers/fleet.controller.ts backend/src/routes/fleet.routes.ts backend/src/validators/fleet.validator.ts backend/src/routes/index.ts backend/tests/services/fleet.service.test.ts
git commit -m "feat(yms): adiciona CRUD de Frotas (Fleet)"
```

---

### Task 5: Backend — CRUD de Vehicle (Veículos)

**Files:**
- Create: `backend/src/services/vehicle.service.ts`
- Create: `backend/src/controllers/vehicle.controller.ts`
- Create: `backend/src/routes/vehicle.routes.ts`
- Create: `backend/src/validators/vehicle.validator.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/vehicle.service.test.ts`

**Interfaces:**
- Consumes: `prisma.supplier`, `prisma.fleet` (Task 4); `createTestSupplier()` (Task 3).
- Produces: `VehicleService`, montado em `/vehicles`. Nenhuma outra task deste plano depende deste arquivo.

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/tests/services/vehicle.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestSupplier } from '../helpers/fixtures';
import vehicleService from '../../src/services/vehicle.service';
import fleetService from '../../src/services/fleet.service';

describe('VehicleService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria um veículo com placa no padrão Mercosul, normalizada para maiúsculas', async () => {
    const supplier = await createTestSupplier();

    const vehicle = await vehicleService.create({
      plate: 'abc1d23',
      type: 'TRUCK',
      supplierId: supplier.id,
    });

    expect(vehicle.plate).toBe('ABC1D23');
  });

  it('cria um veículo com placa no padrão antigo', async () => {
    const supplier = await createTestSupplier();

    const vehicle = await vehicleService.create({ plate: 'ABC1234', type: 'TOCO', supplierId: supplier.id });

    expect(vehicle.plate).toBe('ABC1234');
  });

  it('rejeita placa em formato inválido', async () => {
    const supplier = await createTestSupplier();

    await expect(
      vehicleService.create({ plate: 'AB-1234', type: 'VAN', supplierId: supplier.id })
    ).rejects.toThrow('Placa em formato inválido');
  });

  it('rejeita placa duplicada, inclusive quando digitada com caixa diferente', async () => {
    const supplier = await createTestSupplier();
    await vehicleService.create({ plate: 'ABC1234', type: 'VAN', supplierId: supplier.id });

    await expect(
      vehicleService.create({ plate: 'abc1234', type: 'TRUCK', supplierId: supplier.id })
    ).rejects.toThrow('Já existe um veículo cadastrado com esta placa');
  });

  it('rejeita criar veículo com supplierId inexistente', async () => {
    await expect(
      vehicleService.create({ plate: 'ABC1234', type: 'VAN', supplierId: 'id-que-nao-existe' })
    ).rejects.toThrow('Fornecedor informado não existe');
  });

  it('cria um veículo vinculado a uma frota do mesmo fornecedor', async () => {
    const supplier = await createTestSupplier();
    const fleet = await fleetService.create({ name: 'Frota A', supplierId: supplier.id });

    const vehicle = await vehicleService.create({
      plate: 'ABC1234',
      type: 'CAVALO',
      supplierId: supplier.id,
      fleetId: fleet.id,
    });

    expect(vehicle.fleetId).toBe(fleet.id);
  });

  it('rejeita vincular veículo a uma frota de OUTRO fornecedor', async () => {
    const supplier1 = await createTestSupplier();
    const supplier2 = await createTestSupplier();
    const fleetOfSupplier2 = await fleetService.create({ name: 'Frota do Fornecedor 2', supplierId: supplier2.id });

    await expect(
      vehicleService.create({
        plate: 'ABC1234',
        type: 'CAVALO',
        supplierId: supplier1.id,
        fleetId: fleetOfSupplier2.id,
      })
    ).rejects.toThrow('A frota informada pertence a outro fornecedor');
  });

  it('bloqueia um veículo com motivo', async () => {
    const supplier = await createTestSupplier();
    const vehicle = await vehicleService.create({ plate: 'ABC1234', type: 'VAN', supplierId: supplier.id });

    const blocked = await vehicleService.setBlocked(vehicle.id, true, 'Documentação vencida');

    expect(blocked.blocked).toBe(true);
    expect(blocked.blockedReason).toBe('Documentação vencida');
  });

  it('lista veículos filtrando por frota', async () => {
    const supplier = await createTestSupplier();
    const fleet = await fleetService.create({ name: 'Frota B', supplierId: supplier.id });
    await vehicleService.create({ plate: 'ABC1111', type: 'TRUCK', supplierId: supplier.id, fleetId: fleet.id });
    await vehicleService.create({ plate: 'ABC2222', type: 'TRUCK', supplierId: supplier.id });

    const result = await vehicleService.getAll(1, 100, { fleetId: fleet.id });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].plate).toBe('ABC1111');
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```bash
npm run test:integration -- vehicle.service.test.ts
```

Esperado: FAIL (`Cannot find module '../../src/services/vehicle.service'`).

- [ ] **Step 3: `vehicle.validator.ts`**

Criar `backend/src/validators/vehicle.validator.ts`. A validação de formato de placa acontece aqui (Joi), a normalização para maiúsculas acontece no service (Step 4) — o Joi valida o formato como o usuário digitou, sem impor caixa alta na validação, para a mensagem de erro não confundir quem digitou em minúsculas por engano:

```typescript
import Joi from 'joi';

const PLATE_PATTERN = /^([A-Za-z]{3}\d[A-Za-z]\d{2}|[A-Za-z]{3}\d{4})$/;

export const createVehicleSchema = Joi.object({
  plate: Joi.string().trim().pattern(PLATE_PATTERN).required().messages({
    'string.pattern.base': 'Placa em formato inválido (use ABC1234 ou ABC1D23, sem hífen)',
    'any.required': 'Placa é obrigatória',
  }),
  type: Joi.string().valid('TRUCK', 'TOCO', 'CAVALO', 'MECANICO', 'VAN', 'UTILITARIO', 'OUTROS').required().messages({
    'any.only': 'Tipo de rodado inválido',
    'any.required': 'Tipo de rodado é obrigatório',
  }),
  model: Joi.string().trim().max(100).allow('', null),
  supplierId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do fornecedor inválido',
    'any.required': 'Fornecedor é obrigatório',
  }),
  fleetId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID da frota inválido',
  }),
});

export const updateVehicleSchema = Joi.object({
  plate: Joi.string().trim().pattern(PLATE_PATTERN).messages({
    'string.pattern.base': 'Placa em formato inválido (use ABC1234 ou ABC1D23, sem hífen)',
  }),
  type: Joi.string().valid('TRUCK', 'TOCO', 'CAVALO', 'MECANICO', 'VAN', 'UTILITARIO', 'OUTROS').messages({
    'any.only': 'Tipo de rodado inválido',
  }),
  model: Joi.string().trim().max(100).allow('', null),
  supplierId: Joi.string().uuid().messages({
    'string.guid': 'ID do fornecedor inválido',
  }),
  fleetId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID da frota inválido',
  }),
}).min(1);

export const setVehicleBlockedSchema = Joi.object({
  blocked: Joi.boolean().required(),
  blockedReason: Joi.string().trim().allow('', null),
});

export const listVehicleQuerySchema = Joi.object({
  supplierId: Joi.string().uuid(),
  fleetId: Joi.string().uuid(),
  type: Joi.string().valid('TRUCK', 'TOCO', 'CAVALO', 'MECANICO', 'VAN', 'UTILITARIO', 'OUTROS'),
  blocked: Joi.boolean(),
  search: Joi.string(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
```

- [ ] **Step 4: `vehicle.service.ts`**

Criar `backend/src/services/vehicle.service.ts`. Note que a normalização da placa (`.toUpperCase()`) acontece aqui, não no validator — o Joi já validou o formato contra o padrão case-insensitive (`[A-Za-z]`), então normalizar depois da validação é seguro e mais simples do que fazer o Joi reescrever o valor:

```typescript
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateVehicleDto {
  plate: string;
  type: 'TRUCK' | 'TOCO' | 'CAVALO' | 'MECANICO' | 'VAN' | 'UTILITARIO' | 'OUTROS';
  model?: string | null;
  supplierId: string;
  fleetId?: string | null;
}

export interface UpdateVehicleDto extends Partial<CreateVehicleDto> {}

export interface VehicleFilters {
  supplierId?: string;
  fleetId?: string;
  type?: CreateVehicleDto['type'];
  blocked?: boolean;
  search?: string;
}

const PLATE_PATTERN = /^([A-Z]{3}\d[A-Z]\d{2}|[A-Z]{3}\d{4})$/;

const normalizePlate = (plate: string): string => {
  const normalized = plate.trim().toUpperCase();
  if (!PLATE_PATTERN.test(normalized)) {
    throw new AppError(400, 'Placa em formato inválido (use ABC1234 ou ABC1D23, sem hífen)');
  }
  return normalized;
};

const assertSupplierExists = async (supplierId: string) => {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    throw new AppError(400, 'Fornecedor informado não existe');
  }
};

const assertFleetBelongsToSupplier = async (fleetId: string, supplierId: string) => {
  const fleet = await prisma.fleet.findUnique({ where: { id: fleetId } });
  if (!fleet) {
    throw new AppError(400, 'Frota informada não existe');
  }
  if (fleet.supplierId !== supplierId) {
    throw new AppError(400, 'A frota informada pertence a outro fornecedor');
  }
};

const assertPlateNotTaken = async (plate: string, excludeId?: string) => {
  const existing = await prisma.vehicle.findFirst({
    where: { plate, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new AppError(400, 'Já existe um veículo cadastrado com esta placa');
  }
};

export class VehicleService {
  async create(data: CreateVehicleDto) {
    const plate = normalizePlate(data.plate);
    await assertSupplierExists(data.supplierId);
    if (data.fleetId) {
      await assertFleetBelongsToSupplier(data.fleetId, data.supplierId);
    }
    await assertPlateNotTaken(plate);
    return prisma.vehicle.create({ data: { ...data, plate } });
  }

  async getAll(page = 1, limit = 100, filters?: VehicleFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.supplierId) where.supplierId = filters.supplierId;
    if (filters?.fleetId) where.fleetId = filters.fleetId;
    if (filters?.type) where.type = filters.type;
    if (filters?.blocked !== undefined) where.blocked = filters.blocked;
    if (filters?.search) where.plate = { contains: filters.search.toUpperCase() };

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { plate: 'asc' },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          fleet: { select: { id: true, name: true } },
        },
      }),
      prisma.vehicle.count({ where }),
    ]);

    return { data: vehicles, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    return prisma.vehicle.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        fleet: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, data: UpdateVehicleDto) {
    const current = await prisma.vehicle.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Veículo não encontrado');

    const plate = data.plate ? normalizePlate(data.plate) : undefined;
    const supplierId = data.supplierId ?? current.supplierId;

    if (data.fleetId) {
      await assertFleetBelongsToSupplier(data.fleetId, supplierId);
    }
    if (data.supplierId) {
      await assertSupplierExists(data.supplierId);
    }
    if (plate) {
      await assertPlateNotTaken(plate, id);
    }

    return prisma.vehicle.update({ where: { id }, data: { ...data, ...(plate ? { plate } : {}) } });
  }

  async delete(id: string) {
    return prisma.vehicle.delete({ where: { id } });
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return prisma.vehicle.update({ where: { id }, data: { blocked, blockedReason: blocked ? blockedReason : null } });
  }
}

export default new VehicleService();
```

- [ ] **Step 5: `vehicle.controller.ts`**

Criar `backend/src/controllers/vehicle.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import vehicleService from '../services/vehicle.service';

export class VehicleController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehicleService.create(req.body);
      res.status(201).json({ status: 'success', data: vehicle });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const filters = {
        supplierId: req.query.supplierId as string,
        fleetId: req.query.fleetId as string,
        type: req.query.type as any,
        blocked: req.query.blocked === 'true' ? true : req.query.blocked === 'false' ? false : undefined,
        search: req.query.search as string,
      };
      const result = await vehicleService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehicleService.getById(req.params.id);
      if (!vehicle) {
        return res.status(404).json({ status: 'error', message: 'Veículo não encontrado' });
      }
      res.status(200).json({ status: 'success', data: vehicle });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehicleService.update(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: vehicle });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await vehicleService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setBlocked(req: Request, res: Response, next: NextFunction) {
    try {
      const vehicle = await vehicleService.setBlocked(req.params.id, req.body.blocked, req.body.blockedReason ?? null);
      res.status(200).json({ status: 'success', data: vehicle });
    } catch (error) {
      next(error);
    }
  }
}

export default new VehicleController();
```

- [ ] **Step 6: `vehicle.routes.ts`**

Criar `backend/src/routes/vehicle.routes.ts`:

```typescript
import { Router } from 'express';
import vehicleController from '../controllers/vehicle.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createVehicleSchema,
  listVehicleQuerySchema,
  setVehicleBlockedSchema,
  updateVehicleSchema,
} from '../validators/vehicle.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(listVehicleQuerySchema),
  vehicleController.getAll
);
router.get('/:id', requirePermission('yard', 'visualizar'), vehicleController.getById);
router.post(
  '/',
  requirePermission('yard', 'gerenciar'),
  validate(createVehicleSchema),
  vehicleController.create
);
router.put(
  '/:id',
  requirePermission('yard', 'gerenciar'),
  validate(updateVehicleSchema),
  vehicleController.update
);
router.delete('/:id', requirePermission('yard', 'gerenciar'), vehicleController.delete);
router.patch(
  '/:id/blocked',
  requirePermission('yard', 'gerenciar'),
  validate(setVehicleBlockedSchema),
  vehicleController.setBlocked
);

export default router;
```

- [ ] **Step 7: Montar a rota sob `requireModule('YMS')`**

Em `backend/src/routes/index.ts`, adicionar o import junto aos demais:

```typescript
import vehicleRoutes from './vehicle.routes';
```

E adicionar, logo abaixo de `router.use('/fleets', requireModule('YMS'), fleetRoutes);`:

```typescript
router.use('/vehicles', requireModule('YMS'), vehicleRoutes);
```

- [ ] **Step 8: Rodar os testes e verificar que passam**

```bash
npm run test:integration -- vehicle.service.test.ts
```

Esperado: 9/9.

- [ ] **Step 9: Rodar a suíte completa para confirmar não-regressão**

```bash
npm run test:integration
```

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/vehicle.service.ts backend/src/controllers/vehicle.controller.ts backend/src/routes/vehicle.routes.ts backend/src/validators/vehicle.validator.ts backend/src/routes/index.ts backend/tests/services/vehicle.service.test.ts
git commit -m "feat(yms): adiciona CRUD de Veículos (Vehicle)"
```

---

### Task 6: Backend — Parâmetros de Pátio por Armazém (YardWarehouseParams)

**Files:**
- Create: `backend/src/services/yard-warehouse-params.service.ts`
- Create: `backend/src/controllers/yard-warehouse-params.controller.ts`
- Create: `backend/src/routes/yard-warehouse-params.routes.ts`
- Create: `backend/src/validators/yard-warehouse-params.validator.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/yard-warehouse-params.service.test.ts`

**Interfaces:**
- Consumes: `prisma.warehouse` (já existente).
- Produces: `YardWarehouseParamsService`, montado em `/yard-warehouse-params/:warehouseId`. Nenhuma outra task deste plano depende deste arquivo.

Diferente das Tasks 2-5, este recurso é **1:1 com `Warehouse`** (`warehouseId @unique`) — não existe "lista paginada" nem "criar múltiplos". A API expõe só `GET /yard-warehouse-params/:warehouseId` (devolve os defaults se ainda não houver linha) e `PUT /yard-warehouse-params/:warehouseId` (upsert). A auditoria (quem mudou, valor antigo/novo) já vem de graça do `audit.middleware.ts` existente, aplicado globalmente a rotas mutantes — nenhum código de auditoria nesta task.

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/tests/services/yard-warehouse-params.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import yardWarehouseParamsService from '../../src/services/yard-warehouse-params.service';

describe('YardWarehouseParamsService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('devolve os defaults quando o armazém ainda não tem parâmetros configurados', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-P1', name: 'Armazém P1' } });

    const params = await yardWarehouseParamsService.getByWarehouseId(warehouse.id);

    expect(params.useYard).toBe(true);
    expect(params.delayToleranceMinutes).toBe(15);
  });

  it('cria os parâmetros na primeira gravação (upsert)', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-P2', name: 'Armazém P2' } });

    const params = await yardWarehouseParamsService.upsert(warehouse.id, {
      useYard: false,
      delayToleranceMinutes: 30,
    });

    expect(params.useYard).toBe(false);
    expect(params.delayToleranceMinutes).toBe(30);
  });

  it('atualiza os parâmetros já existentes (upsert na segunda chamada)', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-P3', name: 'Armazém P3' } });
    await yardWarehouseParamsService.upsert(warehouse.id, { useYard: true, delayToleranceMinutes: 10 });

    const updated = await yardWarehouseParamsService.upsert(warehouse.id, {
      useYard: true,
      delayToleranceMinutes: 45,
    });

    expect(updated.delayToleranceMinutes).toBe(45);
    const count = await testPrisma.yardWarehouseParams.count({ where: { warehouseId: warehouse.id } });
    expect(count).toBe(1);
  });

  it('rejeita configurar parâmetros para armazém inexistente', async () => {
    await expect(
      yardWarehouseParamsService.upsert('id-que-nao-existe', { useYard: true, delayToleranceMinutes: 15 })
    ).rejects.toThrow('Armazém informado não existe');
  });

  it('rejeita tolerância de atraso fora do intervalo 0-60', async () => {
    const warehouse = await testPrisma.warehouse.create({ data: { code: 'WH-P4', name: 'Armazém P4' } });

    await expect(
      yardWarehouseParamsService.upsert(warehouse.id, { useYard: true, delayToleranceMinutes: 61 })
    ).rejects.toThrow('Tolerância de atraso deve estar entre 0 e 60 minutos');
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```bash
npm run test:integration -- yard-warehouse-params.service.test.ts
```

Esperado: FAIL (`Cannot find module '../../src/services/yard-warehouse-params.service'`).

- [ ] **Step 3: `yard-warehouse-params.validator.ts`**

Criar `backend/src/validators/yard-warehouse-params.validator.ts`:

```typescript
import Joi from 'joi';

export const upsertYardWarehouseParamsSchema = Joi.object({
  useYard: Joi.boolean().required().messages({
    'any.required': 'Uso de pátio é obrigatório',
  }),
  delayToleranceMinutes: Joi.number().integer().min(0).max(60).required().messages({
    'number.min': 'Tolerância de atraso deve estar entre 0 e 60 minutos',
    'number.max': 'Tolerância de atraso deve estar entre 0 e 60 minutos',
    'any.required': 'Tolerância de atraso é obrigatória',
  }),
});
```

A checagem 0-60 já acontece aqui no Joi (a rota rejeita com 400 antes de chegar no service). O teste do Step 1 que espera o service lançar direto (`yardWarehouseParamsService.upsert(...)`, sem passar pela validação HTTP) exige a MESMA regra também no service — próximo Step.

- [ ] **Step 4: `yard-warehouse-params.service.ts`**

Criar `backend/src/services/yard-warehouse-params.service.ts`:

```typescript
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface UpsertYardWarehouseParamsDto {
  useYard: boolean;
  delayToleranceMinutes: number;
}

const DEFAULTS: UpsertYardWarehouseParamsDto = { useYard: true, delayToleranceMinutes: 15 };

const assertWarehouseExists = async (warehouseId: string) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) {
    throw new AppError(400, 'Armazém informado não existe');
  }
};

const assertToleranceInRange = (delayToleranceMinutes: number) => {
  if (delayToleranceMinutes < 0 || delayToleranceMinutes > 60) {
    throw new AppError(400, 'Tolerância de atraso deve estar entre 0 e 60 minutos');
  }
};

export class YardWarehouseParamsService {
  async getByWarehouseId(warehouseId: string) {
    const params = await prisma.yardWarehouseParams.findUnique({ where: { warehouseId } });
    if (params) return params;
    // Armazém ainda não tem linha própria: devolve os defaults sem persistir
    // nada — só grava no banco quando o usuário efetivamente salvar (Step de
    // upsert), consistente com o padrão do resto do projeto de não criar
    // registro até haver uma escrita real.
    return { id: null, warehouseId, ...DEFAULTS, createdAt: null, updatedAt: null };
  }

  async upsert(warehouseId: string, data: UpsertYardWarehouseParamsDto) {
    await assertWarehouseExists(warehouseId);
    assertToleranceInRange(data.delayToleranceMinutes);
    return prisma.yardWarehouseParams.upsert({
      where: { warehouseId },
      update: data,
      create: { warehouseId, ...data },
    });
  }
}

export default new YardWarehouseParamsService();
```

- [ ] **Step 5: `yard-warehouse-params.controller.ts`**

Criar `backend/src/controllers/yard-warehouse-params.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import yardWarehouseParamsService from '../services/yard-warehouse-params.service';

export class YardWarehouseParamsController {
  async getByWarehouseId(req: Request, res: Response, next: NextFunction) {
    try {
      const params = await yardWarehouseParamsService.getByWarehouseId(req.params.warehouseId);
      res.status(200).json({ status: 'success', data: params });
    } catch (error) {
      next(error);
    }
  }

  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      const params = await yardWarehouseParamsService.upsert(req.params.warehouseId, req.body);
      res.status(200).json({ status: 'success', data: params });
    } catch (error) {
      next(error);
    }
  }
}

export default new YardWarehouseParamsController();
```

- [ ] **Step 6: `yard-warehouse-params.routes.ts`**

Criar `backend/src/routes/yard-warehouse-params.routes.ts`:

```typescript
import { Router } from 'express';
import yardWarehouseParamsController from '../controllers/yard-warehouse-params.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { upsertYardWarehouseParamsSchema } from '../validators/yard-warehouse-params.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/:warehouseId',
  requirePermission('yard', 'visualizar'),
  yardWarehouseParamsController.getByWarehouseId
);
router.put(
  '/:warehouseId',
  requirePermission('yard', 'gerenciar'),
  validate(upsertYardWarehouseParamsSchema),
  yardWarehouseParamsController.upsert
);

export default router;
```

- [ ] **Step 7: Montar a rota sob `requireModule('YMS')`**

Em `backend/src/routes/index.ts`, adicionar o import junto aos demais:

```typescript
import yardWarehouseParamsRoutes from './yard-warehouse-params.routes';
```

E adicionar, logo abaixo de `router.use('/vehicles', requireModule('YMS'), vehicleRoutes);`:

```typescript
router.use('/yard-warehouse-params', requireModule('YMS'), yardWarehouseParamsRoutes);
```

- [ ] **Step 8: Rodar os testes e verificar que passam**

```bash
npm run test:integration -- yard-warehouse-params.service.test.ts
```

Esperado: 5/5.

- [ ] **Step 9: Rodar a suíte completa para confirmar não-regressão**

```bash
npm run test:integration
```

Esperado: **backend inteiro (Tasks 1-6) completo.**

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/yard-warehouse-params.service.ts backend/src/controllers/yard-warehouse-params.controller.ts backend/src/routes/yard-warehouse-params.routes.ts backend/src/validators/yard-warehouse-params.validator.ts backend/src/routes/index.ts backend/tests/services/yard-warehouse-params.service.test.ts
git commit -m "feat(yms): adiciona parâmetros de pátio por armazém"
```

---

### Task 7: Frontend — infraestrutura de navegação + CRUD de Docas

**Files:**
- Create: `frontend/src/services/yard-dock.service.ts`
- Create: `frontend/src/stores/yard-dock.store.ts`
- Create: `frontend/src/views/yard/YardDockListView.vue`
- Create: `frontend/src/views/yard/__tests__/YardDockListView.spec.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /yard-docks` (Task 2); `useWarehouseStore` (`frontend/src/stores/warehouse.store.ts`, já existente — `warehouses`, `fetchWarehouses()`); `storagePositionService.getPositionByCode(code)` (`frontend/src/services/storage-position.service.ts`, já existente — export nomeado, não instância de classe: `import { storagePositionService } from '@/services/storage-position.service'`, devolve `response.data` já no formato `{ status, data }`). `authStore.canViewYMS` (`frontend/src/stores/auth.store.ts`, já existente, ligado a `modules.view_yms`).
- Produces: nenhuma outra task depende deste arquivo de serviço/store específico (Driver/Fleet/Vehicle são independentes). A modificação em `DashboardView.vue` e `router/index.ts` É compartilhada com as Tasks 8-10, que vão adicionar seus próprios cards/rotas nos MESMOS arquivos — não é conflito, é esperado (cada task adiciona sua própria rota/card, sem tocar no que a task anterior adicionou).

- [ ] **Step 1: `yard-dock.service.ts`**

Criar `frontend/src/services/yard-dock.service.ts`:

```typescript
import api from './api.service'

export interface WarehouseRef {
  id: string
  code: string
  name: string
}

export interface StoragePositionRef {
  id: string
  code: string
}

export type DockServiceType = 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'

export interface YardDock {
  id: string
  code: string
  serviceType: DockServiceType
  warehouseId: string
  storagePositionId: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  warehouse?: WarehouseRef
  storagePosition?: StoragePositionRef | null
}

export interface CreateYardDockDto {
  code: string
  serviceType: DockServiceType
  warehouseId: string
  storagePositionId?: string | null
  active?: boolean
}

export interface UpdateYardDockDto extends Partial<Omit<CreateYardDockDto, 'warehouseId'>> {}

class YardDockService {
  private readonly basePath = '/yard-docks'

  async getAll(page = 1, limit = 100, filters?: { warehouseId?: string; serviceType?: DockServiceType; active?: boolean }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId)
    if (filters?.serviceType) params.append('serviceType', filters.serviceType)
    if (filters?.active !== undefined) params.append('active', filters.active.toString())
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateYardDockDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateYardDockDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }
}

export default new YardDockService()
```

- [ ] **Step 2: `yard-dock.store.ts`**

Criar `frontend/src/stores/yard-dock.store.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import yardDockService, { type YardDock, type CreateYardDockDto, type UpdateYardDockDto, type DockServiceType } from '@/services/yard-dock.service'

export const useYardDockStore = defineStore('yardDock', () => {
  const docks = ref<YardDock[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchDocks = async (page = 1, limit = 100, filters?: { warehouseId?: string; serviceType?: DockServiceType; active?: boolean }) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardDockService.getAll(page, limit, filters)
      docks.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar docas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createDock = async (data: CreateYardDockDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardDockService.create(data)
      await fetchDocks()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar doca'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateDock = async (id: string, data: UpdateYardDockDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardDockService.update(id, data)
      await fetchDocks()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar doca'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteDock = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardDockService.delete(id)
      await fetchDocks()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir doca'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { docks, loading, error, fetchDocks, createDock, updateDock, deleteDock }
})
```

- [ ] **Step 3: Escrever o teste da view**

Criar `frontend/src/views/yard/__tests__/YardDockListView.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import YardDockListView from '../YardDockListView.vue'
import yardDockService from '@/services/yard-dock.service'
import warehouseService from '@/services/warehouse.service'

vi.mock('@/services/yard-dock.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/services/warehouse.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockWarehouse = { id: 'wh-1', code: 'WH-1', name: 'Armazém Central', active: true, createdAt: '', updatedAt: '' }

const mockDock = {
  id: 'dock-1',
  code: 'DOCA-01',
  serviceType: 'RECEBIMENTO',
  warehouseId: 'wh-1',
  storagePositionId: null,
  active: true,
  createdAt: '',
  updatedAt: '',
  warehouse: { id: 'wh-1', code: 'WH-1', name: 'Armazém Central' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/docks', component: YardDockListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('YardDockListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(warehouseService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockWarehouse], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de docas', async () => {
    vi.mocked(yardDockService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockDock], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/docks')
    await router.isReady()

    const wrapper = mount(YardDockListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('DOCA-01')
    expect(wrapper.text()).toContain('Armazém Central')
  })

  it('cria uma doca nova pelo formulário', async () => {
    vi.mocked(yardDockService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(yardDockService.create).mockResolvedValue({ data: { status: 'success', data: mockDock } } as any)

    const router = makeRouter()
    router.push('/yard/docks')
    await router.isReady()

    const wrapper = mount(YardDockListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const novoButton = wrapper.findAll('button').find((b) => b.text().includes('Nova Doca'))!
    await novoButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#dock-form-code').setValue('DOCA-02')
    await body.find('#dock-form-service-type').setValue('EXPEDICAO')
    await body.find('#dock-form-warehouse').setValue('wh-1')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(yardDockService.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DOCA-02', serviceType: 'EXPEDICAO', warehouseId: 'wh-1' })
    )
  })
})
```

- [ ] **Step 4: Rodar o teste e verificar que falha**

```bash
npx vitest run src/views/yard/__tests__/YardDockListView.spec.ts
```

Esperado: FAIL (`Cannot find module '../YardDockListView.vue'`).

- [ ] **Step 5: `YardDockListView.vue`**

Criar `frontend/src/views/yard/YardDockListView.vue`:

```vue
<template>
  <AppLayout title="Docas" subtitle="Gerencie as docas de carga e descarga do pátio">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Doca</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="dock-filter-warehouse" label="Armazém">
          <select
            v-model="filters.warehouseId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
          </select>
        </FormField>
        <FormField id="dock-filter-service-type" label="Tipo de Serviço">
          <select
            v-model="filters.serviceType"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="RECEBIMENTO">Recebimento</option>
            <option value="EXPEDICAO">Expedição</option>
            <option value="MULTIUSO">Multiuso</option>
          </select>
        </FormField>
        <FormField id="dock-filter-active" label="Status">
          <select
            v-model="filters.active"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="true">Ativas</option>
            <option value="false">Inativas</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="dockList"
      :pagination="pagination"
      empty-title="Nenhuma doca encontrada"
      empty-hint="Ajuste os filtros ou cadastre uma nova doca."
      @retry="loadDocks"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Doca</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Código</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Armazém</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tipo de Serviço</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Posição Vinculada</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).warehouse?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ SERVICE_TYPE_LABELS[asItem(item).serviceType] }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).storagePosition?.code || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).active ? 'Ativa' : 'Inativa'"
            :tone="asItem(item).active ? 'success' : 'danger'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingDock ? 'Editar Doca' : 'Nova Doca'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="dock-form-code" label="Código" required>
            <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="dock-form-service-type" label="Tipo de Serviço" required>
            <select v-model="formData.serviceType" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="RECEBIMENTO">Recebimento</option>
              <option value="EXPEDICAO">Expedição</option>
              <option value="MULTIUSO">Multiuso</option>
            </select>
          </FormField>
        </div>

        <FormField id="dock-form-warehouse" label="Armazém" required>
          <select v-model="formData.warehouseId" required :disabled="!!editingDock" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
          </select>
        </FormField>

        <FormField id="dock-form-position-code" label="Código da posição de armazenagem vinculada (opcional)">
          <div class="flex gap-2">
            <input
              v-model="positionCodeInput"
              type="text"
              placeholder="Ex.: WH1-R01-01-01"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
            <Button type="button" variant="outline" @click="handleLookupPosition">Buscar</Button>
          </div>
          <p v-if="positionLookupMessage" class="mt-1 text-sm" :class="positionLookupError ? 'text-red-600' : 'text-green-600'">
            {{ positionLookupMessage }}
          </p>
        </FormField>

        <div class="flex items-center">
          <input v-model="formData.active" type="checkbox" id="dock-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="dock-form-active" class="ml-2 text-sm text-gray-700 dark:text-gray-300">Ativa</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingDock ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useYardDockStore } from '@/stores/yard-dock.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { storagePositionService } from '@/services/storage-position.service'
import type { YardDock, DockServiceType } from '@/services/yard-dock.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const SERVICE_TYPE_LABELS: Record<DockServiceType, string> = {
  RECEBIMENTO: 'Recebimento',
  EXPEDICAO: 'Expedição',
  MULTIUSO: 'Multiuso',
}

const yardDockStore = useYardDockStore()
const warehouseStore = useWarehouseStore()
const toast = useToast()

const dockList = ref<YardDock[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const editingDock = ref<YardDock | null>(null)
const filters = ref({ warehouseId: '', serviceType: '', active: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({
  code: '',
  serviceType: 'RECEBIMENTO' as DockServiceType,
  warehouseId: '',
  storagePositionId: null as string | null,
  active: true,
})
const positionCodeInput = ref('')
const positionLookupMessage = ref('')
const positionLookupError = ref(false)

const loadDocks = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await yardDockStore.fetchDocks(pagination.value.page, pagination.value.limit, {
      warehouseId: filters.value.warehouseId || undefined,
      serviceType: (filters.value.serviceType || undefined) as DockServiceType | undefined,
      active: filters.value.active ? filters.value.active === 'true' : undefined,
    })
    dockList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar docas'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadDocks() }
const changePage = (page: number) => { pagination.value.page = page; loadDocks() }
const resetFormData = () => ({
  code: '',
  serviceType: 'RECEBIMENTO' as DockServiceType,
  warehouseId: '',
  storagePositionId: null as string | null,
  active: true,
})
const openCreateModal = () => {
  editingDock.value = null
  formData.value = resetFormData()
  positionCodeInput.value = ''
  positionLookupMessage.value = ''
  showModal.value = true
}
const openEditModal = (dock: YardDock) => {
  editingDock.value = dock
  formData.value = {
    code: dock.code,
    serviceType: dock.serviceType,
    warehouseId: dock.warehouseId,
    storagePositionId: dock.storagePositionId,
    active: dock.active,
  }
  positionCodeInput.value = dock.storagePosition?.code || ''
  positionLookupMessage.value = ''
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingDock.value = null }

const handleLookupPosition = async () => {
  if (!positionCodeInput.value.trim()) {
    formData.value.storagePositionId = null
    positionLookupMessage.value = ''
    return
  }
  try {
    const result = await storagePositionService.getPositionByCode(positionCodeInput.value.trim())
    formData.value.storagePositionId = result.data.id
    positionLookupMessage.value = `Posição encontrada: ${result.data.code}`
    positionLookupError.value = false
  } catch (err: any) {
    formData.value.storagePositionId = null
    positionLookupMessage.value = err.response?.data?.message || 'Posição não encontrada'
    positionLookupError.value = true
  }
}

const handleSubmit = async () => {
  try {
    saving.value = true
    if (editingDock.value) {
      const { warehouseId, ...updateData } = formData.value
      await yardDockStore.updateDock(editingDock.value.id, updateData)
      toast.success('Doca atualizada com sucesso!')
    } else {
      await yardDockStore.createDock(formData.value)
      toast.success('Doca criada com sucesso!')
    }
    closeModal()
    await loadDocks()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar doca')
  } finally {
    saving.value = false
  }
}

const handleDelete = async (dock: YardDock) => {
  if (await confirmDialog(`Deseja realmente excluir a doca "${dock.code}"?`)) {
    try {
      await yardDockStore.deleteDock(dock.id)
      toast.success('Doca excluída com sucesso!')
      await loadDocks()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir doca')
    }
  }
}

const asItem = (item: unknown) => item as YardDock

onMounted(async () => {
  await warehouseStore.fetchWarehouses()
  await loadDocks()
})
</script>
```

- [ ] **Step 6: Rodar o teste e verificar que passa**

```bash
npx vitest run src/views/yard/__tests__/YardDockListView.spec.ts
```

Esperado: 2/2.

- [ ] **Step 7: Montar a rota**

Em `frontend/src/router/index.ts`, adicionar (mesmo padrão de `/maintenance/equipment`):

```typescript
  {
    path: '/yard/docks',
    name: 'yard-docks',
    component: () => import('../views/yard/YardDockListView.vue'),
    meta: { requiresAuth: true }
  },
```

- [ ] **Step 8: Atualizar a aba "Pátio" do Dashboard**

Em `frontend/src/views/DashboardView.vue`, dentro do bloco `<div v-else-if="activeTab === 'yms' && authStore.canViewYMS" ...>` (linha ~354), trocar o card estático "Docas" (linhas ~362-368):

```vue
            <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed dark:border-gray-700 dark:bg-gray-900">
              <div class="text-center">
                <div class="text-3xl mb-2">🚪</div>
                <p class="text-sm font-medium text-gray-500">Docas</p>
                <p class="text-xs text-gray-400 mt-1">Em breve</p>
              </div>
            </div>
```

por um `RouterLink` de verdade (mesmo padrão da aba Manutenção):

```vue
            <RouterLink
              to="/yard/docks"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🚪</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Docas</p>
              </div>
            </RouterLink>
```

Não mexer nos outros 4 cards desta aba (Agendamento, Check-in/out, Tempo de Pátio, Relatórios YMS) — continuam "Em breve", pertencem a sub-projetos futuros.

- [ ] **Step 9: Rodar a suíte completa do frontend + type-check**

```bash
npx vitest run && npx vue-tsc --noEmit
```

Esperado: todos os testes passando; `vue-tsc` sem novos erros além da baseline atual do projeto.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/services/yard-dock.service.ts frontend/src/stores/yard-dock.store.ts frontend/src/views/yard/YardDockListView.vue frontend/src/views/yard/__tests__/YardDockListView.spec.ts frontend/src/router/index.ts frontend/src/views/DashboardView.vue
git commit -m "feat(yms): adiciona aba Pátio no Dashboard e CRUD de Docas"
```

---

### Task 8: Frontend — CRUD de Motoristas

**Files:**
- Create: `frontend/src/services/driver.service.ts`
- Create: `frontend/src/stores/driver.store.ts`
- Create: `frontend/src/views/yard/DriverListView.vue`
- Create: `frontend/src/views/yard/__tests__/DriverListView.spec.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /drivers` + `PATCH /drivers/:id/blocked` (Task 3); `useSupplierStore` (`frontend/src/stores/supplier.store.ts`, já existente — `suppliers`, `fetchSuppliers()`).
- Produces: nenhuma outra task depende deste arquivo.

**Padrão de bloqueio com motivo, usado também nas Tasks 9 e 10**: um segundo `AppModal` (`showBlockModal`, separado do modal de criar/editar) com um único campo `blockReasonInput` (textarea) — abrir com "Bloquear" preenche o motivo; "Desbloquear" não abre modal nenhum, só pede confirmação via `confirmDialog` (o motivo é limpo no backend automaticamente quando `blocked: false`, ver `driverService.setBlocked` do Step 4 da Task 3).

- [ ] **Step 1: `driver.service.ts`**

Criar `frontend/src/services/driver.service.ts`:

```typescript
import api from './api.service'

export interface SupplierRef {
  id: string
  code: string
  name: string
}

export interface Driver {
  id: string
  name: string
  cpf: string
  supplierId: string
  blocked: boolean
  blockedReason: string | null
  createdAt: string
  updatedAt: string
  supplier?: SupplierRef
}

export interface CreateDriverDto {
  name: string
  cpf: string
  supplierId: string
}

export interface UpdateDriverDto extends Partial<CreateDriverDto> {}

class DriverService {
  private readonly basePath = '/drivers'

  async getAll(page = 1, limit = 100, filters?: { supplierId?: string; blocked?: boolean; search?: string }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.supplierId) params.append('supplierId', filters.supplierId)
    if (filters?.blocked !== undefined) params.append('blocked', filters.blocked.toString())
    if (filters?.search) params.append('search', filters.search)
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateDriverDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateDriverDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return api.patch(`${this.basePath}/${id}/blocked`, { blocked, blockedReason })
  }
}

export default new DriverService()
```

- [ ] **Step 2: `driver.store.ts`**

Criar `frontend/src/stores/driver.store.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import driverService, { type Driver, type CreateDriverDto, type UpdateDriverDto } from '@/services/driver.service'

export const useDriverStore = defineStore('driver', () => {
  const drivers = ref<Driver[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchDrivers = async (page = 1, limit = 100, filters?: { supplierId?: string; blocked?: boolean; search?: string }) => {
    try {
      loading.value = true
      error.value = null
      const response = await driverService.getAll(page, limit, filters)
      drivers.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar motoristas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createDriver = async (data: CreateDriverDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await driverService.create(data)
      await fetchDrivers()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar motorista'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateDriver = async (id: string, data: UpdateDriverDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await driverService.update(id, data)
      await fetchDrivers()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar motorista'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteDriver = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await driverService.delete(id)
      await fetchDrivers()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir motorista'
      throw err
    } finally {
      loading.value = false
    }
  }

  const setBlocked = async (id: string, blocked: boolean, blockedReason: string | null) => {
    try {
      loading.value = true
      error.value = null
      await driverService.setBlocked(id, blocked, blockedReason)
      await fetchDrivers()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar bloqueio'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { drivers, loading, error, fetchDrivers, createDriver, updateDriver, deleteDriver, setBlocked }
})
```

- [ ] **Step 3: Escrever o teste da view**

Criar `frontend/src/views/yard/__tests__/DriverListView.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import DriverListView from '../DriverListView.vue'
import driverService from '@/services/driver.service'
import supplierService from '@/services/supplier.service'

vi.mock('@/services/driver.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))

vi.mock('@/services/supplier.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockSupplier = { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa', active: true, createdAt: '', updatedAt: '' }

const mockDriver = {
  id: 'drv-1',
  name: 'João da Silva',
  cpf: '12345678901',
  supplierId: 'sup-1',
  blocked: false,
  blockedReason: null,
  createdAt: '',
  updatedAt: '',
  supplier: { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/drivers', component: DriverListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('DriverListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(supplierService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockSupplier], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de motoristas', async () => {
    vi.mocked(driverService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockDriver], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/drivers')
    await router.isReady()

    const wrapper = mount(DriverListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('João da Silva')
    expect(wrapper.text()).toContain('Transportadora Alfa')
  })

  it('bloqueia um motorista informando o motivo', async () => {
    vi.mocked(driverService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockDriver], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(driverService.setBlocked).mockResolvedValue({ data: { status: 'success', data: { ...mockDriver, blocked: true } } } as any)

    const router = makeRouter()
    router.push('/yard/drivers')
    await router.isReady()

    const wrapper = mount(DriverListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const blockButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Bloquear')!
    await blockButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#driver-block-reason').setValue('CNH vencida')
    await body.find('#driver-block-form').trigger('submit.prevent')
    await flushPromises()

    expect(driverService.setBlocked).toHaveBeenCalledWith('drv-1', true, 'CNH vencida')
  })
})
```

- [ ] **Step 4: Rodar o teste e verificar que falha**

```bash
npx vitest run src/views/yard/__tests__/DriverListView.spec.ts
```

Esperado: FAIL (`Cannot find module '../DriverListView.vue'`).

- [ ] **Step 5: `DriverListView.vue`**

Criar `frontend/src/views/yard/DriverListView.vue`:

```vue
<template>
  <AppLayout title="Motoristas" subtitle="Gerencie os motoristas cadastrados no pátio">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Motorista</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="driver-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Nome ou CPF..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="driver-filter-supplier" label="Fornecedor">
          <select
            v-model="filters.supplierId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="driverList"
      :pagination="pagination"
      empty-title="Nenhum motorista encontrado"
      empty-hint="Ajuste os filtros ou cadastre um novo motorista."
      @retry="loadDrivers"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Motorista</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">CPF</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fornecedor</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).cpf }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).supplier?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).blocked ? 'Bloqueado' : 'Ativo'"
            :tone="asItem(item).blocked ? 'danger' : 'success'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button v-if="!asItem(item).blocked" @click="openBlockModal(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Bloquear</button>
          <button v-else @click="handleUnblock(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Desbloquear</button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingDriver ? 'Editar Motorista' : 'Novo Motorista'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="driver-form-name" label="Nome" required>
          <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>
        <FormField id="driver-form-cpf" label="CPF (somente números)" required>
          <input v-model="formData.cpf" type="text" required maxlength="11" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>
        <FormField id="driver-form-supplier" label="Fornecedor" required>
          <select v-model="formData.supplierId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingDriver ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showBlockModal" title="Bloquear Motorista" @close="closeBlockModal">
      <form id="driver-block-form" @submit.prevent="handleConfirmBlock" class="space-y-4">
        <FormField id="driver-block-reason" label="Motivo do bloqueio" required>
          <textarea v-model="blockReasonInput" rows="3" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeBlockModal" class="flex-1">Cancelar</Button>
          <Button type="submit" class="flex-1">Bloquear</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDriverStore } from '@/stores/driver.store'
import { useSupplierStore } from '@/stores/supplier.store'
import type { Driver } from '@/services/driver.service'
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

const driverStore = useDriverStore()
const supplierStore = useSupplierStore()
const toast = useToast()

const driverList = ref<Driver[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const showBlockModal = ref(false)
const editingDriver = ref<Driver | null>(null)
const blockingDriver = ref<Driver | null>(null)
const blockReasonInput = ref('')
const filters = ref({ search: '', supplierId: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({ name: '', cpf: '', supplierId: '' })

const loadDrivers = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await driverStore.fetchDrivers(pagination.value.page, pagination.value.limit, {
      supplierId: filters.value.supplierId || undefined,
      search: filters.value.search || undefined,
    })
    driverList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar motoristas'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadDrivers() }
const debouncedFilterChange = useDebounce(handleFilterChange, 350)
const changePage = (page: number) => { pagination.value.page = page; loadDrivers() }
const resetFormData = () => ({ name: '', cpf: '', supplierId: '' })
const openCreateModal = () => { editingDriver.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (driver: Driver) => {
  editingDriver.value = driver
  formData.value = { name: driver.name, cpf: driver.cpf, supplierId: driver.supplierId }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingDriver.value = null }

const openBlockModal = (driver: Driver) => { blockingDriver.value = driver; blockReasonInput.value = ''; showBlockModal.value = true }
const closeBlockModal = () => { showBlockModal.value = false; blockingDriver.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    if (editingDriver.value) {
      await driverStore.updateDriver(editingDriver.value.id, formData.value)
      toast.success('Motorista atualizado com sucesso!')
    } else {
      await driverStore.createDriver(formData.value)
      toast.success('Motorista criado com sucesso!')
    }
    closeModal()
    await loadDrivers()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar motorista')
  } finally {
    saving.value = false
  }
}

const handleConfirmBlock = async () => {
  if (!blockingDriver.value) return
  try {
    await driverStore.setBlocked(blockingDriver.value.id, true, blockReasonInput.value)
    toast.success('Motorista bloqueado com sucesso!')
    closeBlockModal()
    await loadDrivers()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao bloquear motorista')
  }
}

const handleUnblock = async (driver: Driver) => {
  if (await confirmDialog(`Deseja desbloquear o motorista "${driver.name}"?`)) {
    try {
      await driverStore.setBlocked(driver.id, false, null)
      toast.success('Motorista desbloqueado com sucesso!')
      await loadDrivers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbloquear motorista')
    }
  }
}

const handleDelete = async (driver: Driver) => {
  if (await confirmDialog(`Deseja realmente excluir o motorista "${driver.name}"?`)) {
    try {
      await driverStore.deleteDriver(driver.id)
      toast.success('Motorista excluído com sucesso!')
      await loadDrivers()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir motorista')
    }
  }
}

const asItem = (item: unknown) => item as Driver

onMounted(async () => {
  await supplierStore.fetchSuppliers()
  await loadDrivers()
})
</script>
```

- [ ] **Step 6: Rodar o teste e verificar que passa**

```bash
npx vitest run src/views/yard/__tests__/DriverListView.spec.ts
```

Esperado: 2/2.

- [ ] **Step 7: Montar a rota**

Em `frontend/src/router/index.ts`, adicionar:

```typescript
  {
    path: '/yard/drivers',
    name: 'yard-drivers',
    component: () => import('../views/yard/DriverListView.vue'),
    meta: { requiresAuth: true }
  },
```

- [ ] **Step 8: Adicionar o card "Motoristas" na aba "Pátio" do Dashboard**

Em `frontend/src/views/DashboardView.vue`, dentro do mesmo bloco `activeTab === 'yms'`, ADICIONAR um novo `RouterLink` (não troca nenhum card existente — os 4 cards "Em breve" restantes continuam intactos):

```vue
            <RouterLink
              to="/yard/drivers"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🧑‍✈️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Motoristas</p>
              </div>
            </RouterLink>
```

- [ ] **Step 9: Rodar a suíte completa do frontend + type-check**

```bash
npx vitest run && npx vue-tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/services/driver.service.ts frontend/src/stores/driver.store.ts frontend/src/views/yard/DriverListView.vue frontend/src/views/yard/__tests__/DriverListView.spec.ts frontend/src/router/index.ts frontend/src/views/DashboardView.vue
git commit -m "feat(yms): adiciona CRUD de Motoristas ao frontend"
```

---

### Task 9: Frontend — CRUD de Frotas

**Files:**
- Create: `frontend/src/services/fleet.service.ts`
- Create: `frontend/src/stores/fleet.store.ts`
- Create: `frontend/src/views/yard/FleetListView.vue`
- Create: `frontend/src/views/yard/__tests__/FleetListView.spec.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /fleets` + `PATCH /fleets/:id/blocked` (Task 4, resposta inclui `_count.vehicles`); `useSupplierStore` (já existente).
- Produces: nenhuma outra task depende deste arquivo. Mesmo padrão de modal de bloqueio com motivo da Task 8, com o acréscimo do aviso de quantos veículos serão afetados.

- [ ] **Step 1: `fleet.service.ts`**

Criar `frontend/src/services/fleet.service.ts`:

```typescript
import api from './api.service'

export interface SupplierRef {
  id: string
  code: string
  name: string
}

export interface Fleet {
  id: string
  name: string
  supplierId: string
  blocked: boolean
  blockedReason: string | null
  createdAt: string
  updatedAt: string
  supplier?: SupplierRef
  _count?: { vehicles: number }
}

export interface CreateFleetDto {
  name: string
  supplierId: string
}

export interface UpdateFleetDto {
  name?: string
}

class FleetService {
  private readonly basePath = '/fleets'

  async getAll(page = 1, limit = 100, filters?: { supplierId?: string; blocked?: boolean }) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.supplierId) params.append('supplierId', filters.supplierId)
    if (filters?.blocked !== undefined) params.append('blocked', filters.blocked.toString())
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateFleetDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateFleetDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return api.patch(`${this.basePath}/${id}/blocked`, { blocked, blockedReason })
  }
}

export default new FleetService()
```

- [ ] **Step 2: `fleet.store.ts`**

Criar `frontend/src/stores/fleet.store.ts` (mesma estrutura de `driver.store.ts`, adaptada):

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import fleetService, { type Fleet, type CreateFleetDto, type UpdateFleetDto } from '@/services/fleet.service'

export const useFleetStore = defineStore('fleet', () => {
  const fleets = ref<Fleet[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchFleets = async (page = 1, limit = 100, filters?: { supplierId?: string; blocked?: boolean }) => {
    try {
      loading.value = true
      error.value = null
      const response = await fleetService.getAll(page, limit, filters)
      fleets.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar frotas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createFleet = async (data: CreateFleetDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await fleetService.create(data)
      await fetchFleets()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar frota'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateFleet = async (id: string, data: UpdateFleetDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await fleetService.update(id, data)
      await fetchFleets()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar frota'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteFleet = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await fleetService.delete(id)
      await fetchFleets()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir frota'
      throw err
    } finally {
      loading.value = false
    }
  }

  const setBlocked = async (id: string, blocked: boolean, blockedReason: string | null) => {
    try {
      loading.value = true
      error.value = null
      await fleetService.setBlocked(id, blocked, blockedReason)
      await fetchFleets()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar bloqueio'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { fleets, loading, error, fetchFleets, createFleet, updateFleet, deleteFleet, setBlocked }
})
```

- [ ] **Step 3: Escrever o teste da view**

Criar `frontend/src/views/yard/__tests__/FleetListView.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import FleetListView from '../FleetListView.vue'
import fleetService from '@/services/fleet.service'
import supplierService from '@/services/supplier.service'

vi.mock('@/services/fleet.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))

vi.mock('@/services/supplier.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockSupplier = { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa', active: true, createdAt: '', updatedAt: '' }

const mockFleet = {
  id: 'fleet-1',
  name: 'Frota Refrigerada',
  supplierId: 'sup-1',
  blocked: false,
  blockedReason: null,
  createdAt: '',
  updatedAt: '',
  supplier: { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa' },
  _count: { vehicles: 3 },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/fleets', component: FleetListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('FleetListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(supplierService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockSupplier], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de frotas, com a contagem de veículos', async () => {
    vi.mocked(fleetService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockFleet], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/fleets')
    await router.isReady()

    const wrapper = mount(FleetListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Frota Refrigerada')
    expect(wrapper.text()).toContain('3')
  })

  it('bloqueia uma frota informando o motivo', async () => {
    vi.mocked(fleetService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockFleet], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(fleetService.setBlocked).mockResolvedValue({ data: { status: 'success', data: { ...mockFleet, blocked: true } } } as any)

    const router = makeRouter()
    router.push('/yard/fleets')
    await router.isReady()

    const wrapper = mount(FleetListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const blockButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Bloquear')!
    await blockButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    expect(body.text()).toContain('3 veículo')
    await body.find('#fleet-block-reason').setValue('Inadimplência')
    await body.find('#fleet-block-form').trigger('submit.prevent')
    await flushPromises()

    expect(fleetService.setBlocked).toHaveBeenCalledWith('fleet-1', true, 'Inadimplência')
  })
})
```

- [ ] **Step 4: Rodar o teste e verificar que falha**

```bash
npx vitest run src/views/yard/__tests__/FleetListView.spec.ts
```

Esperado: FAIL (`Cannot find module '../FleetListView.vue'`).

- [ ] **Step 5: `FleetListView.vue`**

Criar `frontend/src/views/yard/FleetListView.vue`:

```vue
<template>
  <AppLayout title="Frotas" subtitle="Gerencie as frotas de veículos por fornecedor">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Frota</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="fleet-filter-supplier" label="Fornecedor">
          <select
            v-model="filters.supplierId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="fleetList"
      :pagination="pagination"
      empty-title="Nenhuma frota encontrada"
      empty-hint="Ajuste os filtros ou cadastre uma nova frota."
      @retry="loadFleets"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Frota</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fornecedor</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Veículos</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).supplier?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item)._count?.vehicles ?? 0 }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).blocked ? 'Bloqueada' : 'Ativa'"
            :tone="asItem(item).blocked ? 'danger' : 'success'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button v-if="!asItem(item).blocked" @click="openBlockModal(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Bloquear</button>
          <button v-else @click="handleUnblock(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Desbloquear</button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingFleet ? 'Editar Frota' : 'Nova Frota'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <FormField id="fleet-form-name" label="Nome" required>
          <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>
        <FormField id="fleet-form-supplier" label="Fornecedor" required>
          <select v-model="formData.supplierId" required :disabled="!!editingFleet" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingFleet ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showBlockModal" title="Bloquear Frota" @close="closeBlockModal">
      <form id="fleet-block-form" @submit.prevent="handleConfirmBlock" class="space-y-4">
        <p v-if="blockingFleet" class="text-sm text-gray-600 dark:text-gray-400">
          Bloquear esta frota também bloqueia {{ blockingFleet._count?.vehicles ?? 0 }} veículo(s) vinculado(s) a ela.
        </p>
        <FormField id="fleet-block-reason" label="Motivo do bloqueio" required>
          <textarea v-model="blockReasonInput" rows="3" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeBlockModal" class="flex-1">Cancelar</Button>
          <Button type="submit" class="flex-1">Bloquear</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useFleetStore } from '@/stores/fleet.store'
import { useSupplierStore } from '@/stores/supplier.store'
import type { Fleet } from '@/services/fleet.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const fleetStore = useFleetStore()
const supplierStore = useSupplierStore()
const toast = useToast()

const fleetList = ref<Fleet[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const showBlockModal = ref(false)
const editingFleet = ref<Fleet | null>(null)
const blockingFleet = ref<Fleet | null>(null)
const blockReasonInput = ref('')
const filters = ref({ supplierId: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({ name: '', supplierId: '' })

const loadFleets = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await fleetStore.fetchFleets(pagination.value.page, pagination.value.limit, {
      supplierId: filters.value.supplierId || undefined,
    })
    fleetList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar frotas'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadFleets() }
const changePage = (page: number) => { pagination.value.page = page; loadFleets() }
const resetFormData = () => ({ name: '', supplierId: '' })
const openCreateModal = () => { editingFleet.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (fleet: Fleet) => {
  editingFleet.value = fleet
  formData.value = { name: fleet.name, supplierId: fleet.supplierId }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingFleet.value = null }

const openBlockModal = (fleet: Fleet) => { blockingFleet.value = fleet; blockReasonInput.value = ''; showBlockModal.value = true }
const closeBlockModal = () => { showBlockModal.value = false; blockingFleet.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    if (editingFleet.value) {
      await fleetStore.updateFleet(editingFleet.value.id, { name: formData.value.name })
      toast.success('Frota atualizada com sucesso!')
    } else {
      await fleetStore.createFleet(formData.value)
      toast.success('Frota criada com sucesso!')
    }
    closeModal()
    await loadFleets()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar frota')
  } finally {
    saving.value = false
  }
}

const handleConfirmBlock = async () => {
  if (!blockingFleet.value) return
  try {
    await fleetStore.setBlocked(blockingFleet.value.id, true, blockReasonInput.value)
    toast.success('Frota bloqueada com sucesso!')
    closeBlockModal()
    await loadFleets()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao bloquear frota')
  }
}

const handleUnblock = async (fleet: Fleet) => {
  if (await confirmDialog(`Deseja desbloquear a frota "${fleet.name}"?`)) {
    try {
      await fleetStore.setBlocked(fleet.id, false, null)
      toast.success('Frota desbloqueada com sucesso!')
      await loadFleets()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbloquear frota')
    }
  }
}

const handleDelete = async (fleet: Fleet) => {
  if (await confirmDialog(`Deseja realmente excluir a frota "${fleet.name}"?`)) {
    try {
      await fleetStore.deleteFleet(fleet.id)
      toast.success('Frota excluída com sucesso!')
      await loadFleets()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir frota')
    }
  }
}

const asItem = (item: unknown) => item as Fleet

onMounted(async () => {
  await supplierStore.fetchSuppliers()
  await loadFleets()
})
</script>
```

- [ ] **Step 6: Rodar o teste e verificar que passa**

```bash
npx vitest run src/views/yard/__tests__/FleetListView.spec.ts
```

Esperado: 2/2.

- [ ] **Step 7: Montar a rota**

Em `frontend/src/router/index.ts`, adicionar:

```typescript
  {
    path: '/yard/fleets',
    name: 'yard-fleets',
    component: () => import('../views/yard/FleetListView.vue'),
    meta: { requiresAuth: true }
  },
```

- [ ] **Step 8: Adicionar o card "Frotas" na aba "Pátio" do Dashboard**

Em `frontend/src/views/DashboardView.vue`, dentro do bloco `activeTab === 'yms'`, ADICIONAR:

```vue
            <RouterLink
              to="/yard/fleets"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🚛</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Frotas</p>
              </div>
            </RouterLink>
```

- [ ] **Step 9: Rodar a suíte completa do frontend + type-check**

```bash
npx vitest run && npx vue-tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/services/fleet.service.ts frontend/src/stores/fleet.store.ts frontend/src/views/yard/FleetListView.vue frontend/src/views/yard/__tests__/FleetListView.spec.ts frontend/src/router/index.ts frontend/src/views/DashboardView.vue
git commit -m "feat(yms): adiciona CRUD de Frotas ao frontend"
```

---

### Task 10: Frontend — CRUD de Veículos

**Files:**
- Create: `frontend/src/services/vehicle.service.ts`
- Create: `frontend/src/stores/vehicle.store.ts`
- Create: `frontend/src/views/yard/VehicleListView.vue`
- Create: `frontend/src/views/yard/__tests__/VehicleListView.spec.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /vehicles` + `PATCH /vehicles/:id/blocked` (Task 5); `useSupplierStore` e `useFleetStore` (Task 9) — a frota exibida no formulário é filtrada client-side pelo fornecedor selecionado (`fleetStore.fleets.filter(f => f.supplierId === formData.supplierId)`), sem chamada extra ao backend.
- Produces: nenhuma outra task depende deste arquivo. Mesmo padrão de modal de bloqueio com motivo das Tasks 8/9.

- [ ] **Step 1: `vehicle.service.ts`**

Criar `frontend/src/services/vehicle.service.ts`:

```typescript
import api from './api.service'

export interface SupplierRef {
  id: string
  code: string
  name: string
}

export interface FleetRef {
  id: string
  name: string
}

export type VehicleType = 'TRUCK' | 'TOCO' | 'CAVALO' | 'MECANICO' | 'VAN' | 'UTILITARIO' | 'OUTROS'

export interface Vehicle {
  id: string
  plate: string
  type: VehicleType
  model: string | null
  supplierId: string
  fleetId: string | null
  blocked: boolean
  blockedReason: string | null
  createdAt: string
  updatedAt: string
  supplier?: SupplierRef
  fleet?: FleetRef | null
}

export interface CreateVehicleDto {
  plate: string
  type: VehicleType
  model?: string | null
  supplierId: string
  fleetId?: string | null
}

export interface UpdateVehicleDto extends Partial<CreateVehicleDto> {}

class VehicleService {
  private readonly basePath = '/vehicles'

  async getAll(
    page = 1,
    limit = 100,
    filters?: { supplierId?: string; fleetId?: string; type?: VehicleType; blocked?: boolean; search?: string }
  ) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.supplierId) params.append('supplierId', filters.supplierId)
    if (filters?.fleetId) params.append('fleetId', filters.fleetId)
    if (filters?.type) params.append('type', filters.type)
    if (filters?.blocked !== undefined) params.append('blocked', filters.blocked.toString())
    if (filters?.search) params.append('search', filters.search)
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateVehicleDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateVehicleDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async setBlocked(id: string, blocked: boolean, blockedReason: string | null) {
    return api.patch(`${this.basePath}/${id}/blocked`, { blocked, blockedReason })
  }
}

export default new VehicleService()
```

- [ ] **Step 2: `vehicle.store.ts`**

Criar `frontend/src/stores/vehicle.store.ts` (mesma estrutura das anteriores):

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import vehicleService, { type Vehicle, type CreateVehicleDto, type UpdateVehicleDto, type VehicleType } from '@/services/vehicle.service'

export const useVehicleStore = defineStore('vehicle', () => {
  const vehicles = ref<Vehicle[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchVehicles = async (
    page = 1,
    limit = 100,
    filters?: { supplierId?: string; fleetId?: string; type?: VehicleType; blocked?: boolean; search?: string }
  ) => {
    try {
      loading.value = true
      error.value = null
      const response = await vehicleService.getAll(page, limit, filters)
      vehicles.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar veículos'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createVehicle = async (data: CreateVehicleDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await vehicleService.create(data)
      await fetchVehicles()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar veículo'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateVehicle = async (id: string, data: UpdateVehicleDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await vehicleService.update(id, data)
      await fetchVehicles()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar veículo'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteVehicle = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await vehicleService.delete(id)
      await fetchVehicles()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir veículo'
      throw err
    } finally {
      loading.value = false
    }
  }

  const setBlocked = async (id: string, blocked: boolean, blockedReason: string | null) => {
    try {
      loading.value = true
      error.value = null
      await vehicleService.setBlocked(id, blocked, blockedReason)
      await fetchVehicles()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar bloqueio'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { vehicles, loading, error, fetchVehicles, createVehicle, updateVehicle, deleteVehicle, setBlocked }
})
```

- [ ] **Step 3: Escrever o teste da view**

Criar `frontend/src/views/yard/__tests__/VehicleListView.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import VehicleListView from '../VehicleListView.vue'
import vehicleService from '@/services/vehicle.service'
import supplierService from '@/services/supplier.service'
import fleetService from '@/services/fleet.service'

vi.mock('@/services/vehicle.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))

vi.mock('@/services/supplier.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/services/fleet.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockSupplier = { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa', active: true, createdAt: '', updatedAt: '' }
const mockFleet = { id: 'fleet-1', name: 'Frota A', supplierId: 'sup-1', blocked: false, blockedReason: null, createdAt: '', updatedAt: '' }

const mockVehicle = {
  id: 'veh-1',
  plate: 'ABC1D23',
  type: 'TRUCK',
  supplierId: 'sup-1',
  fleetId: 'fleet-1',
  blocked: false,
  blockedReason: null,
  createdAt: '',
  updatedAt: '',
  supplier: { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa' },
  fleet: { id: 'fleet-1', name: 'Frota A' },
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/vehicles', component: VehicleListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('VehicleListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(supplierService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockSupplier], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(fleetService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockFleet], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de veículos', async () => {
    vi.mocked(vehicleService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockVehicle], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/vehicles')
    await router.isReady()

    const wrapper = mount(VehicleListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('ABC1D23')
    expect(wrapper.text()).toContain('Transportadora Alfa')
    expect(wrapper.text()).toContain('Frota A')
  })

  it('cria um veículo novo, com a frota filtrada pelo fornecedor selecionado', async () => {
    vi.mocked(vehicleService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(vehicleService.create).mockResolvedValue({ data: { status: 'success', data: mockVehicle } } as any)

    const router = makeRouter()
    router.push('/yard/vehicles')
    await router.isReady()

    const wrapper = mount(VehicleListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const novoButton = wrapper.findAll('button').find((b) => b.text().includes('Novo Veículo'))!
    await novoButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#vehicle-form-plate').setValue('abc1d23')
    await body.find('#vehicle-form-type').setValue('TRUCK')
    await body.find('#vehicle-form-supplier').setValue('sup-1')
    await wrapper.vm.$nextTick()
    // A frota só aparece disponível DEPOIS de escolher o fornecedor (filtro client-side).
    expect(body.find('#vehicle-form-fleet').findAll('option').some((o) => o.text() === 'Frota A')).toBe(true)
    await body.find('#vehicle-form-fleet').setValue('fleet-1')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(vehicleService.create).toHaveBeenCalledWith(
      expect.objectContaining({ plate: 'abc1d23', type: 'TRUCK', supplierId: 'sup-1', fleetId: 'fleet-1' })
    )
  })
})
```

- [ ] **Step 4: Rodar o teste e verificar que falha**

```bash
npx vitest run src/views/yard/__tests__/VehicleListView.spec.ts
```

Esperado: FAIL (`Cannot find module '../VehicleListView.vue'`).

- [ ] **Step 5: `VehicleListView.vue`**

Criar `frontend/src/views/yard/VehicleListView.vue`:

```vue
<template>
  <AppLayout title="Veículos" subtitle="Gerencie os veículos cadastrados no pátio">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Veículo</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <FormField id="vehicle-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Placa..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="vehicle-filter-supplier" label="Fornecedor">
          <select
            v-model="filters.supplierId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>
        <FormField id="vehicle-filter-type" label="Tipo">
          <select
            v-model="filters.type"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="type in VEHICLE_TYPES" :key="type" :value="type">{{ VEHICLE_TYPE_LABELS[type] }}</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="vehicleList"
      :pagination="pagination"
      empty-title="Nenhum veículo encontrado"
      empty-hint="Ajuste os filtros ou cadastre um novo veículo."
      @retry="loadVehicles"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Veículo</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Placa</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Tipo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fornecedor</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Frota</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).plate }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ VEHICLE_TYPE_LABELS[asItem(item).type] }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).supplier?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).fleet?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).blocked ? 'Bloqueado' : 'Ativo'"
            :tone="asItem(item).blocked ? 'danger' : 'success'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button v-if="!asItem(item).blocked" @click="openBlockModal(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Bloquear</button>
          <button v-else @click="handleUnblock(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Desbloquear</button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingVehicle ? 'Editar Veículo' : 'Novo Veículo'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="vehicle-form-plate" label="Placa" required>
            <input v-model="formData.plate" type="text" required maxlength="7" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 uppercase" />
          </FormField>
          <FormField id="vehicle-form-type" label="Tipo de Rodado" required>
            <select v-model="formData.type" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option v-for="type in VEHICLE_TYPES" :key="type" :value="type">{{ VEHICLE_TYPE_LABELS[type] }}</option>
            </select>
          </FormField>
        </div>

        <FormField id="vehicle-form-model" label="Modelo (opcional)">
          <input v-model="formData.model" type="text" placeholder="Ex.: Volvo FH" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <FormField id="vehicle-form-supplier" label="Fornecedor" required>
          <select v-model="formData.supplierId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @change="formData.fleetId = ''">
            <option value="">Selecione...</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>

        <FormField id="vehicle-form-fleet" label="Frota (opcional)">
          <select v-model="formData.fleetId" :disabled="!formData.supplierId" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Nenhuma</option>
            <option v-for="fleet in fleetsForSelectedSupplier" :key="fleet.id" :value="fleet.id">{{ fleet.name }}</option>
          </select>
        </FormField>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingVehicle ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showBlockModal" title="Bloquear Veículo" @close="closeBlockModal">
      <form id="vehicle-block-form" @submit.prevent="handleConfirmBlock" class="space-y-4">
        <FormField id="vehicle-block-reason" label="Motivo do bloqueio" required>
          <textarea v-model="blockReasonInput" rows="3" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeBlockModal" class="flex-1">Cancelar</Button>
          <Button type="submit" class="flex-1">Bloquear</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useVehicleStore } from '@/stores/vehicle.store'
import { useSupplierStore } from '@/stores/supplier.store'
import { useFleetStore } from '@/stores/fleet.store'
import type { Vehicle, VehicleType } from '@/services/vehicle.service'
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

const VEHICLE_TYPES: VehicleType[] = ['TRUCK', 'TOCO', 'CAVALO', 'MECANICO', 'VAN', 'UTILITARIO', 'OUTROS']
const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  TRUCK: 'Truck',
  TOCO: 'Toco',
  CAVALO: 'Cavalo',
  MECANICO: 'Mecânico',
  VAN: 'Van',
  UTILITARIO: 'Utilitário',
  OUTROS: 'Outros',
}

const vehicleStore = useVehicleStore()
const supplierStore = useSupplierStore()
const fleetStore = useFleetStore()
const toast = useToast()

const vehicleList = ref<Vehicle[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showModal = ref(false)
const showBlockModal = ref(false)
const editingVehicle = ref<Vehicle | null>(null)
const blockingVehicle = ref<Vehicle | null>(null)
const blockReasonInput = ref('')
const filters = ref({ search: '', supplierId: '', type: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({ plate: '', type: 'TRUCK' as VehicleType, model: '', supplierId: '', fleetId: '' })

const fleetsForSelectedSupplier = computed(() =>
  fleetStore.fleets.filter((f) => f.supplierId === formData.value.supplierId)
)

const loadVehicles = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await vehicleStore.fetchVehicles(pagination.value.page, pagination.value.limit, {
      supplierId: filters.value.supplierId || undefined,
      type: (filters.value.type || undefined) as VehicleType | undefined,
      search: filters.value.search || undefined,
    })
    vehicleList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar veículos'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadVehicles() }
const debouncedFilterChange = useDebounce(handleFilterChange, 350)
const changePage = (page: number) => { pagination.value.page = page; loadVehicles() }
const resetFormData = () => ({ plate: '', type: 'TRUCK' as VehicleType, model: '', supplierId: '', fleetId: '' })
const openCreateModal = () => { editingVehicle.value = null; formData.value = resetFormData(); showModal.value = true }
const openEditModal = (vehicle: Vehicle) => {
  editingVehicle.value = vehicle
  formData.value = { plate: vehicle.plate, type: vehicle.type, model: vehicle.model || '', supplierId: vehicle.supplierId, fleetId: vehicle.fleetId || '' }
  showModal.value = true
}
const closeModal = () => { showModal.value = false; editingVehicle.value = null }

const openBlockModal = (vehicle: Vehicle) => { blockingVehicle.value = vehicle; blockReasonInput.value = ''; showBlockModal.value = true }
const closeBlockModal = () => { showBlockModal.value = false; blockingVehicle.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    const data = { ...formData.value, model: formData.value.model || null, fleetId: formData.value.fleetId || null }
    if (editingVehicle.value) {
      await vehicleStore.updateVehicle(editingVehicle.value.id, data)
      toast.success('Veículo atualizado com sucesso!')
    } else {
      await vehicleStore.createVehicle(data)
      toast.success('Veículo criado com sucesso!')
    }
    closeModal()
    await loadVehicles()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar veículo')
  } finally {
    saving.value = false
  }
}

const handleConfirmBlock = async () => {
  if (!blockingVehicle.value) return
  try {
    await vehicleStore.setBlocked(blockingVehicle.value.id, true, blockReasonInput.value)
    toast.success('Veículo bloqueado com sucesso!')
    closeBlockModal()
    await loadVehicles()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao bloquear veículo')
  }
}

const handleUnblock = async (vehicle: Vehicle) => {
  if (await confirmDialog(`Deseja desbloquear o veículo "${vehicle.plate}"?`)) {
    try {
      await vehicleStore.setBlocked(vehicle.id, false, null)
      toast.success('Veículo desbloqueado com sucesso!')
      await loadVehicles()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbloquear veículo')
    }
  }
}

const handleDelete = async (vehicle: Vehicle) => {
  if (await confirmDialog(`Deseja realmente excluir o veículo "${vehicle.plate}"?`)) {
    try {
      await vehicleStore.deleteVehicle(vehicle.id)
      toast.success('Veículo excluído com sucesso!')
      await loadVehicles()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir veículo')
    }
  }
}

const asItem = (item: unknown) => item as Vehicle

onMounted(async () => {
  await supplierStore.fetchSuppliers()
  await fleetStore.fetchFleets()
  await loadVehicles()
})
</script>
```

- [ ] **Step 6: Rodar o teste e verificar que passa**

```bash
npx vitest run src/views/yard/__tests__/VehicleListView.spec.ts
```

Esperado: 2/2.

- [ ] **Step 7: Montar a rota**

Em `frontend/src/router/index.ts`, adicionar:

```typescript
  {
    path: '/yard/vehicles',
    name: 'yard-vehicles',
    component: () => import('../views/yard/VehicleListView.vue'),
    meta: { requiresAuth: true }
  },
```

- [ ] **Step 8: Adicionar o card "Veículos" na aba "Pátio" do Dashboard**

Em `frontend/src/views/DashboardView.vue`, dentro do bloco `activeTab === 'yms'`, ADICIONAR:

```vue
            <RouterLink
              to="/yard/vehicles"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🚛</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Veículos</p>
              </div>
            </RouterLink>
```

**Nota**: o ícone 🚛 já foi usado no card "Frotas" (Task 9) — a task de implementação pode escolher outro ícone (ex.: 🚗 ou 🚚) para diferenciar visualmente os dois cards, não é uma regra rígida, só evitar repetição óbvia lado a lado.

- [ ] **Step 9: Rodar a suíte completa do frontend + type-check**

```bash
npx vitest run && npx vue-tsc --noEmit
```

Esperado: **frontend inteiro (Tasks 7-10) completo**, sem nenhuma rota pendente na aba "Pátio" exceto as 4 que continuam fora de escopo (Agendamento, Check-in/out, Tempo de Pátio, Relatórios YMS).

- [ ] **Step 10: Commit**

```bash
git add frontend/src/services/vehicle.service.ts frontend/src/stores/vehicle.store.ts frontend/src/views/yard/VehicleListView.vue frontend/src/views/yard/__tests__/VehicleListView.spec.ts frontend/src/router/index.ts frontend/src/views/DashboardView.vue
git commit -m "feat(yms): adiciona CRUD de Veículos ao frontend"
```

---

### Task 11: Frontend — Parâmetros de Pátio por Armazém

**Files:**
- Create: `frontend/src/services/yard-warehouse-params.service.ts`
- Create: `frontend/src/views/yard/YardWarehouseParamsView.vue`
- Create: `frontend/src/views/yard/__tests__/YardWarehouseParamsView.spec.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `GET/PUT /yard-warehouse-params/:warehouseId` (Task 6); `useWarehouseStore` (já existente).
- Produces: nenhuma outra task depende deste arquivo.

**Decisão de encaixe na navegação**: em vez de editar `WarehousesView.vue` (tela existente do WMS, fora do escopo deste plano — é modal-based, sem sub-rota de detalhe por armazém hoje), esta task cria uma tela própria e pequena com um seletor de armazém no topo, reduzindo o raio de mudança a arquivos novos do YMS.

- [ ] **Step 1: `yard-warehouse-params.service.ts`**

Criar `frontend/src/services/yard-warehouse-params.service.ts`:

```typescript
import api from './api.service'

export interface YardWarehouseParams {
  id: string | null
  warehouseId: string
  useYard: boolean
  delayToleranceMinutes: number
  createdAt: string | null
  updatedAt: string | null
}

export interface UpsertYardWarehouseParamsDto {
  useYard: boolean
  delayToleranceMinutes: number
}

class YardWarehouseParamsService {
  private readonly basePath = '/yard-warehouse-params'

  async getByWarehouseId(warehouseId: string) {
    return api.get(`${this.basePath}/${warehouseId}`)
  }

  async upsert(warehouseId: string, data: UpsertYardWarehouseParamsDto) {
    return api.put(`${this.basePath}/${warehouseId}`, data)
  }
}

export default new YardWarehouseParamsService()
```

Sem store própria: só uma tela consome este serviço, e o estado (parâmetros do armazém selecionado) é local à view — não há necessidade de compartilhar entre componentes, mesmo critério que já vale para outras telas de configuração pontual do projeto.

- [ ] **Step 2: Escrever o teste da view**

Criar `frontend/src/views/yard/__tests__/YardWarehouseParamsView.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import YardWarehouseParamsView from '../YardWarehouseParamsView.vue'
import yardWarehouseParamsService from '@/services/yard-warehouse-params.service'
import warehouseService from '@/services/warehouse.service'

vi.mock('@/services/yard-warehouse-params.service', () => ({
  default: { getByWarehouseId: vi.fn(), upsert: vi.fn() },
}))

vi.mock('@/services/warehouse.service', () => ({
  default: { getAll: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockWarehouse = { id: 'wh-1', code: 'WH-1', name: 'Armazém Central', active: true, createdAt: '', updatedAt: '' }

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/warehouse-params', component: YardWarehouseParamsView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('YardWarehouseParamsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(warehouseService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockWarehouse], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
  })

  it('carrega os parâmetros do primeiro armazém ao montar', async () => {
    vi.mocked(yardWarehouseParamsService.getByWarehouseId).mockResolvedValue({
      data: { status: 'success', data: { id: null, warehouseId: 'wh-1', useYard: true, delayToleranceMinutes: 15, createdAt: null, updatedAt: null } },
    } as any)

    const router = makeRouter()
    router.push('/yard/warehouse-params')
    await router.isReady()

    const wrapper = mount(YardWarehouseParamsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(yardWarehouseParamsService.getByWarehouseId).toHaveBeenCalledWith('wh-1')
    const toleranceInput = wrapper.find('#yard-params-tolerance').element as HTMLInputElement
    expect(toleranceInput.value).toBe('15')
  })

  it('salva os parâmetros alterados', async () => {
    vi.mocked(yardWarehouseParamsService.getByWarehouseId).mockResolvedValue({
      data: { status: 'success', data: { id: null, warehouseId: 'wh-1', useYard: true, delayToleranceMinutes: 15, createdAt: null, updatedAt: null } },
    } as any)
    vi.mocked(yardWarehouseParamsService.upsert).mockResolvedValue({
      data: { status: 'success', data: { id: 'params-1', warehouseId: 'wh-1', useYard: false, delayToleranceMinutes: 30, createdAt: '', updatedAt: '' } },
    } as any)

    const router = makeRouter()
    router.push('/yard/warehouse-params')
    await router.isReady()

    const wrapper = mount(YardWarehouseParamsView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('#yard-params-use-yard').setValue(false)
    await wrapper.find('#yard-params-tolerance').setValue('30')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(yardWarehouseParamsService.upsert).toHaveBeenCalledWith('wh-1', { useYard: false, delayToleranceMinutes: 30 })
  })
})
```

- [ ] **Step 3: Rodar o teste e verificar que falha**

```bash
npx vitest run src/views/yard/__tests__/YardWarehouseParamsView.spec.ts
```

Esperado: FAIL (`Cannot find module '../YardWarehouseParamsView.vue'`).

- [ ] **Step 4: `YardWarehouseParamsView.vue`**

Criar `frontend/src/views/yard/YardWarehouseParamsView.vue`:

```vue
<template>
  <AppLayout title="Parâmetros de Pátio" subtitle="Configure o uso de pátio e a tolerância de atraso por armazém">
    <Card class="mb-6">
      <FormField id="yard-params-warehouse" label="Armazém">
        <select
          v-model="selectedWarehouseId"
          class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          @change="loadParams"
        >
          <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
        </select>
      </FormField>
    </Card>

    <Card v-if="selectedWarehouseId">
      <form @submit.prevent="handleSubmit" class="space-y-4 max-w-md">
        <div class="flex items-center">
          <input v-model="formData.useYard" type="checkbox" id="yard-params-use-yard" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="yard-params-use-yard" class="ml-2 text-sm text-gray-700 dark:text-gray-300">Usar etapa de Pátio (Portaria → Pátio → Doca)</label>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">Quando desmarcado, o fluxo passa direto de Portaria para Doca.</p>

        <FormField id="yard-params-tolerance" label="Tolerância de atraso (minutos)" required>
          <input
            v-model.number="formData.delayToleranceMinutes"
            type="number"
            min="0"
            max="60"
            required
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </FormField>

        <div class="pt-4">
          <Button type="submit" :disabled="saving">Salvar</Button>
        </div>
      </form>
    </Card>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWarehouseStore } from '@/stores/warehouse.store'
import yardWarehouseParamsService from '@/services/yard-warehouse-params.service'
import AppLayout from '@/components/common/AppLayout.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import FormField from '@/components/common/FormField.vue'
import { useToast } from '@/composables/useToast'

const warehouseStore = useWarehouseStore()
const toast = useToast()

const selectedWarehouseId = ref('')
const saving = ref(false)
const formData = ref({ useYard: true, delayToleranceMinutes: 15 })

const loadParams = async () => {
  if (!selectedWarehouseId.value) return
  try {
    const result = await yardWarehouseParamsService.getByWarehouseId(selectedWarehouseId.value)
    formData.value = { useYard: result.data.data.useYard, delayToleranceMinutes: result.data.data.delayToleranceMinutes }
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao carregar parâmetros')
  }
}

const handleSubmit = async () => {
  try {
    saving.value = true
    await yardWarehouseParamsService.upsert(selectedWarehouseId.value, formData.value)
    toast.success('Parâmetros salvos com sucesso!')
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar parâmetros')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await warehouseStore.fetchWarehouses()
  if (warehouseStore.warehouses.length > 0) {
    selectedWarehouseId.value = warehouseStore.warehouses[0].id
    await loadParams()
  }
})
</script>
```

- [ ] **Step 5: Rodar o teste e verificar que passa**

```bash
npx vitest run src/views/yard/__tests__/YardWarehouseParamsView.spec.ts
```

Esperado: 2/2.

- [ ] **Step 6: Montar a rota**

Em `frontend/src/router/index.ts`, adicionar:

```typescript
  {
    path: '/yard/warehouse-params',
    name: 'yard-warehouse-params',
    component: () => import('../views/yard/YardWarehouseParamsView.vue'),
    meta: { requiresAuth: true }
  },
```

- [ ] **Step 7: Adicionar um link de acesso a partir da tela de Docas**

Em `frontend/src/views/yard/YardDockListView.vue` (Task 7), no `<template #actions>` do `AppLayout`, adicionar um segundo botão ao lado de "Nova Doca":

```vue
    <template #actions>
      <RouterLink to="/yard/warehouse-params" class="text-sm text-primary-600 hover:underline mr-4 self-center">Parâmetros de Pátio</RouterLink>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Nova Doca</Button>
    </template>
```

(Precisa importar `RouterLink` do `vue-router` no `<script setup>` de `YardDockListView.vue`, caso ainda não esteja importado globalmente pelo projeto — confirme antes de adicionar o import, alguns projetos Vue registram `RouterLink` globalmente.)

- [ ] **Step 8: Rodar a suíte completa do frontend + type-check**

```bash
npx vitest run && npx vue-tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/services/yard-warehouse-params.service.ts frontend/src/views/yard/YardWarehouseParamsView.vue frontend/src/views/yard/__tests__/YardWarehouseParamsView.spec.ts frontend/src/views/yard/YardDockListView.vue frontend/src/router/index.ts
git commit -m "feat(yms): adiciona tela de parâmetros de pátio por armazém"
```

---

### Task 12: Verificação end-to-end real

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

Expected: sem erros; log do seed lista `YMS=on`.

- [ ] **Step 3: Fluxo completo via UI real (login como admin)**

1. Login como `admin@fabric.com`. Confirme que a aba "Pátio" aparece no Dashboard, e que os cards Docas/Motoristas/Frotas/Veículos estão clicáveis (os outros 4 continuam "Em breve").
2. `/yard/docks`: criar uma Doca de teste em um armazém existente, sem vincular a nenhuma posição.
3. Criar uma segunda Doca no MESMO armazém tentando reusar o mesmo código — confirmar que a UI mostra o erro "Já existe uma doca com este código neste armazém".
4. `/yard/drivers`: criar um Motorista vinculado a um fornecedor existente. Bloquear com um motivo, confirmar que o status muda para "Bloqueado" e o motivo aparece. Desbloquear.
5. `/yard/fleets`: criar uma Frota vinculada ao mesmo fornecedor do motorista.
6. `/yard/vehicles`: criar um Veículo com placa no formato Mercosul (ex.: `ABC1D23`) vinculado ao mesmo fornecedor e à frota criada — confirmar que a lista de frotas do formulário só mostra frotas daquele fornecedor. Tentar criar um segundo veículo com placa em formato inválido (ex.: `AB-1234`) e confirmar a mensagem de erro.
7. `/yard/warehouse-params`: trocar a tolerância de atraso para um valor entre 0-60, salvar, recarregar a página e confirmar que o valor persistiu. Tentar salvar um valor fora do intervalo (ex.: 90) e confirmar o erro.

- [ ] **Step 4: RBAC negativo**

Crie temporariamente um usuário/papel sem a permissão `yard:gerenciar` (ou remova-a temporariamente de um papel de teste) e confirme que os botões de criar/editar/bloquear ficam indisponíveis ou retornam 403 ao tentar (a UI deste plano não esconde botões por RBAC granular — só a aba inteira por `modules.view_yms`, mesmo padrão de Manutenção — então o esperado aqui é 403 do backend ao tentar a ação, não ausência do botão). Restaure a permissão depois do teste.

- [ ] **Step 5: Licenciamento negativo**

Via um script ou console do Prisma Studio, defina `LicensedModule.enabled = false` para `code = 'YMS'`, reinicie o backend (para recarregar o cache) e confirme que `GET /api/v1/yard-docks` retorna 404 mesmo para um usuário com todas as permissões RBAC de `yard`. Restaure `enabled = true` depois do teste.

- [ ] **Step 6: Relato final**

Sem commit neste task. Relate o resultado de cada step acima. Se algum problema for encontrado, corrija como um commit pequeno e focado no arquivo/comportamento específico identificado, e re-rode o step afetado.

---

## Pós-plano: o que ainda fica pendente do YMS

Este plano cobre só o primeiro dos 5 sub-projetos do YMS (seção "Etapa" no topo do documento). Agendamento de Veículos + Portaria/Check-in, Pátio (alocação de vaga, chamada automática), Operação de Doca (status OC/DP, início/término de carga/descarga) e Dashboard/KPIs continuam como itens de fila separados, cada um com seu próprio ciclo spec → plano → implementação quando for a vez deles — ver `docs/superpowers/specs/2026-09-08-yms-cadastros-base-design.md`, seção 2.5, para o que cada um cobre.
