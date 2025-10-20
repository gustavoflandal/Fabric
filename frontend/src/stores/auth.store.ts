import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService, { type LoginRequest, type RegisterRequest } from '@/services/auth.service'

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<{ id: string; email: string; name: string } | null>(null)
  const accessToken = ref<string | null>(localStorage.getItem('accessToken'))
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'))
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!accessToken.value && !!user.value)
  const userName = computed(() => user.value?.name || '')

  // Actions
  async function login(credentials: LoginRequest) {
    try {
      loading.value = true
      error.value = null

      console.log('AuthStore: Chamando authService.login...')
      const response = await authService.login(credentials)
      console.log('AuthStore: Resposta recebida:', response)

      user.value = response.user
      accessToken.value = response.accessToken
      refreshToken.value = response.refreshToken

      localStorage.setItem('accessToken', response.accessToken)
      localStorage.setItem('refreshToken', response.refreshToken)

      console.log('AuthStore: Login bem-sucedido!')
      return true
    } catch (err: any) {
      console.error('AuthStore: Erro no login:', err)
      console.error('AuthStore: Resposta do erro:', err.response)
      error.value = err.response?.data?.message || 'Erro ao fazer login'
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
      error.value = err.response?.data?.message || 'Erro ao registrar'
      return false
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    try {
      await authService.logout()
    } catch (err) {
      console.error('Erro ao fazer logout:', err)
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
    } catch (err) {
      console.error('Erro ao buscar usuário:', err)
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
    accessToken,
    refreshToken,
    loading,
    error,
    // Getters
    isAuthenticated,
    userName,
    // Actions
    login,
    register,
    logout,
    refreshAccessToken: refreshTokenAction,
    fetchUser,
    initialize,
  }
})
