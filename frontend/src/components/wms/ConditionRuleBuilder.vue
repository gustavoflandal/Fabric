<template>
  <div class="space-y-2">
    <div v-if="isGroup(rule)" class="border border-gray-200 rounded-md p-3 space-y-2">
      <div class="flex items-center gap-2">
        <select
          :value="rule.op"
          class="text-xs border-gray-300 rounded-md"
          @change="setGroupOp(($event.target as HTMLSelectElement).value as 'AND' | 'OR')"
        >
          <option value="AND">E (todas as condições)</option>
          <option value="OR">OU (qualquer uma)</option>
        </select>
        <button type="button" class="text-xs text-red-600 hover:underline" @click="emitRule(null)">
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
        <button type="button" class="text-xs text-primary-600 hover:underline" @click="addClause('leaf')">
          + condição
        </button>
        <button type="button" class="text-xs text-primary-600 hover:underline" @click="addClause('group')">
          + subgrupo
        </button>
      </div>
    </div>

    <div v-else-if="rule" class="flex items-center gap-2">
      <select
        :value="rule.field"
        class="text-xs border-gray-300 rounded-md"
        @change="updateLeaf({ field: ($event.target as HTMLSelectElement).value as any })"
      >
        <option v-for="field in CONDITION_FIELDS" :key="field" :value="field">{{ field }}</option>
      </select>
      <select
        :value="rule.operator"
        class="text-xs border-gray-300 rounded-md"
        @change="updateLeaf({ operator: ($event.target as HTMLSelectElement).value as any })"
      >
        <option v-for="op in OPERATORS" :key="op" :value="op">{{ op }}</option>
      </select>
      <input
        :value="localLeafValue"
        type="text"
        class="text-xs border-gray-300 rounded-md w-24"
        @input="localLeafValue = ($event.target as HTMLInputElement).value"
        @blur="commitLeafValue"
      />
      <button type="button" class="text-xs text-red-600 hover:underline" @click="emitRule(null)">✕</button>
    </div>

    <button v-else type="button" class="text-xs text-primary-600 hover:underline" @click="addClause('leaf')">
      + adicionar condição
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CONDITION_FIELDS } from '@/types/workflow.types'
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
