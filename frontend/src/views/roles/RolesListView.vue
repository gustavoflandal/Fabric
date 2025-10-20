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
              Dashboard
            </RouterLink>
            <RouterLink to="/users" class="text-sm text-gray-700 hover:text-primary-600">
              Usuários
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
          <h2 class="text-3xl font-bold text-gray-900">Perfis de Acesso</h2>
          <p class="mt-1 text-sm text-gray-600">
            Gerencie os perfis e suas permissões
          </p>
        </div>
        <Button variant="primary" @click="openCreateModal">
          + Novo Perfil
        </Button>
      </div>

      <!-- Roles Grid -->
      <div v-if="loading" class="text-center py-8">
        <p class="text-gray-500">Carregando...</p>
      </div>

      <div v-else-if="roles.length === 0" class="text-center py-8">
        <Card>
          <p class="text-gray-500">Nenhum perfil encontrado</p>
        </Card>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card v-for="role in roles" :key="role.id" class="hover:shadow-lg transition-shadow">
          <div class="space-y-4">
            <!-- Header -->
            <div class="flex justify-between items-start">
              <div>
                <h3 class="text-lg font-bold text-gray-900">{{ role.name }}</h3>
                <span class="inline-block mt-1 px-2 py-1 text-xs font-mono bg-gray-100 text-gray-700 rounded">
                  {{ role.code }}
                </span>
              </div>
              <span
                :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  role.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                ]"
              >
                {{ role.active ? 'Ativo' : 'Inativo' }}
              </span>
            </div>

            <!-- Description -->
            <p v-if="role.description" class="text-sm text-gray-600">
              {{ role.description }}
            </p>

            <!-- Stats -->
            <div class="flex items-center justify-between text-sm">
              <div class="flex items-center text-gray-600">
                <span class="font-medium">{{ role.permissions?.length || 0 }}</span>
                <span class="ml-1">permissões</span>
              </div>
              <div class="flex items-center text-gray-600">
                <span class="font-medium">{{ role.usersCount || 0 }}</span>
                <span class="ml-1">usuários</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-2 pt-4 border-t">
              <button
                @click="managePermissions(role)"
                class="flex-1 px-3 py-2 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"
              >
                Permissões
              </button>
              <button
                @click="editRole(role)"
                class="flex-1 px-3 py-2 text-sm bg-secondary-50 text-secondary-700 rounded-lg hover:bg-secondary-100"
              >
                Editar
              </button>
              <button
                @click="deleteRole(role)"
                class="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
              >
                Excluir
              </button>
            </div>
          </div>
        </Card>
      </div>
    </main>

    <!-- Role Form Modal -->
    <RoleFormModal
      :is-open="showRoleModal"
      :role="selectedRole"
      @close="showRoleModal = false"
      @success="handleModalSuccess"
    />

    <!-- Permissions Modal -->
    <PermissionsModal
      :is-open="showPermissionsModal"
      :role="selectedRole"
      @close="showPermissionsModal = false"
      @success="handleModalSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth.store';
import roleService, { type Role } from '@/services/role.service';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import RoleFormModal from '@/components/roles/RoleFormModal.vue';
import PermissionsModal from '@/components/roles/PermissionsModal.vue';

const router = useRouter();
const authStore = useAuthStore();

const roles = ref<Role[]>([]);
const loading = ref(false);
const showRoleModal = ref(false);
const showPermissionsModal = ref(false);
const selectedRole = ref<Role | null>(null);

const loadRoles = async () => {
  try {
    loading.value = true;
    const response = await roleService.getAll();
    roles.value = response.data;
  } catch (error) {
    console.error('Erro ao carregar perfis:', error);
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  selectedRole.value = null;
  showRoleModal.value = true;
};

const editRole = (role: Role) => {
  selectedRole.value = role;
  showRoleModal.value = true;
};

const managePermissions = (role: Role) => {
  selectedRole.value = role;
  showPermissionsModal.value = true;
};

const deleteRole = async (role: Role) => {
  if (!confirm(`Deseja realmente excluir o perfil "${role.name}"?\n\nEsta ação não pode ser desfeita.`)) {
    return;
  }

  try {
    await roleService.delete(role.id);
    loadRoles();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao excluir perfil');
  }
};

const handleModalSuccess = () => {
  loadRoles();
};

const handleLogout = async () => {
  await authStore.logout();
  router.push('/login');
};

onMounted(() => {
  loadRoles();
});
</script>
