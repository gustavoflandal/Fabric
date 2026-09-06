<!-- frontend/src/components/assistant/ChatAssistant.vue -->
<template>
  <Teleport to="body">
    <div v-if="authStore.hasPermission('assistente_ia', 'usar')" class="fixed bottom-4 right-4 z-[60]">
      <button
        v-if="!isOpen"
        type="button"
        class="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-2xl text-white shadow-lg hover:bg-primary-700"
        aria-label="Abrir assistente virtual"
        @click="isOpen = true"
      >
        💬
      </button>

      <div v-else class="flex h-[32rem] w-96 flex-col rounded-lg border border-gray-200 bg-white shadow-xl">
        <div class="flex items-center justify-between rounded-t-lg bg-primary-600 px-4 py-3 text-white">
          <span class="font-semibold">Assistente Virtual</span>
          <button type="button" aria-label="Fechar assistente virtual" @click="isOpen = false">&times;</button>
        </div>

        <div ref="scrollArea" class="flex-1 space-y-3 overflow-y-auto p-4">
          <div
            v-for="message in assistantStore.messages"
            :key="message.id"
            :class="
              message.role === 'user'
                ? 'ml-auto max-w-[80%] rounded-lg bg-primary-50 px-3 py-2'
                : 'mr-auto max-w-[80%] rounded-lg bg-gray-100 px-3 py-2'
            "
          >
            <p class="whitespace-pre-line text-sm text-gray-800">{{ message.content }}</p>
            <ul v-if="message.sources?.length" class="mt-2 space-y-1 text-xs text-gray-500">
              <li v-for="(source, idx) in message.sources" :key="idx">📄 {{ source.arquivo }}</li>
            </ul>
          </div>

          <p v-if="assistantStore.isStreaming" class="text-sm italic text-gray-500">Pensando...</p>
        </div>

        <p v-if="assistantStore.error" class="px-4 pb-1 text-xs text-red-600">{{ assistantStore.error }}</p>

        <form class="flex gap-2 border-t border-gray-200 p-3" @submit.prevent="handleSubmit">
          <input
            v-model="draft"
            type="text"
            placeholder="Digite sua dúvida..."
            class="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            :disabled="assistantStore.isStreaming"
          />
          <Button type="submit" size="sm" :disabled="assistantStore.isStreaming || !draft.trim()">Enviar</Button>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useAssistantStore } from '@/stores/assistant.store'
import Button from '@/components/common/Button.vue'

const authStore = useAuthStore()
const assistantStore = useAssistantStore()

const isOpen = ref(false)
const draft = ref('')
const scrollArea = ref<HTMLElement | null>(null)

const scrollToEnd = async (): Promise<void> => {
  await nextTick()
  if (scrollArea.value) {
    scrollArea.value.scrollTop = scrollArea.value.scrollHeight
  }
}

watch(() => assistantStore.messages.length, scrollToEnd)
watch(() => assistantStore.messages[assistantStore.messages.length - 1]?.content, scrollToEnd)

const handleSubmit = async (): Promise<void> => {
  const text = draft.value.trim()
  if (!text || assistantStore.isStreaming) return

  draft.value = ''
  await assistantStore.sendMessage(text)
}
</script>
