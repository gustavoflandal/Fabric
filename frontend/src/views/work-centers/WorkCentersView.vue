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
            <RouterLink to="/dashboard" class="text-sm text-gray-700 hover:text-primary-600">Início</RouterLink>
            <span class="text-sm text-gray-700">Olá, <span class="font-semibold">{{ authStore.userName }}</span></span>
            <Button variant="outline" size="sm" @click="handleLogout">Sair</Button>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-6 flex justify-between items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900">Centros de Trabalho</h2>
          <p class="mt-1 text-sm text-gray-600">Gerencie os centros de trabalho do sistema</p>
        </div>
        <Button @click="openCreateModal"><span class="mr-2">+</span>Novo Centro de Trabalho</Button>
      </div>

      <Card class="mb-6">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input v-model="filters.search" type="text" placeholder="Código ou nome..." class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @input="handleFilterChange" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select v-model="filters.type" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @change="handleFilterChange">
              <option value="">Todos</option>
              <option value="machine">Máquina</option>
              <option value="manual">Manual</option>
              <option value="assembly">Montagem</option>
              <option value="quality">Qualidade</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select v-model="filters.active" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" @change="handleFilterChange">
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <div v-if="loading" class="text-center py-12"><p class="text-gray-500">Carregando...</p></div>
        <div v-else-if="workCenters.length === 0" class="text-center py-12"><p class="text-gray-500">Nenhum centro de trabalho encontrado</p></div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capacidade</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Eficiência</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Custo/Hora</th>
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="wc in workCenters" :key="wc.id" class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{{ wc.code }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{{ wc.name }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ getTypeLabel(wc.type) }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ wc.capacity || '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ (wc.efficiency * 100).toFixed(0) }}%</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{{ wc.costPerHour ? `R$ ${wc.costPerHour.toFixed(2)}` : '-' }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span :class="wc.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
                    {{ wc.active ? 'Ativo' : 'Inativo' }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                  <button @click="openEditModal(wc)" class="text-primary-600 hover:text-primary-900">Editar</button>
                  <button @click="handleToggleActive(wc)" class="text-yellow-600 hover:text-yellow-900">{{ wc.active ? 'Desativar' : 'Ativar' }}</button>
                  <button @click="handleDelete(wc)" class="text-red-600 hover:text-red-900">Excluir</button>
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
            <h3 class="text-2xl font-bold text-gray-900">{{ editingWorkCenter ? 'Editar Centro de Trabalho' : 'Novo Centro de Trabalho' }}</h3>
            <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Código *</label><input v-model="formData.code" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Nome *</label><input v-model="formData.name" type="text" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
            </div>
            <div><label class="block text-sm font-medium text-gray-700 mb-1">Descrição</label><textarea v-model="formData.description" rows="2" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"></textarea></div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                <select v-model="formData.type" required class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500">
                  <option value="">Selecione...</option>
                  <option value="machine">Máquina</option>
                  <option value="manual">Manual</option>
                  <option value="assembly">Montagem</option>
                  <option value="quality">Qualidade</option>
                </select>
              </div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Capacidade</label><input v-model.number="formData.capacity" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Eficiência (%)</label><input v-model.number="formData.efficiency" type="number" step="0.01" min="0" max="100" placeholder="100" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
              <div><label class="block text-sm font-medium text-gray-700 mb-1">Custo por Hora (R$)</label><input v-model.number="formData.costPerHour" type="number" step="0.01" class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500" /></div>
            </div>
            <div class="flex items-center"><input v-model="formData.active" type="checkbox" id="active" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500" /><label for="active" class="ml-2 text-sm text-gray-700">Ativo</label></div>
            <div class="flex gap-3 pt-4">
              <Button type="button" variant="outline" @click="closeModal" class="flex-1">Cancelar</Button>
              <Button type="submit" :disabled="loading" class="flex-1">{{ editingWorkCenter ? 'Salvar' : 'Criar' }}</Button>
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
import { useWorkCenterStore } from '@/stores/work-center.store';
import type { WorkCenter } from '@/services/work-center.service';
import Button from '@/components/common/Button.vue';
import Card from '@/components/common/Card.vue';

const router = useRouter();
const authStore = useAuthStore();
const workCenterStore = useWorkCenterStore();

const workCenters = ref<WorkCenter[]>([]);
const loading = ref(false);
const showModal = ref(false);
const editingWorkCenter = ref<WorkCenter | null>(null);
const filters = ref({ search: '', type: '', active: '' });
const pagination = ref({ page: 1, limit: 100, total: 0, pages: 0 });
const formData = ref({ code: '', name: '', description: '', type: '', capacity: undefined as number | undefined, efficiency: 1, costPerHour: undefined as number | undefined, active: true });

const loadWorkCenters = async () => {
  try {
    loading.value = true;
    const result = await workCenterStore.fetchWorkCenters(pagination.value.page, pagination.value.limit, { type: filters.value.type || undefined, active: filters.value.active ? filters.value.active === 'true' : undefined, search: filters.value.search || undefined });
    workCenters.value = result.data;
    pagination.value = result.pagination;
  } finally {
    loading.value = false;
  }
};

const handleFilterChange = () => { pagination.value.page = 1; loadWorkCenters(); };
const openCreateModal = () => { editingWorkCenter.value = null; formData.value = { code: '', name: '', description: '', type: '', capacity: undefined, efficiency: 1, costPerHour: undefined, active: true }; showModal.value = true; };
const openEditModal = (wc: WorkCenter) => { editingWorkCenter.value = wc; formData.value = { ...wc, efficiency: wc.efficiency || 1 }; showModal.value = true; };
const closeModal = () => { showModal.value = false; editingWorkCenter.value = null; };

const handleSubmit = async () => {
  try {
    const data = { ...formData.value, efficiency: (formData.value.efficiency || 100) / 100 };
    if (editingWorkCenter.value) {
      await workCenterStore.updateWorkCenter(editingWorkCenter.value.id, data);
      alert('Centro de trabalho atualizado com sucesso!');
    } else {
      await workCenterStore.createWorkCenter(data);
      alert('Centro de trabalho criado com sucesso!');
    }
    closeModal();
    await loadWorkCenters();
  } catch (error: any) {
    alert(error.response?.data?.message || 'Erro ao salvar centro de trabalho');
  }
};

const handleToggleActive = async (wc: WorkCenter) => {
  if (confirm(`Deseja ${wc.active ? 'desativar' : 'ativar'} o centro de trabalho "${wc.name}"?`)) {
    try {
      await workCenterStore.toggleActive(wc.id);
      await loadWorkCenters();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao alterar status');
    }
  }
};

const handleDelete = async (wc: WorkCenter) => {
  if (confirm(`Deseja realmente excluir o centro de trabalho "${wc.name}"?`)) {
    try {
      await workCenterStore.deleteWorkCenter(wc.id);
      alert('Centro de trabalho excluído com sucesso!');
      await loadWorkCenters();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erro ao excluir centro de trabalho');
    }
  }
};

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = { machine: 'Máquina', manual: 'Manual', assembly: 'Montagem', quality: 'Qualidade' };
  return labels[type] || type;
};

const handleLogout = async () => { await authStore.logout(); router.push('/login'); };
onMounted(() => loadWorkCenters());
</script>
