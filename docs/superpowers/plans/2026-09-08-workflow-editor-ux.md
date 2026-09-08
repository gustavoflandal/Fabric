# Melhorias de UX do editor de Workflow do WMS (Recebimento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o editor visual de Workflow do WMS (Recebimento) mais intuitivo para o operador: traduzir os campos/operadores técnicos do construtor de condições para português claro, e aumentar a fonte (hoje `text-xs`, 12px) em toda a interface do editor.

**Architecture:** Mudança puramente de apresentação no frontend (Vue 3 + Tailwind), sem tocar backend, schema, rotas ou o formato de dados salvo (`ConditionRule`, `WorkflowNode`, `WorkflowEdge`). Segue o padrão já usado para `WORKFLOW_NODE_LABELS` em `frontend/src/types/workflow.types.ts` — um dicionário `Record<Chave, string>` por cima de um valor técnico que continua sendo o que é persistido.

**Tech Stack:** Vue 3 Composition API + TailwindCSS + Vitest + Vue Test Utils (mesmo stack do resto do frontend do projeto).

## Global Constraints

- Nenhuma mudança de schema, service, controller, rota ou validator no backend — confirmado no spec, seção 2.3 ("O que NÃO muda").
- Os pontos de conexão (`<Handle>`) dos 3 componentes de nó (`EntryNode.vue`, `DecisionNode.vue`, `OperationNode.vue`) não são tocados nesta rodada — decisão explícita do usuário, registrada no spec seção 1. Só a classe de texto desses componentes muda.
- O `value` dos `<option>` em `ConditionRuleBuilder.vue` continua sendo a chave técnica (`field`/`operator`) — só o texto exibido (`{{ }}`) muda para o label traduzido. O formato de `ConditionRule` salvo no backend não muda.
- Troca de fonte é `text-xs` → `text-sm` (12px → 14px), nunca outro salto, e só nas ocorrências confirmadas no spec (seção 2.2) — não é find-and-replace cego em todo o projeto, só nos arquivos do editor de workflow listados.

---

### Task 1: Tradução de campos e operadores no construtor de condições

**Files:**
- Modify: `frontend/src/types/workflow.types.ts`
- Modify: `frontend/src/components/wms/ConditionRuleBuilder.vue`
- Test: `frontend/src/components/wms/__tests__/ConditionRuleBuilder.spec.ts`

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces: `CONDITION_FIELD_LABELS: Record<ConditionField, string>` e `CONDITION_OPERATOR_LABELS: Record<ConditionOperator, string>`, exportados de `frontend/src/types/workflow.types.ts` — nenhuma outra task deste plano depende deles (Task 2 é um arquivo/escopo diferente).

- [ ] **Step 1: Escrever os testes que falham**

Adicionar estes dois testes ao `describe('ConditionRuleBuilder', ...)` já existente em `frontend/src/components/wms/__tests__/ConditionRuleBuilder.spec.ts` (antes do `})` final do describe):

```typescript
  it('mostra o campo traduzido no seletor de campo, não o valor técnico cru', () => {
    const wrapper = mount(ConditionRuleBuilder, {
      props: { modelValue: { field: 'product.weight', operator: 'eq', value: '' } },
    })
    const fieldSelect = wrapper.findAll('select')[0]
    expect(fieldSelect.text()).toContain('Peso do produto (kg)')
    expect(fieldSelect.text()).not.toContain('product.weight')
  })

  it('mostra o operador traduzido no seletor de operador, não o código técnico cru', () => {
    const wrapper = mount(ConditionRuleBuilder, {
      props: { modelValue: { field: 'product.weight', operator: 'gte', value: '' } },
    })
    const operatorSelect = wrapper.findAll('select')[1]
    expect(operatorSelect.text()).toContain('maior ou igual a')
    expect(operatorSelect.text()).not.toContain('gte')
  })
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Rodar (a partir de `frontend/`): `npx vitest run src/components/wms/__tests__/ConditionRuleBuilder.spec.ts`
Esperado: as 2 novas asserções falham (`fieldSelect.text()` hoje é literalmente `product.weight`, não "Peso do produto (kg)"; `operatorSelect.text()` hoje é `gte`, não "maior ou igual a"). Os 6 testes já existentes continuam passando.

- [ ] **Step 3: Adicionar os dicionários de tradução em `workflow.types.ts`**

Em `frontend/src/types/workflow.types.ts`, inserir logo após a linha 13 (`export type ConditionOperator = ...`) e antes da linha 15 (`export interface ConditionLeaf`):

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

- [ ] **Step 4: Atualizar `ConditionRuleBuilder.vue` — tradução + fonte**

Substituir o conteúdo completo de `frontend/src/components/wms/ConditionRuleBuilder.vue` por:

```vue
<template>
  <div class="space-y-2">
    <div v-if="isGroup(rule)" class="border border-gray-200 rounded-md p-3 space-y-2">
      <div class="flex items-center gap-2">
        <select
          :value="rule.op"
          class="text-sm border-gray-300 rounded-md"
          @change="setGroupOp(($event.target as HTMLSelectElement).value as 'AND' | 'OR')"
        >
          <option value="AND">E (todas as condições)</option>
          <option value="OR">OU (qualquer uma)</option>
        </select>
        <button type="button" class="text-sm text-red-600 hover:underline" @click="emitRule(null)">
          Remover grupo
        </button>
      </div>

      <ConditionRuleBuilder
        v-for="(clause, index) in rule.clauses"
        :key="index"
        :model-value="clause"
        @update:model-value="(value) => updateClause(index, value)"
      />

      <div class="flex gap-2">
        <button type="button" class="text-sm text-primary-600 hover:underline" @click="addClause('leaf')">
          + condição
        </button>
        <button type="button" class="text-sm text-primary-600 hover:underline" @click="addClause('group')">
          + subgrupo
        </button>
      </div>
    </div>

    <div v-else-if="rule" class="flex items-center gap-2">
      <select
        :value="rule.field"
        class="text-sm border-gray-300 rounded-md"
        @change="updateLeaf({ field: ($event.target as HTMLSelectElement).value as any })"
      >
        <option v-for="field in CONDITION_FIELDS" :key="field" :value="field">{{ CONDITION_FIELD_LABELS[field] }}</option>
      </select>
      <select
        :value="rule.operator"
        class="text-sm border-gray-300 rounded-md"
        @change="updateLeaf({ operator: ($event.target as HTMLSelectElement).value as any })"
      >
        <option v-for="op in OPERATORS" :key="op" :value="op">{{ CONDITION_OPERATOR_LABELS[op] }}</option>
      </select>
      <input
        :value="localLeafValue"
        type="text"
        class="text-sm border-gray-300 rounded-md w-24"
        @input="localLeafValue = ($event.target as HTMLInputElement).value"
        @blur="commitLeafValue"
      />
      <button type="button" class="text-sm text-red-600 hover:underline" @click="emitRule(null)">✕</button>
    </div>

    <button v-else type="button" class="text-sm text-primary-600 hover:underline" @click="addClause('leaf')">
      + adicionar condição
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CONDITION_FIELDS, CONDITION_FIELD_LABELS, CONDITION_OPERATOR_LABELS } from '@/types/workflow.types'
import type { ConditionRule, ConditionLeaf, ConditionGroup, ConditionField } from '@/types/workflow.types'

const OPERATORS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains'] as const

interface Props {
  modelValue: ConditionRule | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: ConditionRule | null] }>()

const rule = computed(() => props.modelValue)

// F-WORKFLOW-FIX3 — string LOCAL, não-coercionada, do input de valor de uma
// leaf. Antes, `coerceValue` rodava em todo @input e o valor coercionado
// (número) voltava via v-model, reescrevendo o DOM com `String(rule.value)` —
// digitar "1." virava "1" (Number('1.') === 1) e o "." era apagado debaixo do
// usuário, tornando impossível digitar decimais como "1.5" num campo
// peso/volume (Float no schema). Agora o @input só atualiza este ref local
// (sem coagir, sem emitir); a coação + emit só acontece no @blur
// (commitLeafValue), quando o usuário termina de digitar.
const localLeafValue = ref(!isGroup(props.modelValue) && props.modelValue ? String(props.modelValue.value) : '')

watch(
  () => (rule.value && !isGroup(rule.value) ? rule.value.value : undefined),
  (value) => {
    if (value !== undefined) localLeafValue.value = String(value)
  }
)

function commitLeafValue(): void {
  updateLeaf({ value: coerceValue(localLeafValue.value) })
}

function isGroup(value: ConditionRule | null): value is ConditionGroup {
  return !!value && 'op' in value
}

function emitRule(value: ConditionRule | null): void {
  emit('update:modelValue', value)
}

function setGroupOp(op: 'AND' | 'OR'): void {
  if (isGroup(rule.value)) emitRule({ ...rule.value, op })
}

function updateClause(index: number, value: ConditionRule | null): void {
  if (!isGroup(rule.value)) return
  const clauses = [...rule.value.clauses]
  if (value === null) {
    clauses.splice(index, 1)
  } else {
    clauses[index] = value
  }
  emitRule({ ...rule.value, clauses })
}

function addClause(kind: 'leaf' | 'group'): void {
  // F-WORKFLOW-FIX4 — um subgrupo novo NUNCA pode nascer com `clauses: []`:
  // o Joi do backend exige `.min(1)` (um grupo AND vazio avalia `true` via
  // `[].every()`, e isso nunca pode persistir — a regra do backend está
  // certa e não deve ser relaxada). Antes disso, clicar em "+ subgrupo" e
  // salvar sem preencher nada gerava um payload que o Joi rejeitava com um
  // erro genérico. Semeando com uma leaf vazia (mesma forma que uma condição
  // nova já usa) o payload sempre nasce válido.
  const newClause: ConditionRule =
    kind === 'leaf'
      ? { field: CONDITION_FIELDS[0] as ConditionField, operator: 'eq', value: '' }
      : { op: 'AND', clauses: [{ field: CONDITION_FIELDS[0] as ConditionField, operator: 'eq', value: '' }] }

  if (isGroup(rule.value)) {
    emitRule({ ...rule.value, clauses: [...rule.value.clauses, newClause] })
  } else {
    emitRule(newClause)
  }
}

function updateLeaf(partial: Partial<ConditionLeaf>): void {
  if (!rule.value || isGroup(rule.value)) return
  emitRule({ ...rule.value, ...partial })
}

function coerceValue(raw: string): string | number | boolean {
  if (raw === 'true') return true
  if (raw === 'false') return false
  const asNumber = Number(raw)
  return raw !== '' && !Number.isNaN(asNumber) ? asNumber : raw
}
</script>
```

A única mudança de lógica é a linha de import (adiciona `CONDITION_FIELD_LABELS`, `CONDITION_OPERATOR_LABELS`) e os dois `<option>` (mostram o label em vez do valor cru). Todo o resto — comentários `F-WORKFLOW-FIX3`/`F-WORKFLOW-FIX4`, funções, watch — permanece idêntico ao arquivo atual; não remover esses comentários, eles documentam bugs reais já corrigidos.

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Rodar: `npx vitest run src/components/wms/__tests__/ConditionRuleBuilder.spec.ts`
Esperado: 8/8 (6 já existentes + 2 novos).

- [ ] **Step 6: Rodar a suíte completa do frontend**

Rodar (a partir de `frontend/`): `npx vitest run`
Esperado: todos os testes passando, sem queda em relação à contagem atual do projeto (baseline a conferir com `git log`/execução anterior — este plano não assume um número fixo, já que outras mudanças podem ter alterado a baseline entre a escrita deste plano e sua execução).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/workflow.types.ts frontend/src/components/wms/ConditionRuleBuilder.vue frontend/src/components/wms/__tests__/ConditionRuleBuilder.spec.ts
git commit -m "feat(wms-workflow): traduz campos e operadores do construtor de condições"
```

---

### Task 2: Fonte maior na view do editor e nos componentes de nó

**Files:**
- Modify: `frontend/src/views/wms/WorkflowTemplateEditorView.vue`
- Modify: `frontend/src/components/wms/workflow-nodes/EntryNode.vue`
- Modify: `frontend/src/components/wms/workflow-nodes/DecisionNode.vue`
- Modify: `frontend/src/components/wms/workflow-nodes/OperationNode.vue`
- Test: `frontend/src/components/wms/workflow-nodes/__tests__/OperationNode.spec.ts`

**Interfaces:**
- Consumes: nada de outras tasks (independente da Task 1 — arquivos diferentes).
- Produces: nada que outra task precise.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao `describe('OperationNode', ...)` já existente em `frontend/src/components/wms/workflow-nodes/__tests__/OperationNode.spec.ts` (antes do `})` final):

```typescript
  it('usa text-sm (não text-xs) no texto do nó', () => {
    const wrapper = mount(OperationNode, {
      props: { data: { type: 'DESCARGA' } },
      global: { stubs: { Handle: true } },
    })
    expect(wrapper.classes()).toContain('text-sm')
    expect(wrapper.classes()).not.toContain('text-xs')
  })
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Rodar (a partir de `frontend/`): `npx vitest run src/components/wms/workflow-nodes/__tests__/OperationNode.spec.ts`
Esperado: a nova asserção falha (`wrapper.classes()` hoje contém `text-xs`, não `text-sm`). Os 2 testes já existentes continuam passando.

- [ ] **Step 3: Trocar `text-xs` por `text-sm` nos 3 componentes de nó**

Em `frontend/src/components/wms/workflow-nodes/EntryNode.vue`, linha 2, trocar:
```vue
  <div class="px-4 py-2 rounded-full border-2 border-gray-700 bg-gray-100 text-xs font-semibold shadow-sm">
```
por:
```vue
  <div class="px-4 py-2 rounded-full border-2 border-gray-700 bg-gray-100 text-sm font-semibold shadow-sm">
```

Em `frontend/src/components/wms/workflow-nodes/DecisionNode.vue`, linha 2, trocar:
```vue
  <div class="px-3 py-2 rounded-lg border-2 border-purple-400 bg-purple-50 text-xs font-semibold shadow-sm whitespace-nowrap">
```
por:
```vue
  <div class="px-3 py-2 rounded-lg border-2 border-purple-400 bg-purple-50 text-sm font-semibold shadow-sm whitespace-nowrap">
```

Em `frontend/src/components/wms/workflow-nodes/OperationNode.vue`, linha 3, trocar:
```vue
    class="px-3 py-2 rounded-lg border-2 bg-white text-xs font-semibold shadow-sm whitespace-nowrap"
```
por:
```vue
    class="px-3 py-2 rounded-lg border-2 bg-white text-sm font-semibold shadow-sm whitespace-nowrap"
```

Nenhum `<Handle>` é tocado nos 3 arquivos — só a classe do `<div>` raiz.

- [ ] **Step 4: Trocar `text-xs` por `text-sm` em `WorkflowTemplateEditorView.vue`**

Na linha ~47 (item da paleta de operações dentro do `v-for="type in PALETTE_TYPES"`), trocar:
```vue
          class="text-xs border border-gray-300 rounded-md px-2 py-1 cursor-grab bg-gray-50"
```
por:
```vue
          class="text-sm border border-gray-300 rounded-md px-2 py-1 cursor-grab bg-gray-50"
```

Na linha ~76 (botão "Remover nó"), trocar:
```vue
        <button type="button" class="mt-3 text-xs text-red-600 hover:underline" @click="removeSelectedNode">
```
por:
```vue
        <button type="button" class="mt-3 text-sm text-red-600 hover:underline" @click="removeSelectedNode">
```

Não mexer no parágrafo `<p class="label mb-2">Nó selecionado: {{ selectedNodeLabel }}</p>` — usa a classe `label`, não `text-xs` (confirmado no spec, seção 2.2).

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Rodar: `npx vitest run src/components/wms/workflow-nodes/__tests__/OperationNode.spec.ts`
Esperado: 3/3 (2 já existentes + 1 novo).

- [ ] **Step 6: Rodar a suíte completa do frontend + type-check**

Rodar (a partir de `frontend/`): `npx vitest run && npx vue-tsc --noEmit`
Esperado: todos os testes passando; `vue-tsc` sem NOVOS erros nos 4 arquivos tocados (mudança é só classe CSS, não deveria introduzir nenhum erro de tipo).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/wms/WorkflowTemplateEditorView.vue frontend/src/components/wms/workflow-nodes/EntryNode.vue frontend/src/components/wms/workflow-nodes/DecisionNode.vue frontend/src/components/wms/workflow-nodes/OperationNode.vue frontend/src/components/wms/workflow-nodes/__tests__/OperationNode.spec.ts
git commit -m "feat(wms-workflow): aumenta a fonte do editor de workflow (text-xs -> text-sm)"
```

---

## Verificação final (sem código, manual)

Depois das duas tasks: abrir o editor de um Workflow (`/wms/workflows/new` ou editar um existente) no navegador real, com os containers Docker apontando para o branch/worktree desta implementação, e confirmar visualmente (screenshot, dark e light):
1. Os `<select>` de campo e operador no construtor de condições mostram texto em português, nunca `product.*`/`order.*`/`eq`/`gte` etc.
2. A leitura geral do editor (paleta, nós, painel de nó selecionado, construtor de condições) está visivelmente mais confortável que antes — sem comparar pixel a pixel, só confirmar que não sobrou nenhum texto minúsculo residual esquecido pelas Steps 3-4 da Task 2.

Não é um step numerado de task porque não produz código nem commit — é a mesma checagem manual final que outras mudanças de UI deste projeto já usam (ver Task 11 do plano de Manutenção, `2026-09-07-manutencao-fase4.md`, como precedente).
