<template>
  <AppLayout title="Configurações do Sistema" subtitle="Parâmetros de instalação editáveis por administradores">
    <div v-if="store.loading" class="text-center py-12 text-gray-500">Carregando...</div>
    <div v-else-if="store.error" class="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
      {{ store.error }}
      <button class="ml-2 underline" @click="store.fetchSettings">Tentar novamente</button>
    </div>
    <div v-else class="space-y-8">
      <section v-for="(items, category) in grouped" :key="category" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">{{ CATEGORY_LABELS[category] || category }}</h3>
        <p v-if="category === 'rate_limit'" class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-4">
          Alterações nesta seção exigem reiniciar o serviço para valer.
        </p>
        <div class="space-y-4">
          <div v-for="item in items" :key="item.key" class="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <FormField :label="item.label" :hint="item.description || undefined">
              <div class="flex items-center gap-2">
                <select
                  v-if="item.type === 'BOOLEAN'"
                  v-model="drafts[item.key]"
                  class="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="true">Verdadeiro</option>
                  <option value="false">Falso</option>
                </select>
                <input
                  v-else
                  :type="item.type === 'NUMBER' ? 'number' : 'text'"
                  :value="drafts[item.key]"
                  @input="drafts[item.key] = ($event.target as HTMLInputElement).value"
                  class="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 flex-1"
                />
                <button
                  type="button"
                  class="px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50"
                  :disabled="!!fieldErrors[item.key] || drafts[item.key] === item.value || saving[item.key]"
                  @click="save(item)"
                >
                  Salvar
                </button>
              </div>
              <p v-if="fieldErrors[item.key]" class="mt-1 text-sm text-red-600">{{ fieldErrors[item.key] }}</p>
            </FormField>
          </div>
        </div>
      </section>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, reactive, watch } from 'vue'
import AppLayout from '@/components/common/AppLayout.vue'
import FormField from '@/components/common/FormField.vue'
import { useSystemSettingStore } from '@/stores/system-setting.store'
import { useToast } from '@/composables/useToast'
import { groupByCategory, CATEGORY_LABELS, validateSettingInput } from './system-settings-form'
import type { SystemSetting } from '@/types/system-setting.types'
import { computed } from 'vue'

const store = useSystemSettingStore()
const toast = useToast()

const drafts = reactive<Record<string, string>>({})
const fieldErrors = reactive<Record<string, string | null>>({})
const saving = reactive<Record<string, boolean>>({})

const grouped = computed(() => groupByCategory(store.settings))

watch(
  () => store.settings,
  (settings) => {
    for (const setting of settings) {
      if (!(setting.key in drafts)) drafts[setting.key] = setting.value
    }
  },
  { immediate: true }
)

watch(drafts, (current) => {
  for (const setting of store.settings) {
    const raw = current[setting.key]
    if (raw === undefined) continue
    fieldErrors[setting.key] = validateSettingInput(setting.type, raw)
  }
}, { deep: true })

async function save(item: SystemSetting): Promise<void> {
  saving[item.key] = true
  try {
    await store.updateSetting(item.key, drafts[item.key])
    toast.success(`"${item.label}" atualizado com sucesso.`)
  } catch (error: any) {
    toast.error(error.response?.data?.message || `Erro ao salvar "${item.label}".`)
  } finally {
    saving[item.key] = false
  }
}

onMounted(() => {
  store.fetchSettings()
})
</script>
