<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <!-- Main Content -->
    <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Header -->
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900">
          {{ isEditing ? 'Editar Plano' : 'Novo Plano de Contagem' }}
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          {{ isEditing ? 'Atualize as informações do plano' : 'Crie um novo plano de contagem de estoque' }}
        </p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <!-- Informações Básicas -->
        <div class="mb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Informações Básicas</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Código <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.code"
                type="text"
                required
                class="w-full border-gray-300 rounded-md shadow-sm"
                placeholder="Ex: CONT-001"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Nome <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.name"
                type="text"
                required
                class="w-full border-gray-300 rounded-md shadow-sm"
                placeholder="Ex: Contagem Mensal"
              />
            </div>
          </div>
        </div>

        <!-- Configurações -->
        <div class="mb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Configurações</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Tipo <span class="text-red-500">*</span>
              </label>
              <select v-model="form.type" required class="w-full border-gray-300 rounded-md shadow-sm">
                <option value="">Selecione...</option>
                <option value="FULL">Contagem Completa</option>
                <option value="PARTIAL">Contagem Parcial</option>
                <option value="CYCLIC">Contagem Cíclica</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Frequência <span class="text-red-500">*</span>
              </label>
              <select v-model="form.frequency" required class="w-full border-gray-300 rounded-md shadow-sm">
                <option value="">Selecione...</option>
                <option value="DAILY">Diária</option>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensal</option>
                <option value="QUARTERLY">Trimestral</option>
                <option value="YEARLY">Anual</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Prioridade <span class="text-red-500">*</span>
              </label>
              <select v-model.number="form.priority" required class="w-full border-gray-300 rounded-md shadow-sm">
                <option :value="1">1 - Baixa</option>
                <option :value="5">5 - Média</option>
                <option :value="10">10 - Alta</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Datas -->
        <div class="mb-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Agendamento</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Data de Início <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.startDate"
                type="date"
                required
                class="w-full border-gray-300 rounded-md shadow-sm"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Data de Término
              </label>
              <input
                v-model="form.endDate"
                type="date"
                class="w-full border-gray-300 rounded-md shadow-sm"
              />
            </div>
          </div>
        </div>

        <!-- Descrição -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Descrição
          </label>
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full border-gray-300 rounded-md shadow-sm"
            placeholder="Descreva o objetivo e detalhes do plano..."
          ></textarea>
        </div>

        <!-- Actions -->
        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            @click="router.back()"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            :disabled="loading"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {{ loading ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Criar Plano') }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useCountingStore } from '@/stores/counting.store';
import AppHeader from '@/components/AppHeader.vue';

const router = useRouter();
const route = useRoute();
const countingStore = useCountingStore();

const loading = ref(false);
const isEditing = ref(false);

const form = ref({
  code: '',
  name: '',
  type: '',
  frequency: '',
  priority: 5,
  startDate: '',
  endDate: '',
  description: '',
});

onMounted(async () => {
  const planId = route.params.id as string;
  if (planId && planId !== 'new') {
    isEditing.value = true;
    await loadPlan(planId);
  }
});

const loadPlan = async (id: string) => {
  try {
    loading.value = true;
    const plan = await countingStore.fetchPlan(id);
    form.value = {
      code: plan.code,
      name: plan.name,
      type: plan.type,
      frequency: plan.frequency,
      priority: plan.priority,
      startDate: plan.startDate ? new Date(plan.startDate).toISOString().split('T')[0] : '',
      endDate: plan.endDate ? new Date(plan.endDate).toISOString().split('T')[0] : '',
      description: plan.description || '',
    };
  } catch (error) {
    console.error('Erro ao carregar plano:', error);
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  try {
    loading.value = true;
    
    const data = {
      ...form.value,
      startDate: new Date(form.value.startDate),
      endDate: form.value.endDate ? new Date(form.value.endDate) : undefined,
    };

    if (isEditing.value) {
      await countingStore.updatePlan(route.params.id as string, data);
    } else {
      await countingStore.createPlan(data);
    }

    router.push('/counting/plans');
  } catch (error) {
    console.error('Erro ao salvar plano:', error);
    alert('Erro ao salvar plano. Tente novamente.');
  } finally {
    loading.value = false;
  }
};
</script>
