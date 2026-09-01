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

        <!-- Tabs -->
        <div v-else>
          <div class="mb-6 border-b border-gray-200">
            <nav class="-mb-px flex space-x-8">
              <button
                @click="activeTab = 'geral'"
                :class="[
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === 'geral'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                Geral
              </button>
              <button
                @click="activeTab = 'pcp'"
                :class="[
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === 'pcp'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                PCP
              </button>
              <button
                @click="activeTab = 'wms'"
                :class="[
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === 'wms'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                WMS
              </button>
              <button
                @click="activeTab = 'yms'"
                :class="[
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === 'yms'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                ]"
              >
                YMS
              </button>
            </nav>
          </div>

          <!-- Tab Content -->
          <div class="space-y-6">
            <div v-for="(perms, resource) in filteredPermissionsByTab" :key="resource">
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
const emit = defineEmits<Emits>()

const allPermissions = ref<Permission[]>([]);
const selectedPermissions = ref<string[]>([]);
const activeTab = ref('geral');
const loading = ref(false);
const saving = ref(false);
const error = ref('');

// Definir quais recursos pertencem a cada aba
const tabResourceMapping = {
  geral: ['users', 'roles', 'audit_logs', 'modules'],
  pcp: ['products', 'boms', 'routings', 'production_orders', 'production_pointings', 
        'work_centers', 'suppliers', 'customers', 'stock', 'mrp', 'reports', 'purchases', 'pcp.dashboard'],
  wms: ['counting', 'counting.plans', 'warehouse_receipts', 'warehouse_locations', 'warehouse_transfers', 'warehouses', 'warehouse_structures'],
  yms: ['yard_scheduling', 'yard_docks', 'yard_checkin']
};

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

// Filtrar permissões por aba ativa
const filteredPermissionsByTab = computed(() => {
  const filtered: Record<string, Permission[]> = {};
  const resourcesForTab = tabResourceMapping[activeTab.value as keyof typeof tabResourceMapping] || [];
  
  Object.entries(groupedPermissions.value).forEach(([resource, perms]) => {
    if (resourcesForTab.includes(resource)) {
      filtered[resource] = perms;
    }
  });
  
  return filtered;
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
    // Geral
    users: 'Usuários',
    roles: 'Perfis de Acesso',
    audit_logs: 'Logs de Auditoria',
    modules: 'Módulos do Sistema',
    
    // PCP
    products: 'Produtos',
    boms: 'Listas de Materiais (BOM)',
    routings: 'Roteiros de Produção',
    production_orders: 'Ordens de Produção',
    production_pointings: 'Apontamentos de Produção',
    work_centers: 'Centros de Trabalho',
    suppliers: 'Fornecedores',
    customers: 'Clientes',
    stock: 'Estoque',
    mrp: 'Planejamento de Materiais (MRP)',
    reports: 'Relatórios',
    purchases: 'Compras',
    
    // WMS
    counting: 'Contagem de Estoque',
    'counting.plans': 'Planos de Contagem',
    warehouse_receipts: 'Recebimento de Mercadorias',
    warehouse_locations: 'Localizações do Armazém',
    warehouse_transfers: 'Transferências Internas',
    warehouses: 'Armazéns',
    warehouse_structures: 'Estruturas de Armazém',
    
    // YMS
    yard_scheduling: 'Agendamento de Pátio',
    yard_docks: 'Docas',
    yard_checkin: 'Check-in/Check-out',
  };
  return labels[resource] || resource;
};

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    // Ações básicas
    create: 'Criar',
    read: 'Visualizar',
    update: 'Editar',
    delete: 'Excluir',
    export: 'Exportar',
    execute: 'Executar',
    print: 'Imprimir',
    
    // Estoque
    entry: 'Registrar Entrada',
    exit: 'Registrar Saída',
    adjustment: 'Realizar Ajustes',
    transfer: 'Transferir',
    
    // MRP e Produção
    consolidate: 'Consolidar',
    
    // Relatórios
    production: 'Relatório de Produção',
    efficiency: 'Relatório de Eficiência',
    quality: 'Relatório de Qualidade',
    
    // Compras
    approve_quotation: 'Aprovar Orçamentos',
    approve_order: 'Aprovar Pedidos de Compra',
    
    // Módulos do Sistema
    view_general: 'Visualizar Módulos Gerais',
    view_pcp: 'Visualizar Módulos PCP',
    view_wms: 'Visualizar Módulos WMS',
    view_yms: 'Visualizar Módulos YMS',
    
    // PCP - Dashboard
    view: 'Visualizar Dashboard',
    
    // Contagem de Estoque
    create_plan: 'Criar Planos de Contagem',
    execute_counting: 'Executar Contagem',
    approve_adjustments: 'Aprovar Ajustes',
    
    // Estruturas de Armazém
    gerar_posicoes: 'Gerar Posições de Armazenagem',
    excluir_posicoes: 'Excluir Posições de Armazenagem',
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
