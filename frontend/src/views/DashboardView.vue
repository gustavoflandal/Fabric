<template>
  <!-- Sem `title`/`#actions`: a view nunca teve linha de titulo de pagina, apenas o
       paragrafo de boas-vindas — o AppLayout entao nao renderiza essa linha. -->
  <AppLayout>
    <!-- O #nav ocupa exatamente a posicao do antigo NotificationBell (antes do
         "Olá, ..."). Aqui nao ha link "Início" a redeclarar: o header original
         nao tinha um, ja que esta e a propria home. -->
    <template #nav>
      <NotificationBell />
    </template>

    <!-- Welcome Section -->
    <div class="mb-8">
      <p class="text-xl text-gray-600 dark:text-gray-400">
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
          <div class="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav class="-mb-px flex space-x-8">
              <button
                v-if="authStore.canViewGeneral"
                @click="activeTab = 'geral'"
                :class="[
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === 'geral'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
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
                    ? 'border-primary-500 text-primary-600 dark:text-primary-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
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
                    ? 'border-primary-500 text-primary-600 dark:text-primary-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
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
                    ? 'border-primary-500 text-primary-600 dark:text-primary-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                ]"
              >
                YMS
              </button>
              <button
                v-if="authStore.canViewExpedicao"
                @click="activeTab = 'expedicao'"
                :class="[
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === 'expedicao'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                ]"
              >
                Expedição
              </button>
              <button
                v-if="authStore.canViewManutencao"
                @click="activeTab = 'manutencao'"
                :class="[
                  'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                  activeTab === 'manutencao'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-300'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                ]"
              >
                Manutenção
              </button>
            </nav>
          </div>

          <!-- Tab Content: Geral (Administração) -->
          <div v-if="activeTab === 'geral' && authStore.canViewGeneral" class="grid grid-cols-3 gap-3">
            <RouterLink
              to="/users"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">👥</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Usuários</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/roles"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🔐</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Perfis</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/audit-logs"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📋</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Logs de Auditoria</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/settings/system"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">⚙️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Configurações</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/units-of-measure"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📏</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Unidades de Medida</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/suppliers"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🏢</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Fornecedores</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/customers"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🤝</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Clientes</p>
              </div>
            </RouterLink>
          </div>

          <!-- Tab Content: PCP -->
          <!-- Tab Content: PCP -->
          <div v-if="activeTab === 'pcp' && authStore.canViewPCP" class="grid grid-cols-3 gap-3">
            <RouterLink
              v-if="authStore.canViewPCPDashboard"
              to="/pcp/dashboard"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard PCP</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/work-centers"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">⚙️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Centros de Trabalho</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/products"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🏷️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Produtos &amp; BOMs</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/production-orders"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🏭</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Ordens de Produção</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/mrp"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🔄</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">MRP</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/stock"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📦</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Estoque</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/reports"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Relatórios</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/production-pointings"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">⏱️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Apontamentos</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/purchases/quotations"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">💰</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Orçamentos</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/purchases/orders"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🛒</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Pedidos de Compra</p>
              </div>
            </RouterLink>
          </div>

          <!-- Tab Content: WMS -->
          <div v-else-if="activeTab === 'wms' && authStore.canViewWMS" class="grid grid-cols-3 gap-3">
            <RouterLink
              to="/counting/dashboard"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📋</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Inventário</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/warehouses"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🏭</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Armazéns</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/warehouse-structures"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📦</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Estruturas de Armazém</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/wms/workflows"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🔀</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Workflows</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/wms/operations"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📋</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Operações Ativas</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/wms/kpis"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard de KPIs</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/purchases/receipts"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📦</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Recebimento</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/wms/locations"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📍</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Localizações</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/wms/transfers"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🔄</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Transferências</p>
              </div>
            </RouterLink>
            <!-- O cartão "Expedição — Em breve" que ficava aqui saiu: o módulo
                 é real e mora na aba Expedição (Pedidos de Venda + Romaneios). -->
            <RouterLink
              to="/wms/picking"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🎯</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Picking</p>
              </div>
            </RouterLink>
          </div>

          <!-- Tab Content: YMS -->
          <div v-else-if="activeTab === 'yms' && authStore.canViewYMS" class="grid grid-cols-3 gap-3">
            <RouterLink
              to="/yard/visits"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🚚</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Agendamento</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/yard/docks"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🚪</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Docas</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/yard/drivers"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🧑‍✈️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Motoristas</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/yard/fleets"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🚛</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Frotas</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/yard/vehicles"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🚗</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Veículos</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/yard/areas"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🅿️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Áreas e Vagas</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/yard/dashboard"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard</p>
              </div>
            </RouterLink>
          </div>

          <!-- Tab Content: Expedição -->
          <div v-else-if="activeTab === 'expedicao' && authStore.canViewExpedicao" class="grid grid-cols-3 gap-3">
            <RouterLink
              to="/sales-orders"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🧾</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Pedidos de Venda</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/shipments"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📤</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Romaneios</p>
              </div>
            </RouterLink>
          </div>

          <!-- Tab Content: Manutenção -->
          <div v-else-if="activeTab === 'manutencao' && authStore.canViewManutencao" class="grid grid-cols-3 gap-3">
            <RouterLink
              to="/maintenance/equipment"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🔧</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Equipamentos</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/maintenance/plans"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🗓️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Planos de Manutenção</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/maintenance/orders"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">🛠️</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Ordens de Manutenção</p>
              </div>
            </RouterLink>
            <RouterLink
              to="/maintenance/kpis"
              class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer dark:border-gray-700 dark:hover:border-primary-500 dark:hover:bg-gray-800"
            >
              <div class="text-center">
                <div class="text-3xl mb-2">📊</div>
                <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard de KPIs</p>
              </div>
            </RouterLink>
          </div>
        </Card>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import AppLayout from '@/components/common/AppLayout.vue'
import Card from '@/components/common/Card.vue'
import NotificationCenter from '@/components/notifications/NotificationCenter.vue'
import NotificationBell from '@/components/notifications/NotificationBell.vue'

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
  } else if (authStore.canViewExpedicao) {
    activeTab.value = 'expedicao'
  } else if (authStore.canViewManutencao) {
    activeTab.value = 'manutencao'
  }

  console.log('📊 Dashboard - Aba selecionada:', activeTab.value)
  console.log('🔐 Permissões de módulos (computed):', {
    geral: authStore.canViewGeneral,
    pcp: authStore.canViewPCP,
    wms: authStore.canViewWMS,
    yms: authStore.canViewYMS
  })
})
</script>
