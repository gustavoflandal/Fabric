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
        <h2 class="text-3xl font-bold text-gray-900 mb-2">
          Dashboard
        </h2>
        <p class="text-gray-600">
          Bem-vindo ao sistema de Planejamento e Controle da Produção
        </p>
      </div>

      <!-- Stats Grid -->
      <div v-if="loading" class="text-center py-12">
        <p class="text-gray-500">Carregando estatísticas...</p>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Ordens em Progresso</p>
              <p class="text-3xl font-bold text-primary-600 mt-2">{{ stats?.orders?.inProgress || 0 }}</p>
            </div>
            <div class="p-3 bg-primary-100 rounded-full">
              <svg class="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </Card>

        <Card>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Produtos Ativos</p>
              <p class="text-3xl font-bold text-green-600 mt-2">{{ stats?.products || 0 }}</p>
            </div>
            <div class="p-3 bg-green-100 rounded-full">
              <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </Card>

        <Card>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Eficiência</p>
              <p class="text-3xl font-bold text-yellow-600 mt-2">{{ productionMetrics?.efficiency?.efficiencyRate?.toFixed(1) || 0 }}%</p>
            </div>
            <div class="p-3 bg-yellow-100 rounded-full">
              <svg class="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </Card>

        <Card>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600">Taxa de Refugo</p>
              <p class="text-3xl font-bold text-red-600 mt-2">{{ productionMetrics?.efficiency?.scrapRate?.toFixed(1) || 0 }}%</p>
            </div>
            <div class="p-3 bg-red-100 rounded-full">
              <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </Card>
      </div>

      <!-- Quick Actions -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Ações Rápidas">
          <div class="space-y-3">
            <Button variant="light" full-width @click="goToProductionOrders">
              📋 Nova Ordem de Produção
            </Button>
            <Button variant="light" full-width @click="goToMRP">
              🔄 Executar MRP
            </Button>
            <Button variant="light" full-width @click="goToStock">
              📦 Consultar Estoque
            </Button>
            <Button variant="light" full-width @click="goToReports">
              📊 Ver Relatórios
            </Button>
          </div>
        </Card>

        <Card title="Módulos do Sistema">
          <div class="grid grid-cols-3 gap-3">
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
                <div class="text-3xl mb-2">👥</div>
                <p class="text-sm font-medium text-gray-700">Clientes</p>
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
        </Card>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import dashboardService from '@/services/dashboard.service'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'

const router = useRouter()
const authStore = useAuthStore()

const stats = ref<any>(null)
const productionMetrics = ref<any>(null)
const topProducts = ref<any[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [statsRes, metricsRes, productsRes] = await Promise.all([
      dashboardService.getStatistics(),
      dashboardService.getProductionMetrics(),
      dashboardService.getTopProducts(5),
    ])
    
    stats.value = statsRes.data.data
    productionMetrics.value = metricsRes.data.data
    topProducts.value = productsRes.data.data
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error)
  } finally {
    loading.value = false
  }
})

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

const goToProducts = () => {
  router.push('/products')
}

const goToProductionOrders = () => {
  router.push('/production-orders')
}

const goToMRP = () => {
  router.push('/mrp')
}

const goToStock = () => {
  router.push('/stock')
}

const goToReports = () => {
  router.push('/reports')
}
</script>
