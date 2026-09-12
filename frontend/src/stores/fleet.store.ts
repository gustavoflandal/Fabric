import { defineStore } from 'pinia'
import { ref } from 'vue'
import fleetService, { type Fleet, type CreateFleetDto, type UpdateFleetDto } from '@/services/fleet.service'

export const useFleetStore = defineStore('fleet', () => {
  const fleets = ref<Fleet[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchFleets = async (page = 1, limit = 100, filters?: { supplierId?: string; blocked?: boolean }) => {
    try {
      loading.value = true
      error.value = null
      const response = await fleetService.getAll(page, limit, filters)
      fleets.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar frotas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createFleet = async (data: CreateFleetDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await fleetService.create(data)
      await fetchFleets()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar frota'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateFleet = async (id: string, data: UpdateFleetDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await fleetService.update(id, data)
      await fetchFleets()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar frota'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteFleet = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await fleetService.delete(id)
      await fetchFleets()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir frota'
      throw err
    } finally {
      loading.value = false
    }
  }

  const setBlocked = async (id: string, blocked: boolean, blockedReason: string | null) => {
    try {
      loading.value = true
      error.value = null
      await fleetService.setBlocked(id, blocked, blockedReason)
      await fetchFleets()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar bloqueio'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { fleets, loading, error, fetchFleets, createFleet, updateFleet, deleteFleet, setBlocked }
})
