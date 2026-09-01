import { defineStore } from 'pinia'
import { ref } from 'vue'
import bomService, { type Bom, type CreateBomDto, type UpdateBomDto } from '@/services/bom.service'

type BomCache = Record<string, Bom[]>

export const useBomStore = defineStore('bom', () => {
  const bomsByProduct = ref<BomCache>({})
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchByProduct = async (productId: string) => {
    try {
      loading.value = true
      error.value = null
      const response = await bomService.list(productId)
      bomsByProduct.value = {
        ...bomsByProduct.value,
        [productId]: response.data.data,
      }
      return response.data.data as Bom[]
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar BOMs'
      throw err
    } finally {
      loading.value = false
    }
  }

  const getCachedBoms = (productId: string) => bomsByProduct.value[productId] || []

  const createBom = async (data: CreateBomDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await bomService.create(data)
      const created = response.data.data as Bom
      const productBoms = getCachedBoms(data.productId)
      bomsByProduct.value = {
        ...bomsByProduct.value,
        [data.productId]: [created, ...productBoms],
      }
      return created
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar BOM'
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateBom = async (id: string, productId: string, data: UpdateBomDto) => {
    try {
      loading.value = true
      error.value = null
      const response = await bomService.update(id, data)
      const updated = response.data.data as Bom
      const list = getCachedBoms(productId).map((bom) => (bom.id === id ? updated : bom))
      bomsByProduct.value = {
        ...bomsByProduct.value,
        [productId]: list,
      }
      return updated
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar BOM'
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteBom = async (id: string, productId: string) => {
    try {
      loading.value = true
      error.value = null
      await bomService.delete(id)
      const list = getCachedBoms(productId).filter((bom) => bom.id !== id)
      bomsByProduct.value = {
        ...bomsByProduct.value,
        [productId]: list,
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir BOM'
      throw err
    } finally {
      loading.value = false
    }
  }

  const setActiveBom = async (id: string, productId: string, active: boolean) => {
    try {
      loading.value = true
      error.value = null
      const response = await bomService.setActive(id, active)
      const updated = response.data.data as Bom
      const list = getCachedBoms(productId).map((bom) => ({
        ...bom,
        active: bom.id === id ? updated.active : false,
      }))
      bomsByProduct.value = {
        ...bomsByProduct.value,
        [productId]: list,
      }
      return updated
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar BOM ativa'
      throw err
    } finally {
      loading.value = false
    }
  }

  const explode = async (id: string, quantity?: number) => {
    try {
      loading.value = true
      error.value = null
      const response = await bomService.explode(id, quantity)
      return response.data.data
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao calcular explosão da BOM'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    bomsByProduct,
    loading,
    error,
    fetchByProduct,
    getCachedBoms,
    createBom,
    updateBom,
    deleteBom,
    setActiveBom,
    explode,
  }
})
