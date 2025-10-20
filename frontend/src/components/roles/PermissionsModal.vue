<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div
      class="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      @click.stop
    >
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h3 class="text-2xl font-bold text-gray-900">
              Gerenciar Permissões
            </h3>
            <p class="text-sm text-gray-600 mt-1">
              Perfil: <span class="font-semibold">{{ role?.name }}</span>
            </p>
          </div>
          <button
            @click="handleClose"
            class="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="text-center py-8">
          <p class="text-gray-500">Carregando permissões...</p>
        </div>

        <!-- Permissions by Resource -->
        <div v-else class="space-y-6">
          <div v-for="(perms, resource) in groupedPermissions" :key="resource">
            <h4 class="text-lg font-semibold text-gray-900 mb-3">
              {{ getResourceLabel(resource) }}
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-lg">
              <div
                v-for="permission in perms"
                :key="permission.id"
                class="flex items-start"
              >
                <input
                  :id="`perm-${permission.id}`"
                  v-model="selectedPermissions"
                  type="checkbox"
                  :value="permission.id"
                  class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-1"
                />
                <label
                  :for="`perm-${permission.id}`"
                  class="ml-3 block text-sm"
                >
                  <span class="font-medium text-gray-900">{{ getActionLabel(permission.action) }}</span>
                  <p v-if="permission.description" class="text-gray-500 text-xs">
                    {{ permission.description }}
                  </p>
                </label>
              </div>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="flex gap-2 pt-4 border-t">
            <button
              type="button"
              @click="selectAll"
              class="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Selecionar Todas
            </button>
            <button
              type="button"
              @click="deselectAll"
              class="px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Desmarcar Todas
            </button>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-3">
            <p class="text-sm text-red-800">{{ error }}</p>
          </div>

          <!-- Actions -->
          <div class="flex justify-between pt-4 border-t">
            <button
              type="button"
              @click="handleClose"
              class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              :disabled="saving"
            >
              Sair
            </button>
            <div class="flex gap-3">
              <button
                type="button"
                @click="handleClose"
                class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                :disabled="saving"
              >
                Cancelar
              </button>
              <button
                type="button"
                @click="handleSave"
                class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                :disabled="saving"
              >
                {{ saving ? 'Salvando...' : 'Salvar Permissões' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import roleService, { type Role, type Permission } from '@/services/role.service';

interface Props {
  isOpen: boolean;
  role?: Role | null;
}

interface Emits {
  (e: 'close'): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const allPermissions = ref<Permission[]>([]);
const selectedPermissions = ref<string[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');

const groupedPermissions = computed(() => {
  const grouped: Record<string, Permission[]> = {};
  
  allPermissions.value.forEach((perm) => {
    if (!grouped[perm.resource]) {
      grouped[perm.resource] = [];
    }
    grouped[perm.resource].push(perm);
  });
  
  return grouped;
});

const loadPermissions = async () => {
  try {
    loading.value = true;
    const response = await roleService.getAllPermissions();
    allPermissions.value = response.data.all;

    // Se estiver editando, carregar permissões do perfil
    if (props.role) {
      const roleData = await roleService.getById(props.role.id);
      selectedPermissions.value = roleData.data.permissions.map((p: Permission) => p.id);
    }
  } catch (err) {
    console.error('Erro ao carregar permissões:', err);
  } finally {
    loading.value = false;
  }
};

watch(() => props.isOpen, (newValue, oldValue) => {
  // Só executa quando o modal abre (false -> true)
  if (newValue && !oldValue) {
    selectedPermissions.value = [];
    error.value = '';
    loadPermissions();
  }
});

const getResourceLabel = (resource: string) => {
  const labels: Record<string, string> = {
    users: 'Usuários',
    roles: 'Perfis',
    products: 'Produtos',
    boms: 'BOMs (Estruturas de Produto)',
    routings: 'Roteiros de Produção',
    production_orders: 'Ordens de Produção',
    production_pointings: 'Apontamentos de Produção',
    work_centers: 'Centros de Trabalho',
    suppliers: 'Fornecedores',
    customers: 'Clientes',
    stock: 'Estoque',
    mrp: 'MRP (Planejamento de Materiais)',
    reports: 'Relatórios',
    audit_logs: 'Logs de Auditoria',
    purchases: 'Compras',
  };
  return labels[resource] || resource;
};

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    create: 'Criar',
    read: 'Visualizar',
    update: 'Editar',
    delete: 'Excluir',
    export: 'Exportar',
    execute: 'Executar',
    entry: 'Registrar Entrada',
    exit: 'Registrar Saída',
    adjustment: 'Ajustar',
    consolidate: 'Consolidar',
    production: 'Relatório de Produção',
    efficiency: 'Relatório de Eficiência',
    quality: 'Relatório de Qualidade',
    approve_quotation: 'Aprovar Orçamentos',
    approve_order: 'Aprovar Pedidos',
  };
  return labels[action] || action;
};

const selectAll = () => {
  selectedPermissions.value = allPermissions.value.map(p => p.id);
};

const deselectAll = () => {
  selectedPermissions.value = [];
};

const handleSave = async () => {
  if (!props.role) return;

  try {
    saving.value = true;
    error.value = '';

    await roleService.assignPermissions(props.role.id, selectedPermissions.value);

    emit('success');
    handleClose();
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao salvar permissões';
  } finally {
    saving.value = false;
  }
};

const handleClose = () => {
  if (!saving.value) {
    emit('close');
  }
};
</script>
