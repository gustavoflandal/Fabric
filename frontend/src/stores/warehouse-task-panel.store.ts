import { defineStore } from 'pinia'
import { ref } from 'vue'
import warehouseTaskService from '@/services/warehouse-task.service'
import type { ReceiptOperation, PanelScope } from '@/types/warehouse-task.types'

export const useWarehouseTaskPanelStore = defineStore('warehouseTaskPanel', () => {
  const operations = ref<ReceiptOperation[]>([])
  const loading = ref(false)
  const error = ref('')

  const fetchPanel = async (scope: PanelScope): Promise<void> => {
    loading.value = true
    error.value = ''
    try {
      const response = await warehouseTaskService.getPanel(scope)
      operations.value = response.data.data || []
    } catch (err) {
      error.value = 'Não foi possível carregar o painel de operações.'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    operations,
    loading,
    error,
    fetchPanel,
  }
})
