# 🗺 Fabric - Roadmap de Implementação

> **Atualizado em 2026-09-07** para refletir o estado real do projeto. A versão anterior deste documento era o plano original de início de projeto — os checkboxes nunca foram marcados durante a implementação, então o documento não acompanhava a realidade. Este status foi verificado contra o código (schema Prisma, rotas do backend, views do frontend), não contra memória ou suposição.

## 📋 Visão Geral

Plano original de implementação em 4 fases. As Fases 1-3 estão completas e, em vários pontos, foram entregues com escopo bem maior do que o originalmente previsto (WMS completo em vez de controle de estoque simples). A Fase 4 (Manutenção, Qualidade, Indicadores/Relatórios) é a única fase que ainda não foi iniciada.

---

## 🎯 Fase 1: Infraestrutura e Base — ✅ COMPLETA

### Backend
- [x] Estrutura de pastas, TypeScript + Express, Prisma ORM, MySQL, variáveis de ambiente, middleware de erro, Winston, ESLint/Prettier
- [x] Schema Prisma: `User`, `Role`, `Permission`, `RolePermission`, `UserRole` — RBAC granular por recurso+ação, mais completo que o "Schema: User, Role, Permission" originalmente previsto
- [x] `AuthService`/`AuthController`, rotas `/auth/*`, middleware JWT, bcrypt, refresh token (`RefreshToken`, com rotação a cada uso)

### Frontend
- [x] Vue 3 + Vite + TypeScript + TailwindCSS + Vue Router + Pinia
- [x] Layout base (`AppLayout.vue`, compartilhado por ~26+ views)
- [x] `authStore`, `authService`, views de Login/Registro, route guards, interceptor Axios
- [x] Tema claro/escuro — implementado em 2026-09-07 (Fase 1 do dark mode: infraestrutura + Dashboard + KPIs do WMS + `DataTable.vue`; retrofit das demais telas fica para lotes futuros)

### Cadastros básicos
- [x] `WorkCenter`, `Supplier`, `Customer`, `UnitOfMeasure` — CRUD completo, back+front
- [ ] `Shift` (turnos) e `Calendar` (calendário de produção) — únicos itens desta fase que **não foram implementados**; não bloqueiam capacidade de uso hoje, mas são pré-requisito natural para cálculos de capacidade mais precisos (turnos/feriados) caso isso vire prioridade

### DevOps
- [x] Docker + Docker Compose, Git/GitHub, scripts npm, documentação técnica

---

## 🔧 Fase 2: Engenharia e Planejamento — ✅ COMPLETA

### Produtos e BOMs
- [x] `Product`, `ProductCategory`, `BOM`, `BOMItem` — CRUD + explosão multinível, back+front (`BOMTree`, `BOMEditor`)

### Roteiros de Fabricação
- [x] `Routing`, `RoutingOperation` — cálculo de lead time e capacidade necessária

### MRP
- [x] `MRPService` — explosão de BOM, cálculo de necessidades, geração de sugestões, views de execução/resultados
- **Diferença do plano original**: implementado como cálculo sob demanda (stateless), sem persistir cada execução em tabelas `MRPRun`/`MRPRequirement` — simplificação deliberada, não uma lacuna funcional (o resultado do MRP é sempre recalculado a partir do estado atual, não há necessidade de histórico de execuções até hoje)

---

## 🏭 Fase 3: Execução e Controle — ✅ COMPLETA E EXPANDIDA

O escopo real entregue aqui foi muito além do previsto: em vez de um controle de estoque simples, o projeto evoluiu para um **WMS (Warehouse Management System) completo**, que não existia como conceito no roadmap original.

### Gestão de Estoque (original) → WMS completo (entregue)
- [x] `Lot`, `StockBalance`, `StockMovement` — rastreabilidade por lote, movimentações
- [x] **Além do previsto**: `Warehouse`, `WarehouseStructure`, `StoragePosition`, `StorageRule`, `StockPositionBalance` — estrutura hierárquica de armazém com posições e regras de armazenagem
- [x] **Além do previsto**: `WorkflowTemplate`/`WorkflowNode`/`WorkflowEdge` — workflows dinâmicos de operação do armazém, editor visual (drag-and-drop)
- [x] **Além do previsto**: `WarehouseTask` — tarefas de armazém (descarga, conferência, alocação, quarentena etc.), painel operacional de acompanhamento
- [x] **Além do previsto**: `ReceiptPutaway` — recebimento com leitura de NFe, impressão de movimentação
- [x] Dashboard de KPIs do WMS (volume/status, tempo de ciclo, produtividade, gargalos, ocupação) — não estava no plano original, construído organicamente

### Inventário (original) → Contagem cíclica completa (entregue)
- [x] `CountingPlan`, `CountingSession`, `CountingItem`, `CountingPlanProduct`, `CountingAssignment` — plano de contagem, sessões, atribuições, ajustes de estoque

### PCP e Produção
- [x] `ProductionOrder`, `ProductionOrderOperation`, `ProductionPointing` — geração/liberação de OPs, apontamento, consumo de materiais, dashboard de produção (`PCPDashboardView`)

### Compras
- [x] `PurchaseQuotation`, `PurchaseOrder`, `PurchaseReceipt` (+ items) — orçamentos, pedidos, recebimento de materiais integrado ao WMS

---

## 📈 Fase 4: Apoio e Qualidade — ❌ NÃO INICIADA

Esta é a única fase do plano original que ainda não tem nenhum código associado. Verificado diretamente no schema Prisma: não existe nenhum model `Equipment`, `MaintenancePlan`, `MaintenanceOrder`, `InspectionPlan`, `QualityInspection`, `NonConformity`, `KPI` ou `KPIValue`.

### Manutenção — não iniciado
- [ ] `Equipment`, `MaintenancePlan`, `MaintenanceOrder`
- [ ] Planos preventivos, ordens de serviço
- [ ] Indicadores MTBF/MTTR
- [ ] Views: Equipamentos, Manutenção, calendário de manutenção, dashboard

### Qualidade — não iniciado (existe apenas um proxy parcial)
- [ ] `InspectionPlan`, `QualityInspection`, `NonConformity`
- [ ] Planos de inspeção, registro de inspeções, não-conformidades, ações corretivas, certificados
- **O que já existe, mas não é o mesmo módulo**: `GET /reports/quality` calcula uma taxa de refugo (%) a partir dos apontamentos de produção (`ProductionPointing`) — é uma métrica derivada, não um fluxo de inspeção/não-conformidade. Útil como ponto de partida, mas não substitui o módulo.

### Indicadores e Relatórios — parcialmente coberto por dashboards ad-hoc, sem o motor genérico previsto
- [ ] `KPI`, `KPIValue`, `Report` (modelo genérico de indicadores configuráveis)
- [ ] Exportação PDF/Excel — não existe hoje (os relatórios atuais são só JSON consumido pelo frontend)
- **O que já existe, cobrindo parte do objetivo**: `ReportsService` (produção, eficiência, qualidade-proxy, centros de trabalho, consolidado), `PCPDashboardView`, dashboard de KPIs do WMS — todos construídos como necessidade pontual de cada módulo, não como um motor de indicadores reutilizável e configurável

---

## ✨ Entregas fora do roadmap original

Funcionalidades completas que não estavam previstas em nenhuma das 4 fases originais:

- **Sistema de Notificações** — `Notification`, `NotificationRule`, `NotificationPreference`, central de notificações, sino com dropdown, agendamentos automáticos (ordens atrasadas, níveis de estoque, capacidade ociosa)
- **Logs de Auditoria** — `AuditLog`, modo configurável (write-only vs. all+reads), retenção configurável
- **Licenciamento de Módulos** — `LicensedModule`, permite habilitar/desabilitar módulos (ex.: WMS) por instalação
- **Configurações do Sistema** — `SystemSetting`, cache com fallback para `.env`, painel de configuração
- **Assistente de IA** — RAG sobre manuais do sistema (Ollama + ChromaDB) na Fase 1, e consultas de estoque em tempo real via tool calling (saldo, movimentações, posição por categoria) na Fase 2, com guardrails contra vazamento de prompt e RBAC dedicado (`stock:read`)
- **Dark Mode** — Fase 1 (infraestrutura + Dashboard + KPIs do WMS + `DataTable.vue`), retrofit das demais ~50 telas fica para lotes futuros

---

## 📊 Cronograma Resumido (atualizado)

| Fase | Status | Observação |
|------|--------|------------|
| **Fase 1** | ✅ Completa | Falta apenas `Shift`/`Calendar` (não bloqueante) |
| **Fase 2** | ✅ Completa | MRP sem persistência de execuções (simplificação aceita) |
| **Fase 3** | ✅ Completa e expandida | Virou um WMS completo, muito além do previsto |
| **Fase 4** | ❌ Não iniciada | Manutenção e Qualidade em 0%; Indicadores parcialmente coberto por dashboards ad-hoc |
| *(fora do plano)* | ✅ Entregue | Notificações, Auditoria, Licenciamento, Configurações, Assistente de IA, Dark Mode (parcial) |

---

## 🎯 Próximos Passos (para "finalização e entrega" segundo o plano original)

1. **Decidir se a Fase 4 ainda é prioridade como originalmente escopada** — Manutenção e Qualidade são módulos grandes e isolados do resto do sistema; vale um brainstorm dedicado antes de planejar.
2. Se sim: começar pelo menor dos três (tipicamente Manutenção, por ter menos dependência cruzada com módulos existentes) via `superpowers:brainstorming` → spec → plano → `subagent-driven-development`, mesmo padrão usado em todo o projeto até aqui.
3. Itens pequenos e independentes que podem ser resolvidos a qualquer momento, sem esperar a Fase 4: `Shift`/`Calendar` (Fase 1), retrofit das ~50 telas restantes do dark mode.
4. Se a resposta for "não, o escopo real do projeto já é outro" — vale reescrever a Visão Geral (`01_VISAO_GERAL.md`) e este roadmap para descrever o sistema como ele é hoje (PCP + WMS + IA), em vez de manter Manutenção/Qualidade como uma fase pendente indefinidamente.

---

## 📝 Observações

- Seguir os mesmos padrões já estabelecidos: TDD, revisão por task + revisão final de branch inteira em modelo mais capaz, commits convencionais
- Testes automatizados como rede de segurança (backend: suites Jest; frontend: Vitest) — não há meta formal de cobertura definida, mas toda feature nova até aqui manteve os testes existentes verdes
- CI do GitHub está falhando desde 2026-09-02 por divergência entre o `tsconfig` mais estrito do CI e o usado localmente (~70 erros pré-existentes, não bloqueia merges hoje) — vale resolver antes de qualquer "entrega" formal
- Deploy incremental por fase (mantido do plano original)
