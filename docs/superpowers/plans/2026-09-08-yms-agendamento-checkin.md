# YMS — Agendamento de Veículos + Portaria (Check-in) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o agendamento de veículos e o check-in de portaria do YMS: uma única entidade `YardVisit` que nasce agendada (com ou sem vínculo a um `PurchaseOrder`, para Recebimento) ou já em check-in (walk-in), com cálculo de pontualidade nunca persistido e as validações críticas de entrada (motorista/veículo bloqueado, placa duplicada ativa, fornecedor incompatível).

**Architecture:** Segue exatamente os padrões já estabelecidos nas Etapas anteriores do YMS e de Manutenção (service/controller/routes/validator por recurso, RBAC via `requirePermission`, licenciamento via `requireModule`). A pontualidade é um campo calculado na resposta da API, nunca uma coluna no banco — mesmo critério de `computeMttr`/`computeMtbfByEquipment` em `maintenance-kpi.service.ts`.

**Tech Stack:** Node.js + TypeScript + Express + Prisma + MySQL (backend), Vue 3 Composition API + Pinia + TailwindCSS (frontend), Jest (backend tests), Vitest (frontend tests).

## Global Constraints

- **Pré-requisito**: a Etapa 1 (Cadastros Base — `docs/superpowers/plans/2026-09-08-yms-cadastros-base.md`) precisa estar implementada antes desta — `YardVisit` referencia `Driver`, `Vehicle` e `YardWarehouseParams`, que só existem depois dela.
- `YardVisit` reaproveita o enum `DockServiceType` (RECEBIMENTO/EXPEDICAO/MULTIUSO) já criado na Etapa 1 — não duplicar o enum.
- `notes` é `@db.VarChar(70)` no schema (não `String?` puro) — o limite de 70 caracteres é regra de negócio explícita do documento de referência, reforçada no tipo do banco, não só no validator.
- Pontualidade (`NO_HORARIO`/`ANTECIPADO`/`ATRASADO`) é **sempre calculada na resposta da API, nunca uma coluna persistida**.
- `PurchaseOrder` **não tem `warehouseId`** — ao criar um agendamento de Recebimento vinculado a um pedido, o armazém continua sendo escolhido manualmente pelo usuário, nunca derivado do pedido.
- "Excluir agendamento" só é permitido em `status: SCHEDULED`. Depois do check-in, só `CANCELLED` (soft), nunca exclusão física.
- RBAC: nova ação `yard:executar` (criar agendamento, fazer check-in). `yard:gerenciar` (já existente da Etapa 1) cobre editar/excluir/cancelar — sem distinção de "próprio vs. terceiro" (o modelo não rastreia quem criou a visita).
- Validações de check-in (motorista bloqueado, veículo bloqueado, placa duplicada ativa em `CHECKED_IN`, motorista/veículo de fornecedor diferente da visita) são todas obrigatórias, nenhuma pode ser pulada.
- `requireModule('YMS')` no ponto de mount (já existe desde a Etapa 1) — a rota nova só precisa ser adicionada à lista já montada sob esse gate, não recriar o bloco.
- Migrations: gerar contra o banco de DEV via `npx prisma migrate dev --name <nome>` a partir do diretório `backend`. Rodar `npx prisma generate` depois.
- Tela nova nasce com dark mode desde o primeiro commit.

---

### Task 1: Schema Prisma + RBAC (`yard:executar`)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Consumes: `Warehouse`, `Supplier`, `PurchaseOrder`, `Driver`, `Vehicle`, `DockServiceType` (todos já existentes — os 3 últimos vêm da Etapa 1 dos Cadastros Base).
- Produces: model `YardVisit` e enum `YardVisitStatus`, usados pela Task 2. Permissão `yard:executar` no banco, usada pelas rotas da Task 2.

- [ ] **Step 1: Adicionar o model e o enum ao schema**

Em `backend/prisma/schema.prisma`, adicionar ao final do arquivo:

```prisma
enum YardVisitStatus {
  SCHEDULED
  CHECKED_IN
  CANCELLED
}

model YardVisit {
  id              String          @id @default(uuid())
  warehouseId     String
  serviceType     DockServiceType
  supplierId      String?
  purchaseOrderId String?
  scheduledAt     DateTime
  status          YardVisitStatus @default(SCHEDULED)
  notes           String?         @db.VarChar(70)
  driverId        String?
  vehicleId       String?
  checkedInAt     DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  warehouse     Warehouse      @relation(fields: [warehouseId], references: [id])
  supplier      Supplier?      @relation(fields: [supplierId], references: [id])
  purchaseOrder PurchaseOrder? @relation(fields: [purchaseOrderId], references: [id])
  driver        Driver?        @relation(fields: [driverId], references: [id])
  vehicle       Vehicle?       @relation(fields: [vehicleId], references: [id])

  @@index([warehouseId, status])
  @@index([vehicleId, status])
  @@map("yard_visits")
}
```

- [ ] **Step 2: Adicionar as relações reversas nos models existentes**

No model `Warehouse`, adicionar:

```prisma
  yardVisits YardVisit[]
```

No model `Supplier`, adicionar:

```prisma
  yardVisits YardVisit[]
```

No model `PurchaseOrder`, adicionar:

```prisma
  yardVisits YardVisit[]
```

No model `Driver` (criado na Etapa 1), adicionar:

```prisma
  yardVisits YardVisit[]
```

No model `Vehicle` (criado na Etapa 1), adicionar:

```prisma
  yardVisits YardVisit[]
```

- [ ] **Step 3: Gerar e aplicar a migration no banco de DEV**

A partir do diretório `backend`:

```bash
npx prisma migrate dev --name add_yard_visit
```

- [ ] **Step 4: Regenerar o Prisma Client**

```bash
npx prisma generate
```

- [ ] **Step 5: Adicionar a permissão `yard:executar`**

Em `backend/prisma/seed.ts`, no array `permissions` (junto às duas permissões `yard` já adicionadas na Etapa 1), adicionar:

```typescript
    { resource: 'yard', action: 'executar', description: 'Criar agendamentos e fazer check-in de veículos no pátio' },
```

- [ ] **Step 6: Atribuir a permissão a MANAGER e OPERATOR**

Em `backend/prisma/seed.ts`, trocar a linha `yard: ['visualizar', 'gerenciar'],` do `managerPermissions` (adicionada na Etapa 1) por:

```typescript
    yard: ['visualizar', 'executar', 'gerenciar'],
```

E trocar a linha `yard: ['visualizar'],` do `operatorPermissions` (também da Etapa 1) por:

```typescript
    yard: ['visualizar', 'executar'],
```

OPERATOR não recebe `gerenciar` — mesmo critério já usado em `manutencao` (quem executa não necessariamente administra/edita registros de terceiros).

- [ ] **Step 7: Rodar o seed e verificar**

```bash
npm run prisma:seed
```

Esperado: sem erros.

- [ ] **Step 8: Rodar a suíte de integração para confirmar não-regressão**

```bash
npm run test:integration
```

- [ ] **Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/seed.ts backend/prisma/migrations
git commit -m "feat(yms): adiciona schema de YardVisit e permissão yard:executar"
```

---

### Task 2: Backend — YardVisit (agendamento, check-in, cancelamento, validações)

**Files:**
- Create: `backend/src/services/yard-visit.service.ts`
- Create: `backend/src/controllers/yard-visit.controller.ts`
- Create: `backend/src/routes/yard-visit.routes.ts`
- Create: `backend/src/validators/yard-visit.validator.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/services/yard-visit.service.test.ts`

**Interfaces:**
- Consumes: `createTestSupplier()`, `createTestManager()` (`helpers/fixtures.ts`, já existentes); `yardWarehouseParamsService.getByWarehouseId(warehouseId)` (Etapa 1, Task 6 — devolve `{ useYard, delayToleranceMinutes, ... }`, com defaults quando o armazém não tem configuração própria); os models `Driver`/`Vehicle`/`Fleet` da Etapa 1.
- Produces: `YardVisitService`, montado em `/yard-visits`. Nenhuma outra task deste plano depende deste arquivo.

- [ ] **Step 1: Escrever os testes que falham**

Criar `backend/tests/services/yard-visit.service.test.ts`:

```typescript
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestSupplier, createTestManager, createTestPositions } from '../helpers/fixtures';
import yardVisitService from '../../src/services/yard-visit.service';
import driverService from '../../src/services/driver.service';
import vehicleService from '../../src/services/vehicle.service';

async function createTestPurchaseOrderMinimal(supplierId: string, expectedDate: Date) {
  const manager = await createTestManager();
  let counter = Math.floor(Math.random() * 1000000);
  return testPrisma.purchaseOrder.create({
    data: {
      orderNumber: `PO-YV-${counter}`,
      supplierId,
      expectedDate,
      totalValue: 0,
      createdBy: manager.id,
    },
  });
}

describe('YardVisitService', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria um agendamento manual sem vínculo com PurchaseOrder', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    const supplier = await createTestSupplier();

    const visit = await yardVisitService.create({
      warehouseId: warehouse.id,
      serviceType: 'EXPEDICAO',
      supplierId: supplier.id,
      scheduledAt: new Date(Date.now() + 3600_000),
    });

    expect(visit.status).toBe('SCHEDULED');
    expect(visit.purchaseOrderId).toBeNull();
  });

  it('cria um agendamento de Recebimento pré-preenchido a partir de um PurchaseOrder', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    const supplier = await createTestSupplier();
    const expectedDate = new Date(Date.now() + 7200_000);
    const po = await createTestPurchaseOrderMinimal(supplier.id, expectedDate);

    const visit = await yardVisitService.create({
      warehouseId: warehouse.id,
      serviceType: 'RECEBIMENTO',
      purchaseOrderId: po.id,
      scheduledAt: expectedDate,
    });

    expect(visit.purchaseOrderId).toBe(po.id);
    expect(visit.supplierId).toBe(supplier.id);
  });

  it('cria um walk-in (check-in direto) já com motorista e veículo, em status CHECKED_IN', async () => {
    const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
    const supplier = await createTestSupplier();
    const driver = await driverService.create({ name: 'Motorista Walk-in', cpf: '10101010101', supplierId: supplier.id });
    const vehicle = await vehicleService.create({ plate: 'ABC1234', type: 'TRUCK', supplierId: supplier.id });

    const visit = await yardVisitService.create({
      warehouseId: warehouse.id,
      serviceType: 'EXPEDICAO',
      supplierId: supplier.id,
      scheduledAt: new Date(),
      driverId: driver.id,
      vehicleId: vehicle.id,
    });

    expect(visit.status).toBe('CHECKED_IN');
    expect(visit.checkedInAt).not.toBeNull();
  });

  describe('checkIn — pontualidade', () => {
    it('calcula NO_HORARIO quando o check-in acontece dentro da tolerância', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: true, delayToleranceMinutes: 15 } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M1', cpf: '20202020202', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC2222', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: supplier.id,
        scheduledAt: new Date(),
      });

      const result = await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      expect(result.punctuality).toBe('NO_HORARIO');
    });

    it('calcula ATRASADO quando o check-in acontece depois da tolerância', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: true, delayToleranceMinutes: 10 } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M2', cpf: '30303030303', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC3333', type: 'TRUCK', supplierId: supplier.id });
      const scheduledAt = new Date(Date.now() - 30 * 60_000); // agendado há 30 minutos
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: supplier.id,
        scheduledAt,
      });

      const result = await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      expect(result.punctuality).toBe('ATRASADO');
    });

    it('calcula ANTECIPADO quando o check-in acontece bem antes do agendado', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      await testPrisma.yardWarehouseParams.create({ data: { warehouseId: warehouse.id, useYard: true, delayToleranceMinutes: 10 } });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'M3', cpf: '40404040404', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC4444', type: 'TRUCK', supplierId: supplier.id });
      const scheduledAt = new Date(Date.now() + 30 * 60_000); // agendado pra daqui 30 minutos
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: supplier.id,
        scheduledAt,
      });

      const result = await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      expect(result.punctuality).toBe('ANTECIPADO');
    });
  });

  describe('checkIn — validações críticas', () => {
    it('rejeita check-in com motorista bloqueado', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'Bloqueado', cpf: '50505050505', supplierId: supplier.id });
      await driverService.setBlocked(driver.id, true, 'CNH vencida');
      const vehicle = await vehicleService.create({ plate: 'ABC5555', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: supplier.id,
        scheduledAt: new Date(),
      });

      await expect(yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id })).rejects.toThrow(
        'Motorista está bloqueado'
      );
    });

    it('rejeita check-in com veículo bloqueado', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'D1', cpf: '60606060606', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC6666', type: 'TRUCK', supplierId: supplier.id });
      await vehicleService.setBlocked(vehicle.id, true, 'Documentação vencida');
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id,
        serviceType: 'RECEBIMENTO',
        supplierId: supplier.id,
        scheduledAt: new Date(),
      });

      await expect(yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id })).rejects.toThrow(
        'Veículo está bloqueado'
      );
    });

    it('rejeita check-in de um veículo que já tem outra visita ativa (CHECKED_IN)', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver1 = await driverService.create({ name: 'D2', cpf: '70707070707', supplierId: supplier.id });
      const driver2 = await driverService.create({ name: 'D3', cpf: '70707070708', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC7777', type: 'TRUCK', supplierId: supplier.id });
      const visit1 = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit1.id, { driverId: driver1.id, vehicleId: vehicle.id });
      const visit2 = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });

      await expect(yardVisitService.checkIn(visit2.id, { driverId: driver2.id, vehicleId: vehicle.id })).rejects.toThrow(
        'Este veículo já possui uma visita ativa no pátio'
      );
    });

    it('rejeita check-in quando motorista pertence a um fornecedor diferente da visita', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier1 = await createTestSupplier();
      const supplier2 = await createTestSupplier();
      const driver = await driverService.create({ name: 'D4', cpf: '80808080808', supplierId: supplier2.id });
      const vehicle = await vehicleService.create({ plate: 'ABC8888', type: 'TRUCK', supplierId: supplier1.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier1.id, scheduledAt: new Date(),
      });

      await expect(yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id })).rejects.toThrow(
        'Motorista ou veículo pertencem a um fornecedor diferente do agendamento'
      );
    });
  });

  describe('delete e cancel', () => {
    it('permite excluir um agendamento em SCHEDULED', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });

      await expect(yardVisitService.delete(visit.id)).resolves.toBeDefined();
    });

    it('rejeita excluir uma visita já em CHECKED_IN', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'D5', cpf: '90909090909', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC9999', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      await expect(yardVisitService.delete(visit.id)).rejects.toThrow(
        'Só é possível excluir agendamentos que ainda não fizeram check-in'
      );
    });

    it('cancela uma visita já com check-in, sem apagar o registro', async () => {
      const { warehouse } = await createTestPositions(1, { positionType: 'DOCA' });
      const supplier = await createTestSupplier();
      const driver = await driverService.create({ name: 'D6', cpf: '11122233344', supplierId: supplier.id });
      const vehicle = await vehicleService.create({ plate: 'ABC1010', type: 'TRUCK', supplierId: supplier.id });
      const visit = await yardVisitService.create({
        warehouseId: warehouse.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date(),
      });
      await yardVisitService.checkIn(visit.id, { driverId: driver.id, vehicleId: vehicle.id });

      const cancelled = await yardVisitService.cancel(visit.id);

      expect(cancelled.status).toBe('CANCELLED');
      const stillExists = await testPrisma.yardVisit.findUnique({ where: { id: visit.id } });
      expect(stillExists).not.toBeNull();
    });
  });

  it('lista visitas filtrando por armazém e status', async () => {
    const { warehouse: wh1 } = await createTestPositions(1, { positionType: 'DOCA' });
    const { warehouse: wh2 } = await createTestPositions(1, { positionType: 'DOCA' });
    const supplier = await createTestSupplier();
    await yardVisitService.create({ warehouseId: wh1.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date() });
    await yardVisitService.create({ warehouseId: wh2.id, serviceType: 'RECEBIMENTO', supplierId: supplier.id, scheduledAt: new Date() });

    const result = await yardVisitService.getAll(1, 100, { warehouseId: wh1.id });

    expect(result.data).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Rodar os testes e verificar que falham**

```bash
npm run test:integration -- yard-visit.service.test.ts
```

Esperado: FAIL (`Cannot find module '../../src/services/yard-visit.service'`).

- [ ] **Step 3: `yard-visit.validator.ts`**

Criar `backend/src/validators/yard-visit.validator.ts`:

```typescript
import Joi from 'joi';

export const createYardVisitSchema = Joi.object({
  warehouseId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do armazém inválido',
    'any.required': 'Armazém é obrigatório',
  }),
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO').required().messages({
    'any.only': 'Tipo de serviço inválido',
    'any.required': 'Tipo de serviço é obrigatório',
  }),
  supplierId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do fornecedor inválido',
  }),
  purchaseOrderId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do pedido de compra inválido',
  }),
  scheduledAt: Joi.date().iso().required().messages({
    'any.required': 'Data/hora agendada é obrigatória',
  }),
  notes: Joi.string().trim().max(70).allow('', null).messages({
    'string.max': 'Observação deve ter no máximo 70 caracteres',
  }),
  driverId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do motorista inválido',
  }),
  vehicleId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do veículo inválido',
  }),
});

export const updateYardVisitSchema = Joi.object({
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO').messages({
    'any.only': 'Tipo de serviço inválido',
  }),
  supplierId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do fornecedor inválido',
  }),
  purchaseOrderId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do pedido de compra inválido',
  }),
  scheduledAt: Joi.date().iso(),
  notes: Joi.string().trim().max(70).allow('', null).messages({
    'string.max': 'Observação deve ter no máximo 70 caracteres',
  }),
}).min(1);

export const checkInYardVisitSchema = Joi.object({
  driverId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do motorista inválido',
    'any.required': 'Motorista é obrigatório para o check-in',
  }),
  vehicleId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do veículo inválido',
    'any.required': 'Veículo é obrigatório para o check-in',
  }),
});

export const listYardVisitQuerySchema = Joi.object({
  warehouseId: Joi.string().uuid(),
  status: Joi.string().valid('SCHEDULED', 'CHECKED_IN', 'CANCELLED'),
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO'),
  vehicleId: Joi.string().uuid(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
```

- [ ] **Step 4: `yard-visit.service.ts`**

Criar `backend/src/services/yard-visit.service.ts`:

```typescript
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import yardWarehouseParamsService from './yard-warehouse-params.service';

export interface CreateYardVisitDto {
  warehouseId: string;
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  scheduledAt: Date;
  notes?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
}

export interface UpdateYardVisitDto {
  serviceType?: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  scheduledAt?: Date;
  notes?: string | null;
}

export interface CheckInYardVisitDto {
  driverId: string;
  vehicleId: string;
}

export interface YardVisitFilters {
  warehouseId?: string;
  status?: 'SCHEDULED' | 'CHECKED_IN' | 'CANCELLED';
  serviceType?: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
  vehicleId?: string;
}

export type PunctualityStatus = 'NO_HORARIO' | 'ANTECIPADO' | 'ATRASADO';

function computePunctuality(scheduledAt: Date, referenceTime: Date, toleranceMinutes: number): PunctualityStatus {
  const diffMinutes = (referenceTime.getTime() - scheduledAt.getTime()) / 60_000;
  if (Math.abs(diffMinutes) <= toleranceMinutes) return 'NO_HORARIO';
  return diffMinutes < 0 ? 'ANTECIPADO' : 'ATRASADO';
}

const assertWarehouseExists = async (warehouseId: string) => {
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) throw new AppError(400, 'Armazém informado não existe');
};

const assertPurchaseOrderExists = async (purchaseOrderId: string) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
  if (!po) throw new AppError(400, 'Pedido de compra informado não existe');
  return po;
};

const runCheckInValidations = async (visit: { supplierId: string | null }, driverId: string, vehicleId: string) => {
  const [driver, vehicle] = await Promise.all([
    prisma.driver.findUnique({ where: { id: driverId } }),
    prisma.vehicle.findUnique({ where: { id: vehicleId } }),
  ]);
  if (!driver) throw new AppError(400, 'Motorista informado não existe');
  if (!vehicle) throw new AppError(400, 'Veículo informado não existe');
  if (driver.blocked) throw new AppError(400, 'Motorista está bloqueado');
  if (vehicle.blocked) throw new AppError(400, 'Veículo está bloqueado');

  const activeVisit = await prisma.yardVisit.findFirst({ where: { vehicleId, status: 'CHECKED_IN' } });
  if (activeVisit) throw new AppError(400, 'Este veículo já possui uma visita ativa no pátio');

  if (visit.supplierId && (driver.supplierId !== visit.supplierId || vehicle.supplierId !== visit.supplierId)) {
    throw new AppError(400, 'Motorista ou veículo pertencem a um fornecedor diferente do agendamento');
  }
};

export class YardVisitService {
  // Para o caminho walk-in (driverId+vehicleId já no create), as validações de
  // check-in rodam ANTES do prisma.yardVisit.create — nunca depois. Validar
  // depois deixaria, no caminho de erro, um registro CHECKED_IN órfão já
  // persistido antes da validação reprovar (ex.: motorista bloqueado):
  // o INSERT teria que ser desfeito, e nada neste método faz isso. Correndo
  // a validação primeiro, um walk-in reprovado nunca chega a existir no banco.
  async create(data: CreateYardVisitDto) {
    await assertWarehouseExists(data.warehouseId);

    let supplierId = data.supplierId ?? null;
    if (data.purchaseOrderId) {
      const po = await assertPurchaseOrderExists(data.purchaseOrderId);
      supplierId = po.supplierId;
    }

    const isWalkIn = !!data.driverId && !!data.vehicleId;

    if (isWalkIn) {
      await runCheckInValidations({ supplierId }, data.driverId!, data.vehicleId!);
    }

    return prisma.yardVisit.create({
      data: {
        warehouseId: data.warehouseId,
        serviceType: data.serviceType,
        supplierId,
        purchaseOrderId: data.purchaseOrderId ?? null,
        scheduledAt: data.scheduledAt,
        notes: data.notes ?? null,
        status: isWalkIn ? 'CHECKED_IN' : 'SCHEDULED',
        driverId: isWalkIn ? data.driverId : null,
        vehicleId: isWalkIn ? data.vehicleId : null,
        checkedInAt: isWalkIn ? new Date() : null,
      },
    });
  }

  async getAll(page = 1, limit = 100, filters?: YardVisitFilters) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters?.status) where.status = filters.status;
    if (filters?.serviceType) where.serviceType = filters.serviceType;
    if (filters?.vehicleId) where.vehicleId = filters.vehicleId;

    const [visits, total] = await Promise.all([
      prisma.yardVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          supplier: { select: { id: true, code: true, name: true } },
          driver: { select: { id: true, name: true } },
          vehicle: { select: { id: true, plate: true } },
        },
      }),
      prisma.yardVisit.count({ where }),
    ]);

    const withPunctuality = await Promise.all(visits.map((v) => this.attachPunctuality(v)));

    return { data: withPunctuality, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getById(id: string) {
    const visit = await prisma.yardVisit.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, code: true, name: true } },
        driver: { select: { id: true, name: true } },
        vehicle: { select: { id: true, plate: true } },
      },
    });
    if (!visit) return null;
    return this.attachPunctuality(visit);
  }

  private async attachPunctuality(visit: any) {
    if (visit.status === 'CANCELLED') return { ...visit, punctuality: null };
    const params = await yardWarehouseParamsService.getByWarehouseId(visit.warehouseId);
    const referenceTime = visit.checkedInAt ?? new Date();
    const punctuality = computePunctuality(visit.scheduledAt, referenceTime, params.delayToleranceMinutes);
    return { ...visit, punctuality };
  }

  async update(id: string, data: UpdateYardVisitDto) {
    const current = await prisma.yardVisit.findUnique({ where: { id } });
    if (!current) throw new AppError(404, 'Visita não encontrada');

    if (data.purchaseOrderId) {
      await assertPurchaseOrderExists(data.purchaseOrderId);
    }

    return prisma.yardVisit.update({ where: { id }, data });
  }

  async delete(id: string) {
    const visit = await prisma.yardVisit.findUnique({ where: { id } });
    if (!visit) throw new AppError(404, 'Visita não encontrada');
    if (visit.status !== 'SCHEDULED') {
      throw new AppError(400, 'Só é possível excluir agendamentos que ainda não fizeram check-in');
    }
    return prisma.yardVisit.delete({ where: { id } });
  }

  async checkIn(id: string, data: CheckInYardVisitDto) {
    const visit = await prisma.yardVisit.findUnique({ where: { id } });
    if (!visit) throw new AppError(404, 'Visita não encontrada');
    if (visit.status !== 'SCHEDULED') {
      throw new AppError(400, 'Só é possível fazer check-in de agendamentos pendentes');
    }

    await runCheckInValidations({ supplierId: visit.supplierId }, data.driverId, data.vehicleId);

    const updated = await prisma.yardVisit.update({
      where: { id },
      data: { status: 'CHECKED_IN', driverId: data.driverId, vehicleId: data.vehicleId, checkedInAt: new Date() },
    });

    return this.attachPunctuality(updated);
  }

  async cancel(id: string) {
    const visit = await prisma.yardVisit.findUnique({ where: { id } });
    if (!visit) throw new AppError(404, 'Visita não encontrada');
    if (visit.status === 'CANCELLED') {
      throw new AppError(400, 'Esta visita já está cancelada');
    }
    return prisma.yardVisit.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}

export default new YardVisitService();
```

`runCheckInValidations` checa duplicidade de veículo ativo via `prisma.yardVisit.findFirst` antes do `create` — duas requisições concorrentes fazendo check-in do mesmo veículo no mesmo instante são um caso extremamente raro neste domínio (dois operadores de portaria simultâneos) e não justificam o custo de uma transação com lock; mesmo critério de aceitação de corrida rara já usado em outras partes do projeto (ex.: `maintenance.job.ts`, documentado no plano de Manutenção).

- [ ] **Step 5: `yard-visit.controller.ts`**

Criar `backend/src/controllers/yard-visit.controller.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import yardVisitService from '../services/yard-visit.service';

export class YardVisitController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.create({ ...req.body, scheduledAt: new Date(req.body.scheduledAt) });
      res.status(201).json({ status: 'success', data: visit });
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
        status: req.query.status as any,
        serviceType: req.query.serviceType as any,
        vehicleId: req.query.vehicleId as string,
      };
      const result = await yardVisitService.getAll(page, limit, filters);
      res.status(200).json({ status: 'success', data: result.data, pagination: result.pagination });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.getById(req.params.id);
      if (!visit) {
        return res.status(404).json({ status: 'error', message: 'Visita não encontrada' });
      }
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = { ...req.body };
      if (data.scheduledAt) data.scheduledAt = new Date(data.scheduledAt);
      const visit = await yardVisitService.update(req.params.id, data);
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await yardVisitService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async checkIn(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.checkIn(req.params.id, req.body);
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const visit = await yardVisitService.cancel(req.params.id);
      res.status(200).json({ status: 'success', data: visit });
    } catch (error) {
      next(error);
    }
  }
}

export default new YardVisitController();
```

- [ ] **Step 6: `yard-visit.routes.ts`**

Criar `backend/src/routes/yard-visit.routes.ts`:

```typescript
import { Router } from 'express';
import yardVisitController from '../controllers/yard-visit.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  checkInYardVisitSchema,
  createYardVisitSchema,
  listYardVisitQuerySchema,
  updateYardVisitSchema,
} from '../validators/yard-visit.validator';

const router = Router();
router.use(authMiddleware);

router.get(
  '/',
  requirePermission('yard', 'visualizar'),
  validateQuery(listYardVisitQuerySchema),
  yardVisitController.getAll
);
router.get('/:id', requirePermission('yard', 'visualizar'), yardVisitController.getById);
router.post(
  '/',
  requirePermission('yard', 'executar'),
  validate(createYardVisitSchema),
  yardVisitController.create
);
router.put(
  '/:id',
  requirePermission('yard', 'gerenciar'),
  validate(updateYardVisitSchema),
  yardVisitController.update
);
router.delete('/:id', requirePermission('yard', 'gerenciar'), yardVisitController.delete);
router.patch(
  '/:id/check-in',
  requirePermission('yard', 'executar'),
  validate(checkInYardVisitSchema),
  yardVisitController.checkIn
);
router.patch('/:id/cancel', requirePermission('yard', 'gerenciar'), yardVisitController.cancel);

export default router;
```

- [ ] **Step 7: Montar a rota sob `requireModule('YMS')`**

Em `backend/src/routes/index.ts`, adicionar o import junto aos demais das Etapas 1:

```typescript
import yardVisitRoutes from './yard-visit.routes';
```

E adicionar, logo abaixo de `router.use('/yard-warehouse-params', requireModule('YMS'), yardWarehouseParamsRoutes);` (última rota YMS da Etapa 1):

```typescript
router.use('/yard-visits', requireModule('YMS'), yardVisitRoutes);
```

- [ ] **Step 8: Rodar os testes e verificar que passam**

```bash
npm run test:integration -- yard-visit.service.test.ts
```

Esperado: 14/14.

- [ ] **Step 9: Rodar a suíte completa para confirmar não-regressão**

```bash
npm run test:integration
```

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/yard-visit.service.ts backend/src/controllers/yard-visit.controller.ts backend/src/routes/yard-visit.routes.ts backend/src/validators/yard-visit.validator.ts backend/src/routes/index.ts backend/tests/services/yard-visit.service.test.ts
git commit -m "feat(yms): adiciona agendamento e check-in de veículos (YardVisit)"
```

---

### Task 3: Frontend — Agendamento e Check-in de Veículos

**Files:**
- Create: `frontend/src/services/yard-visit.service.ts`
- Create: `frontend/src/stores/yard-visit.store.ts`
- Create: `frontend/src/views/yard/YardVisitListView.vue`
- Create: `frontend/src/views/yard/__tests__/YardVisitListView.spec.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /yard-visits` + `PATCH /yard-visits/:id/check-in` + `PATCH /yard-visits/:id/cancel` (Task 2); `useWarehouseStore`, `useSupplierStore` (já existentes); `useDriverStore`, `useVehicleStore` (Etapa 1); `purchaseOrderService` (`frontend/src/services/purchase-order.service.ts`, já existente — export default de instância de classe, `getAll(page, limit, { status })`, tipo `PurchaseOrder` nomeado).
- Produces: nenhuma outra task deste plano depende deste arquivo.

- [ ] **Step 1: `yard-visit.service.ts`**

Criar `frontend/src/services/yard-visit.service.ts`:

```typescript
import api from './api.service'

export type YardVisitStatus = 'SCHEDULED' | 'CHECKED_IN' | 'CANCELLED'
export type PunctualityStatus = 'NO_HORARIO' | 'ANTECIPADO' | 'ATRASADO' | null

export interface WarehouseRef {
  id: string
  code: string
  name: string
}

export interface SupplierRef {
  id: string
  code: string
  name: string
}

export interface DriverRef {
  id: string
  name: string
}

export interface VehicleRef {
  id: string
  plate: string
}

export interface YardVisit {
  id: string
  warehouseId: string
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'
  supplierId: string | null
  purchaseOrderId: string | null
  scheduledAt: string
  status: YardVisitStatus
  notes: string | null
  driverId: string | null
  vehicleId: string | null
  checkedInAt: string | null
  punctuality: PunctualityStatus
  createdAt: string
  updatedAt: string
  warehouse?: WarehouseRef
  supplier?: SupplierRef | null
  driver?: DriverRef | null
  vehicle?: VehicleRef | null
}

export interface CreateYardVisitDto {
  warehouseId: string
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'
  supplierId?: string | null
  purchaseOrderId?: string | null
  scheduledAt: string
  notes?: string | null
  driverId?: string | null
  vehicleId?: string | null
}

export interface UpdateYardVisitDto {
  serviceType?: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'
  supplierId?: string | null
  purchaseOrderId?: string | null
  scheduledAt?: string
  notes?: string | null
}

export interface CheckInYardVisitDto {
  driverId: string
  vehicleId: string
}

class YardVisitService {
  private readonly basePath = '/yard-visits'

  async getAll(
    page = 1,
    limit = 100,
    filters?: { warehouseId?: string; status?: YardVisitStatus; serviceType?: string; vehicleId?: string }
  ) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (filters?.warehouseId) params.append('warehouseId', filters.warehouseId)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.serviceType) params.append('serviceType', filters.serviceType)
    if (filters?.vehicleId) params.append('vehicleId', filters.vehicleId)
    return api.get(`${this.basePath}?${params.toString()}`)
  }

  async create(data: CreateYardVisitDto) {
    return api.post(this.basePath, data)
  }

  async update(id: string, data: UpdateYardVisitDto) {
    return api.put(`${this.basePath}/${id}`, data)
  }

  async delete(id: string) {
    return api.delete(`${this.basePath}/${id}`)
  }

  async checkIn(id: string, data: CheckInYardVisitDto) {
    return api.patch(`${this.basePath}/${id}/check-in`, data)
  }

  async cancel(id: string) {
    return api.patch(`${this.basePath}/${id}/cancel`)
  }
}

export default new YardVisitService()
```

- [ ] **Step 2: `yard-visit.store.ts`**

Criar `frontend/src/stores/yard-visit.store.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'
import yardVisitService, {
  type YardVisit,
  type CreateYardVisitDto,
  type UpdateYardVisitDto,
  type CheckInYardVisitDto,
  type YardVisitStatus,
} from '@/services/yard-visit.service'

export const useYardVisitStore = defineStore('yardVisit', () => {
  const visits = ref<YardVisit[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchVisits = async (
    page = 1,
    limit = 100,
    filters?: { warehouseId?: string; status?: YardVisitStatus; serviceType?: string }
  ) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardVisitService.getAll(page, limit, filters)
      visits.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar visitas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createVisit = async (data: CreateYardVisitDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardVisitService.create(data)
      await fetchVisits()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar visita'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateVisit = async (id: string, data: UpdateYardVisitDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardVisitService.update(id, data)
      await fetchVisits()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar visita'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteVisit = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardVisitService.delete(id)
      await fetchVisits()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir visita'
      throw err
    } finally {
      loading.value = false
    }
  }

  const checkIn = async (id: string, data: CheckInYardVisitDto) => {
    try {
      loading.value = true
      error.value = null
      await yardVisitService.checkIn(id, data)
      await fetchVisits()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao fazer check-in'
      throw err
    } finally {
      loading.value = false
    }
  }

  const cancelVisit = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardVisitService.cancel(id)
      await fetchVisits()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao cancelar visita'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { visits, loading, error, fetchVisits, createVisit, updateVisit, deleteVisit, checkIn, cancelVisit }
})
```

- [ ] **Step 3: Escrever o teste da view**

Criar `frontend/src/views/yard/__tests__/YardVisitListView.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import YardVisitListView from '../YardVisitListView.vue'
import yardVisitService from '@/services/yard-visit.service'
import warehouseService from '@/services/warehouse.service'
import supplierService from '@/services/supplier.service'
import driverService from '@/services/driver.service'
import vehicleService from '@/services/vehicle.service'
import purchaseOrderService from '@/services/purchase-order.service'

vi.mock('@/services/yard-visit.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), checkIn: vi.fn(), cancel: vi.fn() },
}))
vi.mock('@/services/warehouse.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/services/supplier.service', () => ({ default: { getAll: vi.fn() } }))
vi.mock('@/services/driver.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))
vi.mock('@/services/vehicle.service', () => ({
  default: { getAll: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), setBlocked: vi.fn() },
}))
vi.mock('@/services/purchase-order.service', () => ({ default: { getAll: vi.fn() } }))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))
vi.mock('@/stores/theme.store', () => ({
  useThemeStore: () => ({ mode: 'system', isDark: false, setMode: vi.fn() }),
}))

const mockWarehouse = { id: 'wh-1', code: 'WH-1', name: 'Armazém Central', active: true, createdAt: '', updatedAt: '' }
const mockSupplier = { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa', active: true, createdAt: '', updatedAt: '' }
const mockDriver = { id: 'drv-1', name: 'João da Silva', cpf: '12345678901', supplierId: 'sup-1', blocked: false, blockedReason: null, createdAt: '', updatedAt: '' }
const mockVehicle = { id: 'veh-1', plate: 'ABC1D23', type: 'TRUCK', supplierId: 'sup-1', fleetId: null, blocked: false, blockedReason: null, createdAt: '', updatedAt: '' }

const mockVisit = {
  id: 'visit-1',
  warehouseId: 'wh-1',
  serviceType: 'RECEBIMENTO',
  supplierId: 'sup-1',
  purchaseOrderId: null,
  scheduledAt: new Date().toISOString(),
  status: 'SCHEDULED',
  notes: null,
  driverId: null,
  vehicleId: null,
  checkedInAt: null,
  punctuality: null,
  createdAt: '',
  updatedAt: '',
  warehouse: { id: 'wh-1', code: 'WH-1', name: 'Armazém Central' },
  supplier: { id: 'sup-1', code: 'SUP-1', name: 'Transportadora Alfa' },
  driver: null,
  vehicle: null,
}

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/yard/visits', component: YardVisitListView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('YardVisitListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(warehouseService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockWarehouse], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(supplierService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockSupplier], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(driverService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockDriver], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(vehicleService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockVehicle], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(purchaseOrderService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } },
    } as any)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('carrega e exibe a lista de visitas, sem pontualidade para agendamentos ainda pendentes', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockVisit], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Armazém Central')
    expect(wrapper.text()).toContain('Transportadora Alfa')
  })

  it('faz check-in de um agendamento, informando motorista e veículo', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockVisit], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(yardVisitService.checkIn).mockResolvedValue({
      data: { status: 'success', data: { ...mockVisit, status: 'CHECKED_IN' } },
    } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const checkInButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Fazer Check-in')!
    await checkInButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#checkin-driver').setValue('drv-1')
    await body.find('#checkin-vehicle').setValue('veh-1')
    await body.find('#checkin-form').trigger('submit.prevent')
    await flushPromises()

    expect(yardVisitService.checkIn).toHaveBeenCalledWith('visit-1', { driverId: 'drv-1', vehicleId: 'veh-1' })
  })

  it('cria um agendamento manual novo', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [], pagination: { page: 1, limit: 100, total: 0, pages: 0 } },
    } as any)
    vi.mocked(yardVisitService.create).mockResolvedValue({ data: { status: 'success', data: mockVisit } } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const novoButton = wrapper.findAll('button').find((b) => b.text().includes('Novo Agendamento'))!
    await novoButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#visit-form-warehouse').setValue('wh-1')
    await body.find('#visit-form-service-type').setValue('RECEBIMENTO')
    await body.find('#visit-form-supplier').setValue('sup-1')
    await body.find('#visit-form-scheduled-at').setValue('2026-12-01T10:00')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(yardVisitService.create).toHaveBeenCalledWith(
      expect.objectContaining({ warehouseId: 'wh-1', serviceType: 'RECEBIMENTO', supplierId: 'sup-1' })
    )
  })

  it('edita um agendamento existente, sem exigir motorista/veículo', async () => {
    vi.mocked(yardVisitService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockVisit], pagination: { page: 1, limit: 100, total: 1, pages: 1 } },
    } as any)
    vi.mocked(yardVisitService.update).mockResolvedValue({ data: { status: 'success', data: mockVisit } } as any)

    const router = makeRouter()
    router.push('/yard/visits')
    await router.isReady()

    const wrapper = mount(YardVisitListView, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()

    const editButton = wrapper.findAll('button').find((b) => b.text().trim() === 'Editar')!
    await editButton.trigger('click')
    await wrapper.vm.$nextTick()

    const body = new DOMWrapper(document.body)
    await body.find('#visit-form-notes').setValue('Chegada pelo portão 2')
    await body.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(yardVisitService.update).toHaveBeenCalledWith(
      'visit-1',
      expect.objectContaining({ notes: 'Chegada pelo portão 2' })
    )
  })
})
```

- [ ] **Step 4: Rodar o teste e verificar que falha**

```bash
npx vitest run src/views/yard/__tests__/YardVisitListView.spec.ts
```

Esperado: FAIL (`Cannot find module '../YardVisitListView.vue'`).

- [ ] **Step 5: `YardVisitListView.vue`**

Criar `frontend/src/views/yard/YardVisitListView.vue`:

```vue
<template>
  <AppLayout title="Agendamento e Check-in" subtitle="Agende a chegada de veículos e registre o check-in na portaria">
    <template #actions>
      <Button variant="outline" @click="openWalkInModal" class="mr-2">Check-in Direto</Button>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Agendamento</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="visit-filter-warehouse" label="Armazém">
          <select
            v-model="filters.warehouseId"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
          </select>
        </FormField>
        <FormField id="visit-filter-status" label="Status">
          <select
            v-model="filters.status"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="SCHEDULED">Agendado</option>
            <option value="CHECKED_IN">Check-in feito</option>
            <option value="CANCELLED">Cancelado</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="visitList"
      :pagination="pagination"
      empty-title="Nenhuma visita encontrada"
      empty-hint="Ajuste os filtros ou crie um novo agendamento."
      @retry="loadVisits"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Agendamento</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Armazém</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Fornecedor</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Motorista / Veículo</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Agendado para</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Pontualidade</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).warehouse?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ asItem(item).supplier?.name || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
          <span v-if="asItem(item).driver">{{ asItem(item).driver!.name }} / {{ asItem(item).vehicle!.plate }}</span>
          <span v-else>-</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{{ formatDateTime(asItem(item).scheduledAt) }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            v-if="asItem(item).punctuality"
            :label="PUNCTUALITY_LABELS[asItem(item).punctuality!]"
            :tone="PUNCTUALITY_TONES[asItem(item).punctuality!]"
          />
          <span v-else class="text-sm text-gray-400">-</span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="STATUS_LABELS[asItem(item).status]" :tone="STATUS_TONES[asItem(item).status]" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <template v-if="asItem(item).status === 'SCHEDULED'">
            <button @click="openCheckInModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Fazer Check-in</button>
            <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
            <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
          </template>
          <template v-else-if="asItem(item).status === 'CHECKED_IN'">
            <button @click="handleCancel(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Cancelar</button>
          </template>
        </td>
      </template>
    </DataTable>

    <AppModal v-model="showCreateModal" :title="editingVisit ? 'Editar Agendamento' : isWalkIn ? 'Check-in Direto' : 'Novo Agendamento'" @close="closeCreateModal">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="visit-form-warehouse" label="Armazém" required>
            <select v-model="formData.warehouseId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="">Selecione...</option>
              <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
            </select>
          </FormField>
          <FormField id="visit-form-service-type" label="Tipo de Serviço" required>
            <select v-model="formData.serviceType" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @change="onServiceTypeChange">
              <option value="RECEBIMENTO">Recebimento</option>
              <option value="EXPEDICAO">Expedição</option>
              <option value="MULTIUSO">Multiuso</option>
            </select>
          </FormField>
        </div>

        <FormField v-if="formData.serviceType === 'RECEBIMENTO'" id="visit-form-purchase-order" label="Pedido de Compra (opcional)">
          <select v-model="formData.purchaseOrderId" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @change="onPurchaseOrderChange">
            <option value="">Nenhum (preenchimento manual)</option>
            <option v-for="po in confirmedPurchaseOrders" :key="po.id" :value="po.id">{{ po.orderNumber }} — {{ po.supplier?.name }}</option>
          </select>
        </FormField>

        <FormField id="visit-form-supplier" label="Fornecedor" :required="formData.serviceType !== 'EXPEDICAO'">
          <select v-model="formData.supplierId" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Nenhum</option>
            <option v-for="sup in supplierStore.suppliers" :key="sup.id" :value="sup.id">{{ sup.name }}</option>
          </select>
        </FormField>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="visit-form-scheduled-at" label="Data/Hora agendada" required>
            <input v-model="formData.scheduledAt" type="datetime-local" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="visit-form-notes" label="Observação (até 70 caracteres)">
            <input v-model="formData.notes" type="text" maxlength="70" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <template v-if="isWalkIn">
          <FormField id="visit-form-driver" label="Motorista" required>
            <select v-model="formData.driverId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="">Selecione...</option>
              <option v-for="d in driverStore.drivers" :key="d.id" :value="d.id">{{ d.name }}</option>
            </select>
          </FormField>
          <FormField id="visit-form-vehicle" label="Veículo" required>
            <select v-model="formData.vehicleId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
              <option value="">Selecione...</option>
              <option v-for="v in vehicleStore.vehicles" :key="v.id" :value="v.id">{{ v.plate }}</option>
            </select>
          </FormField>
        </template>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeCreateModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingVisit ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showCheckInModal" title="Fazer Check-in" @close="closeCheckInModal">
      <form id="checkin-form" @submit.prevent="handleConfirmCheckIn" class="space-y-4">
        <FormField id="checkin-driver" label="Motorista" required>
          <select v-model="checkInData.driverId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="d in driverStore.drivers" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </FormField>
        <FormField id="checkin-vehicle" label="Veículo" required>
          <select v-model="checkInData.vehicleId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
            <option value="">Selecione...</option>
            <option v-for="v in vehicleStore.vehicles" :key="v.id" :value="v.id">{{ v.plate }}</option>
          </select>
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeCheckInModal" class="flex-1">Cancelar</Button>
          <Button type="submit" class="flex-1">Confirmar Check-in</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useYardVisitStore } from '@/stores/yard-visit.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { useSupplierStore } from '@/stores/supplier.store'
import { useDriverStore } from '@/stores/driver.store'
import { useVehicleStore } from '@/stores/vehicle.store'
import purchaseOrderService, { type PurchaseOrder } from '@/services/purchase-order.service'
import type { YardVisit, YardVisitStatus, PunctualityStatus } from '@/services/yard-visit.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const STATUS_LABELS: Record<YardVisitStatus, string> = {
  SCHEDULED: 'Agendado',
  CHECKED_IN: 'Check-in feito',
  CANCELLED: 'Cancelado',
}
const STATUS_TONES: Record<YardVisitStatus, 'success' | 'warning' | 'danger'> = {
  SCHEDULED: 'warning',
  CHECKED_IN: 'success',
  CANCELLED: 'danger',
}
const PUNCTUALITY_LABELS: Record<Exclude<PunctualityStatus, null>, string> = {
  NO_HORARIO: 'No horário',
  ANTECIPADO: 'Antecipado',
  ATRASADO: 'Atrasado',
}
const PUNCTUALITY_TONES: Record<Exclude<PunctualityStatus, null>, 'success' | 'warning' | 'danger'> = {
  NO_HORARIO: 'success',
  ANTECIPADO: 'warning',
  ATRASADO: 'danger',
}

const yardVisitStore = useYardVisitStore()
const warehouseStore = useWarehouseStore()
const supplierStore = useSupplierStore()
const driverStore = useDriverStore()
const vehicleStore = useVehicleStore()
const toast = useToast()

const visitList = ref<YardVisit[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)
const showCreateModal = ref(false)
const showCheckInModal = ref(false)
const isWalkIn = ref(false)
const editingVisit = ref<YardVisit | null>(null)
const checkingInVisit = ref<YardVisit | null>(null)
const checkInData = ref({ driverId: '', vehicleId: '' })
const confirmedPurchaseOrders = ref<PurchaseOrder[]>([])
const filters = ref({ warehouseId: '', status: '' })
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })
const formData = ref({
  warehouseId: '',
  serviceType: 'RECEBIMENTO' as YardVisit['serviceType'],
  supplierId: '',
  purchaseOrderId: '',
  scheduledAt: '',
  notes: '',
  driverId: '',
  vehicleId: '',
})

const loadVisits = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await yardVisitStore.fetchVisits(pagination.value.page, pagination.value.limit, {
      warehouseId: filters.value.warehouseId || undefined,
      status: (filters.value.status || undefined) as YardVisitStatus | undefined,
    })
    visitList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar visitas'
  } finally {
    loading.value = false
  }
}

const handleFilterChange = () => { pagination.value.page = 1; loadVisits() }
const changePage = (page: number) => { pagination.value.page = page; loadVisits() }
const resetFormData = () => ({
  warehouseId: '', serviceType: 'RECEBIMENTO' as YardVisit['serviceType'], supplierId: '',
  purchaseOrderId: '', scheduledAt: '', notes: '', driverId: '', vehicleId: '',
})

const loadConfirmedPurchaseOrders = async () => {
  const result = await purchaseOrderService.getAll(1, 100, { status: 'CONFIRMED' })
  confirmedPurchaseOrders.value = result.data.data
}

const onServiceTypeChange = () => {
  if (formData.value.serviceType !== 'RECEBIMENTO') formData.value.purchaseOrderId = ''
}

const onPurchaseOrderChange = () => {
  const po = confirmedPurchaseOrders.value.find((p) => p.id === formData.value.purchaseOrderId)
  if (po) {
    formData.value.supplierId = po.supplierId
    formData.value.scheduledAt = po.expectedDate.slice(0, 16)
  }
}

const openCreateModal = () => { isWalkIn.value = false; editingVisit.value = null; formData.value = resetFormData(); showCreateModal.value = true }
const openWalkInModal = () => { isWalkIn.value = true; editingVisit.value = null; formData.value = resetFormData(); showCreateModal.value = true }
const openEditModal = (visit: YardVisit) => {
  isWalkIn.value = false
  editingVisit.value = visit
  formData.value = {
    warehouseId: visit.warehouseId,
    serviceType: visit.serviceType,
    supplierId: visit.supplierId || '',
    purchaseOrderId: visit.purchaseOrderId || '',
    scheduledAt: visit.scheduledAt.slice(0, 16),
    notes: visit.notes || '',
    driverId: '',
    vehicleId: '',
  }
  showCreateModal.value = true
}
const closeCreateModal = () => { showCreateModal.value = false; editingVisit.value = null }

const openCheckInModal = (visit: YardVisit) => {
  checkingInVisit.value = visit
  checkInData.value = { driverId: '', vehicleId: '' }
  showCheckInModal.value = true
}
const closeCheckInModal = () => { showCheckInModal.value = false; checkingInVisit.value = null }

const handleSubmit = async () => {
  try {
    saving.value = true
    if (editingVisit.value) {
      const data = {
        serviceType: formData.value.serviceType,
        supplierId: formData.value.supplierId || null,
        purchaseOrderId: formData.value.purchaseOrderId || null,
        scheduledAt: formData.value.scheduledAt,
        notes: formData.value.notes || null,
      }
      await yardVisitStore.updateVisit(editingVisit.value.id, data)
      toast.success('Agendamento atualizado com sucesso!')
    } else {
      const data = {
        ...formData.value,
        supplierId: formData.value.supplierId || null,
        purchaseOrderId: formData.value.purchaseOrderId || null,
        notes: formData.value.notes || null,
        driverId: isWalkIn.value ? formData.value.driverId : undefined,
        vehicleId: isWalkIn.value ? formData.value.vehicleId : undefined,
      }
      await yardVisitStore.createVisit(data)
      toast.success(isWalkIn.value ? 'Check-in registrado com sucesso!' : 'Agendamento criado com sucesso!')
    }
    closeCreateModal()
    await loadVisits()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar')
  } finally {
    saving.value = false
  }
}

const handleConfirmCheckIn = async () => {
  if (!checkingInVisit.value) return
  try {
    await yardVisitStore.checkIn(checkingInVisit.value.id, checkInData.value)
    toast.success('Check-in realizado com sucesso!')
    closeCheckInModal()
    await loadVisits()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao fazer check-in')
  }
}

const handleDelete = async (visit: YardVisit) => {
  if (await confirmDialog('Deseja realmente excluir este agendamento?')) {
    try {
      await yardVisitStore.deleteVisit(visit.id)
      toast.success('Agendamento excluído com sucesso!')
      await loadVisits()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir agendamento')
    }
  }
}

const handleCancel = async (visit: YardVisit) => {
  if (await confirmDialog('Deseja realmente cancelar esta visita?')) {
    try {
      await yardVisitStore.cancelVisit(visit.id)
      toast.success('Visita cancelada com sucesso!')
      await loadVisits()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao cancelar visita')
    }
  }
}

const asItem = (item: unknown) => item as YardVisit
const formatDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR')

onMounted(async () => {
  await Promise.all([
    warehouseStore.fetchWarehouses(),
    supplierStore.fetchSuppliers(),
    driverStore.fetchDrivers(),
    vehicleStore.fetchVehicles(),
    loadConfirmedPurchaseOrders(),
  ])
  await loadVisits()
})
</script>
```

- [ ] **Step 6: Rodar o teste e verificar que passa**

```bash
npx vitest run src/views/yard/__tests__/YardVisitListView.spec.ts
```

Esperado: 4/4.

- [ ] **Step 7: Montar a rota**

Em `frontend/src/router/index.ts`, adicionar:

```typescript
  {
    path: '/yard/visits',
    name: 'yard-visits',
    component: () => import('../views/yard/YardVisitListView.vue'),
    meta: { requiresAuth: true }
  },
```

- [ ] **Step 8: Atualizar o card "Agendamento" da aba "Pátio" do Dashboard**

Em `frontend/src/views/DashboardView.vue`, dentro do bloco `activeTab === 'yms'`, trocar o card estático "Agendamento" (o primeiro dos 5 placeholders "Em breve"):

```vue
            <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed dark:border-gray-700 dark:bg-gray-900">
              <div class="text-center">
                <div class="text-3xl mb-2">🚚</div>
                <p class="text-sm font-medium text-gray-500">Agendamento</p>
                <p class="text-xs text-gray-400 mt-1">Em breve</p>
              </div>
            </div>
```

por um `RouterLink` de verdade:

```vue
            <RouterLink
              to="/yard/visits"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🚚</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Agendamento</p>
              </div>
            </RouterLink>
```

Não mexer nos outros 3 cards ainda "Em breve" (Check-in/out, Tempo de Pátio, Relatórios YMS).

- [ ] **Step 9: Rodar a suíte completa do frontend + type-check**

```bash
npx vitest run && npx vue-tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/services/yard-visit.service.ts frontend/src/stores/yard-visit.store.ts frontend/src/views/yard/YardVisitListView.vue frontend/src/views/yard/__tests__/YardVisitListView.spec.ts frontend/src/router/index.ts frontend/src/views/DashboardView.vue
git commit -m "feat(yms): adiciona agendamento e check-in ao frontend"
```

---

### Task 4: Verificação end-to-end real

**Files:** nenhum (task de verificação, sem mudança de código).

**Interfaces:** nenhuma.

- [ ] **Step 1: Ambiente**

Confirme (peça aprovação explícita do usuário antes de recriar containers): os containers `fabric-backend`/`fabric-frontend` precisam estar rodando o código deste worktree/branch. Se estiverem apontando para `main`, recrie com:

```bash
docker compose -f <worktree>/docker-compose.yml -f <worktree>/docker-compose.ai.yml -p fabric up -d --force-recreate backend frontend
```

- [ ] **Step 2: Migração + seed no banco real**

```bash
npx prisma migrate deploy
npm run prisma:seed
```

- [ ] **Step 3: Fluxo completo via UI real (login como admin)**

1. Login como `admin@fabric.com`. Confirme que o card "Agendamento" da aba "Pátio" está clicável.
2. Em `/warehouses` (WMS), confirme o armazém de teste que será usado; se necessário, cadastre um fornecedor, motorista e veículo em `/yard/drivers`/`/yard/vehicles` (Etapa 1).
3. Configure a tolerância de atraso do armazém em `/yard/warehouse-params` (ex.: 15 minutos).
4. `/yard/visits`: criar um "Novo Agendamento" manual (Expedição, sem fornecedor) para daqui a 1 hora. Confirmar que aparece na lista com status "Agendado" e sem pontualidade.
5. Fazer "Check-in" nesse agendamento com o motorista/veículo cadastrados — confirmar que muda para "Check-in feito" e mostra pontualidade "Antecipado" (já que o agendamento era para daqui a 1 hora).
6. Criar um segundo agendamento de Recebimento vinculado a um `PurchaseOrder` confirmado existente (se houver um no banco de teste; caso não haja, criar um pedido de compra confirmado primeiro via `/purchase-orders`) — confirmar que fornecedor e data são pré-preenchidos ao selecionar o pedido.
7. Usar "Check-in Direto" para simular um walk-in — criar e verificar que a visita já nasce em "Check-in feito".
8. Tentar fazer check-in do MESMO veículo já em "Check-in feito" numa segunda visita — confirmar a mensagem de erro "Este veículo já possui uma visita ativa no pátio".
9. Excluir um agendamento ainda em "Agendado" — confirmar que some da lista. Tentar excluir (via API, já que a UI não oferece o botão) uma visita já em "Check-in feito" — confirmar 400.
10. Cancelar uma visita em "Check-in feito" — confirmar que o registro não desaparece, só muda para "Cancelado".

- [ ] **Step 4: RBAC negativo**

Remova temporariamente `yard:executar` de um papel de teste e confirme que criar agendamento/fazer check-in retorna 403 (mesmo com `yard:visualizar` presente, a listagem continua funcionando). Restaure depois.

- [ ] **Step 5: Licenciamento negativo**

Desabilite `LicensedModule` para `YMS`, reinicie o backend, confirme `GET /api/v1/yard-visits` retornando 404 mesmo para admin. Restaure depois.

- [ ] **Step 6: Relato final**

Sem commit neste task. Relate o resultado de cada step. Problemas encontrados: corrigir como commit pequeno e focado, re-rodar o step afetado.

---

## Pós-plano: o que ainda fica pendente do YMS

Esta etapa cobre agendamento e check-in. Pátio (alocação de vaga, chamada automática), Operação de Doca (status OC/DP, checkout/liberação) e Dashboard/KPIs continuam como itens de fila separados — ver `docs/superpowers/specs/2026-09-08-yms-agendamento-checkin-design.md`, seção 2.6.
