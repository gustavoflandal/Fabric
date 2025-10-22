import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService, { type LoginRequest, type RegisterRequest } from '@/services/auth.service'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<{ id: string; email: string; name: string } | null>(null)
  const permissions = ref<string[]>([])
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)
  const userName = computed(() => user.value?.name || '')
  
  // Verificar se tem permissão específica
  const hasPermission = computed(() => (resource: string, action: string) => {
    return permissions.value.includes(`${resource}.${action}`)
  })
  
  // Verificar permissões de módulos
  const canViewGeneral = computed(() => permissions.value.includes('modules.view_general'))
  const canViewPCP = computed(() => permissions.value.includes('modules.view_pcp'))
  const canViewWMS = computed(() => permissions.value.includes('modules.view_wms'))
  const canViewYMS = computed(() => permissions.value.includes('modules.view_yms'))
  
  // Verificar permissões específicas do PCP
  const canViewPCPDashboard = computed(() => permissions.value.includes('pcp.dashboard.view'))
  
  // Verificar permissões de contagem
  const canPrintCountingPlan = computed(() => permissions.value.includes('counting.plans.print'))

  // Actions
  async function login(credentials: LoginRequest) {
    try {
      loading.value = true
      error.value = null

      if (import.meta.env.DEV) {
        console.log('AuthStore: Iniciando login...')
      }
      
      const response = await authService.login(credentials)

      // Set tokens first so they're available for subsequent requests
      accessToken.value = response.accessToken
      refreshToken.value = response.refreshToken
      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('refreshToken', response.refreshToken)

      // Set user data
      user.value = response.user

      if (import.meta.env.DEV) {
        console.log('AuthStore: Login bem-sucedido!')
      }
      return true
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('AuthStore: Erro no login:', err.message)
      }
      
      // Mensagens de erro mais específicas e acionáveis
      if (err.response?.status === 401) {
        error.value = 'Email ou senha incorretos. Por favor, verifique suas credenciais.'
      } else if (err.response?.status === 403) {
        error.value = 'Sua conta está inativa. Entre em contato com o administrador.'
      } else if (err.response?.status === 429) {
        error.value = 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.'
      } else {
        error.value = err.response?.data?.message || 'Erro ao fazer login. Verifique sua conexão e tente novamente.'
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function register(data: RegisterRequest) {
    try {
      loading.value = true
      error.value = null

      const response = await authService.register(data)

      user.value = response.user
      accessToken.value = response.accessToken
      refreshToken.value = response.refreshToken

      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('refreshToken', response.refreshToken)

      return true
    } catch (err: any) {
      // Mensagens de erro mais específicas
      if (err.response?.status === 409) {
        error.value = 'Este email já está cadastrado. Tente fazer login ou use outro email.'
      } else if (err.response?.status === 400) {
        error.value = err.response?.data?.message || 'Dados inválidos. Verifique os campos e tente novamente.'
      } else {
        error.value = err.response?.data?.message || 'Erro ao criar conta. Tente novamente mais tarde.'
      }
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await authService.logout()
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Erro ao fazer logout:', err)
      }
      // Continua com logout local mesmo se falhar no servidor
    } finally {
      user.value = null
      accessToken.value = null
      refreshToken.value = null

      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
    }
  }

  async function refreshTokenAction() {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }

    const response = await authService.refreshToken(refreshToken.value)
    accessToken.value = response.accessToken
    localStorage.setItem('accessToken', response.accessToken)
  }

  async function fetchUser() {
    try {
      const userData = await authService.getMe()
      user.value = userData
      
      // Buscar permissões do usuário
      if (userData.roles && Array.isArray(userData.roles)) {
        const allPermissions: string[] = []
        for (const role of userData.roles) {
          if (role.permissions && Array.isArray(role.permissions)) {
            for (const perm of role.permissions) {
              const permKey = `${perm.resource}.${perm.action}`
              if (!allPermissions.includes(permKey)) {
                allPermissions.push(permKey)
              }
            }
          }
        }
        permissions.value = allPermissions
        
        if (import.meta.env.DEV) {
          console.log('✅ Permissões carregadas:', permissions.value.length)
          console.log('📋 Módulos:', allPermissions.filter(p => p.startsWith('modules.')))
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Erro ao buscar usuário:', err)
      }
      // Logout se não conseguir buscar dados do usuário (token inválido)
      logout()
    }
  }

  async function initialize() {
    if (accessToken.value) {
      await fetchUser()
    }
  }

  return {
    // State
    user,
    permissions,
    accessToken,
    refreshToken,
    loading,
    error,
    // Getters
    isAuthenticated,
    userName,
    hasPermission,
    canViewGeneral,
    canViewPCP,
    canViewWMS,
    canViewYMS,
    canViewPCPDashboard,
    canPrintCountingPlan,
    // Actions
    login,
    register,
    logout,
    refreshAccessToken: refreshTokenAction,
    fetchUser,
    initialize,
  }
})
