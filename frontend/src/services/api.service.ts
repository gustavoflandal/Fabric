import axios, { type AxiosInstance, type AxiosError } from 'axios'
import { useAuthStore } from '@/stores/auth.store'

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor - adiciona token
api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    if (authStore.accessToken) {
      config.headers.Authorization = `Bearer ${authStore.accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - trata erros e refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any

    if (import.meta.env.DEV) {
      console.log('🚨 API Error:', {
        url: error.config?.url,
        status: error.response?.status,
        message: error.message
      })
    }

    // Token expirado - tentar refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        if (import.meta.env.DEV) {
          console.log('🔄 Tentando renovar token...')
        }
        
        const authStore = useAuthStore()
        await authStore.refreshAccessToken()
        
        if (import.meta.env.DEV) {
          console.log('✅ Token renovado com sucesso')
        }
        
        // Retry request original com novo token
        return api(originalRequest)
      } catch (refreshError) {
        if (import.meta.env.DEV) {
          console.error('❌ Falha ao renovar token:', refreshError)
        }
        
        const authStore = useAuthStore()
        authStore.logout()
        
        // Redirecionar para login apenas se não estiver já lá
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
        
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
