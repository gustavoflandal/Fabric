import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth.store'
import authService from '@/services/auth.service'

vi.mock('@/services/auth.service', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
    getMe: vi.fn(),
  },
}))

const mockLoginResponse = {
  user: { id: 'u1', email: 'admin@fabric.com', name: 'Admin' },
  accessToken: 'access-token-1',
  refreshToken: 'refresh-token-1',
}

const mockMeResponse = {
  id: 'u1',
  email: 'admin@fabric.com',
  name: 'Admin',
  roles: [
    {
      permissions: [
        { resource: 'stock', action: 'read' },
        { resource: 'modules', action: 'view_wms' },
      ],
    },
  ],
}

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('login() carrega as permissões reais do servidor na mesma sessão, sem depender de reload', async () => {
    vi.mocked(authService.login).mockResolvedValue(mockLoginResponse as any)
    vi.mocked(authService.getMe).mockResolvedValue(mockMeResponse as any)

    const store = useAuthStore()
    const ok = await store.login({ email: 'admin@fabric.com', password: 'secret' })

    expect(ok).toBe(true)
    expect(authService.getMe).toHaveBeenCalledTimes(1)
    expect(store.permissions).toEqual(['stock.read', 'modules.view_wms'])
    expect(store.hasPermission('stock', 'read')).toBe(true)
    expect(store.canViewWMS).toBe(true)
  })

  it('login() mantém o usuário autenticado mesmo se a busca de permissões falhar por erro temporário', async () => {
    vi.mocked(authService.login).mockResolvedValue(mockLoginResponse as any)
    vi.mocked(authService.getMe).mockRejectedValue({ response: { status: 500 } })

    const store = useAuthStore()
    const ok = await store.login({ email: 'admin@fabric.com', password: 'secret' })

    expect(ok).toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.id).toBe('u1')
  })

  it('login() com credenciais inválidas não chama getMe e retorna false', async () => {
    vi.mocked(authService.login).mockRejectedValue({ response: { status: 401 } })

    const store = useAuthStore()
    const ok = await store.login({ email: 'admin@fabric.com', password: 'errada' })

    expect(ok).toBe(false)
    expect(authService.getMe).not.toHaveBeenCalled()
    expect(store.error).toBe('Email ou senha incorretos. Por favor, verifique suas credenciais.')
  })
})
