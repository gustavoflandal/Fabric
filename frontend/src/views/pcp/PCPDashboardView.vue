<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Main Content -->
    <main class="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        <p class="mt-4 text-gray-600">Carregando dashboard...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p class="text-red-600">{{ error }}</p>
        <Button @click="loadDashboardData" class="mt-4">Tentar Novamente</Button>
      </div>

      <!-- Dashboard Content -->
      <div v-else>
        <!-- KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <!-- Ordens em Produção -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-xs sm:text-sm font-medium text-gray-600 truncate">Ordens em Produção</p>
                <p class="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{{ kpis.ordersInProgress }}</p>
                <p class="text-xs sm:text-sm text-gray-500 mt-1">{{ kpis.ordersTotal }} no total</p>
              </div>
              <div class="bg-blue-100 rounded-full p-2 sm:p-3 flex-shrink-0 ml-2">
                <svg class="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Eficiência do Dia -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-xs sm:text-sm font-medium text-gray-600 truncate">Eficiência do Dia</p>
                <p class="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{{ kpis.efficiency }}%</p>
                <p class="text-xs sm:text-sm mt-1" :class="kpis.efficiencyTrend >= 0 ? 'text-green-600' : 'text-red-600'">
                  {{ kpis.efficiencyTrend >= 0 ? '+' : '' }}{{ kpis.efficiencyTrend }}% vs ontem
                </p>
              </div>
              <div class="bg-green-100 rounded-full p-2 sm:p-3 flex-shrink-0 ml-2">
                <svg class="w-6 h-6 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Taxa de Refugo -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-xs sm:text-sm font-medium text-gray-600 truncate">Taxa de Refugo</p>
                <p class="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{{ kpis.scrapRate }}%</p>
                <p class="text-xs sm:text-sm text-gray-500 mt-1">{{ kpis.scrapQuantity }} unidades</p>
              </div>
              <div class="bg-red-100 rounded-full p-2 sm:p-3 flex-shrink-0 ml-2">
                <svg class="w-6 h-6 sm:w-8 sm:h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>

          <!-- Ordens Atrasadas -->
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-xs sm:text-sm font-medium text-gray-600 truncate">Ordens Atrasadas</p>
                <p class="text-2xl sm:text-3xl font-bold text-gray-900 mt-1 sm:mt-2">{{ kpis.delayedOrders }}</p>
                <p class="text-xs sm:text-sm text-gray-500 mt-1">Requer atenção</p>
              </div>
              <div class="bg-yellow-100 rounded-full p-2 sm:p-3 flex-shrink-0 ml-2">
                <svg class="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <!-- Charts Row 1 -->
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          <!-- Ordens por Status -->
          <Card title="Ordens por Status">
            <div class="h-72">
              <canvas ref="ordersChartRef"></canvas>
            </div>
          </Card>

          <!-- Produção Diária -->
          <Card title="Produção Diária (Últimos 7 dias)">
            <div class="h-72">
              <canvas ref="productionChartRef"></canvas>
            </div>
          </Card>

          <!-- Eficiência por Centro de Trabalho -->
          <Card title="Eficiência por Centro de Trabalho">
            <div class="h-72">
              <canvas ref="workCenterChartRef"></canvas>
            </div>
          </Card>
        </div>

        <!-- Charts Row 2 -->
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
          <!-- Top Produtos -->
          <Card title="Top 5 Produtos Produzidos">
            <div class="h-72">
              <canvas ref="topProductsChartRef"></canvas>
            </div>
          </Card>

          <!-- Ocupação de Centros -->
          <Card title="Ocupação dos Centros de Trabalho">
            <div class="h-72">
              <canvas ref="occupationChartRef"></canvas>
            </div>
          </Card>

          <!-- Tempo de Setup vs Execução -->
          <Card title="Tempo de Setup vs Execução">
            <div class="h-72">
              <canvas ref="timeChartRef"></canvas>
            </div>
          </Card>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Button from '@/components/common/Button.vue'
import Card from '@/components/common/Card.vue'
import NotificationBell from '@/components/notifications/NotificationBell.vue'
import Chart from 'chart.js/auto'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const error = ref('')

// Dados do dashboard
const dashboardData = ref<any>(null)

// KPIs
const kpis = ref({
  ordersInProgress: 0,
  ordersTotal: 0,
  efficiency: 0,
  efficiencyTrend: 0,
  scrapRate: 0,
  scrapQuantity: 0,
  delayedOrders: 0,
})

// Chart refs
const ordersChartRef = ref<HTMLCanvasElement | null>(null)
const productionChartRef = ref<HTMLCanvasElement | null>(null)
const workCenterChartRef = ref<HTMLCanvasElement | null>(null)
const topProductsChartRef = ref<HTMLCanvasElement | null>(null)
const occupationChartRef = ref<HTMLCanvasElement | null>(null)
const timeChartRef = ref<HTMLCanvasElement | null>(null)

// Chart instances
let ordersChart: Chart | null = null
let productionChart: Chart | null = null
let workCenterChart: Chart | null = null
let topProductsChart: Chart | null = null
let occupationChart: Chart | null = null
let timeChart: Chart | null = null

const loadDashboardData = async () => {
  try {
    loading.value = true
    error.value = ''

    // Buscar todos os dados do dashboard
    const response = await fetch('http://localhost:3001/api/v1/pcp/dashboard', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Erro ao buscar dados do dashboard')
    }

    const data = await response.json()

    // Atualizar KPIs
    kpis.value = data.kpis

    // Armazenar dados dos gráficos
    dashboardData.value = data

    // Aguardar próximo tick para garantir que os canvas elements estão montados
    setTimeout(() => {
      createCharts()
    }, 100)
  } catch (err: any) {
    error.value = err.response?.data?.message || 'Erro ao carregar dashboard'
  } finally {
    loading.value = false
  }
}

const createCharts = () => {
  if (!dashboardData.value) return

  // Mapeamento de status para labels em português
  const statusLabels: Record<string, string> = {
    'PLANNED': 'Planejadas',
    'IN_PROGRESS': 'Em Progresso',
    'COMPLETED': 'Concluídas',
    'CANCELLED': 'Canceladas',
    'PAUSED': 'Pausadas'
  }

  const statusColors: Record<string, string> = {
    'PLANNED': '#FCD34D',
    'IN_PROGRESS': '#3B82F6',
    'COMPLETED': '#10B981',
    'CANCELLED': '#EF4444',
    'PAUSED': '#F97316'
  }

  // Chart 1: Ordens por Status (Doughnut)
  if (ordersChartRef.value && dashboardData.value.ordersByStatus) {
    const labels = dashboardData.value.ordersByStatus.map((item: any) => statusLabels[item.status] || item.status)
    const data = dashboardData.value.ordersByStatus.map((item: any) => item.count)
    const colors = dashboardData.value.ordersByStatus.map((item: any) => statusColors[item.status] || '#9CA3AF')

    ordersChart = new Chart(ordersChartRef.value, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10,
              font: {
                size: 11
              }
            }
          }
        }
      }
    })
  }

  // Chart 2: Produção Diária (Line)
  if (productionChartRef.value && dashboardData.value.dailyProduction) {
    const labels = dashboardData.value.dailyProduction.map((item: any) => {
      const date = new Date(item.date)
      return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    })
    const producedData = dashboardData.value.dailyProduction.map((item: any) => item.produced)
    const plannedData = dashboardData.value.dailyProduction.map((item: any) => item.planned)

    productionChart = new Chart(productionChartRef.value, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Produzido',
          data: producedData,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        }, {
          label: 'Planejado',
          data: plannedData,
          borderColor: '#9CA3AF',
          backgroundColor: 'rgba(156, 163, 175, 0.1)',
          tension: 0.4,
          fill: true,
          borderDash: [5, 5],
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10,
              font: {
                size: 11
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              font: {
                size: 10
              }
            }
          },
          x: {
            ticks: {
              font: {
                size: 10
              }
            }
          }
        }
      }
    })
  }

  // Chart 3: Eficiência por Centro (Bar)
  if (workCenterChartRef.value && dashboardData.value.workCenterEfficiency) {
    const labels = dashboardData.value.workCenterEfficiency.map((item: any) => item.name)
    const data = dashboardData.value.workCenterEfficiency.map((item: any) => item.efficiency)

    workCenterChart = new Chart(workCenterChartRef.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Eficiência (%)',
          data,
          backgroundColor: '#10B981',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              font: {
                size: 10
              }
            }
          },
          x: {
            ticks: {
              font: {
                size: 10
              }
            }
          }
        }
      }
    })
  }

  // Chart 4: Top Produtos (Horizontal Bar)
  if (topProductsChartRef.value && dashboardData.value.topProducts) {
    const labels = dashboardData.value.topProducts.map((item: any) => item.name)
    const data = dashboardData.value.topProducts.map((item: any) => item.quantity)

    topProductsChart = new Chart(topProductsChartRef.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Quantidade',
          data,
          backgroundColor: '#8B5CF6',
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              font: {
                size: 10
              }
            }
          },
          y: {
            ticks: {
              font: {
                size: 10
              }
            }
          }
        }
      }
    })
  }

  // Chart 5: Ocupação (Polar Area)
  if (occupationChartRef.value && dashboardData.value.workCenterOccupation) {
    const labels = dashboardData.value.workCenterOccupation.map((item: any) => item.name)
    const data = dashboardData.value.workCenterOccupation.map((item: any) => item.occupation)
    
    // Cores diferentes para cada centro
    const colors = [
      'rgba(59, 130, 246, 0.7)',
      'rgba(16, 185, 129, 0.7)',
      'rgba(245, 158, 11, 0.7)',
      'rgba(139, 92, 246, 0.7)',
      'rgba(236, 72, 153, 0.7)',
      'rgba(239, 68, 68, 0.7)',
    ]

    occupationChart = new Chart(occupationChartRef.value, {
      type: 'polarArea',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10,
              font: {
                size: 11
              }
            }
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              font: {
                size: 10
              }
            }
          }
        }
      }
    })
  }

  // Chart 6: Setup vs Execução (Stacked Bar)
  if (timeChartRef.value && dashboardData.value.timeDistribution) {
    const labels = dashboardData.value.timeDistribution.map((item: any) => {
      const date = new Date(item.date)
      return date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    })
    const setupData = dashboardData.value.timeDistribution.map((item: any) => item.setupTime)
    const executionData = dashboardData.value.timeDistribution.map((item: any) => item.executionTime)

    timeChart = new Chart(timeChartRef.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Setup (min)',
          data: setupData,
          backgroundColor: '#EF4444',
        }, {
          label: 'Execução (min)',
          data: executionData,
          backgroundColor: '#10B981',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12,
              padding: 10,
              font: {
                size: 11
              }
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            ticks: {
              font: {
                size: 10
              }
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              font: {
                size: 10
              }
            }
          }
        }
      }
    })
  }
}

const destroyCharts = () => {
  ordersChart?.destroy()
  productionChart?.destroy()
  workCenterChart?.destroy()
  topProductsChart?.destroy()
  occupationChart?.destroy()
  timeChart?.destroy()
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/login')
}

onMounted(() => {
  loadDashboardData()
})

onUnmounted(() => {
  destroyCharts()
})
</script>
