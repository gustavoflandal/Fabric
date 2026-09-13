<template>
  <AppLayout :title="`Vagas — ${areaName}`" subtitle="Gerencie as vagas desta área do pátio">
    <template #actions>
      <RouterLink to="/yard/areas" class="text-sm text-primary-600 hover:underline mr-4 self-center">Voltar às Áreas</RouterLink>
      <Button @click="showGenerateModal = true">Gerar Vagas em Lote</Button>
    </template>

    <DataTable
      :loading="loading"
      :error="error"
      :items="spotList"
      :pagination="pagination"
      empty-title="Nenhuma vaga cadastrada"
      empty-hint="Gere vagas em lote pra começar."
      @retry="loadSpots"
      @change-page="changePage"
    >
      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Código</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ocupação</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{{ asItem(item).code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
          {{ asItem(item).visits?.[0]?.vehicle?.plate ? `Ocupada — ${asItem(item).visits![0].vehicle.plate}` : 'Livre' }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="asItem(item).blocked ? 'Bloqueada' : 'Ativa'" :tone="asItem(item).blocked ? 'danger' : 'success'" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button v-if="!asItem(item).blocked" @click="openBlockModal(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Bloquear</button>
          <button v-else @click="handleUnblock(asItem(item))" class="text-yellow-600 hover:text-yellow-900">Desbloquear</button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal v-model="showGenerateModal" title="Gerar Vagas em Lote" @close="showGenerateModal = false">
      <form id="generate-spots-form" @submit.prevent="handleGenerate" class="space-y-4">
        <FormField id="generate-spots-count" label="Quantidade de vagas a gerar" required>
          <input v-model.number="generateCount" type="number" min="1" max="500" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
        </FormField>
        <p class="text-xs text-gray-500 dark:text-gray-400">As vagas serão numeradas sequencialmente a partir da última já existente nesta área.</p>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="showGenerateModal = false" class="flex-1">Cancelar</Button>
          <Button type="submit" class="flex-1">Gerar</Button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showBlockModal" title="Bloquear Vaga" @close="closeBlockModal">
      <form id="spot-block-form" @submit.prevent="handleConfirmBlock" class="space-y-4">
        <FormField id="spot-block-reason" label="Motivo do bloqueio" required>
          <textarea v-model="blockReasonInput" rows="3" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"></textarea>
        </FormField>
        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeBlockModal" class="flex-1">Cancelar</Button>
          <Button type="submit" class="flex-1">Bloquear</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useYardSpotStore } from '@/stores/yard-spot.store'
import { useYardAreaStore } from '@/stores/yard-area.store'
import yardAreaService from '@/services/yard-area.service'
import type { YardSpot } from '@/services/yard-spot.service'
import AppLayout from '@/components/common/AppLayout.vue'
import AppModal from '@/components/common/AppModal.vue'
import Button from '@/components/common/Button.vue'
import DataTable from '@/components/common/DataTable.vue'
import FormField from '@/components/common/FormField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { useToast } from '@/composables/useToast'
import { confirmDialog } from '@/composables/useConfirm'

const route = useRoute()
const areaId = route.params.areaId as string

const yardSpotStore = useYardSpotStore()
const yardAreaStore = useYardAreaStore()
const toast = useToast()

const spotList = ref<YardSpot[]>([])
const loading = ref(false)
const error = ref('')
const showGenerateModal = ref(false)
const generateCount = ref(10)
const showBlockModal = ref(false)
const blockingSpot = ref<YardSpot | null>(null)
const blockReasonInput = ref('')
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 })

const areaName = computed(() => yardAreaStore.areas.find((a) => a.id === areaId)?.name || '')

const loadSpots = async () => {
  try {
    loading.value = true
    error.value = ''
    const result = await yardSpotStore.fetchSpots(pagination.value.page, pagination.value.limit, { areaId, blocked: undefined })
    spotList.value = result.data
    pagination.value = result.pagination
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar vagas'
  } finally {
    loading.value = false
  }
}

const changePage = (page: number) => { pagination.value.page = page; loadSpots() }

const handleGenerate = async () => {
  try {
    await yardAreaService.generateSpots(areaId, generateCount.value)
    toast.success(`${generateCount.value} vaga(s) gerada(s) com sucesso!`)
    showGenerateModal.value = false
    await loadSpots()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao gerar vagas')
  }
}

const openBlockModal = (spot: YardSpot) => { blockingSpot.value = spot; blockReasonInput.value = ''; showBlockModal.value = true }
const closeBlockModal = () => { showBlockModal.value = false; blockingSpot.value = null }

const handleConfirmBlock = async () => {
  if (!blockingSpot.value) return
  try {
    await yardSpotStore.setBlocked(blockingSpot.value.id, true, blockReasonInput.value)
    toast.success('Vaga bloqueada com sucesso!')
    closeBlockModal()
    await loadSpots()
  } catch (err: any) {
    toast.error(err.response?.data?.message || 'Erro ao bloquear vaga')
  }
}

const handleUnblock = async (spot: YardSpot) => {
  if (await confirmDialog(`Deseja desbloquear a vaga "${spot.code}"?`)) {
    try {
      await yardSpotStore.setBlocked(spot.id, false, null)
      toast.success('Vaga desbloqueada com sucesso!')
      await loadSpots()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao desbloquear vaga')
    }
  }
}

const handleDelete = async (spot: YardSpot) => {
  if (await confirmDialog(`Deseja realmente excluir a vaga "${spot.code}"?`)) {
    try {
      await yardSpotStore.deleteSpot(spot.id)
      toast.success('Vaga excluída com sucesso!')
      await loadSpots()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao excluir vaga')
    }
  }
}

const asItem = (item: unknown) => item as YardSpot

onMounted(async () => {
  await yardAreaStore.fetchAreas()
  await loadSpots()
})
</script>
