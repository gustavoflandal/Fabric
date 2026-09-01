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
            <NotificationBell />
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
      <!-- Welcome Section -->
      <div class="mb-8">
        <p class="text-xl text-gray-600">
          Bem-vindo ao sistema de Planejamento e Controle da Produção
        </p>
      </div>

      <!-- Notification Center & System Modules -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Notification Center (30% smaller width) -->
        <div class="lg:col-span-1">
          <NotificationCenter />
        </div>

        <!-- System Modules (larger) -->
        <div class="lg:col-span-2">
          <Card title="Módulos do Sistema">
            <!-- Tabs -->
            <div class="mb-6 border-b border-gray-200">
              <nav class="-mb-px flex space-x-8">
                <button
                  v-if="authStore.canViewGeneral"
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
                  v-if="authStore.canViewPCP"
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
                  v-if="authStore.canViewWMS"
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
                  v-if="authStore.canViewYMS"
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

            <!-- Tab Content: Geral (Administração) -->
            <div v-if="activeTab === 'geral' && authStore.canViewGeneral" class="grid grid-cols-3 gap-3">
              <RouterLink
                to="/users"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">👥</div>
                  <p class="text-sm font-medium text-gray-700">Usuários</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/roles"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">🔐</div>
                  <p class="text-sm font-medium text-gray-700">Perfis</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/audit-logs"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">📋</div>
                  <p class="text-sm font-medium text-gray-700">Logs de Auditoria</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/units-of-measure"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">📏</div>
                  <p class="text-sm font-medium text-gray-700">Unidades de Medida</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/suppliers"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">🏢</div>
                  <p class="text-sm font-medium text-gray-700">Fornecedores</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/customers"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">🤝</div>
                  <p class="text-sm font-medium text-gray-700">Clientes</p>
                </div>
              </RouterLink>
            </div>

            <!-- Tab Content: PCP -->
            <!-- Tab Content: PCP -->
            <div v-if="activeTab === 'pcp' && authStore.canViewPCP" class="grid grid-cols-3 gap-3">
              <RouterLink
                v-if="authStore.canViewPCPDashboard"
                to="/pcp/dashboard"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">📊</div>
                  <p class="text-sm font-medium text-gray-700">Dashboard PCP</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/work-centers"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">⚙️</div>
                  <p class="text-sm font-medium text-gray-700">Centros de Trabalho</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/products"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">🏷️</div>
                  <p class="text-sm font-medium text-gray-700">Produtos &amp; BOMs</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/production-orders"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">🏭</div>
                  <p class="text-sm font-medium text-gray-700">Ordens de Produção</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/mrp"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">🔄</div>
                  <p class="text-sm font-medium text-gray-700">MRP</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/stock"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">📦</div>
                  <p class="text-sm font-medium text-gray-700">Estoque</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/reports"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">📊</div>
                  <p class="text-sm font-medium text-gray-700">Relatórios</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/production-pointings"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">⏱️</div>
                  <p class="text-sm font-medium text-gray-700">Apontamentos</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/purchases/quotations"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">💰</div>
                  <p class="text-sm font-medium text-gray-700">Orçamentos</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/purchases/orders"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">🛒</div>
                  <p class="text-sm font-medium text-gray-700">Pedidos de Compra</p>
                </div>
              </RouterLink>
            </div>

            <!-- Tab Content: WMS -->
            <div v-else-if="activeTab === 'wms' && authStore.canViewWMS" class="grid grid-cols-3 gap-3">
              <RouterLink
                to="/counting/dashboard"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">📋</div>
                  <p class="text-sm font-medium text-gray-700">Contagem de Estoque</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/warehouses"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">🏭</div>
                  <p class="text-sm font-medium text-gray-700">Armazéns</p>
                </div>
              </RouterLink>
              <RouterLink
                to="/warehouse-structures"
                class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">📦</div>
                  <p class="text-sm font-medium text-gray-700">Estruturas de Armazém</p>
                </div>
              </RouterLink>
              <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                <div class="text-center">
                  <div class="text-3xl mb-2">📦</div>
                  <p class="text-sm font-medium text-gray-500">Recebimento</p>
                  <p class="text-xs text-gray-400 mt-1">Em breve</p>
                </div>
              </div>
              <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                <div class="text-center">
                  <div class="text-3xl mb-2">📍</div>
                  <p class="text-sm font-medium text-gray-500">Localizações</p>
                  <p class="text-xs text-gray-400 mt-1">Em breve</p>
                </div>
              </div>
              <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                <div class="text-center">
                  <div class="text-3xl mb-2">🔄</div>
                  <p class="text-sm font-medium text-gray-500">Transferências</p>
                  <p class="text-xs text-gray-400 mt-1">Em breve</p>
                </div>
              </div>
              <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                <div class="text-center">
                  <div class="text-3xl mb-2">📤</div>
                  <p class="text-sm font-medium text-gray-500">Expedição</p>
                  <p class="text-xs text-gray-400 mt-1">Em breve</p>
                </div>
              </div>
              <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                <div class="text-center">
                  <div class="text-3xl mb-2">🎯</div>
                  <p class="text-sm font-medium text-gray-500">Picking</p>
                  <p class="text-xs text-gray-400 mt-1">Em breve</p>
                </div>
              </div>
            </div>

            <!-- Tab Content: YMS -->
            <div v-else-if="activeTab === 'yms' && authStore.canViewYMS" class="grid grid-cols-3 gap-3">
              <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                <div class="text-center">
                  <div class="text-3xl mb-2">🚚</div>
                  <p class="text-sm font-medium text-gray-500">Agendamento</p>
                  <p class="text-xs text-gray-400 mt-1">Em breve</p>
                </div>
              </div>
              <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                <div class="text-center">
                  <div class="text-3xl mb-2">🚪</div>
                  <p class="text-sm font-medium text-gray-500">Docas</p>
                  <p class="text-xs text-gray-400 mt-1">Em breve</p>
                </div>
              </div>
              <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                <div class="text-center">
                  <div class="text-3xl mb-2">📋</div>
                  <p class="text-sm font-medium text-gray-500">Check-in/out</p>
                  <p class="text-xs text-gray-400 mt-1">Em breve</p>
                </div>
              </div>
              <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                <div class="text-center">
                  <div class="text-3xl mb-2">⏱️</div>
                  <p class="text-sm font-medium text-gray-500">Tempo de Pátio</p>
                  <p class="text-xs text-gray-400 mt-1">Em breve</p>
                </div>
              </div>
              <div class="p-4 border-2 border-gray-200 rounded-lg bg-gray-50 opacity-50 cursor-not-allowed">
                <div class="text-center">
                  <div class="text-3xl mb-2">📊</div>
                  <p class="text-sm font-medium text-gray-700">Relatórios YMS</p>
                  <p class="text-xs text-gray-400 mt-1">Em breve</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import NotificationCenter from '@/components/notifications/NotificationCenter.vue'
import NotificationBell from '@/components/notifications/NotificationBell.vue'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref('geral')

// Selecionar automaticamente a primeira aba disponível
onMounted(() => {
  console.log('🔍 DEBUG - Todas as permissões:', authStore.permissions)
  console.log('🔍 DEBUG - Permissões de módulos:', {
    'modules.view_general': authStore.permissions.includes('modules.view_general'),
    'modules.view_pcp': authStore.permissions.includes('modules.view_pcp'),
    'modules.view_wms': authStore.permissions.includes('modules.view_wms'),
    'modules.view_yms': authStore.permissions.includes('modules.view_yms')
  })
  
  // Selecionar a primeira aba disponível
  if (authStore.canViewGeneral) {
    activeTab.value = 'geral'
  } else if (authStore.canViewPCP) {
    activeTab.value = 'pcp'
  } else if (authStore.canViewWMS) {
    activeTab.value = 'wms'
  } else if (authStore.canViewYMS) {
    activeTab.value = 'yms'
  }
  
  console.log('📊 Dashboard - Aba selecionada:', activeTab.value)
  console.log('🔐 Permissões de módulos (computed):', {
    geral: authStore.canViewGeneral,
    pcp: authStore.canViewPCP,
    wms: authStore.canViewWMS,
    yms: authStore.canViewYMS
  })
})

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>
