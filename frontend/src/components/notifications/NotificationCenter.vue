<template>
  <div class="bg-white rounded-lg shadow-sm border border-gray-200">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center">
          <svg class="w-6 h-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <h2 class="text-lg font-semibold text-gray-900">Centro de Notificações</h2>
        </div>
        <RouterLink
          to="/notifications"
          class="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Ver todas →
        </RouterLink>
      </div>
    </div>

    <!-- Contadores -->
    <div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
      <div class="grid grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-red-600">{{ priorityCounts.critical }}</div>
          <div class="text-xs text-gray-600 mt-1">Críticas</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-orange-600">{{ priorityCounts.high }}</div>
          <div class="text-xs text-gray-600 mt-1">Altas</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ unreadCount }}</div>
          <div class="text-xs text-gray-600 mt-1">Não Lidas</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-600">{{ totalNotifications }}</div>
          <div class="text-xs text-gray-600 mt-1">Total</div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="p-8 text-center">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p class="mt-2 text-sm text-gray-600">Carregando notificações...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="criticalNotifications.length === 0" class="p-8 text-center">
      <svg class="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="mt-4 text-sm font-medium text-gray-900">Tudo em ordem!</p>
      <p class="mt-1 text-sm text-gray-500">Nenhuma notificação crítica no momento</p>
    </div>

    <!-- Lista de Notificações Críticas -->
    <div v-else class="divide-y divide-gray-200">
      <!-- Críticas (Prioridade 4) -->
      <div v-if="criticalOnly.length > 0" class="px-6 py-3 bg-red-50">
        <div class="flex items-center text-sm font-medium text-red-900 mb-3">
          <span class="text-lg mr-2">🔴</span>
          CRÍTICO ({{ criticalOnly.length }})
        </div>
        <div class="space-y-2">
          <div
            v-for="notification in criticalOnly"
            :key="notification.id"
            class="bg-white rounded-lg p-4 hover:shadow-md transition-shadow border-l-4 border-red-600"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900">
                  {{ notification.title }}
                </p>
                <p class="text-sm text-gray-600 mt-1">
                  {{ notification.message }}
                </p>
                <p class="text-xs text-gray-500 mt-2">
                  {{ formatTimeAgo(notification.createdAt) }}
                </p>
              </div>
              <button
                v-if="!notification.read"
                @click="markAsRead(notification.id)"
                class="ml-4 px-3 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
              >
                Marcar como lida
              </button>
              <span v-else class="ml-4 text-xs text-green-600 font-medium">✓ Lida</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Altas (Prioridade 3) -->
      <div v-if="highOnly.length > 0" class="px-6 py-3">
        <div class="flex items-center text-sm font-medium text-orange-900 mb-3">
          <span class="text-lg mr-2">⚠️</span>
          ALTA ({{ highOnly.length }})
        </div>
        <div class="space-y-2">
          <div
            v-for="notification in highOnly"
            :key="notification.id"
            class="bg-white rounded-lg p-4 hover:shadow-md transition-shadow border-l-4 border-orange-500"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-900">
                  {{ notification.title }}
                </p>
                <p class="text-sm text-gray-600 mt-1">
                  {{ notification.message }}
                </p>
                <p class="text-xs text-gray-500 mt-2">
                  {{ formatTimeAgo(notification.createdAt) }}
                </p>
              </div>
              <button
                v-if="!notification.read"
                @click="markAsRead(notification.id)"
                class="ml-4 px-3 py-1 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded transition-colors"
              >
                Marcar como lida
              </button>
              <span v-else class="ml-4 text-xs text-green-600 font-medium">✓ Lida</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div v-if="criticalNotifications.length > 0" class="px-6 py-4 bg-gray-50 border-t border-gray-200">
      <div class="flex items-center justify-between">
        <p class="text-sm text-gray-600">
          Mostrando {{ criticalNotifications.length }} notificações críticas
        </p>
        <button
          v-if="unreadCount > 0"
          @click="markAllAsRead"
          class="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Marcar todas como lidas
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNotificationStore } from '@/stores/notification.store';
import type { Notification } from '@/services/notification.service';

const router = useRouter();
const notificationStore = useNotificationStore();

const loading = ref(false);

const unreadCount = computed(() => notificationStore.unreadCount);
const priorityCounts = computed(() => notificationStore.priorityCounts);
const criticalNotifications = computed(() => notificationStore.criticalNotifications);
const totalNotifications = computed(() => criticalNotifications.value.length);

const criticalOnly = computed(() => 
  criticalNotifications.value.filter(n => n.priority === 4)
);

const highOnly = computed(() => 
  criticalNotifications.value.filter(n => n.priority === 3)
);

const markAsRead = async (id: string) => {
  try {
    await notificationStore.markAsRead(id);
  } catch (error) {
    console.error('Erro ao marcar como lida:', error);
  }
};

const markAllAsRead = async () => {
  try {
    await notificationStore.markAllAsRead();
  } catch (error) {
    console.error('Erro ao marcar todas como lidas:', error);
  }
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
  loading.value = true;
  await notificationStore.refreshAll();
  loading.value = false;
});
</script>
