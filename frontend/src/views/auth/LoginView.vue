<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-secondary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <!-- Logo e Título -->
      <div class="text-center mb-8">
        <img src="/logo.png" alt="Fabric Logo" class="mx-auto h-24 w-auto mb-4" />
        <h2 class="text-3xl font-bold text-primary-800">
          Bem-vindo ao Fabric
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          Sistema de Controle de Produção
        </p>
      </div>

      <!-- Card de Login -->
      <Card shadow="xl">
        <form @submit.prevent="handleLogin" class="space-y-6">
          <div>
            <Input
              id="email"
              v-model="form.email"
              type="email"
              label="E-mail"
              placeholder="seu@email.com"
              required
              :error="errors.email"
              :disabled="authStore.loading"
            />
          </div>

          <div>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              label="Senha"
              placeholder="••••••••"
              required
              :error="errors.password"
              :disabled="authStore.loading"
            />
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <input
                id="remember-me"
                v-model="form.rememberMe"
                type="checkbox"
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label for="remember-me" class="ml-2 block text-sm text-gray-700">
                Lembrar-me
              </label>
            </div>

            <div class="text-sm">
              <a href="#" class="font-medium text-primary-600 hover:text-primary-500">
                Esqueceu a senha?
              </a>
            </div>
          </div>

          <div v-if="authStore.error" class="rounded-md bg-red-50 p-4">
            <div class="flex">
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800">
                  {{ authStore.error }}
                </h3>
              </div>
            </div>
          </div>

          <div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              full-width
              :loading="authStore.loading"
            >
              Entrar
            </Button>
          </div>

          <div class="text-center">
            <p class="text-sm text-gray-600">
              Não tem uma conta?
              <RouterLink to="/register" class="font-medium text-primary-600 hover:text-primary-500">
                Cadastre-se
              </RouterLink>
            </p>
          </div>
        </form>
      </Card>

      <!-- Footer -->
      <p class="mt-8 text-center text-xs text-gray-500">
        &copy; 2024 Fabric. Todos os direitos reservados.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import Card from '@/components/common/Card.vue'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  email: '',
  password: '',
  rememberMe: false,
})

const errors = reactive({
  email: '',
  password: '',
})

const validateForm = () => {
  errors.email = ''
  errors.password = ''

  if (!form.email) {
    errors.email = 'E-mail é obrigatório'
    return false
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'E-mail inválido'
    return false
  }

  if (!form.password) {
    errors.password = 'Senha é obrigatória'
    return false
  }

  if (form.password.length < 6) {
    errors.password = 'Senha deve ter no mínimo 6 caracteres'
    return false
  }

  return true
}

const handleLogin = async () => {
  if (!validateForm()) return

  console.log('Tentando fazer login com:', form.email)
  
  const success = await authStore.login({
    email: form.email,
    password: form.password,
  })

  console.log('Resultado do login:', success)
  console.log('Erro do store:', authStore.error)

  if (success) {
    console.log('Login bem-sucedido, redirecionando...')
    router.push('/dashboard')
  } else {
    console.error('Login falhou:', authStore.error)
  }
}
</script>
