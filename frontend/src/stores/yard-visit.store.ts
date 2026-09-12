import { defineStore } from 'pinia'
import { ref } from 'vue'
import yardVisitService, {
  type YardVisit,
  type CreateYardVisitDto,
  type UpdateYardVisitDto,
  type CheckInYardVisitDto,
  type YardVisitStatus,
} from '@/services/yard-visit.service'

export const useYardVisitStore = defineStore('yardVisit', () => {
  const visits = ref<YardVisit[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchVisits = async (
    page = 1,
    limit = 100,
    filters?: { warehouseId?: string; status?: YardVisitStatus; serviceType?: string }
  ) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardVisitService.getAll(page, limit, filters)
      visits.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar visitas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createVisit = async (data: CreateYardVisitDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardVisitService.create(data)
      await fetchVisits()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar visita'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateVisit = async (id: string, data: UpdateYardVisitDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardVisitService.update(id, data)
      await fetchVisits()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar visita'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteVisit = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardVisitService.delete(id)
      await fetchVisits()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir visita'
      throw err
    } finally {
      loading.value = false
    }
  }

  const checkIn = async (id: string, data: CheckInYardVisitDto) => {
    try {
      loading.value = true
      error.value = null
      await yardVisitService.checkIn(id, data)
      await fetchVisits()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao fazer check-in'
      throw err
    } finally {
      loading.value = false
    }
  }

  const cancelVisit = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardVisitService.cancel(id)
      await fetchVisits()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao cancelar visita'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { visits, loading, error, fetchVisits, createVisit, updateVisit, deleteVisit, checkIn, cancelVisit }
})
