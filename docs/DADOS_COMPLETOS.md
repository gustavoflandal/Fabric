# 📊 Dados Completos do Sistema - Fabric PCP

## ✅ Resumo Geral

O sistema foi populado com dados completos e consistentes para demonstração e testes.

---

## 🏭 Produção

### Ordens de Produção
- **Total**: 31 ordens criadas
- **Planejadas**: 9 ordens
- **Liberadas**: 4 ordens
- **Em Progresso**: 9 ordens
- **Concluídas**: 10 ordens
- **Canceladas**: 1 ordem

### Apontamentos de Produção
- **Total**: 7 apontamentos
- **Quantidade Boa**: 594 unidades
- **Quantidade Refugo**: 10 unidades
- **Taxa de Refugo**: 1.66%

**Características:**
- Apontamentos vinculados a operações concluídas
- Tempos de setup e run calculados (2-8 horas)
- Refugo realista (0-5%)
- Distribuídos nos últimos 20 dias

---

## 📦 Estoque

### Movimentações
- **Total**: 168 movimentações
- **Entradas**: 84 movimentações
- **Saídas**: 70 movimentações
- **Ajustes**: 14 movimentações
- **Período**: Últimos 60 dias

**Tipos de Movimentação:**
- Estoque inicial
- Compras de fornecedores
- Saídas para produção
- Devoluções de produção
- Ajustes de inventário

---

## 🛒 Compras

### Orçamentos de Compra
- **Total**: 6 orçamentos
- **Pendentes**: 2 orçamentos (aguardando resposta)
- **Aprovados**: 2 orçamentos (prontos para converter em pedido)
- **Rejeitados**: 2 orçamentos (preço acima do esperado)
- **Valor Total**: R$ 285.232,94

**Orçamentos Criados:**
| Número | Fornecedor | Itens | Valor | Status |
|--------|-----------|-------|-------|--------|
| ORC-2025-1000 | EmbalaFácil | 3 | R$ 45.048,81 | PENDING |
| ORC-2025-1001 | TechComponents | 3 | R$ 47.516,14 | PENDING |
| ORC-2025-1002 | PlastiPro | 2 | R$ 98.918,99 | APPROVED |
| ORC-2025-1003 | EmbalaFácil | 2 | R$ 20.585,60 | APPROVED |
| ORC-2025-1004 | TechComponents | 3 | R$ 4.999,24 | REJECTED |
| ORC-2025-1005 | PlastiPro | 3 | R$ 68.164,16 | REJECTED |

### Pedidos de Compra
- **Total**: 8 pedidos
- **Pendentes**: 2 pedidos (aguardando aprovação)
- **Aprovados**: 2 pedidos (aprovados, aguardando confirmação)
- **Confirmados**: 2 pedidos (confirmados pelo fornecedor)
- **Parcialmente Recebidos**: 1 pedido (50-80% recebido)
- **Recebidos**: 1 pedido (100% recebido)
- **Valor Total**: R$ 719.948,27

**Pedidos Criados:**
| Número | Fornecedor | Itens | Valor | Status |
|--------|-----------|-------|-------|--------|
| PC-2025-2000 | EmbalaFácil | 4 | R$ 188.213,34 | PENDING |
| PC-2025-2001 | TechComponents | 5 | R$ 151.704,12 | PENDING |
| PC-2025-2002 | PlastiPro | 4 | R$ 221.465,96 | APPROVED |
| PC-2025-2003 | EmbalaFácil | 3 | R$ 9.552,15 | APPROVED |
| PC-2025-2004 | TechComponents | 2 | R$ 92.077,06 | CONFIRMED |
| PC-2025-2005 | PlastiPro | 3 | R$ 5.738,35 | CONFIRMED |
| PC-2025-2006 | EmbalaFácil | 1 | R$ 29.291,52 | PARTIALLY_RECEIVED |
| PC-2025-2007 | TechComponents | 3 | R$ 21.905,77 | RECEIVED |

### Recebimentos
- **Total**: 2 recebimentos criados
- **Recebimento Parcial**: 1 (50-80% da quantidade)
- **Recebimento Completo**: 1 (100% da quantidade)

---

## 📋 Estrutura de Dados

### Produtos
- **14 produtos** cadastrados
  - 2 Produtos Acabados (PA-001, PA-002)
  - 3 Semiacabados (SA-001, SA-002, SA-003)
  - 7 Matérias-Primas (MP-001 a MP-007)
  - 2 Embalagens (EMB-001, EMB-002)

### BOMs (Estruturas de Produto)
- **4 BOMs completas**
  - PA-001: Smartphone XPro (8 componentes)
  - PA-002: Notebook Ultra (8 componentes)
  - SA-001: Placa Mãe Montada (3 componentes)
  - SA-003: Carcaça Plástica (2 componentes)

### Roteiros de Produção
- **4 roteiros ativos**
  - PA-001: 5 operações
  - PA-002: 6 operações
  - SA-001: 2 operações
  - SA-003: 3 operações

### Centros de Trabalho
- **6 centros** configurados
  - CT-001: Linha de Montagem 1
  - CT-002: Linha de Montagem 2
  - CT-003: Injeção de Plásticos
  - CT-004: Pintura e Acabamento
  - CT-005: Controle de Qualidade
  - CT-006: Embalagem

### Fornecedores e Clientes
- **3 fornecedores** cadastrados
  - TechComponents Ltda
  - PlastiPro Indústria
  - EmbalaFácil
- **3 clientes** cadastrados
  - TechStore Varejo
  - MegaEletro Distribuidora
  - InfoShop Online

---

## 🎯 Comandos para Recriar Dados

### Criar Tudo de Uma Vez
```bash
cd backend
npm run prisma:seed-all
```

### Criar Módulos Específicos

**Estrutura Básica:**
```bash
npm run prisma:seed
```

**Ordens de Produção com BOM:**
```bash
npm run prisma:seed-orders-bom
```

**Movimentações de Estoque:**
```bash
npm run prisma:seed-stock
```

**Apontamentos de Produção:**
```bash
npm run prisma:seed-pointings
```

**Orçamentos e Pedidos de Compra:**
```bash
npm run prisma:seed-purchases
```

**Limpar Dados (mantém usuários):**
```bash
npm run prisma:seed-reset
```

---

## 📊 Estatísticas Gerais

### Dados Operacionais
- **31 Ordens de Produção** em diferentes status
- **7 Apontamentos** de produção registrados
- **168 Movimentações** de estoque
- **6 Orçamentos** de compra
- **8 Pedidos** de compra
- **2 Recebimentos** de materiais

### Valores Financeiros
- **Orçamentos**: R$ 285.232,94
- **Pedidos de Compra**: R$ 719.948,27
- **Total em Compras**: R$ 1.005.181,21

### Período dos Dados
- **Movimentações de Estoque**: Últimos 60 dias
- **Apontamentos**: Últimos 20 dias
- **Orçamentos**: Últimos 20 dias
- **Pedidos de Compra**: Últimos 30 dias

---

## 🔍 Como Visualizar

### Interface Web
1. Acesse: http://localhost:5174
2. Login: admin@fabric.com / admin123
3. Navegue pelos módulos:
   - **Dashboard**: Visão geral
   - **Ordens de Produção**: Ver todas as ordens
   - **Apontamentos**: Ver registros de produção
   - **Estoque**: Ver movimentações e saldos
   - **Compras > Orçamentos**: Ver orçamentos
   - **Compras > Pedidos**: Ver pedidos de compra

### Prisma Studio
```bash
cd backend
npm run prisma:studio
```

### API REST
```bash
# Ordens de Produção
curl http://localhost:3001/api/v1/production-orders

# Orçamentos
curl http://localhost:3001/api/v1/purchase-quotations

# Pedidos de Compra
curl http://localhost:3001/api/v1/purchase-orders

# Movimentações de Estoque
curl http://localhost:3001/api/v1/stock/movements/{productId}
```

---

## 📝 Observações Importantes

1. **Dados Realistas**: Todos os dados foram criados com valores e datas realistas
2. **Relacionamentos**: Todas as referências entre tabelas estão consistentes
3. **Status Variados**: Cada módulo tem registros em diferentes status para demonstração
4. **Histórico**: Dados distribuídos ao longo do tempo (últimos 60 dias)
5. **Usuários Mantidos**: Os scripts de seed mantêm os usuários existentes

---

## 🎬 Pronto para Demonstração!

O sistema está completamente populado e pronto para:
- ✅ Demonstrações comerciais
- ✅ Testes de funcionalidades
- ✅ Treinamento de usuários
- ✅ Validação de processos
- ✅ Desenvolvimento e debugging

**Todos os módulos têm dados consistentes e bem referenciados!** 🚀
