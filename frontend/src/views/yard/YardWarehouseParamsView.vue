<template>
  <AppLayout title="Parâmetros de Pátio" subtitle="Configure o uso de pátio e a tolerância de atraso por armazém">
    <Card class="mb-6">
      <FormField id="yard-params-warehouse" label="Armazém">
        <select
          v-model="selectedWarehouseId"
          class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          @change="loadParams"
        >
          <option v-for="wh in warehouseStore.warehouses" :key="wh.id" :value="wh.id">{{ wh.name }}</option>
        </select>
      </FormField>
    </Card>

    <Card v-if="selectedWarehouseId">
      <form @submit.prevent="handleSubmit" class="space-y-4 max-w-md">
        <div class="flex items-center">
          <input v-model="formData.useYard" type="checkbox" id="yard-params-use-yard" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="yard-params-use-yard" class="ml-2 text-sm text-gray-700 dark:text-gray-300">Usar etapa de Pátio (Portaria → Pátio → Doca)</label>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">Quando desmarcado, o fluxo passa direto de Portaria para Doca.</p>

        <FormField id="yard-params-tolerance" label="Tolerância de atraso (minutos)" required>
          <input
            v-model.number="formData.delayToleranceMinutes"
            type="number"
            min="0"
            max="60"
            required
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </FormField>

        <div class="pt-4">
          <Button type="submit" :disabled="saving">Salvar</Button>
        </div>
      </form>
    </Card>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWarehouseStore } from '@/stores/warehouse.store'
import yardWarehouseParamsService from '@/services/yard-warehouse-params.service'
import AppLayout from '@/components/common/AppLayout.vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import FormField from '@/components/common/FormField.vue'
import { useToast } from '@/composables/useToast'

const warehouseStore = useWarehouseStore()
const toast = useToast()

const selectedWarehouseId = ref('')
const saving = ref(false)
const formData = ref({ useYard: true, delayToleranceMinutes: 15 })

const loadParams = async () => {
  if (!selectedWarehouseId.value) return
  try {
    const result = await yardWarehouseParamsService.getByWarehouseId(selectedWarehouseId.value)
    formData.value = { useYard: result.data.data.useYard, delayToleranceMinutes: result.data.data.delayToleranceMinutes }
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao carregar parâmetros')
  }
}

const handleSubmit = async () => {
  try {
    saving.value = true
    await yardWarehouseParamsService.upsert(selectedWarehouseId.value, formData.value)
    toast.success('Parâmetros salvos com sucesso!')
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao salvar parâmetros')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await warehouseStore.fetchWarehouses()
  if (warehouseStore.warehouses.length > 0) {
    selectedWarehouseId.value = warehouseStore.warehouses[0].id
    await loadParams()
  }
})
</script>
