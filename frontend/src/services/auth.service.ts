import api from './api.service'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  user: {
    id: string
    email: string
    name: string
  }
  accessToken: string
  refreshToken: string
}

export interface RefreshTokenResponse {
  accessToken: string
}

class AuthService {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await api.post('/auth/login', credentials)
    return response.data.data // Backend retorna { status: 'success', data: {...} }
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post('/auth/register', data)
    return response.data.data // Backend retorna { status: 'success', data: {...} }
  }

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await api.post('/auth/refresh', {
      refreshToken,
    })
    return response.data.data // Backend retorna { status: 'success', data: {...} }
  }

  async getMe(): Promise<AuthResponse['user']> {
    const response = await api.get('/auth/me')
    return response.data.data // Backend retorna { status: 'success', data: {...} }
  }
}

export default new AuthService()
