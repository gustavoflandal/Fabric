import { defineStore } from 'pinia'
import { ref } from 'vue'
import vehicleService, { type Vehicle, type CreateVehicleDto, type UpdateVehicleDto, type VehicleType } from '@/services/vehicle.service'

export const useVehicleStore = defineStore('vehicle', () => {
  const vehicles = ref<Vehicle[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchVehicles = async (
    page = 1,
    limit = 100,
    filters?: { supplierId?: string; fleetId?: string; type?: VehicleType; blocked?: boolean; search?: string }
  ) => {
    try {
      loading.value = true
      error.value = null
      const response = await vehicleService.getAll(page, limit, filters)
      vehicles.value = response.data.data
      return response.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar veículos'
      throw err
    } finally {
      loading.value = false
    }
  }

  const createVehicle = async (data: CreateVehicleDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await vehicleService.create(data)
      await fetchVehicles()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar veículo'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateVehicle = async (id: string, data: UpdateVehicleDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await vehicleService.update(id, data)
      await fetchVehicles()
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar veículo'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteVehicle = async (id: string) => {
    try {
      loading.value = true
      error.value = null
      await vehicleService.delete(id)
      await fetchVehicles()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir veículo'
      throw err
    } finally {
      loading.value = false
    }
  }

  const setBlocked = async (id: string, blocked: boolean, blockedReason: string | null) => {
    try {
      loading.value = true
      error.value = null
      await vehicleService.setBlocked(id, blocked, blockedReason)
      await fetchVehicles()
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar bloqueio'
      throw err
    } finally {
      loading.value = false
    }
  }

  return { vehicles, loading, error, fetchVehicles, createVehicle, updateVehicle, deleteVehicle, setBlocked }
})
