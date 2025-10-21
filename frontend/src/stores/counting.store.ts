import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import countingService from '@/services/counting.service';
import type {
  CountingPlan,
  CountingSession,
  CountingItem,
  CountingDashboard,
  CreateCountingPlanDTO,
  UpdateCountingPlanDTO,
  CreateSessionDTO,
  CountItemDTO,
  RecountItemDTO,
  CountingPlanFilters,
  SessionFilters,
  ItemFilters,
} from '@/types/counting.types';

export const useCountingStore = defineStore('counting', () => {
  // State
  const plans = ref<CountingPlan[]>([]);
  const currentPlan = ref<CountingPlan | null>(null);
  const sessions = ref<CountingSession[]>([]);
  const currentSession = ref<CountingSession | null>(null);
  const items = ref<CountingItem[]>([]);
  const dashboard = ref<CountingDashboard | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const activePlans = computed(() => 
    plans.value.filter(p => p.status === 'ACTIVE')
  );

  const activeSessions = computed(() =>
    sessions.value.filter(s => s.status === 'IN_PROGRESS')
  );

  const pendingItems = computed(() =>
    items.value.filter(i => i.status === 'PENDING')
  );

  const itemsWithDivergence = computed(() =>
    items.value.filter(i => i.hasDifference)
  );

  // Actions - Planos
  async function fetchPlans(filters?: CountingPlanFilters) {
    loading.value = true;
    error.value = null;
    try {
      plans.value = await countingService.getPlans(filters);
    } catch (err: any) {
      error.value = err.message || 'Erro ao carregar planos';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchPlan(id: string) {
    loading.value = true;
    error.value = null;
    try {
      currentPlan.value = await countingService.getPlan(id);
      return currentPlan.value;
    } catch (err: any) {
      error.value = err.message || 'Erro ao carregar plano';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createPlan(data: CreateCountingPlanDTO) {
    loading.value = true;
    error.value = null;
    try {
      const plan = await countingService.createPlan(data);
      plans.value.unshift(plan);
      return plan;
    } catch (err: any) {
      error.value = err.message || 'Erro ao criar plano';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function updatePlan(id: string, data: UpdateCountingPlanDTO) {
    loading.value = true;
    error.value = null;
    try {
      const plan = await countingService.updatePlan(id, data);
      const index = plans.value.findIndex(p => p.id === id);
      if (index !== -1) {
        plans.value[index] = plan;
      }
      if (currentPlan.value?.id === id) {
        currentPlan.value = plan;
      }
      return plan;
    } catch (err: any) {
      error.value = err.message || 'Erro ao atualizar plano';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function deletePlan(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await countingService.deletePlan(id);
      plans.value = plans.value.filter(p => p.id !== id);
    } catch (err: any) {
      error.value = err.message || 'Erro ao deletar plano';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function activatePlan(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const plan = await countingService.activatePlan(id);
      const index = plans.value.findIndex(p => p.id === id);
      if (index !== -1) {
        plans.value[index] = plan;
      }
      return plan;
    } catch (err: any) {
      error.value = err.message || 'Erro ao ativar plano';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function pausePlan(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const plan = await countingService.pausePlan(id);
      const index = plans.value.findIndex(p => p.id === id);
      if (index !== -1) {
        plans.value[index] = plan;
      }
      return plan;
    } catch (err: any) {
      error.value = err.message || 'Erro ao pausar plano';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function cancelPlan(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const plan = await countingService.cancelPlan(id);
      const index = plans.value.findIndex(p => p.id === id);
      if (index !== -1) {
        plans.value[index] = plan;
      }
      return plan;
    } catch (err: any) {
      error.value = err.message || 'Erro ao cancelar plano';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Actions - Sessões
  async function fetchDashboard() {
    loading.value = true;
    error.value = null;
    try {
      dashboard.value = await countingService.getDashboard();
    } catch (err: any) {
      error.value = err.message || 'Erro ao carregar dashboard';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSessions(filters?: SessionFilters) {
    loading.value = true;
    error.value = null;
    try {
      sessions.value = await countingService.getSessions(filters);
    } catch (err: any) {
      error.value = err.message || 'Erro ao carregar sessões';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSession(id: string) {
    loading.value = true;
    error.value = null;
    try {
      currentSession.value = await countingService.getSession(id);
      return currentSession.value;
    } catch (err: any) {
      error.value = err.message || 'Erro ao carregar sessão';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createSession(data: CreateSessionDTO) {
    loading.value = true;
    error.value = null;
    try {
      const session = await countingService.createSession(data);
      sessions.value.unshift(session);
      return session;
    } catch (err: any) {
      error.value = err.message || 'Erro ao criar sessão';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function startSession(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const session = await countingService.startSession(id);
      const index = sessions.value.findIndex(s => s.id === id);
      if (index !== -1) {
        sessions.value[index] = session;
      }
      if (currentSession.value?.id === id) {
        currentSession.value = session;
      }
      return session;
    } catch (err: any) {
      error.value = err.message || 'Erro ao iniciar sessão';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function completeSession(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const session = await countingService.completeSession(id);
      const index = sessions.value.findIndex(s => s.id === id);
      if (index !== -1) {
        sessions.value[index] = session;
      }
      if (currentSession.value?.id === id) {
        currentSession.value = session;
      }
      return session;
    } catch (err: any) {
      error.value = err.message || 'Erro ao completar sessão';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function cancelSession(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const session = await countingService.cancelSession(id);
      const index = sessions.value.findIndex(s => s.id === id);
      if (index !== -1) {
        sessions.value[index] = session;
      }
      return session;
    } catch (err: any) {
      error.value = err.message || 'Erro ao cancelar sessão';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function adjustStock(id: string) {
    loading.value = true;
    error.value = null;
    try {
      const result = await countingService.adjustStock(id);
      return result;
    } catch (err: any) {
      error.value = err.message || 'Erro ao ajustar estoque';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  // Actions - Itens
  async function fetchItems(filters?: ItemFilters) {
    loading.value = true;
    error.value = null;
    try {
      items.value = await countingService.getItems(filters);
    } catch (err: any) {
      error.value = err.message || 'Erro ao carregar itens';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function countItem(id: string, data: CountItemDTO) {
    loading.value = true;
    error.value = null;
    try {
      const item = await countingService.countItem(id, data);
      const index = items.value.findIndex(i => i.id === id);
      if (index !== -1) {
        items.value[index] = item;
      }
      return item;
    } catch (err: any) {
      error.value = err.message || 'Erro ao contar item';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function recountItem(id: string, data: RecountItemDTO) {
    loading.value = true;
    error.value = null;
    try {
      const item = await countingService.recountItem(id, data);
      const index = items.value.findIndex(i => i.id === id);
      if (index !== -1) {
        items.value[index] = item;
      }
      return item;
    } catch (err: any) {
      error.value = err.message || 'Erro ao recontar item';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function acceptItem(id: string, reason?: string) {
    loading.value = true;
    error.value = null;
    try {
      const item = await countingService.acceptItem(id, reason);
      const index = items.value.findIndex(i => i.id === id);
      if (index !== -1) {
        items.value[index] = item;
      }
      return item;
    } catch (err: any) {
      error.value = err.message || 'Erro ao aceitar item';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function cancelItem(id: string, reason?: string) {
    loading.value = true;
    error.value = null;
    try {
      const item = await countingService.cancelItem(id, reason);
      const index = items.value.findIndex(i => i.id === id);
      if (index !== -1) {
        items.value[index] = item;
      }
      return item;
    } catch (err: any) {
      error.value = err.message || 'Erro ao cancelar item';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchPendingItems() {
    loading.value = true;
    error.value = null;
    try {
      items.value = await countingService.getPendingItems();
    } catch (err: any) {
      error.value = err.message || 'Erro ao carregar itens pendentes';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function clearError() {
    error.value = null;
  }

  return {
    // State
    plans,
    currentPlan,
    sessions,
    currentSession,
    items,
    dashboard,
    loading,
    error,
    // Computed
    activePlans,
    activeSessions,
    pendingItems,
    itemsWithDivergence,
    // Actions
    fetchPlans,
    fetchPlan,
    createPlan,
    updatePlan,
    deletePlan,
    activatePlan,
    pausePlan,
    cancelPlan,
    fetchDashboard,
    fetchSessions,
    fetchSession,
    createSession,
    startSession,
    completeSession,
    cancelSession,
    adjustStock,
    fetchItems,
    countItem,
    recountItem,
    acceptItem,
    cancelItem,
    fetchPendingItems,
    clearError,
  };
});
