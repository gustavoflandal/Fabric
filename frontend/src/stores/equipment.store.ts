import { defineStore } from 'pinia'
import { ref } from 'vue'
import equipmentService, { type Equipment, type CreateEquipmentDto, type UpdateEquipmentDto } from '@/services/equipment.service'

export const useEquipmentStore = defineStore('equipment', () => {
  const equipment = ref<Equipment[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchEquipment = async (page = 1, limit = 100, filters?: { workCenterId?: string; active?: boolean; search?: string }) => {
    try {
      loading.value = true
      error.value = null
      const response = await equipmentService.getAll(page, limit, filters)
      equipment.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar equipamentos'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createEquipment = async (data: CreateEquipmentDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await equipmentService.create(data)
      await fetchEquipment()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar equipamento'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateEquipment = async (id: string, data: UpdateEquipmentDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await equipmentService.update(id, data)
      await fetchEquipment()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar equipamento'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteEquipment = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await equipmentService.delete(id)
      await fetchEquipment()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir equipamento'
      throw err
    } finally {
      loading.value = false
    }
  }

  const toggleActive = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await equipmentService.toggleActive(id)
      await fetchEquipment()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar status'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { equipment, loading, error, fetchEquipment, createEquipment, updateEquipment, deleteEquipment, toggleActive }
})
