# Configurações do Sistema

**Data:** 2026-09-05
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** infraestrutura genérica de parâmetros + migração de 3 grupos de parâmetros hoje hardcoded/via `.env`. Pré-requisito do Dashboard de KPIs do WMS (item separado na fila de features, que usará o limiar de atraso de tarefa criado aqui).

## Contexto e motivação

O projeto centraliza hoje parâmetros de instalação (janela de alerta de validade de lote, retenção de logs de auditoria, limites de rate-limiting, etc.) em variáveis de ambiente (`backend/src/config/env.ts`), cada uma com um comentário explicando o racional de ser configurável. Mudar qualquer um desses valores exige acesso ao servidor e reinício do processo — inviável para um gestor não-técnico ajustar, por exemplo, quantos dias de antecedência o sistema deve alertar sobre lote vencendo.

Este projeto nasceu como pré-requisito de outro (Dashboard de KPIs do WMS, que precisa de um limiar configurável de "tarefa atrasada"), mas foi decidido tratá-lo como hub central: uma tela de Configurações do Sistema onde parâmetros de qualquer domínio podem ser adicionados sem nova migração, com os primeiros 3 grupos reais migrados nesta v1.

## Abordagens consideradas

**Modelo de dados:**

- **A — Tabela genérica chave/valor (escolhida).** Uma tabela `SystemSetting` com `key`/`value`/`type`/`category` serve qualquer parâmetro futuro com só um novo registro seed, sem migração de schema.
- **B — Tabelas tipadas por domínio** (`WmsSettings`, `AuditSettings`, `RateLimitSettings`, cada uma uma linha singleton). Mais type-safe no Prisma, mas cada parâmetro novo exigiria migração — contrário ao objetivo de hub central extensível.

**Convivência com `.env`:**

- **A — Banco vence, com fallback pro `.env`/default (escolhida).** Cada parâmetro migrado passa a ser lido do banco (cacheado); se não houver registro, cai no valor do `.env`/default atual — comportamento de hoje preservado até alguém editar pela tela. Seed inicial popula o banco com os valores atuais, então nada muda até uma edição explícita.
- **B — Banco substitui `.env` de vez.** Rejeitada: perde o "valor de fábrica" documentado no `.env`, e exige seed obrigatório antes do primeiro boot funcionar corretamente.

## Desenho

### 1. Modelo de dados

```prisma
enum SettingType {
  STRING
  NUMBER
  BOOLEAN
  JSON
}

model SystemSetting {
  id          String      @id @default(uuid())
  key         String      @unique   // ex: "wms.task_delay_threshold_hours"
  value       String                // sempre string; type valida o parse/uso
  type        SettingType
  category    String                // "wms" | "auditoria" | "rate_limit" — agrupa a tela
  label       String                // rótulo amigável
  description String?               // racional do parâmetro (mesmo espírito dos comentários de env.ts hoje)
  updatedBy   String?
  updatedAt   DateTime    @updatedAt

  @@index([category])
}
```

### 2. Parâmetros migrados na v1

| `key` | categoria | tipo | default (valor atual) | observação |
|---|---|---|---|---|
| `wms.task_delay_threshold_hours` | wms | NUMBER | `24` | **Novo** — usado pelo Dashboard de KPIs (projeto separado) pra sinalizar tarefa parada há muito tempo. |
| `wms.lot_expiry_alert_days` | wms | NUMBER | `7` (hoje `LOT_EXPIRY_ALERT_DAYS`) | Lido em runtime pelo job/detector — mudança tem efeito imediato (após invalidação de cache). |
| `audit.retention_days` | auditoria | NUMBER | `90` (hoje `AUDIT_LOG_RETENTION_DAYS`) | Lido pelo job diário de limpeza. |
| `audit.mode` | auditoria | STRING (enum textual: `all`/`write_only`/`errors_only`/`none`) | `write_only` (hoje `AUDIT_LOG_MODE`) | Select na tela, não texto livre. |
| `audit.include_reads` | auditoria | BOOLEAN | `false` (hoje `AUDIT_LOG_INCLUDE_READS`) | |
| `rate_limit.login.window_ms` / `rate_limit.login.max_requests` | rate_limit | NUMBER | valores atuais do preset de login | Ver nota de aplicação abaixo. |
| `rate_limit.general.window_ms` / `rate_limit.general.max_requests` | rate_limit | NUMBER | valores atuais do preset geral | |
| `rate_limit.strict.window_ms` / `rate_limit.strict.max_requests` | rate_limit | NUMBER | valores atuais do preset de 1 min | |

JWT (secrets/expiry) e SMTP ficam **fora de escopo** — são segredos/infra de deploy, não parâmetros de negócio ajustáveis por um admin logado.

### 3. Leitura, cache e fallback

Serviço `system-setting.service.ts`:

```ts
async function getSetting<T>(key: string, fallback: T): Promise<T>
```

- Cache em memória (`Map<string, unknown>`), **invalidado imediatamente** a cada `PATCH` bem-sucedido (não usa TTL) — a mudança feita na tela vale já na próxima leitura, sem esperar expirar.
- Prioridade: linha no banco (`SystemSetting.value`, convertida pelo `type`) → senão o `fallback` passado pelo call site (hoje viria de `config.wms.lotExpiryAlertDays` etc., preservando o comportamento atual quando não há linha).
- Pontos de leitura migrados: `notification-detector.service.ts` (`checkExpiringLots`), `log-cleanup.job.ts`, `audit.middleware.ts` — cada um troca a leitura direta de `config.x.y` por `getSetting('chave', config.x.y)`.
- **Rate limiting é caso especial**: os middlewares `express-rate-limit` são registrados uma vez no boot do processo, então uma mudança feita na tela só passa a valer **após reiniciar o backend** — isso fica explícito na UI (aviso ao lado dos campos dessa categoria: "alterações exigem reiniciar o serviço para valer"). Não há reconstrução dinâmica de middleware nesta v1 (YAGNI — os outros dois grupos já cobrem o caso de uso "editar sem redeploy" que motivou o projeto).

### 4. Backend — API e RBAC

- Novo recurso RBAC `system_settings`, ações `read`/`update` (padrão `resource:action` já usado em todo o projeto), seedado em `seed.ts`.
- `GET /api/v1/system-settings` — lista todas, agrupadas por `category`. Exige `system_settings:read`.
- `PATCH /api/v1/system-settings/:key` — atualiza uma. Exige `system_settings:update`. Valida `value` contra `type` antes de salvar (ex.: `NUMBER` rejeita não-numérico ou ≤ 0 quando o parâmetro é uma janela de tempo/dias; `audit.mode` valida contra o enum textual permitido).
- Sem `requireModule(...)` — configuração é transversal, não licenciada por módulo.
- Toda alteração passa pelo `audit.middleware.ts` já existente, ficando em `AuditLog` como qualquer outro recurso (quem mudou, quando, valor antigo/novo).

### 5. Frontend

- Nova view `frontend/src/views/settings/SystemSettingsView.vue`, rota `/settings/system`, card na aba **Geral** do Dashboard (junto de Usuários/Perfis/Logs de Auditoria — mesmo grupo administrativo).
- `AppLayout` + seções por `category` (WMS, Auditoria, Rate Limiting), cada campo usando `FormField` do tipo certo (número, toggle, select), com a `description` do parâmetro exibida como texto de ajuda abaixo do campo — mesmo espírito dos comentários hoje em `env.ts`.
- **Salvamento por campo individual**: cada parâmetro tem sua própria ação de salvar, com feedback (toast) isolado de sucesso/erro — evita que editar um campo acidentalmente envie um bloco inteiro.
- Categoria Rate Limiting exibe o aviso de "exige reiniciar o serviço" mencionado acima.

### 6. Testes e tratamento de erro

- **Backend:** RBAC (`system_settings:read`/`update`), validação por `type` (rejeitar valor incompatível), fallback pro `.env`/default quando não há linha no banco, invalidação de cache refletindo o novo valor na leitura seguinte ao `PATCH`. Teste de seed confirmando que as 11 chaves da tabela acima existem após rodar, com os valores atuais como default (idempotente — rodar de novo não sobrescreve customização feita pelo admin).
- **Frontend:** validação de campo por tipo antes de habilitar salvar; fluxo de salvar-por-campo com feedback isolado de sucesso/erro.

## Fora de escopo (deliberado)

- JWT secrets/expiry e configuração de SMTP — infra/segredos de deploy, não parâmetros de negócio.
- Reconstrução dinâmica de middleware de rate-limiting em runtime (fica para reiniciar o serviço nesta v1).
- Histórico de mudanças navegável na própria tela de Configurações (o `AuditLog` já registra, mas não há uma visão dedicada "histórico deste parâmetro" — usar a tela de Logs de Auditoria existente para isso).
- Import/export de configurações entre ambientes.
- O Dashboard de KPIs do WMS em si (projeto separado, consome `wms.task_delay_threshold_hours` criado aqui).

## Riscos / pontos de atenção para o plano de implementação

- Definir o parser/validador de `value` por `type` num único lugar (não duplicar a lógica de parse entre o `service` de leitura e o `PATCH` de escrita) — provavelmente um pequeno módulo `setting-type.util.ts` compartilhado.
- Decidir se `audit.mode` valida contra uma lista fixa de strings no código ou se a UI usa um `<select>` com as 4 opções — a spec assume select fixo, mas a validação do backend precisa espelhar exatamente essas 4 opções pra não divergir.
- O seed precisa rodar como parte da migration ou como script de seed manual? Olhar como os seeds existentes (`seed.ts`) são disparados hoje (na subida da API, conforme o padrão do projeto) antes de decidir.
- Confirmar que `notification-detector.service.ts`, `log-cleanup.job.ts` e `audit.middleware.ts` conseguem chamar um serviço assíncrono (`getSetting` bate no banco/cache) nos pontos onde hoje leem `config` síncrono — checar se algum desses é um contexto sem `await` disponível.
