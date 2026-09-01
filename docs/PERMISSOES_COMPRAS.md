# 🔐 Permissões de Compras Adicionadas

## ✅ Resumo

Foram adicionadas **18 novas permissões** para os módulos de Orçamentos e Pedidos de Compra.

Total de permissões no sistema: **74 permissões**

---

## 📋 Orçamentos de Compra (6 permissões)

### `orcamentos_compra`

| Ação | Descrição | Uso |
|------|-----------|-----|
| `criar` | Criar orçamentos de compra | Permite criar novos orçamentos |
| `visualizar` | Visualizar orçamentos de compra | Permite visualizar lista e detalhes |
| `editar` | Editar orçamentos de compra | Permite editar orçamentos existentes |
| `excluir` | Excluir orçamentos de compra | Permite excluir orçamentos |
| `aprovar` | Aprovar orçamentos de compra | Permite aprovar orçamentos para gerar pedidos |
| `rejeitar` | Rejeitar orçamentos de compra | Permite rejeitar orçamentos |

---

## 📦 Pedidos de Compra (8 permissões)

### `pedidos_compra`

| Ação | Descrição | Uso |
|------|-----------|-----|
| `criar` | Criar pedidos de compra | Permite criar novos pedidos |
| `visualizar` | Visualizar pedidos de compra | Permite visualizar lista e detalhes |
| `editar` | Editar pedidos de compra | Permite editar pedidos existentes |
| `excluir` | Excluir pedidos de compra | Permite excluir pedidos |
| `aprovar` | Aprovar pedidos de compra | Permite aprovar pedidos pendentes |
| `confirmar` | Confirmar pedidos de compra | Permite confirmar pedidos com fornecedor |
| `cancelar` | Cancelar pedidos de compra | Permite cancelar pedidos |
| `receber` | Receber pedidos de compra | Permite registrar recebimento de materiais |

---

## 📥 Recebimentos de Compra (4 permissões)

### `recebimentos_compra`

| Ação | Descrição | Uso |
|------|-----------|-----|
| `criar` | Criar recebimentos de compra | Permite registrar novos recebimentos |
| `visualizar` | Visualizar recebimentos de compra | Permite visualizar lista e detalhes |
| `editar` | Editar recebimentos de compra | Permite editar recebimentos |
| `excluir` | Excluir recebimentos de compra | Permite excluir recebimentos |

---

## 👥 Distribuição por Perfil

### 🔴 ADMIN (Administrador)
- ✅ **Todas as 74 permissões** incluindo:
  - Todas as permissões de orçamentos
  - Todas as permissões de pedidos
  - Todas as permissões de recebimentos

### 🟡 MANAGER (Gerente)
- ✅ **Visualização e gestão** incluindo:
  - Criar, visualizar e editar orçamentos
  - Criar, visualizar e editar pedidos
  - Aprovar orçamentos e pedidos
  - Visualizar recebimentos

### 🟢 OPERATOR (Operador)
- ✅ **Visualização apenas**:
  - Visualizar orçamentos
  - Visualizar pedidos
  - Visualizar recebimentos

---

## 🔄 Como Aplicar as Permissões

As permissões foram criadas automaticamente ao executar:

```bash
cd backend
npm run prisma:seed
```

---

## 🎯 Fluxo de Trabalho com Permissões

### 1. Orçamento de Compra
```
Criar (create) → Visualizar (read) → Aprovar (approve) ou Rejeitar (reject)
```

### 2. Pedido de Compra
```
Criar (create) → Aprovar (approve) → Confirmar (confirm) → Receber (receive)
                                    ↓
                              Cancelar (cancel)
```

### 3. Recebimento
```
Criar (create) → Visualizar (read) → Editar (update) se necessário
```

---

## 🛡️ Segurança

As permissões garantem que:

- ✅ **Operadores** só podem visualizar
- ✅ **Gerentes** podem criar e aprovar
- ✅ **Administradores** têm controle total
- ✅ **Auditoria** de todas as ações
- ✅ **Rastreabilidade** completa

---

## 📝 Exemplos de Uso no Backend

### Verificar Permissão no Controller

```typescript
// Verificar se usuário pode criar orçamento
if (!req.user.hasPermission('orcamentos_compra', 'criar')) {
  return res.status(403).json({ message: 'Sem permissão' });
}

// Verificar se usuário pode aprovar pedido
if (!req.user.hasPermission('pedidos_compra', 'aprovar')) {
  return res.status(403).json({ message: 'Sem permissão para aprovar' });
}
```

### Middleware de Autorização

```typescript
import { authorize } from '@/middleware/authorize';

// Proteger rota de criação de orçamento
router.post('/quotations', 
  authenticate,
  authorize('orcamentos_compra', 'criar'),
  quotationController.create
);

// Proteger rota de aprovação de pedido
router.post('/orders/:id/approve',
  authenticate,
  authorize('pedidos_compra', 'aprovar'),
  orderController.approve
);
```

---

## 🎨 Exemplos de Uso no Frontend

### Mostrar/Ocultar Botões

```vue
<template>
  <!-- Botão criar orçamento -->
  <Button 
    v-if="hasPermission('orcamentos_compra', 'criar')"
    @click="createQuotation"
  >
    + Novo Orçamento
  </Button>

  <!-- Botão aprovar -->
  <Button
    v-if="hasPermission('orcamentos_compra', 'aprovar')"
    @click="approveQuotation"
  >
    Aprovar
  </Button>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth.store';

const authStore = useAuthStore();

const hasPermission = (resource, action) => {
  return authStore.hasPermission(resource, action);
};
</script>
```

---

## 📊 Estatísticas

- **Total de Permissões**: 74
- **Permissões de Compras**: 18 (24%)
- **Recursos de Compras**: 3 (quotations, orders, receipts)
- **Ações por Recurso**: 4-8 ações

---

## ✅ Próximos Passos

1. ✅ Permissões criadas no banco de dados
2. ⏳ Implementar verificação nos controllers
3. ⏳ Implementar verificação no frontend
4. ⏳ Adicionar testes de autorização
5. ⏳ Documentar fluxos de aprovação

---

**Desenvolvido para garantir segurança e controle de acesso no módulo de compras** 🔐
