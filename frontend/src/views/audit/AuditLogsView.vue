<template>
  <AppLayout title="Logs de Auditoria" subtitle="Histórico completo de operações do sistema">
    <!-- Statistics Cards — cards de resumo não têm componente próprio na §4.2,
         então seguem como estavam (mesmo critério do StockView no Lote 5). -->
    <div v-if="statistics" class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <Card>
        <div class="text-center">
          <p class="text-sm font-medium text-gray-600">Total de Logs</p>
          <p class="text-3xl font-bold text-primary-600 mt-2">{{ statistics.totalLogs }}</p>
        </div>
      </Card>
      <Card>
        <div class="text-center">
          <p class="text-sm font-medium text-gray-600">Ação Mais Comum</p>
          <p class="text-xl font-bold text-secondary-600 mt-2">
            {{ statistics.byAction[0]?.action || '-' }}
          </p>
          <p class="text-sm text-gray-500">{{ statistics.byAction[0]?.count || 0 }} vezes</p>
        </div>
      </Card>
      <Card>
        <div class="text-center">
          <p class="text-sm font-medium text-gray-600">Módulo Mais Alterado</p>
          <p class="text-xl font-bold text-accent-600 mt-2">
            {{ getMostChangedModule() }}
          </p>
          <p class="text-sm text-gray-500">{{ getMostChangedModuleCount() }} alterações</p>
        </div>
      </Card>
      <Card>
        <div class="text-center">
          <p class="text-sm font-medium text-gray-600">Período</p>
          <p class="text-sm font-bold text-gray-700 mt-2">
            {{ filters.startDate ? formatDate(filters.startDate) : 'Todos' }}
          </p>
        </div>
      </Card>
    </div>

    <!-- Filtros -->
    <Card class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <FormField id="audit-filter-resource" label="Módulo">
          <select
            v-model="filters.resource"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todos</option>
            <option value="users">Usuários</option>
            <option value="roles">Perfis</option>
            <option value="permissions">Permissões</option>
            <option value="audit-logs">Logs de Auditoria</option>
            <option value="auth">Autenticação</option>
            <option value="products">Produtos</option>
            <option value="customers">Clientes</option>
            <option value="orders">Pedidos</option>
            <option value="inventory">Estoque</option>
            <option value="production">Produção</option>
            <option value="quality">Qualidade</option>
            <option value="maintenance">Manutenção</option>
            <option value="reports">Relatórios</option>
            <option value="settings">Configurações</option>
          </select>
        </FormField>

        <FormField id="audit-filter-action" label="Ação">
          <select
            v-model="filters.action"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          >
            <option value="">Todas</option>
            <option value="create">Criar</option>
            <option value="read">Ler</option>
            <option value="update">Atualizar</option>
            <option value="delete">Excluir</option>
          </select>
        </FormField>

        <FormField id="audit-filter-start-date" label="Data Início">
          <input
            v-model="filters.startDate"
            type="date"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          />
        </FormField>

        <FormField id="audit-filter-end-date" label="Data Fim">
          <input
            v-model="filters.endDate"
            type="date"
            class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            @change="handleFilterChange"
          />
        </FormField>

        <!-- Botões: células do grid, não campos — ficam fora do FormField. -->
        <div class="flex items-end">
          <Button variant="outline" full-width @click="clearFilters">
            Limpar Filtros
          </Button>
        </div>

        <div class="flex items-end">
          <Button
            variant="danger"
            full-width
            :disabled="!filters.startDate || !filters.endDate || deleting"
            @click="handleDeleteLogsFromFilters"
          >
            {{ deleting ? 'Excluindo...' : '🗑️ Limpar Logs do Período' }}
          </Button>
        </div>
      </div>
    </Card>

    <!-- Logs -->
    <DataTable
      :loading="loading"
      :error="error"
      :items="logs"
      :pagination="pagination"
      empty-title="Nenhum log encontrado"
      @retry="loadLogs"
      @change-page="changePage"
    >
      <template #head>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Data/Hora
        </th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Usuário
        </th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Módulo
        </th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Ação
        </th>
        <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Status
        </th>
        <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
          Ações
        </th>
      </template>

      <template #row="{ item }">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {{ formatDateTime(item.createdAt) }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">
            {{ item.user?.name || 'Sistema' }}
          </div>
          <div class="text-sm text-gray-500">
            {{ item.user?.email || '-' }}
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          {{ getModuleName(item.endpoint) }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="getActionLabel(item.action)" :tone="getActionTone(item.action)" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <StatusBadge :label="getStatusLabel(item.statusCode)" :tone="getStatusTone(item.statusCode)" />
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button
            class="text-primary-600 hover:text-primary-900"
            @click="viewDetails(item)"
          >
            Detalhes
          </button>
        </td>
      </template>
    </DataTable>

    <!-- Detalhes — o overlay/header/✕/Esc/focus trap vêm do AppModal (§4.2).
         O AppModal não tem subtítulo, então o "ID:" virou a primeira linha do corpo. -->
    <AppModal v-model="showDetailsModal" size="xl" title="Detalhes do Log">
      <div v-if="selectedLog" class="space-y-6">
        <p class="text-sm text-gray-500">ID: {{ selectedLog.id }}</p>

        <!-- Informações Principais -->
        <div class="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs font-medium text-gray-600 uppercase">Data/Hora</p>
              <p class="text-base font-semibold text-gray-900 mt-1">
                {{ formatDateTime(selectedLog.createdAt) }}
              </p>
            </div>
            <div>
              <p class="text-xs font-medium text-gray-600 uppercase">Ação</p>
              <StatusBadge
                class="mt-1"
                :label="getActionLabel(selectedLog.action)"
                :tone="getActionTone(selectedLog.action)"
              />
            </div>
          </div>
        </div>

        <!-- Usuário e Contexto -->
        <div class="grid grid-cols-2 gap-4">
          <div class="border border-gray-200 rounded-lg p-4">
            <p class="text-xs font-medium text-gray-600 uppercase mb-2">👤 Usuário</p>
            <p class="text-base font-semibold text-gray-900">
              {{ selectedLog.user?.name || 'Sistema' }}
            </p>
            <p class="text-sm text-gray-600">{{ selectedLog.user?.email || '-' }}</p>
          </div>
          <div class="border border-gray-200 rounded-lg p-4">
            <p class="text-xs font-medium text-gray-600 uppercase mb-2">📦 Recurso</p>
            <p class="text-base font-semibold text-gray-900">{{ selectedLog.resource }}</p>
            <p class="text-sm text-gray-600">ID: {{ selectedLog.resourceId || '-' }}</p>
          </div>
        </div>

        <!-- Detalhes Técnicos -->
        <div class="border border-gray-200 rounded-lg p-4">
          <p class="text-sm font-semibold text-gray-900 mb-3">🔧 Detalhes Técnicos</p>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <p class="text-xs text-gray-600">Método</p>
              <p class="text-sm font-medium text-gray-900">{{ selectedLog.method || '-' }}</p>
            </div>
            <div>
              <p class="text-xs text-gray-600">Status</p>
              <StatusBadge
                :label="getStatusLabel(selectedLog.statusCode)"
                :tone="getStatusTone(selectedLog.statusCode)"
              />
            </div>
            <div>
              <p class="text-xs text-gray-600">Duração</p>
              <p class="text-sm font-medium text-gray-900">{{ selectedLog.durationMs || 0 }}ms</p>
            </div>
            <div>
              <p class="text-xs text-gray-600">IP</p>
              <p class="text-sm font-medium text-gray-900">{{ selectedLog.ipAddress || '-' }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-xs text-gray-600">Endpoint</p>
              <p class="text-sm font-mono text-gray-900 truncate">{{ selectedLog.endpoint || '-' }}</p>
            </div>
          </div>
        </div>

        <!-- Descrição -->
        <div v-if="selectedLog.description" class="border border-gray-200 rounded-lg p-4">
          <p class="text-sm font-semibold text-gray-900 mb-2">📝 Descrição</p>
          <p class="text-sm text-gray-700">{{ selectedLog.description }}</p>
        </div>

        <!-- Alterações (Old/New Values) -->
        <div v-if="selectedLog.oldValues || selectedLog.newValues" class="border border-gray-200 rounded-lg p-4">
          <p class="text-sm font-semibold text-gray-900 mb-3">🔄 Alterações Realizadas</p>

          <div class="grid grid-cols-2 gap-4">
            <!-- Valores Antigos -->
            <div v-if="selectedLog.oldValues" class="bg-red-50 rounded-lg p-3">
              <p class="text-xs font-semibold text-red-800 mb-2 uppercase">❌ Valores Antigos</p>
              <div class="space-y-2">
                <div v-for="(value, key) in selectedLog.oldValues" :key="'old-' + key" class="text-sm">
                  <span class="font-medium text-red-900">{{ key }}:</span>
                  <span class="text-red-700 ml-2">{{ formatValue(value) }}</span>
                </div>
              </div>
            </div>

            <!-- Valores Novos -->
            <div v-if="selectedLog.newValues" class="bg-green-50 rounded-lg p-3">
              <p class="text-xs font-semibold text-green-800 mb-2 uppercase">✅ Valores Novos</p>
              <div class="space-y-2">
                <div v-for="(value, key) in selectedLog.newValues" :key="'new-' + key" class="text-sm">
                  <span class="font-medium text-green-900">{{ key }}:</span>
                  <span class="text-green-700 ml-2">{{ formatValue(value) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Request Body -->
        <div v-if="selectedLog.requestBody" class="border border-gray-200 rounded-lg p-4">
          <div class="flex justify-between items-center mb-2">
            <p class="text-sm font-semibold text-gray-900">📤 Request Body</p>
            <button
              class="text-xs text-primary-600 hover:text-primary-800"
              @click="copyToClipboard(JSON.stringify(selectedLog.requestBody, null, 2))"
            >
              📋 Copiar
            </button>
          </div>
          <pre class="bg-gray-50 p-3 rounded text-xs overflow-x-auto border border-gray-200">{{ JSON.stringify(selectedLog.requestBody, null, 2) }}</pre>
        </div>

        <!-- Response Body -->
        <div v-if="selectedLog.responseBody" class="border border-gray-200 rounded-lg p-4">
          <div class="flex justify-between items-center mb-2">
            <p class="text-sm font-semibold text-gray-900">📥 Response Body</p>
            <button
              class="text-xs text-primary-600 hover:text-primary-800"
              @click="copyToClipboard(JSON.stringify(selectedLog.responseBody, null, 2))"
            >
              📋 Copiar
            </button>
          </div>
          <pre class="bg-gray-50 p-3 rounded text-xs overflow-x-auto border border-gray-200">{{ JSON.stringify(selectedLog.responseBody, null, 2) }}</pre>
        </div>

        <!-- Erro -->
        <div v-if="selectedLog.errorMessage" class="bg-red-50 border border-red-200 rounded-lg p-4">
          <p class="text-sm font-semibold text-red-900 mb-2">⚠️ Erro</p>
          <p class="text-sm text-red-700">{{ selectedLog.errorMessage }}</p>
        </div>

        <!-- User Agent -->
        <div v-if="selectedLog.userAgent" class="border border-gray-200 rounded-lg p-4">
          <p class="text-xs font-medium text-gray-600 uppercase mb-2">🖥️ User Agent</p>
          <p class="text-xs text-gray-700 font-mono break-all">{{ selectedLog.userAgent }}</p>
        </div>
      </div>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import auditLogService, { type AuditLog, type AuditLogStatistics } from '@/services/audit-log.service';
import AppLayout from '@/components/common/AppLayout.vue';
import AppModal from '@/components/common/AppModal.vue';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';
import DataTable from '@/components/common/DataTable.vue';
import FormField from '@/components/common/FormField.vue';
import StatusBadge, { type BadgeTone } from '@/components/common/StatusBadge.vue';
import { useToast } from '@/composables/useToast';
import { confirmDialog } from '@/composables/useConfirm';

const toast = useToast();

const logs = ref<AuditLog[]>([]);
const statistics = ref<AuditLogStatistics | null>(null);
const loading = ref(false);
// §4.4-5 / I11: antes a falha de carga só ia para o console e a tela mostrava
// "Nenhum log encontrado", indistinguível de período realmente sem logs.
const error = ref('');
// O AppModal usa v-model booleano; `selectedLog` continua sendo o dado exibido
// (mesmo par de refs que o StockView do Lote 5 usa no modal de movimentações).
const showDetailsModal = ref(false);
const selectedLog = ref<AuditLog | null>(null);
const deleting = ref(false);

const filters = ref({
  resource: '',
  action: '',
  startDate: '',
  endDate: '',
});

const pagination = ref({
  page: 1,
  limit: 100,
  total: 0,
  pages: 0,
});

const loadLogs = async () => {
  try {
    loading.value = true;
    error.value = '';

    const response = await auditLogService.getAll(
      pagination.value.page,
      pagination.value.limit,
      {
        resource: filters.value.resource || undefined,
        action: filters.value.action || undefined,
        startDate: filters.value.startDate || undefined,
        endDate: filters.value.endDate || undefined,
      }
    );
    logs.value = response.data;
    pagination.value = response.pagination;
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || 'Erro ao carregar logs';
  } finally {
    loading.value = false;
  }
};

const loadStatistics = async () => {
  try {
    const response = await auditLogService.getStatistics(
      filters.value.startDate || undefined,
      filters.value.endDate || undefined
    );
    statistics.value = response.data;
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
};

const handleFilterChange = () => {
  pagination.value.page = 1;
  loadLogs();
  loadStatistics();
};

const clearFilters = () => {
  filters.value = {
    resource: '',
    action: '',
    startDate: '',
    endDate: '',
  };
  handleFilterChange();
};

const changePage = (page: number) => {
  pagination.value.page = page;
  loadLogs();
};

const viewDetails = (log: AuditLog) => {
  selectedLog.value = log;
  showDetailsModal.value = true;
};

const formatDateTime = (date: string) => {
  return new Date(date).toLocaleString('pt-BR');
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('pt-BR');
};

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    create: 'Criar',
    read: 'Ler',
    update: 'Atualizar',
    delete: 'Excluir',
  };
  return labels[action] || action;
};

// Mesmas cores dos antigos getActionBadgeClass/getStatusBadgeClass, agora expressas
// como tons da paleta do StatusBadge — e compartilhadas pela tabela e pelo modal,
// que antes repetiam as duas funções de classe.
const ACTION_TONES: Record<string, BadgeTone> = {
  create: 'success',
  read: 'info',
  update: 'warning',
  delete: 'danger',
};

const getActionTone = (action: string): BadgeTone => {
  return ACTION_TONES[action] || 'neutral';
};

const getStatusLabel = (status: number | null) => {
  return status ? String(status) : '-';
};

const getStatusTone = (status: number | null): BadgeTone => {
  if (!status) return 'neutral';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 400) return 'danger';
  return 'warning';
};

const getModuleName = (endpoint: string) => {
  if (!endpoint) return '-';

  // Extrair módulo do endpoint: /api/v1/users -> Usuários
  const moduleMap: Record<string, string> = {
    'users': 'Usuários',
    'roles': 'Perfis',
    'permissions': 'Permissões',
    'audit-logs': 'Logs de Auditoria',
    'auth': 'Autenticação',
    'products': 'Produtos',
    'customers': 'Clientes',
    'orders': 'Pedidos',
    'inventory': 'Estoque',
    'production': 'Produção',
    'quality': 'Qualidade',
    'maintenance': 'Manutenção',
    'reports': 'Relatórios',
    'settings': 'Configurações',
  };

  // Extrair o módulo do path (ex: /api/v1/users/123 -> users)
  const parts = endpoint.split('/').filter(Boolean);
  const moduleKey = parts.find(part =>
    part !== 'api' &&
    part !== 'v1' &&
    !part.match(/^\d+$/) && // Não é um ID numérico
    !part.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) // Não é UUID
  );

  return moduleKey ? (moduleMap[moduleKey] || moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1)) : 'Sistema';
};

const getMostChangedModule = () => {
  if (!statistics.value?.byResource || statistics.value.byResource.length === 0) {
    return '-';
  }

  // Agrupar por módulo
  const moduleCount: Record<string, number> = {};

  statistics.value.byResource.forEach((item: any) => {
    // Simular endpoint a partir do recurso
    const endpoint = `/api/v1/${item.resource}`;
    const moduleName = getModuleName(endpoint);

    if (moduleCount[moduleName]) {
      moduleCount[moduleName] += item.count;
    } else {
      moduleCount[moduleName] = item.count;
    }
  });

  // Encontrar o módulo com mais alterações
  const sortedModules = Object.entries(moduleCount).sort((a, b) => b[1] - a[1]);

  return sortedModules.length > 0 ? sortedModules[0][0] : '-';
};

const getMostChangedModuleCount = () => {
  if (!statistics.value?.byResource || statistics.value.byResource.length === 0) {
    return 0;
  }

  // Agrupar por módulo
  const moduleCount: Record<string, number> = {};

  statistics.value.byResource.forEach((item: any) => {
    const endpoint = `/api/v1/${item.resource}`;
    const moduleName = getModuleName(endpoint);

    if (moduleCount[moduleName]) {
      moduleCount[moduleName] += item.count;
    } else {
      moduleCount[moduleName] = item.count;
    }
  });

  // Encontrar o módulo com mais alterações
  const sortedModules = Object.entries(moduleCount).sort((a, b) => b[1] - a[1]);

  return sortedModules.length > 0 ? sortedModules[0][1] : 0;
};

const handleDeleteLogsFromFilters = async () => {
  if (!filters.value.startDate || !filters.value.endDate) {
    toast.warning('Por favor, selecione as datas de início e fim nos filtros acima.');
    return;
  }

  const confirmMessage = `⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nVocê está prestes a excluir TODOS os logs entre:\n\n📅 ${formatDate(filters.value.startDate)} e ${formatDate(filters.value.endDate)}\n\nDeseja realmente continuar?`;

  if (!(await confirmDialog(confirmMessage, { title: 'Excluir logs de auditoria' }))) {
    return;
  }

  // Confirmação adicional
  if (!(await confirmDialog('Confirme novamente: Deseja REALMENTE excluir os logs deste período?', { title: 'Confirmação final' }))) {
    return;
  }

  try {
    deleting.value = true;

    const response = await auditLogService.deleteLogs(
      filters.value.startDate,
      filters.value.endDate
    );

    const count = response.data.data.count;
    toast.success(`${count} logs foram excluídos permanentemente.`);

    // Limpar filtros e recarregar
    filters.value = {
      resource: '',
      action: '',
      startDate: '',
      endDate: '',
    };

    // Recarregar logs
    await loadLogs();
    await loadStatistics();
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 'Erro ao excluir logs';
    toast.error(errorMessage);
  } finally {
    deleting.value = false;
  }
};

const formatValue = (value: any): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  } catch (err) {
    console.error('Erro ao copiar:', err);
    toast.error('Erro ao copiar para a área de transferência');
  }
};

onMounted(() => {
  loadLogs();
  loadStatistics();
});
</script>
