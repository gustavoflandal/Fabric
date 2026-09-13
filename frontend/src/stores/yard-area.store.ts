import { defineStore } from 'pinia'
import { ref } from 'vue'
import yardAreaService, { type YardArea, type CreateYardAreaDto, type UpdateYardAreaDto } from '@/services/yard-area.service'

export const useYardAreaStore = defineStore('yardArea', () => {
  const areas = ref<YardArea[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchAreas = async (page = 1, limit = 100, filters?: { warehouseId?: string; blocked?: boolean }) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardAreaService.getAll(page, limit, filters)
      areas.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar áreas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createArea = async (data: CreateYardAreaDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardAreaService.create(data)
      await fetchAreas()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar área'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateArea = async (id: string, data: UpdateYardAreaDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await yardAreaService.update(id, data)
      await fetchAreas()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar área'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteArea = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await yardAreaService.delete(id)
      await fetchAreas()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir área'
      throw err
    } finally {
      loading.value = false
    }
  }

  const setBlocked = async (id: string, blocked: boolean, blockedReason: string | null) => {
    try {
      loading.value = true
      error.value = null
      await yardAreaService.setBlocked(id, blocked, blockedReason)
      await fetchAreas()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar bloqueio'
      throw err
    } finally {
      loading.value = false
    }
  }

  const generateSpots = async (areaId: string, count: number) => {
    try {
      loading.value = true
      error.value = null
      await yardAreaService.generateSpots(areaId, count)
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao gerar vagas'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { areas, loading, error, fetchAreas, createArea, updateArea, deleteArea, setBlocked, generateSpots }
})
