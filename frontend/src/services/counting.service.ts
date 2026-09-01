import api from './api';
import type {
  CountingPlan,
  CountingSession,
  CountingItem,
  CountingDashboard,
  CountingReport,
  CreateCountingPlanDTO,
  UpdateCountingPlanDTO,
  CreateSessionDTO,
  CountItemDTO,
  RecountItemDTO,
  CountingPlanFilters,
  SessionFilters,
  ItemFilters,
} from '@/types/counting.types';

class CountingService {
  // ============================================
  // PLANOS DE CONTAGEM
  // ============================================

  async getPlans(filters?: CountingPlanFilters): Promise<CountingPlan[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.frequency) params.append('frequency', filters.frequency);
    if (filters?.search) params.append('search', filters.search);

    const response = await api.get(`/counting/plans?${params.toString()}`);
    return response.data;
  }

  async getPlan(id: string): Promise<CountingPlan> {
    const response = await api.get(`/counting/plans/${id}`);
    return response.data;
  }

  async createPlan(data: CreateCountingPlanDTO): Promise<CountingPlan> {
    const response = await api.post('/counting/plans', data);
    return response.data;
  }

  async updatePlan(id: string, data: UpdateCountingPlanDTO): Promise<CountingPlan> {
    const response = await api.put(`/counting/plans/${id}`, data);
    return response.data;
  }

  async deletePlan(id: string): Promise<void> {
    await api.delete(`/counting/plans/${id}`);
  }

  async activatePlan(id: string): Promise<CountingPlan> {
    const response = await api.patch(`/counting/plans/${id}/activate`);
    return response.data;
  }

  async pausePlan(id: string): Promise<CountingPlan> {
    const response = await api.patch(`/counting/plans/${id}/pause`);
    return response.data;
  }

  async cancelPlan(id: string): Promise<CountingPlan> {
    const response = await api.patch(`/counting/plans/${id}/cancel`);
    return response.data;
  }

  async getPlanProducts(id: string): Promise<any[]> {
    const response = await api.get(`/counting/plans/${id}/products`);
    return response.data;
  }

  // ============================================
  // SESSÕES DE CONTAGEM
  // ============================================

  async getDashboard(): Promise<CountingDashboard> {
    const response = await api.get('/counting/dashboard');
    return response.data;
  }

  async getSessions(filters?: SessionFilters): Promise<CountingSession[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.planId) params.append('planId', filters.planId);
    if (filters?.assignedTo) params.append('assignedTo', filters.assignedTo);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);

    const response = await api.get(`/counting/sessions?${params.toString()}`);
    return response.data;
  }

  async getSession(id: string): Promise<CountingSession> {
    const response = await api.get(`/counting/sessions/${id}`);
    return response.data;
  }

  async createSession(data: CreateSessionDTO): Promise<CountingSession> {
    const response = await api.post('/counting/sessions', data);
    return response.data;
  }

  async startSession(id: string): Promise<CountingSession> {
    const response = await api.post(`/counting/sessions/${id}/start`);
    return response.data;
  }

  async completeSession(id: string): Promise<CountingSession> {
    const response = await api.post(`/counting/sessions/${id}/complete`);
    return response.data;
  }

  async cancelSession(id: string): Promise<CountingSession> {
    const response = await api.post(`/counting/sessions/${id}/cancel`);
    return response.data;
  }

  async getSessionReport(id: string): Promise<CountingReport> {
    const response = await api.get(`/counting/sessions/${id}/report`);
    return response.data;
  }

  async adjustStock(id: string): Promise<any> {
    const response = await api.post(`/counting/sessions/${id}/adjust-stock`);
    return response.data;
  }

  async getSessionDivergences(sessionId: string): Promise<CountingItem[]> {
    const response = await api.get(`/counting/sessions/${sessionId}/divergences`);
    return response.data;
  }

  // ============================================
  // ITENS DE CONTAGEM
  // ============================================

  async getItems(filters?: ItemFilters): Promise<CountingItem[]> {
    const params = new URLSearchParams();
    if (filters?.sessionId) params.append('sessionId', filters.sessionId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.hasDifference !== undefined) params.append('hasDifference', String(filters.hasDifference));
    if (filters?.productId) params.append('productId', filters.productId);

    const response = await api.get(`/counting/items?${params.toString()}`);
    return response.data;
  }

  async getItem(id: string): Promise<CountingItem> {
    const response = await api.get(`/counting/items/${id}`);
    return response.data;
  }

  async countItem(id: string, data: CountItemDTO): Promise<CountingItem> {
    const response = await api.post(`/counting/items/${id}/count`, data);
    return response.data;
  }

  async recountItem(id: string, data: RecountItemDTO): Promise<CountingItem> {
    const response = await api.post(`/counting/items/${id}/recount`, data);
    return response.data;
  }

  async acceptItem(id: string, reason?: string): Promise<CountingItem> {
    const response = await api.post(`/counting/items/${id}/accept`, { reason });
    return response.data;
  }

  async cancelItem(id: string, reason?: string): Promise<CountingItem> {
    const response = await api.post(`/counting/items/${id}/cancel`, { reason });
    return response.data;
  }

  async getPendingItems(): Promise<CountingItem[]> {
    const response = await api.get('/counting/items/pending/me');
    return response.data;
  }

  async getProductStats(productId: string): Promise<any> {
    const response = await api.get(`/counting/products/${productId}/stats`);
    return response.data;
  }
}

export default new CountingService();
