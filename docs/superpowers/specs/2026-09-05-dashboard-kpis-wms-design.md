# Dashboard de KPIs do WMS

**Data:** 2026-09-05
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** cobre a cadeia de Recebimento (única área com `WarehouseTask` hoje) + ocupação de posições do armazém. Picking/Reposição/Expedição ficam para quando a Fase 4b passar a gerar `WarehouseTask`.

## Contexto e motivação

O WMS tem hoje um painel operacional (`OperationsPanelView.vue`, PR #10) para operadores e supervisores conduzirem recebimentos ativos, mas nenhuma visão agregada de tendências para quem gerencia a operação: quanto tempo cada etapa leva, quem está produzindo, onde a cadeia trava, e quão ocupado está o armazém. Este spec cobre essa lacuna com um dashboard de KPIs, mesmo público (gestor de armazém e administração, sem segmentação por papel) e mesmo padrão visual já estabelecido em `PCPDashboardView.vue` (cards de KPI + gráficos Chart.js).

Este projeto ficou pausado a meio do brainstorm em 2026-09-05 quando a aba de Gargalos revelou a necessidade de um limiar de atraso configurável — o que motivou construir primeiro a infraestrutura de Configurações do Sistema (`docs/superpowers/specs/2026-09-05-configuracoes-sistema-design.md`, já implementada e mesclada). A chave `wms.task_delay_threshold_hours` (default 24h) já existe e é o que a aba de Gargalos consome.

## Abordagens consideradas

**Divisão dos endpoints de backend:**

- **A — Dois endpoints agregados, por domínio de dados (escolhida).** `GET /warehouse-tasks/kpis?days=N` cobre as 4 abas que compartilham fonte (`WarehouseTask`) e filtro de período; `GET /storage-positions/occupancy` cobre a aba de Ocupação, que não tem período (ocupação é sempre "agora") e lê de tabelas diferentes (`StoragePosition`/`StockPositionBalance`).
- **B — Um único endpoint para tudo.** Rejeitada: misturaria dados com e sem período na mesma resposta, e a aba de Ocupação não se beneficia de recalcular a cada troca de período das outras 4. (A aba de Gargalos também ignora `days` mesmo estando neste endpoint — aceito de propósito, porque a fonte de dados é a mesma `WarehouseTask` das outras 3 abas deste endpoint, então uma consulta a mais na mesma passada é barata; a linha divisória do endpoint é "mesma tabela-fonte", não "mesmo filtro".)
- **C — Cinco endpoints, um por aba.** Rejeitada por YAGNI: as 4 abas de Recebimento usam a mesma consulta-base (`WarehouseTask` filtrado por `createdAt`), então calcular tudo numa passada é mais barato que 4 idas ao banco: o custo de carregar uma aba a mais que o usuário talvez não veja é desprezível perto da complexidade de 4 estados de loading independentes.

**Definição de "tempo de ciclo" por etapa:**

- **A — `createdAt` → `completedAt`, incluindo espera na fila (escolhida).** É exatamente o que se quer enxergar para identificar gargalo: uma etapa que demora porque ninguém a pega é tão problema quanto uma que demora para executar.
- **B — `startedAt` → `completedAt`, só tempo de execução ativa.** Rejeitada como a métrica principal desta aba (mas usada em Produtividade, onde o que importa é quanto tempo o operador levou executando, não quanto tempo a fila esperou por ele).

## Desenho

### 1. Backend — dois endpoints agregados

**`GET /warehouse-tasks/kpis?days=30`** (RBAC `tarefas_armazem:visualizar`, sob `requireModule('WMS')` — mesmo recurso já usado pelas demais leituras de `WarehouseTask`; `days` aceita 7/30/90, default 30 se ausente/inválido):

```json
{
  "period": { "days": 30 },
  "volumeStatus": {
    "byTypeAndStatus": [
      { "type": "DESCARGA", "status": "COMPLETED", "count": 42 }
    ],
    "receiptsActive": 5,
    "receiptsFinished": 38
  },
  "cycleTime": {
    "byType": [
      { "type": "CONFERENCIA", "avgHours": 3.2 }
    ],
    "fullReceiptAvgHours": 18.4
  },
  "productivity": [
    { "userId": "...", "userName": "...", "tasksCompleted": 27, "avgExecutionHours": 0.8 }
  ],
  "bottlenecks": {
    "byType": [
      { "type": "QUARENTENA", "count": 4 }
    ],
    "affected": [
      { "receiptId": "...", "receiptNumber": "REC-2026-0042", "taskType": "QUARENTENA", "hoursStuck": 36.5 }
    ]
  }
}
```

- `volumeStatus.byTypeAndStatus`: `WarehouseTask` agrupado por `type`+`status`, filtrado por `createdAt >= now - days`.
- `volumeStatus.receiptsActive`/`receiptsFinished`: contagem de `PurchaseReceipt` distintos no período com pelo menos uma tarefa `PENDING`/`IN_PROGRESS` (ativo) vs. todas `COMPLETED`/`CANCELLED` (finalizado).
- `cycleTime.byType`: média de `completedAt - createdAt` (em horas) por `type`, só tarefas `COMPLETED` no período.
- `cycleTime.fullReceiptAvgHours`: média, por recebimento, de `completedAt` da última tarefa da cadeia menos `createdAt` da primeira.
- `productivity`: agrupado por `assignedTo`, só tarefas `COMPLETED` no período; `avgExecutionHours` = média de `completedAt - startedAt` (não inclui espera na fila, ao contrário de `cycleTime`).
- `bottlenecks.byType`: contagem de tarefas em `PENDING`/`IN_PROGRESS` cujo `createdAt` é anterior a `now - wms.task_delay_threshold_hours` (lido via `getSetting`, não filtrado pelo período de `days` — um gargalo é sempre "agora", independente do seletor de período da tela).
- `bottlenecks.affected`: uma linha por tarefa atrasada, com o número do recebimento (via `reference`/`referenceType = 'PURCHASE_RECEIPT'`) e `hoursStuck` calculado a partir de `createdAt`.

**`GET /storage-positions/occupancy`** (RBAC `estruturas_armazem:visualizar`, sob `requireModule('WMS')` — mesmo recurso já usado pelas leituras de `StoragePosition`; sem parâmetros):

```json
{
  "byWarehouse": [
    { "warehouseCode": "WH1", "occupied": 120, "free": 30, "blocked": 5, "total": 155 }
  ]
}
```

- Agrupado por `warehouseCode`. `occupied` = posições com pelo menos uma linha de `StockPositionBalance` com `quantity > 0`; `blocked` = `StoragePosition.blocked = true` (independente de ter saldo); `free` = todo o resto; `total` = soma dos três.

### 2. Frontend

Nova view `frontend/src/views/wms/WmsKpiDashboardView.vue`, rota `/wms/kpis`, card na aba WMS do Dashboard (ao lado de Workflows/Operações Ativas/Recebimento). Segue o padrão visual de `PCPDashboardView.vue`: `AppLayout` + cards de KPI no topo de cada aba + gráficos Chart.js abaixo.

- **Abas internas** (não rotas separadas — um `activeTab` local) para as 5 visões: Volume/Status, Tempo de Ciclo, Produtividade, Gargalos, Ocupação. Trocar de aba não descarta os dados já carregados das outras.
- **Seletor de período** (7/30/90 dias, default 30) visível só quando uma das 4 abas de Recebimento está ativa; a aba Ocupação não o exibe (não tem período).
- **Botão "Atualizar"**: dispara as chamadas de novo (só o endpoint relevante à aba de Recebimento quando o período muda; ambos os endpoints num "Atualizar" geral). Sem polling.
- Por aba:
  - **Volume/Status**: gráfico de barras empilhadas (eixo X = tipo de etapa, empilhado por status) + 2 cards de KPI (recebimentos ativos, finalizados).
  - **Tempo de Ciclo**: gráfico de barras horizontal (tempo médio por tipo de etapa, em horas) + 1 card de KPI (tempo médio do recebimento completo).
  - **Produtividade**: tabela (não gráfico — lista de operadores é naturalmente tabular) com operador, tarefas concluídas, tempo médio de execução.
  - **Gargalos**: cards de KPI (contagem por tipo de etapa) + tabela dos recebimentos afetados (número, etapa, horas parada), cada linha linkando para `/wms/operations` (painel de operações existente do PR #10) — não duplica a ação de conduzir a tarefa, só aponta para onde ela é conduzida.
  - **Ocupação**: gráfico de barras (ocupado/livre/bloqueado, uma barra por armazém) + 1 card de KPI (% de ocupação geral, agregando todos os armazéns).
- `frontend/src/services/wms-kpi-dashboard.service.ts` chamado diretamente do componente — sem store dedicado, mesmo precedente de `PCPDashboardView.vue`, que não usa Pinia store própria.
- Estado de loading/erro por chamada (banner + "Tentar Novamente", mesmo padrão de `MRPView`/`ReportsView`) — um erro no endpoint de ocupação não deve travar as 4 abas de Recebimento, e vice-versa.

### 3. Testes e tratamento de erro

- **Backend**: testes de integração para `GET /warehouse-tasks/kpis` cobrindo agregação por `type×status`, cálculo de `cycleTime` (incluindo o caso de uma tarefa com `startedAt` null que nunca foi iniciada — não deve quebrar a média), produtividade por operador, e a lista de gargalos respeitando `wms.task_delay_threshold_hours` vindo do banco (não hardcoded — um teste que muda o valor via `SystemSetting` e confirma que o cálculo reflete o novo limiar). RBAC e `requireModule('WMS')` nos dois endpoints. Testes de `GET /storage-positions/occupancy` cobrindo a contagem correta de ocupado/livre/bloqueado, incluindo o caso de uma posição bloqueada que também tem saldo (conta como `blocked`, não `occupied` — bloqueio tem prioridade na classificação).
- **Frontend**: troca de aba preserva dados já carregados de outra aba (não recarrega à toa); troca de período dispara nova chamada só ao endpoint de Recebimento; erro em um endpoint não impede a renderização do outro.

## Fora de escopo (deliberado)

- Exportar/imprimir o dashboard.
- Comparação entre períodos (ex.: "este mês vs. mês anterior").
- Ocupação detalhada por tipo de posição (picking vs. pulmão) ou por rua/estrutura — agregado só por armazém nesta v1.
- Atualização em tempo real (WebSocket/polling) — decidido manual apenas, mesma lógica de uma tela analítica (`PCPDashboardView`/`ReportsView`), não operacional como o painel de operações.
- Picking/Reposição/Expedição nas abas de Recebimento — só entram quando essas fases passarem a gerar `WarehouseTask` de verdade.

## Riscos / pontos de atenção para o plano de implementação

- Confirmar o nome exato do campo que liga `WarehouseTask` a `PurchaseReceipt` (`reference`/`referenceType`, já usado em outros pontos do WMS) para montar `bottlenecks.affected` corretamente, incluindo o `receiptNumber` legível (join com `PurchaseReceipt`).
- Decidir, na fase de plano, se `cycleTime.byType` e `productivity` devem excluir tarefas cujo tempo daria um valor degenerado (ex.: uma tarefa criada e concluída no mesmo milissegundo por causa de dado de teste/migração) — provavelmente não, mas vale confirmar contra dados reais do ambiente de dev.
- `fullReceiptAvgHours`: definir exatamente "última tarefa da cadeia" quando duas tarefas compartilham a mesma `sequence` (etapas paralelas, já suportado pelo modelo) — usar o maior `completedAt` entre todas as tarefas do recebimento, não assumir uma ordem linear.
