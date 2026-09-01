# 🔍 Análise e Correção - Problema de Permissões de Módulos

## 📋 Problema Identificado

**Sintoma:** Perda de acesso às abas/módulos do sistema mesmo estando logado como administrador.

**Data da Análise:** 2025-10-23

---

## 🔎 Análise Realizada

### 1. **Fluxo de Autenticação e Permissões**

#### Backend (`auth.service.ts`)
```typescript
async getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      active: true,
      createdAt: true,
      roles: {
        select: {
          role: {
            select: {
              id: true,
              code: true,
              name: true,
              permissions: {
                select: {
                  permission: {
                    select: {
                      id: true,
                      resource: true,
                      action: true,
                      description: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  
  // ✅ Backend retorna permissões corretamente
  const formattedUser = {
    ...user,
    roles: user.roles.map((ur) => ({
      ...ur.role,
      permissions: ur.role.permissions.map((rp) => rp.permission),
    })),
  };
  
  return formattedUser;
}
```

#### Frontend (`auth.store.ts`)
```typescript
async fetchUser() {
  try {
    const userData = await authService.getMe()
    user.value = userData
    
    // 🔴 PROBLEMA: Conversão de permissões
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
    }
  } catch (err) {
    // 🔴 PROBLEMA: Logout em caso de erro
    logout()
  }
}
```

### 2. **Permissões Esperadas vs Realidade**

#### Permissões Necessárias para os Módulos:
- ✅ `modules.view_general` - Módulo Geral (Administração)
- ✅ `modules.view_pcp` - Módulo PCP
- ✅ `modules.view_wms` - Módulo WMS  
- ✅ `modules.view_yms` - Módulo YMS

#### Verificação nos Componentes:
```typescript
// auth.store.ts
const canViewGeneral = computed(() => permissions.value.includes('modules.view_general'))
const canViewPCP = computed(() => permissions.value.includes('modules.view_pcp'))
const canViewWMS = computed(() => permissions.value.includes('modules.view_wms'))
const canViewYMS = computed(() => permissions.value.includes('modules.view_yms'))
```

### 3. **Scripts de Permissões Identificados**

- ✅ `add-module-permissions.ts` - Cria permissões PCP, WMS, YMS
- ✅ `add-general-module-permission.ts` - Cria permissão Geral
- ✅ `sync-all-admin-permissions.ts` - Sincroniza TODAS as permissões para ADMIN
- ✅ `check-user-permissions.ts` - Verifica permissões de um usuário

---

## 🐛 Causas Raiz Identificadas

### **Causa 1: Permissões Não Criadas**
Os scripts `add-module-permissions.ts` e `add-general-module-permission.ts` podem não ter sido executados após a criação do banco de dados.

### **Causa 2: Permissões Não Atribuídas ao Role ADMIN**
Mesmo que as permissões existam, elas podem não estar vinculadas ao role ADMIN.

### **Causa 3: Token JWT Desatualizado**
O token JWT contém apenas `userId`, `email` e `name`. As permissões são carregadas via chamada `/auth/me`. Se essa chamada falhar ou retornar dados incompletos, o usuário perde acesso.

### **Causa 4: Refresh Token não Recarrega Permissões**
Quando o `accessToken` expira e é renovado via `refreshToken`, as permissões não são recarregadas automaticamente.

### **Causa 5: localStorage/State Dessincronia**
O estado de permissões no Pinia pode ficar dessincronizado se:
- O usuário fez login antes das permissões serem criadas
- O token foi renovado mas `fetchUser()` não foi chamado
- Houve erro na chamada `/auth/me` e o erro foi silenciosamente ignorado

### **Causa 6: Inicialização do App**
O `App.vue` chama `authStore.initialize()` no `onMounted`, mas se o token estiver expirado ou inválido, a chamada falha e o usuário é deslogado.

---

## ✅ Plano de Correção

### **Fase 1: Garantir Permissões no Banco de Dados**

#### 1.1 Executar Scripts de Criação de Permissões
```bash
cd backend
npx tsx prisma/scripts/add-general-module-permission.ts
npx tsx prisma/scripts/add-module-permissions.ts
npx tsx prisma/scripts/sync-all-admin-permissions.ts
```

#### 1.2 Verificar Permissões do Admin
```bash
npx tsx prisma/scripts/check-user-permissions.ts
```

#### 1.3 Criar Script Consolidado de Permissões de Módulos
Criar um novo script que garanta todas as 4 permissões de módulos.

### **Fase 2: Corrigir Store de Autenticação**

#### 2.1 Melhorar Tratamento de Erros em `fetchUser()`
Não fazer logout automático em caso de erro de rede temporário.

#### 2.2 Recarregar Permissões Após Refresh Token
Chamar `fetchUser()` após renovar o token.

#### 2.3 Adicionar Persistência de Permissões
Salvar permissões no localStorage como backup temporário.

#### 2.4 Adicionar Logs de Debug
Melhorar logs para identificar quando e por que as permissões são perdidas.

### **Fase 3: Melhorar Fluxo de Inicialização**

#### 3.1 Retry Mechanism em `initialize()`
Tentar algumas vezes antes de deslogar o usuário.

#### 3.2 Loading State Durante Inicialização
Mostrar loading enquanto carrega permissões.

#### 3.3 Fallback Gracioso
Se falhar ao carregar permissões, manter usuário logado mas mostrar mensagem.

### **Fase 4: Validação e Testes**

#### 4.1 Teste de Login Fresh
- Login novo deve carregar permissões corretamente

#### 4.2 Teste de Refresh Token
- Token expirado deve renovar E recarregar permissões

#### 4.3 Teste de Reconexão
- Perda de conexão temporária não deve deslogar usuário

#### 4.4 Teste de Navegação
- Navegar entre módulos deve manter permissões

---

## 🔧 Implementação das Correções

### **Correção 1: Script Consolidado de Permissões**
Arquivo: `backend/scripts/ensure-module-permissions.ts`

### **Correção 2: Auth Store Melhorado**
Arquivo: `frontend/src/stores/auth.store.ts`

### **Correção 3: Interceptor de API Melhorado**
Arquivo: `frontend/src/services/api.service.ts`

### **Correção 4: App Initialization Melhorado**
Arquivo: `frontend/src/App.vue`

---

## 📊 Métricas de Sucesso

- ✅ Usuário ADMIN sempre vê todas as 4 abas (Geral, PCP, WMS, YMS)
- ✅ Permissões persistem após refresh de página
- ✅ Permissões persistem após expiração e renovação de token
- ✅ Erros de rede temporários não deslogam o usuário
- ✅ Logs claros indicam o estado das permissões em cada etapa

---

## 🎯 Próximos Passos

1. ✅ Criar script consolidado de permissões
2. ✅ Corrigir auth.store.ts
3. ✅ Corrigir api.service.ts
4. ✅ Corrigir App.vue
5. ✅ Executar todos os scripts de permissões
6. ✅ Testar todos os cenários
7. ✅ Documentar solução final

---

## 📝 Observações

- O problema é **intermitente** porque depende do estado do token e da sincronia das permissões
- Afeta principalmente usuários que ficam muito tempo logados (token expira)
- Pode afetar novos usuários se as permissões não foram criadas no seed
- É um problema de **sincronização de estado** entre backend, frontend e localStorage
