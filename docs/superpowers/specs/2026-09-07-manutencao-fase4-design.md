# Manutenção (Fase 4, subsistema 1 de 3)

**Data:** 2026-09-07
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** primeira entrega do módulo — cadastro de equipamentos, planos preventivos por calendário, ordens de serviço (preventivas geradas automaticamente + corretivas manuais), indicadores MTBF/MTTR, notificações de atraso, RBAC e nova aba no Dashboard. Fora de escopo: manutenção baseada em uso/horas de operação, integração automática com Ordens de Produção.

## Contexto e motivação

O roadmap original do projeto (`docs/06_ROADMAP_IMPLEMENTACAO.md`) previa uma Fase 4 — Manutenção, Qualidade, Indicadores/Relatórios — que nunca foi iniciada: não existe no schema nenhum model `Equipment`/`MaintenancePlan`/`MaintenanceOrder`. Este spec cobre o primeiro dos três subsistemas dessa fase, escolhido por ter a menor dependência cruzada com o resto do sistema (reaproveita `WorkCenter` já existente como agrupador, mas não precisa de nada de Qualidade ou do motor de Indicadores para funcionar).

## Abordagens consideradas

**Relação Equipment ↔ WorkCenter:**

- **A — Equipment pertence a um WorkCenter, N:1 (escolhida).** Cada equipamento (uma máquina física específica) referencia um `WorkCenter` (o agrupamento lógico de capacidade produtiva). Um Centro de Trabalho "Usinagem" pode ter 3 tornos cadastrados como `Equipment` distintos. Reaproveita o `WorkCenter` já existente sem duplicar conceito.
- **B — Equipment substitui WorkCenter.** Rejeitada: assumiria que cada Centro de Trabalho é uma única máquina física, o que não é verdade hoje (há centros que agrupam várias máquinas).
- **C — Equipment sem vínculo com WorkCenter.** Rejeitada por ora: perderia a rastreabilidade "este centro de trabalho está com capacidade reduzida porque 2 dos 3 tornos estão em manutenção", que é o caso de uso mais direto de MTBF/MTTR para o PCP.

**Gatilho de manutenção preventiva:**

- **A — Só por calendário, intervalo em dias (escolhida).** Mesmo padrão já usado em `CountingPlan` (contagem cíclica) e no `NotificationSchedulerService` (cron). Não exige nenhum mecanismo novo de apontamento de uso do equipamento.
- **B — Calendário + uso (horas/ciclos).** Rejeitada nesta entrega: exigiria criar do zero um mecanismo de apontamento de horas de operação por equipamento, que não existe em nenhuma parte do sistema hoje (`ProductionPointing` registra tempo do operador, não do equipamento). Pode ser adicionado como extensão futura sem quebrar o modelo desta fase — bastaria adicionar campos opcionais de gatilho por uso ao `MaintenancePlan`.

**Acoplamento com Ordens de Produção:**

- **A — Sem interação automática (escolhida).** Abrir uma corretiva não pausa nem altera nenhuma `ProductionOrder`. Quem opera decide manualmente.
- **B — Pausa/alerta automático na OP afetada.** Rejeitada nesta entrega: exigiria integração bidirecional entre dois módulos grandes (Manutenção e PCP) na primeira entrega. Fica como extensão futura natural, já que `Equipment.workCenterId` e `ProductionOrderOperation.workCenterId` já compartilham a mesma chave de correlação (`WorkCenter`) — a integração futura não exige mudança de modelo, só uma nova regra de negócio em cima do que já existe aqui.

## Desenho

### 1. Schema Prisma (3 models novos)

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

  workCenter WorkCenter        @relation(fields: [workCenterId], references: [id])
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
  id                 String                  @id @default(uuid())
  equipmentId        String
  planId             String?
  type               MaintenanceOrderType
  status             MaintenanceOrderStatus  @default(PENDING)
  problemDescription String?
  resolutionNotes    String?
  assignedTo         String?
  createdAt          DateTime                @default(now())
  startedAt          DateTime?
  completedAt        DateTime?

  equipment Equipment       @relation(fields: [equipmentId], references: [id])
  plan      MaintenancePlan? @relation(fields: [planId], references: [id])
  assignee  User?           @relation(fields: [assignedTo], references: [id])

  @@map("maintenance_orders")
}
```

- `WorkCenter` ganha a relação inversa `equipment Equipment[]`.
- `User` ganha a relação inversa `maintenanceOrders MaintenanceOrder[]`.
- `planId` nulo identifica uma ordem corretiva; preenchido, uma preventiva gerada a partir daquele plano — mesma convenção já usada em `WarehouseTask.reference`/`referenceType` para diferenciar origem sem precisar de uma segunda tabela.

### 2. Backend — CRUD de Equipment e MaintenancePlan

Padrão idêntico ao já usado para `WorkCenter`/`Supplier` (service + controller + routes, `requirePermission('manutencao', 'gerenciar')` para criar/editar/excluir, `requirePermission('manutencao', 'visualizar')` para leitura). `MaintenancePlan.nextDueDate` é calculado automaticamente na criação (`hoje + frequencyDays`, salvo se o formulário informar uma data inicial explícita).

### 3. Backend — `MaintenanceOrderService`

- `create(type, equipmentId, problemDescription, planId?)`: cria a ordem. Para corretivas (`planId` ausente), `type` é sempre `CORRECTIVE`.
- `start(orderId)`: `status → IN_PROGRESS`, `startedAt = now()`. Rejeita se a ordem não estiver `PENDING`.
- `complete(orderId, resolutionNotes)`: `status → COMPLETED`, `completedAt = now()`. Rejeita se não estiver `IN_PROGRESS`.
- `cancel(orderId, reason)`: `status → CANCELLED`. Permitido a partir de `PENDING` ou `IN_PROGRESS`.
- `assignedTo` é opcional e não tem transição de estado própria: é definido na criação (`create`) ou alterado por uma edição simples (`update(orderId, { assignedTo })`), sem exigir uma ação dedicada — uma ordem pode ficar sem responsável definido até alguém assumir.
- RBAC: criar/cancelar/atribuir exige `manutencao:gerenciar`; iniciar/concluir exige `manutencao:executar` (o time de manutenção executa, mas não necessariamente cadastra planos).

### 4. Job agendado — geração automática de ordens preventivas

Novo arquivo `backend/src/jobs/maintenance-scheduler.ts`, registrado junto aos jobs já existentes (mesmo padrão de `counting-scheduler.ts`). Roda diariamente (`0 6 * * *`, mesmo horário do job de validade de lote já existente, para não competir com os jobs de minuto-a-minuto):

1. Busca todo `MaintenancePlan` com `active = true` e `nextDueDate <= now()`.
2. Para cada um, verifica se já existe uma `MaintenanceOrder` com aquele `planId` em status `PENDING` ou `IN_PROGRESS` — se sim, pula (evita duplicar ordem enquanto a anterior não foi resolvida).
3. Caso contrário, cria uma nova `MaintenanceOrder` (`type: PREVENTIVE`, `status: PENDING`, `planId` preenchido) e avança `nextDueDate` do plano em `frequencyDays` a partir do `nextDueDate` anterior (não a partir de `now()`, para não acumular atraso silenciosamente a cada execução perdida — mesmo raciocínio de calendário fixo, não relativo à execução).

### 5. Indicadores MTBF/MTTR (`maintenance-kpi.service.ts`)

Mesmo padrão de cálculo por delta de timestamp já usado em `wms-kpi.service.ts`:

- **MTTR** (horas): para um equipamento (ou geral), média de `completedAt - startedAt` entre as `MaintenanceOrder` com `status = COMPLETED` no período selecionado, `startedAt`/`completedAt` não nulos.
- **MTBF** (horas): para um equipamento, ordena as `MaintenanceOrder` do tipo `CORRECTIVE` por `createdAt` e calcula a média dos intervalos entre `createdAt` consecutivos. Exige pelo menos 2 corretivas no histórico daquele equipamento para produzir um valor (equipamento com 0 ou 1 corretiva não tem MTBF — não é `0`, é "sem dado suficiente ainda", exibido como `null`/traço na UI, nunca como zero).
- **Taxa de cumprimento do preventivo**: `% de MaintenancePlan cujo nextDueDate atual está no futuro` sobre o total de planos ativos (proxy simples de "quantos planos não estão atrasados agora").
- **Ordens abertas por status/tipo**: contagem agrupada, mesmo padrão de `volumeStatus.byTypeAndStatus` do WMS.

Endpoint único `GET /maintenance/kpis` (RBAC `manutencao:visualizar`), agregando os 4 números acima — mesma decisão de "um endpoint por fonte de dados compartilhada" já usada no dashboard de KPIs do WMS.

### 6. Notificações

Novo método `notificationDetector.detectOverdueMaintenance()`, chamado a partir do `NotificationSchedulerService` no job de 5 em 5 minutos já existente (junto com `detectProductionDelays`/`detectBottlenecks`). Considera atrasada uma `MaintenanceOrder` `PENDING`/`IN_PROGRESS` cujo `createdAt` é anterior a `now() - limiar`, onde o limiar vem de uma nova chave `SystemSetting` (`manutencao.ordem_atraso_horas`, default 48h) — mesmo padrão de `wms.task_delay_threshold_hours`.

### 7. RBAC

Novo recurso `manutencao` com 3 ações: `visualizar`, `executar`, `gerenciar`. Nova permissão de módulo `modules.view_manutencao` (mesmo padrão de `modules.view_wms`), concedida por padrão a ADMIN/MANAGER, seguindo o mesmo critério já usado para os módulos existentes.

### 8. Frontend

- Nova aba "Manutenção" no `DashboardView.vue` (mesmo padrão de WMS/YMS: `v-if="authStore.canViewManutencao"`, cards de navegação).
- `EquipmentListView.vue` — CRUD via `DataTable.vue` (código, nome, centro de trabalho, fabricante/modelo, ativo).
- `MaintenancePlanListView.vue` — CRUD via `DataTable.vue` (equipamento, nome, frequência em dias, próxima data, ativo).
- `MaintenanceOrderListView.vue` — listagem via `DataTable.vue` com filtro por status/tipo, e ações Iniciar/Concluir/Cancelar inline (mesmo padrão de `OperationsPanelView.vue` do WMS).
- `MaintenanceKpiDashboardView.vue` — mesmo padrão visual/estrutural de `WmsKpiDashboardView.vue` (cards de MTTR/MTBF/taxa de cumprimento + tabela de ordens abertas), já nascendo com suporte a dark mode (`dark:` classes desde o primeiro commit, usando a receita documentada no spec do dark mode — não é retrofit posterior).

## Fora de escopo desta fase

- Manutenção preditiva ou por uso/horas de operação (fica documentado como extensão futura no próprio schema, sem mudança de modelo necessária).
- Integração automática entre corretivas e Ordens de Produção (pausar/alertar).
- Checklist estruturado de tarefas por plano (a entrega atual usa só `description` livre) — se necessário no futuro, vira uma tabela `MaintenancePlanTask` sem quebrar o modelo atual.
- Anexos/fotos nas ordens de serviço.

## Testes

- Backend: `equipment.service.test.ts`, `maintenance-plan.service.test.ts` — CRUD + validação (equipmentId/workCenterId existentes, frequencyDays > 0).
- Backend: `maintenance-order.service.test.ts` — transições de status válidas/inválidas (não pode concluir uma ordem `PENDING`, não pode iniciar uma já `COMPLETED`), corretiva sempre com `planId` nulo.
- Backend: `maintenance-scheduler.test.ts` — plano vencido gera ordem; plano vencido com ordem `PENDING` já aberta não duplica; `nextDueDate` avança a partir do valor anterior, não de `now()`.
- Backend: `maintenance-kpi.service.test.ts` — MTTR/MTBF calculados corretamente a partir de fixtures com timestamps controlados (mesmo padrão de fixture usado em `wms-kpi.service.test.ts`); equipamento com <2 corretivas retorna MTBF nulo, não zero.
- Backend: `notification-detector.test.ts` (extensão) — `detectOverdueMaintenance()` dispara para ordem além do limiar configurado, respeita o valor de `SystemSetting`.
- Frontend: specs para as 4 views novas seguindo o padrão já estabelecido (mock de service, RBAC, DataTable) — sem necessidade de teste E2E nesta fase.
- Verificação manual (real, não só testes): criar um equipamento, um plano com `frequencyDays` pequeno e `nextDueDate` no passado, confirmar que o job gera a ordem preventiva; abrir uma corretiva manual, executar o ciclo iniciar→concluir, confirmar que aparece no dashboard de KPIs.
