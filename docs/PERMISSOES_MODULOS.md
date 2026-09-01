# 🔐 Permissões de Visualização de Módulos

Este documento explica como funcionam as novas permissões para controlar a visualização das abas do módulo do sistema no Dashboard.

## 📋 Permissões Criadas

Foram criadas 3 novas permissões no sistema:

| Recurso | Ação | Descrição |
|---------|------|-----------|
| `modules` | `view_pcp` | Visualizar módulos PCP (Planejamento e Controle da Produção) |
| `modules` | `view_wms` | Visualizar módulos WMS (Warehouse Management System) |
| `modules` | `view_yms` | Visualizar módulos YMS (Yard Management System) |

## 🚀 Como Adicionar as Permissões

### 1. Execute o script de migração:

```bash
cd backend
npx tsx scripts/add-module-permissions.ts
```

Este script irá:
- ✅ Criar as 3 novas permissões no banco de dados
- ✅ Atribuir automaticamente ao perfil **ADMIN**
- ✅ Exibir um resumo das operações realizadas

### 2. Verificar se foi criado com sucesso

Acesse o módulo de **Perfis** no sistema e verifique se as novas permissões aparecem disponíveis para atribuição.

## 🎯 Como Funciona

### No Dashboard

O Dashboard principal (`/dashboard`) agora possui 3 abas:

1. **PCP** - Módulos de Planejamento e Controle da Produção
2. **WMS** - Módulos de Warehouse Management System
3. **YMS** - Módulos de Yard Management System

**Comportamento:**
- Apenas as abas que o usuário tem permissão são exibidas
- Se o usuário não tem permissão para a aba PCP, o sistema seleciona automaticamente a primeira aba disponível (WMS ou YMS)
- Se o usuário não tem permissão para nenhuma aba, nenhuma será exibida

### Exemplo de Configuração de Perfis

#### Perfil "Operador de Armazém"
```
Permissões:
✅ modules.view_wms
❌ modules.view_pcp
❌ modules.view_yms

Resultado: Vê apenas a aba WMS
```

#### Perfil "Gerente de Produção"
```
Permissões:
✅ modules.view_pcp
❌ modules.view_wms
❌ modules.view_yms

Resultado: Vê apenas a aba PCP
```

#### Perfil "Administrador"
```
Permissões:
✅ modules.view_pcp
✅ modules.view_wms
✅ modules.view_yms

Resultado: Vê todas as 3 abas
```

## 🔧 Configuração Manual

Se preferir adicionar as permissões manualmente:

1. Acesse o módulo de **Permissões** no sistema
2. Crie as 3 permissões com os seguintes dados:

**Permissão 1:**
- Recurso: `modules`
- Ação: `view_pcp`
- Descrição: `Visualizar módulos PCP (Planejamento e Controle da Produção)`

**Permissão 2:**
- Recurso: `modules`
- Ação: `view_wms`
- Descrição: `Visualizar módulos WMS (Warehouse Management System)`

**Permissão 3:**
- Recurso: `modules`
- Ação: `view_yms`
- Descrição: `Visualizar módulos YMS (Yard Management System)`

3. Atribua as permissões aos perfis desejados

## 💡 Uso no Frontend

### Verificar Permissões no Componente Vue

```vue
<script setup>
import { useAuthStore } from '@/stores/auth.store'

const authStore = useAuthStore()

// Verificar permissões de módulos
console.log(authStore.canViewPCP)  // true/false
console.log(authStore.canViewWMS)  // true/false
console.log(authStore.canViewYMS)  // true/false

// Verificar qualquer permissão
const canEditProducts = authStore.hasPermission('products', 'update')
</script>

<template>
  <!-- Exibir apenas se tem permissão -->
  <div v-if="authStore.canViewPCP">
    Conteúdo PCP
  </div>
</template>
```

## 📊 Estrutura no Auth Store

O store de autenticação agora inclui:

```typescript
// State
permissions: string[]  // Ex: ['modules.view_pcp', 'products.read', ...]

// Computed
hasPermission(resource: string, action: string): boolean
canViewPCP: boolean
canViewWMS: boolean
canViewYMS: boolean
```

As permissões são carregadas automaticamente quando o usuário faz login ou quando a aplicação é inicializada.

## 🔄 Atualização do Backend

O arquivo `permission.service.ts` foi atualizado para incluir as novas permissões no método `seedDefaultPermissions()`.

Isso garante que ao executar seeds ou criar novos ambientes, as permissões já estarão disponíveis.

## ⚠️ Importante

- As permissões são carregadas do backend ao fazer login
- Se alterar permissões de um perfil, o usuário precisa fazer logout/login para ver as mudanças
- O perfil ADMIN deve sempre ter todas as permissões de módulos

## 🐛 Troubleshooting

### Permissões não aparecem no frontend

1. Verifique se o script foi executado: `npx tsx scripts/add-module-permissions.ts`
2. Verifique se as permissões foram atribuídas ao perfil do usuário
3. Faça logout e login novamente
4. Verifique o console do navegador para erros

### Abas não aparecem mesmo com permissão

1. Limpe o cache do navegador
2. Verifique se o `authStore.permissions` contém os valores corretos no console:
   ```javascript
   console.log(authStore.permissions)
   ```
3. Verifique se o backend está retornando as permissões na resposta de `/auth/me`

---

**Documentação criada em:** 22/10/2025  
**Versão:** 1.0
