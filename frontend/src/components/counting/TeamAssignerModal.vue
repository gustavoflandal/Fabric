<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="flex items-center justify-center min-h-screen px-4">
      <div class="fixed inset-0 bg-black opacity-30" @click="$emit('close')"></div>
      
      <div class="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6">
        <div class="flex justify-between items-start mb-4">
          <h3 class="text-xl font-semibold text-gray-900">Atribuir Equipe de Contagem</h3>
          <button @click="$emit('close')" class="text-gray-500 hover:text-gray-700">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <!-- Assigned Team -->
        <div class="mb-6">
          <h4 class="text-md font-medium mb-3">Equipe Atribuída</h4>
          <div v-if="assignedUsers.length === 0" class="text-center py-6 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
            Nenhum contador atribuído
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="assignment in assignedUsers"
              :key="assignment.userId"
              class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg"
            >
              <div class="flex items-center space-x-3">
                <div class="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span class="text-blue-700 font-medium">{{ assignment.user.name.charAt(0) }}</span>
                </div>
                <div>
                  <div class="font-medium">{{ assignment.user.name }}</div>
                  <div class="text-sm text-gray-500">{{ assignment.user.email }}</div>
                </div>
              </div>
              
              <div class="flex items-center space-x-3">
                <select
                  v-model="assignment.role"
                  class="border border-gray-300 rounded-md px-3 py-1 text-sm"
                >
                  <option value="PRIMARY">Principal</option>
                  <option value="SECONDARY">Secundário</option>
                  <option value="VALIDATOR">Validador</option>
                  <option value="SUPERVISOR">Supervisor</option>
                </select>
                <button
                  @click="removeUser(assignment.userId)"
                  class="text-red-500 hover:text-red-700"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Available Users -->
        <div class="mb-6">
          <h4 class="text-md font-medium mb-3">Adicionar Contador</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              v-for="user in availableUsers"
              :key="user.id"
              class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <div class="flex items-center space-x-3">
                <div class="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <span class="text-gray-700 text-sm">{{ user.name.charAt(0) }}</span>
                </div>
                <div class="text-sm">
                  <div class="font-medium">{{ user.name }}</div>
                  <div class="text-gray-500">{{ user.email }}</div>
                </div>
              </div>
              <button
                @click="addUser(user)"
                class="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
          <button
            @click="$emit('close')"
            class="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            @click="saveAssignments"
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Salvar Equipe
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

const props = defineProps<{
  isOpen: boolean;
  sessionId: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
}>();

const loading = ref(false);
const users = ref<any[]>([]);
const assignedUsers = ref<any[]>([]);

const availableUsers = computed(() => {
  return users.value.filter(u => !assignedUsers.value.some(a => a.userId === u.id));
});

const addUser = (user: any) => {
  assignedUsers.value.push({
    userId: user.id,
    user: user,
    role: 'SECONDARY'
  });
};

const removeUser = (userId: string) => {
  const index = assignedUsers.value.findIndex(a => a.userId === userId);
  if (index >= 0) {
    assignedUsers.value.splice(index, 1);
  }
};

const saveAssignments = async () => {
  try {
    loading.value = true;
    
    // Save each assignment
    for (const assignment of assignedUsers.value) {
      await axios.post(`/api/counting/sessions/${props.sessionId}/assign`, {
        userId: assignment.userId,
        role: assignment.role
      });
    }
    
    emit('saved');
    emit('close');
  } catch (error) {
    console.error('Erro ao salvar atribuições:', error);
    alert('Erro ao salvar equipe. Tente novamente.');
  } finally {
    loading.value = false;
  }
};

const loadUsers = async () => {
  try {
    const response = await axios.get('/api/users');
    users.value = response.data;
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
  }
};

const loadAssignments = async () => {
  try {
    const response = await axios.get(`/api/counting/sessions/${props.sessionId}/assign`);
    assignedUsers.value = response.data;
  } catch (error) {
    console.error('Erro ao carregar atribuições:', error);
  }
};

onMounted(() => {
  loadUsers();
  if (props.sessionId) {
    loadAssignments();
  }
});
</script>
