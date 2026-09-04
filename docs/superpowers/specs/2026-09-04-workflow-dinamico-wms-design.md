# Workflow dinâmico do WMS (Recebimento)

**Data:** 2026-09-04
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** 1 de 2 (a segunda etapa — fluxos de saída/cross-docking — é um projeto futuro separado, fora deste spec)

## Contexto e motivação

O usuário (dono do produto) identificou que as operações do WMS podem variar por características do produto ou do cliente — exemplos citados: um produto que exige quarentena, um processo de segregação por tipo, retirada de amostra. A cadeia de tarefas de recebimento hoje é **hardcoded** em `purchase-receipt.service.ts::create()`:

```
DESCARGA → CONFERENCIA → ETIQUETAGEM → [QUARENTENA, se necessário] → ALOCACAO
```

usando o enum fixo `WarehouseTask` do Prisma. Um sistema engessado assim não dá conta de variações reais de operação sem alteração de código a cada novo caso. A demanda: um administrador (ou quem tiver a permissão) deve poder configurar visualmente a sequência de operações de recebimento, incluindo desvios condicionais, sem precisar de deploy.

## Decisões de escopo (confirmadas com o usuário)

- **Só Recebimento nesta etapa.** Não cobre Separação/Picking nem é um motor totalmente genérico para qualquer operação do WMS. O modelo de dados nasce com um campo `direction` (`ENTRADA`/`SAIDA`) pensando em cross-docking (fluxos de saída) como fase futura, mas só `ENTRADA` tem executor implementado agora — nenhum redesenho será necessário para plugar a fase 2.
- **Motor de condições livre**, não um simples reaproveitamento do padrão produto/categoria/prioridade do `StorageRule`. O admin monta condições arbitrárias (ex: peso > 500 E categoria = X) com agrupamento E/OU.
- **Editor visual em canvas livre** (arrastar-e-soltar, posicionamento livre, conectores com roteamento em ângulo reto), com uma **paleta fixa** dos tipos de operação do armazém — não um editor de diagramas genérico com formas/cores/fontes livres. O admin desenha a topologia (incluindo desvios condicionais via nós de decisão), mas não inventa novos tipos de operação nem formas arbitrárias.

## Abordagens consideradas

**Estrutura do motor de fluxo:**

- **A — Grafo genérico completo (BPMN).** Nós/arestas livres, caminhos paralelos, junção de ramos, detecção de ciclo. Rejeitada: exigiria repensar como `WarehouseTask` é executada hoje (sequencial) para um cenário — um item físico de recebimento — que não tem necessidade real de paralelismo.
- **B — Grafo restrito a decisões binárias sem paralelismo (escolhida).** Nós de decisão têm exatamente 2 saídas (SIM/NAO) e todo caminho reconverge na sequência principal ou termina em ALOCACAO. Cobre os casos de uso reais (peso, categoria, grupo de segregação decidindo se um passo entra ou não) sem precisar de execução paralela.
- **C — Lista ordenada com passos condicionalmente incluídos.** Mais simples, mas só "pula ou não pula" em sequência fixa — não expressa decisões com dois caminhos de verdade como pedido.

**Editor visual:**

- **Canvas livre + paleta fixa do WMS (escolhida).** Validada com o usuário via mockup no companion visual (ver seção 6) — inclusive contra uma referência de editor de diagramas genérico (draw.io) que o usuário trouxe como exemplo puramente ilustrativo de estilo (posicionamento livre, conectores ortogonais), não como pedido de formas/cores livres.
- **Editor de diagrama genérico de verdade.** Rejeitada — escopo muito maior (biblioteca completa de diagramação), e o admin poderia desenhar qualquer coisa, não só operações de armazém válidas.

## Desenho

### 1. Arquitetura geral

Duas peças novas se conectam num ponto único do código existente: `purchase-receipt.service.ts::create()`, que hoje monta a cadeia de tarefas com lógica hardcoded. Essa montagem passa a ser feita por um **resolvedor de workflow** (`resolveWorkflowTasks`), que recebe o contexto do recebimento (produto + pedido) e devolve a lista ordenada de tipos de tarefa a criar — o resto do fluxo de criação de `WarehouseTask` não muda.

Se nenhum `WorkflowTemplate` ativo for configurado (ou nenhum bater com o contexto), o resolvedor cai automaticamente na cadeia atual como padrão embutido (`DEFAULT_CHAIN`) — o sistema continua funcionando exatamente como hoje sem que o admin precise configurar nada. Compatibilidade retroativa total por padrão.

### 2. Modelo de dados

```prisma
enum WorkflowDirection {
  ENTRADA
  SAIDA   // sem executor nesta etapa — reservado para fase futura (cross-docking)
}

enum WorkflowNodeType {
  DESCARGA
  CONFERENCIA
  ETIQUETAGEM
  QUARENTENA
  SEGREGACAO   // novo — cobre segregação por característica do produto
  AMOSTRAGEM   // novo — cobre retirada de amostra
  ALOCACAO     // terminal — único tipo que gera ReceiptPutaway/movimento de estoque
  DECISAO      // nó de controle, não gera WarehouseTask
}

enum WorkflowEdgeBranch {
  SIM
  NAO
}

model WorkflowTemplate {
  id          String            @id @default(cuid())
  name        String
  description String?
  direction   WorkflowDirection @default(ENTRADA)
  active      Boolean           @default(true)
  priority    Int               @default(0)  // maior prioridade vence quando mais de um template bate
  triggerRule Json?             // condição para decidir SE este template se aplica; null nunca casa sozinho (precisa condição explícita)
  entryNodeId String?
  nodes       WorkflowNode[]
  edges       WorkflowEdge[]
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
}

model WorkflowNode {
  id            String           @id @default(cuid())
  templateId    String
  template      WorkflowTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  type          WorkflowNodeType
  label         String?
  conditionRule Json?            // só usado quando type = DECISAO
  positionX     Float            // só layout do canvas
  positionY     Float
}

model WorkflowEdge {
  id         String              @id @default(cuid())
  templateId String
  template   WorkflowTemplate    @relation(fields: [templateId], references: [id], onDelete: Cascade)
  fromNodeId String
  toNodeId   String
  branch     WorkflowEdgeBranch? // SIM|NAO quando fromNode é DECISAO; null nos demais
}
```

`SEGREGACAO` e `AMOSTRAGEM` entram como novos valores fixos no vocabulário (migração de banco), cobrindo os exemplos citados pelo usuário. O conjunto continua pré-fixado — um tipo de operação totalmente novo no futuro exigiria outra migração, não é algo que o admin cria sozinho na tela.

### 3. Regras de validação do grafo (aplicadas ao salvar um template, no backend — não só na UI)

- Exatamente 1 nó de entrada (`entryNodeId`), sem arestas chegando nele.
- Todo nó `DECISAO` tem exatamente 2 saídas (`SIM` e `NAO`) e uma `conditionRule` preenchida.
- Todo nó que não é `DECISAO` tem no máximo 1 saída.
- **Todo caminho termina obrigatoriamente em `ALOCACAO`, e `ALOCACAO` nunca tem saída.** Não é regra arbitrária: é o único tipo de tarefa que, ao ser concluída, efetivamente gera o `ReceiptPutaway`/movimento de estoque — sem ele o recebimento nunca fecha. O editor trava `ALOCACAO` como o único ponto de chegada válido (não pode ser removido, duplicado nem reordenado para o meio do fluxo).
- Sem ciclos.
- Todo nó alcançável a partir da entrada (sem nós órfãos soltos no canvas).

### 4. Motor de condições

Mesmo formato de regra usado em dois lugares: `WorkflowTemplate.triggerRule` (decide qual template se aplica a um recebimento) e `WorkflowNode.conditionRule` (decide qual saída um nó `DECISAO` segue). Árvore JSON com agrupamento E/OU:

```ts
type ConditionRule =
  | { op: 'AND' | 'OR'; clauses: ConditionRule[] }
  | { field: ConditionField; operator: 'eq'|'ne'|'gt'|'gte'|'lt'|'lte'|'contains'; value: string | number | boolean };

type ConditionField =
  | 'product.weight' | 'product.volume' | 'product.packagingType'
  | 'product.segregationGroup' | 'product.maxStackQty' | 'product.lotTracked'
  | 'product.categoryId' | 'order.supplierId';
```

`ConditionField` é uma lista fechada — cada campo mapeia a um valor real do `Product`/`PurchaseOrder` (campos WMS do F0.9: `weight`, `segregationGroup`, `packagingType`, etc., mais categoria e fornecedor do pedido). O avaliador (`evaluateRule(rule, context): boolean`) é uma função pura, sem `eval`/interpretação dinâmica — cada `field` é resolvido por um switch fechado, sem risco de injeção nem de campo inventado pelo admin.

### 5. Resolução do workflow (substitui a cadeia hardcoded)

```ts
function resolveWorkflowTasks(context: ReceivingContext): WorkflowNodeType[] {
  const template = pickTemplate(context); // maior priority cujo triggerRule bate; null se nenhum bater
  if (!template) return DEFAULT_CHAIN; // cadeia atual hardcoded, preserva comportamento de hoje

  const steps: WorkflowNodeType[] = [];
  let current = template.nodes.find(n => n.id === template.entryNodeId)!;
  let guard = 0;
  while (true) {
    if (++guard > template.nodes.length + 1) throw new AppError(500, 'Workflow inválido: ciclo detectado em runtime');
    if (current.type === 'DECISAO') {
      const branch = evaluateRule(current.conditionRule!, context) ? 'SIM' : 'NAO';
      const edge = template.edges.find(e => e.fromNodeId === current.id && e.branch === branch)!;
      current = template.nodes.find(n => n.id === edge.toNodeId)!;
      continue;
    }
    steps.push(current.type);
    if (current.type === 'ALOCACAO') break; // terminal por regra de validação
    const edge = template.edges.find(e => e.fromNodeId === current.id)!;
    current = template.nodes.find(n => n.id === edge.toNodeId)!;
  }
  return steps;
}
```

`purchase-receipt.service.ts::create()` troca a montagem hardcoded por `resolveWorkflowTasks(context).map(type => createTask(type, ...))` — o resto (criação de `WarehouseTask`, `ReceiptPutaway` no `ALOCACAO`, etc.) não muda.

`guard` é cinto-e-suspensório em runtime — a validação ao salvar já impede ciclo, mas protege contra um template que ficou inválido por uma migração futura ou edição direta no banco.

### 6. Tela de edição visual

Validada com o usuário via mockup no companion visual de brainstorming (`.superpowers/brainstorm/`, não versionado). Canvas livre (posicionamento arrastar-e-soltar, conectores roteados em ângulo reto, sem grade de fundo) + paleta lateral fixa com os 8 tipos de operação (Descarga, Conferência, Etiquetagem, Decisão, Quarentena, Segregação, Amostragem, Alocação). Clicar num nó `DECISAO` abre um painel flutuante à direita com o construtor de regra (campo/operador/valor + E/OU) — o mesmo componente é reaproveitado para a regra de seleção de template (`triggerRule`). `Entrada` e `Alocação` são visualmente distintos (arredondado/circular) para reforçar que são pontos fixos do fluxo — o admin não remove nem reordena esses dois.

Telas: lista de templates (nome, ativo, prioridade, resumo da regra de gatilho, ações: editar/duplicar/ativar-desativar/excluir) + editor de template (o canvas descrito acima, mais campos de nome/descrição/prioridade/regra de gatilho do template).

### 7. Testes e tratamento de erro

- **Backend:** testes unitários do avaliador de condição (`evaluateRule`) cobrindo E/OU aninhado e cada operador; testes do resolvedor de grafo (`resolveWorkflowTasks`) cobrindo decisão SIM/NAO, fallback pra cadeia padrão quando nenhum template bate, e o guard de ciclo em runtime; testes de integração do endpoint de salvar template cobrindo cada regra de validação da seção 3 (nó órfão, decisão sem 2 saídas, ciclo, caminho não terminando em ALOCACAO) retornando 400 com mensagem específica.
- **Frontend:** o botão "Salvar" do editor roda as mesmas checagens de validação no cliente antes de chamar a API (feedback imediato), mas a validação vinculante é sempre a do backend — mesmo padrão já usado no resto do sistema (ex: quantidade pendente no recebimento).
- **Erro em runtime** (`resolveWorkflowTasks` lança `AppError`): só pode acontecer se um template ativo ficou inválido por uma migração futura ou edição direta no banco — trata como erro 500 e bloqueia a criação do recebimento com mensagem clara, nunca falha silenciosamente criando uma cadeia incompleta.

## Fora de escopo (deliberado)

- Fluxos de saída/cross-docking — `direction` já existe no modelo, mas só `ENTRADA` tem executor. Fase futura, spec própria.
- Paralelismo/junção de ramos (Abordagem A) — decisões binárias que reconvergem cobrem os casos reais citados.
- Formas/cores/fontes livres (editor de diagrama genérico) — paleta fica fixa nas 8 operações + decisão.
- Novos tipos de operação além dos 8 hoje mapeados — exige migração futura, não é algo que o admin cria na tela.
- Reuso deste motor de condições em outras partes do sistema (ex: `StorageRule`) — cada um continua com seu próprio mecanismo por ora.

## Riscos / pontos de atenção para o plano de implementação

- Permissão para gerenciar templates de workflow: precisa de um novo recurso RBAC (ex: `workflows_wms`) com ações de criar/editar/excluir — decidir o nome exato e seed na fase de plano, seguindo o padrão já usado por `recebimentos_compra`.
- `pickTemplate(context)` precisa de uma regra de desempate explícita quando dois templates ativos têm a mesma `priority` e ambos batem com o contexto — decidir na fase de plano (ex: mais recente por `updatedAt` vence, ou erro de configuração a ser sinalizado ao admin).
- Biblioteca de canvas no frontend: o editor visual (arrastar-e-soltar, conectores roteados, seleção de nó) é uma peça de UI substancial — avaliar na fase de plano se vale usar uma biblioteca de diagramação Vue já pronta (ex: `@vue-flow/core`) em vez de construir do zero, dado o volume de mecânica de canvas (arrastar, conectar, roteamento ortogonal) envolvida.
- Migração do `WarehouseTask`/enum Prisma para incluir `SEGREGACAO` e `AMOSTRAGEM` — confirmar que nada no código hoje assume a lista atual de valores como exaustiva (ex: `switch` sem `default`) antes de aplicar.
- `purchase-receipt.service.ts::create()` hoje decide a necessidade de `QUARENTENA` com lógica própria (fora deste spec de ler) — o plano precisa mapear exatamente onde essa decisão migra para dentro do `ConditionRule` de um nó de decisão na cadeia padrão convertida, para não perder esse comportamento na migração do hardcoded para o resolvedor.
