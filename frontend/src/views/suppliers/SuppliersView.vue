<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <img src="/logo.png" alt="Fabric" class="h-10 w-auto" />
            <h1 class="ml-4 text-2xl font-bold text-primary-800">Fabric</h1>
          </div>
          
          <div class="flex items-center space-x-4">
            <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-primary-600">
              Dashboard
            </RouterLink>
            <span class="text-sm text-gray-700">
              Olá, <span class="font-semibold">{{ authStore.userName }}</span>
            </span>
            <Button variant="outline" size="sm" @click="handleLogout">
              Sair
            </Button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Fornecedores</h2>
          <p class="mt-1 text-sm text-gray-600">Gerencie os fornecedores do sistema</p>
        </div>
        <Button @click="openCreateModal">
          <span class="mr-2">+</span>
          Novo Fornecedor
        </Button>
      </div>

      <Card class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              v-model="filters.search"
              type="text"
              placeholder="Código, nome, documento ou email..."
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @input="handleFilterChange"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              v-model="filters.active"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              @change="handleFilterChange"
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <div v-if="loading" class="text-center py-12">
          <p class="text-gray-500">Carregando...</p>
        </div>

        <div v-else-if="suppliers.length === 0" class="text-center py-12">
          <p class="text-gray-500">Nenhum fornecedor encontrado</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contato</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cidade</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="supplier in suppliers" :key="supplier.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ supplier.code }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ supplier.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ supplier.document || '-' }}</td>
                <td class="px-6 py-4 text-sm text-gray-500">
                  <div>{{ supplier.email || '-' }}</div>
                  <div class="text-xs">{{ supplier.phone || '-' }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ supplier.city || '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="supplier.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {{ supplier.active ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button @click="openEditModal(supplier)" class="text-primary-600 hover:text-primary-900">Editar</button>
                  <button @click="handleToggleActive(supplier)" class="text-yellow-600 hover:text-yellow-900">
                    {{ supplier.active ? 'Desativar' : 'Ativar' }}
                  </button>
                  <button @click="handleDelete(supplier)" class="text-red-600 hover:text-red-900">Excluir</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </main>

    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="closeModal">
      <div class="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="p-6">
          <div class="flex justify-between items-start mb-6">
            <h3 class="text-2xl font-bold text-gray-900">{{ editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor' }}</h3>
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>

          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Código *</label>
                <input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                <input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
              <input v-model="formData.legalName" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">CNPJ/CPF</label>
                <input v-model="formData.document" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input v-model="formData.phone" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input v-model="formData.email" type="email" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
              <input v-model="formData.address" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                <input v-model="formData.city" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <input v-model="formData.state" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                <input v-model="formData.zipCode" type="text" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Prazo de Pagamento</label>
                <input v-model="formData.paymentTerms" type="text" placeholder="Ex: 30 dias" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Lead Time (dias)</label>
                <input v-model.number="formData.leadTime" type="number" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
            </div>

            <div class="flex items-center">
              <input v-model="formData.active" type="checkbox" id="active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <label for="active" class="ml-2 text-sm text-gray-700">Ativo</label>
            </div>

            <div class="flex gap-3 pt-4">
              <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
              <Button type="submit" :disabled="loading" class="flex-1">{{ editingSupplier ? 'Salvar' : 'Criar' }}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import { useSupplierStore } from '@/stores/supplier.store';
import type { Supplier } from '@/services/supplier.service';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const supplierStore = useSupplierStore();

const suppliers = ref<Supplier[]>([]);
const loading = ref(false);
const showModal = ref(false);
const editingSupplier = ref<Supplier | null>(null);

const filters = ref({ search: '', active: '' });
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 });

const formData = ref({
  code: '', name: '', legalName: '', document: '', email: '', phone: '',
  address: '', city: '', state: '', zipCode: '', country: 'BR',
  paymentTerms: '', leadTime: undefined as number | undefined, active: true
});

const loadSuppliers = async () => {
  try {
    loading.value = true;
    const result = await supplierStore.fetchSuppliers(pagination.value.page, pagination.value.limit, {
      active: filters.value.active ? filters.value.active === 'true' : undefined,
      search: filters.value.search || undefined,
    });
    suppliers.value = result.data;
    pagination.value = result.pagination;
  } finally {
    loading.value = false;
  }
};

const handleFilterChange = () => {
  pagination.value.page = 1;
  loadSuppliers();
};

const openCreateModal = () => {
  editingSupplier.value = null;
  formData.value = { code: '', name: '', legalName: '', document: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', country: 'BR', paymentTerms: '', leadTime: undefined, active: true };
  showModal.value = true;
};

const openEditModal = (supplier: Supplier) => {
  editingSupplier.value = supplier;
  formData.value = { ...supplier };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingSupplier.value = null;
};

const handleSubmit = async () => {
  try {
    if (editingSupplier.value) {
      await supplierStore.updateSupplier(editingSupplier.value.id, formData.value);
      alert('Fornecedor atualizado com sucesso!');
    } else {
      await supplierStore.createSupplier(formData.value);
      alert('Fornecedor criado com sucesso!');
    }
    closeModal();
    await loadSuppliers();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao salvar fornecedor');
  }
};

const handleToggleActive = async (supplier: Supplier) => {
  if (confirm(`Deseja ${supplier.active ? 'desativar' : 'ativar'} o fornecedor "${supplier.name}"?`)) {
    try {
      await supplierStore.toggleActive(supplier.id);
      await loadSuppliers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao alterar status');
    }
  }
};

const handleDelete = async (supplier: Supplier) => {
  if (confirm(`Deseja realmente excluir o fornecedor "${supplier.name}"?`)) {
    try {
      await supplierStore.deleteSupplier(supplier.id);
      alert('Fornecedor excluído com sucesso!');
      await loadSuppliers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao excluir fornecedor');
    }
  }
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

onMounted(() => loadSuppliers());
</script>
