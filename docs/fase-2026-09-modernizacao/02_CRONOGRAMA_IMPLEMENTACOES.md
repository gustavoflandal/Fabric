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
- Aplicar as novas credenciais (MySQL e JWT) em qualquer ambiente além desta máquina de desenvolvimento (produção, CI, outras estações) — os valores antigos vazados no git não devem ser reaproveitados em lugar nenhum.
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
| 1.6 | Corrigir atomicidade de `purchase-receipt.service.ts` (`cancel()`, `updateProductCosts()`) | 1 dia | 🚧 Em andamento |

**Entregável:** operações de estoque e produção consistentes sob concorrência; schema íntegro e alinhado às migrations.

---

## Fase 2 — RBAC, validação e autenticação completas (Semanas 4-5, 29/09 a 10/10/2026)

| # | Ação | Esforço |
|---|---|---|
| 2.1 | Estender `requirePermission` aos ~20 módulos restantes (stock, production-order, mrp, reports, bom, routing, product, supplier, customer, work-center, dashboard, etc.) | 2 dias |
| 2.2 | Ampliar `validators/` para os endpoints hoje sem schema (stock, counting, purchase-receipt, mrp, warehouse) | 2-3 dias |
| 2.3 | Refresh tokens persistidos (tabela com `jti`, hash, expiração, `revokedAt`), rotação no refresh, revogação real no logout | 3 dias |
| 2.4 | Rate limit em `/auth/refresh`; senha mínima 12 chars com complexidade; lockout de conta | 1-2 dias |
| 2.5 | Auditoria cobrindo login/logout/falha de auth; `app.set('trust proxy', 1)`; restringir/remover `DELETE /audit-logs/clean` | 1 dia |
| 2.6 | CORS via variável de ambiente (remover hardcode de localhost) | 2h |
| 2.7 | Teste de integração/lint customizado que falha o CI se uma rota mutante não tiver `requirePermission` (evita regressão dos itens 0.1/2.1) | 1 dia |

**Entregável:** toda escrita da API exige a permissão correta; sessão de usuário auditável e revogável.

---

## Fase 3 — Fundação de testes automatizados (Semanas 6-7, 13/10 a 24/10/2026)

| # | Ação | Esforço |
|---|---|---|
| 3.1 | `backend/jest.config.ts` + `docker-compose.test.yml` (MySQL real) + script `test:integration` | 1,5 dia |
| 3.2 | Testes de concorrência (2 requisições paralelas) em `stock.service.ts` (`registerMovement`/`reserveForOrder`) | 3 dias |
| 3.3 | Testes de concorrência em `counting-item.service.ts` (`count`/`recount`) | 2 dias |
| 3.4 | Suíte unitária `auth.service.ts`/`permission.service.ts` (login, JWT, RBAC) | 1,5 dia |
| 3.5 | Testes de integração via `supertest`: login, movimentação de estoque concorrente, contagem concorrente, recebimento parcial de compra, execução de MRP | 2-3 dias |
| 3.6 | CI: rodar `build` + `type-check` (backend e frontend) + suíte de testes em todo PR | 1 dia |

**Entregável:** rede de segurança mínima nos serviços de maior risco financeiro/operacional, rodando em CI.

---

## Fase 4 — Qualidade de dados e performance (Semanas 8-9, 27/10 a 07/11/2026)

| # | Ação | Esforço |
|---|---|---|
| 4.1 | Migrar `Float` → `Decimal` em quantidades e custos, por domínio, começando por estoque e compras | 1 semana |
| 4.2 | Adicionar `version Int` (lock otimista) em `ProductionOrder`, `ProductionOrderOperation`, `CountingItem`, `CountingSession`, `PurchaseOrderItem` | 1 semana |
| 4.3 | Índices compostos faltantes (`stock_movements`, `audit_logs`, `production_pointings`, `production_orders`) + constraints únicas faltantes (`CountingItem`, `BOMItem`, `RoutingOperation`, `Supplier.document`, `Customer.document`) | 2-3 dias |
| 4.4 | Padronizar tratamento de erros: `AppError` em todos os services, remover `try/catch` locais nos controllers em favor de `next(err)`/`asyncHandler` | 2-3 dias |
| 4.5 | FKs de auditoria: `createdBy`/`approvedBy`/`receivedBy` apontando para `users` | 1 dia |

**Entregável:** dados financeiros/de estoque com precisão correta, sem writes concorrentes perdidos, API com contrato de erro único.

---

## Fase 5 — Débito técnico e UX (Semana 10, 10-14/11/2026)

| # | Ação | Esforço |
|---|---|---|
| 5.1 | Trocar `alert()`/`confirm()` por `notification.store`/modal padronizado, começando por `WorkCentersView.vue` e auditando as demais 43 views | 2-3 dias |
| 5.2 | Debounce padronizado em campos de busca (componente/composable reutilizável) | 1 dia |
| 5.3 | Auditoria básica de acessibilidade (labels, focus trap, `aria-label`) nas views mais usadas | 2 dias |
| 5.4 | Decidir formalmente e documentar em `docs/` o futuro do frontend: permanecer 100% Vue, ou reabrir React como decisão de arquitetura nova (módulo piloto isolado, dependências reais desde o commit zero) | 0,5 dia (decisão) |
| 5.5 | `events/listeners.ts`: decidir se os 4 eventos emitidos ganham consumidores reais ou se a infraestrutura é removida | 1-2 dias |
| 5.6 | Normalização de endereço duplicado entre `Supplier`/`Customer`/`Warehouse`; política de retenção/particionamento de `audit_logs` | 2-3 dias |

**Entregável:** UX consistente, decisão de stack registrada, dívida técnica residual reduzida.

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
