<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <img src="/logo.png" alt="Fabric" class="h-10 w-auto" />
            <h1 class="ml-4 text-2xl font-bold text-primary-800">Fabric</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-gray-900">
              Dashboard
            </RouterLink>
            <span class="text-sm text-gray-700">
              Olá, <span class="font-semibold">{{ authStore.userName }}</span>
            </span>
            <button
              @click="handleLogout"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Page Title -->
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900">Notificações</h2>
        <p class="mt-2 text-sm text-gray-600">
          Gerencie todas as suas notificações do sistema
        </p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Críticas</p>
              <p class="text-3xl font-bold text-red-600 mt-2">{{ priorityCounts.critical }}</p>
            </div>
            <div class="p-3 bg-red-100 rounded-full">
              <span class="text-2xl">🔴</span>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Altas</p>
              <p class="text-3xl font-bold text-orange-600 mt-2">{{ priorityCounts.high }}</p>
            </div>
            <div class="p-3 bg-orange-100 rounded-full">
              <span class="text-2xl">⚠️</span>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Não Lidas</p>
              <p class="text-3xl font-bold text-blue-600 mt-2">{{ unreadCount }}</p>
            </div>
            <div class="p-3 bg-blue-100 rounded-full">
              <span class="text-2xl">📬</span>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Total</p>
              <p class="text-3xl font-bold text-gray-600 mt-2">{{ pagination.total }}</p>
            </div>
            <div class="p-3 bg-gray-100 rounded-full">
              <span class="text-2xl">📋</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters and Actions -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <!-- Filters -->
          <div class="flex flex-wrap gap-4">
            <!-- Category Filter -->
            <select
              v-model="filters.category"
              @change="applyFilters"
              class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas as Categorias</option>
              <option value="PRODUCTION">Produção</option>
              <option value="STOCK">Estoque</option>
              <option value="PURCHASE">Compras</option>
              <option value="QUALITY">Qualidade</option>
              <option value="CAPACITY">Capacidade</option>
            </select>

            <!-- Priority Filter -->
            <select
              v-model="filters.priority"
              @change="applyFilters"
              class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas as Prioridades</option>
              <option value="4">🔴 Críticas</option>
              <option value="3">⚠️ Altas</option>
              <option value="2">📊 Médias</option>
              <option value="1">📋 Baixas</option>
            </select>

            <!-- Read Filter -->
            <select
              v-model="filters.read"
              @change="applyFilters"
              class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Todas</option>
              <option value="false">Não Lidas</option>
              <option value="true">Lidas</option>
            </select>
          </div>

          <!-- Actions -->
          <div class="flex gap-2">
            <button
              v-if="unreadCount > 0"
              @click="markAllAsRead"
              class="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-600 hover:border-blue-800 rounded-lg transition-colors"
            >
              Marcar todas como lidas
            </button>
            <button
              @click="refreshNotifications"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 hover:border-gray-400 rounded-lg transition-colors"
            >
              🔄 Atualizar
            </button>
          </div>
        </div>
      </div>

      <!-- Notifications List -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <!-- Loading State -->
        <div v-if="loading" class="p-12 text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p class="mt-4 text-gray-600">Carregando notificações...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="notifications.length === 0" class="p-12 text-center">
          <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <p class="mt-4 text-lg font-medium text-gray-900">Nenhuma notificação encontrada</p>
          <p class="mt-2 text-sm text-gray-500">Tente ajustar os filtros ou aguarde novos eventos</p>
        </div>

        <!-- Notifications -->
        <div v-else class="divide-y divide-gray-200">
          <div
            v-for="notification in notifications"
            :key="notification.id"
            class="p-6 hover:bg-gray-50 transition-colors"
            :class="{ 'bg-blue-50': !notification.read }"
          >
            <div class="flex items-start">
              <!-- Icon -->
              <div class="flex-shrink-0 mt-1">
                <span
                  class="inline-flex items-center justify-center h-10 w-10 rounded-full"
                  :class="getIconClass(notification)"
                >
                  {{ getIcon(notification) }}
                </span>
              </div>

              <!-- Content -->
              <div class="ml-4 flex-1 min-w-0">
                <div class="flex items-start justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2">
                      <h3 class="text-base font-semibold text-gray-900">
                        {{ notification.title }}
                      </h3>
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="getCategoryClass(notification.category)"
                      >
                        {{ getCategoryLabel(notification.category) }}
                      </span>
                    </div>
                    <p class="mt-1 text-sm text-gray-600">
                      {{ notification.message }}
                    </p>
                    <div class="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span>{{ formatTimeAgo(notification.createdAt) }}</span>
                      <span v-if="notification.read" class="text-green-600">✓ Lida</span>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="ml-4 flex-shrink-0 flex items-center gap-2">
                    <button
                      v-if="!notification.read"
                      @click.stop="markAsRead(notification.id)"
                      class="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                      title="Marcar como lida"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      @click.stop="archiveNotification(notification.id)"
                      class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      title="Arquivar"
                    >
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.totalPages > 1" class="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div class="flex items-center justify-between">
            <div class="text-sm text-gray-600">
              Mostrando {{ (pagination.page - 1) * pagination.limit + 1 }} a 
              {{ Math.min(pagination.page * pagination.limit, pagination.total) }} de 
              {{ pagination.total }} notificações
            </div>
            <div class="flex gap-2">
              <button
                @click="goToPage(pagination.page - 1)"
                :disabled="pagination.page === 1"
                class="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Anterior
              </button>
              <button
                v-for="page in visiblePages"
                :key="page"
                @click="goToPage(page)"
                class="px-4 py-2 text-sm font-medium border rounded-lg transition-colors"
                :class="page === pagination.page 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'border-gray-300 hover:bg-gray-100'"
              >
                {{ page }}
              </button>
              <button
                @click="goToPage(pagination.page + 1)"
                :disabled="pagination.page === pagination.totalPages"
                class="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notification.store';
import { useAuthStore } from '@/stores/auth.store';
import type { Notification } from '@/services/notification.service';

const router = useRouter();
const notificationStore = useNotificationStore();
const authStore = useAuthStore();

const loading = ref(false);
const notifications = ref<Notification[]>([]);
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
});

const filters = ref({
  category: '',
  priority: '',
  read: '',
});

const unreadCount = computed(() => notificationStore.unreadCount);
const priorityCounts = computed(() => notificationStore.priorityCounts);

const visiblePages = computed(() => {
  const pages = [];
  const total = pagination.value.totalPages;
  const current = pagination.value.page;
  
  let start = Math.max(1, current - 2);
  let end = Math.min(total, current + 2);
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
});

const fetchNotifications = async () => {
  loading.value = true;
  
  try {
    const filterParams: any = {};
    
    if (filters.value.category) filterParams.category = filters.value.category;
    if (filters.value.priority) filterParams.priority = parseInt(filters.value.priority);
    if (filters.value.read !== '') filterParams.read = filters.value.read === 'true';
    
    const result = await notificationStore.fetchNotifications(
      filterParams,
      pagination.value.page,
      pagination.value.limit
    );
    
    notifications.value = result.data;
    pagination.value = result.pagination;
  } catch (error) {
    console.error('Erro ao carregar notificações:', error);
  } finally {
    loading.value = false;
  }
};

const applyFilters = () => {
  pagination.value.page = 1;
  fetchNotifications();
};

const goToPage = (page: number) => {
  pagination.value.page = page;
  fetchNotifications();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const refreshNotifications = async () => {
  await Promise.all([
    fetchNotifications(),
    notificationStore.updateUnreadCount(),
    notificationStore.updatePriorityCounts(),
  ]);
};

const markAsRead = async (id: string) => {
  try {
    await notificationStore.markAsRead(id);
    const notification = notifications.value.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      notification.readAt = new Date().toISOString();
    }
  } catch (error) {
    console.error('Erro ao marcar como lida:', error);
  }
};

const markAllAsRead = async () => {
  try {
    await notificationStore.markAllAsRead();
    notifications.value.forEach(n => {
      n.read = true;
      n.readAt = new Date().toISOString();
    });
  } catch (error) {
    console.error('Erro ao marcar todas como lidas:', error);
  }
};

const archiveNotification = async (id: string) => {
  try {
    await notificationStore.archive(id);
    notifications.value = notifications.value.filter(n => n.id !== id);
    pagination.value.total--;
  } catch (error) {
    console.error('Erro ao arquivar notificação:', error);
  }
};

const getIcon = (notification: Notification) => {
  if (notification.priority === 4) return '🔴';
  if (notification.priority === 3) return '⚠️';
  if (notification.type === 'SUCCESS') return '✅';
  return '📊';
};

const getIconClass = (notification: Notification) => {
  if (notification.priority === 4) return 'bg-red-100 text-red-600';
  if (notification.priority === 3) return 'bg-orange-100 text-orange-600';
  if (notification.type === 'SUCCESS') return 'bg-green-100 text-green-600';
  return 'bg-blue-100 text-blue-600';
};

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    PRODUCTION: 'Produção',
    STOCK: 'Estoque',
    PURCHASE: 'Compras',
    QUALITY: 'Qualidade',
    CAPACITY: 'Capacidade',
  };
  return labels[category] || category;
};

const getCategoryClass = (category: string) => {
  const classes: Record<string, string> = {
    PRODUCTION: 'bg-blue-100 text-blue-800',
    STOCK: 'bg-green-100 text-green-800',
    PURCHASE: 'bg-purple-100 text-purple-800',
    QUALITY: 'bg-red-100 text-red-800',
    CAPACITY: 'bg-yellow-100 text-yellow-800',
  };
  return classes[category] || 'bg-gray-100 text-gray-800';
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'agora mesmo';
  if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} minutos`;
  if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} horas`;
  return `há ${Math.floor(diffInSeconds / 86400)} dias`;
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

onMounted(async () => {
  await Promise.all([
    fetchNotifications(),
    notificationStore.updateUnreadCount(),
    notificationStore.updatePriorityCounts(),
  ]);
});
</script>
