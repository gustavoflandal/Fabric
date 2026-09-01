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
      permissions.value = []
      accessToken.value = null
      refreshToken.value = null

      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('userPermissions')
      
      if (import.meta.env.DEV) {
        console.log('👋 Logout realizado, dados limpos')
      }
    }
  }

  async function refreshTokenAction() {
    if (!refreshToken.value) {
      throw new Error('No refresh token available')
    }

    if (import.meta.env.DEV) {
      console.log('🔄 Renovando access token...')
    }

    const response = await authService.refreshToken(refreshToken.value)
    accessToken.value = response.accessToken
    localStorage.setItem('accessToken', response.accessToken)

    // Backend rotaciona o refresh token a cada uso (Fase 2 do cronograma) -
    // o token antigo é revogado, então o novo precisa ser persistido aqui
    // ou o próximo refresh falhará.
    refreshToken.value = response.refreshToken
    localStorage.setItem('refreshToken', response.refreshToken)

    // Recarregar permissões após renovar token
    if (import.meta.env.DEV) {
      console.log('🔄 Recarregando permissões após refresh token...')
    }
    await fetchUser()
  }

  async function fetchUser() {
    try {
      if (import.meta.env.DEV) {
        console.log('🔄 Carregando dados do usuário e permissões...')
      }
      
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
        
        // Persistir permissões no localStorage como backup
        try {
          localStorage.setItem('userPermissions', JSON.stringify(allPermissions))
        } catch (e) {
          console.warn('Não foi possível salvar permissões no localStorage')
        }
        
        if (import.meta.env.DEV) {
          console.log('✅ Permissões carregadas:', permissions.value.length)
          console.log('📋 Módulos:', allPermissions.filter(p => p.startsWith('modules.')))
          console.log('🔐 Permissões completas:', allPermissions)
        }
      } else {
        console.warn('⚠️  Usuário sem roles ou permissões')
        permissions.value = []
      }
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('❌ Erro ao buscar usuário:', err)
      }
      
      // Tentar carregar permissões do localStorage como fallback
      try {
        const cachedPermissions = localStorage.getItem('userPermissions')
        if (cachedPermissions) {
          permissions.value = JSON.parse(cachedPermissions)
          console.warn('⚠️  Usando permissões em cache do localStorage')
          return // Não fazer logout, usar cache
        }
      } catch (e) {
        console.warn('Não foi possível carregar permissões do cache')
      }
      
      // Só fazer logout se for erro de autenticação (401)
      if (err.response?.status === 401) {
        console.error('🚫 Token inválido, fazendo logout...')
        logout()
      } else {
        console.warn('⚠️  Erro temporário ao carregar permissões, mantendo sessão')
      }
    }
  }

  async function initialize() {
    if (accessToken.value) {
      if (import.meta.env.DEV) {
        console.log('🚀 Inicializando auth store...')
      }
      
      // Tentar carregar do cache primeiro para melhor UX
      try {
        const cachedPermissions = localStorage.getItem('userPermissions')
        if (cachedPermissions) {
          permissions.value = JSON.parse(cachedPermissions)
          if (import.meta.env.DEV) {
            console.log('📦 Permissões carregadas do cache')
          }
        }
      } catch (e) {
        // Ignorar erro de cache
      }
      
      // Carregar dados atualizados do servidor
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
