<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
  >
    <div
      class="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      @click.stop
    >
      <div class="p-6">
        <!-- Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h3 class="text-2xl font-bold text-gray-900">
              {{ isEditMode ? 'Editar Usuário' : 'Novo Usuário' }}
            </h3>
            <p class="text-sm text-gray-600 mt-1">
              {{ isEditMode ? 'Atualize as informações do usuário' : 'Preencha os dados do novo usuário' }}
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
          <!-- Nome -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Nome Completo *
            </label>
            <input
              v-model="form.name"
              type="text"
              required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="João Silva"
            />
          </div>

          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              E-mail *
            </label>
            <input
              v-model="form.email"
              type="email"
              required
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="joao@empresa.com"
            />
          </div>

          <!-- Senha (apenas para novo usuário) -->
          <div v-if="!isEditMode">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Senha *
            </label>
            <input
              v-model="form.password"
              type="password"
              required
              minlength="6"
              class="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <!-- Perfis -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              Perfis de Acesso
            </label>
            <div class="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
              <div
                v-for="role in availableRoles"
                :key="role.id"
                class="flex items-center"
              >
                <input
                  :id="`role-${role.id}`"
                  v-model="form.roleIds"
                  type="checkbox"
                  :value="role.id"
                  class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label
                  :for="`role-${role.id}`"
                  class="ml-2 block text-sm text-gray-900"
                >
                  {{ role.name }}
                  <span class="text-gray-500 text-xs ml-1">
                    ({{ role.code }})
                  </span>
                </label>
              </div>
            </div>
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
              Usuário ativo
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
import userService, { type User } from '@/services/user.service';
import roleService, { type Role } from '@/services/role.service';

interface Props {
  isOpen: boolean;
  user?: User | null;
}

interface Emits {
  (e: 'close'): void;
  (e: 'success'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const form = ref({
  name: '',
  email: '',
  password: '',
  roleIds: [] as string[],
  active: true,
});

const availableRoles = ref<Role[]>([]);
const loading = ref(false);
const error = ref('');

const isEditMode = ref(false);

// Carregar perfis disponíveis
const loadRoles = async () => {
  try {
    const response = await roleService.getAll();
    availableRoles.value = response.data;
  } catch (err) {
    console.error('Erro ao carregar perfis:', err);
  }
};

// Watch para quando o modal abrir
watch(() => props.isOpen, (newValue, oldValue) => {
  // Só executa quando o modal abre (false -> true)
  if (newValue && !oldValue) {
    loadRoles();
    
    if (props.user) {
      // Modo edição
      isEditMode.value = true;
      form.value = {
        name: props.user.name,
        email: props.user.email,
        password: '',
        roleIds: props.user.roles.map(r => r.id),
        active: props.user.active,
      };
    } else {
      // Modo criação
      isEditMode.value = false;
      form.value = {
        name: '',
        email: '',
        password: '',
        roleIds: [],
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

    if (isEditMode.value && props.user) {
      // Atualizar usuário
      await userService.update(props.user.id, {
        name: form.value.name,
        email: form.value.email,
        active: form.value.active,
      });

      // Atualizar perfis se mudaram
      if (form.value.roleIds.length > 0) {
        await userService.assignRoles(props.user.id, form.value.roleIds);
      }
    } else {
      // Criar novo usuário
      await userService.create({
        name: form.value.name,
        email: form.value.email,
        password: form.value.password,
        roleIds: form.value.roleIds,
      });
    }

    emit('success');
    handleClose();
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao salvar usuário';
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
