import { defineStore } from 'pinia'
import { ref } from 'vue'
import yardDockService, { type YardDock, type CreateYardDockDto, type UpdateYardDockDto, type DockServiceType } from '@/services/yard-dock.service'

export const useYardDockStore = defineStore('yardDock', () => {
  const docks = ref<YardDock[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchDocks = async (page = 1, limit = 100, filters?: { warehouseId?: string; serviceType?: DockServiceType; active?: boolean }) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardDockService.getAll(page, limit, filters)
      docks.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar docas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createDock = async (data: CreateYardDockDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardDockService.create(data)
      await fetchDocks()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar doca'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateDock = async (id: string, data: UpdateYardDockDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardDockService.update(id, data)
      await fetchDocks()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar doca'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteDock = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardDockService.delete(id)
      await fetchDocks()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir doca'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { docks, loading, error, fetchDocks, createDock, updateDock, deleteDock }
})
