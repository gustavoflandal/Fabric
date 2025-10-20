import { defineStore } from 'pinia';
import { ref } from 'vue';
import productService, { type Product, type CreateProductDto, type UpdateProductDto } from '@/services/product.service';

export const useProductStore = defineStore('product', () => {
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchProducts = async (page = 1, limit = 100, filters?: { type?: string; categoryId?: string; active?: boolean; search?: string }) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await productService.getAll(page, limit, filters);
      products.value = response.data.data;
      return response.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar produtos';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const getProductById = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await productService.getById(id);
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao carregar produto';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createProduct = async (data: CreateProductDto) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await productService.create(data);
      await fetchProducts();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao criar produto';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateProduct = async (id: string, data: UpdateProductDto) => {
    try {
      loading.value = true;
      error.value = null;
      const response = await productService.update(id, data);
      await fetchProducts();
      return response.data.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao atualizar produto';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      await productService.delete(id);
      await fetchProducts();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao excluir produto';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const toggleActive = async (id: string) => {
    try {
      loading.value = true;
      error.value = null;
      await productService.toggleActive(id);
      await fetchProducts();
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Erro ao alterar status';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    products,
    loading,
    error,
    fetchProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    toggleActive,
  };
});
