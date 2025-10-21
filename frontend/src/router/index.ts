import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/dashboard'
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/auth/RegisterView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('../views/users/UsersListView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/audit-logs',
    name: 'audit-logs',
    component: () => import('../views/audit/AuditLogsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/roles',
    name: 'roles',
    component: () => import('../views/roles/RolesListView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/units-of-measure',
    name: 'units-of-measure',
    component: () => import('../views/units/UnitsOfMeasureView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/suppliers',
    name: 'suppliers',
    component: () => import('../views/suppliers/SuppliersView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/customers',
    name: 'customers',
    component: () => import('../views/customers/CustomersView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/work-centers',
    name: 'work-centers',
    component: () => import('../views/work-centers/WorkCentersView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/products',
    name: 'products',
    component: () => import('../views/products/ProductsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/production-orders',
    name: 'production-orders',
    component: () => import('../views/production/ProductionOrdersView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/production-pointings',
    name: 'production-pointings',
    component: () => import('../views/production/ProductionPointingsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/mrp',
    name: 'mrp',
    component: () => import('../views/mrp/MRPView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/stock',
    name: 'stock',
    component: () => import('../views/stock/StockView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/reports',
    name: 'reports',
    component: () => import('../views/reports/ReportsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/purchases/quotations',
    name: 'purchase-quotations',
    component: () => import('../views/purchases/PurchaseQuotationsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/purchases/orders',
    name: 'purchase-orders',
    component: () => import('../views/purchases/PurchaseOrdersView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('../views/NotificationsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/counting/dashboard',
    name: 'counting-dashboard',
    component: () => import('../views/counting/CountingDashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/counting/plans',
    name: 'counting-plans',
    component: () => import('../views/counting/CountingPlanList.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/counting/plans/new',
    name: 'counting-plan-new',
    component: () => import('../views/counting/CountingPlanForm.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/counting/plans/:id',
    name: 'counting-plan-edit',
    component: () => import('../views/counting/CountingPlanForm.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/counting/sessions',
    name: 'counting-sessions',
    component: () => import('../views/counting/CountingSessionList.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/counting/sessions/:id',
    name: 'counting-session-detail',
    component: () => import('../views/counting/CountingSessionExecute.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/counting/sessions/:id/execute',
    name: 'counting-session-execute',
    component: () => import('../views/counting/CountingSessionExecute.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/counting/sessions/:id/report',
    name: 'counting-session-report',
    component: () => import('../views/counting/CountingSessionReport.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Navigation guard
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()
  
  // Inicializar auth store se necessário
  if (authStore.accessToken && !authStore.user) {
    await authStore.initialize()
  }

  const requiresAuth = to.meta.requiresAuth !== false
  const isAuthenticated = authStore.isAuthenticated

  if (requiresAuth && !isAuthenticated) {
    next('/login')
  } else if (!requiresAuth && isAuthenticated && (to.path === '/login' || to.path === '/register')) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
