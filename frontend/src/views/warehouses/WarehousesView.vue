<template>
  <AppLayout title="Armazéns" subtitle="Gerencie os armazéns do sistema">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Armazém</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="wh-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="search"
            type="text"
            placeholder="Digite para buscar..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedSearch"
          />
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="warehouses"
      empty-title="Nenhum armazém encontrado"
      empty-hint="Ajuste a busca ou cadastre um novo armazém."
      @retry="loadWarehouses"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Armazém</Button>
      </template>

      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cidade</th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ asItem(item).code }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ asItem(item).name }}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ asItem(item).document || '-' }}</td>
        <td class="px-6 py-4 text-sm text-gray-500">
          <div>{{ asItem(item).email || '-' }}</div>
          <div class="text-xs">{{ asItem(item).phone || '-' }}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ asItem(item).city || '-' }}</td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="asItem(item).active ? 'Ativo' : 'Inativo'"
            :tone="asItem(item).active ? 'success' : 'danger'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
          <button @click="openEditModal(asItem(item))" class="text-primary-600 hover:text-primary-900">Editar</button>
          <button @click="handleToggleActive(asItem(item))" class="text-yellow-600 hover:text-yellow-900">
            {{ asItem(item).active ? 'Desativar' : 'Ativar' }}
          </button>
          <button @click="handleDelete(asItem(item))" class="text-red-600 hover:text-red-900">Excluir</button>
        </td>
      </template>
    </DataTable>

    <AppModal
      v-model="showModal"
      :title="editingWarehouse ? 'Editar Armazém' : 'Novo Armazém'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="wh-form-code" label="Código" required>
            <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="wh-form-name" label="Nome" required>
            <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <FormField id="wh-form-legal-name" label="Razão Social">
          <input v-model="formData.legalName" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="wh-form-document" label="CNPJ/CPF">
            <input v-model="formData.document" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="wh-form-phone" label="Telefone">
            <input v-model="formData.phone" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <FormField id="wh-form-email" label="Email">
          <input v-model="formData.email" type="email" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <FormField id="wh-form-address" label="Endereço">
          <input v-model="formData.address" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <div class="grid grid-cols-3 gap-4">
          <FormField id="wh-form-city" label="Cidade">
            <input v-model="formData.city" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="wh-form-state" label="Estado">
            <input v-model="formData.state" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="wh-form-zip" label="CEP">
            <input v-model="formData.zipCode" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="wh-form-manager" label="Responsável">
            <input v-model="formData.managerName" type="text" placeholder="Nome do gerente" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="wh-form-capacity" label="Capacidade (m³)">
            <input v-model.number="formData.capacity" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <FormField id="wh-form-description" label="Descrição">
          <textarea v-model="formData.description" rows="3" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
        </FormField>

        <div class="flex items-center">
          <input v-model="formData.active" type="checkbox" id="wh-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="wh-form-active" class="ml-2 text-sm text-gray-700">Ativo</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingWarehouse ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useWarehouseStore } from '@/stores/warehouse.store';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';
import { useDebounce } from '@/composables/useDebounce';
import type { ApiError, Warehouse, WarehouseFormData } from '@/types/warehouse.types';

const warehouseStore = useWarehouseStore();
const toast = useToast();

const search = ref('');
const warehouses = ref<Warehouse[]>([]);
const loading = ref(false);
// §4.4-5 / I11: erro de carregamento e um estado proprio, nunca "lista vazia".
const error = ref('');
const saving = ref(false);
const showModal = ref(false);
const editingWarehouse = ref<Warehouse | null>(null);

const formData = ref<Partial<WarehouseFormData>>({
  code: '',
  name: '',
  legalName: '',
  document: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'BR',
  managerName: '',
  capacity: undefined,
  description: '',
  active: true
});

// DataTable expoe o item do slot #row como `unknown` (o componente nao e generico);
// este e o unico ponto de cast da view, mantendo o template tipado.
const asItem = (item: unknown) => item as Warehouse;

const loadWarehouses = async () => {
  try {
    loading.value = true;
    error.value = '';
    // Nota: warehouse.store.ts:19-23 engole a falha de fetchWarehouses num
    // console.error sem relancar — enquanto ele nao relancar, este catch nao
    // dispara e a tela cai em "nenhum armazem encontrado" (I10/I11).
    await warehouseStore.fetchWarehouses({ search: search.value || undefined });
    warehouses.value = warehouseStore.warehouses;
  } catch (e) {
    error.value = (e as ApiError).response?.data?.message || 'Erro ao carregar armazéns';
  } finally {
    loading.value = false;
  }
};

// I18: o campo de busca existia no template mas nunca chegava a chamada da API.
const debouncedSearch = useDebounce(loadWarehouses, 350);

const openCreateModal = () => {
  editingWarehouse.value = null;
  formData.value = {
    code: '',
    name: '',
    legalName: '',
    document: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'BR',
    managerName: '',
    capacity: undefined,
    description: '',
    active: true
  };
  showModal.value = true;
};

const openEditModal = (warehouse: Warehouse) => {
  editingWarehouse.value = warehouse;
  formData.value = { ...warehouse };
  showModal.value = true;
};

// Esc, focus trap e devolucao de foco agora vem do AppModal (§4.2).
const closeModal = () => {
  showModal.value = false;
  editingWarehouse.value = null;
};

const handleSubmit = async () => {
  try {
    saving.value = true;
    if (editingWarehouse.value) {
      await warehouseStore.updateWarehouse(editingWarehouse.value.id, formData.value);
      toast.success('Armazém atualizado com sucesso!');
    } else {
      await warehouseStore.createWarehouse(formData.value);
      toast.success('Armazém criado com sucesso!');
    }
    closeModal();
    await loadWarehouses();
  } catch (error) {
    toast.error((error as ApiError).response?.data?.message || 'Erro ao salvar armazém');
  } finally {
    saving.value = false;
  }
};

const handleToggleActive = async (warehouse: Warehouse) => {
  if (await confirmDialog(`Deseja ${warehouse.active ? 'desativar' : 'ativar'} o armazém "${warehouse.name}"?`)) {
    const acao = warehouse.active ? 'desativado' : 'ativado';
    try {
      await warehouseStore.updateWarehouse(warehouse.id, { active: !warehouse.active });
      toast.success(`Armazém ${acao} com sucesso!`);
      await loadWarehouses();
    } catch (error) {
      toast.error((error as ApiError).response?.data?.message || 'Erro ao alterar status');
    }
  }
};

const handleDelete = async (warehouse: Warehouse) => {
  if (await confirmDialog(`Deseja realmente excluir o armazém "${warehouse.name}"?`)) {
    try {
      await warehouseStore.deleteWarehouse(warehouse.id);
      toast.success('Armazém excluído com sucesso!');
      await loadWarehouses();
    } catch (error) {
      toast.error((error as ApiError).response?.data?.message || 'Erro ao excluir armazém');
    }
  }
};

onMounted(() => loadWarehouses());
</script>
