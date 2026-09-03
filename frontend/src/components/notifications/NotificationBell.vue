<template>
  <div class="relative">
    <!-- Bell Icon com Badge -->
    <button
      @click="toggleDropdown"
      class="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
      :class="{ 'animate-pulse': hasCritical }"
    >
      <BellIcon class="w-6 h-6" />
      
      <!-- Badge de contagem -->
      <span
        v-if="unreadCount > 0"
        class="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 rounded-full"
        :class="hasCritical ? 'bg-red-600' : 'bg-blue-600'"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- Dropdown -->
    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="showDropdown"
        class="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
        @click.stop
      >
        <!-- Header do Dropdown -->
        <div class="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h3 class="text-sm font-semibold text-gray-900">Notificações</h3>
          <button
            v-if="unreadCount > 0"
            @click="markAllAsRead"
            class="text-xs text-blue-600 hover:text-blue-800"
          >
            Marcar todas como lidas
          </button>
        </div>

        <!-- Lista de Notificações -->
        <div class="max-h-96 overflow-y-auto">
          <div v-if="loading" class="p-4 text-center text-gray-500">
            <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>

          <div v-else-if="criticalNotifications.length === 0" class="p-8 text-center text-gray-500">
            <InboxIcon class="mx-auto h-12 w-12 text-gray-400" />
            <p class="mt-2 text-sm">Nenhuma notificação</p>
          </div>

          <div v-else>
            <div
              v-for="notification in criticalNotifications.slice(0, 5)"
              :key="notification.id"
              class="px-4 py-3 hover:bg-gray-50 border-b border-gray-100 transition-colors"
              :class="{ 'bg-blue-50': !notification.read }"
            >
              <div class="flex items-start">
                <!-- Ícone por tipo -->
                <div class="flex-shrink-0 mt-0.5">
                  <span
                    class="inline-flex items-center justify-center h-8 w-8 rounded-full"
                    :class="getIconClass(notification)"
                  >
                    {{ getIcon(notification) }}
                  </span>
                </div>

                <!-- Conteúdo -->
                <div class="ml-3 flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900">
                    {{ notification.title }}
                  </p>
                  <p class="text-sm text-gray-600 mt-1 line-clamp-2">
                    {{ notification.message }}
                  </p>
                  <p class="text-xs text-gray-500 mt-1">
                    {{ formatTimeAgo(notification.createdAt) }}
                  </p>
                </div>

                <!-- Botão de marcar como lida -->
                <div class="ml-2 flex-shrink-0">
                  <button
                    v-if="!notification.read"
                    @click.stop="markAsRead(notification.id)"
                    class="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                    title="Marcar como lida"
                  >
                    <CheckIcon class="w-4 h-4" />
                  </button>
                  <span v-else class="inline-block h-2 w-2 rounded-full bg-green-600" title="Lida"></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <RouterLink
            to="/notifications"
            class="text-sm text-blue-600 hover:text-blue-800 font-medium"
            @click="showDropdown = false"
          >
            Ver todas as notificações →
          </RouterLink>
        </div>
      </div>
    </transition>

    <!-- Overlay para fechar dropdown -->
    <div
      v-if="showDropdown"
      @click="showDropdown = false"
      class="fixed inset-0 z-40"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notification.store';
import type { Notification } from '@/services/notification.service';
import { BellIcon, CheckIcon, InboxIcon } from '@heroicons/vue/24/outline';

const router = useRouter();
const notificationStore = useNotificationStore();

const showDropdown = ref(false);
const loading = ref(false);

const unreadCount = computed(() => notificationStore.unreadCount);
const hasCritical = computed(() => notificationStore.hasCritical);
const criticalNotifications = computed(() => notificationStore.criticalNotifications);

let refreshInterval: number | null = null;

const toggleDropdown = async () => {
  showDropdown.value = !showDropdown.value;
  
  if (showDropdown.value) {
    loading.value = true;
    await notificationStore.fetchCritical();
    loading.value = false;
  }
};

const markAllAsRead = async () => {
  try {
    await notificationStore.markAllAsRead();
  } catch (error) {
    console.error('Erro ao marcar todas como lidas:', error);
  }
};

const markAsRead = async (id: string) => {
  try {
    await notificationStore.markAsRead(id);
  } catch (error) {
    console.error('Erro ao marcar como lida:', error);
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

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'agora mesmo';
  if (diffInSeconds < 3600) return `há ${Math.floor(diffInSeconds / 60)} minutos`;
  if (diffInSeconds < 86400) return `há ${Math.floor(diffInSeconds / 3600)} horas`;
  return `há ${Math.floor(diffInSeconds / 86400)} dias`;
};

onMounted(async () => {
  // Carregar contadores iniciais
  await notificationStore.refreshAll();
  
  // Atualizar a cada 30 segundos
  refreshInterval = window.setInterval(() => {
    notificationStore.refreshAll();
  }, 30000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>
