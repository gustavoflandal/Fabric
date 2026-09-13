import { defineStore } from 'pinia'
import { ref } from 'vue'
import yardSpotService, { type YardSpot, type UpdateYardSpotDto } from '@/services/yard-spot.service'

export const useYardSpotStore = defineStore('yardSpot', () => {
  const spots = ref<YardSpot[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchSpots = async (page = 1, limit = 100, filters?: { areaId?: string; blocked?: boolean }) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardSpotService.getAll(page, limit, filters)
      spots.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar vagas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateSpot = async (id: string, data: UpdateYardSpotDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardSpotService.update(id, data)
      await fetchSpots()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar vaga'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteSpot = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardSpotService.delete(id)
      await fetchSpots()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir vaga'
      throw err
    } finally {
      loading.value = false
    }
  }

  const setBlocked = async (id: string, blocked: boolean, blockedReason: string | null) => {
    try {
      loading.value = true
      error.value = null
      await yardSpotService.setBlocked(id, blocked, blockedReason)
      await fetchSpots()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar bloqueio'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { spots, loading, error, fetchSpots, updateSpot, deleteSpot, setBlocked }
})
