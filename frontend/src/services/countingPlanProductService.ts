import axios from 'axios';

export const CountingPlanProductService = {
  async addProduct(planId: string, productId: string, priority: number = 0) {
    const response = await axios.post(`/api/counting/plans/${planId}/products`, {
      productId,
      priority
    });
    return response.data;
  },
  
  async removeProduct(planId: string, productId: string) {
    await axios.delete(`/api/counting/plans/${planId}/products/${productId}`);
  },
  
  async listProducts(planId: string) {
    const response = await axios.get(`/api/counting/plans/${planId}/products`);
    return response.data;
  },
  
  async updatePriority(planId: string, productId: string, priority: number) {
    const response = await axios.patch(`/api/counting/plans/${planId}/products/${productId}`, {
      priority
    });
    return response.data;
  }
};
