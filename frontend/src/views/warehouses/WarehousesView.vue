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
              Início
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
          <h2 class="text-3xl font-bold text-gray-900">Armazéns</h2>
          <p class="mt-1 text-sm text-gray-600">Gerencie os armazéns do sistema</p>
        </div>
        <Button @click="openCreateModal">
          <span class="mr-2">+</span>
          Novo Armazém
        </Button>
      </div>

      <Card class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input v-model="search" type="text" class="w-full border-gray-300 rounded-md shadow-sm" placeholder="Digite para buscar..." />
          </div>
        </div>
      </Card>

      <Card>
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Documento</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cidade</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" class="relative px-6 py-3">
                <span class="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="warehouse in warehouses" :key="warehouse.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ warehouse.code }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ warehouse.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ warehouse.document || '-' }}</td>
              <td class="px-6 py-4 text-sm text-gray-500">
                <div>{{ warehouse.email || '-' }}</div>
                <div class="text-xs">{{ warehouse.phone || '-' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ warehouse.city || '-' }}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span :class="warehouse.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                  {{ warehouse.active ? 'Ativo' : 'Inativo' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button @click="openEditModal(warehouse)" class="text-primary-600 hover:text-primary-900">Editar</button>
                <button @click="handleToggleActive(warehouse)" class="text-yellow-600 hover:text-yellow-900">
                  {{ warehouse.active ? 'Desativar' : 'Ativar' }}
                </button>
                <button @click="handleDelete(warehouse)" class="text-red-600 hover:text-red-900">Excluir</button>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </main>

    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" @click="closeModal">
      <div class="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" @click.stop>
        <div class="p-6">
          <div class="flex justify-between items-start mb-6">
            <h3 class="text-2xl font-bold text-gray-900">{{ editingWarehouse ? 'Editar Armazém' : 'Novo Armazém' }}</h3>
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
                <label class="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                <input v-model="formData.managerName" type="text" placeholder="Nome do gerente" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Capacidade (m³)</label>
                <input v-model.number="formData.capacity" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea v-model="formData.description" rows="3" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea>
            </div>

            <div class="flex items-center">
              <input v-model="formData.active" type="checkbox" id="active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <label for="active" class="ml-2 text-sm text-gray-700">Ativo</label>
            </div>

            <div class="flex gap-3 pt-4">
              <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
              <Button type="submit" :disabled="loading" class="flex-1">{{ editingWarehouse ? 'Salvar' : 'Criar' }}</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useWarehouseStore } from '@/stores/warehouse.store';
import { useAuthStore } from '@/stores/auth.store';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const warehouseStore = useWarehouseStore();

const search = ref('');
const warehouses = ref([]);
const loading = ref(false);
const showModal = ref(false);
const editingWarehouse = ref(null);

const formData = ref({
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

const loadWarehouses = async () => {
  try {
    loading.value = true;
    await warehouseStore.fetchWarehouses();
    warehouses.value = warehouseStore.warehouses;
  } finally {
    loading.value = false;
  }
};

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

const openEditModal = (warehouse) => {
  editingWarehouse.value = warehouse;
  formData.value = { ...warehouse };
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingWarehouse.value = null;
};

const handleSubmit = async () => {
  try {
    if (editingWarehouse.value) {
      await warehouseStore.updateWarehouse(editingWarehouse.value.id, formData.value);
      alert('Armazém atualizado com sucesso!');
    } else {
      await warehouseStore.createWarehouse(formData.value);
      alert('Armazém criado com sucesso!');
    }
    closeModal();
    await loadWarehouses();
  } catch (error) {
    alert(error.response?.data?.message || 'Erro ao salvar armazém');
  }
};

const handleToggleActive = async (warehouse) => {
  if (confirm(`Deseja ${warehouse.active ? 'desativar' : 'ativar'} o armazém "${warehouse.name}"?`)) {
    try {
      await warehouseStore.updateWarehouse(warehouse.id, { active: !warehouse.active });
      await loadWarehouses();
    } catch (error) {
      alert(error.response?.data?.message || 'Erro ao alterar status');
    }
  }
};

const handleDelete = async (warehouse) => {
  if (confirm(`Deseja realmente excluir o armazém "${warehouse.name}"?`)) {
    try {
      await warehouseStore.deleteWarehouse(warehouse.id);
      alert('Armazém excluído com sucesso!');
      await loadWarehouses();
    } catch (error) {
      alert(error.response?.data?.message || 'Erro ao excluir armazém');
    }
  }
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

onMounted(() => loadWarehouses());
</script>