# Painel de Operações do WMS (Recebimento)

**Data:** 2026-09-04
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** cobre só Recebimento — Separação/Reposição ficam para um projeto futuro com o mesmo padrão

## Contexto e motivação

O WMS já gera, por recebimento, uma cadeia ordenada de `WarehouseTask` (hoje hardcoded, e a partir do PR #9 — "Workflow dinâmico do WMS", ainda não mesclado a `main` no momento deste spec — configurável por template). O que não existe é uma tela que mostre, de forma visual, quais operações estão em andamento e em que etapa cada uma está — nem uma forma de conduzir manualmente essas etapas quando o cliente não usa coletor de dados (leitor de código de barras/app dedicado).

Este spec cobre essa lacuna: um painel que mostra cada recebimento ativo como uma linha de retângulos (um por etapa da cadeia resolvida), com dois públicos — supervisor (visão geral) e operador (visão filtrada, usada para conduzir a etapa manualmente na própria tela) — e a geração de documentos de apoio impressos para cada etapa conduzida manualmente.

**Dependência:** este projeto pressupõe o motor de workflow dinâmico (PR #9) mesclado — sem ele, a "cadeia resolvida" de um recebimento é sempre a cadeia hardcoded atual, que o painel também sabe exibir sem problema (o painel lê a cadeia de `WarehouseTask` já criada, não recalcula nada).

## Abordagens consideradas

**Fonte de dados do painel:**

- **A — Endpoint agregado novo, uma chamada devolve tudo (escolhida).** `GET /warehouse-tasks/panel?scope=all|mine` devolve cada recebimento ativo já com sua cadeia de tarefas ordenada embutida. Essencial para o polling funcionar bem — uma requisição por ciclo, não uma lista de N chamadas.
- **B — Compor no frontend a partir de endpoints que já existem.** Lista de recebimentos + uma chamada `GET /warehouse-tasks/receipt/:id` por recebimento. Rejeitada: vira N+1 chamadas a cada atualização automática, degradando com o número de operações ativas e de usuários com a tela aberta.

**Documentos de apoio por etapa:**

- **A — Um gerador único, configurado por tipo de etapa (escolhida).** Reaproveita `generatePDF()` (utilitário compartilhado já existente desde a feature de impressão do PR #8), com uma configuração (título, colunas extras, observação) por tipo de `WarehouseTask`. Consistente com o padrão já estabelecido no projeto.
- **B — Um layout de documento dedicado por tipo de etapa.** Rejeitada por YAGNI: os 7 tipos compartilham a mesma base (itens do recebimento), divergindo só em colunas/observações — 7 componentes/templates separados duplicariam a maior parte do layout.

## Desenho

### 1. Backend — endpoint agregado

`GET /warehouse-tasks/panel?scope=all|mine`, montado sob `requireModule('WMS')`, reaproveitando a permissão `tarefas_armazem` já existente (F4.9 — `visualizar` para consultar, `executar` para concluir etapa; sem recurso RBAC novo).

Devolve, para cada `PurchaseReceipt` com pelo menos uma `WarehouseTask` em status `PENDING` ou `IN_PROGRESS`:

```json
{
  "receiptId": "...",
  "receiptNumber": "REC-2026-0042",
  "tasks": [
    { "id": "...", "type": "DESCARGA", "status": "COMPLETED", "sequence": 1, "assignedTo": "...", "completedAt": "..." },
    { "id": "...", "type": "CONFERENCIA", "status": "PENDING", "sequence": 2, "assignedTo": null }
  ]
}
```

- `scope=all` (supervisor): todos os recebimentos ativos, sem filtro de atribuição.
- `scope=mine` (operador): só recebimentos onde pelo menos uma tarefa está atribuída ao usuário logado OU ainda sem atribuição (a "fila aberta do armazém" que o sistema já modela desde a F4.9) — a tarefa em si pode aparecer mesmo não atribuída a ele, para que ele possa pegá-la.

### 2. Frontend — componente único, dois públicos

Um componente compartilhado (linhas de retângulos, um retângulo por `WarehouseTask` da cadeia) alimenta duas telas — visão de supervisor (`scope=all`, com filtros) e visão de operador (`scope=mine`) — sem duplicar lógica visual.

Cada retângulo tem 3 estados, calculados no cliente a partir de `status`/`sequence` (espelhando o gate `assertChainOrderResolved` que o backend já aplica ao concluir tarefas):

- **Concluída** — clicável, abre modal só-leitura (quem concluiu, quando).
- **Ativa** — a primeira tarefa não resolvida da cadeia. Clicável:
  - Se já atribuída ao usuário (ou é supervisor consultando), abre direto a ação de conduzir a etapa.
  - Se **não atribuída**, abre um diálogo de confirmação ("Pegar esta tarefa?") antes de qualquer coisa — só ao confirmar o sistema atribui `assignedTo` ao usuário atual E abre a ação. Um clique acidental não atribui nada.
  - A ação em si: para os 6 tipos "simples" (Descarga, Etiquetagem, Quarentena, Segregação, Amostragem — e Conferência, que também é conclusão simples apesar do documento de apoio ser mais elaborado), confirmar e chamar o endpoint genérico de conclusão de tarefa. Para Alocação, abre o fluxo de endereçamento que já existe (não duplica lógica de posição/quantidade).
- **Bloqueada** — passos futuros da cadeia; desabilitada, com indicação de que aguarda a etapa anterior.

**Atualização:** polling a cada ~20-30s enquanto a tela estiver aberta, mais um refetch imediato após qualquer ação de conclusão bem-sucedida (feedback instantâneo pra quem acabou de agir, sem esperar o próximo ciclo). Sem WebSocket nesta etapa.

### 3. Documentos de apoio para impressão

Cada etapa conduzida manualmente pela tela oferece um botão para gerar/imprimir um documento de apoio (manual, mesma filosofia "não abre sozinho" já estabelecida na feature de impressão do PR #8), usando o `generatePDF()` compartilhado com uma configuração por tipo de etapa:

| Etapa | Conteúdo específico (além da lista de itens do recebimento) |
|---|---|
| Descarga | Manifesto — itens esperados do pedido, fornecedor, data de recebimento |
| Conferência | Itens esperados + coluna em branco "Conferido" para check manual |
| Etiquetagem | Itens + lote (quando `product.lotTracked`) + quantidade a etiquetar |
| Quarentena | Itens + motivo (quando identificável pela `StorageRule` que disparou a quarentena) + campo em branco para resultado da inspeção |
| Segregação | Itens + grupo de segregação (`product.segregationGroup`) + campo em branco para justificativa |
| Amostragem | Itens + campos em branco para quantidade coletada e referência de laboratório |
| Alocação | Itens + posições sugeridas/escolhidas (reaproveitando a sugestão de endereço da Fase 4b, `GET /storage-rules/suggest`, quando disponível) + quantidades |

A base comum (lista de itens do recebimento: código, descrição, quantidade) é montada uma vez; cada tipo de etapa só adiciona colunas/observações específicas via configuração, sem duplicar o layout base.

### 4. Testes e tratamento de erro

- **Backend:** testes de integração do endpoint `/warehouse-tasks/panel` cobrindo `scope=all` vs `scope=mine` (tarefa atribuída a outro operador não aparece em `mine`; tarefa não atribuída aparece nos dois), recebimento sem tarefa ativa nenhuma não aparece na lista, RBAC (`tarefas_armazem:visualizar`) e licenciamento (`requireModule('WMS')`).
- **Frontend:** o diálogo de confirmação de "pegar tarefa" precisa realmente bloquear a atribuição até confirmação explícita — teste cobrindo clique acidental (fechar o diálogo sem confirmar não deve chamar a API de atribuição). Estados de retângulo (concluída/ativa/bloqueada) calculados a partir de fixtures de `status`/`sequence`, incluindo o caso de duas tarefas com a mesma `sequence` (etapas paralelas, já suportado pelo modelo de dados — ver comentário em `warehouse-task.service.ts`).
- **Corrida de atribuição:** dois operadores confirmando "pegar" a mesma tarefa quase simultaneamente — o backend precisa recusar a segunda atribuição (a tarefa já não está mais livre) com uma mensagem clara, não sobrescrever silenciosamente.

## Fora de escopo (deliberado)

- Painel para Separação/Reposição (PICKING/REPLENISHMENT, Fase 4b) — mesmo padrão, projeto futuro separado.
- Formulário dedicado por tipo de etapa na CONDUÇÃO da tarefa (captura de dados além da conclusão simples) — só o documento de apoio impresso é específico por tipo; a ação de conclusão em si continua sendo confirmar.
- Atualização em tempo real via WebSocket — polling é suficiente para este caso de uso.
- Visão de dashboard do administrador (KPIs agregados) — item já registrado separadamente na fila de features.

## Riscos / pontos de atenção para o plano de implementação

- Confirmar o nome exato e o formato de resposta de qualquer endpoint de sugestão de posição já existente (`/storage-rules/suggest`) antes de assumir a integração com o documento de Alocação — se a resposta não cobrir o caso "nenhuma posição viável", o documento precisa lidar com isso sem quebrar.
- A janela de corrida entre "confirmar pegar tarefa" e a escrita de `assignedTo` precisa de um mecanismo de exclusão (lock otimista via `version`, já usado no resto do `WarehouseTask`, ou uma condição no `WHERE` da atualização) — decidir o mecanismo exato na fase de plano, olhando como `warehouse-task.service.ts` já lida com concorrência em outros pontos.
- Definir, na fase de plano, se `GET /warehouse-tasks/panel` pagina (recebimentos ativos podem crescer sem limite num armazém grande) ou se um limite razoável sem paginação é aceitável nesta primeira versão.
