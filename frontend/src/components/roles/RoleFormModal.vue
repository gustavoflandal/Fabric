<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div
      class="bg-white rounded-lg max-w-lg w-full mx-4"
      @click.stop
    >
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h3 class="text-2xl font-bold text-gray-900">
              {{ isEditMode ? 'Editar Perfil' : 'Novo Perfil' }}
            </h3>
            <p class="text-sm text-gray-600 mt-1">
              {{ isEditMode ? 'Atualize as informações do perfil' : 'Crie um novo perfil de acesso' }}
            </p>
          </div>
          <button
            @click="handleClose"
            class="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <!-- Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Código -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Código *
            </label>
            <input
              v-model="form.code"
              type="text"
              required
              maxlength="50"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 uppercase"
              placeholder="ADMIN"
              @input="form.code = form.code.toUpperCase()"
            />
            <p class="text-xs text-gray-500 mt-1">Código único em maiúsculas</p>
          </div>

          <!-- Nome -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Nome *
            </label>
            <input
              v-model="form.name"
              type="text"
              required
              maxlength="100"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Administrador"
            />
          </div>

          <!-- Descrição -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              v-model="form.description"
              rows="3"
              maxlength="500"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Descreva as responsabilidades deste perfil..."
            ></textarea>
          </div>

          <!-- Status (apenas para edição) -->
          <div v-if="isEditMode" class="flex items-center">
            <input
              id="active"
              v-model="form.active"
              type="checkbox"
              class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label for="active" class="ml-2 block text-sm text-gray-900">
              Perfil ativo
            </label>
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
              :disabled="loading"
            >
              Sair
            </button>
            <div class="flex gap-3">
              <button
                type="button"
                @click="handleClose"
                class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                :disabled="loading"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                :disabled="loading"
              >
                {{ loading ? 'Salvando...' : isEditMode ? 'Atualizar' : 'Criar' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import roleService, { type Role } from '@/services/role.service';

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

const form = ref({
  code: '',
  name: '',
  description: '',
  active: true,
});

const loading = ref(false);
const error = ref('');
const isEditMode = ref(false);

watch(() => props.isOpen, (newValue, oldValue) => {
  // Só executa quando o modal abre (false -> true)
  if (newValue && !oldValue) {
    if (props.role) {
      isEditMode.value = true;
      form.value = {
        code: props.role.code,
        name: props.role.name,
        description: props.role.description || '',
        active: props.role.active,
      };
    } else {
      isEditMode.value = false;
      form.value = {
        code: '',
        name: '',
        description: '',
        active: true,
      };
    }
    error.value = '';
  }
});

const handleSubmit = async () => {
  try {
    loading.value = true;
    error.value = '';

    if (isEditMode.value && props.role) {
      await roleService.update(props.role.id, form.value);
    } else {
      await roleService.create(form.value);
    }

    emit('success');
    handleClose();
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao salvar perfil';
  } finally {
    loading.value = false;
  }
};

const handleClose = () => {
  if (!loading.value) {
    emit('close');
  }
};
</script>
