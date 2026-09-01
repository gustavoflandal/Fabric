# Cronograma — Estabilização e Modernização

**Baseado em:** [`01_ANALISE_DETALHADA_SISTEMA.md`](./01_ANALISE_DETALHADA_SISTEMA.md)
**Início:** 01/09/2026
**Princípio de priorização:** primeiro o que expõe o sistema a risco imediato (acesso indevido, perda de dados, build quebrado), depois o que sustenta qualquer evolução futura com segurança (testes, transações, schema), só depois qualidade/UX/débito técnico de menor impacto.

---

## 🚨 Sprint 0 — Contenção emergencial (dias 1-3, 01-03/09/2026)

Não espera sprint planning. São correções pequenas e isoladas com risco de segurança ativo.

**Status: ✅ concluído em 01/09/2026, branch `sprint-0-seguranca` (aguardando merge em `main`).**

| # | Ação | Área | Esforço | Status |
|---|---|---|---|---|
| 0.1 | Aplicar `requirePermission` em `user.routes.ts`, `role.routes.ts`, `permission.routes.ts` | Segurança | 2-4h | ✅ Feito |
| 0.2 | Fechar `POST /auth/register` (exige `users:create`); removida tela pública de cadastro no frontend | Segurança | 1h | ✅ Feito |
| 0.3 | `.env.migration` removido do git, `.gitignore` corrigido para `.env.*` (exceto `.env.example`), **credenciais rotacionadas** (MySQL root/fabric + ambos JWT secrets, aplicadas ao ambiente rodando) | Segurança | 4h | ✅ Feito |
| 0.4 | Código React morto removido (`App.tsx`, `src/pages/`, `src/features/`) | Frontend | 2-4h | ✅ Feito — `npm run build` segue quebrado por ~30 erros de type-check pré-existentes **não relacionados**, descobertos como efeito colateral (ver commit `ca12cae`); adicionar item novo ao cronograma para tratá-los |
| 0.5 | Removidos `stock.service.old.ts` e a rota de debug `/counting/test-direct` | Limpeza | 1h | ✅ Feito |

**Pendências operacionais pós-Sprint 0** (fora do escopo de código, para quem for aplicar em outros ambientes):
- Aplicar as novas credenciais (MySQL e JWT) em qualquer ambiente além desta máquina de desenvolvimento (produção, CI, outs estações) — os valores antigos vazados no git não devem ser reaproveitados em lugar nenhum.
- Sessões de usuário existentes foram invalidadas pela troca dos JWT secrets (esperado).
- Avaliar se vale reescrever o histórico do git para remover o segredo antigo do commit `14b5294` (não feito aqui por ser uma operação destrutiva separada — ver commit `a6f6dee`).

**Entregável:** sistema sem escalada de privilégio óbvia, sem segredo vazado ativo, com build funcionando.

---

## Fase 1 — Integridade de dados críticos (Semanas 1-3, 08/09 a 26/09/2026)

O núcleo do problema: estoque sem saldo persistido e sem lock.

| # | Ação | Esforço | Status |
|---|---|---|---|
| 1.1 | Desenhar e migrar `StockBalance` (saldo por produto/posição) com campo `version` | 1 semana | ✅ Feito |
| 1.2 | Reescrever `stock.service.ts::getBalance`/`registerMovement` para ler/escrever a linha de saldo dentro de transação com lock otimista | 1 semana | ✅ Feito — testado ao vivo com 5 requisições concorrentes (ver commit) |
| 1.3 | Corrigir FK inválida `stock_movements.reference` → criar `countingSessionId` dedicado e migrar dados | 1-2 dias | ✅ Feito |
| 1.4 | Reconciliar drift schema↔migrations: gerar migration para `warehouses`/`warehouse_structures`, corrigir `snake_case` de `counting_plan_products`/`counting_assignments`, remover migration vazia duplicada | 3-5 dias | ✅ Feito — `prisma migrate diff` confirma zero drift |
| 1.5 | Envolver `production-pointing.service.ts` (apontamento + consumo de material + movimento de estoque + status da OP) em `$transaction` | 1-2 dias | ✅ Feito, com achado adicional: o módulo estava **totalmente inoperante** (schema drift em `workCenterId`/nomes de campo — não só falta de transação). Corrigido por completo, testado ao vivo end-to-end |
| 1.6 | Corrigir atomicidade de `purchase-receipt.service.ts` (`cancel()`, `updateProductCosts()`) | 1 dia | ✅ Feito, com o mesmo tipo de achado adicional do item 1.5: o módulo de recebimentos também estava **totalmente inoperante** (drift `purchaseOrderId`/`orderId`, `quantityReceived`/`acceptedQty`, `req.user.id` inexistente). Corrigido por completo, testado ao vivo end-to-end (criar recebimento → saldo/custo → status do pedido → cancelar → estorno → reversão de status) |

**Entregável:** operações de estoque e produção consistentes sob concorrência; schema íntegro e alinhado às migrations. **Fase 1 concluída em 01/09/2026.**

### Achados novos desta fase, não corrigidos (candidatos a itens futuros do cronograma)

- **Geração de número sequencial insegura**: `purchase-receipt.service.ts` gera `receiptNumber` via `purchaseReceipt.count() + 1` — não é atômico sob concorrência (duas criações simultâneas podem colidir) e reaproveita números após um cancelamento (confirmado ao vivo). O mesmo padrão (`count() + 1` para número de documento) provavelmente se repete em outros services de numeração sequencial (ex: `orderNumber` de `production-order.service.ts`/`purchase-order.service.ts`) — vale uma varredura dedicada em vez de corrigir arquivo por arquivo.
- **Dois módulos sem nenhuma cobertura de frontend**: apontamentos de produção e recebimentos de compra têm backend funcional agora, mas nenhuma tela consome essas APIs. Fica como pendência de produto, não técnica.

---

## Fase 2 — RBAC, validação e autenticação completas (Semanas 4-5, 29/09 a 10/10/2026)

| # | Ação | Esforço | Status |
|---|---|---|---|
| 2.1 | Estender `requirePermission` aos ~20 módulos restantes (stock, production-order, mrp, reports, bom, routing, product, supplier, customer, work-center, dashboard, etc.) | 2 dias | ✅ Feito — 18 arquivos de rotas, testado com admin (200) e usuário sem perfil (403) |
| 2.2 | Ampliar `validators/` para os endpoints hoje sem schema (stock, counting, purchase-receipt, mrp, warehouse) | 2-3 dias | 🟡 Parcial — stock, purchase-receipt, warehouse/warehouse-structure/storage-position feitos. `counting.routes.ts` (28 endpoints) e `mrp.routes.ts` ficaram de fora por escopo |
| 2.3 | Refresh tokens persistidos (tabela com `jti`, hash, expiração, `revokedAt`), rotação no refresh, revogação real no logout | 3 dias | ✅ Feito — testado ao vivo: rotação, reuso rejeitado, logout revoga |
| 2.4 | Rate limit em `/auth/refresh`; senha mínima 12 chars com complexidade; lockout de conta | 1-2 dias | ✅ Feito — testado ao vivo: bloqueio após 5 tentativas (423), senha fraca rejeitada (400) |
| 2.5 | Auditoria cobrindo login/logout/falha de auth; IP não mais forjável; restringir leitura/exclusão de `audit-logs` | 1 dia | ✅ Feito — `trust proxy` deliberadamente **não** habilitado (ver nota abaixo); `getIpAddress` trocado para `req.ip` em vez de headers forjáveis |
| 2.6 | CORS via variável de ambiente (remover hardcode de localhost) | 2h | ✅ Feito |
| 2.7 | Teste de integração/lint customizado que falha o CI se uma rota mutante não tiver `requirePermission` | 1 dia | ⏸️ Adiado — depende da Fase 3 (fundação de testes ainda não existe) |

**Entregável:** toda escrita da API exige a permissão correta; sessão de usuário auditável e revogável. **Fase 2 concluída em 01/09/2026** (itens 2.2 parcial e 2.7 adiado, ver acima).

**Nota sobre `trust proxy`:** a recomendação original era `app.set('trust proxy', 1)`. Na implementação, avaliamos a topologia atual (`docker-compose.yml` — backend exposto direto, sem reverse proxy na frente) e concluímos que habilitar isso SEM um proxy real na frente tornaria o IP mais fácil de forjar, não mais difícil. Optamos por usar `req.ip`/`req.socket.remoteAddress` sem confiar em `X-Forwarded-For`, e deixamos documentado no código para habilitar `trust proxy` se um reverse proxy real for adicionado em produção.

---

## Fase 3 — Fundação de testes automatizados (Semanas 6-7, 13/10 a 24/10/2026)

| # | Ação | Esforço | Status |
|---|---|---|---|
| 3.1 | `backend/jest.config.js` + `docker-compose.test.yml` (MySQL real) + script `test:integration` | 1,5 dia | ✅ Feito |
| 3.2 | Testes de concorrência (2 requisições paralelas) em `stock.service.ts` (`registerMovement`/`reserveForOrder`) | 3 dias | ✅ Feito |
| 3.3 | Testes de concorrência em `counting-item.service.ts` (`count`/`recount`) | 2 dias | ✅ Feito — **achou e corrigiu um bug real** (ver nota abaixo) |
| 3.4 | Suíte unitária `auth.service.ts`/`permission.service.ts` (login, JWT, RBAC) | 1,5 dia | ✅ Feito — a checagem de permissão de fato vive em `permission.middleware.ts`, não em `permission.service.ts` (CRUD puro); testes cobrem os dois |
| 3.5 | Testes de integração via `supertest`: login/RBAC de ponta a ponta, concorrência de estoque via HTTP | 2-3 dias | ✅ Feito (escopo ajustado: contagem/recebimento/MRP concorrentes ficaram para uma leva futura) |
| 3.6 | CI: rodar `build` + `type-check` (backend e frontend) + suíte de testes em todo PR | 1 dia | ✅ Feito |

**Entregável:** rede de segurança mínima nos serviços de maior risco financeiro/operacional, rodando em CI. **Fase 3 concluída em 01/09/2026 — 44 testes automatizados em 8 arquivos, todos passando, rodando em CI a cada push/PR.**

**Achado importante do item 3.3:** o teste de concorrência escrito para `counting-item.service.ts::count()` provou que a correção anterior (um comentário "✅ CORREÇÃO RACE CONDITION" já existente no código, cobrindo só a escrita) era incompleta — duas chamadas `count()` simultâneas no mesmo item conseguiam as duas ter sucesso, a segunda sobrescrevendo a primeira silenciosamente. Mesma classe de bug do `registerMovement()` da Fase 1. Corrigido movendo a leitura+checagem de status para dentro da transação, com `SELECT ... FOR UPDATE`. Isso reforça a lição da Fase 1: comentários "✅ CORREÇÃO" no código não são garantia sem um teste de concorrência real cobrindo.

---

## Fase 4 — Qualidade de dados e performance (Semanas 8-9, 27/10 a 07/11/2026)

| # | Ação | Esforço | Status |
|---|---|---|---|
| 4.1 | Migrar `Float` → `Decimal` em quantidades e custos, por domínio, começando por estoque e compras | 1 semana | ⏸️ Adiado deliberadamente — ver nota abaixo |
| 4.2 | Adicionar `version Int` (lock otimista) em `ProductionOrder`, `ProductionOrderOperation`, `CountingItem`, `CountingSession`, `PurchaseOrderItem` | 1 semana | 🟡 Parcial — coluna em todos os 5 models; checagem de fato (compare-and-swap) só ligada em `production-order.service.ts::update()` por enquanto |
| 4.3 | Índices compostos faltantes (`stock_movements`, `audit_logs`, `production_pointings`, `production_orders`) + constraints únicas faltantes (`CountingItem`, `BOMItem`, `RoutingOperation`, `Supplier.document`, `Customer.document`) | 2-3 dias | ✅ Feito |
| 4.4 | Padronizar tratamento de erros: `AppError` em todos os services, remover `try/catch` locais nos controllers em favor de `next(err)`/`asyncHandler` | 2-3 dias | ✅ Feito — 18 services + 7 controllers, confirmado ao vivo (`Estoque insuficiente` agora 400, não mais 500) |
| 4.5 | FKs de auditoria: `createdBy`/`approvedBy`/`receivedBy` apontando para `users` | 1 dia | ✅ Feito |

**Entregável:** dados financeiros/de estoque com precisão correta, sem writes concorrentes perdidos, API com contrato de erro único. **Fase 4 concluída em 01/09/2026** (exceto 4.1, adiado deliberadamente, e 4.2 parcial — ambos com justificativa acima).

**Nota sobre o item 4.1 (adiado):** é o item de maior risco de todo o cronograma até aqui. Trocar `Float` por `Decimal` não é só uma migration de schema - exige reescrever a aritmética em todo lugar que lê/escreve esses campos (Prisma `Decimal` não aceita `+`/`-`/`*` direto como `number`, precisa de `.plus()`/`.minus()`/conversão explícita), e a serialização JSON de `Decimal` é uma STRING por padrão, não um número - qualquer frontend que hoje espera um `number` desses campos (ex: `ProductsView.vue`, exibição de custos) quebraria silenciosamente sem uma revisão cuidadosa de cada consumidor. Diferente dos outros itens desta fase, isso não é seguro de fazer em escopo reduzido "só para testar" - fazer errado é pior do que não fazer. Recomendação: tratar como uma fase própria, focada, com tempo para revisar cada consumidor (frontend e services) por domínio, começando por `Product.standardCost/lastCost/averageCost` e os campos de `PurchaseOrder`/`PurchaseOrderItem`.

---

## Fase 5 — Débito técnico e UX (Semana 10, 10-14/11/2026)

| # | Ação | Esforço | Status |
|---|---|---|---|
| 5.1 | Trocar `alert()`/`confirm()` por `notification.store`/modal padronizado, começando por `WorkCentersView.vue` e auditando as demais 43 views | 2-3 dias | ✅ Feito — 25 de 27 arquivos (os outros 2 eram falso positivo); infraestrutura nova (`useToast`, `useConfirm`, `ToastContainer`, `ConfirmDialogContainer`); testado com Playwright ao vivo |
| 5.2 | Debounce padronizado em campos de busca (componente/composable reutilizável) | 1 dia | ✅ Feito — `useDebounce`, aplicado em 11 arquivos |
| 5.3 | Auditoria básica de acessibilidade (labels, focus trap, `aria-label`) nas views mais usadas | 2 dias | 🟡 Parcial — `WorkCentersView.vue` (a view citada na auditoria original) totalmente corrigida; as outras 43 views ficam para uma leva dedicada, usando esse commit como padrão |
| 5.4 | Decidir formalmente e documentar em `docs/` o futuro do frontend | 0,5 dia (decisão) | ✅ Feito — `03_DECISAO_STACK_FRONTEND.md` |
| 5.5 | `events/listeners.ts`: decidir se os 4 eventos emitidos ganham consumidores reais ou se a infraestrutura é removida | 1-2 dias | ✅ Feito — decisão: manter como está; achado e corrigido um bug real (2 dos listeners nunca gravavam por causa de um campo inexistente) |
| 5.6 | Normalização de endereço duplicado entre `Supplier`/`Customer`/`Warehouse`; política de retenção/particionamento de `audit_logs` | 2-3 dias | 🟡 Parcial — retenção já existia (job diário, 90 dias), só faltava ser configurável (feito). Particionamento e normalização de endereço adiados com justificativa |

**Entregável:** UX consistente, decisão de stack registrada, dívida técnica residual reduzida. **Fase 5 concluída em 01/09/2026** (5.3 e 5.6 parciais, com justificativa e escopo do que falta documentados acima).

**Cronograma original de 5 fases: completo.** As seis pendências parciais/adiadas ao longo de todas as fases (Float→Decimal, lock otimista nos 4 models restantes, auditoria de acessibilidade nas 43 views restantes, particionamento de audit_logs, normalização de endereço, validators de counting/mrp) ficam documentadas nos respectivos itens acima como candidatas a uma Fase 6, caso o time queira continuar.

---

## 📊 Resumo executivo

| Fase | Período | Duração | Foco principal |
|---|---|---|---|
| Sprint 0 | 01-03/09/2026 | 3 dias | Contenção de segurança e build quebrado |
| Fase 1 | 08-26/09/2026 | 3 semanas | Integridade de estoque/produção (saldo persistido + transações) |
| Fase 2 | 29/09-10/10/2026 | 2 semanas | RBAC e autenticação completas |
| Fase 3 | 13-24/10/2026 | 2 semanas | Fundação de testes automatizados + CI |
| Fase 4 | 27/10-07/11/2026 | 2 semanas | Precisão de dados (Decimal), lock otimista, performance |
| Fase 5 | 10-14/11/2026 | 1 semana | Débito técnico, UX, decisão de stack frontend |
| **Total** | **01/09 a 14/11/2026** | **~11 semanas** | **Sistema estabilizado e seguro para retomar features novas** |

### Regra de sequenciamento
As fases 1-2 não devem ser paralelizadas com desenvolvimento de features novas no mesmo módulo (estoque, produção, usuários/permissões) — mexer em transação/RBAC ao mesmo tempo que alguém adiciona campos novos nesses services é a receita para reabrir os mesmos bugs. Fases 3-5 podem correr em paralelo com features novas em módulos não tocados (ex: manutenção, qualidade, indicadores do roadmap original em `docs/06_ROADMAP_IMPLEMENTACAO.md`).

### Depois desta fase
Com o núcleo estabilizado, retomar o roadmap de negócio já existente (`docs/PLANO_TRABALHO.md` — Roteiros, Ordens de Produção, Apontamentos, Dashboards) com a base de testes e transações da Fase 1-3 como rede de segurança, em vez de continuar empilhando módulos sobre os mesmos gaps.
