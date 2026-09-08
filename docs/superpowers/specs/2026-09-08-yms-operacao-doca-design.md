# YMS — Operação de Doca (Carga/Descarga, Checkout)

**Data:** 2026-09-08
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** 4 de 5 do YMS (depende das Etapas 1 — Cadastros Base —, 2 — Agendamento + Check-in — e 3 — Pátio — estarem implementadas: consome `YardDock.serviceType` da Etapa 1 e estende `YardVisit` das Etapas 2/3)

## 0. Contexto e origem

Quarta etapa do YMS, decomposta do documento de referência `YMS Gestão de Pátio.pdf`. Cobre os Steps 3 ("Doca — Operação") e 4 ("Liberação — Checkout") da seção 4 do documento — a última parte do ciclo de vida de uma visita, que termina onde o documento descreve a jornada completa do veículo.

## 1. Decisões de escopo (confirmadas com o usuário)

- **"Chamada automática de veículos" continua fora de escopo.** Mesmo motivo da Etapa 3: é uma automação (fila, prioridade, notificação) construída EM CIMA do status de doca que esta etapa entrega — merece seu próprio ciclo de spec depois que o básico estiver validado na prática, não antecipada aqui.
- **Status de doca (OC/DP) é derivado, nunca persistido.** Uma doca está "OC" se existe uma `YardVisit` com `status: AT_DOCK` referenciando aquele `yardDockId` — mesmo critério já usado para vaga de pátio (Etapa 3) e para `StoragePosition.occupied` (removido do WMS, F0.4).
- **"Início/término de Carga/Descarga" são timestamps, não estados novos.** `loadingStartedAt`/`loadingEndedAt` dentro do MESMO status `AT_DOCK` — mesmo critério de design já documentado em `WarehouseTaskStatus` do WMS ("o que NÃO virou status, de propósito": não criar estado pra toda variação de progresso quando um timestamp já resolve).
- **"Proibido mover de Doca para Portaria sem desocupar" — não existe ação de "retornar pra portaria".** A ÚNICA saída de `AT_DOCK` é o checkout (`status: COMPLETED`), que sempre libera a doca. Não modela isso como estado ou ação extra — é simplesmente a ausência de uma ação, reforçada pelo fato de não existir endpoint nenhum para isso.
- **Checkout não exige que carga/descarga tenha sido formalmente iniciada/concluída.** "Finalizar e Liberar" fica disponível assim que a visita está em `AT_DOCK`, independente de `loadingStartedAt`/`loadingEndedAt` estarem preenchidos — mesmo espírito de flexibilidade já usado noutras partes do projeto (nenhuma ação anterior deste YMS exige uma sequência rígida de sub-passos obrigatórios).
- **Doca de destino é filtrada por `serviceType`** (reaproveita `YardDock.serviceType` da Etapa 1) — uma visita `RECEBIMENTO` só pode ir para uma doca `RECEBIMENTO` ou `MULTIUSO`; o mesmo vale para `EXPEDICAO`.
- **"Tempo Total da Operação" é `completedAt - checkedInAt`** (o ciclo inteiro dentro da planta, do check-in ao checkout — não só o tempo na doca), calculado, nunca persistido.
- **O card "Check-in/out" do Dashboard é REMOVIDO da grade**, não preenchido. Desde a Etapa 2, o card "Agendamento" já leva pra `YardVisitListView`, que também é onde check-in, movimentação pra doca e checkout acontecem — um segundo card levando ao mesmo lugar seria redundante, não uma tela nova.

## 2. Desenho

### 2.1 Modelo de dados

`YardVisit` (Etapas 2/3) ganha campos novos e dois valores de enum:

```prisma
enum YardVisitStatus {
  SCHEDULED
  CHECKED_IN
  IN_YARD
  AT_DOCK    // novo
  COMPLETED  // novo
  CANCELLED
}
```

```prisma
// Dentro de YardVisit, adicionar:
  yardDockId      String?
  dockArrivedAt   DateTime?
  loadingStartedAt DateTime?
  loadingEndedAt   DateTime?
  completedAt      DateTime?

  // Dentro das relações de YardVisit, adicionar:
  yardDock YardDock? @relation(fields: [yardDockId], references: [id])
```

**Relação reversa obrigatória**: `YardDock` (Etapa 1) ganha `yardVisits YardVisit[]`.

Nenhum model novo nesta etapa — só extensão de `YardVisit` e uso do `YardDock` já existente.

### 2.2 Transições e validações

- **`PATCH /yard-visits/:id/move-to-dock`**, corpo `{ yardDockId }`. Válido a partir de `IN_YARD` OU `CHECKED_IN` (quando `YardWarehouseParams.useYard = false` do armazém — pula pátio). Validações: doca existe, `active`, não vinculada a outra visita `AT_DOCK` (doca livre), `yardDock.serviceType` compatível com `visit.serviceType` (igual, ou um dos dois é `MULTIUSO`), `yardDock.warehouseId === visit.warehouseId`. Ao mover: `status: AT_DOCK`, `yardDockId` preenchido, `dockArrivedAt: now()`.
- **`PATCH /yard-visits/:id/start-loading`** — só a partir de `AT_DOCK`, com `loadingStartedAt` ainda nulo (não pode iniciar duas vezes). Preenche `loadingStartedAt: now()`.
- **`PATCH /yard-visits/:id/end-loading`** — só a partir de `AT_DOCK`, com `loadingStartedAt` preenchido e `loadingEndedAt` ainda nulo. Preenche `loadingEndedAt: now()`.
- **`PATCH /yard-visits/:id/complete`** (checkout) — só a partir de `AT_DOCK`, sem outra exigência. Preenche `status: COMPLETED`, `completedAt: now()`. Libera a doca (não precisa de ação própria — a doca já volta a aparecer como "DP" no instante em que nenhuma visita `AT_DOCK` mais a referencia).

### 2.3 RBAC e licenciamento

- Todas as 4 transições acima exigem `yard:executar` (já existente, Etapa 2) — nenhuma permissão nova.
- `requireModule('YMS')` no ponto de mount, mesmo padrão das etapas anteriores.

### 2.4 Frontend

Sem tela nova. `YardVisitListView.vue` (Etapas 2/3) ganha:
- Visitas `IN_YARD` (ou `CHECKED_IN` quando o armazém não usa pátio) ganham "Mover para Doca" — modal com docas livres do armazém, filtradas por `serviceType` compatível.
- Visitas `AT_DOCK` sem `loadingStartedAt` ganham "Iniciar Carga/Descarga".
- Visitas `AT_DOCK` com `loadingStartedAt` e sem `loadingEndedAt` ganham "Concluir Carga/Descarga".
- Visitas `AT_DOCK` (em qualquer momento) ganham "Finalizar e Liberar" — checkout.
- Visitas `COMPLETED` mostram o "Tempo Total da Operação" calculado, formatado em horas/minutos, no lugar da coluna de pontualidade (que já é `null` pra status que não fazem sentido pontualidade — mesmo padrão do `attachPunctuality` já existente).
- Card "Check-in/out" removido da grade da aba "Pátio" do Dashboard (seção 1).

### 2.5 O que NÃO entra nesta etapa

- Chamada automática de veículos.
- Dashboard consolidado, KPIs (incluindo o próprio "Tempo Total da Operação" agregado em relatório, que é diferente de mostrá-lo por visita individual — isso é Etapa 5).
- Modo histórico de consulta.
- Restrição de visibilidade por planta — fora de escopo desde a Etapa 1.

## 3. Testes

- Backend: testes de integração cobrindo as 4 transições (seção 2.2) e suas validações — doca ocupada, tipo de serviço incompatível, doca de outro armazém, tentar iniciar carga duas vezes, tentar concluir carga sem ter iniciado, checkout disponível mesmo sem carga formalmente concluída, cálculo de "Tempo Total da Operação".
- Frontend: Vitest + Vue Test Utils, mesmo padrão das etapas anteriores — extensão dos testes já existentes de `YardVisitListView.spec.ts`.
