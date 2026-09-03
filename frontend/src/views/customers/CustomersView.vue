<template>
  <AppLayout title="Clientes" subtitle="Gerencie os clientes do sistema">
    <template #actions>
      <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Cliente</Button>
    </template>

    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField id="cus-filter-search" label="Buscar" class="md:col-span-2">
          <input
            v-model="filters.search"
            type="text"
            placeholder="Código, nome, documento ou email..."
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @input="debouncedFilterChange"
          />
        </FormField>
        <FormField id="cus-filter-active" label="Status">
          <select
            v-model="filters.active"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </FormField>
      </div>
    </Card>

    <DataTable
      :loading="loading"
      :error="error"
      :items="customers"
      :pagination="pagination"
      empty-title="Nenhum cliente encontrado"
      empty-hint="Ajuste os filtros ou cadastre um novo cliente."
      @retry="loadCustomers"
      @change-page="changePage"
    >
      <template #empty-action>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Cliente</Button>
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
      :title="editingCustomer ? 'Editar Cliente' : 'Novo Cliente'"
      @close="closeModal"
    >
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <FormField id="cus-form-code" label="Código" required>
            <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="cus-form-name" label="Nome" required>
            <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <FormField id="cus-form-legal-name" label="Razão Social">
          <input v-model="formData.legalName" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="cus-form-document" label="CNPJ/CPF">
            <input v-model="formData.document" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="cus-form-phone" label="Telefone">
            <input v-model="formData.phone" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <FormField id="cus-form-email" label="Email">
          <input v-model="formData.email" type="email" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <FormField id="cus-form-address" label="Endereço">
          <input v-model="formData.address" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
        </FormField>

        <div class="grid grid-cols-3 gap-4">
          <FormField id="cus-form-city" label="Cidade">
            <input v-model="formData.city" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="cus-form-state" label="Estado">
            <input v-model="formData.state" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="cus-form-zip" label="CEP">
            <input v-model="formData.zipCode" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <FormField id="cus-form-payment-terms" label="Prazo de Pagamento">
            <input v-model="formData.paymentTerms" type="text" placeholder="Ex: 30 dias" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
          <FormField id="cus-form-credit-limit" label="Limite de Crédito">
            <input v-model.number="formData.creditLimit" type="number" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
          </FormField>
        </div>

        <div class="flex items-center">
          <input v-model="formData.active" type="checkbox" id="cus-form-active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
          <label for="cus-form-active" class="ml-2 text-sm text-gray-700">Ativo</label>
        </div>

        <div class="flex gap-3 pt-4">
          <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
          <Button type="submit" :disabled="saving" class="flex-1">{{ editingCustomer ? 'Salvar' : 'Criar' }}</Button>
        </div>
      </form>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useCustomerStore } from '@/stores/customer.store';
import type { Customer } from '@/services/customer.service';
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

const customerStore = useCustomerStore();
const toast = useToast();

const customers = ref<Customer[]>([]);
const loading = ref(false);
// §4.4-5 / I11: erro de carregamento e um estado proprio, nunca "lista vazia".
const error = ref('');
const saving = ref(false);
const showModal = ref(false);
const editingCustomer = ref<Customer | null>(null);
const filters = ref({ search: '', active: '' });
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 });
const formData = ref({ code: '', name: '', legalName: '', document: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', country: 'BR', paymentTerms: '', creditLimit: undefined as number | undefined, active: true });

// DataTable expoe o item do slot #row como `unknown` (o componente nao e generico);
// este e o unico ponto de cast da view, mantendo o template tipado.
const asItem = (item: unknown) => item as Customer;

const loadCustomers = async () => {
  try {
    loading.value = true;
    error.value = '';
    const result = await customerStore.fetchCustomers(pagination.value.page, pagination.value.limit, { active: filters.value.active ? filters.value.active === 'true' : undefined, search: filters.value.search || undefined });
    customers.value = result.data;
    pagination.value = result.pagination;
  } catch (e: any) {
    error.value = e.response?.data?.message || 'Erro ao carregar clientes';
  } finally {
    loading.value = false;
  }
};

const handleFilterChange = () => { pagination.value.page = 1; loadCustomers(); };
const debouncedFilterChange = useDebounce(handleFilterChange, 350);
const changePage = (page: number) => { pagination.value.page = page; loadCustomers(); };
const openCreateModal = () => { editingCustomer.value = null; formData.value = { code: '', name: '', legalName: '', document: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', country: 'BR', paymentTerms: '', creditLimit: undefined, active: true }; showModal.value = true; };
const openEditModal = (customer: Customer) => { editingCustomer.value = customer; formData.value = { ...customer }; showModal.value = true; };
// Esc, focus trap e devolucao de foco agora vem do AppModal (§4.2).
const closeModal = () => { showModal.value = false; editingCustomer.value = null; };

const handleSubmit = async () => {
  try {
    saving.value = true;
    if (editingCustomer.value) {
      await customerStore.updateCustomer(editingCustomer.value.id, formData.value);
      toast.success('Cliente atualizado com sucesso!');
    } else {
      await customerStore.createCustomer(formData.value);
      toast.success('Cliente criado com sucesso!');
    }
    closeModal();
    await loadCustomers();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao salvar cliente');
  } finally {
    saving.value = false;
  }
};

const handleToggleActive = async (customer: Customer) => {
  if (await confirmDialog(`Deseja ${customer.active ? 'desativar' : 'ativar'} o cliente "${customer.name}"?`)) {
    const acao = customer.active ? 'desativado' : 'ativado';
    try {
      await customerStore.toggleActive(customer.id);
      toast.success(`Cliente ${acao} com sucesso!`);
      await loadCustomers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao alterar status');
    }
  }
};

const handleDelete = async (customer: Customer) => {
  if (await confirmDialog(`Deseja realmente excluir o cliente "${customer.name}"?`)) {
    try {
      await customerStore.deleteCustomer(customer.id);
      toast.success('Cliente excluído com sucesso!');
      await loadCustomers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erro ao excluir cliente');
    }
  }
};

onMounted(() => loadCustomers());
</script>
