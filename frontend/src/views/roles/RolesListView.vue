<template>
  <AppLayout title="Perfis de Acesso" subtitle="Gerencie os perfis e suas permissões">
    <!-- O slot #nav substitui o "Início" padrão do AppLayout, então os 2 links
         do header antigo (Início / Usuários) são redeclarados aqui. -->
    <template #nav>
      <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-primary-600">
        Início
      </RouterLink>
      <RouterLink to="/users" class="text-sm text-gray-700 hover:text-primary-600">
        Usuários
      </RouterLink>
    </template>

    <template #actions>
      <Button variant="primary" @click="openCreateModal">
        + Novo Perfil
      </Button>
    </template>

    <!-- Grid de cards, não tabela: em vez de forçar o DataTable, replicamos aqui a
         linguagem visual dos seus estados (spinner primary / faixa vermelha com
         "Tentar Novamente"), como MRPView e ReportsView no Lote 5. -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p class="mt-4 text-gray-600">Carregando...</p>
    </div>

    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
      <p class="text-red-600">{{ error }}</p>
      <Button class="mt-4" @click="loadRoles">Tentar Novamente</Button>
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
            <StatusBadge
              :label="role.active ? 'Ativo' : 'Inativo'"
              :tone="role.active ? 'success' : 'danger'"
            />
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
              class="flex-1 px-3 py-2 text-sm bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100"
              @click="managePermissions(role)"
            >
              Permissões
            </button>
            <button
              class="flex-1 px-3 py-2 text-sm bg-secondary-50 text-secondary-700 rounded-lg hover:bg-secondary-100"
              @click="editRole(role)"
            >
              Editar
            </button>
            <button
              class="px-3 py-2 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100"
              @click="deleteRole(role)"
            >
              Excluir
            </button>
          </div>
        </div>
      </Card>
    </div>

    <!-- Role Form Modal — componente extraído, fora do escopo do Lote 6. -->
    <RoleFormModal
      :is-open="showRoleModal"
      :role="selectedRole"
      @close="showRoleModal = false"
      @success="handleModalSuccess"
    />

    <!-- Permissions Modal — componente extraído, fora do escopo do Lote 6. -->
    <PermissionsModal
      :is-open="showPermissionsModal"
      :role="selectedRole"
      @close="showPermissionsModal = false"
      @success="handleModalSuccess"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import roleService, { type Role } from '@/services/role.service';
import AppLayout from '@/components/common/AppLayout.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import StatusBadge from '@/components/common/StatusBadge.vue';
import RoleFormModal from '@/components/roles/RoleFormModal.vue';
import PermissionsModal from '@/components/roles/PermissionsModal.vue';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';

const toast = useToast();

const roles = ref<Role[]>([]);
const loading = ref(false);
// §4.4-5 / I11: antes a falha só ia para o console e a tela mostrava
// "Nenhum perfil encontrado", indistinguível de lista realmente vazia.
const error = ref('');
const showRoleModal = ref(false);
const showPermissionsModal = ref(false);
const selectedRole = ref<Role | null>(null);

const loadRoles = async () => {
  try {
    loading.value = true;
    error.value = '';
    const response = await roleService.getAll();
    roles.value = response.data;
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao carregar perfis';
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
  if (!(await confirmDialog(`Deseja realmente excluir o perfil "${role.name}"?\n\nEsta ação não pode ser desfeita.`))) {
    return;
  }

  try {
    await roleService.delete(role.id);
    loadRoles();
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Erro ao excluir perfil');
  }
};

const handleModalSuccess = () => {
  loadRoles();
};

onMounted(() => {
  loadRoles();
});
</script>
