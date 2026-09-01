import axios from 'axios';

export const CountingPlanProductService = {
  addProduct: async (planId: string, productId: string, priority: number = 0) => {
    const response = await axios.post(`/api/counting/plans/${planId}/products`, { productId, priority });
    return response.data;
  },
  
  removeProduct: async (planId: string, productId: string) => {
    await axios.delete(`/api/counting/plans/${planId}/products/${productId}`);
  },
  
  listProducts: async (planId: string) => {
    const response = await axios.get(`/api/counting/plans/${planId}/products`);
    return response.data;
  },
  
  updatePriority: async (planId: string, productId: string, priority: number) => {
    const response = await axios.patch(`/api/counting/plans/${planId}/products/${productId}`, { priority });
    return response.data;
  }
};
