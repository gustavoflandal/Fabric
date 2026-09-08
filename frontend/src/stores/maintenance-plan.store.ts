import { defineStore } from 'pinia'
import { ref } from 'vue'
import maintenancePlanService, {
  type MaintenancePlan,
  type CreateMaintenancePlanDto,
  type UpdateMaintenancePlanDto,
} from '@/services/maintenance-plan.service'

export const useMaintenancePlanStore = defineStore('maintenancePlan', () => {
  const plans = ref<MaintenancePlan[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchPlans = async (page = 1, limit = 100, filters?: { equipmentId?: string; active?: boolean }) => {
    try {
      loading.value = true
      error.value = null
      const response = await maintenancePlanService.getAll(page, limit, filters)
      plans.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar planos de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createPlan = async (data: CreateMaintenancePlanDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await maintenancePlanService.create(data)
      await fetchPlans()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar plano de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updatePlan = async (id: string, data: UpdateMaintenancePlanDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await maintenancePlanService.update(id, data)
      await fetchPlans()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar plano de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deletePlan = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await maintenancePlanService.delete(id)
      await fetchPlans()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir plano de manutenção'
      throw err
    } finally {
      loading.value = false
    }
  }

  const toggleActive = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await maintenancePlanService.toggleActive(id)
      await fetchPlans()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar status'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { plans, loading, error, fetchPlans, createPlan, updatePlan, deletePlan, toggleActive }
})
