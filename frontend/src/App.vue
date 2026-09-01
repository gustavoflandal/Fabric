<template>
  <div id="app">
    <RouterView />
    <ToastContainer />
    <ConfirmDialogContainer />
  </div>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import { onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import ToastContainer from '@/components/common/ToastContainer.vue'
import ConfirmDialogContainer from '@/components/common/ConfirmDialogContainer.vue'

const authStore = useAuthStore()
const isInitializing = ref(true)

onMounted(async () => {
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
