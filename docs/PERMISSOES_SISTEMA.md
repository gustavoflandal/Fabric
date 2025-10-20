# 🔐 Permissões do Sistema Fabric

## 📊 Visão Geral

O sistema possui **47 permissões** organizadas por recurso, permitindo controle granular de acesso.

---

## 📋 Permissões por Módulo

### **1. Usuários** (4 permissões)
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `users` | `create` | Criar usuários |
| `users` | `read` | Visualizar usuários |
| `users` | `update` | Editar usuários |
| `users` | `delete` | Excluir usuários |

---

### **2. Perfis** (4 permissões)
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `roles` | `create` | Criar perfis |
| `roles` | `read` | Visualizar perfis |
| `roles` | `update` | Editar perfis |
| `roles` | `delete` | Excluir perfis |

---

### **3. Produtos** (4 permissões)
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `products` | `create` | Criar produtos |
| `products` | `read` | Visualizar produtos |
| `products` | `update` | Editar produtos |
| `products` | `delete` | Excluir produtos |

---

### **4. BOMs - Estruturas de Produto** (4 permissões) 🆕
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `boms` | `create` | Criar BOMs |
| `boms` | `read` | Visualizar BOMs |
| `boms` | `update` | Editar BOMs |
| `boms` | `delete` | Excluir BOMs |

---

### **5. Roteiros de Produção** (4 permissões) 🆕
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `routings` | `create` | Criar roteiros |
| `routings` | `read` | Visualizar roteiros |
| `routings` | `update` | Editar roteiros |
| `routings` | `delete` | Excluir roteiros |

---

### **6. Ordens de Produção** (5 permissões) 🆕
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `production_orders` | `create` | Criar ordens de produção |
| `production_orders` | `read` | Visualizar ordens de produção |
| `production_orders` | `update` | Editar ordens de produção |
| `production_orders` | `delete` | Excluir ordens de produção |
| `production_orders` | `execute` | Executar ordens de produção |

---

### **7. Apontamentos de Produção** (4 permissões) 🆕
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `production_pointings` | `create` | Criar apontamentos |
| `production_pointings` | `read` | Visualizar apontamentos |
| `production_pointings` | `update` | Editar apontamentos |
| `production_pointings` | `delete` | Excluir apontamentos |

---

### **8. Centros de Trabalho** (4 permissões) 🆕
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `work_centers` | `create` | Criar centros de trabalho |
| `work_centers` | `read` | Visualizar centros de trabalho |
| `work_centers` | `update` | Editar centros de trabalho |
| `work_centers` | `delete` | Excluir centros de trabalho |

---

### **9. Fornecedores** (4 permissões) 🆕
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `suppliers` | `create` | Criar fornecedores |
| `suppliers` | `read` | Visualizar fornecedores |
| `suppliers` | `update` | Editar fornecedores |
| `suppliers` | `delete` | Excluir fornecedores |

---

### **10. Clientes** (4 permissões) 🆕
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `customers` | `create` | Criar clientes |
| `customers` | `read` | Visualizar clientes |
| `customers` | `update` | Editar clientes |
| `customers` | `delete` | Excluir clientes |

---

### **11. Estoque** (2 permissões)
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `stock` | `read` | Visualizar estoque |
| `stock` | `update` | Movimentar estoque |

---

### **12. Relatórios** (2 permissões)
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `reports` | `read` | Visualizar relatórios |
| `reports` | `export` | Exportar relatórios |

---

### **13. Logs de Auditoria** (2 permissões)
| Recurso | Ação | Descrição |
|---------|------|-----------|
| `audit_logs` | `read` | Visualizar logs de auditoria |
| `audit_logs` | `delete` | Excluir logs de auditoria |

---

## 👥 Perfis e Permissões

### **ADMIN - Administrador**
✅ **Todas as 47 permissões**
- Acesso total ao sistema
- Pode gerenciar usuários, perfis e permissões
- Pode acessar todos os módulos
- Pode visualizar e exportar relatórios
- Pode gerenciar logs de auditoria

### **MANAGER - Gerente**
📊 **Permissões de leitura e gestão de produção**
- Visualizar todos os módulos
- Criar e editar ordens de produção
- Visualizar relatórios
- Não pode gerenciar usuários e perfis
- Não pode excluir registros críticos

### **OPERATOR - Operador**
⚙️ **Permissões de execução**
- Visualizar ordens de produção
- Executar ordens de produção
- Criar apontamentos de produção
- Visualizar produtos e BOMs
- Acesso limitado apenas ao necessário para operação

---

## 🔒 Controle de Acesso

### **Como Funciona**
1. **Middleware de Autenticação**: Verifica se o usuário está logado
2. **Middleware de Permissão**: Verifica se o usuário tem a permissão necessária
3. **Verificação por Rota**: Cada endpoint pode exigir permissões específicas

### **Exemplo de Uso**
```typescript
// Rota protegida que requer permissão
router.post(
  '/production-orders',
  authMiddleware,
  requirePermission('production_orders', 'create'),
  productionOrderController.create
);
```

---

## 📊 Estatísticas

| Categoria | Quantidade |
|-----------|-----------|
| **Total de Permissões** | 47 |
| **Recursos** | 13 |
| **Perfis Padrão** | 3 |
| **Permissões ADMIN** | 47 (100%) |
| **Permissões MANAGER** | ~30 (64%) |
| **Permissões OPERATOR** | ~15 (32%) |

---

## 🆕 Novas Permissões Adicionadas

### **Nesta Atualização**
✅ **BOMs** (4 permissões)
✅ **Roteiros** (4 permissões)
✅ **Ordens de Produção** (5 permissões - incluindo `execute`)
✅ **Apontamentos** (4 permissões)
✅ **Centros de Trabalho** (4 permissões)
✅ **Fornecedores** (4 permissões)
✅ **Clientes** (4 permissões)

**Total de Novas Permissões**: 29

---

## 🎯 Boas Práticas

### **Princípio do Menor Privilégio**
- Conceda apenas as permissões necessárias
- Revise permissões periodicamente
- Use perfis personalizados quando necessário

### **Auditoria**
- Todas as ações são registradas em `audit_logs`
- Logs incluem: usuário, ação, recurso, data/hora
- Apenas ADMIN pode excluir logs

### **Segurança**
- Permissões são verificadas no backend
- Frontend oculta opções não permitidas
- Tokens JWT incluem informações de permissões

---

## 📝 Como Criar Perfis Personalizados

1. **Criar Perfil**
```sql
INSERT INTO roles (code, name, description)
VALUES ('SUPERVISOR', 'Supervisor', 'Supervisor de produção');
```

2. **Atribuir Permissões**
```sql
INSERT INTO role_permissions (roleId, permissionId)
SELECT 'role-id', id FROM permissions
WHERE resource IN ('production_orders', 'production_pointings')
  AND action IN ('read', 'execute', 'create');
```

3. **Atribuir Perfil ao Usuário**
```sql
INSERT INTO user_roles (userId, roleId)
VALUES ('user-id', 'role-id');
```

---

## 🔍 Consultar Permissões de um Usuário

```sql
SELECT p.resource, p.action, p.description
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permissionId
JOIN user_roles ur ON rp.roleId = ur.roleId
WHERE ur.userId = 'user-id';
```

---

**Sistema de permissões completo e atualizado! 🔐**

**Total: 47 permissões cobrindo todos os módulos implementados**
