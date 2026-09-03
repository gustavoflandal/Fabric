<template>
  <Card :padding="false">
    <!-- 1. Carregando — §4.2 variante C (spinner primary + texto). -->
    <div v-if="loading" class="text-center py-12">
      <div
        class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"
        data-testid="datatable-spinner"
      ></div>
      <p class="mt-2 text-gray-600">Carregando...</p>
    </div>

    <!-- 2. Erro — faixa de PCPDashboardView.vue:12-15. Nunca colapsar em "vazio" (I11). -->
    <div v-else-if="error" class="m-6 bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p class="text-red-600">{{ error }}</p>
      <Button class="mt-4" @click="emit('retry')">Tentar Novamente</Button>
    </div>

    <!-- 3. Vazio — forma de CountingPlanList.vue:185-191 + CTA opcional. -->
    <div v-else-if="items.length === 0" class="text-center py-12">
      <slot name="empty-icon">
        <ClipboardDocumentListIcon class="mx-auto h-12 w-12 text-gray-400" />
      </slot>
      <h3 class="mt-2 text-sm font-medium text-gray-900">{{ emptyTitle }}</h3>
      <p v-if="emptyHint" class="mt-1 text-sm text-gray-500">{{ emptyHint }}</p>
      <div v-if="$slots['empty-action']" class="mt-4">
        <slot name="empty-action" />
      </div>
    </div>

    <!-- 4. Dados. -->
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <slot name="head" />
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="(item, index) in items" :key="rowKey(item, index)" class="hover:bg-gray-50">
            <slot name="row" :item="item" :index="index" />
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Paginacao canonica — UsersListView.vue:146-172 (identica em 3 views). -->
    <div
      v-if="!loading && !error && pagination && pagination.pages > 1"
      class="px-6 py-4 border-t border-gray-200"
    >
      <div class="flex items-center justify-between">
        <div class="text-sm text-gray-700">
          Mostrando {{ (pagination.page - 1) * pagination.limit + 1 }} a
          {{ Math.min(pagination.page * pagination.limit, pagination.total) }} de
          {{ pagination.total }} resultados
        </div>
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="pagination.page === 1"
            @click="emit('change-page', pagination.page - 1)"
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            :disabled="pagination.page === pagination.pages"
            @click="emit('change-page', pagination.page + 1)"
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts" generic="T extends Record<string, unknown>">
import { ClipboardDocumentListIcon } from '@heroicons/vue/24/outline'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

interface Props {
  loading?: boolean
  /** String vazia = sem erro. §4.4-5: os 4 estados sao distintos. */
  error?: string
  items?: T[]
  pagination?: Pagination | null
  emptyTitle?: string
  emptyHint?: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
  error: '',
  items: () => [],
  pagination: null,
  emptyTitle: 'Nenhum registro encontrado',
  emptyHint: '',
})

const emit = defineEmits<{
  retry: []
  'change-page': [page: number]
}>()

// Genérico desde a revisão pós-Lote-1: consumidores usam `#row="{ item }"`
// com `item` já tipado como T, sem precisar de cast manual (`asItem()`) em
// cada view — o Lote 1 (Suppliers/Customers/Units/WorkCenters/Warehouses)
// foi migrado antes desta mudança e ainda usa o cast; não retroagir só por
// consistência, mas lotes novos não devem precisar dele.
defineSlots<{
  head(): unknown
  row(props: { item: T; index: number }): unknown
  'empty-icon'(): unknown
  'empty-action'(): unknown
}>()

function rowKey(item: T, index: number): string | number {
  const candidate = item?.id
  return typeof candidate === 'string' || typeof candidate === 'number' ? candidate : index
}
</script>
