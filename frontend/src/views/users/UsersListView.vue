<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
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
            <RouterLink to="/roles" class="text-sm text-gray-700 hover:text-primary-600">
              Perfis
            </RouterLink>
            <RouterLink to="/audit-logs" class="text-sm text-gray-700 hover:text-primary-600">
              Logs
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

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Page Header -->
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Usuários</h2>
          <p class="mt-1 text-sm text-gray-600">
            Gerencie os usuários do sistema
          </p>
        </div>
        <Button variant="primary" @click="openCreateModal">
          + Novo Usuário
        </Button>
      </div>

      <!-- Search and Filters -->
      <Card class="mb-6">
        <div class="flex gap-4">
          <div class="flex-1">
            <Input
              v-model="searchQuery"
              placeholder="Buscar por nome ou e-mail..."
              @input="handleSearch"
            />
          </div>
        </div>
      </Card>

      <!-- Users Table -->
      <Card>
        <div v-if="loading" class="text-center py-8">
          <p class="text-gray-500">Carregando...</p>
        </div>

        <div v-else-if="users.length === 0" class="text-center py-8">
          <p class="text-gray-500">Nenhum usuário encontrado</p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuário
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Perfis
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Último Login
                </th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="text-sm font-medium text-gray-900">{{ user.name }}</div>
                    <div class="text-sm text-gray-500">{{ user.email }}</div>
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="role in user.roles"
                      :key="role.id"
                      class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                    >
                      {{ role.name }}
                    </span>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    :class="[
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      user.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    ]"
                  >
                    {{ user.active ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatDate(user.lastLogin) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    @click="editUser(user)"
                    class="text-primary-600 hover:text-primary-900 mr-3"
                  >
                    Editar
                  </button>
                  <button
                    @click="deleteUser(user)"
                    class="text-red-600 hover:text-red-900"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="pagination.pages > 1" class="px-6 py-4 border-t border-gray-200">
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
                @click="changePage(pagination.page - 1)"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                :disabled="pagination.page === pagination.pages"
                @click="changePage(pagination.page + 1)"
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </main>

    <!-- User Form Modal -->
    <UserFormModal
      :is-open="showUserModal"
      :user="selectedUser"
      @close="showUserModal = false"
      @success="handleModalSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import userService, { type User } from '@/services/user.service';
import Button from '@/components/common/Button.vue';
import Input from '@/components/common/Input.vue';
import Card from '@/components/common/Card.vue';
import UserFormModal from '@/components/users/UserFormModal.vue';

const router = useRouter();
const authStore = useAuthStore();

const users = ref<User[]>([]);
const loading = ref(false);
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
    const response = await userService.getAll(
      pagination.value.page,
      pagination.value.limit,
      searchQuery.value || undefined
    );
    users.value = response.data;
    pagination.value = response.pagination;
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  pagination.value.page = 1;
  loadUsers();
};

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
  if (!confirm(`Deseja realmente excluir o usuário ${user.name}?`)) {
    return;
  }

  try {
    await userService.delete(user.id);
    loadUsers();
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    alert('Erro ao excluir usuário');
  }
};

const formatDate = (date: string | null) => {
  if (!date) return 'Nunca';
  return new Date(date).toLocaleString('pt-BR');
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

onMounted(() => {
  loadUsers();
});
</script>
