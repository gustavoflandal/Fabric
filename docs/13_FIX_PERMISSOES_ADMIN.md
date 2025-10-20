# Fix: Permissões do Admin

## 🐛 Problema

**Erro**: 403 Forbidden ao tentar excluir logs  
**Causa**: Perfil ADMIN não tinha a nova permissão `audit_logs:delete`

## 🔍 Análise

### Por que aconteceu?

O seed estava usando `upsert` com `update: {}`, que:
- ✅ Criava o perfil ADMIN na primeira vez
- ✅ Atribuía todas as permissões na criação
- ❌ **NÃO atualizava** as permissões em execuções posteriores

Quando adicionamos a nova permissão `audit_logs:delete`:
- ✅ Permissão foi criada no banco
- ✅ Perfil ADMIN já existia
- ❌ Permissão **não foi atribuída** ao ADMIN

### Código Antigo (Problemático)

```typescript
const adminRole = await prisma.role.upsert({
  where: { code: 'ADMIN' },
  update: {},  // ← Não atualiza nada!
  create: {
    code: 'ADMIN',
    name: 'Administrador',
    permissions: {
      create: allPermissions.map((p) => ({
        permissionId: p.id,
      })),
    },
  },
});
```

## ✅ Solução

### Código Novo (Corrigido)

```typescript
// 1. Criar ou atualizar perfil
const adminRole = await prisma.role.upsert({
  where: { code: 'ADMIN' },
  update: {
    name: 'Administrador',
    description: 'Acesso total ao sistema',
  },
  create: {
    code: 'ADMIN',
    name: 'Administrador',
    description: 'Acesso total ao sistema',
  },
});

// 2. Remover permissões antigas
await prisma.rolePermission.deleteMany({
  where: { roleId: adminRole.id },
});

// 3. Adicionar todas as permissões atuais
await prisma.rolePermission.createMany({
  data: allPermissions.map((p) => ({
    roleId: adminRole.id,
    permissionId: p.id,
  })),
});
```

### O que mudou?

1. **Separação de responsabilidades**:
   - `upsert` apenas cria/atualiza o perfil
   - `deleteMany` + `createMany` gerencia permissões

2. **Sempre atualiza permissões**:
   - Remove todas as antigas
   - Adiciona todas as atuais
   - Garante sincronização

3. **Idempotente**:
   - Pode executar múltiplas vezes
   - Sempre resulta no mesmo estado
   - Sem duplicações

## 🧪 Verificação

### Antes do Fix

```sql
SELECT COUNT(*) FROM RolePermission 
WHERE roleId = 'admin-role-id';
-- Resultado: 21 permissões
```

### Depois do Fix

```sql
SELECT COUNT(*) FROM RolePermission 
WHERE roleId = 'admin-role-id';
-- Resultado: 22 permissões ✅
```

### Verificar Permissão Específica

```sql
SELECT p.resource, p.action 
FROM RolePermission rp
JOIN Permission p ON p.id = rp.permissionId
WHERE rp.roleId = 'admin-role-id' 
  AND p.resource = 'audit_logs' 
  AND p.action = 'delete';
-- Resultado: audit_logs | delete ✅
```

## 📋 Passos Executados

1. ✅ Identificar problema no seed
2. ✅ Corrigir lógica de atribuição de permissões
3. ✅ Executar seed novamente
4. ✅ Verificar permissões do ADMIN
5. ✅ Testar exclusão de logs

## 🧪 Como Testar

### 1. Fazer Logout e Login Novamente

O token JWT precisa ser renovado para incluir as novas permissões:

```
1. Clicar em "Sair"
2. Fazer login novamente:
   Email: admin@fabric.com
   Senha: admin123
```

### 2. Testar Exclusão de Logs

```
1. Acessar /audit-logs
2. Clicar em "🗑️ Limpar Logs"
3. Selecionar período
4. Confirmar exclusão
5. Resultado esperado: ✅ Sucesso
```

## 🔄 Fluxo de Permissões

### Token JWT Antigo (Sem Permissão)
```json
{
  "userId": "admin-id",
  "email": "admin@fabric.com",
  "permissions": [
    "users:create",
    "users:read",
    // ... 20 outras permissões
    // ❌ audit_logs:delete NÃO está aqui
  ]
}
```

### Token JWT Novo (Com Permissão)
```json
{
  "userId": "admin-id",
  "email": "admin@fabric.com",
  "permissions": [
    "users:create",
    "users:read",
    // ... 20 outras permissões
    "audit_logs:delete" // ✅ Agora está aqui
  ]
}
```

## 🎯 Lições Aprendidas

### 1. Upsert com Relacionamentos

**Problema**: `upsert` não atualiza relacionamentos automaticamente

**Solução**: Gerenciar relacionamentos separadamente
```typescript
// 1. Upsert da entidade principal
const entity = await prisma.entity.upsert({...});

// 2. Atualizar relacionamentos
await prisma.relation.deleteMany({...});
await prisma.relation.createMany({...});
```

### 2. Seeds Idempotentes

**Princípio**: Seed deve poder ser executado múltiplas vezes

**Implementação**:
- Usar `upsert` em vez de `create`
- Limpar relacionamentos antes de criar
- Não assumir estado inicial

### 3. Permissões e JWT

**Importante**: Permissões são incluídas no token JWT

**Implicação**: Mudanças de permissão requerem novo login

**Solução futura**: Implementar refresh de permissões sem logout

## 📊 Estatísticas

### Permissões no Sistema

```
Total: 22 permissões

Por Recurso:
- users: 4 (create, read, update, delete)
- roles: 4 (create, read, update, delete)
- products: 4 (create, read, update, delete)
- production_orders: 4 (create, read, update, delete)
- stock: 2 (read, update)
- reports: 2 (read, export)
- audit_logs: 2 (read, delete) ← Nova!
```

### Perfis

```
ADMIN: 22 permissões (todas)
MANAGER: 0 permissões (configurar manualmente)
OPERATOR: 0 permissões (configurar manualmente)
```

## 🚀 Próximos Passos

### Imediato
1. ✅ Fazer logout
2. ✅ Fazer login novamente
3. ✅ Testar exclusão de logs

### Futuro
- [ ] Implementar refresh de permissões sem logout
- [ ] Adicionar permissões padrão para MANAGER e OPERATOR
- [ ] Criar interface para visualizar permissões do usuário logado
- [ ] Adicionar logs de mudanças de permissões

## 📚 Arquivo Modificado

```
backend/
└── prisma/
    └── seed.ts  [MODIFICADO]
```

**Mudança**: Lógica de atribuição de permissões ao perfil ADMIN

---

**Status**: ✅ Problema Resolvido  
**Data**: 19/10/2024  
**Causa**: Seed não atualizava permissões  
**Solução**: Separar upsert de relacionamentos  
**Ação necessária**: Logout e login novamente
