import { defineStore } from 'pinia'
import { ref } from 'vue'
import driverService, { type Driver, type CreateDriverDto, type UpdateDriverDto } from '@/services/driver.service'

export const useDriverStore = defineStore('driver', () => {
  const drivers = ref<Driver[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchDrivers = async (page = 1, limit = 100, filters?: { supplierId?: string; blocked?: boolean; search?: string }) => {
    try {
      loading.value = true
      error.value = null
      const response = await driverService.getAll(page, limit, filters)
      drivers.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar motoristas'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createDriver = async (data: CreateDriverDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await driverService.create(data)
      await fetchDrivers()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar motorista'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateDriver = async (id: string, data: UpdateDriverDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await driverService.update(id, data)
      await fetchDrivers()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar motorista'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteDriver = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await driverService.delete(id)
      await fetchDrivers()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir motorista'
      throw err
    } finally {
      loading.value = false
    }
  }

  const setBlocked = async (id: string, blocked: boolean, blockedReason: string | null) => {
    try {
      loading.value = true
      error.value = null
      await driverService.setBlocked(id, blocked, blockedReason)
      await fetchDrivers()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar bloqueio'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { drivers, loading, error, fetchDrivers, createDriver, updateDriver, deleteDriver, setBlocked }
})
