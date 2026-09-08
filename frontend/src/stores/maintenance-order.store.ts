import { defineStore } from 'pinia'
import { ref } from 'vue'
import maintenanceOrderService, {
  type MaintenanceOrder,
  type CreateCorrectiveOrderDto,
  type MaintenanceOrderType,
  type MaintenanceOrderStatus,
} from '@/services/maintenance-order.service'

export const useMaintenanceOrderStore = defineStore('maintenanceOrder', () => {
  const orders = ref<MaintenanceOrder[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchOrders = async (
    page = 1,
    limit = 100,
    filters?: { equipmentId?: string; type?: MaintenanceOrderType; status?: MaintenanceOrderStatus }
  ) => {
    try {
      loading.value = true
      error.value = null
      const response = await maintenanceOrderService.getAll(page, limit, filters)
      orders.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar ordens de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createOrder = async (data: CreateCorrectiveOrderDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await maintenanceOrderService.create(data)
      await fetchOrders()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao abrir ordem de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const startOrder = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await maintenanceOrderService.start(id)
      await fetchOrders()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao iniciar ordem'
      throw err
    } finally {
      loading.value = false
    }
  }

  const completeOrder = async (id: string, resolutionNotes: string) => {
    try {
      loading.value = true
      error.value = null
      await maintenanceOrderService.complete(id, resolutionNotes)
      await fetchOrders()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao concluir ordem'
      throw err
    } finally {
      loading.value = false
    }
  }

  const cancelOrder = async (id: string, reason?: string) => {
    try {
      loading.value = true
      error.value = null
      await maintenanceOrderService.cancel(id, reason)
      await fetchOrders()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao cancelar ordem'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { orders, loading, error, fetchOrders, createOrder, startOrder, completeOrder, cancelOrder }
})
