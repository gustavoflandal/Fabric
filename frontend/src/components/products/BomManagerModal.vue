<template>
  <teleport to="body">
    <transition name="fade">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
        <div class="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-full overflow-hidden flex flex-col">
          <header class="flex justify-between items-start p-6 border-b border-gray-200">
            <div>
              <h2 class="text-2xl font-bold text-gray-900">Estruturas de Produto (BOM)</h2>
              <p v-if="product" class="text-sm text-gray-600 mt-1">
                Produto: <span class="font-semibold">{{ product.code }} - {{ product.name }}</span>
              </p>
            </div>
            <button @click="close" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
          </header>

          <section class="p-6 space-y-4 overflow-y-auto">
            <div class="flex items-center justify-between">
              <div>
                <Button variant="secondary" size="sm" @click="openCreateForm" :disabled="loading || !product">
                  Nova BOM
                </Button>
              </div>
              <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
            </div>

            <div v-if="loading" class="py-12 text-center text-gray-500">Carregando estruturas...</div>
            <div v-else>
              <div v-if="boms.length === 0" class="py-12 text-center text-gray-500">
                Nenhuma BOM cadastrada para este produto.
              </div>
              <div v-else class="space-y-4">
                <Card v-for="bom in boms" :key="bom.id" class="border border-gray-200">
                  <div class="flex flex-col gap-4">
                    <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <div class="flex items-center gap-3">
                          <h3 class="text-lg font-semibold text-gray-900">Versão {{ bom.version }}</h3>
                          <span :class="bom.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                            {{ bom.active ? 'Ativa' : 'Inativa' }}
                          </span>
                        </div>
                        <p v-if="bom.description" class="text-sm text-gray-600 mt-1">{{ bom.description }}</p>
                        <p class="text-xs text-gray-500 mt-1">
                          Vigência: {{ formatDate(bom.validFrom) || '—' }} até {{ formatDate(bom.validTo) || '—' }}
                        </p>
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" @click="openEditForm(bom)" :disabled="loading">Editar</Button>
                        <Button variant="outline" size="sm" @click="setActive(bom)" :disabled="loading || bom.active">Ativar</Button>
                        <Button variant="outline" size="sm" @click="explodeBom(bom)" :disabled="loading">Explodir</Button>
                        <Button variant="danger" size="sm" @click="deleteBom(bom)" :disabled="loading">Excluir</Button>
                      </div>
                    </div>

                    <div class="overflow-x-auto">
                      <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Seq.</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Componente</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Scrap</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Observações</th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
                          <tr v-for="item in bom.items" :key="item.id" class="hover:bg-gray-50">
                            <td class="px-4 py-2 text-sm text-gray-500">{{ item.sequence }}</td>
                            <td class="px-4 py-2 text-sm text-gray-900">
                              <div class="font-medium">{{ item.component?.code || item.componentId }}</div>
                              <div class="text-xs text-gray-500">{{ item.component?.name }}</div>
                            </td>
                            <td class="px-4 py-2 text-sm text-gray-500">{{ item.quantity }}</td>
                            <td class="px-4 py-2 text-sm text-gray-500">{{ item.unit?.code || item.unitId }}</td>
                            <td class="px-4 py-2 text-sm text-gray-500">{{ item.scrapFactor ?? 0 }}</td>
                            <td class="px-4 py-2 text-sm text-gray-500">{{ item.notes || '—' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </section>
        </div>
      </div>
    </transition>
  </teleport>

  <teleport to="body">
    <transition name="fade">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
        <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-full overflow-y-auto">
          <header class="flex justify-between items-start p-6 border-b border-gray-200">
            <div>
              <h3 class="text-xl font-semibold text-gray-900">
                {{ formMode === 'create' ? 'Nova BOM' : 'Editar BOM' }}
              </h3>
              <p v-if="product" class="text-xs text-gray-500 mt-1">
                Produto: {{ product.code }} - {{ product.name }}
              </p>
            </div>
            <button @click="closeForm" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
          </header>

          <form class="p-6 space-y-4" @submit.prevent="handleSubmit">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Versão</label>
                <input v-model.number="form.version" type="number" min="1" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div class="flex items-center gap-2 pt-6 md:pt-8">
                <input id="bom-active" v-model="form.active" type="checkbox" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                <label for="bom-active" class="text-sm text-gray-700">BOM ativa</label>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea v-model="form.description" rows="2" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Válida a partir de</label>
                <input v-model="form.validFrom" type="date" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Válida até</label>
                <input v-model="form.validTo" type="date" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
            </div>

            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <h4 class="text-lg font-semibold text-gray-900">Itens</h4>
                <Button variant="secondary" size="sm" type="button" @click="addItem">Adicionar Item</Button>
              </div>

              <div v-if="form.items.length === 0" class="py-6 text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg">
                Nenhum item adicionado.
              </div>

              <div v-for="(item, index) in form.items" :key="index" class="border border-gray-200 rounded-lg p-4 space-y-3">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Componente *</label>
                    <select v-model="item.componentId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                      <option value="">Selecione um componente</option>
                      <option v-for="prod in availableProducts" :key="prod.id" :value="prod.id">
                        {{ prod.code }} - {{ prod.name }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Quantidade *</label>
                    <input v-model.number="item.quantity" type="number" min="0.0001" step="0.0001" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Unidade *</label>
                    <select v-model="item.unitId" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                      <option value="">Selecione uma unidade</option>
                      <option v-for="unit in availableUnits" :key="unit.id" :value="unit.id">
                        {{ unit.code }} - {{ unit.name }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Sequência</label>
                    <input v-model.number="item.sequence" type="number" min="1" step="1" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Fator de sucata</label>
                    <input v-model.number="item.scrapFactor" type="number" min="0" step="0.0001" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Observações</label>
                    <input v-model="item.notes" type="text" placeholder="Opcional" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
                  </div>
                </div>
                <div class="flex justify-end">
                  <Button variant="danger" size="xs" type="button" @click="removeItem(index)" :disabled="form.items.length === 1">
                    Remover Item
                  </Button>
                </div>
              </div>
            </div>

            <div class="flex flex-col md:flex-row gap-3 pt-4">
              <Button type="button" variant="outline" class="flex-1" @click="closeForm">Cancelar</Button>
              <Button type="submit" :disabled="loading" class="flex-1">
                {{ formMode === 'create' ? 'Criar BOM' : 'Salvar alterações' }}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </transition>
  </teleport>

  <teleport to="body">
    <transition name="fade">
      <div v-if="showExplosion" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
        <div class="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-full overflow-y-auto">
          <header class="flex justify-between items-start p-6 border-b border-gray-200">
            <div>
              <h3 class="text-xl font-semibold text-gray-900">Explosão da BOM</h3>
              <p class="text-xs text-gray-500 mt-1" v-if="explosionResult">
                Quantidade planejada: {{ explosionResult.quantity }} | Versão: {{ explosionResult.bom.version }}
              </p>
            </div>
            <button @click="closeExplosion" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
          </header>

          <section class="p-6 space-y-4" v-if="explosionResult">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Sequência</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Componente</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantidade</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Scrap</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notas</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="(item, index) in explosionResult.items" :key="index" class="hover:bg-gray-50">
                    <td class="px-4 py-2 text-sm text-gray-500">{{ item.sequence }}</td>
                    <td class="px-4 py-2 text-sm text-gray-900">{{ item.componentCode }} - {{ item.componentName }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500">{{ item.quantity }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500">{{ item.unit?.code || '—' }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500">{{ item.scrapFactor ?? 0 }}</td>
                    <td class="px-4 py-2 text-sm text-gray-500">{{ item.notes || '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted } from 'vue'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import { useBomStore } from '@/stores/bom.store'
import { useProductStore } from '@/stores/product.store'
import type { Product } from '@/services/product.service'
import type { Bom } from '@/services/bom.service'
import unitOfMeasureService from '@/services/unit-of-measure.service'

type FormMode = 'create' | 'edit'

interface FormItem {
  componentId: string
  quantity: number | null
  unitId: string
  scrapFactor: number | null
  sequence: number | null
  notes: string
}

interface ExplosionResultItem {
  componentId: string
  componentCode?: string
  componentName?: string
  unit?: { code?: string }
  sequence?: number
  quantity: number
  scrapFactor?: number
  notes?: string | null
}

interface ExplosionResult {
  bom: { id: string; version: number; productId: string }
  quantity: number
  items: ExplosionResultItem[]
}

const props = defineProps<{
  modelValue: boolean
  product: Product | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const bomStore = useBomStore()
const productStore = useProductStore()
const loading = computed(() => bomStore.loading)
const error = computed(() => bomStore.error)
const boms = computed(() => (props.product ? bomStore.getCachedBoms(props.product.id) : []))

const availableProducts = ref<Product[]>([])
const availableUnits = ref<any[]>([])

onMounted(async () => {
  try {
    await productStore.fetchProducts()
    availableProducts.value = productStore.products
    const unitsResponse = await unitOfMeasureService.getAll()
    availableUnits.value = unitsResponse.data.data
  } catch (err) {
    console.error('Erro ao carregar produtos/unidades:', err)
  }
})

const showForm = ref(false)
const formMode = ref<FormMode>('create')
const editingBomId = ref<string | null>(null)
const showExplosion = ref(false)
const explosionResult = ref<ExplosionResult | null>(null)

const form = reactive({
  version: 1,
  description: '',
  validFrom: '',
  validTo: '',
  active: true,
  items: [] as FormItem[],
})

const close = () => {
  emit('update:modelValue', false)
}

const closeForm = () => {
  showForm.value = false
  editingBomId.value = null
}

function addItem() {
  form.items.push({
    componentId: '',
    quantity: null,
    unitId: '',
    scrapFactor: 0,
    sequence: form.items.length + 1,
    notes: '',
  })
}

function resetForm() {
  form.version = 1
  form.description = ''
  form.validFrom = ''
  form.validTo = ''
  form.active = true
  form.items = []
  editingBomId.value = null
  addItem()
}

function openCreateForm() {
  resetForm()
  formMode.value = 'create'
  showForm.value = true
}

function openEditForm(bom: Bom) {
  formMode.value = 'edit'
  editingBomId.value = bom.id
  form.version = bom.version
  form.description = bom.description || ''
  form.validFrom = bom.validFrom ? bom.validFrom.substring(0, 10) : ''
  form.validTo = bom.validTo ? bom.validTo.substring(0, 10) : ''
  form.active = bom.active
  form.items = bom.items.map((item) => ({
    componentId: item.componentId,
    quantity: item.quantity,
    unitId: item.unitId,
    scrapFactor: item.scrapFactor ?? 0,
    sequence: item.sequence ?? null,
    notes: item.notes || '',
  }))
  showForm.value = true
}

function removeItem(index: number) {
  if (form.items.length <= 1) return
  form.items.splice(index, 1)
}

const formatDate = (value?: string | null) => {
  if (!value) return null
  return new Date(value).toLocaleDateString('pt-BR')
}

const handleSubmit = async () => {
  if (!props.product) return

  const payloadItems = form.items.map((item) => ({
    componentId: item.componentId,
    quantity: item.quantity ?? 0,
    unitId: item.unitId,
    scrapFactor: item.scrapFactor ?? 0,
    sequence: item.sequence ?? undefined,
    notes: item.notes || undefined,
  }))

  try {
    if (formMode.value === 'create') {
      await bomStore.createBom({
        productId: props.product.id,
        description: form.description || undefined,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        active: form.active,
        version: form.version,
        items: payloadItems,
      })
      alert('BOM criada com sucesso!')
    } else if (editingBomId.value) {
      await bomStore.updateBom(editingBomId.value, props.product.id, {
        description: form.description || undefined,
        validFrom: form.validFrom || undefined,
        validTo: form.validTo || undefined,
        active: form.active,
        version: form.version,
        items: payloadItems,
      })
      alert('BOM atualizada com sucesso!')
    } else {
      alert('Nenhuma BOM selecionada para edição.')
      return
    }

    await bomStore.fetchByProduct(props.product.id)
    closeForm()
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao salvar BOM')
  }
}

const setActive = async (bom: Bom) => {
  if (!props.product || bom.active) return
  try {
    await bomStore.setActiveBom(bom.id, props.product.id, true)
    await bomStore.fetchByProduct(props.product.id)
    alert('BOM ativada com sucesso!')
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao ativar BOM')
  }
}

const deleteBom = async (bom: Bom) => {
  if (!props.product) return
  if (!confirm(`Deseja excluir a BOM versão ${bom.version}?`)) return

  try {
    await bomStore.deleteBom(bom.id, props.product.id)
    await bomStore.fetchByProduct(props.product.id)
    alert('BOM excluída com sucesso!')
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao excluir BOM')
  }
}

const explodeBom = async (bom: Bom) => {
  try {
    explosionResult.value = await bomStore.explode(bom.id)
    showExplosion.value = true
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao realizar explosão da BOM')
  }
}

const closeExplosion = () => {
  explosionResult.value = null
  showExplosion.value = false
}

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen && props.product) {
      await bomStore.fetchByProduct(props.product.id)
    } else if (!isOpen) {
      closeForm()
      closeExplosion()
    }
  }
)

watch(
  () => props.product?.id,
  async (newId, oldId) => {
    if (newId && props.modelValue && newId !== oldId) {
      await bomStore.fetchByProduct(newId)
    }
    if (newId !== oldId) {
      resetForm()
    }
  }
)

watch(
  () => showForm.value,
  (isOpen) => {
    if (!isOpen) {
      resetForm()
    }
  }
)

</script>
