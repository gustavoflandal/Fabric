<template>
  <div id="app">
    <RouterView />
    <ToastContainer />
    <ConfirmDialogContainer />
    <ChatAssistant />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useThemeStore } from '@/stores/theme.store'
import ToastContainer from '@/components/common/ToastContainer.vue'
import ConfirmDialogContainer from '@/components/common/ConfirmDialogContainer.vue'
import ChatAssistant from '@/components/assistant/ChatAssistant.vue'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const isInitializing = ref(true)

onMounted(async () => {
  themeStore.initialize()

  try {
    if (import.meta.env.DEV) {
      console.log('🚀 Inicializando aplicação...')
    }
    
    // Initialize auth store on app mount
    await authStore.initialize()
    
    if (import.meta.env.DEV) {
      console.log('✅ Aplicação inicializada com sucesso')
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('❌ Erro ao inicializar aplicação:', error)
    }
  } finally {
    isInitializing.value = false
  }
})
</script>
