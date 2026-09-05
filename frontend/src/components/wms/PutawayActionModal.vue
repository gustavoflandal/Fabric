<template>
  <AppModal :model-value="modelValue" title="Alocação" size="md" @update:model-value="emit('update:modelValue', $event)">
    <p class="text-sm text-gray-700 mb-4">
      Endereçar itens do recebimento <strong>{{ receiptNumber }}</strong>.
    </p>

    <button type="button" class="text-sm text-primary-600 hover:underline mb-4" @click="printSupportDocument">
      🖨️ Imprimir documento de apoio
    </button>

    <FormField label="Item" required class="mb-3">
      <select v-model="selectedItemId" class="w-full rounded-md border-gray-300 text-sm" @change="onItemChange">
        <option v-for="item in items" :key="item.receiptItemId" :value="item.receiptItemId">
          {{ item.code }} — {{ item.name }} ({{ item.quantity }})
        </option>
      </select>
    </FormField>

    <FormField label="Posição sugerida" hint="Clique para usar, ou digite outro código abaixo" class="mb-3">
      <p v-if="loadingSuggestion" class="text-xs text-gray-500">Buscando sugestão...</p>
      <button
        v-else-if="suggestion"
        type="button"
        class="text-sm border border-primary-300 rounded-md px-3 py-1 bg-primary-50 hover:bg-primary-100"
        @click="positionCode = suggestion!.code; storagePositionId = suggestion!.positionId"
      >
        {{ suggestion.code }} (score {{ suggestion.score }})
      </button>
      <p v-else class="text-xs text-gray-500">Nenhuma sugestão disponível — informe a posição manualmente.</p>
    </FormField>

    <FormField label="Posição (código)" required class="mb-3">
      <input
        v-model="positionCode"
        type="text"
        class="w-full rounded-md border-gray-300 text-sm"
        placeholder="ARM-RUA-AA-PP"
        @blur="resolvePositionCode"
      />
      <p v-if="positionResolutionError" class="text-xs text-red-600 mt-1">{{ positionResolutionError }}</p>
    </FormField>

    <FormField label="Quantidade" required class="mb-3">
      <input v-model.number="quantity" type="number" min="0" step="0.01" class="w-full rounded-md border-gray-300 text-sm" />
    </FormField>

    <div v-if="errorMessage" class="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
      {{ errorMessage }}
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <button type="button" class="px-4 py-2 text-sm text-gray-700" @click="emit('update:modelValue', false)">
          Fechar
        </button>
        <button
          type="button"
          class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          :disabled="submitting || !storagePositionId || !quantity"
          @click="handleConfirm"
        >
          {{ submitting ? 'Endereçando...' : 'Endereçar' }}
        </button>
      </div>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AppModal from '@/components/common/AppModal.vue'
import FormField from '@/components/common/FormField.vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import storageRuleService from '@/services/storage-rule.service'
import { storagePositionService } from '@/services/storage-position.service'
import { buildTaskSupportDocument } from '@/utils/task-support-document'
import type { WarehouseTask } from '@/types/warehouse-task.types'
import type { PositionSuggestion } from '@/services/storage-rule.service'
import type { TaskSupportDocumentItem } from '@/utils/task-support-document'

type PutawayItem = TaskSupportDocumentItem & { receiptItemId: string; productId: string }

const props = defineProps<{
  modelValue: boolean
  task: WarehouseTask
  receiptNumber: string
  supplierName: string
  items: PutawayItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  completed: []
}>()

const selectedItemId = ref(props.items[0]?.receiptItemId ?? '')
const positionCode = ref('')
const storagePositionId = ref('')
const quantity = ref<number | null>(null)
const suggestion = ref<PositionSuggestion | null>(null)
const loadingSuggestion = ref(false)
const positionResolutionError = ref('')
const errorMessage = ref('')
const submitting = ref(false)

function currentItem(): PutawayItem | undefined {
  return props.items.find((item) => item.receiptItemId === selectedItemId.value)
}

async function onItemChange(): Promise<void> {
  suggestion.value = null
  storagePositionId.value = ''
  positionCode.value = ''
  positionResolutionError.value = ''
  const item = currentItem()
  if (!item) return

  quantity.value = Number(item.quantity)
  loadingSuggestion.value = true
  try {
    const response = await storageRuleService.suggestPosition(item.productId, Number(item.quantity))
    suggestion.value = response.data.data.suggestion
  } catch {
    // Sugestão é best-effort — falha aqui não impede o endereçamento manual.
    suggestion.value = null
  } finally {
    loadingSuggestion.value = false
  }
}

async function resolvePositionCode(): Promise<void> {
  positionResolutionError.value = ''
  if (!positionCode.value.trim()) return

  try {
    const response = await storagePositionService.getPositionByCode(positionCode.value.trim())
    storagePositionId.value = response.data.id
  } catch {
    storagePositionId.value = ''
    positionResolutionError.value = 'Posição não encontrada com este código.'
  }
}

function printSupportDocument(): void {
  const doc = buildTaskSupportDocument({
    taskType: 'ALOCACAO',
    receiptNumber: props.receiptNumber,
    supplierName: props.supplierName,
    items: props.items,
    positions: props.items.map((item) => ({
      productCode: item.code,
      suggestedCode: item.receiptItemId === selectedItemId.value ? suggestion.value?.code ?? null : null,
    })),
  })
  doc.save(`alocacao-${props.receiptNumber}.pdf`)
}

async function handleConfirm(): Promise<void> {
  const item = currentItem()
  if (!item || !storagePositionId.value || !quantity.value) return

  submitting.value = true
  errorMessage.value = ''
  try {
    await warehouseTaskService.putaway(props.task.id, {
      receiptItemId: item.receiptItemId,
      storagePositionId: storagePositionId.value,
      quantity: quantity.value,
    })
    emit('completed')
    emit('update:modelValue', false)
  } catch (error: any) {
    errorMessage.value = error?.response?.data?.message ?? 'Erro ao endereçar o item.'
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      selectedItemId.value = props.items[0]?.receiptItemId ?? ''
      onItemChange()
    }
  },
  { immediate: true }
)
</script>
