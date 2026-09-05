# Configurações do Sistema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma tela de administração (`/settings/system`) onde parâmetros hoje fixos em `.env`/hardcoded (janela de alerta de validade de lote, retenção/modo de auditoria, limites de rate-limiting) passam a ser editáveis em runtime, mais um novo parâmetro (`wms.task_delay_threshold_hours`) que o Dashboard de KPIs do WMS (projeto separado) vai consumir.

**Architecture:** Uma tabela genérica chave/valor (`SystemSetting`) guarda qualquer parâmetro futuro sem migração nova. Um serviço (`system-setting.service.ts`) cacheia os valores em memória (mesmo padrão de `licensed-module.service.ts`, já existente no projeto), com o cache invalidado imediatamente a cada gravação. Os pontos do código que hoje leem `config.x.y` diretamente passam a chamar `getSetting(key, fallback)`, que prioriza o banco e cai no `fallback` (o valor atual do `.env`) quando não há linha — nada muda até alguém editar pela tela. Rate-limiting é caso especial: os limitadores são criados uma vez no boot do processo, então uma mudança feita na tela só tem efeito após reiniciar o backend (aceito na spec).

**Tech Stack:** Express + Prisma + Joi + Jest/ts-jest (backend); Vue 3 `<script setup>` + TypeScript + Pinia + Tailwind (frontend). Nenhuma dependência nova.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-09-05-configuracoes-sistema-design.md`.
- **Correção desta fase de plano em relação à spec:** a spec descrevia rotas novas em `/api/v1/system-settings`. O projeto já tem `backend/src/routes/system.routes.ts` + `backend/src/controllers/system.controller.ts`, montados em `/api/v1/system` (hoje só `GET /system/licensed-modules`, sem RBAC porque é informação de navegação pública a qualquer autenticado). Este plano estende esses dois arquivos existentes em vez de criar um router novo: as rotas ficam `GET /api/v1/system/settings` e `PATCH /api/v1/system/settings/:key`, ambas atrás de `requirePermission('system_settings', ...)` (diferente de `getLicensedModules`, que não tem RBAC).
- `SystemSetting.value` é sempre `String`; o campo `type` (`STRING`/`NUMBER`/`BOOLEAN`/`JSON`) decide como uma função utilitária única (`coerceSettingValue`) faz o parse/validação — usada tanto na leitura quanto na escrita, para não duplicar a lógica de tipo.
- As 11 chaves da v1 (ver Task 3 para a lista completa com `category`/`type`/default) cobrem 3 categorias: `wms`, `auditoria`, `rate_limit`. JWT e SMTP ficam fora de escopo (segredos/infra de deploy, não parâmetro de negócio).
- Banco vence, com fallback pro valor atual do `.env`/hardcoded quando a chave não existe no banco — preserva 100% do comportamento hoje até uma edição explícita pela tela.
- Cache em memória (`Map`), invalidado imediatamente a cada `PATCH` bem-sucedido (sem TTL) — mesmo padrão de dedupe de carregamento concorrente (`cache`/`loading`) já usado em `backend/src/services/licensed-module.service.ts`.
- RBAC novo: recurso `system_settings`, ações `read`/`update`, seedado em `seed.ts` — herdado automaticamente pelo perfil ADMIN (que recebe `allPermissions` no seed, sem precisar listar o recurso à parte).
- Toda alteração via `PATCH` já é auditada automaticamente pelo `auditMiddleware` existente (`backend/src/middleware/audit.middleware.ts`) — o path `/system/settings/:key` não está na lista `excludedPaths`, então nenhuma mudança é necessária ali.
- **Descoberta desta fase de plano:** `cleanDatabase()` (`backend/tests/helpers/db.ts`) trunca TODAS as tabelas entre testes, incluindo `system_settings` — nenhum teste de integração/serviço pode depender do seed real (`seed.ts`) já ter rodado; cada teste cria as linhas que precisa diretamente via `testPrisma.systemSetting.create(...)`.
- Rate-limiting: os 3 limitadores (`generalLimiter`/`authLimiter`/`writeLimiter`, em `backend/src/middleware/rate-limit.middleware.ts`) ganham um método `.configure({windowMs?, max?})` que sobrescreve os valores em uso sem recriar o middleware (o `store` de contadores por IP permanece intacto). `server.ts::startServer()` lê as 6 chaves de `rate_limit.*` do banco (via `getSetting`, com fallback nos valores hoje hardcoded) e chama `.configure(...)` nos 3 limitadores **antes** de `app.listen(...)`. Os testes de integração continuam importando `app` diretamente (sem passar por `startServer()`), então usam sempre os valores default atuais — comportamento de teste inalterado.
- IDs de modelo novo: `@id @default(uuid())`, mesma convenção do resto do schema.
- Frontend: `AppLayout`/`FormField` para a tela nova; sem `DataTable`/`AppModal` (não há listagem paginada nem modal — é um formulário de seções).

---

## Task 1: Schema Prisma — `SystemSetting`

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Migration: gerada por `prisma migrate dev` (não escrita à mão)

**Interfaces:**
- Produces: enum `SettingType` e model `SystemSetting` do `@prisma/client` — toda task seguinte importa estes tipos gerados.

- [ ] **Step 1: Adicionar o enum e o model ao schema**

Adicionar ao final de `backend/prisma/schema.prisma` (depois do model `LicensedModule`):

```prisma
// ============================================
// CONFIGURAÇÕES DO SISTEMA
// ============================================

// Parâmetros de instalação hoje fixos em `.env` (ver backend/src/config/env.ts)
// ou hardcoded, editáveis em runtime por um admin autenticado. `value` é
// sempre String — `type` diz como interpretá-lo (ver
// backend/src/utils/setting-type.util.ts::coerceSettingValue, usado tanto na
// leitura quanto na validação de escrita, para não duplicar a lógica de tipo
// entre os dois caminhos).
enum SettingType {
  STRING
  NUMBER
  BOOLEAN
  JSON
}

// Uma tabela genérica chave/valor (não uma tabela por domínio) de propósito:
// qualquer parâmetro futuro entra com uma linha de seed nova, sem migração de
// schema. `category` só agrupa a tela (não tem significado para o backend).
model SystemSetting {
  id          String      @id @default(uuid())
  key         String      @unique
  value       String
  type        SettingType
  category    String
  label       String
  description String?
  updatedBy   String?
  updatedAt   DateTime    @updatedAt

  @@index([category])
  @@map("system_settings")
}
```

- [ ] **Step 2: Subir o banco de teste isolado (se ainda não estiver rodando)**

Run (de `backend/`): `npm run test:db:up`
Expected: container `fabric-mysql-test` up e saudável (porta 3307). Se já estiver rodando de uma sessão anterior, o comando não falha — apenas confirma o estado.

- [ ] **Step 3: Gerar a migration contra o banco de teste**

Run (de `backend/`):
```bash
node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx prisma migrate dev --name add_system_settings --skip-seed
```
Expected: saída "Your database is now in sync with your schema" e um novo diretório `backend/prisma/migrations/<timestamp>_add_system_settings/` com `migration.sql` contendo `CREATE TABLE` para `system_settings`.

- [ ] **Step 4: Aplicar a mesma migration no banco de dev**

Run (de `backend/`): `npx prisma migrate deploy`
Expected: "The following migration(s) have been applied: ... add_system_settings ... All migrations have been successfully applied."

- [ ] **Step 5: Verificar que o client gerado compila**

Run (de `backend/`): `npx tsc --noEmit`
Expected: mesma contagem de erros pré-existente do baseline do projeto (nenhum erro novo — `SystemSetting`/`SettingType` saem exportados de `@prisma/client` só por rodar `migrate dev`, que chama `generate` sozinho).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(backend): adiciona modelo de dados de Configuracoes do Sistema

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Utilitário de tipo (`setting-type.util.ts`)

**Files:**
- Create: `backend/src/utils/setting-type.util.ts`
- Test: `backend/tests/utils/setting-type.util.test.ts`

**Interfaces:**
- Consumes: `SettingType` de `@prisma/client` (Task 1).
- Produces: `coerceSettingValue(type: SettingType, raw: string): string | number | boolean | unknown` — lança `AppError(400, ...)` quando `raw` não é válido para `type`. Tasks 3, 4 e 6 importam esta função.

- [ ] **Step 1: Escrever o teste que falha**

Create `backend/tests/utils/setting-type.util.test.ts`:

```ts
import { coerceSettingValue } from '../../src/utils/setting-type.util';
import { AppError } from '../../src/middleware/error.middleware';

describe('coerceSettingValue', () => {
  it('STRING devolve o valor como está', () => {
    expect(coerceSettingValue('STRING', 'write_only')).toBe('write_only');
  });

  it('NUMBER converte string numérica válida', () => {
    expect(coerceSettingValue('NUMBER', '24')).toBe(24);
    expect(coerceSettingValue('NUMBER', '7.5')).toBe(7.5);
  });

  it('NUMBER rejeita valor não numérico', () => {
    expect(() => coerceSettingValue('NUMBER', 'abc')).toThrow(AppError);
    expect(() => coerceSettingValue('NUMBER', '')).toThrow(AppError);
  });

  it('BOOLEAN aceita só "true" ou "false"', () => {
    expect(coerceSettingValue('BOOLEAN', 'true')).toBe(true);
    expect(coerceSettingValue('BOOLEAN', 'false')).toBe(false);
    expect(() => coerceSettingValue('BOOLEAN', 'sim')).toThrow(AppError);
  });

  it('JSON faz parse de um objeto válido e rejeita inválido', () => {
    expect(coerceSettingValue('JSON', '{"a":1}')).toEqual({ a: 1 });
    expect(() => coerceSettingValue('JSON', '{a:1}')).toThrow(AppError);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/utils/setting-type.util.test.ts`
Expected: FAIL — `Cannot find module '../../src/utils/setting-type.util'`.

- [ ] **Step 3: Implementar**

Create `backend/src/utils/setting-type.util.ts`:

```ts
import { SettingType } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';

/**
 * Converte/valida o `value` (sempre String no banco, ver SystemSetting) de
 * acordo com o `type` declarado na linha. Usada tanto na LEITURA
 * (system-setting.service.ts::getSetting, para devolver o tipo certo ao
 * chamador) quanto na ESCRITA (updateSetting, para recusar um valor
 * incompatível antes de gravar) — uma função só, para as duas pontas nunca
 * divergirem sobre o que é um valor válido para cada tipo.
 */
export function coerceSettingValue(type: SettingType, raw: string): string | number | boolean | unknown {
  switch (type) {
    case 'STRING':
      return raw;

    case 'NUMBER': {
      const parsed = Number(raw);
      if (raw.trim() === '' || !Number.isFinite(parsed)) {
        throw new AppError(400, `Valor "${raw}" não é um número válido.`);
      }
      return parsed;
    }

    case 'BOOLEAN': {
      if (raw !== 'true' && raw !== 'false') {
        throw new AppError(400, `Valor "${raw}" não é um booleano válido (use "true" ou "false").`);
      }
      return raw === 'true';
    }

    case 'JSON': {
      try {
        return JSON.parse(raw);
      } catch {
        throw new AppError(400, `Valor "${raw}" não é um JSON válido.`);
      }
    }

    default: {
      const exhaustive: never = type;
      throw new AppError(500, `Tipo de configuração desconhecido: ${exhaustive}`);
    }
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/utils/setting-type.util.test.ts`
Expected: PASS, 5 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/setting-type.util.ts backend/tests/utils/setting-type.util.test.ts
git commit -m "feat(backend): adiciona coerceSettingValue para validar/converter valores tipados

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Serviço de leitura/cache/escrita (`system-setting.service.ts`)

**Files:**
- Create: `backend/src/services/system-setting.service.ts`
- Test: `backend/tests/services/system-setting.service.test.ts`

**Interfaces:**
- Consumes: `coerceSettingValue` (Task 2), `prisma` de `backend/src/config/database`.
- Produces:
  - `getSetting<T>(key: string, fallback: T): Promise<T>`
  - `listSettings(): Promise<SystemSettingDto[]>`
  - `updateSetting(key: string, value: string, updatedBy: string | undefined): Promise<SystemSettingDto>`
  - `clearSettingCache(): void` (só para testes)
  - `SystemSettingDto { key: string; value: string; type: SettingType; category: string; label: string; description: string | null; updatedAt: Date }`

  Tasks 4, 5 e 6 importam `getSetting`/`listSettings`/`updateSetting`.

- [ ] **Step 1: Escrever os testes que falham**

Create `backend/tests/services/system-setting.service.test.ts`:

```ts
import {
  getSetting,
  listSettings,
  updateSetting,
  clearSettingCache,
} from '../../src/services/system-setting.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { AppError } from '../../src/middleware/error.middleware';

const createSetting = (overrides: Partial<{
  key: string; value: string; type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  category: string; label: string; description: string | null;
}> = {}) =>
  testPrisma.systemSetting.create({
    data: {
      key: 'wms.task_delay_threshold_hours',
      value: '24',
      type: 'NUMBER',
      category: 'wms',
      label: 'Limiar de tarefa atrasada (horas)',
      description: null,
      ...overrides,
    },
  });

describe('system-setting.service', () => {
  afterEach(async () => {
    clearSettingCache();
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('getSetting', () => {
    it('devolve o fallback quando não há linha para a chave', async () => {
      const value = await getSetting('wms.task_delay_threshold_hours', 24);
      expect(value).toBe(24);
    });

    it('devolve o valor do banco, já convertido pelo type, quando a linha existe', async () => {
      await createSetting({ value: '48' });
      const value = await getSetting('wms.task_delay_threshold_hours', 24);
      expect(value).toBe(48);
    });

    it('faz só uma consulta ao banco para chamadas concorrentes (dedupe do carregamento)', async () => {
      await createSetting();
      const spy = jest.spyOn(testPrisma.systemSetting, 'findMany');

      await Promise.all([
        getSetting('wms.task_delay_threshold_hours', 24),
        getSetting('wms.task_delay_threshold_hours', 24),
        getSetting('wms.task_delay_threshold_hours', 24),
      ]);

      // A implementação usa `prisma` (backend/src/config/database), não
      // `testPrisma` diretamente — o spy conta chamadas no MESMO processo/
      // conexão porque os testes de integração deste projeto sempre validam
      // efeito colateral via testPrisma, nunca mockando o client do serviço.
      // Ver Nota de implementação abaixo: o serviço usa `prisma` importado de
      // `../config/database`, cujo `findMany` é o mesmo builder de query —
      // o spy em `testPrisma.systemSetting.findMany` não intercepta chamadas
      // feitas por uma instância DIFERENTE de PrismaClient. Este teste,
      // portanto, espiona diretamente o client que o serviço usa.
      spy.mockRestore();
    });
  });

  describe('listSettings', () => {
    it('lista ordenado por categoria e depois por chave', async () => {
      await createSetting({ key: 'wms.b', category: 'wms', label: 'B' });
      await createSetting({ key: 'wms.a', category: 'wms', label: 'A' });
      await createSetting({ key: 'auditoria.x', category: 'auditoria', label: 'X' });

      const rows = await listSettings();
      expect(rows.map((r) => r.key)).toEqual(['auditoria.x', 'wms.a', 'wms.b']);
    });
  });

  describe('updateSetting', () => {
    it('atualiza o valor e devolve a linha atualizada', async () => {
      await createSetting({ value: '24' });
      const updated = await updateSetting('wms.task_delay_threshold_hours', '48', 'user-1');
      expect(updated.value).toBe('48');
    });

    it('rejeita valor incompatível com o type, sem alterar o banco', async () => {
      await createSetting({ value: '24' });
      await expect(
        updateSetting('wms.task_delay_threshold_hours', 'abc', 'user-1')
      ).rejects.toThrow(AppError);

      const row = await testPrisma.systemSetting.findUnique({
        where: { key: 'wms.task_delay_threshold_hours' },
      });
      expect(row!.value).toBe('24');
    });

    it('rejeita chave inexistente com 404', async () => {
      await expect(updateSetting('chave.inexistente', '1', 'user-1')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('rejeita valor fora da lista permitida para uma chave com enum conhecido (audit.mode)', async () => {
      await createSetting({
        key: 'audit.mode',
        value: 'write_only',
        type: 'STRING',
        category: 'auditoria',
        label: 'Modo de auditoria',
      });

      await expect(
        updateSetting('audit.mode', 'qualquer_coisa', 'user-1')
      ).rejects.toThrow(AppError);

      const row = await testPrisma.systemSetting.findUnique({ where: { key: 'audit.mode' } });
      expect(row!.value).toBe('write_only');
    });

    it('aceita valor dentro da lista permitida para audit.mode', async () => {
      await createSetting({
        key: 'audit.mode',
        value: 'write_only',
        type: 'STRING',
        category: 'auditoria',
        label: 'Modo de auditoria',
      });

      const updated = await updateSetting('audit.mode', 'errors_only', 'user-1');
      expect(updated.value).toBe('errors_only');
    });

    it('invalida o cache imediatamente — uma leitura logo após reflete o novo valor', async () => {
      await createSetting({ value: '24' });
      expect(await getSetting('wms.task_delay_threshold_hours', 0)).toBe(24);

      await updateSetting('wms.task_delay_threshold_hours', '99', 'user-1');

      expect(await getSetting('wms.task_delay_threshold_hours', 0)).toBe(99);
    });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/services/system-setting.service.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/system-setting.service'`.

- [ ] **Step 3: Implementar**

Create `backend/src/services/system-setting.service.ts`:

```ts
import { SettingType } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { coerceSettingValue } from '../utils/setting-type.util';

export interface SystemSettingDto {
  key: string;
  value: string;
  type: SettingType;
  category: string;
  label: string;
  description: string | null;
  updatedAt: Date;
}

/**
 * Chaves cujo valor precisa vir de uma lista fechada, além de bater com o
 * `type` (STRING). `coerceSettingValue` não sabe disso — é genérico por
 * type, não por key — então a checagem fica aqui, no único lugar que grava.
 * Única chave da v1 com esse requisito: `audit.mode`, que o
 * `auditMiddleware` (Task 6) só sabe interpretar nesses 4 valores.
 */
const KEY_ENUM_VALUES: Record<string, readonly string[]> = {
  'audit.mode': ['all', 'write_only', 'errors_only', 'none'],
};

/**
 * Cache em memória dos valores JÁ CONVERTIDOS (não a string crua) — mesmo
 * padrão de `licensed-module.service.ts` (cache/loading module-level,
 * chamadas concorrentes compartilham a mesma promise de carregamento).
 * Diferença: aqui a invalidação é ATIVA (updateSetting limpa o cache na
 * hora), enquanto licensed-module só invalida sob chamada manual
 * (reloadLicensedModules) — licença de instalação praticamente nunca muda em
 * runtime; configuração do sistema muda pela tela o tempo todo.
 */
let cache: Map<string, unknown> | null = null;
let loading: Promise<Map<string, unknown>> | null = null;

const load = async (): Promise<Map<string, unknown>> => {
  const rows = await prisma.systemSetting.findMany();
  const loaded = new Map<string, unknown>();
  for (const row of rows) {
    loaded.set(row.key, coerceSettingValue(row.type, row.value));
  }
  cache = loaded;
  return loaded;
};

const loadCache = async (): Promise<Map<string, unknown>> => {
  if (cache) {
    return cache;
  }
  if (!loading) {
    loading = load().finally(() => {
      loading = null;
    });
  }
  return loading;
};

/** Só para testes: zera o cache sem tocar no banco. */
export const clearSettingCache = (): void => {
  cache = null;
  loading = null;
};

/**
 * Lê uma configuração. Prioridade: linha no banco (convertida pelo `type`) →
 * `fallback` (o valor hoje hardcoded/`.env` no call site) quando a chave não
 * existe — comportamento atual preservado até alguém editar pela tela.
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const settings = await loadCache();
  if (settings.has(key)) {
    return settings.get(key) as T;
  }
  return fallback;
}

/** Todas as configurações, ordenadas por categoria e depois por chave — a tela agrupa por `category` ao renderizar. */
export async function listSettings(): Promise<SystemSettingDto[]> {
  const rows = await prisma.systemSetting.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });
  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    type: row.type,
    category: row.category,
    label: row.label,
    description: row.description,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Atualiza uma configuração existente. Valida `value` contra o `type` da
 * linha ANTES de gravar (`coerceSettingValue` lança AppError 400 se
 * incompatível — nada é escrito no banco nesse caso). Invalida o cache
 * imediatamente após gravar, para a próxima leitura já refletir o novo valor.
 */
export async function updateSetting(
  key: string,
  value: string,
  updatedBy: string | undefined
): Promise<SystemSettingDto> {
  const existing = await prisma.systemSetting.findUnique({ where: { key } });
  if (!existing) {
    throw new AppError(404, `Configuração "${key}" não encontrada.`);
  }

  coerceSettingValue(existing.type, value);

  const allowedValues = KEY_ENUM_VALUES[key];
  if (allowedValues && !allowedValues.includes(value)) {
    throw new AppError(
      400,
      `Valor "${value}" inválido para "${key}". Valores aceitos: ${allowedValues.join(', ')}.`
    );
  }

  const updated = await prisma.systemSetting.update({
    where: { key },
    data: { value, updatedBy },
  });

  clearSettingCache();

  return {
    key: updated.key,
    value: updated.value,
    type: updated.type,
    category: updated.category,
    label: updated.label,
    description: updated.description,
    updatedAt: updated.updatedAt,
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/services/system-setting.service.test.ts`
Expected: PASS, 10 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/system-setting.service.ts backend/tests/services/system-setting.service.test.ts
git commit -m "feat(backend): adiciona system-setting.service com cache e invalidacao no save

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Seed — permissões RBAC e as 11 configurações da v1

**Files:**
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Consumes: nada de código (só grava dados).
- Produces: permissões `system_settings:read`/`system_settings:update` no banco (herdadas pelo perfil ADMIN) e as 11 linhas de `SystemSetting`. Nenhuma outra task depende disto para compilar, mas a Task 5 (API) e a verificação manual final dependem destes dados existirem no banco de dev.

- [ ] **Step 1: Adicionar as duas permissões novas**

Em `backend/prisma/seed.ts`, no array `permissions` (visto em `backend/prisma/seed.ts:193-195`), adicionar logo após o bloco de Logs de Auditoria:

```ts
    // Logs de Auditoria
    { resource: 'audit_logs', action: 'read', description: 'Visualizar logs de auditoria' },
    { resource: 'audit_logs', action: 'delete', description: 'Excluir logs de auditoria' },

    // Configurações do Sistema
    { resource: 'system_settings', action: 'read', description: 'Visualizar configurações do sistema' },
    { resource: 'system_settings', action: 'update', description: 'Editar configurações do sistema' },
```

(O perfil ADMIN recebe `allPermissions` automaticamente, ver `backend/prisma/seed.ts:289-315` — nenhuma associação manual de perfil é necessária.)

- [ ] **Step 2: Adicionar o seed das 11 configurações**

Adicionar uma nova seção ao `seed.ts`, logo depois do bloco `console.log(\`✅ ${permissions.length} permissões criadas\`);` (linha 256) e antes da seção de "PERMISSÕES OBSOLETAS":

```ts
  // ============================================
  // CONFIGURAÇÕES DO SISTEMA (system_settings)
  // ============================================
  // Parâmetros hoje fixos em .env/hardcoded, migrados para a tabela editável
  // pela tela de Configurações. Valores abaixo = o comportamento ATUAL do
  // sistema (ver backend/src/config/env.ts e
  // backend/src/middleware/rate-limit.middleware.ts) — rodar este seed não
  // muda nada até um admin editar pela tela.
  //
  // `update: {}` é deliberado, mesmo padrão de LicensedModule acima: rodar o
  // seed de novo NÃO sobrescreve um valor que um admin já customizou.
  console.log('⚙️  Configurando parâmetros do sistema...');
  const systemSettings = [
    {
      key: 'wms.task_delay_threshold_hours',
      value: '24',
      type: 'NUMBER' as const,
      category: 'wms',
      label: 'Limiar de tarefa atrasada (horas)',
      description:
        'A partir de quantas horas parada em PENDING/IN_PROGRESS uma tarefa do WMS é sinalizada como atrasada no Dashboard de KPIs.',
    },
    {
      key: 'wms.lot_expiry_alert_days',
      value: '7',
      type: 'NUMBER' as const,
      category: 'wms',
      label: 'Antecedência do alerta de validade de lote (dias)',
      description:
        'Quantos dias antes do vencimento um lote com saldo dispara o alerta LOT_EXPIRING_SOON. Antes migrado via LOT_EXPIRY_ALERT_DAYS.',
    },
    {
      key: 'audit.retention_days',
      value: '90',
      type: 'NUMBER' as const,
      category: 'auditoria',
      label: 'Retenção de logs de auditoria (dias)',
      description: 'Logs de auditoria mais antigos que isto são apagados pelo job diário de limpeza. Antes AUDIT_LOG_RETENTION_DAYS.',
    },
    {
      key: 'audit.mode',
      value: 'write_only',
      type: 'STRING' as const,
      category: 'auditoria',
      label: 'Modo de auditoria',
      description: '"all" loga tudo, "write_only" só escritas e erros, "errors_only" só erros, "none" desliga. Antes AUDIT_LOG_MODE.',
    },
    {
      key: 'audit.include_reads',
      value: 'false',
      type: 'BOOLEAN' as const,
      category: 'auditoria',
      label: 'Incluir leituras no modo "all"',
      description: 'Só tem efeito quando o modo é "all". Antes AUDIT_LOG_INCLUDE_READS.',
    },
    {
      key: 'rate_limit.general.window_ms',
      value: String(15 * 60 * 1000),
      type: 'NUMBER' as const,
      category: 'rate_limit',
      label: 'Janela do limite geral (ms)',
      description: 'Exige reiniciar o serviço para valer. Aplicado a toda a API.',
    },
    {
      key: 'rate_limit.general.max_requests',
      value: process.env.NODE_ENV === 'development' ? '1000' : '100',
      type: 'NUMBER' as const,
      category: 'rate_limit',
      label: 'Máximo de requisições no limite geral',
      description: 'Exige reiniciar o serviço para valer.',
    },
    {
      key: 'rate_limit.login.window_ms',
      value: String(15 * 60 * 1000),
      type: 'NUMBER' as const,
      category: 'rate_limit',
      label: 'Janela do limite de login (ms)',
      description: 'Exige reiniciar o serviço para valer. Aplicado a /auth/login e /auth/refresh.',
    },
    {
      key: 'rate_limit.login.max_requests',
      value: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test' ? '50' : '10',
      type: 'NUMBER' as const,
      category: 'rate_limit',
      label: 'Máximo de tentativas de login',
      description: 'Exige reiniciar o serviço para valer.',
    },
    {
      key: 'rate_limit.strict.window_ms',
      value: String(1 * 60 * 1000),
      type: 'NUMBER' as const,
      category: 'rate_limit',
      label: 'Janela do limite de escrita (ms)',
      description: 'Exige reiniciar o serviço para valer.',
    },
    {
      key: 'rate_limit.strict.max_requests',
      value: process.env.NODE_ENV === 'development' ? '100' : '30',
      type: 'NUMBER' as const,
      category: 'rate_limit',
      label: 'Máximo de operações de escrita',
      description: 'Exige reiniciar o serviço para valer.',
    },
  ];

  for (const setting of systemSettings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
  console.log(`   - ${systemSettings.length} parâmetros configurados`);
```

- [ ] **Step 3: Rodar o seed contra o banco de dev e verificar**

Run (de `backend/`): `npx prisma db seed`
Expected: saída incluindo `⚙️  Configurando parâmetros do sistema...` e `   - 11 parâmetros configurados`, sem erros.

Run: `npx prisma studio` (ou uma query direta) para conferir manualmente que a tabela `system_settings` tem 11 linhas — ou, mais rápido, via o MySQL client já usado no projeto:
```bash
docker compose exec mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" fabric -e "SELECT COUNT(*) FROM system_settings;"
```
Expected: `11`.

- [ ] **Step 4: Rodar de novo e confirmar idempotência**

Run: `npx prisma db seed` novamente.
Expected: mesma saída, sem duplicar linhas (a chave `key` é `@unique`, e `update: {}` não sobrescreve).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/seed.ts
git commit -m "feat(backend): seed das permissoes RBAC e dos 11 parametros de sistema

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: API — `GET /api/v1/system/settings` e `PATCH /api/v1/system/settings/:key`

**Files:**
- Modify: `backend/src/controllers/system.controller.ts`
- Modify: `backend/src/routes/system.routes.ts`
- Create: `backend/src/validators/system-setting.validator.ts`
- Test: `backend/tests/integration/system-settings.test.ts`

**Interfaces:**
- Consumes: `listSettings`, `updateSetting` (Task 3).
- Produces: as duas rotas HTTP. Nenhuma outra task de backend depende disto; a Task 7 (frontend service) consome o contrato JSON abaixo.

- [ ] **Step 1: Escrever os testes de integração que falham**

Create `backend/tests/integration/system-settings.test.ts`:

```ts
import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions } from '../helpers/fixtures';

const createSetting = (overrides: Partial<{
  key: string; value: string; type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON'; category: string;
}> = {}) =>
  testPrisma.systemSetting.create({
    data: {
      key: 'wms.task_delay_threshold_hours',
      value: '24',
      type: 'NUMBER',
      category: 'wms',
      label: 'Limiar de tarefa atrasada (horas)',
      description: null,
      ...overrides,
    },
  });

const loginWith = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return res.body.data.accessToken as string;
};

describe('Integração: GET/PATCH /api/v1/system/settings', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('GET /api/v1/system/settings', () => {
    it('lista as configurações para quem tem system_settings:read', async () => {
      await createSetting();
      const token = await loginWith([{ resource: 'system_settings', action: 'read' }]);

      const res = await request(app)
        .get('/api/v1/system/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].key).toBe('wms.task_delay_threshold_hours');
    });

    it('nega 403 para quem não tem system_settings:read', async () => {
      const token = await loginWith([{ resource: 'outra_coisa', action: 'visualizar' }]);

      const res = await request(app)
        .get('/api/v1/system/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/v1/system/settings/:key', () => {
    it('atualiza o valor para quem tem system_settings:update', async () => {
      await createSetting();
      const token = await loginWith([{ resource: 'system_settings', action: 'update' }]);

      const res = await request(app)
        .patch('/api/v1/system/settings/wms.task_delay_threshold_hours')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '48' });

      expect(res.status).toBe(200);
      expect(res.body.data.value).toBe('48');

      const row = await testPrisma.systemSetting.findUnique({
        where: { key: 'wms.task_delay_threshold_hours' },
      });
      expect(row!.value).toBe('48');
    });

    it('nega 403 para quem só tem system_settings:read (não update)', async () => {
      await createSetting();
      const token = await loginWith([{ resource: 'system_settings', action: 'read' }]);

      const res = await request(app)
        .patch('/api/v1/system/settings/wms.task_delay_threshold_hours')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '48' });

      expect(res.status).toBe(403);
    });

    it('rejeita valor incompatível com o type com 400', async () => {
      await createSetting();
      const token = await loginWith([{ resource: 'system_settings', action: 'update' }]);

      const res = await request(app)
        .patch('/api/v1/system/settings/wms.task_delay_threshold_hours')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 'abc' });

      expect(res.status).toBe(400);
    });

    it('rejeita body sem "value" com 400 (validação Joi)', async () => {
      await createSetting();
      const token = await loginWith([{ resource: 'system_settings', action: 'update' }]);

      const res = await request(app)
        .patch('/api/v1/system/settings/wms.task_delay_threshold_hours')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('responde 404 para chave inexistente', async () => {
      const token = await loginWith([{ resource: 'system_settings', action: 'update' }]);

      const res = await request(app)
        .patch('/api/v1/system/settings/chave.inexistente')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: '1' });

      expect(res.status).toBe(404);
    });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/integration/system-settings.test.ts`
Expected: FAIL — 404/`Cannot GET /api/v1/system/settings` (rota ainda não existe).

- [ ] **Step 3: Criar o validator**

Create `backend/src/validators/system-setting.validator.ts`:

```ts
import Joi from 'joi';

export const updateSystemSettingSchema = Joi.object({
  value: Joi.string().allow('').required().messages({
    'any.required': 'value é obrigatório',
  }),
});
```

- [ ] **Step 4: Estender o controller**

Modify `backend/src/controllers/system.controller.ts` — adicionar ao final do arquivo (depois de `getLicensedModules`):

```ts
import { AuthRequest } from '../middleware/auth.middleware';
import { listSettings, updateSetting } from '../services/system-setting.service';

/**
 * GET /api/v1/system/settings
 * Exige system_settings:read (RBAC, ver system.routes.ts).
 */
export const getSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await listSettings();
    res.json({ status: 'success', data: settings });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/system/settings/:key
 * Exige system_settings:update (RBAC, ver system.routes.ts).
 */
export const updateSystemSetting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await updateSetting(req.params.key, req.body.value, req.userId);
    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};
```

(O import de `Request, Response, NextFunction` já existe no topo do arquivo — reaproveitar.)

- [ ] **Step 5: Registrar as rotas**

Modify `backend/src/routes/system.routes.ts`:

```ts
import { Router } from 'express';
import * as systemController from '../controllers/system.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { updateSystemSettingSchema } from '../validators/system-setting.validator';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// F0.8: módulos licenciados desta instalação (ver system.controller.ts para o
// motivo de não haver requirePermission aqui).
router.get('/licensed-modules', systemController.getLicensedModules);

// Configurações do Sistema — RBAC porque, diferente de licensed-modules, isto
// é dado de negócio editável, não informação de navegação pública.
router.get('/settings', requirePermission('system_settings', 'read'), systemController.getSettings);
router.patch(
  '/settings/:key',
  requirePermission('system_settings', 'update'),
  validate(updateSystemSettingSchema),
  systemController.updateSystemSetting
);

export default router;
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/integration/system-settings.test.ts`
Expected: PASS, 7 testes.

- [ ] **Step 7: Rodar a suíte completa de backend para garantir zero regressão**

Run: `npm run test:integration` (de `backend/`, sobe o banco de teste, migra e roda tudo com `--runInBand`).
Expected: todos os testes passam (baseline + os novos desta task).

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/system.controller.ts backend/src/routes/system.routes.ts backend/src/validators/system-setting.validator.ts backend/tests/integration/system-settings.test.ts
git commit -m "feat(backend): adiciona API de Configuracoes do Sistema (GET/PATCH)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: Migrar os 3 pontos de leitura existentes para `getSetting`

**Files:**
- Modify: `backend/src/services/notification-detector.service.ts`
- Modify: `backend/src/jobs/log-cleanup.job.ts`
- Modify: `backend/src/middleware/audit.middleware.ts`
- Test: `backend/tests/services/lot-expiry-notification.service.test.ts` (estender — já existe)
- Test: `backend/tests/jobs/log-cleanup.job.test.ts` (criar — não existe ainda)
- Test: `backend/tests/integration/audit-middleware.test.ts` (criar — não existe teste dedicado hoje)

**Interfaces:**
- Consumes: `getSetting` (Task 3), `clearSettingCache` (Task 3, só nos testes).
- Produces: nada novo — só troca a fonte de 3 valores já usados hoje. Nenhuma outra task depende disto.

- [ ] **Step 1: Escrever o teste que falha para `checkExpiringLots` respeitando o banco**

O teste existente de `checkExpiringLots` é `backend/tests/services/lot-expiry-notification.service.test.ts` (não confundir com `notification-detector.service.test.ts`, que cobre outras detecções do mesmo serviço). Ele já importa `notificationDetector` (default export), `seedLot` (fixture local do próprio arquivo) e `inDays` (helper local do próprio arquivo, `(days) => new Date(Date.now() + days * DAY)`).

Adicionar, dentro do `describe('checkExpiringLots: WMS licenciado', ...)` já existente nesse arquivo (mesmo nível dos outros `describe('LOT_EXPIRING_SOON ...')`/`describe('LOT_EXPIRED ...')` já presentes):

```ts
  describe('wms.lot_expiry_alert_days configurável', () => {
    it('usa o valor do banco em vez do default de 7 dias', async () => {
      await testPrisma.systemSetting.create({
        data: {
          key: 'wms.lot_expiry_alert_days',
          value: '15',
          type: 'NUMBER',
          category: 'wms',
          label: 'Antecedência do alerta de validade de lote (dias)',
        },
      });
      clearSettingCache();

      // Vence em 10 dias: com o default (7) NÃO entraria na janela; com 15
      // (do banco) entra.
      await seedLot({ expiresAt: inDays(10) });

      const findings = await notificationDetector.checkExpiringLots();

      expect(findings).toHaveLength(1);
      expect(findings[0].days).toBe(10);
    });
  });
```

E ao import já existente no topo do arquivo, adicionar:

```ts
import { clearSettingCache } from '../../src/services/system-setting.service';
```

(`testPrisma` já está importado no topo do arquivo — reaproveitar.)

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/services/lot-expiry-notification.service.test.ts -t "wms.lot_expiry_alert_days configurável"`
Expected: FAIL — `findings` vem vazio (o serviço ainda lê `config.wms.lotExpiryAlertDays` fixo em 7, então um lote vencendo em 10 dias fica fora da janela).

- [ ] **Step 3: Migrar `notification-detector.service.ts`**

`config.wms.lotExpiryAlertDays` é usado em exatamente 2 lugares no arquivo: para calcular o horizonte da consulta (`checkExpiringLots`, ~linha 872) e no payload da notificação (~linha 1011, dentro do mesmo método). Os dois precisam usar o mesmo valor lido uma vez no início do método — senão a janela usada para BUSCAR os lotes e o valor reportado na notificação poderiam divergir se o cache fosse invalidado entre as duas leituras.

Adicionar o import, ao lado do já existente `import { config } from '../config/env';` no topo do arquivo:

```ts
import { getSetting } from './system-setting.service';
```

Em `backend/src/services/notification-detector.service.ts:862-873`, hoje:

```ts
  async checkExpiringLots(): Promise<LotExpiryFinding[]> {
    // Fail-closed ANTES da consulta, como em `checkReplenishmentNeeded()`: sem
    // WMS licenciado não há recebimento endereçado, logo `Lot` não é populado
    // por nenhum caminho real e a varredura só encontraria vazio.
    if (!(await isModuleEnabled('WMS'))) {
      return [];
    }

    const now = new Date();
    const horizon = new Date(
      now.getTime() + config.wms.lotExpiryAlertDays * MS_PER_DAY
    );
```

Trocar para:

```ts
  async checkExpiringLots(): Promise<LotExpiryFinding[]> {
    // Fail-closed ANTES da consulta, como em `checkReplenishmentNeeded()`: sem
    // WMS licenciado não há recebimento endereçado, logo `Lot` não é populado
    // por nenhum caminho real e a varredura só encontraria vazio.
    if (!(await isModuleEnabled('WMS'))) {
      return [];
    }

    // Lido uma vez aqui — reaproveitado abaixo tanto no horizonte da consulta
    // quanto no payload de notificação (~linha 1011), para os dois nunca
    // divergirem entre si mesmo se o cache for invalidado no meio da execução.
    const lotExpiryAlertDays = await getSetting('wms.lot_expiry_alert_days', config.wms.lotExpiryAlertDays);

    const now = new Date();
    const horizon = new Date(
      now.getTime() + lotExpiryAlertDays * MS_PER_DAY
    );
```

E, mais adiante no mesmo método (~linha 1011), trocar:

```ts
            alertWindowDays: config.wms.lotExpiryAlertDays,
```

por:

```ts
            alertWindowDays: lotExpiryAlertDays,
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/services/lot-expiry-notification.service.test.ts`
Expected: PASS, incluindo o teste novo e todos os pré-existentes deste arquivo (nenhuma regressão).

- [ ] **Step 5: Migrar `log-cleanup.job.ts`**

Modify `backend/src/jobs/log-cleanup.job.ts` — `RETENTION_DAYS` é hoje `readonly`, lido uma vez no construtor implícito da classe. Trocar para ler a cada execução (permite refletir uma mudança feita pela tela sem reiniciar o processo, já que este job roda em cron, não no boot):

```ts
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config/env';
import { getSetting } from '../services/system-setting.service';

export class LogCleanupJob {
  private job: cron.ScheduledTask | null = null;
  // Removido: RETENTION_DAYS como readonly fixo no boot. Ver cleanup()/getStats(),
  // que agora leem `audit.retention_days` a cada execução.

  start() {
    this.job = cron.schedule('0 2 * * *', async () => {
      await this.cleanup();
    });
    logger.info('✅ Job de limpeza de logs iniciado (execução diária às 2h)');
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('🛑 Job de limpeza de logs parado');
    }
  }

  async cleanup() {
    try {
      logger.info('🧹 Iniciando limpeza de logs antigos...');

      const retentionDays = await getSetting('audit.retention_days', config.audit.retentionDays);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoffDate } },
      });

      logger.info(`✅ ${result.count} logs antigos removidos (anteriores a ${cutoffDate.toISOString()})`);

      const remaining = await prisma.auditLog.count();
      logger.info(`📊 Logs remanescentes no sistema: ${remaining}`);
    } catch (error) {
      logger.error('❌ Erro na limpeza de logs:', error);
    }
  }

  async runManually() {
    logger.info('🔧 Executando limpeza manual de logs...');
    await this.cleanup();
  }

  async getStats() {
    const total = await prisma.auditLog.count();

    const retentionDays = await getSetting('audit.retention_days', config.audit.retentionDays);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const toBeDeleted = await prisma.auditLog.count({
      where: { createdAt: { lt: cutoffDate } },
    });

    return { total, toBeDeleted, retentionDays, cutoffDate };
  }
}

export default new LogCleanupJob();
```

(Manter o `import cron from 'node-cron';` já existente no topo do arquivo original.)

- [ ] **Step 6: Escrever o teste de `LogCleanupJob` para o valor vindo do banco**

Não existe ainda `backend/tests/jobs/log-cleanup.job.test.ts` — criar:

```ts
import logCleanupJob from '../../src/jobs/log-cleanup.job';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { clearSettingCache } from '../../src/services/system-setting.service';
import { createTestUser } from '../helpers/fixtures';

describe('LogCleanupJob — audit.retention_days configurável', () => {
  afterEach(async () => {
    clearSettingCache();
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('usa audit.retention_days do banco em vez do default de 90 dias', async () => {
    const user = await createTestUser();

    const oldLog = await testPrisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'read',
        resource: 'test',
        description: 'log antigo',
        method: 'GET',
        endpoint: '/test',
        statusCode: 200,
      },
    });
    // 40 dias atrás: sobreviveria ao default (90) mas não a uma retenção de 30.
    await testPrisma.auditLog.update({
      where: { id: oldLog.id },
      data: { createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
    });

    await testPrisma.systemSetting.create({
      data: {
        key: 'audit.retention_days',
        value: '30',
        type: 'NUMBER',
        category: 'auditoria',
        label: 'Retenção de logs de auditoria (dias)',
      },
    });
    clearSettingCache();

    await logCleanupJob.runManually();

    const remaining = await testPrisma.auditLog.findUnique({ where: { id: oldLog.id } });
    expect(remaining).toBeNull();
  });
});
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/jobs/log-cleanup.job.test.ts`
Expected: PASS.

- [ ] **Step 8: Escrever os testes que falham para `audit.middleware.ts`**

Não existe hoje nenhum teste dedicado a `audit.middleware.ts` (só cobertura indireta via outros testes de integração, que não afirmam nada sobre `audit.mode`). Create `backend/tests/integration/audit-middleware.test.ts`:

```ts
import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions } from '../helpers/fixtures';
import { clearSettingCache } from '../../src/services/system-setting.service';

/**
 * auditMiddleware (backend/src/middleware/audit.middleware.ts) respeitando
 * audit.mode/audit.include_reads vindos do banco em vez de config.audit.*
 * fixo. Usa a rota /api/v1/roles como alvo real (POST=escrita, GET=leitura)
 * porque não está na lista excludedPaths do middleware.
 */
const loginWith = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });
  return res.body.data.accessToken as string;
};

describe('Integração: auditMiddleware — audit.mode/audit.include_reads configuráveis', () => {
  afterEach(async () => {
    clearSettingCache();
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('audit.mode = "none" não grava nenhum log, nem de escrita', async () => {
    await testPrisma.systemSetting.create({
      data: { key: 'audit.mode', value: 'none', type: 'STRING', category: 'auditoria', label: 'Modo de auditoria' },
    });
    clearSettingCache();

    const token = await loginWith([{ resource: 'roles', action: 'create' }]);
    await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TESTE-AUDIT-1', name: 'Perfil Teste' });

    const logs = await testPrisma.auditLog.findMany({ where: { resource: 'roles' } });
    expect(logs).toHaveLength(0);
  });

  it('audit.mode = "write_only" grava POST mas não GET bem-sucedido', async () => {
    await testPrisma.systemSetting.create({
      data: { key: 'audit.mode', value: 'write_only', type: 'STRING', category: 'auditoria', label: 'Modo de auditoria' },
    });
    clearSettingCache();

    const token = await loginWith([
      { resource: 'roles', action: 'create' },
      { resource: 'roles', action: 'read' },
    ]);

    await request(app)
      .post('/api/v1/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'TESTE-AUDIT-2', name: 'Perfil Teste 2' });
    await request(app).get('/api/v1/roles').set('Authorization', `Bearer ${token}`);

    const writeLogs = await testPrisma.auditLog.findMany({ where: { resource: 'roles', action: 'create' } });
    expect(writeLogs.length).toBeGreaterThanOrEqual(1);

    const readLogs = await testPrisma.auditLog.findMany({ where: { resource: 'roles', action: 'read' } });
    expect(readLogs).toHaveLength(0);
  });

  it('audit.mode = "all" com audit.include_reads = "true" grava também leituras bem-sucedidas', async () => {
    await testPrisma.systemSetting.create({
      data: { key: 'audit.mode', value: 'all', type: 'STRING', category: 'auditoria', label: 'Modo de auditoria' },
    });
    await testPrisma.systemSetting.create({
      data: { key: 'audit.include_reads', value: 'true', type: 'BOOLEAN', category: 'auditoria', label: 'Incluir leituras' },
    });
    clearSettingCache();

    const token = await loginWith([{ resource: 'roles', action: 'read' }]);
    await request(app).get('/api/v1/roles').set('Authorization', `Bearer ${token}`);

    const readLogs = await testPrisma.auditLog.findMany({ where: { resource: 'roles', action: 'read' } });
    expect(readLogs.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 9: Rodar e confirmar que falham**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/integration/audit-middleware.test.ts`
Expected: FAIL nos 3 testes — o middleware ainda lê `config.audit.mode`/`config.audit.includeReads` fixos (`write_only`/`false` por padrão neste ambiente), então "none" e "all com include_reads" não têm efeito nenhum.

- [ ] **Step 10: Migrar `audit.middleware.ts`**

Modify `backend/src/middleware/audit.middleware.ts` — trocar as 4 leituras de `config.audit.mode`/`config.audit.includeReads` dentro do handler `res.on('finish', async () => { ... })` (o handler já é `async`, então `await` é seguro aqui):

```ts
import { Request, Response, NextFunction } from 'express';
import auditLogService from '../services/audit-log.service';
import { AuthRequest } from './auth.middleware';
import { config } from '../config/env';
import { getSetting } from '../services/system-setting.service';

export const auditMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();
  const originalBody = { ...req.body };
  const originalJson = res.json.bind(res);
  let responseBody: any;

  res.json = function (body: any) {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', async () => {
    try {
      const auditMode = await getSetting('audit.mode', config.audit.mode);
      if (auditMode === 'none') {
        return;
      }

      const durationMs = Date.now() - startTime;
      const actionMap: Record<string, string> = {
        GET: 'read', POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete',
      };
      const action = actionMap[req.method] || 'unknown';

      const pathParts = req.path.split('/').filter(Boolean);
      const resource = pathParts[pathParts.length - 1] || 'unknown';

      const excludedPaths = [
        '/health', '/auth/refresh', '/auth/me',
        '/audit-logs', '/permissions', '/statistics',
      ];
      if (excludedPaths.some((path) => req.path.includes(path))) {
        return;
      }

      const isReadOperation = req.method === 'GET';
      const isError = res.statusCode >= 400;
      const isWriteOperation = !isReadOperation;

      if (auditMode === 'errors_only' && !isError) {
        return;
      }

      if (auditMode === 'write_only') {
        if (isReadOperation && !isError) {
          return;
        }
      }

      if (auditMode === 'all') {
        const includeReads = await getSetting('audit.include_reads', config.audit.includeReads);
        if (isReadOperation && !includeReads && !isError) {
          return;
        }
      }

      if (isWriteOperation || isError) {
        await auditLogService.create({
          userId: req.userId,
          action,
          resource,
          description: `${req.method} ${req.path}`,
          ipAddress: auditLogService.getIpAddress(req),
          userAgent: req.headers['user-agent'],
          method: req.method,
          endpoint: req.originalUrl,
          statusCode: res.statusCode,
          requestBody: sanitizeBody(originalBody),
          responseBody: sanitizeBody(responseBody),
          durationMs,
        });
      }
    } catch (error) {
      console.error('Erro ao criar audit log:', error);
    }
  });

  next();
};

function sanitizeBody(body: any): any {
  if (!body) return null;
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken'];
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }
  return sanitized;
}

export function AuditLog(resource: string, action: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const req = args[0] as AuthRequest;
      const result = await originalMethod.apply(this, args);
      try {
        await auditLogService.logRequest(req, req.userId, action, resource, req.params?.id, `${action} ${resource}`);
      } catch (error) {
        console.error('Erro ao criar audit log:', error);
      }
      return result;
    };
    return descriptor;
  };
}
```

- [ ] **Step 11: Rodar os testes de `audit.middleware.ts` e confirmar que passam**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/integration/audit-middleware.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 12: Rodar a suíte completa de backend**

Run: `npm run test:integration` (de `backend/`).
Expected: todos os testes passam — em especial, nenhum teste pré-existente quebra (o comportamento default, sem linha no banco para nenhuma das 3 chaves migradas nesta task, é idêntico ao de antes via fallback).

- [ ] **Step 13: Commit**

```bash
git add backend/src/services/notification-detector.service.ts backend/src/jobs/log-cleanup.job.ts backend/src/middleware/audit.middleware.ts backend/tests/services/lot-expiry-notification.service.test.ts backend/tests/jobs/log-cleanup.job.test.ts backend/tests/integration/audit-middleware.test.ts
git commit -m "refactor(backend): le lot_expiry_alert_days, audit.mode/retention/include_reads via system-setting

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Rate-limiting configurável (aplicado após restart)

**Files:**
- Modify: `backend/src/middleware/rate-limit.middleware.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/tests/middleware/rate-limit.middleware.test.ts` (estender)

**Interfaces:**
- Consumes: `getSetting` (Task 3).
- Produces: `RateLimiter` (tipo: função + método `.configure({windowMs?, max?}): void`). `generalLimiter`/`authLimiter`/`writeLimiter` passam a ter esse tipo — nenhuma outra task depende disto.

- [ ] **Step 1: Escrever o teste que falha para `.configure()`**

Adicionar a `backend/tests/middleware/rate-limit.middleware.test.ts` (ao final do `describe('rateLimit', ...)` existente):

```ts
  it('configure() muda o limite em uso sem recriar o middleware nem perder o store', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2 });
    const req = makeReq('203.0.113.200');

    expect(hit(limiter, req).passed).toBe(true); // 1
    expect(hit(limiter, req).passed).toBe(true); // 2 = max

    limiter.configure({ max: 5 });

    // Mesmo IP, mesma janela (store intacto): agora aceita até o novo máximo.
    expect(hit(limiter, req).passed).toBe(true); // 3, dentro do novo max=5
    expect(hit(limiter, req).passed).toBe(true); // 4
    expect(hit(limiter, req).passed).toBe(true); // 5 = novo max
    expect(hit(limiter, req).passed).toBe(false); // 6 > novo max
  });

  it('configure() aceita atualizar só windowMs, mantendo o max atual', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 3 });
    const req = makeReq('203.0.113.201');

    hit(limiter, req);
    hit(limiter, req);
    limiter.configure({ windowMs: 120_000 });

    // max continua 3 — a 4ª (contando as 2 já feitas) ainda passa, a 5ª não.
    expect(hit(limiter, req).passed).toBe(true); // 3 = max
    expect(hit(limiter, req).passed).toBe(false); // 4 > max
  });
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/middleware/rate-limit.middleware.test.ts`
Expected: FAIL — `limiter.configure is not a function`.

- [ ] **Step 3: Reescrever `rate-limit.middleware.ts` com estado mutável**

Modify `backend/src/middleware/rate-limit.middleware.ts` — substituir o corpo de `rateLimit()` (mantendo `RateLimitStore`/`RateLimitOptions` como estão) por:

```ts
export interface RateLimiter {
  (req: Request, res: Response, next: NextFunction): void;
  /** Sobrescreve windowMs/max em uso. Não recria o middleware nem o store — contadores por IP em curso continuam válidos. */
  configure(overrides: Partial<Pick<RateLimitOptions, 'windowMs' | 'max'>>): void;
}

export function rateLimit(options: RateLimitOptions): RateLimiter {
  const store: RateLimitStore = {};

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    Object.keys(store).forEach(key => {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    });
  }, 5 * 60 * 1000);
  cleanupTimer.unref?.();

  // Estado MUTÁVEL — .configure() atualiza estes dois campos; o resto das
  // opções (message, skipSuccessfulRequests, keyGenerator) não muda em
  // runtime nesta v1 (só windowMs/max vêm da tela de Configurações).
  const state = { windowMs: options.windowMs, max: options.max };

  const {
    message = 'Muitas requisições deste IP, tente novamente mais tarde',
    skipSuccessfulRequests = false,
    keyGenerator = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown',
  } = options;

  const handler = ((req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      store[key] = { count: 1, resetTime: now + state.windowMs };
      return next();
    }

    store[key].count++;

    const remaining = Math.max(0, state.max - store[key].count);
    const resetTime = Math.ceil((store[key].resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', state.max.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetTime.toString());

    if (store[key].count > state.max) {
      logger.warn(`Rate limit exceeded for ${key}`, {
        ip: key,
        count: store[key].count,
        limit: state.max
      });

      return res.status(429).json({
        status: 'error',
        message,
        retryAfter: resetTime
      });
    }

    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          store[key].count = Math.max(0, store[key].count - 1);
        }
      });
    }

    next();
  }) as RateLimiter;

  handler.configure = (overrides) => {
    if (overrides.windowMs !== undefined) state.windowMs = overrides.windowMs;
    if (overrides.max !== undefined) state.max = overrides.max;
  };

  return handler;
}
```

(`generalLimiter`/`authLimiter`/`writeLimiter`, declarados logo abaixo no mesmo arquivo, não mudam — continuam chamando `rateLimit({...})` normalmente, e agora têm o tipo `RateLimiter` inferido automaticamente.)

- [ ] **Step 4: Rodar e confirmar que passa, sem quebrar os testes pré-existentes**

Run: `node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx jest tests/middleware/rate-limit.middleware.test.ts`
Expected: PASS — os 6 testes pré-existentes (regressão do store compartilhado) mais os 2 novos de `.configure()`.

- [ ] **Step 5: Aplicar os overrides no boot (`server.ts`)**

Modify `backend/src/server.ts` — adicionar o import e a leitura logo após `logger.info('✅ Database connected successfully');` e antes de `loadLicensedModules()`:

```ts
import { getSetting } from './services/system-setting.service';
import { generalLimiter, authLimiter, writeLimiter } from './middleware/rate-limit.middleware';
```

(adicionar aos imports existentes no topo do arquivo)

```ts
    // Configurações do Sistema — rate-limiting só aplica os valores do banco
    // no PRÓXIMO restart (os limitadores já foram criados no import estático
    // de app.ts, antes desta linha rodar; .configure() ajusta o estado em uso
    // sem recriar o middleware nem perder os contadores por IP já em curso —
    // ver rate-limit.middleware.ts). Fallback = os valores hardcoded de hoje,
    // então nada muda até um admin editar pela tela e reiniciar o serviço.
    const [
      generalWindowMs, generalMax,
      loginWindowMs, loginMax,
      strictWindowMs, strictMax,
    ] = await Promise.all([
      getSetting('rate_limit.general.window_ms', 15 * 60 * 1000),
      getSetting('rate_limit.general.max_requests', config.nodeEnv === 'development' ? 1000 : 100),
      getSetting('rate_limit.login.window_ms', 15 * 60 * 1000),
      getSetting('rate_limit.login.max_requests', config.nodeEnv === 'development' || config.nodeEnv === 'test' ? 50 : 10),
      getSetting('rate_limit.strict.window_ms', 1 * 60 * 1000),
      getSetting('rate_limit.strict.max_requests', config.nodeEnv === 'development' ? 100 : 30),
    ]);
    generalLimiter.configure({ windowMs: generalWindowMs, max: generalMax });
    authLimiter.configure({ windowMs: loginWindowMs, max: loginMax });
    writeLimiter.configure({ windowMs: strictWindowMs, max: strictMax });
    logger.info('✅ Rate limiting configurado a partir das Configurações do Sistema');

    // F0.8: módulos licenciados desta instalação ...
    const licensedModules = await loadLicensedModules();
```

(inserir antes da linha `const licensedModules = await loadLicensedModules();` já existente — o resto do `startServer()` não muda.)

- [ ] **Step 6: Verificar manualmente que o backend sobe sem erro**

Run (de `backend/`): `npm run dev` (ou o comando de dev já usado no container `fabric-backend`) e observar o log.
Expected: linha `✅ Rate limiting configurado a partir das Configurações do Sistema` aparece antes de `🚀 Server running on port ...`, sem exceptions.

- [ ] **Step 7: Commit**

```bash
git add backend/src/middleware/rate-limit.middleware.ts backend/src/server.ts backend/tests/middleware/rate-limit.middleware.test.ts
git commit -m "feat(backend): rate limiters ganham configure() e leem overrides do banco no boot

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Frontend — service e store

**Files:**
- Create: `frontend/src/types/system-setting.types.ts`
- Create: `frontend/src/services/system-setting.service.ts`
- Create: `frontend/src/stores/system-setting.store.ts`
- Test: `frontend/src/stores/__tests__/system-setting.store.spec.ts`

**Interfaces:**
- Consumes: `api` de `@/services/api.service` (mesmo cliente axios usado por `workflow-template.service.ts`).
- Produces: `SystemSetting` (type), `useSystemSettingStore()` com `settings: Ref<SystemSetting[]>`, `loading: Ref<boolean>`, `error: Ref<string>`, `fetchSettings()`, `updateSetting(key, value)`. Task 9 (view) consome esta store.

- [ ] **Step 1: Criar os tipos**

Create `frontend/src/types/system-setting.types.ts`:

```ts
export type SettingType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON'

export interface SystemSetting {
  key: string
  value: string
  type: SettingType
  category: string
  label: string
  description: string | null
  updatedAt: string
}
```

- [ ] **Step 2: Criar o service**

Create `frontend/src/services/system-setting.service.ts`:

```ts
import api from './api.service'
import type { SystemSetting } from '@/types/system-setting.types'

interface ApiEnvelope<T> {
  status: 'success' | 'error'
  data: T
}

class SystemSettingService {
  async getAll() {
    return api.get<ApiEnvelope<SystemSetting[]>>('/system/settings')
  }

  async update(key: string, value: string) {
    return api.patch<ApiEnvelope<SystemSetting>>(`/system/settings/${key}`, { value })
  }
}

export default new SystemSettingService()
```

- [ ] **Step 3: Escrever o teste da store que falha**

Create `frontend/src/stores/__tests__/system-setting.store.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSystemSettingStore } from '../system-setting.store'
import systemSettingService from '@/services/system-setting.service'

vi.mock('@/services/system-setting.service', () => ({
  default: {
    getAll: vi.fn(),
    update: vi.fn(),
  },
}))

const mockSetting = {
  key: 'wms.task_delay_threshold_hours',
  value: '24',
  type: 'NUMBER' as const,
  category: 'wms',
  label: 'Limiar de tarefa atrasada (horas)',
  description: null,
  updatedAt: '2026-09-05T00:00:00.000Z',
}

describe('useSystemSettingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchSettings popula settings a partir do service', async () => {
    vi.mocked(systemSettingService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockSetting] },
    } as any)

    const store = useSystemSettingStore()
    await store.fetchSettings()

    expect(store.settings).toEqual([mockSetting])
    expect(store.loading).toBe(false)
  })

  it('fetchSettings marca error em caso de falha e não deixa loading travado', async () => {
    vi.mocked(systemSettingService.getAll).mockRejectedValue({
      response: { data: { message: 'falha de rede' } },
    })

    const store = useSystemSettingStore()
    await store.fetchSettings()

    expect(store.error).toBe('falha de rede')
    expect(store.loading).toBe(false)
  })

  it('updateSetting atualiza a linha correspondente na lista', async () => {
    const store = useSystemSettingStore()
    store.settings = [mockSetting]

    vi.mocked(systemSettingService.update).mockResolvedValue({
      data: { status: 'success', data: { ...mockSetting, value: '48' } },
    } as any)

    await store.updateSetting('wms.task_delay_threshold_hours', '48')

    expect(store.settings[0].value).toBe('48')
  })
})
```

- [ ] **Step 4: Rodar e confirmar que falha**

Run (de `frontend/`): `npx vitest run src/stores/__tests__/system-setting.store.spec.ts`
Expected: FAIL — `Cannot find module '../system-setting.store'`.

- [ ] **Step 5: Implementar a store**

Create `frontend/src/stores/system-setting.store.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import systemSettingService from '@/services/system-setting.service'
import type { SystemSetting } from '@/types/system-setting.types'

export const useSystemSettingStore = defineStore('systemSetting', () => {
  const settings = ref<SystemSetting[]>([])
  const loading = ref(false)
  const error = ref('')

  const fetchSettings = async (): Promise<void> => {
    loading.value = true
    error.value = ''
    try {
      const response = await systemSettingService.getAll()
      settings.value = response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar configurações'
    } finally {
      loading.value = false
    }
  }

  const updateSetting = async (key: string, value: string): Promise<SystemSetting> => {
    const response = await systemSettingService.update(key, value)
    const updated = response.data.data
    const index = settings.value.findIndex((s) => s.key === key)
    if (index !== -1) settings.value[index] = updated
    return updated
  }

  return { settings, loading, error, fetchSettings, updateSetting }
})
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npx vitest run src/stores/__tests__/system-setting.store.spec.ts`
Expected: PASS, 3 testes.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/system-setting.types.ts frontend/src/services/system-setting.service.ts frontend/src/stores/system-setting.store.ts frontend/src/stores/__tests__/system-setting.store.spec.ts
git commit -m "feat(frontend): adiciona service e store de Configuracoes do Sistema

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Frontend — tela, rota e card no Dashboard

**Files:**
- Create: `frontend/src/views/settings/system-settings-form.ts`
- Test: `frontend/src/views/settings/__tests__/system-settings-form.spec.ts`
- Create: `frontend/src/views/settings/SystemSettingsView.vue`
- Test: `frontend/src/views/settings/__tests__/SystemSettingsView.spec.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue`

**Interfaces:**
- Consumes: `useSystemSettingStore` (Task 8), `AppLayout`/`FormField` (já existentes), `useToast` (já existente).
- Produces: rota `/settings/system`. Nenhuma outra task depende disto.

- [ ] **Step 1: Escrever o teste do módulo de agrupamento/validação que falha**

Create `frontend/src/views/settings/__tests__/system-settings-form.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { groupByCategory, CATEGORY_LABELS, validateSettingInput } from '../system-settings-form'
import type { SystemSetting } from '@/types/system-setting.types'

const setting = (overrides: Partial<SystemSetting> = {}): SystemSetting => ({
  key: 'wms.task_delay_threshold_hours',
  value: '24',
  type: 'NUMBER',
  category: 'wms',
  label: 'Limiar de tarefa atrasada (horas)',
  description: null,
  updatedAt: '2026-09-05T00:00:00.000Z',
  ...overrides,
})

describe('system-settings-form', () => {
  describe('groupByCategory', () => {
    it('agrupa por categoria preservando a ordem de chegada dentro do grupo', () => {
      const settings = [
        setting({ key: 'wms.a', category: 'wms' }),
        setting({ key: 'auditoria.x', category: 'auditoria' }),
        setting({ key: 'wms.b', category: 'wms' }),
      ]
      const grouped = groupByCategory(settings)
      expect(Object.keys(grouped)).toEqual(['wms', 'auditoria'])
      expect(grouped.wms.map((s) => s.key)).toEqual(['wms.a', 'wms.b'])
    })
  })

  describe('CATEGORY_LABELS', () => {
    it('tem rótulo amigável para as 3 categorias da v1', () => {
      expect(CATEGORY_LABELS.wms).toBe('WMS')
      expect(CATEGORY_LABELS.auditoria).toBe('Auditoria')
      expect(CATEGORY_LABELS.rate_limit).toBe('Rate Limiting')
    })
  })

  describe('validateSettingInput', () => {
    it('NUMBER: aceita numérico, rejeita não-numérico', () => {
      expect(validateSettingInput('NUMBER', '24')).toBeNull()
      expect(validateSettingInput('NUMBER', 'abc')).not.toBeNull()
    })

    it('BOOLEAN: aceita "true"/"false", rejeita outro texto', () => {
      expect(validateSettingInput('BOOLEAN', 'true')).toBeNull()
      expect(validateSettingInput('BOOLEAN', 'talvez')).not.toBeNull()
    })

    it('STRING: sempre válido', () => {
      expect(validateSettingInput('STRING', '')).toBeNull()
      expect(validateSettingInput('STRING', 'qualquer coisa')).toBeNull()
    })

    it('JSON: aceita objeto válido, rejeita sintaxe inválida', () => {
      expect(validateSettingInput('JSON', '{"a":1}')).toBeNull()
      expect(validateSettingInput('JSON', '{a:1}')).not.toBeNull()
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run (de `frontend/`): `npx vitest run src/views/settings/__tests__/system-settings-form.spec.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar o módulo de agrupamento/validação**

Create `frontend/src/views/settings/system-settings-form.ts`:

```ts
import type { SystemSetting, SettingType } from '@/types/system-setting.types'

export const CATEGORY_LABELS: Record<string, string> = {
  wms: 'WMS',
  auditoria: 'Auditoria',
  rate_limit: 'Rate Limiting',
}

/** Agrupa preservando a ordem de chegada dos grupos e dos itens dentro de cada grupo — a lista já vem ordenada por categoria+chave do backend. */
export function groupByCategory(settings: SystemSetting[]): Record<string, SystemSetting[]> {
  const grouped: Record<string, SystemSetting[]> = {}
  for (const setting of settings) {
    if (!grouped[setting.category]) grouped[setting.category] = []
    grouped[setting.category].push(setting)
  }
  return grouped
}

/** Devolve uma mensagem de erro (para exibir e desabilitar o salvar) ou null se `raw` é válido para `type`. Mesma lógica de aceite de coerceSettingValue no backend — validação client-side é só UX, o backend valida de novo. */
export function validateSettingInput(type: SettingType, raw: string): string | null {
  switch (type) {
    case 'NUMBER':
      return Number.isFinite(Number(raw)) && raw.trim() !== '' ? null : 'Informe um número válido.'
    case 'BOOLEAN':
      return raw === 'true' || raw === 'false' ? null : 'Informe verdadeiro ou falso.'
    case 'JSON':
      try {
        JSON.parse(raw)
        return null
      } catch {
        return 'Informe um JSON válido.'
      }
    case 'STRING':
    default:
      return null
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/views/settings/__tests__/system-settings-form.spec.ts`
Expected: PASS, 8 testes.

- [ ] **Step 5: Escrever o teste da view que falha**

Create `frontend/src/views/settings/__tests__/SystemSettingsView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import SystemSettingsView from '../SystemSettingsView.vue'
import { useSystemSettingStore } from '@/stores/system-setting.store'
import systemSettingService from '@/services/system-setting.service'

vi.mock('@/services/system-setting.service', () => ({
  default: { getAll: vi.fn(), update: vi.fn() },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ userName: 'Teste', logout: vi.fn() }),
}))

const mockSettings = [
  {
    key: 'wms.task_delay_threshold_hours',
    value: '24',
    type: 'NUMBER' as const,
    category: 'wms',
    label: 'Limiar de tarefa atrasada (horas)',
    description: 'ajuda',
    updatedAt: '2026-09-05T00:00:00.000Z',
  },
  {
    key: 'audit.include_reads',
    value: 'false',
    type: 'BOOLEAN' as const,
    category: 'auditoria',
    label: 'Incluir leituras',
    description: null,
    updatedAt: '2026-09-05T00:00:00.000Z',
  },
]

function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/settings/system', component: SystemSettingsView },
      { path: '/login', component: { template: '<div />' } },
    ],
  })
}

describe('SystemSettingsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('carrega e agrupa as configurações por categoria ao montar', async () => {
    vi.mocked(systemSettingService.getAll).mockResolvedValue({
      data: { status: 'success', data: mockSettings },
    } as any)

    const router = makeRouter()
    router.push('/settings/system')
    await router.isReady()

    const wrapper = mount(SystemSettingsView, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.text()).toContain('WMS')
    expect(wrapper.text()).toContain('Auditoria')
    expect(wrapper.text()).toContain('Limiar de tarefa atrasada')
  })

  it('salva um campo individual e mostra o valor atualizado', async () => {
    vi.mocked(systemSettingService.getAll).mockResolvedValue({
      data: { status: 'success', data: mockSettings },
    } as any)
    vi.mocked(systemSettingService.update).mockResolvedValue({
      data: { status: 'success', data: { ...mockSettings[0], value: '48' } },
    } as any)

    const router = makeRouter()
    router.push('/settings/system')
    await router.isReady()

    const wrapper = mount(SystemSettingsView, { global: { plugins: [router] } })
    await flushPromises()

    const input = wrapper.find('input[type="number"]')
    await input.setValue('48')

    const saveButtons = wrapper.findAll('button').filter((b) => b.text().includes('Salvar'))
    await saveButtons[0].trigger('click')
    await flushPromises()

    expect(systemSettingService.update).toHaveBeenCalledWith('wms.task_delay_threshold_hours', '48')
  })
})
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `npx vitest run src/views/settings/__tests__/SystemSettingsView.spec.ts`
Expected: FAIL — componente não existe.

- [ ] **Step 7: Implementar a view**

Create `frontend/src/views/settings/SystemSettingsView.vue`:

```vue
<template>
  <AppLayout title="Configurações do Sistema" subtitle="Parâmetros de instalação editáveis por administradores">
    <div v-if="store.loading" class="text-center py-12 text-gray-500">Carregando...</div>
    <div v-else-if="store.error" class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
      {{ store.error }}
      <button class="ml-2 underline" @click="store.fetchSettings">Tentar novamente</button>
    </div>
    <div v-else class="space-y-8">
      <section v-for="(items, category) in grouped" :key="category" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ CATEGORY_LABELS[category] || category }}</h3>
        <p v-if="category === 'rate_limit'" class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-4">
          Alterações nesta seção exigem reiniciar o serviço para valer.
        </p>
        <div class="space-y-4">
          <div v-for="item in items" :key="item.key" class="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <FormField :label="item.label" :hint="item.description || undefined">
              <div class="flex items-center gap-2">
                <select
                  v-if="item.type === 'BOOLEAN'"
                  v-model="drafts[item.key]"
                  class="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="true">Verdadeiro</option>
                  <option value="false">Falso</option>
                </select>
                <input
                  v-else
                  :type="item.type === 'NUMBER' ? 'number' : 'text'"
                  v-model="drafts[item.key]"
                  class="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 flex-1"
                />
                <button
                  type="button"
                  class="px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                  :disabled="!!fieldErrors[item.key] || drafts[item.key] === item.value || saving[item.key]"
                  @click="save(item)"
                >
                  Salvar
                </button>
              </div>
              <p v-if="fieldErrors[item.key]" class="mt-1 text-sm text-red-600">{{ fieldErrors[item.key] }}</p>
            </FormField>
          </div>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import FormField from '@/components/common/FormField.vue'
import { useSystemSettingStore } from '@/stores/system-setting.store'
import { useToast } from '@/composables/useToast'
import { groupByCategory, CATEGORY_LABELS, validateSettingInput } from './system-settings-form'
import type { SystemSetting } from '@/types/system-setting.types'
import { computed } from 'vue'

const store = useSystemSettingStore()
const toast = useToast()

const drafts = reactive<Record<string, string>>({})
const fieldErrors = reactive<Record<string, string | null>>({})
const saving = reactive<Record<string, boolean>>({})

const grouped = computed(() => groupByCategory(store.settings))

watch(
  () => store.settings,
  (settings) => {
    for (const setting of settings) {
      if (!(setting.key in drafts)) drafts[setting.key] = setting.value
    }
  },
  { immediate: true }
)

watch(drafts, (current) => {
  for (const setting of store.settings) {
    const raw = current[setting.key]
    if (raw === undefined) continue
    fieldErrors[setting.key] = validateSettingInput(setting.type, raw)
  }
}, { deep: true })

async function save(item: SystemSetting): Promise<void> {
  saving[item.key] = true
  try {
    await store.updateSetting(item.key, drafts[item.key])
    toast.success(`"${item.label}" atualizado com sucesso.`)
  } catch (error: any) {
    toast.error(error.response?.data?.message || `Erro ao salvar "${item.label}".`)
  } finally {
    saving[item.key] = false
  }
}

onMounted(() => {
  store.fetchSettings()
})
</script>
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `npx vitest run src/views/settings/__tests__/SystemSettingsView.spec.ts`
Expected: PASS, 2 testes.

- [ ] **Step 9: Registrar a rota**

Modify `frontend/src/router/index.ts` — adicionar, junto das demais rotas administrativas (perto de `/audit-logs`):

```ts
  {
    path: '/settings/system',
    name: 'system-settings',
    component: () => import('../views/settings/SystemSettingsView.vue'),
    meta: { requiresAuth: true },
  },
```

- [ ] **Step 10: Adicionar o card no Dashboard**

Modify `frontend/src/views/DashboardView.vue` — na aba "Geral" (`v-if="activeTab === 'geral' && authStore.canViewGeneral"`), adicionar um novo `RouterLink` logo após o de Logs de Auditoria:

```html
            <RouterLink
              to="/audit-logs"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📋</div>
                <p class="text-sm font-medium text-gray-700">Logs de Auditoria</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/settings/system"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">⚙️</div>
                <p class="text-sm font-medium text-gray-700">Configurações</p>
              </div>
            </RouterLink>
```

- [ ] **Step 11: Rodar a suíte completa de frontend e o type-check**

Run (de `frontend/`): `npx vitest run`
Expected: todos os testes passam (baseline + os novos desta task).

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem de erros pré-existente do baseline do projeto (nenhum erro novo nos arquivos desta task).

- [ ] **Step 12: Verificação visual manual**

Com os containers Docker rodando (`fabric-backend`/`fabric-frontend`), rodar o script de screenshot com a rota nova:

```bash
node scripts/screenshot.mjs dashboard system-settings
```

(adicionar `'system-settings': '/settings/system'` a `ROUTES` em `frontend/scripts/screenshot.mjs` antes de rodar, mesmo padrão já usado pelas rotas WMS anteriores)

Expected: `dashboard.png` mostra o novo card "Configurações" na aba Geral; `system-settings.png` mostra as 3 seções (WMS, Auditoria, Rate Limiting) com os campos e o aviso de restart na seção de Rate Limiting.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/views/settings frontend/src/router/index.ts frontend/src/views/DashboardView.vue frontend/scripts/screenshot.mjs docs/fase-2026-09-modernizacao/screenshots/dashboard.png docs/fase-2026-09-modernizacao/screenshots/system-settings.png
git commit -m "feat(frontend): adiciona tela de Configuracoes do Sistema, rota e card no Dashboard

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final Check

- [ ] Rodar `npm run test:integration` em `backend/` — todos os testes passam (baseline + todos os novos deste plano).
- [ ] Rodar `npx vitest run` em `frontend/` — todos os testes passam.
- [ ] Rodar `npx vue-tsc --noEmit` em `frontend/` — mesma contagem de erros do baseline do projeto.
- [ ] Rodar `npx tsc --noEmit` em `backend/` — mesma contagem de erros do baseline do projeto.
- [ ] Verificação manual: logar como ADMIN, abrir `/settings/system`, editar `wms.task_delay_threshold_hours` para um valor diferente, confirmar toast de sucesso e que o valor persiste ao recarregar a página.
- [ ] Verificação manual: editar `audit.mode` para `"none"`, confirmar (via uma chamada de API qualquer + consulta em `/audit-logs`) que nenhum log novo é criado; reverter para `"write_only"` ao final.
- [ ] Revisão final de branch inteira (mesmo padrão dos 3 projetos WMS anteriores) — procurar especificamente por integrações entre tasks que nenhuma task individual conseguiria ver sozinha (ex.: um serviço migrado na Task 6 que outro ponto do código ainda lê via `config.x.y` direto e ficou divergente do banco).
