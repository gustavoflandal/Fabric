<template>
  <header class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16">
        <!-- Navigation Links -->
        <nav class="flex items-center space-x-6">
          <RouterLink
            to="/dashboard"
            class="text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            Dashboard
          </RouterLink>
        </nav>

        <!-- User Info -->
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-700">
            Olá, <span class="font-semibold">{{ userName }}</span>
          </span>
          <button
            @click="handleLogout"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Sair
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';

const router = useRouter();
const authStore = useAuthStore();

const userName = computed(() => authStore.user?.name || 'Administrador');

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};
</script>
