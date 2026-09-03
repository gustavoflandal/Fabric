<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header canonico — substitui as 26 copias do bloco de SuppliersView.vue:3-24 (I1). -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <img src="/logo.png" alt="Fabric" class="h-10 w-auto" />
            <h1 class="ml-4 text-2xl font-bold text-primary-800">Fabric</h1>
          </div>

          <div class="flex items-center space-x-4">
            <slot name="nav">
              <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-primary-600">
                Início
              </RouterLink>
            </slot>
            <span class="text-sm text-gray-700">
              Olá, <span class="font-semibold">{{ authStore.userName }}</span>
            </span>
            <Button variant="outline" size="sm" @click="handleLogout">
              Sair
            </Button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div v-if="title || $slots.actions" class="mb-6 flex justify-between items-center">
        <div>
          <h2 v-if="title" class="text-3xl font-bold text-gray-900">{{ title }}</h2>
          <p v-if="subtitle" class="mt-1 text-sm text-gray-600">{{ subtitle }}</p>
        </div>
        <slot name="actions" />
      </div>

      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Button from '@/components/common/Button.vue'

interface Props {
  title?: string
  subtitle?: string
}

defineProps<Props>()

const router = useRouter()
const authStore = useAuthStore()

// Substitui as 26 redeclaracoes de handleLogout nas views (I1).
const handleLogout = async (): Promise<void> => {
  await authStore.logout()
  router.push('/login')
}
</script>
