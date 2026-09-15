# Coletor de Dados / Mobile — WMS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o app mobile (PWA) de coletor de dados do WMS — fila única de tarefas, leitura de código de barras/QR (coletor físico + câmera), transferência avulsa, contagem com leitura, fila offline curta, e o mecanismo de ocorrências (avaria/divergência de contagem) com bloqueio condicional e liberação por gestor — conforme `docs/superpowers/specs/2026-09-14-coletor-dados-mobile-wms-design.md`.

**Architecture:** Backend Express 4 + Prisma + MySQL: 2 models novos (`WmsOccurrence`/`WmsOccurrencePhoto`), 1 service/controller/rota novos sob `requireModule('WMS')`, upload de foto via `multer` (disco local), 3 `SystemSetting` novas, e um guard de bloqueio (`assertOccurrenceNotBlocking`) plugado nos pontos de conclusão de `WarehouseTask` já existentes e no registro de contagem. Frontend Vue 3 + Pinia: rotas novas `/mobile/*` (PWA via `vite-plugin-pwa`) reaproveitando 100% do backend/RBAC/auth já existente, com `MobileLayout.vue` próprio, `ScanInput.vue` (coletor físico + câmera via `@zxing/browser`), `PhotoCapture.vue`, e `useOfflineQueue.ts` (fila de mutações pendentes em IndexedDB via `idb`) — mais uma tela desktop nova `/occurrences` para liberação.

**Tech Stack:** Backend: Express 4.18, Prisma, MySQL, Joi, Jest+Supertest (testes de integração contra MySQL real). Frontend: Vue 3 `<script setup>`, Pinia, Vue Router (lazy-load por rota), Tailwind (utility classes, sem exceção), Vitest+`@vue/test-utils` (`__tests__/*.spec.ts`), Axios. Novas dependências: `multer`+`@types/multer` (backend), `@zxing/browser`, `idb`, `vite-plugin-pwa` (frontend).

## Global Constraints

- Todo texto de UI, mensagem de erro e commit em português do Brasil, mesmo padrão do resto do projeto.
- `/wms-occurrences` é montado sob `requireModule('WMS')` em `routes/index.ts` — **não** cria um `LicensedModule` próprio (ver justificativa no relatório de reconhecimento: o próprio nome do endpoint já é `wms-*`, ao contrário de `EXPEDICAO`, que tem produto de negócio próprio).
- As 3 `SystemSetting` novas **precisam** estar no seed (`updateSetting` responde 404 para chave que não existe) — `wms.occurrence.avaria.action` (STRING, enum `NOTIFY`/`BLOCK`), `wms.occurrence.divergencia_contagem.action` (STRING, enum `NOTIFY`/`BLOCK`), `wms.occurrence.divergencia_contagem.threshold` (NUMBER, mínimo 1).
- `Notification.category` para o evento de ocorrência é `'WAREHOUSE'` — já existe no union type de `notification.service.ts`, não precisa migração.
- Fotos: disco local em `backend/uploads/wms-occurrences/`, caminho **relativo** gravado no banco (nunca absoluto), servidas por rota autenticada (`GET /wms-occurrences/photos/:photoId`), nunca por `express.static` público. `backend/uploads/` entra no `.gitignore`; persiste porque `./backend:/app` já é bind mount em `docker-compose.yml` (dev) — nenhuma mudança de infra de container é necessária.
- `blocking` de uma `WmsOccurrence` é decidido e congelado na criação, lendo a `SystemSetting` vigente naquele instante — nunca recalculado depois.
- Backend: todo service novo segue o estilo `class X { } / export default new X()` (maioria do projeto — `SalesOrderService`, `NotificationService`, `StockController`), com funções auxiliares exportadas nomeadas quando precisam rodar dentro da transação de OUTRO service (mesmo padrão de `assertTaskIsOpen`/`assertChainOrderResolved` em `warehouse-task.service.ts`).
- Todo teste de integração backend roda com `npm run test:integration` (dentro de `backend/`), que sobe MySQL real via `docker-compose.test.yml` — nunca mockar Prisma.
- Todo teste frontend fica em `__tests__/*.spec.ts` ao lado do componente, `npm run test` (Vitest) dentro de `frontend/`.

---

## Estrutura de arquivos

**Backend — criar:**
- `backend/src/validators/wms-occurrence.validator.ts`
- `backend/src/services/wms-occurrence.service.ts`
- `backend/src/middleware/upload.middleware.ts`
- `backend/src/controllers/wms-occurrence.controller.ts`
- `backend/src/routes/wms-occurrence.routes.ts`
- `backend/tests/integration/wms-occurrence.test.ts`
- `backend/tests/integration/wms-occurrence-blocking.test.ts`
- `backend/tests/integration/counting-divergence-occurrence.test.ts`

**Backend — modificar:**
- `backend/prisma/schema.prisma` (enums + models + 2 relações em `User`)
- `backend/prisma/seed.ts` (3 permissões, grants de papel, 3 `SystemSetting`)
- `backend/src/services/system-setting.service.ts` (`KEY_ENUM_VALUES`/`KEY_NUMERIC_BOUNDS`)
- `backend/src/routes/index.ts` (montagem da rota nova)
- `backend/src/services/warehouse-task.service.ts` (guard em `startTask`/`completeTask`)
- `backend/src/services/warehouse-task-execution.service.ts` (guard em `executeTask`)
- `backend/src/services/purchase-receipt.service.ts` (guard em `completePutaway`)
- `backend/src/services/counting-item.service.ts` (detecção de divergência em `count()`, guard em `recount()`/`accept()`)
- `backend/package.json` (`multer`, `@types/multer`)
- `backend/.gitignore` (`uploads/`)

**Frontend — criar:**
- `frontend/src/types/wms-occurrence.types.ts`
- `frontend/src/services/wms-occurrence.service.ts`
- `frontend/src/stores/wms-occurrence.store.ts`
- `frontend/src/components/common/MobileLayout.vue`
- `frontend/src/components/mobile/ScanInput.vue` + `__tests__/ScanInput.spec.ts`
- `frontend/src/components/mobile/PhotoCapture.vue` + `__tests__/PhotoCapture.spec.ts`
- `frontend/src/composables/useOfflineQueue.ts` + `__tests__/useOfflineQueue.spec.ts`
- `frontend/src/views/mobile/MobileHomeView.vue`
- `frontend/src/views/mobile/MobileTaskListView.vue` + `__tests__/MobileTaskListView.spec.ts`
- `frontend/src/views/mobile/MobileTaskDetailView.vue` + `__tests__/MobileTaskDetailView.spec.ts`
- `frontend/src/views/mobile/MobileTransferView.vue` + `__tests__/MobileTransferView.spec.ts`
- `frontend/src/views/mobile/MobileCountingView.vue` + `__tests__/MobileCountingView.spec.ts`
- `frontend/src/views/wms/OccurrencesView.vue` + `__tests__/OccurrencesView.spec.ts`
- `frontend/public/pwa-icon-192.png`, `frontend/public/pwa-icon-512.png`

**Frontend — modificar:**
- `frontend/package.json` (`@zxing/browser`, `idb`, `vite-plugin-pwa`)
- `frontend/vite.config.ts` (plugin PWA)
- `frontend/src/router/index.ts` (6 rotas novas)
- `frontend/src/stores/counting.store.ts` (`fetchPendingItems`)
- `frontend/src/views/DashboardView.vue` (2 cards novos na aba WMS)

**Backend — deletar:**
- `frontend/src/hooks/useBarcodeScanner.ts` (código morto em React, confirmado não referenciado em lugar nenhum)

---

## PHASE A — Backend: núcleo de Ocorrências

### Task 1: Schema Prisma — enums, models, migração

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: enum `WmsOccurrenceType` (`AVARIA`/`DIVERGENCIA_CONTAGEM`/`OUTRO`), enum `WmsOccurrenceStatus` (`ABERTA`/`LIBERADA`), model `WmsOccurrence`, model `WmsOccurrencePhoto` — usados por todas as tasks seguintes desta fase.

- [ ] **Step 1: Adicionar os enums e models ao schema**

Adicione ao final de `backend/prisma/schema.prisma` (perto do bloco de `WarehouseTask`, que é a referência polimórfica que este model segue):

```prisma
enum WmsOccurrenceType {
  AVARIA
  DIVERGENCIA_CONTAGEM
  OUTRO
}

enum WmsOccurrenceStatus {
  ABERTA
  LIBERADA
}

// Referência polimórfica, mesmo padrão de WarehouseTask.reference/referenceType —
// aponta pra uma WarehouseTask ou um CountingItem, sem FK direta pros dois.
model WmsOccurrence {
  id            String              @id @default(uuid())
  type          WmsOccurrenceType
  referenceType String // 'WAREHOUSE_TASK' | 'COUNTING_ITEM'
  reference     String // id da tarefa/item
  description   String              @db.Text
  status        WmsOccurrenceStatus @default(ABERTA)
  blocking      Boolean             @default(false) // decidido na criação, a partir da config vigente — não recalcula se a config mudar depois

  reportedBy String
  reportedAt DateTime @default(now())

  releasedBy  String?
  releasedAt  DateTime?
  releaseNote String?   @db.Text

  photos   WmsOccurrencePhoto[]
  reporter User                 @relation("OccurrenceReporter", fields: [reportedBy], references: [id])
  releaser User?                @relation("OccurrenceReleaser", fields: [releasedBy], references: [id])

  @@index([referenceType, reference])
  @@index([status])
  @@map("wms_occurrences")
}

model WmsOccurrencePhoto {
  id           String   @id @default(uuid())
  occurrenceId String
  filePath     String // caminho relativo no volume local, nunca absoluto
  createdAt    DateTime @default(now())

  occurrence WmsOccurrence @relation(fields: [occurrenceId], references: [id], onDelete: Cascade)

  @@map("wms_occurrence_photos")
}
```

- [ ] **Step 2: Adicionar as duas relações novas em `User`**

No model `User` (`backend/prisma/schema.prisma`), ao lado das outras relações nomeadas (`warehouseTasksAssigned`, `salesOrdersCreated`, etc.), adicione:

```prisma
  occurrencesReported WmsOccurrence[] @relation("OccurrenceReporter")
  occurrencesReleased WmsOccurrence[] @relation("OccurrenceReleaser")
```

- [ ] **Step 3: Gerar e aplicar a migração**

Run (dentro de `backend/`): `npx prisma migrate dev --name add_wms_occurrences`
Expected: migração criada em `prisma/migrations/`, aplicada no MySQL de dev sem erro, `Prisma Client` regenerado automaticamente pelo próprio comando.

- [ ] **Step 4: Confirmar que o client gerado expõe os models novos**

Run: `npx prisma generate` (idempotente, garante que o client está sincronizado)
Expected: sem erro; `import { PrismaClient } from '@prisma/client'` passa a expor `prisma.wmsOccurrence` e `prisma.wmsOccurrencePhoto`.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(wms-occurrences): schema Prisma de WmsOccurrence/WmsOccurrencePhoto"
```

---

### Task 2: Seed — permissões, grants de papel, SystemSetting

**Files:**
- Modify: `backend/prisma/seed.ts`
- Modify: `backend/src/services/system-setting.service.ts`

**Interfaces:**
- Consumes: nada de tasks anteriores além do schema (Task 1).
- Produces: permissões `ocorrencias:visualizar`, `ocorrencias:reportar`, `ocorrencias:liberar` no catálogo; `SystemSetting` keys `wms.occurrence.avaria.action`, `wms.occurrence.divergencia_contagem.action`, `wms.occurrence.divergencia_contagem.threshold` — consumidas por todas as tasks de serviço/rota seguintes.

- [ ] **Step 1: Adicionar as 3 permissões ao catálogo**

Em `backend/prisma/seed.ts`, logo após o bloco de `tarefas_armazem` (linhas ~148-150):

```ts
    // Ocorrências de WMS (avaria/divergência de contagem/outro) — reportadas
    // no mobile, liberadas numa tela desktop nova. `reportar` é quem pode criar
    // (operador que está trabalhando a tarefa); `liberar` é decisão de
    // supervisão, mesmo critério que já separa `tarefas_armazem:executar` de
    // `:atribuir`.
    { resource: 'ocorrencias', action: 'visualizar', description: 'Visualizar ocorrências de armazém' },
    { resource: 'ocorrencias', action: 'reportar', description: 'Reportar ocorrência de armazém (avaria/outro)' },
    { resource: 'ocorrencias', action: 'liberar', description: 'Liberar ocorrência de armazém bloqueante' },
```

- [ ] **Step 2: Adicionar aos grants de MANAGER**

No bloco `managerPermissions` (linha ~551, ao lado de `tarefas_armazem`):

```ts
    ocorrencias: ['visualizar', 'reportar', 'liberar'],
```

- [ ] **Step 3: Adicionar aos grants de OPERATOR**

No bloco `operatorPermissions` (linha ~598, ao lado de `tarefas_armazem`):

```ts
    ocorrencias: ['reportar'],
```

(ADMIN recebe automaticamente todas as permissões do catálogo via `allPermissions`, sem precisar de entrada explícita — mesmo mecanismo de todo o resto do seed.)

- [ ] **Step 4: Adicionar as 3 `SystemSetting` novas**

Em `backend/prisma/seed.ts`, dentro do array `systemSettings` (perto de `wms.task_delay_threshold_hours`, linha ~322):

```ts
    {
      key: 'wms.occurrence.avaria.action',
      value: 'NOTIFY',
      type: 'STRING' as const,
      category: 'wms',
      label: 'Ação ao reportar avaria',
      description:
        'O que acontece quando uma avaria é reportada no mobile: NOTIFY (só notifica gestores) ou BLOCK (também bloqueia a tarefa/item até liberação).',
    },
    {
      key: 'wms.occurrence.divergencia_contagem.threshold',
      value: '3',
      type: 'NUMBER' as const,
      category: 'wms',
      label: 'Limiar de divergência de contagem',
      description:
        'Quantas divergências do MESMO produto na MESMA sessão de contagem disparam uma ocorrência automática.',
    },
    {
      key: 'wms.occurrence.divergencia_contagem.action',
      value: 'NOTIFY',
      type: 'STRING' as const,
      category: 'wms',
      label: 'Ação ao atingir limiar de divergência',
      description:
        'O que acontece quando o limiar de divergência de contagem é atingido: NOTIFY (só notifica gestores) ou BLOCK (também bloqueia o item até liberação).',
    },
```

- [ ] **Step 5: Registrar os enums fechados e o limite numérico em `system-setting.service.ts`**

Em `backend/src/services/system-setting.service.ts`:

```ts
const KEY_ENUM_VALUES: Record<string, readonly string[]> = {
  'audit.mode': ['all', 'write_only', 'errors_only', 'none'],
  'wms.occurrence.avaria.action': ['NOTIFY', 'BLOCK'],
  'wms.occurrence.divergencia_contagem.action': ['NOTIFY', 'BLOCK'],
};
```

```ts
const KEY_NUMERIC_BOUNDS: Record<string, { min: number }> = {
  'audit.retention_days': { min: 1 },
  'wms.lot_expiry_alert_days': { min: 1 },
  'wms.task_delay_threshold_hours': { min: 1 },
  'wms.occurrence.divergencia_contagem.threshold': { min: 1 },
  'manutencao.ordem_atraso_horas': { min: 1 },
  'rate_limit.general.max_requests': { min: 1 },
  'rate_limit.general.window_ms': { min: 1000 },
  'rate_limit.login.max_requests': { min: 1 },
  'rate_limit.login.window_ms': { min: 1000 },
  'rate_limit.strict.max_requests': { min: 1 },
  'rate_limit.strict.window_ms': { min: 1000 },
};
```

- [ ] **Step 6: Rodar o seed e verificar**

Run (dentro de `backend/`): `npx prisma db seed`
Expected: log `⚙️  Configurando parâmetros do sistema...` mostrando a contagem aumentada em 3, sem erro de permissão duplicada.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/seed.ts backend/src/services/system-setting.service.ts
git commit -m "feat(wms-occurrences): permissoes, grants de papel e configuracoes de sistema"
```

---

### Task 3: Upload de fotos — `multer`

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.gitignore`
- Create: `backend/src/middleware/upload.middleware.ts`

**Interfaces:**
- Produces: `uploadOccurrencePhotos` (middleware Express, `.array('photos', 5)`) e `UPLOAD_ROOT` (caminho absoluto do diretório) — consumidos pela Task 6 (rota de criação de ocorrência).

- [ ] **Step 1: Instalar `multer`**

Run (dentro de `backend/`): `npm install multer && npm install -D @types/multer`
Expected: `multer` em `dependencies`, `@types/multer` em `devDependencies` de `backend/package.json`.

- [ ] **Step 2: Ignorar o diretório de upload no git**

Adicione a `backend/.gitignore`:

```
uploads/
```

- [ ] **Step 3: Escrever o middleware de upload**

Create `backend/src/middleware/upload.middleware.ts`:

```ts
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { AppError } from './error.middleware';

/**
 * Disco local via o volume Docker que já existe (dev: `./backend:/app` em
 * docker-compose.yml monta o repo inteiro, então este diretório persiste sem
 * mudança de infra). Caminho absoluto do processo, não relativo ao cwd.
 */
export const UPLOAD_ROOT = path.join(__dirname, '../../uploads/wms-occurrences');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    cb(null, UPLOAD_ROOT);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${randomUUID()}${ext}`);
  },
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** `POST /wms-occurrences` — 0 a 5 fotos no campo `photos`. */
export const uploadOccurrencePhotos = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new AppError(400, 'Apenas fotos JPEG, PNG ou WEBP são aceitas.'));
      return;
    }
    cb(null, true);
  },
}).array('photos', 5);
```

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/.gitignore backend/src/middleware/upload.middleware.ts
git commit -m "feat(wms-occurrences): middleware de upload de fotos (multer, disco local)"
```

---

### Task 4: Validators

**Files:**
- Create: `backend/src/validators/wms-occurrence.validator.ts`
- Test: `backend/tests/integration/wms-occurrence.test.ts` (validação coberta nesta suíte de integração — ver Task 6, não há suíte de validator isolada no projeto, mesmo padrão de `counting.validator.ts`/`stock.validator.ts`)

**Interfaces:**
- Produces: `createOccurrenceSchema`, `releaseOccurrenceSchema` — consumidos pela Task 6.

- [ ] **Step 1: Escrever os schemas Joi**

Create `backend/src/validators/wms-occurrence.validator.ts`:

```ts
import Joi from 'joi';

/**
 * `POST /wms-occurrences` — criação MANUAL apenas (AVARIA/OUTRO).
 * DIVERGENCIA_CONTAGEM nunca passa por aqui — nasce dentro do serviço de
 * contagem (ver `counting-item.service.ts::count()`), então não está na lista
 * de valores aceitos.
 */
export const createOccurrenceSchema = Joi.object({
  type: Joi.string().valid('AVARIA', 'OUTRO').required().messages({
    'any.only': 'Tipo deve ser AVARIA ou OUTRO',
    'any.required': 'Tipo é obrigatório',
  }),
  referenceType: Joi.string().valid('WAREHOUSE_TASK', 'COUNTING_ITEM').required().messages({
    'any.only': 'Referência deve ser WAREHOUSE_TASK ou COUNTING_ITEM',
    'any.required': 'Tipo de referência é obrigatório',
  }),
  reference: Joi.string().uuid().required().messages({
    'string.guid': 'Referência inválida',
    'any.required': 'Referência é obrigatória',
  }),
  description: Joi.string().trim().min(1).max(2000).required().messages({
    'string.empty': 'Descrição é obrigatória',
    'any.required': 'Descrição é obrigatória',
  }),
});

export const releaseOccurrenceSchema = Joi.object({
  releaseNote: Joi.string().trim().max(2000).allow('', null),
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/validators/wms-occurrence.validator.ts
git commit -m "feat(wms-occurrences): validators de criacao e liberacao"
```

---

### Task 5: Service — `wms-occurrence.service.ts`

**Files:**
- Create: `backend/src/services/wms-occurrence.service.ts`

**Interfaces:**
- Consumes: `prisma` (`../config/database`), `AppError` (`../middleware/error.middleware`), `notificationService.createBulk` (`./notification.service`), `getSetting` (`./system-setting.service`).
- Produces (default export, `WmsOccurrenceService` instance): `createManual(dto)`, `list(status?)`, `release(id, releasedBy, releaseNote?)`, `getPhotoFilePath(photoId)`. Named exports: `assertOccurrenceNotBlocking(tx, referenceType, reference)` (usado pelas Tasks 8-10 e pelo guard de contagem), `createDivergenceOccurrenceInTx(tx, { countingItemId, reportedBy })` e `notifyOccurrenceReported(occurrence)` (usados pela Task 11).

- [ ] **Step 1: Escrever o service completo**

Create `backend/src/services/wms-occurrence.service.ts`:

```ts
import { Prisma, WmsOccurrence } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import notificationService from './notification.service';
import { getSetting } from './system-setting.service';
import { UPLOAD_ROOT } from '../middleware/upload.middleware';
import path from 'path';

export type OccurrenceReferenceType = 'WAREHOUSE_TASK' | 'COUNTING_ITEM';

export interface CreateManualOccurrenceDto {
  type: 'AVARIA' | 'OUTRO';
  referenceType: OccurrenceReferenceType;
  reference: string;
  description: string;
  reportedBy: string;
  photoFileNames: string[];
}

const occurrenceInclude = {
  photos: true,
  reporter: { select: { id: true, name: true } },
  releaser: { select: { id: true, name: true } },
} satisfies Prisma.WmsOccurrenceInclude;

class WmsOccurrenceService {
  /** `AVARIA` e `OUTRO` — o operador reportou pelo mobile. `OUTRO` nunca bloqueia (categoria genérica, sem limiar). */
  async createManual(data: CreateManualOccurrenceDto) {
    const blocking =
      data.type === 'AVARIA'
        ? (await getSetting('wms.occurrence.avaria.action', 'NOTIFY')) === 'BLOCK'
        : false;

    const occurrence = await prisma.wmsOccurrence.create({
      data: {
        type: data.type,
        referenceType: data.referenceType,
        reference: data.reference,
        description: data.description,
        blocking,
        reportedBy: data.reportedBy,
        photos: { create: data.photoFileNames.map((filePath) => ({ filePath })) },
      },
      include: occurrenceInclude,
    });

    await notifyOccurrenceReported(occurrence);
    return occurrence;
  }

  async list(status?: 'ABERTA' | 'LIBERADA') {
    return prisma.wmsOccurrence.findMany({
      where: status ? { status } : undefined,
      include: occurrenceInclude,
      orderBy: { reportedAt: 'desc' },
    });
  }

  async release(id: string, releasedBy: string, releaseNote?: string) {
    const occurrence = await prisma.wmsOccurrence.findUnique({ where: { id } });
    if (!occurrence) {
      throw new AppError(404, 'Ocorrência não encontrada');
    }
    if (occurrence.status === 'LIBERADA') {
      throw new AppError(409, 'Ocorrência já está liberada');
    }

    return prisma.wmsOccurrence.update({
      where: { id },
      data: { status: 'LIBERADA', releasedBy, releasedAt: new Date(), releaseNote },
      include: occurrenceInclude,
    });
  }

  /** Caminho absoluto no disco, a partir do nome de arquivo gravado (relativo) — nunca confia em path vindo de fora sem normalizar via `basename`. */
  async getPhotoFilePath(photoId: string): Promise<string> {
    const photo = await prisma.wmsOccurrencePhoto.findUnique({ where: { id: photoId } });
    if (!photo) {
      throw new AppError(404, 'Foto não encontrada');
    }
    return path.join(UPLOAD_ROOT, path.basename(photo.filePath));
  }
}

/**
 * Guarda condicional usada em `execute()`/`complete()`/`start()`/`putaway()`
 * de `WarehouseTask` e no registro de contagem: se houver uma `WmsOccurrence`
 * ABERTA e bloqueante para aquela referência exata, a ação é recusada.
 * Aceita tanto `prisma` quanto um `tx` de transação em andamento — as duas
 * formas satisfazem a mesma interface estrutural (`findFirst`).
 */
export const assertOccurrenceNotBlocking = async (
  tx: Prisma.TransactionClient,
  referenceType: OccurrenceReferenceType,
  reference: string
): Promise<void> => {
  const blocking = await tx.wmsOccurrence.findFirst({
    where: { referenceType, reference, status: 'ABERTA', blocking: true },
    select: { type: true },
  });

  if (blocking) {
    throw new AppError(
      400,
      `Ação bloqueada: existe uma ocorrência de ${blocking.type} aberta aguardando liberação.`
    );
  }
};

/**
 * `DIVERGENCIA_CONTAGEM` — nasce DENTRO da transação de `CountingItemService.count()`
 * quando o limiar configurado é atingido. Só grava a linha; notificação é
 * despachada DEPOIS, fora da transação (é I/O, não deve segurar lock de
 * linha do banco) — ver `notifyOccurrenceReported`, chamado pelo chamador
 * após o commit.
 */
export const createDivergenceOccurrenceInTx = async (
  tx: Prisma.TransactionClient,
  params: { countingItemId: string; reportedBy: string }
): Promise<WmsOccurrence> => {
  const blocking =
    (await getSetting('wms.occurrence.divergencia_contagem.action', 'NOTIFY')) === 'BLOCK';

  return tx.wmsOccurrence.create({
    data: {
      type: 'DIVERGENCIA_CONTAGEM',
      referenceType: 'COUNTING_ITEM',
      reference: params.countingItemId,
      description: 'Divergência de contagem acima do limiar configurado nesta sessão.',
      blocking,
      reportedBy: params.reportedBy,
    },
  });
};

/** Notifica MANAGER+ADMIN. Reaproveitado pela criação manual e pela divergência automática. */
export const notifyOccurrenceReported = async (occurrence: WmsOccurrence): Promise<void> => {
  const recipients = await prisma.user.findMany({
    where: { active: true, roles: { some: { role: { code: { in: ['MANAGER', 'ADMIN'] }, active: true } } } },
    select: { id: true },
  });

  if (recipients.length === 0) {
    return;
  }

  await notificationService.createBulk(
    recipients.map((u) => u.id),
    {
      type: occurrence.blocking ? 'ERROR' : 'WARNING',
      category: 'WAREHOUSE',
      eventType: 'wms.occurrence.reported',
      title: 'Ocorrência de Armazém Reportada',
      message: `Ocorrência ${occurrence.type} reportada${occurrence.blocking ? ' — tarefa/item bloqueado até liberação' : ''}.`,
      data: {
        occurrenceId: occurrence.id,
        type: occurrence.type,
        referenceType: occurrence.referenceType,
        reference: occurrence.reference,
      },
      link: '/occurrences',
      resourceType: 'WmsOccurrence',
      resourceId: occurrence.id,
      priority: occurrence.blocking ? 4 : 2,
    }
  );
};

export default new WmsOccurrenceService();
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/services/wms-occurrence.service.ts
git commit -m "feat(wms-occurrences): service de ocorrencias (criacao manual, listagem, liberacao, guard de bloqueio)"
```

---

### Task 6: Controller + rota + montagem

**Files:**
- Create: `backend/src/controllers/wms-occurrence.controller.ts`
- Create: `backend/src/routes/wms-occurrence.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/integration/wms-occurrence.test.ts`

**Interfaces:**
- Consumes: `wmsOccurrenceService` (Task 5), `uploadOccurrencePhotos` (Task 3), `createOccurrenceSchema`/`releaseOccurrenceSchema` (Task 4).
- Produces: `POST /api/v1/wms-occurrences`, `GET /api/v1/wms-occurrences?status=`, `POST /api/v1/wms-occurrences/:id/release`, `GET /api/v1/wms-occurrences/photos/:photoId` — consumidos pelo frontend (Tasks 14+).

- [ ] **Step 1: Escrever o teste de integração (RED)**

Create `backend/tests/integration/wms-occurrence.test.ts`:

```ts
import request from 'supertest';
import fs from 'fs';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions, setTestLicensedModule } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import { clearSettingCache } from '../../src/services/system-setting.service';
import { UPLOAD_ROOT } from '../../src/middleware/upload.middleware';

/**
 * Não existe fixture pronta de `WarehouseTask` em `tests/helpers/` — nos testes
 * existentes do projeto toda tarefa nasce de um fluxo de negócio real
 * (recebimento/separação), porque é assim que o schema é normalmente populado.
 * Aqui o guard de bloqueio só precisa de UMA tarefa existente com `type`/`status`
 * válidos; os campos de negócio (produto, posições, quantidade) não importam
 * para os testes desta suíte, então criação direta via Prisma é suficiente e
 * não exige reaproveitar nenhum fluxo de API.
 */
const createTestWarehouseTask = (overrides: Partial<{ type: string }> = {}) =>
  testPrisma.warehouseTask.create({ data: { type: (overrides.type ?? 'CONFERENCIA') as any } });

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return { user, token: res.body.data.accessToken as string };
};

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

describe('Integração: POST/GET /api/v1/wms-occurrences e /release', () => {
  beforeEach(async () => {
    await setTestLicensedModule('WMS', true);
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    clearSettingCache();
    await cleanDatabase();
    if (fs.existsSync(UPLOAD_ROOT)) {
      fs.rmSync(UPLOAD_ROOT, { recursive: true, force: true });
    }
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria uma ocorrência AVARIA manual com foto e notifica MANAGER/ADMIN', async () => {
    const { token: operatorToken } = await login([{ resource: 'ocorrencias', action: 'reportar' }]);
    const { user: manager } = await login([{ resource: 'ocorrencias', action: 'liberar' }]);
    // `createUserWithPermissions` cria um papel ad-hoc com as permissões pedidas,
    // não o papel MANAGER do seed — associamos ao MANAGER de verdade aqui porque
    // é dessa associação (`role.code = 'MANAGER'`, ver `notifyOccurrenceReported`)
    // que o destinatário da notificação é encontrado, não da permissão isolada.
    const managerRole = await testPrisma.role.findUniqueOrThrow({ where: { code: 'MANAGER' } });
    await testPrisma.userRole.create({ data: { userId: manager.id, roleId: managerRole.id } });

    const task = await createTestWarehouseTask();

    const res = await request(app)
      .post('/api/v1/wms-occurrences')
      .set('Authorization', `Bearer ${operatorToken}`)
      .field('type', 'AVARIA')
      .field('referenceType', 'WAREHOUSE_TASK')
      .field('reference', task.id)
      .field('description', 'Palete caiu e avariou duas caixas')
      .attach('photos', TINY_PNG, 'avaria.png');

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('AVARIA');
    expect(res.body.data.status).toBe('ABERTA');
    expect(res.body.data.photos).toHaveLength(1);

    const notifications = await testPrisma.notification.findMany({ where: { userId: manager.id } });
    expect(notifications.some((n) => n.eventType === 'wms.occurrence.reported')).toBe(true);
  });

  it('nega 403 para quem não tem ocorrencias:reportar', async () => {
    const { token } = await login([{ resource: 'ocorrencias', action: 'visualizar' }]);
    const task = await createTestWarehouseTask();

    const res = await request(app)
      .post('/api/v1/wms-occurrences')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'AVARIA')
      .field('referenceType', 'WAREHOUSE_TASK')
      .field('reference', task.id)
      .field('description', 'x');

    expect(res.status).toBe(403);
  });

  it('bloqueia quando wms.occurrence.avaria.action=BLOCK e libera via /release', async () => {
    await testPrisma.systemSetting.update({
      where: { key: 'wms.occurrence.avaria.action' },
      data: { value: 'BLOCK' },
    });
    clearSettingCache();

    const { token: operatorToken } = await login([{ resource: 'ocorrencias', action: 'reportar' }]);
    const { token: managerToken } = await login([
      { resource: 'ocorrencias', action: 'liberar' },
      { resource: 'ocorrencias', action: 'visualizar' },
    ]);
    const task = await createTestWarehouseTask();

    const created = await request(app)
      .post('/api/v1/wms-occurrences')
      .set('Authorization', `Bearer ${operatorToken}`)
      .field('type', 'AVARIA')
      .field('referenceType', 'WAREHOUSE_TASK')
      .field('reference', task.id)
      .field('description', 'Avaria grave');

    expect(created.body.data.blocking).toBe(true);

    const list = await request(app)
      .get('/api/v1/wms-occurrences?status=ABERTA')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const released = await request(app)
      .post(`/api/v1/wms-occurrences/${created.body.data.id}/release`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ releaseNote: 'Avaliado, liberado' });

    expect(released.status).toBe(200);
    expect(released.body.data.status).toBe('LIBERADA');
  });
});
```

- [ ] **Step 2: Verificar que o teste falha (RED)**

Run (dentro de `backend/`): `npm run test:integration -- wms-occurrence.test.ts`
Expected: FAIL — `Cannot find module '../../src/controllers/wms-occurrence.controller'` (ou rota 404), porque nada foi criado ainda.

- [ ] **Step 3: Escrever o controller**

Create `backend/src/controllers/wms-occurrence.controller.ts`:

```ts
import { Response, NextFunction } from 'express';
import fs from 'fs';
import { AuthRequest } from '../middleware/auth.middleware';
import wmsOccurrenceService from '../services/wms-occurrence.service';
import { AppError } from '../middleware/error.middleware';

class WmsOccurrenceController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const occurrence = await wmsOccurrenceService.createManual({
        type: req.body.type,
        referenceType: req.body.referenceType,
        reference: req.body.reference,
        description: req.body.description,
        reportedBy: req.userId!,
        photoFileNames: files.map((f) => f.filename),
      });

      return res.status(201).json({
        status: 'success',
        message: 'Ocorrência registrada',
        data: occurrence,
      });
    } catch (error) {
      return next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as 'ABERTA' | 'LIBERADA' | undefined;
      const data = await wmsOccurrenceService.list(status);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  async release(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const occurrence = await wmsOccurrenceService.release(
        req.params.id,
        req.userId!,
        req.body.releaseNote
      );
      return res.status(200).json({ status: 'success', message: 'Ocorrência liberada', data: occurrence });
    } catch (error) {
      return next(error);
    }
  }

  async getPhoto(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const filePath = await wmsOccurrenceService.getPhotoFilePath(req.params.photoId);
      if (!fs.existsSync(filePath)) {
        throw new AppError(404, 'Arquivo de foto não encontrado no disco');
      }
      return res.sendFile(filePath);
    } catch (error) {
      return next(error);
    }
  }
}

export default new WmsOccurrenceController();
```

- [ ] **Step 4: Escrever a rota**

Create `backend/src/routes/wms-occurrence.routes.ts`:

```ts
import { Router } from 'express';
import wmsOccurrenceController from '../controllers/wms-occurrence.controller';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { uploadOccurrencePhotos } from '../middleware/upload.middleware';
import { createOccurrenceSchema, releaseOccurrenceSchema } from '../validators/wms-occurrence.validator';

const router = Router();

/**
 * Superfície de Ocorrências (avaria/divergência de contagem/outro), primeira
 * entrega do módulo Coletor de Dados/Mobile. `multer` roda ANTES do `validate`
 * — é ele que popula `req.body` a partir do multipart antes do Joi validar.
 */
router.post(
  '/',
  requirePermission('ocorrencias', 'reportar'),
  uploadOccurrencePhotos,
  validate(createOccurrenceSchema),
  wmsOccurrenceController.create
);

router.get('/', requirePermission('ocorrencias', 'visualizar'), wmsOccurrenceController.list);

router.post(
  '/:id/release',
  requirePermission('ocorrencias', 'liberar'),
  validate(releaseOccurrenceSchema),
  wmsOccurrenceController.release
);

// Autenticado, mas sem RBAC de recurso adicional — qualquer usuário logado
// que já viu a ocorrência (lista ou detalhe de tarefa bloqueada) pode ver a
// foto anexada a ela; o dado sensível é a foto, não "quem pode ver ocorrência".
router.get('/photos/:photoId', wmsOccurrenceController.getPhoto);

export default router;
```

- [ ] **Step 5: Montar a rota em `routes/index.ts`**

Em `backend/src/routes/index.ts`, adicione o import perto de `warehouseTaskRoutes`:

```ts
import wmsOccurrenceRoutes from './wms-occurrence.routes';
```

E a montagem logo após a linha de `wms-workflow-templates` (linha ~110):

```ts
// Ocorrências de WMS (avaria/divergência de contagem/outro) — primeira
// entrega do Coletor de Dados/Mobile. Mesmo requireModule('WMS') do resto do
// armazém; sem LicensedModule próprio (ver Global Constraints do plano).
router.use('/wms-occurrences', requireModule('WMS'), wmsOccurrenceRoutes);
```

- [ ] **Step 6: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test:integration -- wms-occurrence.test.ts`
Expected: PASS, 3/3 testes.

- [ ] **Step 7: Rodar a suíte de integração inteira**

Run: `npm run test:integration`
Expected: todos os testes passam (nenhuma regressão nas rotas existentes).

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/wms-occurrence.controller.ts backend/src/routes/wms-occurrence.routes.ts backend/src/routes/index.ts backend/tests/integration/wms-occurrence.test.ts
git commit -m "feat(wms-occurrences): endpoints de criacao, listagem, liberacao e foto"
```

---

## PHASE B — Backend: guard de bloqueio + divergência automática

### Task 7: Guard em `WarehouseTask` — start/complete

**Files:**
- Modify: `backend/src/services/warehouse-task.service.ts`
- Test: `backend/tests/integration/wms-occurrence-blocking.test.ts`

**Interfaces:**
- Consumes: `assertOccurrenceNotBlocking` (Task 5).
- Produces: `startTask`/`completeTask` agora recusam com 400 quando há ocorrência bloqueante aberta para `WAREHOUSE_TASK`/o id da tarefa.

- [ ] **Step 1: Escrever o teste de integração (RED)**

Create `backend/tests/integration/wms-occurrence-blocking.test.ts`:

```ts
import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions, setTestLicensedModule } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import { clearSettingCache } from '../../src/services/system-setting.service';

/**
 * Sem fixture pronta de `WarehouseTask` (ver a mesma nota em `wms-occurrence.test.ts`).
 * O guard roda ANTES de qualquer checagem de produto/posição/quantidade em
 * `executeTask`/`completeTask`/`startTask`/`completePutaway` (ver onde ele foi
 * inserido nas Tasks 7-8: logo após `assertTaskIsOpen`), então uma tarefa com
 * só `type` já é suficiente para os testes desta suíte — nenhum deles chega a
 * exercitar a movimentação de estoque de verdade.
 */
const createTestWarehouseTask = (overrides: Partial<{ type: string }> = {}) =>
  testPrisma.warehouseTask.create({ data: { type: (overrides.type ?? 'CONFERENCIA') as any } });

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return res.body.data.accessToken as string;
};

describe('Integração: bloqueio de WarehouseTask por WmsOccurrence', () => {
  beforeEach(async () => {
    await setTestLicensedModule('WMS', true);
    clearLicensedModuleCache();
    await testPrisma.systemSetting.update({
      where: { key: 'wms.occurrence.avaria.action' },
      data: { value: 'BLOCK' },
    });
    clearSettingCache();
  });

  afterEach(async () => {
    clearSettingCache();
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('recusa /start e /complete quando há ocorrência ABERTA bloqueante para a tarefa', async () => {
    const token = await login([
      { resource: 'tarefas_armazem', action: 'executar' },
      { resource: 'ocorrencias', action: 'reportar' },
    ]);
    const task = await createTestWarehouseTask({ type: 'CONFERENCIA' });

    await request(app)
      .post('/api/v1/wms-occurrences')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'AVARIA')
      .field('referenceType', 'WAREHOUSE_TASK')
      .field('reference', task.id)
      .field('description', 'Bloqueando para teste');

    const startRes = await request(app)
      .post(`/api/v1/warehouse-tasks/${task.id}/start`)
      .set('Authorization', `Bearer ${token}`);
    expect(startRes.status).toBe(400);
    expect(startRes.body.message).toMatch(/ocorrência/i);

    const completeRes = await request(app)
      .post(`/api/v1/warehouse-tasks/${task.id}/complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(completeRes.status).toBe(400);
  });
});
```

- [ ] **Step 2: Verificar que o teste falha (RED)**

Run: `npm run test:integration -- wms-occurrence-blocking.test.ts`
Expected: FAIL — `/start` e `/complete` respondem 200 (a tarefa é iniciada/concluída normalmente, guard ainda não existe).

- [ ] **Step 3: Plugar o guard em `startTask` e `completeTask`**

Em `backend/src/services/warehouse-task.service.ts`, adicione o import:

```ts
import { assertOccurrenceNotBlocking } from './wms-occurrence.service';
```

Em `startTask` (logo após `assertTaskIsOpen(task)`, linha ~928):

```ts
    assertTaskIsOpen(task);
    await assertOccurrenceNotBlocking(tx, 'WAREHOUSE_TASK', task.id);
```

Em `completeTask` (logo após `assertTaskIsOpen(task)`, linha ~752):

```ts
    assertTaskIsOpen(task);
    await assertOccurrenceNotBlocking(tx, 'WAREHOUSE_TASK', task.id);
    await assertChainOrderResolved(tx, task);
```

- [ ] **Step 4: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test:integration -- wms-occurrence-blocking.test.ts`
Expected: PASS.

- [ ] **Step 5: Rodar a suíte de `warehouse-task` inteira (regressão)**

Run: `npm run test:integration -- warehouse-task`
Expected: todos os testes existentes continuam passando (o guard só bloqueia quando existe ocorrência ABERTA+bloqueante, o que nenhum teste pré-existente cria).

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/warehouse-task.service.ts backend/tests/integration/wms-occurrence-blocking.test.ts
git commit -m "feat(wms-occurrences): guard de bloqueio em start/complete de WarehouseTask"
```

---

### Task 8: Guard em `executeTask` (PICKING/REPLENISHMENT) e `completePutaway` (ALOCACAO)

**Files:**
- Modify: `backend/src/services/warehouse-task-execution.service.ts`
- Modify: `backend/src/services/purchase-receipt.service.ts`
- Modify: `backend/tests/integration/wms-occurrence-blocking.test.ts`

**Interfaces:**
- Consumes: `assertOccurrenceNotBlocking` (Task 5).
- Produces: `executeTask`/`completePutaway` agora recusam com 400 nas mesmas condições da Task 7 — cobre os dois caminhos de conclusão que `assertTaskIsOpen` não cobria na Task 7 (`execute` e `putaway` são funções separadas, em arquivos separados, por causa do desenho de dependência já documentado no topo de `warehouse-task-execution.service.ts`).

- [ ] **Step 1: Estender o teste de integração (RED)**

Adicione a `backend/tests/integration/wms-occurrence-blocking.test.ts`, dentro do mesmo `describe`:

```ts
  it('recusa /execute (PICKING) quando há ocorrência ABERTA bloqueante para a tarefa', async () => {
    const token = await login([
      { resource: 'tarefas_armazem', action: 'executar' },
      { resource: 'ocorrencias', action: 'reportar' },
    ]);
    const task = await createTestWarehouseTask({ type: 'PICKING' });

    await request(app)
      .post('/api/v1/wms-occurrences')
      .set('Authorization', `Bearer ${token}`)
      .field('type', 'AVARIA')
      .field('referenceType', 'WAREHOUSE_TASK')
      .field('reference', task.id)
      .field('description', 'Bloqueando execução');

    const res = await request(app)
      .post(`/api/v1/warehouse-tasks/${task.id}/execute`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/ocorrência/i);
  });
```

- [ ] **Step 2: Verificar que o novo teste falha (RED)**

Run: `npm run test:integration -- wms-occurrence-blocking.test.ts`
Expected: FAIL no teste novo — `/execute` responde com sucesso (200), guard ainda não existe nesse arquivo.

- [ ] **Step 3: Plugar o guard em `executeTask`**

Em `backend/src/services/warehouse-task-execution.service.ts`, adicione o import:

```ts
import { assertOccurrenceNotBlocking } from './wms-occurrence.service';
```

Logo após `assertTaskIsOpen(task)` (linha ~103):

```ts
    assertTaskIsOpen(task);
    await assertOccurrenceNotBlocking(tx, 'WAREHOUSE_TASK', task.id);
```

- [ ] **Step 4: Plugar o guard em `completePutaway`**

Em `backend/src/services/purchase-receipt.service.ts`, adicione o import (junto aos demais de `warehouse-task.service.ts`):

```ts
import { assertOccurrenceNotBlocking } from './wms-occurrence.service';
```

Logo após `assertTaskIsOpen(task)` (linha ~396):

```ts
      assertTaskIsOpen(task);
      await assertOccurrenceNotBlocking(tx, 'WAREHOUSE_TASK', task.id);
```

- [ ] **Step 5: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test:integration -- wms-occurrence-blocking.test.ts`
Expected: PASS, todos os testes do arquivo (incluindo os da Task 7).

- [ ] **Step 6: Rodar as suítes de execução/recebimento (regressão)**

Run: `npm run test:integration -- warehouse-task-execution purchase-receipt`
Expected: todos os testes existentes continuam passando.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/warehouse-task-execution.service.ts backend/src/services/purchase-receipt.service.ts backend/tests/integration/wms-occurrence-blocking.test.ts
git commit -m "feat(wms-occurrences): guard de bloqueio em execute (picking/replenishment) e putaway"
```

---

### Task 9: Divergência de contagem automática + guard em recount/accept

**Files:**
- Modify: `backend/src/services/counting-item.service.ts`
- Create: `backend/tests/integration/counting-divergence-occurrence.test.ts`

**Interfaces:**
- Consumes: `createDivergenceOccurrenceInTx`, `notifyOccurrenceReported`, `assertOccurrenceNotBlocking` (Task 5); `getSetting` (já usado em outros services).
- Produces: `CountingItemService.count()` cria automaticamente uma `WmsOccurrence` do tipo `DIVERGENCIA_CONTAGEM` quando a contagem de itens com `hasDifference=true` do MESMO produto na MESMA sessão atinge exatamente `wms.occurrence.divergencia_contagem.threshold`; `recount()`/`accept()` recusam com 400 quando o item tem ocorrência bloqueante aberta.

- [ ] **Step 1: Escrever o teste de integração (RED)**

Create `backend/tests/integration/counting-divergence-occurrence.test.ts`:

```ts
import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions, createTestProduct, setTestLicensedModule } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';
import { clearSettingCache } from '../../src/services/system-setting.service';

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return { user, token: res.body.data.accessToken as string };
};

/** Cria um plano+sessão+N itens de contagem do MESMO produto, todos PENDING, sem tolerância (qualquer diferença já diverge). */
async function seedSessionWithItems(itemCount: number) {
  const planOwner = await createUserWithPermissions([]);
  // `createTestProduct` (helper existente, usado em toda suíte do projeto) cria
  // seu próprio `UnitOfMeasure` — não depende de dado pré-seedado que
  // `cleanDatabase()` (chamado a cada `afterEach`) teria truncado.
  const product = await createTestProduct();
  const plan = await testPrisma.countingPlan.create({
    data: {
      code: `PLDIV-${Date.now()}`,
      name: 'Plano Teste Divergência',
      type: 'CYCLIC',
      tolerancePercent: 0,
      toleranceQty: 0,
      requireRecount: false,
      startDate: new Date(),
      createdBy: planOwner.id,
    },
  });
  const session = await testPrisma.countingSession.create({
    data: { code: `SESS-${Date.now()}`, planId: plan.id, status: 'IN_PROGRESS', scheduledDate: new Date() },
  });
  const items = [];
  for (let i = 0; i < itemCount; i++) {
    items.push(
      await testPrisma.countingItem.create({
        data: { sessionId: session.id, productId: product.id, systemQty: 100 },
      })
    );
  }
  return { product, session, items };
}

describe('Integração: WmsOccurrence automática por divergência de contagem', () => {
  beforeEach(async () => {
    await setTestLicensedModule('WMS', true);
    clearLicensedModuleCache();
    await testPrisma.systemSetting.update({
      where: { key: 'wms.occurrence.divergencia_contagem.threshold' },
      data: { value: '2' },
    });
    clearSettingCache();
  });

  afterEach(async () => {
    clearSettingCache();
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria a ocorrência exatamente na 2ª divergência do mesmo produto/sessão, não antes nem de novo depois', async () => {
    const { token } = await login([{ resource: 'contagem', action: 'executar' }]);
    const { items } = await seedSessionWithItems(3);

    const first = await request(app)
      .post(`/api/v1/counting/items/${items[0].id}/count`)
      .set('Authorization', `Bearer ${token}`)
      .send({ countedQty: 50 });
    expect(first.status).toBe(200);
    expect(await testPrisma.wmsOccurrence.count()).toBe(0);

    const second = await request(app)
      .post(`/api/v1/counting/items/${items[1].id}/count`)
      .set('Authorization', `Bearer ${token}`)
      .send({ countedQty: 50 });
    expect(second.status).toBe(200);
    expect(await testPrisma.wmsOccurrence.count()).toBe(1);
    const occurrence = await testPrisma.wmsOccurrence.findFirstOrThrow();
    expect(occurrence.type).toBe('DIVERGENCIA_CONTAGEM');
    expect(occurrence.referenceType).toBe('COUNTING_ITEM');
    expect(occurrence.reference).toBe(items[1].id);

    const third = await request(app)
      .post(`/api/v1/counting/items/${items[2].id}/count`)
      .set('Authorization', `Bearer ${token}`)
      .send({ countedQty: 50 });
    expect(third.status).toBe(200);
    expect(await testPrisma.wmsOccurrence.count()).toBe(1); // não dispara de novo na 3ª
  });

  it('recusa recount() e accept() quando o item tem ocorrência ABERTA bloqueante', async () => {
    await testPrisma.systemSetting.update({
      where: { key: 'wms.occurrence.divergencia_contagem.action' },
      data: { value: 'BLOCK' },
    });
    clearSettingCache();

    const { token } = await login([{ resource: 'contagem', action: 'executar' }, { resource: 'contagem', action: 'recontar' }, { resource: 'contagem', action: 'aprovar_divergencia' }]);
    const { items } = await seedSessionWithItems(2);

    await request(app).post(`/api/v1/counting/items/${items[0].id}/count`).set('Authorization', `Bearer ${token}`).send({ countedQty: 50 });
    const trigger = await request(app).post(`/api/v1/counting/items/${items[1].id}/count`).set('Authorization', `Bearer ${token}`).send({ countedQty: 50 });
    expect((await testPrisma.wmsOccurrence.findFirstOrThrow()).reference).toBe(items[1].id);

    const recountRes = await request(app)
      .post(`/api/v1/counting/items/${items[1].id}/recount`)
      .set('Authorization', `Bearer ${token}`)
      .send({ recountQty: 55 });
    expect(recountRes.status).toBe(400);
    expect(recountRes.body.message).toMatch(/ocorrência/i);
  });
});
```

- [ ] **Step 2: Verificar que o teste falha (RED)**

Run: `npm run test:integration -- counting-divergence-occurrence.test.ts`
Expected: FAIL — `wmsOccurrence.count()` continua `0` após a 2ª divergência (a lógica ainda não existe).

- [ ] **Step 3: Adicionar detecção de divergência a `count()`**

Em `backend/src/services/counting-item.service.ts`, adicione os imports:

```ts
import { createDivergenceOccurrenceInTx, notifyOccurrenceReported, assertOccurrenceNotBlocking } from './wms-occurrence.service';
import { getSetting } from './system-setting.service';
```

Substitua o corpo de `count()` (mantendo tudo que já existe dentro da transação) para capturar a ocorrência criada e notificar DEPOIS do commit:

```ts
  async count(id: string, data: CountItemDTO): Promise<CountingItem> {
    const { updatedItem, occurrence } = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM counting_items WHERE id = ${id} FOR UPDATE`;

      const item = await tx.countingItem.findUnique({
        where: { id },
        include: { session: { include: { plan: true } } },
      });

      if (!item) {
        throw new AppError(404, 'Item de contagem não encontrado');
      }

      if (item.status !== 'PENDING') {
        throw new AppError(409, 'Item já foi contado');
      }

      const difference = data.countedQty - Number(item.systemQty);
      const differencePercent = Number(item.systemQty) > 0
        ? (difference / Number(item.systemQty)) * 100
        : 0;

      const plan = item.session.plan;
      const tolerancePercent = Number(plan.tolerancePercent) || 0;
      const toleranceQty = plan.toleranceQty || 0;

      const withinTolerance =
        Math.abs(differencePercent) <= tolerancePercent ||
        Math.abs(difference) <= toleranceQty;

      const hasDifference = !withinTolerance && difference !== 0;

      let status: CountingItemStatus = 'COUNTED';
      let finalQty = data.countedQty;

      if (!hasDifference) {
        status = 'ADJUSTED';
        finalQty = data.countedQty;
      } else if (plan.requireRecount) {
        status = 'COUNTED';
      } else {
        status = 'COUNTED';
        finalQty = data.countedQty;
      }

      const updatedItem = await tx.countingItem.update({
        where: { id },
        data: {
          countedQty: data.countedQty,
          difference,
          differencePercent,
          hasDifference,
          status,
          finalQty: status === 'ADJUSTED' ? finalQty : null,
          notes: data.notes,
          countedBy: data.countedBy,
          countedAt: new Date(),
        },
        include: {
          product: true,
          session: { include: { plan: true } },
        },
      });

      const items = await tx.countingItem.findMany({ where: { sessionId: item.sessionId } });
      const countedItems = items.filter((i) => i.status !== 'PENDING' && i.status !== 'CANCELLED').length;
      const itemsWithDiff = items.filter((i) => i.hasDifference).length;

      await tx.countingSession.update({
        where: { id: item.sessionId },
        data: { countedItems, itemsWithDiff },
      });

      // ---- OCORRÊNCIA AUTOMÁTICA DE DIVERGÊNCIA (Coletor de Dados/Mobile) ----
      // Dispara EXATAMENTE quando o limiar é atingido, não em >= — evita criar
      // uma segunda ocorrência a cada divergência subsequente da mesma sessão.
      let occurrence = null;
      if (hasDifference) {
        const threshold = await getSetting('wms.occurrence.divergencia_contagem.threshold', 3);
        const divergenceCount = await tx.countingItem.count({
          where: { sessionId: item.sessionId, productId: item.productId, hasDifference: true },
        });
        if (divergenceCount === threshold) {
          occurrence = await createDivergenceOccurrenceInTx(tx, {
            countingItemId: updatedItem.id,
            reportedBy: data.countedBy,
          });
        }
      }

      return { updatedItem, occurrence };
    });

    if (occurrence) {
      await notifyOccurrenceReported(occurrence);
    }

    return updatedItem;
  }
```

- [ ] **Step 4: Adicionar o guard a `recount()` e `accept()`**

Em `recount()`, logo após a checagem `if (item.status !== 'COUNTED')`:

```ts
      if (item.status !== 'COUNTED') {
        throw new AppError(400, 'Item não está aguardando recontagem');
      }

      await assertOccurrenceNotBlocking(tx, 'COUNTING_ITEM', id);
```

Em `accept()` (sem transação hoje — o guard usa `prisma` diretamente, que satisfaz a mesma interface estrutural que `assertOccurrenceNotBlocking` espera):

```ts
  async accept(id: string, reason?: string): Promise<CountingItem> {
    const item = await this.findById(id);
    if (!item) {
      throw new AppError(404, 'Item de contagem não encontrado');
    }

    if (item.status !== 'COUNTED') {
      throw new AppError(400, 'Item não pode ser aceito');
    }

    await assertOccurrenceNotBlocking(prisma, 'COUNTING_ITEM', id);

    return await prisma.countingItem.update({
      where: { id },
      data: {
        status: 'RECOUNTED',
        finalQty: item.countedQty,
        reason,
      },
    });
  }
```

- [ ] **Step 5: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test:integration -- counting-divergence-occurrence.test.ts`
Expected: PASS, 2/2 testes.

- [ ] **Step 6: Rodar a suíte de contagem inteira (regressão)**

Run: `npm run test:integration -- counting`
Expected: todos os testes existentes (`counting-item`, `counting-session`, `counting-plan`, etc.) continuam passando.

- [ ] **Step 7: Rodar a suíte de integração completa**

Run: `npm run test:integration`
Expected: 100% verde — nenhuma regressão em nenhum módulo.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/counting-item.service.ts backend/tests/integration/counting-divergence-occurrence.test.ts
git commit -m "feat(wms-occurrences): ocorrencia automatica de divergencia de contagem + guard em recount/accept"
```

---

## PHASE C — Frontend: infraestrutura mobile

### Task 10: Dependências novas + PWA

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/public/pwa-icon-192.png`, `frontend/public/pwa-icon-512.png`

**Interfaces:**
- Produces: plugin `VitePWA` configurado, ícones publicados em `frontend/public/` — consumidos pelo build de produção (manifest + service worker).

- [ ] **Step 1: Instalar as dependências**

Run (dentro de `frontend/`): `npm install @zxing/browser idb && npm install -D vite-plugin-pwa`
Expected: `@zxing/browser` e `idb` em `dependencies`, `vite-plugin-pwa` em `devDependencies` de `frontend/package.json`.

- [ ] **Step 2: Gerar os ícones do PWA**

Crie (ou copie de `frontend/public/logo.png`, redimensionado) dois PNGs quadrados: `frontend/public/pwa-icon-192.png` (192×192) e `frontend/public/pwa-icon-512.png` (512×512). Se não houver ferramenta de imagem disponível no ambiente, reutilize `frontend/public/logo.png` como os dois arquivos (mesmo conteúdo, nomes diferentes) — funcional para instalação do PWA, refinamento visual fica para quando houver arte dedicada.

- [ ] **Step 3: Configurar o plugin no Vite**

Em `frontend/vite.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      // Escopo restrito a /mobile — não faz cache agressivo do app-shell
      // desktop, que arriscaria servir tela desatualizada (ver spec, seção PWA).
      includeAssets: ['pwa-icon-192.png', 'pwa-icon-512.png'],
      manifest: {
        name: 'Fabric WMS — Coletor de Dados',
        short_name: 'Fabric Coletor',
        description: 'Separação, recebimento, transferências e contagem via coletor/celular.',
        start_url: '/mobile',
        scope: '/mobile',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f172a',
        icons: [
          { src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Só as rotas /mobile precisam funcionar ao reabrir sem sinal; o
        // desktop nunca é acessado via app instalado.
        navigateFallback: '/mobile',
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:3005',
        changeOrigin: true
      }
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts']
  }
})
```

- [ ] **Step 4: Verificar que o build continua funcionando**

Run (dentro de `frontend/`): `npm run build`
Expected: build conclui sem erro, com `dist/manifest.webmanifest` e `dist/sw.js` gerados.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/public/pwa-icon-192.png frontend/public/pwa-icon-512.png
git commit -m "feat(mobile): dependencias e configuracao de PWA (vite-plugin-pwa, zxing, idb)"
```

---

### Task 11: Types + service frontend de Ocorrências

**Files:**
- Create: `frontend/src/types/wms-occurrence.types.ts`
- Create: `frontend/src/services/wms-occurrence.service.ts`

**Interfaces:**
- Produces: `WmsOccurrence`, `WmsOccurrenceType`, `CreateWmsOccurrenceDto` (types); `wmsOccurrenceService.create/list/release/getPhotoUrl` — consumidos pela store (Task 12) e pelas views mobile/desktop.

- [ ] **Step 1: Escrever os tipos**

Create `frontend/src/types/wms-occurrence.types.ts`:

```ts
/** Espelha o schema Prisma (`wms_occurrences`, `wms_occurrence_photos`). */

export const WMS_OCCURRENCE_TYPES = ['AVARIA', 'DIVERGENCIA_CONTAGEM', 'OUTRO'] as const
export type WmsOccurrenceType = (typeof WMS_OCCURRENCE_TYPES)[number]

export const WMS_OCCURRENCE_STATUSES = ['ABERTA', 'LIBERADA'] as const
export type WmsOccurrenceStatus = (typeof WMS_OCCURRENCE_STATUSES)[number]

export type WmsOccurrenceReferenceType = 'WAREHOUSE_TASK' | 'COUNTING_ITEM'

export interface WmsOccurrencePhoto {
  id: string
  occurrenceId: string
  filePath: string
  createdAt: string
}

export interface WmsOccurrence {
  id: string
  type: WmsOccurrenceType
  referenceType: WmsOccurrenceReferenceType
  reference: string
  description: string
  status: WmsOccurrenceStatus
  blocking: boolean
  reportedBy: string
  reportedAt: string
  releasedBy: string | null
  releasedAt: string | null
  releaseNote: string | null
  photos: WmsOccurrencePhoto[]
  reporter?: { id: string; name: string }
  releaser?: { id: string; name: string } | null
}

/** Só AVARIA/OUTRO — DIVERGENCIA_CONTAGEM nunca é criada manualmente. */
export interface CreateWmsOccurrenceDto {
  type: Extract<WmsOccurrenceType, 'AVARIA' | 'OUTRO'>
  referenceType: WmsOccurrenceReferenceType
  reference: string
  description: string
  photos?: File[]
}
```

- [ ] **Step 2: Escrever o service (multipart no create)**

Create `frontend/src/services/wms-occurrence.service.ts`:

```ts
import api from './api.service'
import type { WmsOccurrence, CreateWmsOccurrenceDto, WmsOccurrenceStatus } from '@/types/wms-occurrence.types'

const baseURL = import.meta.env.VITE_API_URL || '/api/v1'

class WmsOccurrenceService {
  private readonly basePath = '/wms-occurrences'

  async create(data: CreateWmsOccurrenceDto): Promise<WmsOccurrence> {
    const form = new FormData()
    form.append('type', data.type)
    form.append('referenceType', data.referenceType)
    form.append('reference', data.reference)
    form.append('description', data.description)
    for (const photo of data.photos ?? []) {
      form.append('photos', photo)
    }

    const response = await api.post(this.basePath, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data.data
  }

  async list(status?: WmsOccurrenceStatus): Promise<WmsOccurrence[]> {
    const params = status ? `?status=${status}` : ''
    const response = await api.get(`${this.basePath}${params}`)
    return response.data.data
  }

  async release(id: string, releaseNote?: string): Promise<WmsOccurrence> {
    const response = await api.post(`${this.basePath}/${id}/release`, { releaseNote })
    return response.data.data
  }

  /** URL de foto usada em `<img>` — o token vai no header via interceptor do axios, então esta URL crua só serve pra requisições autenticadas via `api`, nunca como `src` direto sem o token. */
  photoDownloadPath(photoId: string): string {
    return `${baseURL}${this.basePath}/photos/${photoId}`
  }
}

export default new WmsOccurrenceService()
```

- [ ] **Step 2b: Nota de implementação para as views que exibem fotos**

`photoDownloadPath()` devolve um caminho absoluto de API, não uma URL pronta para `<img src>` (o endpoint exige `Authorization: Bearer`, que um `<img>` não envia). As views que exibem fotos (Task 22, `OccurrencesView.vue`) devem buscar o binário via `api.get(path, { responseType: 'blob' })` e montar um `URL.createObjectURL(blob)` — não usar `photoDownloadPath()` direto num `src`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/wms-occurrence.types.ts frontend/src/services/wms-occurrence.service.ts
git commit -m "feat(mobile): tipos e service frontend de ocorrencias"
```

---

### Task 12: Store `wms-occurrence.store.ts`

**Files:**
- Create: `frontend/src/stores/wms-occurrence.store.ts`

**Interfaces:**
- Consumes: `wmsOccurrenceService` (Task 11).
- Produces: `useWmsOccurrenceStore()` com `occurrences`, `loading`, `error`, `fetchOpen()`, `create(dto)`, `release(id, note?)` — consumido por `OccurrencesView.vue` (Task 23) e pelo fluxo de "Reportar Ocorrência" das views mobile (Task 21).

- [ ] **Step 1: Escrever a store**

Create `frontend/src/stores/wms-occurrence.store.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import wmsOccurrenceService from '@/services/wms-occurrence.service'
import type { WmsOccurrence, CreateWmsOccurrenceDto } from '@/types/wms-occurrence.types'

export const useWmsOccurrenceStore = defineStore('wmsOccurrence', () => {
  const occurrences = ref<WmsOccurrence[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchOpen() {
    loading.value = true
    error.value = null
    try {
      occurrences.value = await wmsOccurrenceService.list('ABERTA')
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar ocorrências'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function create(dto: CreateWmsOccurrenceDto) {
    return wmsOccurrenceService.create(dto)
  }

  async function release(id: string, releaseNote?: string) {
    const updated = await wmsOccurrenceService.release(id, releaseNote)
    occurrences.value = occurrences.value.filter((o) => o.id !== id)
    return updated
  }

  return { occurrences, loading, error, fetchOpen, create, release }
})
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/stores/wms-occurrence.store.ts
git commit -m "feat(mobile): store de ocorrencias"
```

---

### Task 13: `MobileLayout.vue`

**Files:**
- Create: `frontend/src/components/common/MobileLayout.vue`

**Interfaces:**
- Produces: componente `MobileLayout` (props `title?`, slot default, slot `actions`) — consumido por todas as views `/mobile/*` (Tasks 20-24).

- [ ] **Step 1: Escrever o layout**

Create `frontend/src/components/common/MobileLayout.vue`:

```vue
<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
    <header class="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <button
        v-if="showBack"
        type="button"
        class="text-gray-500 dark:text-gray-400 text-2xl leading-none px-2 -ml-2"
        aria-label="Voltar"
        @click="$router.back()"
      >
        ‹
      </button>
      <h1 class="text-base font-semibold text-gray-900 dark:text-white truncate flex-1 text-center">
        {{ title || 'Coletor de Dados' }}
      </h1>
      <div class="w-8">
        <slot name="actions" />
      </div>
    </header>

    <main class="flex-1 p-4 overflow-y-auto">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  showBack?: boolean
}
withDefaults(defineProps<Props>(), { showBack: true })
</script>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/common/MobileLayout.vue
git commit -m "feat(mobile): MobileLayout.vue (chrome minimo para as rotas /mobile)"
```

---

### Task 14: `ScanInput.vue`

**Files:**
- Create: `frontend/src/components/mobile/ScanInput.vue`
- Test: `frontend/src/components/mobile/__tests__/ScanInput.spec.ts`

**Interfaces:**
- Produces: componente `ScanInput` — evento `@scan(code: string)`, prop `autofocus?: boolean` — consumido pelas views mobile (Tasks 22, 23, 24).

- [ ] **Step 1: Escrever o teste (RED)**

Create `frontend/src/components/mobile/__tests__/ScanInput.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ScanInput from '../ScanInput.vue'

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: vi.fn().mockImplementation(() => ({
    decodeFromVideoDevice: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
  })),
}))

describe('ScanInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('modo coletor físico: Enter no input emite @scan com o código digitado e limpa o campo', async () => {
    const wrapper = mount(ScanInput)
    const input = wrapper.find('input[type="text"]')

    await input.setValue('POS-A-01-01')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('scan')).toBeTruthy()
    expect(wrapper.emitted('scan')![0]).toEqual(['POS-A-01-01'])
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('não emite @scan para Enter em campo vazio', async () => {
    const wrapper = mount(ScanInput)
    await wrapper.find('input[type="text"]').trigger('keydown.enter')
    expect(wrapper.emitted('scan')).toBeFalsy()
  })

  it('botão "Usar câmera" alterna para o modo câmera e mostra o elemento de vídeo', async () => {
    const wrapper = mount(ScanInput)
    await wrapper.find('[data-testid="scan-camera-toggle"]').trigger('click')
    expect(wrapper.find('video').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Verificar que o teste falha (RED)**

Run (dentro de `frontend/`): `npm run test -- ScanInput.spec.ts`
Expected: FAIL — `Cannot find module '../ScanInput.vue'`.

- [ ] **Step 3: Escrever o componente**

Create `frontend/src/components/mobile/ScanInput.vue`:

```vue
<template>
  <div class="space-y-2">
    <div class="flex gap-2">
      <input
        ref="inputRef"
        type="text"
        v-model="rawValue"
        placeholder="Leia o código ou digite"
        class="flex-1 border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3 text-lg dark:bg-gray-800 dark:text-white"
        autocomplete="off"
        @keydown.enter.prevent="submit"
      />
      <button
        type="button"
        data-testid="scan-camera-toggle"
        class="px-4 rounded-lg border-2 border-primary-400 text-primary-600 dark:text-primary-400"
        @click="toggleCamera"
      >
        📷
      </button>
    </div>

    <p v-if="cameraError" class="text-sm text-amber-600 dark:text-amber-400">
      {{ cameraError }} Use o campo de texto acima (coletor físico ou digitação manual).
    </p>

    <div v-if="cameraActive" class="rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600">
      <video ref="videoRef" class="w-full" autoplay muted playsinline />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { BrowserMultiFormatReader } from '@zxing/browser'

interface Props {
  autofocus?: boolean
}
const props = withDefaults(defineProps<Props>(), { autofocus: true })

const emit = defineEmits<{ scan: [code: string] }>()

const rawValue = ref('')
const inputRef = ref<HTMLInputElement>()
const videoRef = ref<HTMLVideoElement>()
const cameraActive = ref(false)
const cameraError = ref('')
let reader: BrowserMultiFormatReader | null = null

function submit() {
  const code = rawValue.value.trim()
  if (!code) return
  emit('scan', code)
  rawValue.value = ''
}

async function toggleCamera() {
  if (cameraActive.value) {
    stopCamera()
    return
  }
  cameraActive.value = true
  cameraError.value = ''
  await nextTick()

  try {
    reader = new BrowserMultiFormatReader()
    await reader.decodeFromVideoDevice(undefined, videoRef.value!, (result) => {
      if (result) {
        emit('scan', result.getText())
      }
    })
  } catch (err) {
    cameraError.value = 'Câmera indisponível ou sem permissão.'
    cameraActive.value = false
  }
}

function stopCamera() {
  reader?.reset()
  reader = null
  cameraActive.value = false
}

onMounted(() => {
  if (props.autofocus) {
    inputRef.value?.focus()
  }
})

onBeforeUnmount(() => {
  stopCamera()
})

defineExpose({ focus: () => inputRef.value?.focus() })
</script>
```

- [ ] **Step 4: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test -- ScanInput.spec.ts`
Expected: PASS, 3/3 testes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mobile/ScanInput.vue frontend/src/components/mobile/__tests__/ScanInput.spec.ts
git commit -m "feat(mobile): ScanInput.vue (coletor fisico + camera via zxing)"
```

---

### Task 15: `PhotoCapture.vue`

**Files:**
- Create: `frontend/src/components/mobile/PhotoCapture.vue`
- Test: `frontend/src/components/mobile/__tests__/PhotoCapture.spec.ts`

**Interfaces:**
- Produces: componente `PhotoCapture` — `v-model` de `File[]`, evento `@update:modelValue` — consumido pela Task 22 (fluxo "Reportar Ocorrência").

- [ ] **Step 1: Escrever o teste (RED)**

Create `frontend/src/components/mobile/__tests__/PhotoCapture.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PhotoCapture from '../PhotoCapture.vue'

function makeFile(name: string) {
  return new File(['x'], name, { type: 'image/png' })
}

describe('PhotoCapture', () => {
  it('adiciona arquivos selecionados ao v-model e mostra a miniatura', async () => {
    const wrapper = mount(PhotoCapture, { props: { modelValue: [] } })
    const input = wrapper.find('input[type="file"]')
    const file = makeFile('avaria.png')

    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    expect(wrapper.emitted('update:modelValue')![0][0]).toEqual([file])
  })

  it('remove uma foto ao clicar no botão de remover', async () => {
    const file = makeFile('avaria.png')
    const wrapper = mount(PhotoCapture, { props: { modelValue: [file] } })

    await wrapper.find('[data-testid="photo-remove-0"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')![0][0]).toEqual([])
  })
})
```

- [ ] **Step 2: Verificar que o teste falha (RED)**

Run: `npm run test -- PhotoCapture.spec.ts`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Escrever o componente**

Create `frontend/src/components/mobile/PhotoCapture.vue`:

```vue
<template>
  <div class="space-y-2">
    <label
      class="flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg py-4 text-gray-500 dark:text-gray-400 cursor-pointer"
    >
      📷 Tirar foto / anexar
      <input
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        class="hidden"
        @change="onChange"
      />
    </label>

    <div v-if="modelValue.length" class="grid grid-cols-3 gap-2">
      <div v-for="(file, index) in modelValue" :key="index" class="relative">
        <img :src="previewUrl(file)" class="w-full h-20 object-cover rounded-lg border dark:border-gray-700" />
        <button
          type="button"
          :data-testid="`photo-remove-${index}`"
          class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-sm leading-none"
          @click="remove(index)"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue: File[]
}
const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [files: File[]] }>()

function onChange(event: Event) {
  const input = event.target as HTMLInputElement
  const newFiles = Array.from(input.files ?? [])
  emit('update:modelValue', [...props.modelValue, ...newFiles])
  input.value = ''
}

function remove(index: number) {
  const next = props.modelValue.filter((_, i) => i !== index)
  emit('update:modelValue', next)
}

function previewUrl(file: File): string {
  return URL.createObjectURL(file)
}
</script>
```

- [ ] **Step 4: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test -- PhotoCapture.spec.ts`
Expected: PASS, 2/2 testes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/mobile/PhotoCapture.vue frontend/src/components/mobile/__tests__/PhotoCapture.spec.ts
git commit -m "feat(mobile): PhotoCapture.vue (camera/anexo, usado no fluxo de ocorrencia)"
```

---

### Task 16: `useOfflineQueue.ts`

**Files:**
- Create: `frontend/src/composables/useOfflineQueue.ts`
- Test: `frontend/src/composables/__tests__/useOfflineQueue.spec.ts`

**Interfaces:**
- Produces: `useOfflineQueue()` → `{ enqueue(action), pendingCount, isOnline }`, onde `enqueue` recebe `{ id: string, run: () => Promise<unknown> }` e devolve `Promise<{ synced: boolean }>` — `synced:false` quando a chamada falhou por rede e foi enfileirada; consumido pelas views mobile (Tasks 21-24) para envolver toda chamada de mutação.

- [ ] **Step 1: Escrever o teste (RED)**

Create `frontend/src/composables/__tests__/useOfflineQueue.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useOfflineQueue } from '../useOfflineQueue'

/**
 * jsdom (ambiente de teste do Vitest neste projeto, ver `vite.config.ts`) não
 * implementa IndexedDB nativamente — não há precedente de teste real de
 * IndexedDB no projeto. Mock em memória do `idb`, do mesmo jeito que
 * `ScanInput.spec.ts` mocka `@zxing/browser`: evita depender de um polyfill
 * novo (`fake-indexeddb`) só para este composable.
 */
const memoryStore = new Map<string, { id: string; createdAt: number }>()
vi.mock('idb', () => ({
  openDB: vi.fn().mockResolvedValue({
    count: async () => memoryStore.size,
    getAll: async () => Array.from(memoryStore.values()),
    put: async (_store: string, value: { id: string; createdAt: number }) => {
      memoryStore.set(value.id, value)
    },
    delete: async (_store: string, id: string) => {
      memoryStore.delete(id)
    },
  }),
}))

describe('useOfflineQueue', () => {
  beforeEach(() => {
    memoryStore.clear()
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('executa a ação imediatamente quando ela resolve (rede ok)', async () => {
    const { enqueue } = useOfflineQueue()
    const run = vi.fn().mockResolvedValue({ ok: true })

    const result = await enqueue({ id: 'a1', run })

    expect(run).toHaveBeenCalledTimes(1)
    expect(result.synced).toBe(true)
  })

  it('não reenfileira erro de validação real (não é problema de rede)', async () => {
    const { enqueue } = useOfflineQueue()
    const businessError = { response: { status: 400, data: { message: 'Código não confere' } } }
    const run = vi.fn().mockRejectedValue(businessError)

    await expect(enqueue({ id: 'a2', run })).rejects.toEqual(businessError)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('enfileira quando a chamada falha por erro de rede (sem response)', async () => {
    const { enqueue, pendingCount } = useOfflineQueue()
    const networkError = { request: {}, message: 'Network Error' }
    const run = vi.fn().mockRejectedValue(networkError)

    const result = await enqueue({ id: 'a3', run })

    expect(result.synced).toBe(false)
    expect(pendingCount.value).toBe(1)
  })
})
```

- [ ] **Step 2: Verificar que o teste falha (RED)**

Run: `npm run test -- useOfflineQueue.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Escrever o composable**

Create `frontend/src/composables/useOfflineQueue.ts`:

```ts
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { openDB, type IDBPDatabase } from 'idb'
import { useToast } from './useToast'

const DB_NAME = 'fabric-mobile-offline-queue'
const STORE_NAME = 'pending-actions'

interface QueuedAction {
  id: string
  createdAt: number
}

/** Registro de `run` por `id`, em memória — IndexedDB só guarda METADADOS (id/timestamp) porque uma função não é serializável; o `run` precisa ser reoferecido na mesma sessão para drenar. Reinício de app perde a fila em voo (aceitável: quedas são curtas, não sobrevivem a fechar o app — ver decisão "sem cache de dados" do spec). */
const pendingRuns = new Map<string, () => Promise<unknown>>()

let dbPromise: Promise<IDBPDatabase> | null = null
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

/** É erro de REDE (sem `response`, com `request`) e não erro de negócio (`response` presente = servidor respondeu, mesmo que com 4xx/5xx). */
function isNetworkError(err: any): boolean {
  return Boolean(err) && !err.response && Boolean(err.request)
}

const pendingCount = ref(0)
const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

async function refreshPendingCount() {
  const db = await getDb()
  pendingCount.value = await db.count(STORE_NAME)
}

async function drainQueue() {
  const db = await getDb()
  const actions = (await db.getAll(STORE_NAME)) as QueuedAction[]

  for (const action of actions.sort((a, b) => a.createdAt - b.createdAt)) {
    const run = pendingRuns.get(action.id)
    if (!run) {
      // Ação de uma sessão anterior sem `run` disponível — não há como
      // reexecutar; marcado "falhou" removendo da fila, mesmo comportamento
      // descrito no spec para o que não pode retentar indefinidamente.
      await db.delete(STORE_NAME, action.id)
      continue
    }
    try {
      await run()
      await db.delete(STORE_NAME, action.id)
      pendingRuns.delete(action.id)
    } catch (err: any) {
      if (!isNetworkError(err)) {
        // Falhou por validação real ao sincronizar — não retenta indefinidamente;
        // notifica o operador para revisar manualmente (spec, seção Tratamento de erro).
        await db.delete(STORE_NAME, action.id)
        pendingRuns.delete(action.id)
        useToast().error(
          err.response?.data?.message || 'Uma ação pendente falhou ao sincronizar e precisa ser refeita manualmente.'
        )
      }
      // erro de rede: mantém na fila, tenta de novo no próximo drain
      break
    }
  }
  await refreshPendingCount()
}

export function useOfflineQueue() {
  async function enqueue(action: { id: string; run: () => Promise<unknown> }): Promise<{ synced: boolean }> {
    try {
      await action.run()
      return { synced: true }
    } catch (err) {
      if (!isNetworkError(err)) {
        throw err
      }
      const db = await getDb()
      await db.put(STORE_NAME, { id: action.id, createdAt: Date.now() })
      pendingRuns.set(action.id, action.run)
      await refreshPendingCount()
      return { synced: false }
    }
  }

  function handleOnline() {
    isOnline.value = true
    void drainQueue()
  }
  function handleOffline() {
    isOnline.value = false
  }

  onMounted(() => {
    void refreshPendingCount()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  })

  return { enqueue, pendingCount, isOnline }
}
```

- [ ] **Step 4: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test -- useOfflineQueue.spec.ts`
Expected: PASS, 3/3 testes.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useOfflineQueue.ts frontend/src/composables/__tests__/useOfflineQueue.spec.ts
git commit -m "feat(mobile): useOfflineQueue.ts (fila de mutacoes pendentes em IndexedDB)"
```

---

## PHASE D — Frontend: telas mobile

### Task 17: Rotas `/mobile/*` + `MobileHomeView.vue`

**Files:**
- Create: `frontend/src/views/mobile/MobileHomeView.vue`
- Modify: `frontend/src/router/index.ts`

**Interfaces:**
- Consumes: `MobileLayout` (Task 13).
- Produces: rota `/mobile` — consumida como ponto de entrada do PWA (`start_url` da Task 10).

- [ ] **Step 1: Escrever a Home**

Create `frontend/src/views/mobile/MobileHomeView.vue`:

```vue
<template>
  <MobileLayout title="Coletor de Dados" :show-back="false">
    <div class="grid grid-cols-1 gap-4">
      <RouterLink
        to="/mobile/tasks"
        class="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center active:bg-primary-50 dark:active:bg-gray-700"
      >
        <div class="text-4xl mb-2">📋</div>
        <p class="font-semibold text-gray-900 dark:text-white">Minhas Tarefas</p>
      </RouterLink>

      <RouterLink
        to="/mobile/transfer"
        class="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center active:bg-primary-50 dark:active:bg-gray-700"
      >
        <div class="text-4xl mb-2">↔️</div>
        <p class="font-semibold text-gray-900 dark:text-white">Mover Agora</p>
      </RouterLink>

      <RouterLink
        to="/mobile/counting"
        class="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 text-center active:bg-primary-50 dark:active:bg-gray-700"
      >
        <div class="text-4xl mb-2">🔢</div>
        <p class="font-semibold text-gray-900 dark:text-white">Contagem</p>
      </RouterLink>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import MobileLayout from '@/components/common/MobileLayout.vue'
</script>
```

- [ ] **Step 2: Registrar as 5 rotas mobile no router**

Em `frontend/src/router/index.ts`, adicione (mesmo bloco de comentário/padrão da Expedição, junto às demais rotas):

```ts
    // Coletor de Dados/Mobile — PWA dentro do projeto Vue atual (ver spec
    // 2026-09-14). Mesma guarda `requiresAuth`; sem gate de módulo no menu
    // porque é uma superfície nova de acesso (não um card na dashboard
    // desktop) — RBAC real de cada ação continua no backend.
    {
      path: '/mobile',
      name: 'mobile-home',
      component: () => import('../views/mobile/MobileHomeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/mobile/tasks',
      name: 'mobile-tasks',
      component: () => import('../views/mobile/MobileTaskListView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/mobile/tasks/:id',
      name: 'mobile-task-detail',
      component: () => import('../views/mobile/MobileTaskDetailView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/mobile/transfer',
      name: 'mobile-transfer',
      component: () => import('../views/mobile/MobileTransferView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/mobile/counting',
      name: 'mobile-counting',
      component: () => import('../views/mobile/MobileCountingView.vue'),
      meta: { requiresAuth: true },
    },
```

- [ ] **Step 3: Verificar manualmente**

Run (dentro de `frontend/`): `npm run dev` e acesse `http://localhost:5173/mobile` no navegador (emulação mobile do DevTools).
Expected: Home renderiza com os 3 botões; sem usuário logado, redireciona para `/login` (guard `requiresAuth` já existente).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/views/mobile/MobileHomeView.vue frontend/src/router/index.ts
git commit -m "feat(mobile): rotas /mobile/* e tela inicial"
```

---

### Task 18: `MobileTaskListView.vue`

**Files:**
- Create: `frontend/src/views/mobile/MobileTaskListView.vue`
- Test: `frontend/src/views/mobile/__tests__/MobileTaskListView.spec.ts`

**Interfaces:**
- Consumes: `GET /warehouse-tasks/my` via `warehouseTaskService` (frontend service já existente — reaproveitar, não recriar; verificar o método exato em `frontend/src/services/warehouse-task.service.ts`, análogo a `getMyTasks()`).
- Produces: fila única de tarefas (qualquer tipo), navegação para `/mobile/tasks/:id`.

- [ ] **Step 1: Confirmar o método do service existente**

Run (dentro de `frontend/`): abra `frontend/src/services/warehouse-task.service.ts` e confirme o nome exato do método que chama `GET /warehouse-tasks/my` (o backend já expõe o endpoint desde a Fase 4b — este passo é só de leitura, sem escrita). Use esse nome exato nos passos seguintes; se o método não existir ainda no service frontend, adicione-o seguindo o padrão dos demais métodos do arquivo (`async getMyTasks(): Promise<WarehouseTask[]> { const response = await api.get('/warehouse-tasks/my'); return response.data.data }`) antes de prosseguir.

- [ ] **Step 2: Escrever o teste (RED)**

Create `frontend/src/views/mobile/__tests__/MobileTaskListView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import MobileTaskListView from '../MobileTaskListView.vue'
import warehouseTaskService from '@/services/warehouse-task.service'

vi.mock('@/services/warehouse-task.service', () => ({
  default: { getMyTasks: vi.fn() },
}))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/mobile/tasks', component: MobileTaskListView },
      { path: '/mobile/tasks/:id', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('MobileTaskListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('lista tarefas de qualquer tipo, sem filtro, e navega para o detalhe ao tocar', async () => {
    vi.mocked(warehouseTaskService.getMyTasks).mockResolvedValue([
      { id: 't1', type: 'PICKING', status: 'PENDING', product: { code: 'P1', name: 'Produto 1' } },
      { id: 't2', type: 'CONFERENCIA', status: 'PENDING', product: { code: 'P2', name: 'Produto 2' } },
    ] as any)

    const router = makeRouter()
    router.push('/mobile/tasks')
    await router.isReady()
    const wrapper = mount(MobileTaskListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('PICKING')
    expect(wrapper.text()).toContain('CONFERENCIA')

    await wrapper.find('[data-testid="task-card-t1"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/mobile/tasks/t1')
  })

  it('mostra estado vazio quando não há tarefas', async () => {
    vi.mocked(warehouseTaskService.getMyTasks).mockResolvedValue([])
    const router = makeRouter()
    router.push('/mobile/tasks')
    await router.isReady()
    const wrapper = mount(MobileTaskListView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toMatch(/nenhuma tarefa/i)
  })
})
```

- [ ] **Step 3: Verificar que o teste falha (RED)**

Run: `npm run test -- MobileTaskListView.spec.ts`
Expected: FAIL — componente não existe.

- [ ] **Step 4: Escrever a view**

Create `frontend/src/views/mobile/MobileTaskListView.vue`:

```vue
<template>
  <MobileLayout title="Minhas Tarefas">
    <div v-if="loading" class="text-center text-gray-500 dark:text-gray-400 py-8">Carregando...</div>

    <div v-else-if="tasks.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-8">
      Nenhuma tarefa pendente. 🎉
    </div>

    <div v-else class="space-y-3">
      <button
        v-for="task in tasks"
        :key="task.id"
        type="button"
        :data-testid="`task-card-${task.id}`"
        class="w-full text-left bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 active:bg-primary-50 dark:active:bg-gray-700"
        @click="$router.push(`/mobile/tasks/${task.id}`)"
      >
        <div class="flex justify-between items-center">
          <span class="text-xs font-semibold uppercase text-primary-600 dark:text-primary-400">{{ task.type }}</span>
          <span class="text-xs text-gray-400">{{ task.status }}</span>
        </div>
        <p class="font-medium text-gray-900 dark:text-white mt-1">
          {{ task.product?.name || 'Sem produto' }}
        </p>
      </button>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MobileLayout from '@/components/common/MobileLayout.vue'
import warehouseTaskService from '@/services/warehouse-task.service'

const tasks = ref<any[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    tasks.value = await warehouseTaskService.getMyTasks()
  } finally {
    loading.value = false
  }
})
</script>
```

- [ ] **Step 5: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test -- MobileTaskListView.spec.ts`
Expected: PASS, 2/2 testes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/mobile/MobileTaskListView.vue frontend/src/views/mobile/__tests__/MobileTaskListView.spec.ts frontend/src/services/warehouse-task.service.ts
git commit -m "feat(mobile): fila unica de tarefas (MobileTaskListView)"
```

---

### Task 19: `MobileTaskDetailView.vue`

**Files:**
- Create: `frontend/src/views/mobile/MobileTaskDetailView.vue`
- Test: `frontend/src/views/mobile/__tests__/MobileTaskDetailView.spec.ts`

**Interfaces:**
- Consumes: `warehouseTaskService` (`getById`/`scan`/`start`/`execute`/`complete` — confirmar nomes exatos ao ler o arquivo, mesmo espírito do Step 1 da Task 18), `wmsOccurrenceService.create` (Task 11), `useOfflineQueue` (Task 16), `ScanInput`/`PhotoCapture` (Tasks 14-15).
- Produces: tela de detalhe+leitura da tarefa, com fluxo de "Reportar Ocorrência" e estado "Aguardando liberação" quando a ação vem de volta com 400 mencionando ocorrência.

- [ ] **Step 1: Confirmar os métodos do service existente**

Leia `frontend/src/services/warehouse-task.service.ts` e confirme (ou adicione, seguindo o padrão do arquivo) os métodos: `getById(id)`, `scan(id, code)` (`POST /warehouse-tasks/:id/scan`), `start(id)` (`POST /warehouse-tasks/:id/start`), `execute(id)` (`POST /warehouse-tasks/:id/execute`), `complete(id)` (`POST /warehouse-tasks/:id/complete`).

- [ ] **Step 2: Escrever o teste (RED)**

Create `frontend/src/views/mobile/__tests__/MobileTaskDetailView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import MobileTaskDetailView from '../MobileTaskDetailView.vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import wmsOccurrenceService from '@/services/wms-occurrence.service'

vi.mock('@/services/warehouse-task.service', () => ({
  default: { getById: vi.fn(), scan: vi.fn(), start: vi.fn(), execute: vi.fn(), complete: vi.fn() },
}))
vi.mock('@/services/wms-occurrence.service', () => ({ default: { create: vi.fn() } }))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/mobile/tasks/:id', component: MobileTaskDetailView },
      { path: '/mobile/tasks', component: { template: '<div />' } },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

const TASK = {
  id: 't1',
  type: 'CONFERENCIA',
  status: 'PENDING',
  product: { id: 'p1', code: 'PROD-1', name: 'Produto 1' },
  fromPosition: { id: 'pos1', code: 'A-01-01' },
}

async function mountView() {
  const router = makeRouter()
  router.push('/mobile/tasks/t1')
  await router.isReady()
  const wrapper = mount(MobileTaskDetailView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('MobileTaskDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(warehouseTaskService.getById).mockResolvedValue(TASK as any)
  })

  it('exibe "Aguardando liberação" quando a ação backend recusa por ocorrência bloqueante', async () => {
    vi.mocked(warehouseTaskService.start).mockRejectedValue({
      response: { status: 400, data: { message: 'Ação bloqueada: existe uma ocorrência de AVARIA aberta aguardando liberação.' } },
    })

    const wrapper = await mountView()
    await wrapper.find('[data-testid="task-start"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toMatch(/aguardando liberação/i)
  })

  it('fluxo "Reportar Ocorrência" chama wmsOccurrenceService.create com referenceType WAREHOUSE_TASK', async () => {
    vi.mocked(wmsOccurrenceService.create).mockResolvedValue({} as any)

    const wrapper = await mountView()
    await wrapper.find('[data-testid="report-occurrence-open"]').trigger('click')
    await wrapper.find('[data-testid="occurrence-description"]').setValue('Caixa amassada')
    await wrapper.find('[data-testid="occurrence-submit"]').trigger('click')
    await flushPromises()

    expect(wmsOccurrenceService.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'AVARIA', referenceType: 'WAREHOUSE_TASK', reference: 't1', description: 'Caixa amassada' })
    )
  })
})
```

- [ ] **Step 3: Verificar que o teste falha (RED)**

Run: `npm run test -- MobileTaskDetailView.spec.ts`
Expected: FAIL — componente não existe.

- [ ] **Step 4: Escrever a view**

Create `frontend/src/views/mobile/MobileTaskDetailView.vue`:

```vue
<template>
  <MobileLayout :title="task ? task.type : 'Tarefa'">
    <div v-if="loading" class="text-center text-gray-500 dark:text-gray-400 py-8">Carregando...</div>

    <template v-else-if="task">
      <div v-if="blockedMessage" class="bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-4 mb-4">
        <p class="font-semibold text-amber-800 dark:text-amber-300">⏳ Aguardando liberação</p>
        <p class="text-sm text-amber-700 dark:text-amber-400 mt-1">{{ blockedMessage }}</p>
      </div>

      <template v-else>
        <div class="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Produto</p>
          <p class="font-semibold text-gray-900 dark:text-white">{{ task.product?.code }} — {{ task.product?.name }}</p>
          <p v-if="task.fromPosition" class="text-sm text-gray-500 dark:text-gray-400 mt-2">Endereço esperado</p>
          <p v-if="task.fromPosition" class="font-semibold text-gray-900 dark:text-white">{{ task.fromPosition.code }}</p>
        </div>

        <ScanInput @scan="onScan" />

        <div
          v-if="scanFeedback"
          class="mt-3 rounded-xl px-4 py-3 text-center font-semibold text-lg"
          :class="scanOk ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'"
        >
          {{ scanFeedback }}
        </div>

        <button
          v-if="task.status === 'PENDING'"
          type="button"
          data-testid="task-start"
          class="w-full mt-4 bg-primary-600 text-white rounded-xl py-3 font-semibold"
          @click="runAction(() => warehouseTaskService.start(task!.id), 'Tarefa iniciada')"
        >
          Iniciar
        </button>
        <button
          v-else
          type="button"
          data-testid="task-finish"
          class="w-full mt-4 bg-green-600 text-white rounded-xl py-3 font-semibold"
          @click="finishTask"
        >
          Concluir
        </button>
      </template>

      <button
        type="button"
        data-testid="report-occurrence-open"
        class="w-full mt-3 border-2 border-red-300 text-red-600 dark:text-red-400 rounded-xl py-3 font-semibold"
        @click="showOccurrenceForm = true"
      >
        🚨 Reportar Ocorrência
      </button>

      <div v-if="showOccurrenceForm" class="mt-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <select v-model="occurrenceType" class="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-800 dark:text-white">
          <option value="AVARIA">Avaria</option>
          <option value="OUTRO">Outro</option>
        </select>
        <textarea
          data-testid="occurrence-description"
          v-model="occurrenceDescription"
          placeholder="Descreva o que aconteceu"
          rows="3"
          class="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-800 dark:text-white"
        />
        <PhotoCapture v-model="occurrencePhotos" />
        <button
          type="button"
          data-testid="occurrence-submit"
          class="w-full bg-red-600 text-white rounded-xl py-3 font-semibold"
          @click="submitOccurrence"
        >
          Enviar Ocorrência
        </button>
      </div>
    </template>
  </MobileLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MobileLayout from '@/components/common/MobileLayout.vue'
import ScanInput from '@/components/mobile/ScanInput.vue'
import PhotoCapture from '@/components/mobile/PhotoCapture.vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import wmsOccurrenceService from '@/services/wms-occurrence.service'
import { useOfflineQueue } from '@/composables/useOfflineQueue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { enqueue } = useOfflineQueue()

const task = ref<any>(null)
const loading = ref(true)
const blockedMessage = ref('')
const scanFeedback = ref('')
const scanOk = ref(false)

const showOccurrenceForm = ref(false)
const occurrenceType = ref<'AVARIA' | 'OUTRO'>('AVARIA')
const occurrenceDescription = ref('')
const occurrencePhotos = ref<File[]>([])

const taskId = route.params.id as string

async function loadTask() {
  loading.value = true
  try {
    task.value = await warehouseTaskService.getById(taskId)
  } finally {
    loading.value = false
  }
}

onMounted(loadTask)

async function onScan(code: string) {
  try {
    const result = await warehouseTaskService.scan(taskId, code)
    scanOk.value = Boolean(result.ok)
    scanFeedback.value = result.message
  } catch (err: any) {
    scanOk.value = false
    scanFeedback.value = err.response?.data?.message || 'Erro ao validar leitura'
  }
  // Feedback grande (acima) já cobre o "visual"; vibração é o reforço tátil
  // pedido no spec para o caso de erro — `navigator.vibrate` é no-op silencioso
  // em navegadores/dispositivos sem suporte, então não precisa de feature-check.
  if (!scanOk.value) {
    navigator.vibrate?.(200)
  }
}

function isBlockedByOccurrence(err: any): string | null {
  const message = err?.response?.data?.message
  return typeof message === 'string' && message.includes('ocorrência') ? message : null
}

async function runAction(run: () => Promise<unknown>, successMessage: string) {
  try {
    const result = await enqueue({ id: `${taskId}-${Date.now()}`, run })
    toast.success(result.synced ? successMessage : 'Sem conexão — ação será enviada automaticamente.')
    if (result.synced) {
      await loadTask()
    }
  } catch (err: any) {
    const blocked = isBlockedByOccurrence(err)
    if (blocked) {
      blockedMessage.value = blocked
      return
    }
    toast.error(err.response?.data?.message || 'Erro ao executar ação')
  }
}

async function finishTask() {
  const finisher = ['PICKING', 'REPLENISHMENT'].includes(task.value.type)
    ? () => warehouseTaskService.execute(taskId)
    : () => warehouseTaskService.complete(taskId)
  await runAction(finisher, 'Tarefa concluída')
  if (!blockedMessage.value) {
    router.push('/mobile/tasks')
  }
}

async function submitOccurrence() {
  try {
    await wmsOccurrenceService.create({
      type: occurrenceType.value,
      referenceType: 'WAREHOUSE_TASK',
      reference: taskId,
      description: occurrenceDescription.value,
      photos: occurrencePhotos.value,
    })
    toast.success('Ocorrência registrada')
    showOccurrenceForm.value = false
    occurrenceDescription.value = ''
    occurrencePhotos.value = []
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao registrar ocorrência')
  }
}
</script>
```

- [ ] **Step 5: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test -- MobileTaskDetailView.spec.ts`
Expected: PASS, 2/2 testes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/mobile/MobileTaskDetailView.vue frontend/src/views/mobile/__tests__/MobileTaskDetailView.spec.ts
git commit -m "feat(mobile): detalhe da tarefa com leitura, conclusao e reportar ocorrencia"
```

---

### Task 20: `MobileTransferView.vue`

**Files:**
- Create: `frontend/src/views/mobile/MobileTransferView.vue`
- Test: `frontend/src/views/mobile/__tests__/MobileTransferView.spec.ts`

**Interfaces:**
- Consumes: `stockService.transfer` (frontend, já existente — mesmo usado por `StockTransferView.vue`), `ScanInput` (Task 14), `useOfflineQueue` (Task 16).
- Produces: transferência avulsa mobile-first (`POST /stock/transfer`).

- [ ] **Step 1: Escrever o teste (RED)**

Create `frontend/src/views/mobile/__tests__/MobileTransferView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import MobileTransferView from '../MobileTransferView.vue'
import stockService from '@/services/stock.service'
import { storagePositionService } from '@/services/storage-position.service'

vi.mock('@/services/stock.service', () => ({ default: { transfer: vi.fn() } }))
vi.mock('@/services/storage-position.service', () => ({
  storagePositionService: { search: vi.fn().mockResolvedValue([{ id: 'pos-a', code: 'A-01-01' }]) },
}))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/mobile/transfer', component: MobileTransferView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('MobileTransferView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('leitura de código preenche produto/posição de origem via ScanInput', async () => {
    const router = makeRouter()
    router.push('/mobile/transfer')
    await router.isReady()
    const wrapper = mount(MobileTransferView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('[data-testid="scan-from"] input[type="text"]').setValue('A-01-01')
    await wrapper.find('[data-testid="scan-from"] input[type="text"]').trigger('keydown.enter')
    await flushPromises()

    expect((wrapper.find('[data-testid="from-position-code"]').element as HTMLElement).textContent).toContain('A-01-01')
  })
})
```

- [ ] **Step 2: Verificar que o teste falha (RED)**

Run: `npm run test -- MobileTransferView.spec.ts`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Confirmar assinatura de `storagePositionService.search`**

Leia `frontend/src/services/storage-position.service.ts` (já usado por `StockTransferView.vue`, ver Task 20 do relatório de reconhecimento) e confirme o nome exato do método de busca por código — use-o tal como está, sem renomear.

- [ ] **Step 4: Escrever a view**

Create `frontend/src/views/mobile/MobileTransferView.vue`:

```vue
<template>
  <MobileLayout title="Mover Agora">
    <div class="space-y-4">
      <div>
        <label class="text-sm text-gray-500 dark:text-gray-400">Produto (código)</label>
        <input
          v-model="productCode"
          type="text"
          class="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3 text-lg dark:bg-gray-800 dark:text-white mt-1"
          placeholder="Código do produto"
        />
      </div>

      <div>
        <label class="text-sm text-gray-500 dark:text-gray-400">Origem</label>
        <div data-testid="scan-from">
          <ScanInput :autofocus="false" @scan="(code) => onScanPosition(code, 'from')" />
        </div>
        <p data-testid="from-position-code" class="text-sm font-semibold text-gray-900 dark:text-white mt-1">
          {{ fromPosition?.code || 'Aguardando leitura' }}
        </p>
      </div>

      <div>
        <label class="text-sm text-gray-500 dark:text-gray-400">Destino</label>
        <div data-testid="scan-to">
          <ScanInput :autofocus="false" @scan="(code) => onScanPosition(code, 'to')" />
        </div>
        <p data-testid="to-position-code" class="text-sm font-semibold text-gray-900 dark:text-white mt-1">
          {{ toPosition?.code || 'Aguardando leitura' }}
        </p>
      </div>

      <div>
        <label class="text-sm text-gray-500 dark:text-gray-400">Quantidade</label>
        <input
          v-model.number="quantity"
          type="number"
          min="0"
          step="0.01"
          class="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3 text-lg dark:bg-gray-800 dark:text-white mt-1"
        />
      </div>

      <button
        type="button"
        class="w-full bg-primary-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50"
        :disabled="!canSubmit"
        @click="submit"
      >
        Confirmar Transferência
      </button>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import MobileLayout from '@/components/common/MobileLayout.vue'
import ScanInput from '@/components/mobile/ScanInput.vue'
import stockService from '@/services/stock.service'
import { storagePositionService } from '@/services/storage-position.service'
import { useOfflineQueue } from '@/composables/useOfflineQueue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const { enqueue } = useOfflineQueue()

const productCode = ref('')
const quantity = ref<number | null>(null)
const fromPosition = ref<{ id: string; code: string } | null>(null)
const toPosition = ref<{ id: string; code: string } | null>(null)

const canSubmit = computed(
  () => Boolean(productCode.value && fromPosition.value && toPosition.value && quantity.value && quantity.value > 0)
)

async function onScanPosition(code: string, which: 'from' | 'to') {
  const matches = await storagePositionService.search(code)
  const match = matches.find((p: any) => p.code === code) ?? matches[0]
  if (!match) {
    toast.error(`Posição "${code}" não encontrada`)
    return
  }
  if (which === 'from') {
    fromPosition.value = match
  } else {
    toPosition.value = match
  }
}

async function submit() {
  if (!canSubmit.value) return
  try {
    const result = await enqueue({
      id: `transfer-${Date.now()}`,
      run: () =>
        stockService.transfer({
          productId: productCode.value,
          fromPositionId: fromPosition.value!.id,
          toPositionId: toPosition.value!.id,
          quantity: quantity.value!,
        }),
    })
    toast.success(result.synced ? 'Transferência registrada!' : 'Sem conexão — será enviada automaticamente.')
    if (result.synced) {
      productCode.value = ''
      quantity.value = null
      fromPosition.value = null
      toPosition.value = null
    }
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao registrar transferência')
  }
}
</script>
```

- [ ] **Step 5: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test -- MobileTransferView.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/mobile/MobileTransferView.vue frontend/src/views/mobile/__tests__/MobileTransferView.spec.ts
git commit -m "feat(mobile): transferencia avulsa (MobileTransferView)"
```

---

### Task 21: `MobileCountingView.vue`

**Files:**
- Create: `frontend/src/views/mobile/MobileCountingView.vue`
- Test: `frontend/src/views/mobile/__tests__/MobileCountingView.spec.ts`
- Modify: `frontend/src/stores/counting.store.ts`

**Interfaces:**
- Consumes: `countingService.getPendingItems()`/`countItem()` (frontend, já existentes), `ScanInput` (Task 14), `useOfflineQueue` (Task 16).
- Produces: `useCountingStore().fetchPendingItems()` — consumida por esta view; fluxo de contagem com confirmação de produto por leitura ANTES do campo numérico (primeira vez que uma tela de contagem usa leitura real, conforme o spec).

- [ ] **Step 1: Adicionar `fetchPendingItems` à store existente**

Em `frontend/src/stores/counting.store.ts`, adicione a action (perto de `fetchItems`) e exponha no `return`:

```ts
  async function fetchPendingItems() {
    loading.value = true;
    error.value = null;
    try {
      items.value = await countingService.getPendingItems();
    } catch (err: any) {
      error.value = err.message || 'Erro ao carregar itens pendentes';
      throw err;
    } finally {
      loading.value = false;
    }
  }
```

E adicione `fetchPendingItems,` ao objeto retornado pela store (junto de `fetchItems`).

- [ ] **Step 2: Escrever o teste (RED)**

Create `frontend/src/views/mobile/__tests__/MobileCountingView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import MobileCountingView from '../MobileCountingView.vue'
import countingService from '@/services/counting.service'

vi.mock('@/services/counting.service', () => ({
  default: { getPendingItems: vi.fn(), countItem: vi.fn() },
}))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/mobile/counting', component: MobileCountingView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

const ITEM = { id: 'ci1', sessionId: 's1', productId: 'p1', systemQty: 100, hasDifference: false, status: 'PENDING', product: { id: 'p1', code: 'PROD-1', name: 'Produto 1' } }

describe('MobileCountingView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    vi.mocked(countingService.getPendingItems).mockResolvedValue([ITEM] as any)
  })

  it('exige leitura do código do produto antes de liberar o campo de quantidade', async () => {
    const router = makeRouter()
    router.push('/mobile/counting')
    await router.isReady()
    const wrapper = mount(MobileCountingView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.find('input[type="number"]').attributes('disabled')).toBeDefined()

    await wrapper.find('input[type="text"]').setValue('PROD-1')
    await wrapper.find('input[type="text"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.find('input[type="number"]').attributes('disabled')).toBeUndefined()
  })

  it('leitura de código diferente do produto esperado mostra erro e mantém campo bloqueado', async () => {
    const router = makeRouter()
    router.push('/mobile/counting')
    await router.isReady()
    const wrapper = mount(MobileCountingView, { global: { plugins: [router] } })
    await flushPromises()

    await wrapper.find('input[type="text"]').setValue('PROD-ERRADO')
    await wrapper.find('input[type="text"]').trigger('keydown.enter')
    await flushPromises()

    expect(wrapper.text()).toMatch(/não confere/i)
    expect(wrapper.find('input[type="number"]').attributes('disabled')).toBeDefined()
  })
})
```

- [ ] **Step 3: Verificar que o teste falha (RED)**

Run: `npm run test -- MobileCountingView.spec.ts`
Expected: FAIL — componente não existe.

- [ ] **Step 4: Escrever a view**

Create `frontend/src/views/mobile/MobileCountingView.vue`:

```vue
<template>
  <MobileLayout title="Contagem">
    <div v-if="loading" class="text-center text-gray-500 dark:text-gray-400 py-8">Carregando...</div>

    <div v-else-if="!currentItem" class="text-center text-gray-500 dark:text-gray-400 py-8">
      Nenhum item de contagem pendente. 🎉
    </div>

    <template v-else>
      <div class="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">Produto esperado</p>
        <p class="font-semibold text-gray-900 dark:text-white">{{ currentItem.product?.code }} — {{ currentItem.product?.name }}</p>
      </div>

      <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">
        {{ confirmed ? 'Produto confirmado ✅' : 'Leia o código do produto para liberar a contagem' }}
      </p>
      <ScanInput @scan="onScan" />
      <div
        v-if="scanError"
        class="mt-3 rounded-xl px-4 py-3 text-center font-semibold text-lg bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
      >
        {{ scanError }}
      </div>

      <div class="mt-4">
        <label class="text-sm text-gray-500 dark:text-gray-400">Quantidade contada</label>
        <input
          v-model.number="countedQty"
          type="number"
          min="0"
          step="0.01"
          :disabled="!confirmed"
          class="w-full border-2 border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3 text-lg dark:bg-gray-800 dark:text-white mt-1 disabled:opacity-50"
        />
      </div>

      <button
        type="button"
        class="w-full mt-4 bg-primary-600 text-white rounded-xl py-3 font-semibold disabled:opacity-50"
        :disabled="!confirmed || countedQty === null"
        @click="submit"
      >
        Registrar Contagem
      </button>
    </template>
  </MobileLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import MobileLayout from '@/components/common/MobileLayout.vue'
import ScanInput from '@/components/mobile/ScanInput.vue'
import { useCountingStore } from '@/stores/counting.store'
import { useOfflineQueue } from '@/composables/useOfflineQueue'
import { useToast } from '@/composables/useToast'

const countingStore = useCountingStore()
const toast = useToast()
const { enqueue } = useOfflineQueue()

const loading = ref(true)
const confirmed = ref(false)
const scanError = ref('')
const countedQty = ref<number | null>(null)

const currentItem = computed(() => countingStore.items[0] ?? null)

onMounted(async () => {
  try {
    await countingStore.fetchPendingItems()
  } finally {
    loading.value = false
  }
})

function onScan(code: string) {
  if (!currentItem.value) return
  if (code.toUpperCase() === currentItem.value.product?.code?.toUpperCase()) {
    confirmed.value = true
    scanError.value = ''
  } else {
    confirmed.value = false
    scanError.value = `Código lido não confere com o produto esperado (${currentItem.value.product?.code}).`
    navigator.vibrate?.(200)
  }
}

async function submit() {
  if (!currentItem.value || countedQty.value === null) return
  const itemId = currentItem.value.id
  try {
    const result = await enqueue({
      id: `count-${itemId}`,
      run: () => countingStore.countItem(itemId, { countedQty: countedQty.value! }),
    })
    toast.success(result.synced ? 'Contagem registrada!' : 'Sem conexão — será enviada automaticamente.')
    if (result.synced) {
      confirmed.value = false
      countedQty.value = null
      await countingStore.fetchPendingItems()
    }
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao registrar contagem')
  }
}
</script>
```

- [ ] **Step 5: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test -- MobileCountingView.spec.ts`
Expected: PASS, 2/2 testes.

- [ ] **Step 6: Rodar a suíte frontend inteira (regressão)**

Run: `npm run test`
Expected: todos os testes existentes continuam passando.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/mobile/MobileCountingView.vue frontend/src/views/mobile/__tests__/MobileCountingView.spec.ts frontend/src/stores/counting.store.ts
git commit -m "feat(mobile): contagem com confirmacao de produto por leitura (MobileCountingView)"
```

---

## PHASE E — Frontend: tela desktop de liberação

### Task 22: `OccurrencesView.vue` + rota + card na dashboard

**Files:**
- Create: `frontend/src/views/wms/OccurrencesView.vue`
- Test: `frontend/src/views/wms/__tests__/OccurrencesView.spec.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `useWmsOccurrenceStore` (Task 12), `wmsOccurrenceService.photoDownloadPath` (Task 11), `confirmDialog` (`useConfirm`, já existente no projeto).
- Produces: rota `/occurrences`, cards novos na aba WMS da dashboard (`/mobile` e `/occurrences`).

- [ ] **Step 1: Escrever o teste (RED)**

Create `frontend/src/views/wms/__tests__/OccurrencesView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import OccurrencesView from '../OccurrencesView.vue'
import wmsOccurrenceService from '@/services/wms-occurrence.service'

vi.mock('@/services/wms-occurrence.service', () => ({
  default: { list: vi.fn(), release: vi.fn(), create: vi.fn(), photoDownloadPath: vi.fn() },
}))
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }) }))
vi.mock('@/composables/useConfirm', () => ({ confirmDialog: vi.fn().mockResolvedValue(true) }))

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/occurrences', component: OccurrencesView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

const OCCURRENCE = {
  id: 'occ1',
  type: 'AVARIA',
  status: 'ABERTA',
  blocking: true,
  description: 'Palete avariado',
  reportedAt: '2026-09-15T10:00:00Z',
  reporter: { id: 'u1', name: 'Operador Um' },
  photos: [],
}

describe('OccurrencesView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('lista ocorrências abertas e libera ao confirmar', async () => {
    vi.mocked(wmsOccurrenceService.list).mockResolvedValue([OCCURRENCE] as any)
    vi.mocked(wmsOccurrenceService.release).mockResolvedValue({ ...OCCURRENCE, status: 'LIBERADA' } as any)

    const router = makeRouter()
    router.push('/occurrences')
    await router.isReady()
    const wrapper = mount(OccurrencesView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('Palete avariado')
    expect(wrapper.text()).toContain('Operador Um')

    await wrapper.find('[data-testid="release-occ1"]').trigger('click')
    await flushPromises()

    expect(wmsOccurrenceService.release).toHaveBeenCalledWith('occ1', undefined)
  })

  it('mostra estado vazio quando não há ocorrências abertas', async () => {
    vi.mocked(wmsOccurrenceService.list).mockResolvedValue([])
    const router = makeRouter()
    router.push('/occurrences')
    await router.isReady()
    const wrapper = mount(OccurrencesView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toMatch(/nenhuma ocorrência/i)
  })
})
```

- [ ] **Step 2: Verificar que o teste falha (RED)**

Run: `npm run test -- OccurrencesView.spec.ts`
Expected: FAIL — componente não existe.

- [ ] **Step 3: Escrever a view**

Create `frontend/src/views/wms/OccurrencesView.vue`:

```vue
<template>
  <AppLayout title="Ocorrências" subtitle="Avarias e divergências de contagem aguardando liberação">
    <div v-if="store.loading" class="text-center text-gray-500 dark:text-gray-400 py-8">Carregando...</div>

    <div v-else-if="store.occurrences.length === 0" class="text-center text-gray-500 dark:text-gray-400 py-8">
      Nenhuma ocorrência aberta. 🎉
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="occ in store.occurrences"
        :key="occ.id"
        class="bg-white dark:bg-gray-800 border-2 rounded-xl p-4"
        :class="occ.blocking ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'"
      >
        <div class="flex justify-between items-start">
          <div>
            <span class="text-xs font-semibold uppercase" :class="occ.blocking ? 'text-red-600' : 'text-amber-600'">
              {{ occ.type }} {{ occ.blocking ? '(bloqueando)' : '' }}
            </span>
            <p class="font-medium text-gray-900 dark:text-white mt-1">{{ occ.description }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Reportado por {{ occ.reporter?.name }} em {{ new Date(occ.reportedAt).toLocaleString('pt-BR') }}
            </p>
          </div>
          <button
            type="button"
            :data-testid="`release-${occ.id}`"
            class="bg-green-600 text-white rounded-lg px-4 py-2 text-sm font-semibold"
            @click="release(occ.id)"
          >
            Liberar
          </button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import { useWmsOccurrenceStore } from '@/stores/wms-occurrence.store'
import { confirmDialog } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'

const store = useWmsOccurrenceStore()
const toast = useToast()

onMounted(() => store.fetchOpen())

async function release(id: string) {
  const confirmed = await confirmDialog('Liberar esta ocorrência? A tarefa/item voltará a ficar disponível.')
  if (!confirmed) return
  try {
    await store.release(id, undefined)
    toast.success('Ocorrência liberada')
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao liberar ocorrência')
  }
}
</script>
```

- [ ] **Step 4: Rodar o teste e verificar que passa (GREEN)**

Run: `npm run test -- OccurrencesView.spec.ts`
Expected: PASS, 2/2 testes.

- [ ] **Step 5: Registrar a rota**

Em `frontend/src/router/index.ts`, junto às demais rotas WMS:

```ts
    {
      path: '/occurrences',
      name: 'occurrences',
      component: () => import('../views/wms/OccurrencesView.vue'),
      meta: { requiresAuth: true },
    },
```

- [ ] **Step 6: Adicionar 2 cards na aba WMS da dashboard**

Em `frontend/src/views/DashboardView.vue`, dentro do bloco `v-else-if="activeTab === 'wms' && authStore.canViewWMS"` (perto dos demais `RouterLink`, ex. linha ~335):

```vue
            <RouterLink
              to="/mobile"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📱</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Coletor de Dados</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/occurrences"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🚨</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Ocorrências</p>
              </div>
            </RouterLink>
```

- [ ] **Step 7: Rodar a suíte frontend inteira (regressão)**

Run: `npm run test`
Expected: todos os testes existentes e novos passam.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/views/wms/OccurrencesView.vue frontend/src/views/wms/__tests__/OccurrencesView.spec.ts frontend/src/router/index.ts frontend/src/views/DashboardView.vue
git commit -m "feat(wms): tela de liberacao de ocorrencias e entrada na dashboard"
```

---

## PHASE F — Limpeza e verificação final

### Task 23: Remover código morto e rodar as suítes completas

**Files:**
- Delete: `frontend/src/hooks/useBarcodeScanner.ts`

- [ ] **Step 1: Confirmar que não há nenhuma referência**

Run: busque por `useBarcodeScanner` em todo `frontend/src` — Expected: nenhuma ocorrência além do próprio arquivo (já confirmado no reconhecimento inicial: React morto num projeto Vue, nunca importado).

- [ ] **Step 2: Deletar o arquivo**

```bash
git rm frontend/src/hooks/useBarcodeScanner.ts
```

- [ ] **Step 3: Rodar a suíte backend completa**

Run (dentro de `backend/`): `npm run test:integration`
Expected: 100% verde.

- [ ] **Step 4: Rodar a suíte frontend completa**

Run (dentro de `frontend/`): `npm run test`
Expected: 100% verde.

- [ ] **Step 5: Rodar o build de produção do frontend (valida PWA)**

Run (dentro de `frontend/`): `npm run build`
Expected: build conclui sem erro.

- [ ] **Step 6: Verificação manual via DevTools (emulação mobile)**

Suba os containers (`docker compose up -d` ou equivalente do projeto), acesse `http://localhost:5173/mobile` com um usuário OPERATOR real, abra o DevTools em modo de emulação mobile + throttling "Slow 3G", e percorra: Home → Minhas Tarefas → abrir uma tarefa → leitura (modo texto, já que não há coletor físico disponível nesta verificação) → Reportar Ocorrência com foto → Mover Agora → Contagem. Reporte o resultado como verificação via DevTools, não como teste em dispositivo real — teste em coletor/celular físico fica a cargo do usuário antes de considerar o módulo pronto para produção (mesma ressalva já registrada no spec, seção Testes).

- [ ] **Step 7: Atualizar o status do spec**

Em `docs/superpowers/specs/2026-09-14-coletor-dados-mobile-wms-design.md`, linha 4, altere:

```
**Status:** design aprovado, aguardando plano de implementação
```

para:

```
**Status:** implementado — ver `docs/superpowers/plans/2026-09-15-coletor-dados-mobile-wms.md`
```

- [ ] **Step 8: Commit final**

```bash
git add frontend/src/hooks docs/superpowers/specs/2026-09-14-coletor-dados-mobile-wms-design.md
git commit -m "chore(mobile): remove hook morto de scanner (React) e atualiza status do spec"
```

---

## Nota para quem executar este plano

Vários passos (Tasks 18-21) pedem para **ler** um arquivo de service frontend existente antes de escrever código que o consome, em vez de assumir a assinatura — os nomes exatos de método (`getMyTasks`, `getById`, `scan`, `search`, etc.) não foram 100% confirmados no reconhecimento para todos os services (alguns foram inferidos pelo padrão do restante do arquivo). Se um método não existir com esse nome exato, adicione-o seguindo o padrão dos métodos vizinhos no mesmo arquivo — não renomeie nem redesenhe o service existente.
