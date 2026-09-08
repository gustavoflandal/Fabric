# Melhorias de UX do editor de Workflow do WMS (Recebimento)

**Data:** 2026-09-08
**Status:** design aprovado, aguardando plano de implementação (implementação adiada — ver seção 0)
**Escopo:** só frontend, só o editor visual (`WorkflowTemplateEditorView.vue` e os componentes que ele usa). Nenhuma mudança de schema, service ou rota no backend.

## 0. Por que este documento existe agora sem implementação imediata

Avaliando o motor de workflow dinâmico do WMS (spec anterior, `2026-09-04-workflow-dinamico-wms-design.md`), o usuário identificou 3 problemas concretos de UX no editor visual — não problemas de capacidade do motor. Uma alternativa (adotar um motor de terceiros como o n8n) foi considerada e descartada para este caso: o n8n é acionado por webhook/HTTP (não por chamada de função in-process), então substituí-lo exigiria abrir mão da garantia transacional que hoje existe entre a resolução do workflow e a criação de `WarehouseTask`, recriar por fora as validações de grafo específicas do domínio (entrada única, sem ciclo, `ALOCACAO` como terminal obrigatório) que hoje são reforçadas no backend, e somar infraestrutura nova (Postgres obrigatório em produção, Redis se for usar modo fila). Ficou decidido evoluir o editor atual em vez de substituí-lo.

Este spec fica pronto (documento + plano de implementação) para quando a prioridade permitir — a fila imediata é fechar as pendências da fase corrente e iniciar o levantamento de requisitos do YMS.

## 1. Os 3 problemas (confirmados no código, não só na avaliação do usuário)

1. **Terminologia técnica/em inglês nos filtros e condições.** `ConditionRuleBuilder.vue` renderiza `CONDITION_FIELDS` cru num `<select>` (`product.weight`, `product.categoryId`, `order.supplierId`, …) e os operadores (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`) também sem tradução. Para comparar: os tipos de nó (`WORKFLOW_NODE_LABELS`) já são traduzidos corretamente ("Descarga", "Conferência" etc.) — só o construtor de condições ficou de fora dessa camada de tradução.
2. **Fonte pequena demais.** Praticamente toda a interface do editor usa `text-xs` (12px, a menor classe de texto do Tailwind): paleta de operações, nós no canvas, painel de nó selecionado, e todo o `ConditionRuleBuilder`.
3. **Pontos de conexão só em 2 lados fixos.** `OperationNode.vue` tem 1 handle de entrada (esquerda) e 1 de saída (direita); `EntryNode.vue` tem 1 handle de saída (direita); `DecisionNode.vue` tem 1 de entrada (esquerda) e 2 de saída SIM/NAO, ambos embaixo. Isso força o usuário a montar o layout numa direção rígida (só esquerda→direita, decisões só ramificando pra baixo), gerando conectores cruzados quando o fluxo real pede outra disposição.

## 2. Desenho

### 2.1 Tradução de campos e operadores (Fix 1)

Novo dicionário em `frontend/src/types/workflow.types.ts`, no mesmo padrão de `WORKFLOW_NODE_LABELS`:

```typescript
export const CONDITION_FIELD_LABELS: Record<ConditionField, string> = {
  'product.weight': 'Peso do produto (kg)',
  'product.volume': 'Volume do produto (m³)',
  'product.packagingType': 'Tipo de embalagem',
  'product.segregationGroup': 'Grupo de segregação',
  'product.maxStackQty': 'Qtd. máxima de empilhamento',
  'product.lotTracked': 'Rastreado por lote',
  'product.categoryId': 'Categoria do produto',
  'order.supplierId': 'Fornecedor do pedido',
}

export const CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'igual a',
  ne: 'diferente de',
  gt: 'maior que',
  gte: 'maior ou igual a',
  lt: 'menor que',
  lte: 'menor ou igual a',
  contains: 'contém',
}
```

Em `ConditionRuleBuilder.vue`, os dois `<option>` passam a exibir o label traduzido em vez do valor cru (o `value` do `<option>` continua sendo a chave técnica — `field`/`operator` — para não tocar no formato de dados salvo, só a apresentação):

```vue
<option v-for="field in CONDITION_FIELDS" :key="field" :value="field">{{ CONDITION_FIELD_LABELS[field] }}</option>
...
<option v-for="op in OPERATORS" :key="op" :value="op">{{ CONDITION_OPERATOR_LABELS[op] }}</option>
```

**Fora de escopo, registrado para uma iteração futura:** o campo de valor da condição (`localLeafValue`) é hoje um `<input type="text">` genérico para qualquer campo — inclusive `product.categoryId`/`order.supplierId`, que são UUIDs, e `product.lotTracked`, que é booleano. Digitar um UUID de categoria/fornecedor de cabeça é tão pouco amigável quanto a terminologia técnica que este spec corrige. Resolver isso direito (um `<select>` de categoria/fornecedor populado pelas stores já existentes, um checkbox para `lotTracked`) é um trabalho maior — o `ConditionLeaf.value` precisaria variar de tipo de input por `field`, e as opções de categoria/fornecedor viriam de `useProductCategoryStore`/`useSupplierStore` (ambas já existem no projeto). Não faz parte desta rodada porque o usuário não citou esse ponto e ampliaria o escopo além do que foi pedido; fica registrado aqui para não se perder.

### 2.2 Fonte maior (Fix 2)

Troca sistemática de `text-xs` (12px) por `text-sm` (14px) nos arquivos do editor:
- `WorkflowTemplateEditorView.vue`: paleta de operações (linha ~47), label do nó selecionado (~70), botão remover nó (~76)
- `ConditionRuleBuilder.vue`: os 2 `<select>`, o `<input>` de valor, e os botões (+ condição, + subgrupo, remover, ✕)
- `EntryNode.vue`, `DecisionNode.vue`, `OperationNode.vue`: o texto do nó (hoje `text-xs font-semibold`)

Não é find-and-replace cego: onde `text-xs` está numa hierarquia visual intencional (ex.: um rótulo auxiliar menor que o texto principal ao lado), a task de implementação deve preservar a hierarquia subindo os dois um degrau (`text-xs`→`text-sm`, `text-sm`→`text-base`) em vez de igualar tudo. Na leitura destes arquivos hoje, não há essa hierarquia de dois níveis — é `text-xs` uniforme — então na prática deve ser uma troca direta, mas a task de implementação deve conferir cada ocorrência antes de aplicar, não assumir.

### 2.3 Handles nos 4 lados (Fix 3)

Cada tipo de nó ganha handles em `Position.Top`, `Position.Right`, `Position.Bottom` e `Position.Left`, mantendo a semântica atual de cada tipo. **Confirmado contra a documentação do Vue Flow**: múltiplos handles do mesmo tipo (`source` ou `target`) no mesmo nó exigem `id` único cada — não dá pra ter 4 handles `source` sem id como hoje (1 handle sem id funciona porque não há ambiguidade; 4 exigem `id="top"`/`"right"`/`"bottom"`/`"left"` cada).

- **`EntryNode`** (só emite, nunca recebe — o backend exige zero arestas chegando no nó de entrada): 4 handles `type="source"`, com `id="top"`/`"right"`/`"bottom"`/`"left"`.
- **`OperationNode`** (recebe de 1 lado, emite para 1 lado — exceto `ALOCACAO`, terminal): 4 handles `type="target"` com `id="top"`/`"right"`/`"bottom"`/`"left"` sempre presentes; os mesmos 4 `id`s como `type="source"` só quando `!isAlocacao`, exatamente como a condição que já existe hoje para o único handle source atual.
- **`DecisionNode`** (2 saídas com significado fixo — SIM e NAO, o `id` do handle é o que a store usa para gravar `WorkflowEdge.branch`): 4 handles `type="target"` com os mesmos `id`s de lado (entrada não carrega branch, mas ainda precisa de `id` único por lado); e, para cada um dos 4 lados, um **par** de handles source com `id="SIM-top"`/`"NAO-top"`, `"SIM-right"`/`"NAO-right"` etc. (verde/vermelho) — **8 ids distintos**, não reaproveitando literalmente `"SIM"`/`"NAO"` puro, porque cada handle no DOM do Vue Flow precisa de um id verdadeiramente único no nó.

**Mudança necessária, não prevista na primeira versão deste spec** — como o `id` do handle passa a carregar informação de posição (`"SIM-top"`, não só `"SIM"`), o código que deriva `branch`/`label` a partir de `sourceHandle` precisa normalizar, e o código que decide se um `sourceHandle` é uma branch válida precisa checar o prefixo, não igualdade exata. Dois pontos em `WorkflowTemplateEditorView.vue` mudam:

```typescript
// Helper novo, usado nos dois pontos abaixo.
function branchFromHandle(sourceHandle: string | null | undefined): 'SIM' | 'NAO' | null {
  if (sourceHandle?.startsWith('SIM-')) return 'SIM'
  if (sourceHandle?.startsWith('NAO-')) return 'NAO'
  return null
}

function onConnect(connection: Connection): void {
  const branch = branchFromHandle(connection.sourceHandle)
  flowEdges.value.push({
    id: `edge-${connection.source}-${connection.target}-${connection.sourceHandle ?? ''}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? undefined,
    type: 'smoothstep',
    label: branch ?? undefined,
  })
}
```

```typescript
// Dentro de handleSave, no map de edges:
edges: flowEdges.value.map((e) => ({
  fromClientId: e.source,
  toClientId: e.target,
  branch: branchFromHandle(e.sourceHandle),
})),
```

Sem essa correção, um handle `"right"`/`"top"` de um `OperationNode` (que não tem nada a ver com branch) vazaria pro campo `branch` do payload salvo — o Joi do backend rejeitaria (`branch` só aceita `SIM`/`NAO`/null), quebrando o salvamento de qualquer edge que não saia do lado direito de um `OperationNode`/`EntryNode`. Antes desta correção, isso não acontecia porque só existia 1 handle por lado, sem id, então `sourceHandle` já vinha `undefined` para qualquer edge que não fosse de decisão.

**Limitação aceita, não é bug:** o lado de onde uma edge normal (não-decisão) sai visualmente **não é persistido** — só `fromNodeId`/`toNodeId`/`branch` são salvos no backend (`WorkflowEdge` não tem, e não ganha, um campo de handle/lado). Ao recarregar um template salvo, o Vue Flow reconecta essas edges usando um handle padrão, então o roteamento visual escolhido durante a edição pode não sobreviver a um reload. Isso resolve o problema relatado (rotear sem cruzar linhas *durante* a montagem do fluxo), mas não é uma persistência completa de layout de conectores — se isso incomodar na prática depois de usar por um tempo, persistir o lado escolhido é um incremento futuro (exigiria campo novo em `WorkflowEdge`, fora do escopo deste spec, que é frontend-only).

Nenhuma mudança de modelo de dados: `WorkflowEdge.branch` continua vindo só do `id` do handle de origem (normalizado por `branchFromHandle`), nunca da posição/lado. A task de implementação deve confirmar visualmente (screenshot, dark e light) que os 8 handles do `OperationNode` normal e os 4+8 do `DecisionNode` não colidem visualmente em nós pequenos — pode ser necessário um `min-width`/`min-height` maior nos nós para os handles dos 4 lados não ficarem espremidos.

### 2.4 O que NÃO muda

- Nenhum campo novo no `WorkflowNode`/`WorkflowEdge`/`WorkflowTemplate` (backend Prisma) — os handles são só apresentação do Vue Flow, o dado persistido continua sendo `fromNodeId`/`toNodeId`/`branch`.
- Nenhuma rota, controller, service ou validator do backend muda.
- Nenhuma mudança nas regras de validação de grafo (`docs/superpowers/specs/2026-09-04-workflow-dinamico-wms-design.md`, seção 3) — entrada única, sem ciclo, `ALOCACAO` terminal continuam exatamente como estão, reforçadas no backend.
- A paleta de tipos de operação (`WORKFLOW_NODE_LABELS`) já está em português — não precisa de tradução.

## 3. Testes

- `ConditionRuleBuilder.spec.ts` (já existe): adicionar asserções de que os `<option>` do seletor de campo/operador mostram o texto traduzido (`CONDITION_FIELD_LABELS`/`CONDITION_OPERATOR_LABELS`), não o valor técnico cru.
- Teste (novo ou nos specs existentes de `EntryNode`/`DecisionNode`/`OperationNode`, se existirem — conferir antes de criar arquivo novo) confirmando que cada tipo de nó renderiza o número esperado de handles (4 para `EntryNode`; 8 para `OperationNode` não-`ALOCACAO`, 4 para `ALOCACAO`; 4+8 para `DecisionNode`) e que os `id`s `SIM`/`NAO` do `DecisionNode` continuam presentes em todos os 4 pares.
- Teste de regressão confirmando que criar uma aresta a partir de qualquer um dos 4 handles `SIM`/`NAO` do `DecisionNode` grava `branch: 'SIM'`/`'NAO'` corretamente no payload enviado ao salvar (não só que o handle existe visualmente).
- Sem testes de backend novos — nada muda lá.

## 4. Fora de escopo (registrado, não esquecido)

- Dropdown de categoria/fornecedor e checkbox de booleano no campo de valor da condição (seção 2.1).
- Expandir o motor de workflow para outros módulos (Manutenção, Compras, etc.) ou para Separação/Picking — decisão adiada pelo usuário para depois.
- Qualquer avaliação adicional de motores de workflow de terceiros (n8n ou outros) — descartada para o caso de uso do WMS Recebimento pelos motivos da seção 0; pode voltar à mesa no futuro para automações genéricas (notificações, integrações externas), mas não como substituto deste editor.
