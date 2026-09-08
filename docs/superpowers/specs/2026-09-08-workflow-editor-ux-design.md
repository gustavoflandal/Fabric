# Melhorias de UX do editor de Workflow do WMS (Recebimento)

**Data:** 2026-09-08
**Status:** design aprovado, aguardando plano de implementação (implementação adiada — ver seção 0)
**Escopo:** só frontend, só o editor visual (`WorkflowTemplateEditorView.vue` e os componentes que ele usa). Nenhuma mudança de schema, service ou rota no backend.

## 0. Por que este documento existe agora sem implementação imediata

Avaliando o motor de workflow dinâmico do WMS (spec anterior, `2026-09-04-workflow-dinamico-wms-design.md`), o usuário identificou problemas de UX no editor visual — não problemas de capacidade do motor. Uma alternativa (adotar um motor de terceiros como o n8n) foi considerada e descartada para este caso: o n8n é acionado por webhook/HTTP (não por chamada de função in-process), então substituí-lo exigiria abrir mão da garantia transacional que hoje existe entre a resolução do workflow e a criação de `WarehouseTask`, recriar por fora as validações de grafo específicas do domínio (entrada única, sem ciclo, `ALOCACAO` como terminal obrigatório) que hoje são reforçadas no backend, e somar infraestrutura nova (Postgres obrigatório em produção, Redis se for usar modo fila). Ficou decidido evoluir o editor atual em vez de substituí-lo.

Do levantamento inicial de 3 problemas (terminologia técnica, fonte pequena, pontos de conexão em só 2 lados), o usuário decidiu **não mexer nos pontos de conexão** — mantidos como estão — e focar em tornar o editor mais intuitivo para o operador: terminologia mais fácil de entender e fonte mais legível.

Este spec fica pronto (documento + plano de implementação) para quando a prioridade permitir — a fila imediata é fechar as pendências da fase corrente e iniciar o levantamento de requisitos do YMS.

## 1. Os 2 problemas no escopo (confirmados no código, não só na avaliação do usuário)

1. **Terminologia técnica/em inglês nos filtros e condições.** `ConditionRuleBuilder.vue` renderiza `CONDITION_FIELDS` cru num `<select>` (`product.weight`, `product.categoryId`, `order.supplierId`, …) e os operadores (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`) também sem tradução. Para comparar: os tipos de nó (`WORKFLOW_NODE_LABELS`) já são traduzidos corretamente ("Descarga", "Conferência" etc.) — só o construtor de condições ficou de fora dessa camada de tradução.
2. **Fonte pequena demais.** Praticamente toda a interface do editor usa `text-xs` (12px, a menor classe de texto do Tailwind): paleta de operações, nós no canvas, painel de nó selecionado, e todo o `ConditionRuleBuilder`.

**Fora de escopo, por decisão explícita do usuário:** os pontos de conexão (handles) dos nós continuam exatamente como estão — 1 handle fixo de entrada/saída em `OperationNode`/`EntryNode`, 2 handles SIM/NAO embaixo em `DecisionNode`. Nenhuma mudança nesta rodada.

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

**Fora de escopo, registrado para uma iteração futura:** o campo de valor da condição (`localLeafValue`) é hoje um `<input type="text">` genérico para qualquer campo — inclusive `product.categoryId`/`order.supplierId`, que são UUIDs, e `product.lotTracked`, que é booleano. Digitar um UUID de categoria/fornecedor de cabeça é tão pouco amigável quanto a terminologia técnica que este spec corrige. Resolver isso direito (um `<select>` de categoria/fornecedor populado pelas stores já existentes, um checkbox para `lotTracked`) é um trabalho maior — o `ConditionLeaf.value` precisaria variar de tipo de input por `field`, e as opções de categoria/fornecedor viriam de `useProductCategoryStore`/`useSupplierStore` (ambas já existem no projeto). Não faz parte desta rodada porque o usuário não pediu; fica registrado aqui para não se perder.

### 2.2 Fonte maior (Fix 2)

Troca sistemática de `text-xs` (12px) por `text-sm` (14px) nos arquivos do editor:
- `WorkflowTemplateEditorView.vue`: paleta de operações (linha ~47), label do nó selecionado (~70), botão remover nó (~76)
- `ConditionRuleBuilder.vue`: os 2 `<select>`, o `<input>` de valor, e os botões (+ condição, + subgrupo, remover, ✕)
- `EntryNode.vue`, `DecisionNode.vue`, `OperationNode.vue`: o texto do nó (hoje `text-xs font-semibold`) — só a classe de texto; os `<Handle>` existentes nestes 3 arquivos não são tocados (ver seção 1, fora de escopo)

Não é find-and-replace cego: onde `text-xs` está numa hierarquia visual intencional (ex.: um rótulo auxiliar menor que o texto principal ao lado), a task de implementação deve preservar a hierarquia subindo os dois um degrau (`text-xs`→`text-sm`, `text-sm`→`text-base`) em vez de igualar tudo. Na leitura destes arquivos hoje, não há essa hierarquia de dois níveis — é `text-xs` uniforme — então na prática deve ser uma troca direta, mas a task de implementação deve conferir cada ocorrência antes de aplicar, não assumir.

### 2.3 O que NÃO muda

- Os pontos de conexão (handles) dos 3 tipos de nó — decisão explícita do usuário, fora de escopo desta rodada (seção 1).
- Nenhum campo novo no `WorkflowNode`/`WorkflowEdge`/`WorkflowTemplate` (backend Prisma).
- Nenhuma rota, controller, service ou validator do backend muda.
- Nenhuma mudança nas regras de validação de grafo (`docs/superpowers/specs/2026-09-04-workflow-dinamico-wms-design.md`, seção 3).
- A paleta de tipos de operação (`WORKFLOW_NODE_LABELS`) já está em português — não precisa de tradução.
- `onConnect`/`handleSave` em `WorkflowTemplateEditorView.vue` — sem mudança nos handles, o fluxo de dados de `branch` continua exatamente como está hoje.

## 3. Testes

- `ConditionRuleBuilder.spec.ts` (já existe): adicionar asserções de que os `<option>` do seletor de campo/operador mostram o texto traduzido (`CONDITION_FIELD_LABELS`/`CONDITION_OPERATOR_LABELS`), não o valor técnico cru.
- Sem testes de handle/conector — fora de escopo.
- Sem testes de backend novos — nada muda lá.
- Verificação visual (screenshot, dark e light) da fonte maior no editor completo, como checagem manual final — não é algo que um teste automatizado de classe CSS cobre bem.

## 4. Fora de escopo (registrado, não esquecido)

- Pontos de conexão em 4 lados — decisão explícita do usuário nesta rodada, não descartada como ideia, só adiada.
- Dropdown de categoria/fornecedor e checkbox de booleano no campo de valor da condição (seção 2.1).
- Expandir o motor de workflow para outros módulos (Manutenção, Compras, etc.) ou para Separação/Picking — decisão adiada pelo usuário para depois.
- Qualquer avaliação adicional de motores de workflow de terceiros (n8n ou outros) — descartada para o caso de uso do WMS Recebimento pelos motivos da seção 0; pode voltar à mesa no futuro para automações genéricas (notificações, integrações externas), mas não como substituto deste editor.
