<template>
  <div v-if="modelValue" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" @click="close">
    <div class="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" @click.stop>
      <!-- Header -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="text-2xl font-bold text-gray-900">Roteiros de Produção</h3>
            <p v-if="product" class="text-sm text-gray-600 mt-1">{{ product.code }} - {{ product.name }}</p>
          </div>
          <button @click="close" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="loading" class="text-center py-12">
          <p class="text-gray-500">Carregando...</p>
        </div>

        <div v-else-if="error" class="text-center py-12">
          <p class="text-red-600">{{ error }}</p>
        </div>

        <div v-else>
          <!-- Lista de Roteiros -->
          <div v-if="!showForm && !showCalculation" class="space-y-4">
            <div class="flex justify-between items-center mb-4">
              <h4 class="text-lg font-semibold text-gray-900">Roteiros Cadastrados</h4>
              <Button @click="openCreateForm">+ Novo Roteiro</Button>
            </div>

            <div v-if="routings.length === 0" class="text-center py-12 bg-gray-50 rounded-lg">
              <p class="text-gray-500">Nenhum roteiro cadastrado</p>
              <Button @click="openCreateForm" class="mt-4">Criar Primeiro Roteiro</Button>
            </div>

            <Card v-for="routing in routings" :key="routing.id" class="hover:shadow-md transition-shadow">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-2">
                    <h5 class="text-lg font-semibold text-gray-900">Versão {{ routing.version }}</h5>
                    <span v-if="routing.active" class="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">Ativo</span>
                    <span v-else class="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">Inativo</span>
                  </div>
                  <p v-if="routing.description" class="text-sm text-gray-600 mb-3">{{ routing.description }}</p>
                  <div class="text-sm text-gray-500 space-y-1">
                    <p v-if="routing.validFrom"><strong>Válido de:</strong> {{ formatDate(routing.validFrom) }}</p>
                    <p v-if="routing.validTo"><strong>Válido até:</strong> {{ formatDate(routing.validTo) }}</p>
                    <p><strong>Operações:</strong> {{ routing.operations.length }}</p>
                  </div>
                </div>
                <div class="flex gap-2">
                  <Button variant="outline" size="sm" @click="viewOperations(routing)">Ver Operações</Button>
                  <Button variant="outline" size="sm" @click="openCalculation(routing)">Calcular Tempo</Button>
                  <Button variant="outline" size="sm" @click="openEditForm(routing)">Editar</Button>
                  <Button v-if="!routing.active" variant="success" size="sm" @click="setActive(routing)">Ativar</Button>
                  <Button variant="danger" size="sm" @click="deleteRouting(routing)">Excluir</Button>
                </div>
              </div>

              <!-- Operações (expandido) -->
              <div v-if="expandedRoutingId === routing.id" class="mt-4 pt-4 border-t border-gray-200">
                <h6 class="font-semibold text-gray-900 mb-3">Operações do Roteiro</h6>
                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seq</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Centro de Trabalho</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Setup (min)</th>
                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Exec (min)</th>
                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Fila (min)</th>
                        <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Mov (min)</th>
                      </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                      <tr v-for="op in routing.operations" :key="op.id">
                        <td class="px-4 py-2 text-sm text-gray-900">{{ op.sequence }}</td>
                        <td class="px-4 py-2 text-sm text-gray-900">{{ op.workCenter?.code }} - {{ op.workCenter?.name }}</td>
                        <td class="px-4 py-2 text-sm text-gray-600">{{ op.description }}</td>
                        <td class="px-4 py-2 text-sm text-right text-gray-900">{{ op.setupTime }}</td>
                        <td class="px-4 py-2 text-sm text-right text-gray-900">{{ op.runTime }}</td>
                        <td class="px-4 py-2 text-sm text-right text-gray-500">{{ op.queueTime }}</td>
                        <td class="px-4 py-2 text-sm text-right text-gray-500">{{ op.moveTime }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>

          <!-- Formulário de Criação/Edição -->
          <div v-if="showForm" class="space-y-4">
            <div class="flex justify-between items-center mb-4">
              <h4 class="text-lg font-semibold text-gray-900">{{ formMode === 'create' ? 'Novo Roteiro' : 'Editar Roteiro' }}</h4>
              <Button variant="outline" @click="closeForm">Cancelar</Button>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Versão</label>
                  <input v-model.number="form.version" type="number" min="1" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div class="flex items-center h-10">
                    <input v-model="form.active" type="checkbox" id="active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <label for="active" class="ml-2 text-sm text-gray-700">Ativo</label>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea v-model="form.description" rows="2" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Válido de</label>
                  <input v-model="form.validFrom" type="date" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Válido até</label>
                  <input v-model="form.validTo" type="date" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                </div>
              </div>

              <!-- Operações -->
              <div class="border-t border-gray-200 pt-4">
                <div class="flex justify-between items-center mb-3">
                  <h5 class="font-semibold text-gray-900">Operações</h5>
                  <Button type="button" variant="outline" size="sm" @click="addOperation">+ Adicionar Operação</Button>
                </div>

                <div v-for="(op, index) in form.operations" :key="index" class="bg-gray-50 p-4 rounded-lg mb-3">
                  <div class="flex justify-between items-start mb-3">
                    <h6 class="font-medium text-gray-900">Operação {{ index + 1 }}</h6>
                    <button type="button" @click="removeOperation(index)" class="text-red-600 hover:text-red-800 text-sm">Remover</button>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Sequência *</label>
                      <input v-model.number="op.sequence" type="number" min="1" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Centro de Trabalho *</label>
                      <select v-model="op.workCenterId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                        <option value="">Selecione...</option>
                        <option v-for="wc in workCenters" :key="wc.id" :value="wc.id">{{ wc.code }} - {{ wc.name }}</option>
                      </select>
                    </div>
                  </div>

                  <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                    <input v-model="op.description" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                  </div>

                  <div class="grid grid-cols-4 gap-3 mt-3">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Setup (min) *</label>
                      <input v-model.number="op.setupTime" type="number" min="0" step="0.01" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Execução (min) *</label>
                      <input v-model.number="op.runTime" type="number" min="0" step="0.01" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Fila (min)</label>
                      <input v-model.number="op.queueTime" type="number" min="0" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Mov (min)</label>
                      <input v-model.number="op.moveTime" type="number" min="0" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                    </div>
                  </div>

                  <div class="mt-3">
                    <label class="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea v-model="op.notes" rows="2" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
                  </div>
                </div>
              </div>

              <div class="flex gap-3 pt-4">
                <Button type="button" variant="outline" @click="closeForm" class="flex-1">Cancelar</Button>
                <Button type="submit" :disabled="loading" class="flex-1">{{ formMode === 'create' ? 'Criar' : 'Salvar' }}</Button>
              </div>
            </form>
          </div>

          <!-- Cálculo de Tempo -->
          <div v-if="showCalculation && calculationResult" class="space-y-4">
            <div class="flex justify-between items-center mb-4">
              <h4 class="text-lg font-semibold text-gray-900">Cálculo de Tempo de Produção</h4>
              <Button variant="outline" @click="closeCalculation">Fechar</Button>
            </div>

            <Card>
              <div class="mb-4">
                <label class="block text-sm font-medium text-gray-700 mb-2">Quantidade a Produzir</label>
                <input v-model.number="calculationQuantity" type="number" min="1" @change="recalculate" class="w-64 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>

              <div class="grid grid-cols-5 gap-4 mb-6">
                <div class="bg-blue-50 p-4 rounded-lg">
                  <p class="text-sm text-gray-600 mb-1">Setup Total</p>
                  <p class="text-2xl font-bold text-blue-600">{{ calculationResult.times.setupTime }} min</p>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                  <p class="text-sm text-gray-600 mb-1">Execução Total</p>
                  <p class="text-2xl font-bold text-green-600">{{ calculationResult.times.runTime }} min</p>
                </div>
                <div class="bg-yellow-50 p-4 rounded-lg">
                  <p class="text-sm text-gray-600 mb-1">Fila Total</p>
                  <p class="text-2xl font-bold text-yellow-600">{{ calculationResult.times.queueTime }} min</p>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg">
                  <p class="text-sm text-gray-600 mb-1">Movimentação</p>
                  <p class="text-2xl font-bold text-purple-600">{{ calculationResult.times.moveTime }} min</p>
                </div>
                <div class="bg-gray-100 p-4 rounded-lg">
                  <p class="text-sm text-gray-600 mb-1">Tempo Total</p>
                  <p class="text-2xl font-bold text-gray-900">{{ calculationResult.times.totalTime }} min</p>
                  <p class="text-xs text-gray-500 mt-1">{{ (calculationResult.times.totalTime / 60).toFixed(2) }} horas</p>
                </div>
              </div>

              <h5 class="font-semibold text-gray-900 mb-3">Detalhamento por Operação</h5>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seq</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Centro de Trabalho</th>
                      <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Setup</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Execução</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Fila</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Mov</th>
                      <th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody class="bg-white divide-y divide-gray-200">
                    <tr v-for="op in calculationResult.operations" :key="op.sequence">
                      <td class="px-4 py-2 text-sm text-gray-900">{{ op.sequence }}</td>
                      <td class="px-4 py-2 text-sm text-gray-900">{{ op.workCenter?.code }}</td>
                      <td class="px-4 py-2 text-sm text-gray-600">{{ op.description }}</td>
                      <td class="px-4 py-2 text-sm text-right text-gray-900">{{ op.setupTime }} min</td>
                      <td class="px-4 py-2 text-sm text-right text-gray-900">{{ op.runTime }} min</td>
                      <td class="px-4 py-2 text-sm text-right text-gray-500">{{ op.queueTime }} min</td>
                      <td class="px-4 py-2 text-sm text-right text-gray-500">{{ op.moveTime }} min</td>
                      <td class="px-4 py-2 text-sm text-right font-semibold text-gray-900">{{ op.totalTime }} min</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import { useRoutingStore } from '@/stores/routing.store'
import { useWorkCenterStore } from '@/stores/work-center.store'
import type { Product } from '@/services/product.service'
import type { Routing } from '@/services/routing.service'

type FormMode = 'create' | 'edit'

interface FormOperation {
  sequence: number
  workCenterId: string
  description: string
  setupTime: number
  runTime: number
  queueTime: number
  moveTime: number
  notes: string
}

const props = defineProps<{
  modelValue: boolean
  product: Product | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const routingStore = useRoutingStore()
const workCenterStore = useWorkCenterStore()

const loading = computed(() => routingStore.loading)
const error = computed(() => routingStore.error)
const routings = computed(() => (props.product ? routingStore.getCachedRoutings(props.product.id) : []))
const workCenters = computed(() => workCenterStore.workCenters)

const showForm = ref(false)
const formMode = ref<FormMode>('create')
const editingRoutingId = ref<string | null>(null)
const expandedRoutingId = ref<string | null>(null)
const showCalculation = ref(false)
const calculationResult = ref<any>(null)
const calculationQuantity = ref(1)

const form = reactive({
  version: 1,
  description: '',
  validFrom: '',
  validTo: '',
  active: true,
  operations: [] as FormOperation[],
})

const close = () => {
  emit('update:modelValue', false)
}

const closeForm = () => {
  showForm.value = false
  editingRoutingId.value = null
}

const closeCalculation = () => {
  showCalculation.value = false
  calculationResult.value = null
  calculationQuantity.value = 1
}

function addOperation() {
  form.operations.push({
    sequence: form.operations.length + 1,
    workCenterId: '',
    description: '',
    setupTime: 0,
    runTime: 0,
    queueTime: 0,
    moveTime: 0,
    notes: '',
  })
}

function removeOperation(index: number) {
  if (form.operations.length <= 1) return
  form.operations.splice(index, 1)
  // Reordenar sequências
  form.operations.forEach((op, idx) => {
    op.sequence = idx + 1
  })
}

function resetForm() {
  form.version = 1
  form.description = ''
  form.validFrom = ''
  form.validTo = ''
  form.active = true
  form.operations = []
  editingRoutingId.value = null
  addOperation()
}

function openCreateForm() {
  resetForm()
  formMode.value = 'create'
  showForm.value = true
}

function openEditForm(routing: Routing) {
  formMode.value = 'edit'
  editingRoutingId.value = routing.id
  form.version = routing.version
  form.description = routing.description || ''
  form.validFrom = routing.validFrom ? routing.validFrom.substring(0, 10) : ''
  form.validTo = routing.validTo ? routing.validTo.substring(0, 10) : ''
  form.active = routing.active
  form.operations = routing.operations.map((op) => ({
    sequence: op.sequence,
    workCenterId: op.workCenterId,
    description: op.description,
    setupTime: op.setupTime,
    runTime: op.runTime,
    queueTime: op.queueTime ?? 0,
    moveTime: op.moveTime ?? 0,
    notes: op.notes || '',
  }))
  showForm.value = true
}

function viewOperations(routing: Routing) {
  expandedRoutingId.value = expandedRoutingId.value === routing.id ? null : routing.id
}

async function openCalculation(routing: Routing) {
  try {
    const result = await routingStore.calculateTotalTime(routing.id, calculationQuantity.value)
    calculationResult.value = result
    showCalculation.value = true
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao calcular tempo')
  }
}

async function recalculate() {
  if (calculationResult.value && calculationQuantity.value > 0) {
    try {
      const result = await routingStore.calculateTotalTime(calculationResult.value.routing.id, calculationQuantity.value)
      calculationResult.value = result
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao recalcular tempo')
    }
  }
}

const formatDate = (value?: string | null) => {
  if (!value) return null
  return new Date(value).toLocaleDateString('pt-BR')
}

const handleSubmit = async () => {
  if (!props.product) return

  const payloadOperations = form.operations.map((op) => ({
    sequence: op.sequence,
    workCenterId: op.workCenterId,
    description: op.description,
    setupTime: op.setupTime,
    runTime: op.runTime,
    queueTime: op.queueTime || 0,
    moveTime: op.moveTime || 0,
    notes: op.notes || undefined,
  }))

  try {
    if (formMode.value === 'create') {
      await routingStore.createRouting({
        productId: props.product.id,
        version: form.version,
        description: form.description || undefined,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        active: form.active,
        operations: payloadOperations,
      })
      alert('Roteiro criado com sucesso!')
    } else if (editingRoutingId.value) {
      await routingStore.updateRouting(editingRoutingId.value, props.product.id, {
        description: form.description || undefined,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        active: form.active,
        operations: payloadOperations,
      })
      alert('Roteiro atualizado com sucesso!')
    }

    await routingStore.fetchByProduct(props.product.id)
    closeForm()
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao salvar roteiro')
  }
}

const setActive = async (routing: Routing) => {
  if (!props.product || routing.active) return
  try {
    await routingStore.setActiveRouting(routing.id, props.product.id, true)
    await routingStore.fetchByProduct(props.product.id)
    alert('Roteiro ativado com sucesso!')
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao ativar roteiro')
  }
}

const deleteRouting = async (routing: Routing) => {
  if (!props.product) return
  if (!confirm(`Deseja realmente excluir o roteiro versão ${routing.version}?`)) return

  try {
    await routingStore.deleteRouting(routing.id, props.product.id)
    alert('Roteiro excluído com sucesso!')
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao excluir roteiro')
  }
}

watch(
  () => props.modelValue,
  async (newValue) => {
    if (newValue && props.product) {
      await Promise.all([
        routingStore.fetchByProduct(props.product.id),
        workCenterStore.fetchWorkCenters(1, 1000, { active: true }),
      ])
    }
  },
  { immediate: true }
)
</script>
