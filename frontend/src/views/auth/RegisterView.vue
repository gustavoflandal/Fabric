<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-secondary-50 to-primary-100 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full">
      <!-- Logo e Título -->
      <div class="text-center mb-8">
        <img src="/logo.png" alt="Fabric Logo" class="mx-auto h-24 w-auto mb-4" />
        <h2 class="text-3xl font-bold text-primary-800">
          Criar Conta
        </h2>
        <p class="mt-2 text-sm text-gray-600">
          Comece a usar o Fabric hoje
        </p>
      </div>

      <!-- Card de Registro -->
      <Card shadow="xl">
        <form @submit.prevent="handleRegister" class="space-y-6">
          <div>
            <Input
              id="name"
              v-model="form.name"
              type="text"
              label="Nome Completo"
              placeholder="João Silva"
              required
              :error="errors.name"
              :disabled="authStore.loading"
            />
          </div>

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
              hint="Mínimo de 6 caracteres"
            />
          </div>

          <div>
            <Input
              id="confirmPassword"
              v-model="form.confirmPassword"
              type="password"
              label="Confirmar Senha"
              placeholder="••••••••"
              required
              :error="errors.confirmPassword"
              :disabled="authStore.loading"
            />
          </div>

          <div class="flex items-center">
            <input
              id="terms"
              v-model="form.acceptTerms"
              type="checkbox"
              class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              required
            />
            <label for="terms" class="ml-2 block text-sm text-gray-700">
              Aceito os
              <a href="#" class="font-medium text-primary-600 hover:text-primary-500">
                termos de uso
              </a>
              e
              <a href="#" class="font-medium text-primary-600 hover:text-primary-500">
                política de privacidade
              </a>
            </label>
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
              Criar Conta
            </Button>
          </div>

          <div class="text-center">
            <p class="text-sm text-gray-600">
              Já tem uma conta?
              <RouterLink to="/login" class="font-medium text-primary-600 hover:text-primary-500">
                Faça login
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
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import Button from '@/components/common/Button.vue'
import Input from '@/components/common/Input.vue'
import Card from '@/components/common/Card.vue'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
})

const errors = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
})

const validateForm = () => {
  errors.name = ''
  errors.email = ''
  errors.password = ''
  errors.confirmPassword = ''

  if (!form.name) {
    errors.name = 'Nome é obrigatório'
    return false
  }

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

  if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'As senhas não coincidem'
    return false
  }

  if (!form.acceptTerms) {
    alert('Você deve aceitar os termos de uso')
    return false
  }

  return true
}

const handleRegister = async () => {
  if (!validateForm()) return

  const success = await authStore.register({
    name: form.name,
    email: form.email,
    password: form.password,
  })

  if (success) {
    router.push('/dashboard')
  }
}
</script>
