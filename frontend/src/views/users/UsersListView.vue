<template>
  <AppLayout title="Usuários" subtitle="Gerencie os usuários do sistema">
    <!-- O slot #nav substitui o "Início" padrão do AppLayout, então os 3 links
         do header antigo (Início / Perfis / Logs) são redeclarados aqui. -->
    <template #nav>
      <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-primary-600">
        Início
      </RouterLink>
      <RouterLink to="/roles" class="text-sm text-gray-700 hover:text-primary-600">
        Perfis
      </RouterLink>
      <RouterLink to="/audit-logs" class="text-sm text-gray-700 hover:text-primary-600">
        Logs
      </RouterLink>
    </template>

    <template #actions>
      <Button variant="primary" @click="openCreateModal">
        + Novo Usuário
      </Button>
    </template>

    <!-- Busca -->
    <Card class="mb-6">
      <FormField id="users-filter-search" label="Buscar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar por nome ou e-mail..."
          class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          @input="debouncedSearch"
        />
      </FormField>
    </Card>

    <!-- Usuários -->
    <DataTable
      :loading="loading"
      :error="error"
      :items="users"
      :pagination="pagination"
      empty-title="Nenhum usuário encontrado"
      @retry="loadUsers"
      @change-page="changePage"
    >
      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Usuário
        </th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Perfis
        </th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Status
        </th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Último Login
        </th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
          Ações
        </th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap">
          <div>
            <div class="text-sm font-medium text-gray-900">{{ item.name }}</div>
            <div class="text-sm text-gray-500">{{ item.email }}</div>
          </div>
        </td>
        <td class="px-6 py-4">
          <!-- Perfis são rótulos categóricos (vários por linha), não um status:
               continuam com o pill primary-100 e ficam fora do StatusBadge. -->
          <div class="flex flex-wrap gap-1">
            <span
              v-for="role in item.roles"
              :key="role.id"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
            >
              {{ role.name }}
            </span>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge
            :label="item.active ? 'Ativo' : 'Inativo'"
            :tone="item.active ? 'success' : 'danger'"
          />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {{ formatDate(item.lastLogin) }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button
            class="text-primary-600 hover:text-primary-900 mr-3"
            @click="editUser(item)"
          >
            Editar
          </button>
          <button
            class="text-red-600 hover:text-red-900"
            @click="deleteUser(item)"
          >
            Excluir
          </button>
        </td>
      </template>
    </DataTable>

    <!-- User Form Modal — componente extraído, fora do escopo do Lote 6. -->
    <UserFormModal
      :is-open="showUserModal"
      :user="selectedUser"
      @close="showUserModal = false"
      @success="handleModalSuccess"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import userService, { type User } from '@/services/user.service';
import AppLayout from '@/components/common/AppLayout.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import UserFormModal from '@/components/users/UserFormModal.vue';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';
import { useDebounce } from '@/composables/useDebounce';

const toast = useToast();

const users = ref<User[]>([]);
const loading = ref(false);
// §4.4-5 / I11: falha de carga é um estado próprio. Antes só havia `console.error`,
// então um erro de rede aparecia como tabela vazia/parada.
const error = ref('');
const searchQuery = ref('');
const showUserModal = ref(false);
const selectedUser = ref<User | null>(null);

const pagination = ref({
  page: 1,
  limit: 50,
  total: 0,
  pages: 0,
});

const loadUsers = async () => {
  try {
    loading.value = true;
    error.value = '';
    const response = await userService.getAll(
      pagination.value.page,
      pagination.value.limit,
      searchQuery.value || undefined
    );
    users.value = response.data;
    pagination.value = response.pagination;
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao carregar usuários';
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  pagination.value.page = 1;
  loadUsers();
};
const debouncedSearch = useDebounce(handleSearch, 350);

const changePage = (page: number) => {
  pagination.value.page = page;
  loadUsers();
};

const openCreateModal = () => {
  selectedUser.value = null;
  showUserModal.value = true;
};

const editUser = (user: User) => {
  selectedUser.value = user;
  showUserModal.value = true;
};

const handleModalSuccess = () => {
  loadUsers();
};

const deleteUser = async (user: User) => {
  if (!(await confirmDialog(`Deseja realmente excluir o usuário ${user.name}?`))) {
    return;
  }

  try {
    await userService.delete(user.id);
    loadUsers();
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    toast.error('Erro ao excluir usuário');
  }
};

const formatDate = (date: string | null) => {
  if (!date) return 'Nunca';
  return new Date(date).toLocaleString('pt-BR');
};

onMounted(() => {
  loadUsers();
});
</script>
