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
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <div class="flex items-center">
            <div class="flex-shrink-0 p-3 bg-primary-100 rounded-lg">
              <svg class="h-8 w-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-600">Ordens de Produção</p>
              <p class="text-2xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </Card>

        <Card>
          <div class="flex items-center">
            <div class="flex-shrink-0 p-3 bg-secondary-100 rounded-lg">
              <svg class="h-8 w-8 text-secondary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-600">Produtos</p>
              <p class="text-2xl font-bold text-gray-900">0</p>
            </div>
          </div>
        </Card>

        <Card>
          <div class="flex items-center">
            <div class="flex-shrink-0 p-3 bg-accent-100 rounded-lg">
              <svg class="h-8 w-8 text-accent-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-600">Eficiência</p>
              <p class="text-2xl font-bold text-gray-900">0%</p>
            </div>
          </div>
        </Card>

        <Card>
          <div class="flex items-center">
            <div class="flex-shrink-0 p-3 bg-green-100 rounded-lg">
              <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-4">
              <p class="text-sm font-medium text-gray-600">Qualidade</p>
              <p class="text-2xl font-bold text-gray-900">0%</p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Quick Actions -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Ações Rápidas">
          <div class="space-y-3">
            <Button variant="primary" full-width>
              Nova Ordem de Produção
            </Button>
            <Button variant="secondary" full-width>
              Cadastrar Produto
            </Button>
            <Button variant="outline" full-width>
              Executar MRP
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
                <p class="text-sm font-medium text-gray-700">Produtos</p>
              </div>
            </RouterLink>
            <div class="p-4 border-2 border-gray-200 rounded-lg opacity-50 cursor-not-allowed">
              <div class="text-center">
                <div class="text-3xl mb-2">🏭</div>
                <p class="text-sm font-medium text-gray-700">Produção</p>
                <p class="text-xs text-gray-500 mt-1">Em breve</p>
              </div>
            </div>
            <div class="p-4 border-2 border-gray-200 rounded-lg opacity-50 cursor-not-allowed">
              <div class="text-center">
                <div class="text-3xl mb-2">📦</div>
                <p class="text-sm font-medium text-gray-700">Estoque</p>
                <p class="text-xs text-gray-500 mt-1">Em breve</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'

const router = useRouter()
const authStore = useAuthStore()

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}
</script>
