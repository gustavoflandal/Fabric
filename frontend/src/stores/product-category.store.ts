import { defineStore } from 'pinia';
import { ref } from 'vue';
import productCategoryService, { type ProductCategory, type CreateProductCategoryDto, type UpdateProductCategoryDto } from '@/services/product-category.service';

export const useProductCategoryStore = defineStore('productCategory', () => {
  const categories = ref<ProductCategory[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchCategories(filters?: { search?: string; parentId?: string | null }) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productCategoryService.getAll(1, 1000, filters);
      categories.value = response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar categorias';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function getCategoryById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productCategoryService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao buscar categoria';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createCategory(data: CreateProductCategoryDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productCategoryService.create(data);
      categories.value.push(response.data.data);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar categoria';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updateCategory(id: string, data: UpdateProductCategoryDto) {
    loading.value = true;
    error.value = null;
    try {
      const response = await productCategoryService.update(id, data);
      const index = categories.value.findIndex((c) => c.id === id);
      if (index !== -1) {
        categories.value[index] = response.data.data;
      }
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar categoria';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deleteCategory(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await productCategoryService.delete(id);
      categories.value = categories.value.filter((c) => c.id !== id);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir categoria';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    categories,
    loading,
    error,
    fetchCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
  };
});
