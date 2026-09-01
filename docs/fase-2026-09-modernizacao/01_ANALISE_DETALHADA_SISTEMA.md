# Análise Detalhada do Sistema — Fabric MES/PCP

**Data:** 01/09/2026
**Stack real confirmada:** Backend Node.js 20 + TypeScript + Express 4 + Prisma 5 + MySQL 8. Frontend Vue 3 + Pinia + Vue Router + TailwindCSS + Chart.js. Autenticação JWT (`jsonwebtoken`) + `bcryptjs`, validação com Joi, `helmet`, rate limiting próprio.
**Escala do código:** 32 controllers, 37 services, 31 grupos de rotas, ~40 models Prisma (1047 linhas de `schema.prisma`), 8 migrations, 44 views `.vue`, 20 stores Pinia.

---

## 1. Arquitetura geral

O layering backend está **acima da média**: nenhum dos 32 controllers importa o Prisma Client diretamente — a separação `route → controller → service → Prisma` é respeitada de ponta a ponta. Nomenclatura por domínio é consistente nas quatro camadas. `server.ts` implementa graceful shutdown correto (SIGTERM/SIGINT, parada de schedulers, disconnect do Prisma).

O problema não é a forma da arquitetura, é a **aplicação desigual das políticas transversais** sobre ela:

- **Validação de entrada**: só 9 dos 32 controllers têm um validator dedicado. 21 dos 31 arquivos de rotas não chamam `validate()` — incluindo `purchase-order`, `stock`, `warehouse` e todo o módulo de contagem.
- **Autorização (RBAC)**: `requirePermission` aparece em apenas 9 dos 31 arquivos de rotas. O restante só tem `authMiddleware` (autenticação), sem checar permissão — detalhado na seção de Segurança.
- **Tratamento de erros**: `error.middleware.ts` define um formato padrão de erro (`AppError`), mas só 7 dos 37 services o usam; os outros 20 lançam `Error` genérico, e vários controllers capturam localmente e respondem sem passar por `next(err)` — o resultado são dois formatos de erro coexistindo na mesma API e regras de negócio (ex: "estoque insuficiente") voltando como HTTP 500 em vez de 400/409.
- **Ruído estrutural**: `stock.service.old.ts` (código morto, sem nenhum import), uma rota de debug `/counting/test-direct` e mounts de rotas envoltos em `try/catch` com `console.log` esquecidos em `routes/index.ts`.
- **Event bus subutilizado**: 4 services emitem eventos, mas `events/listeners.ts` é majoritariamente `console.log` com `// TODO` — infraestrutura assíncrona sem consumidor real.

---

## 2. A questão Vue → React

**Não existe migração em andamento.** É código morto que nunca chegou a rodar:

- `frontend/package.json` não lista `react`, `react-dom` nem `react-router-dom`; nada disso está em `node_modules`.
- `vite.config.ts` só carrega o plugin do Vue — não há `@vitejs/plugin-react`.
- O fluxo real de boot (`index.html` → `main.ts`) monta `App.vue`. `App.tsx` nunca é importado por nenhum arquivo executável.
- **`npm run build` está quebrado hoje** por causa dos arquivos `.tsx` (confirmado rodando `vue-tsc --noEmit`: erros como `Property 'className' does not exist` e `Cannot find module 'react'`).
- Os 8 arquivos `.tsx` reimplementam, como stubs vazios (`useState` sem dados, comentários `// TODO: buscar da API`), funcionalidade que **já existe pronta e em produção em Vue**: o módulo de contagem tem 6 views Vue maduras (~82KB), `counting.store.ts` (Pinia, 28 endpoints ligados), documentado como 100% entregue em `docs/STATUS_FRONTEND_CONTAGEM.md`. O lado React equivalente tem componentes de <800 bytes sem lógica.
- Nenhum documento em `docs/` (~70 arquivos) menciona uma decisão de adotar React. Não há decisão de produto por trás disso — foi um experimento de sessão que ficou no repositório.

**Recomendação (convergente entre os agentes de arquitetura e frontend): remover o código React não integrado.** Não é caso de "continuar módulo a módulo" nem "big-bang", porque não há nada funcionando para continuar. Se React for desejado no futuro, deve ser uma decisão nova e documentada — com dependências instaladas de verdade desde o primeiro commit, começando por um módulo pequeno e isolado.

---

## 3. Integridade de dados e concorrência (o achado mais profundo desta análise)

A auditoria anterior (`ANALISE_FALHAS_SISTEMA.md`, out/2025) identificou race conditions em `counting-item.service.ts` e em `stock.service.ts::reserveForOrder`. Status real hoje:

- **`counting-item.service.ts` (`count`/`recount`): corrigido corretamente.** Toda a operação está dentro de `prisma.$transaction`.
- **`stock.service.ts::reserveForOrder`: corrigido, mas isolado.** A correção protege apenas o caminho de reserva via BOM/produção.
- **`stock.service.ts::registerMovement()`: continua com o bug original.** Esse é o método genérico usado por `registerEntry`, `registerExit`, `adjustStock` e pelo estorno de recebimentos em `purchase-receipt.service.ts::cancel()` — ou seja, a **maior parte** do tráfego real de movimentação de estoque. Ele lê o saldo (`getBalance`) e só depois grava o movimento, sem lock nem transação. Duas requisições concorrentes ainda podem gerar estoque negativo.

**Causa raiz mais profunda:** não existe uma tabela de saldo de estoque persistida (`StockBalance`). O saldo é recalculado em memória, somando **todo o histórico de movimentações do produto**, a cada consulta (`stock.service.ts:108-167`). Isso significa que:
1. É uma operação O(n) que piora com o tempo — sem paginação nem agregação no banco.
2. **Não há uma linha para travar.** Mesmo envolvendo o código em `$transaction`, sem `SELECT ... FOR UPDATE` (Prisma não expõe isso sem raw query) ou um campo `version` para lock otimista, duas transações concorrentes podem ler o mesmo saldo "fantasma" e ambas decidirem que há estoque suficiente.

Esse padrão de escrita sem transação também aparece em:
- `production-pointing.service.ts` (`updateOperationProgress`, `updateOrderProgress`, `updateOperationStatus`, `checkOrderCompletion`) — o caminho de escrita mais crítico do módulo de produção (18KB), sem atomicidade entre apontamento, consumo de material, movimento de estoque e atualização da ordem.
- `purchase-receipt.service.ts` (`updateProductCosts` — cálculo de custo médio ponderado fora de transação; `cancel()` — estorno de estoque roda fora da transação que protege a exclusão do recebimento).

**Nenhum model do Prisma tem campo de controle de concorrência** (`version`) nos agregados mutáveis de maior risco: `ProductionOrder`, `ProductionOrderOperation`, `CountingItem`, `CountingSession`, `PurchaseOrderItem`.

### Outros problemas de schema/banco

- **FK polimórfica inválida**: `StockMovement.reference` é documentado como campo genérico ("ID da OP, Pedido, etc"), mas tem uma foreign key real cravada para `counting_sessions` (`migrations/20251021164739_add_counting_module/migration.sql:101`). Qualquer movimento com `reference` apontando para uma OP ou pedido de compra **viola a constraint**.
- **Drift entre schema e migrations**: `warehouses` e `warehouse_structures` existem no `schema.prisma` mas **nenhuma migration os cria** — em uma base limpa, `migrate deploy` produz um schema incompleto. `counting_plan_products` e `counting_assignments` foram criadas com colunas `snake_case` via SQL manual, mas o schema Prisma declara `camelCase` sem `@map` — o client vai gerar queries contra colunas que não existem.
- **Tipos**: 63 campos monetários/de quantidade usam `Float` (double, impreciso) contra 8 em `Decimal` — o módulo de contagem usa `Decimal` corretamente e deveria ser o padrão replicado. PKs `String @default(uuid())` viram `VARCHAR(191)` (mais pesado em índice) em vez de `CHAR(36)`.
- **Índices compostos faltando** nas tabelas de maior volume: `stock_movements (productId, createdAt)`, `audit_logs (resource, resourceId, createdAt)` (aliás `resourceId` não tem índice nenhum hoje), `production_pointings (operationId, startTime)`, `production_orders (status, scheduledStart)`.
- **Constraints únicas faltando**: `CountingItem` sem unicidade por `(sessionId, productId, locationId)` — permite item duplicado na mesma sessão; `BOMItem` sem unicidade por componente/sequência; `Supplier.document`/`Customer.document` (CNPJ) sem `@unique`.
- **Integridade referencial fraca**: `createdBy`/`approvedBy`/`receivedBy` em ordens de produção e compras são `String` soltas, sem FK para `users`.

---

## 4. Segurança (achado mais grave desta análise)

Stack confirmada: `jsonwebtoken@9`, `bcryptjs@2.4.3`, `joi@17`, `helmet@7`. Prisma parametriza tudo — **nenhuma ocorrência de `$queryRawUnsafe`/`$executeRaw`** foi encontrada (bom sinal). `config/env.ts` valida secrets obrigatórios com tamanho mínimo.

### Crítico

1. **Rotas de usuários, perfis e permissões não verificam permissão** (`user.routes.ts`, `role.routes.ts`, `permission.routes.ts` só têm `authMiddleware`, sem `requirePermission`). Qualquer usuário autenticado pode `POST /api/v1/roles` criando um perfil com todas as permissões e se auto-atribuir via `POST /api/v1/users/:id/roles`. **O RBAC do sistema inteiro é decorativo no seu próprio módulo de administração.**
2. **`POST /auth/register` é público**, sem autenticação. Combinado com o item acima: qualquer pessoa se cadastra, loga, e se promove a administrador sem nenhuma barreira.
3. **`backend/.env.migration` está versionado no git** com `DATABASE_URL` (senha real), `JWT_SECRET` e `JWT_REFRESH_SECRET`. O `.gitignore` cobre `.env`/`.env.local`/`.env.*.local`, mas não esse nome de arquivo.

### Alto

4. Cobertura de RBAC ausente em ~20 módulos além de users/roles/permissions: `stock`, `production-order`, `production-pointing`, `mrp`, `reports`, `bom`, `routing`, `product`, `supplier`, `customer`, `work-center`, `dashboard`, entre outros — qualquer operador autenticado pode escrever nesses recursos.
5. Refresh tokens são JWT stateless de 7 dias sem tabela de armazenamento, rotação ou revogação — o "logout" só retorna 200 sem invalidar nada. `POST /auth/refresh` não tem rate limit.
6. `docker-compose.yml` tem `MYSQL_ROOT_PASSWORD: root123` e `MYSQL_PASSWORD: fabric123` literais, com a porta 3306 exposta no host — mitigado por ser ambiente de dev com `NODE_ENV: development`, mas ainda é risco se replicado sem ajuste.

### Médio

7. Senha mínima de 6 caracteres, sem checagem de complexidade, sem lockout de conta. Rate limiter de login é em memória por processo (não sobrevive a restart nem escala horizontal).
8. Auditoria não cobre login/logout/falha de autenticação (`audit.middleware.ts` exclui explicitamente as rotas de `/auth`). `DELETE /audit-logs/clean` permite apagar a própria trilha de auditoria. IP de auditoria vem de `X-Forwarded-For` sem `trust proxy` configurado — forjável pelo cliente.
9. CORS ignora a variável de ambiente e fixa `localhost:5173/5174/5175` no código — vai quebrar em qualquer deploy real.

---

## 5. Testes automatizados

**Cobertura atual: zero.** `backend/package.json` já declara `jest`, `ts-jest` e scripts de teste, mas não existe nenhum arquivo `.test.ts`/`.spec.ts` em todo o repositório, nem `jest.config.*`. O frontend também não tem `vitest` nem `@vue/test-utils` configurados. Dado que o sistema tem lógica financeira/de estoque crítica (e os bugs de concorrência documentados acima), essa é a rede de segurança que falta antes de mexer em produção, custo e estoque.

---

## 6. UX e dívida técnica de frontend (Vue)

- `WorkCentersView.vue` (a view Vue mais recente, referência de estilo atual) usa `alert()`/`confirm()` nativos em vez do sistema de notificação já existente (`notification.store.ts`), não tem debounce na busca por texto, e o modal não tem focus trap nem fecha com Esc — padrão provavelmente repetido nas outras 43 views.
- Não há gate de CI rodando `build`/`type-check` — isso teria pego o problema do React morto automaticamente antes de chegar ao repositório.

---

## 7. Síntese de riscos por severidade

| Severidade | Quantidade de achados | Áreas |
|---|---|---|
| 🔴 Crítica | 7 | RBAC de administração, registro público, segredo no git, saldo de estoque sem lock, build quebrado, zero testes, escritas de produção sem transação |
| 🟠 Alta | 8 | RBAC geral, refresh token, drift schema/migrations, FK inválida, sem lock otimista, tratamento de erro inconsistente, `Float` para dinheiro, índices faltando |
| 🟡 Média | 8 | Atomicidade parcial em compras, constraints únicas, CORS hardcoded, senha fraca, auditoria incompleta, tipos de PK, UX (alerts/debounce/acessibilidade), listeners sem uso |
| ⚪ Baixa | 4 | Código morto (`stock.service.old.ts`, rotas de debug), normalização de endereço, decisão de stack não documentada, sem CI gate |

O cronograma de correção está em [`02_CRONOGRAMA_IMPLEMENTACOES.md`](./02_CRONOGRAMA_IMPLEMENTACOES.md).
