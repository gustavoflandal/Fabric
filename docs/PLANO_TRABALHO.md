# 📋 Plano de Trabalho - Sistema Fabric MES

**Data de Criação**: 20/10/2025  
**Versão**: 1.0  
**Status**: Em Andamento

---

## ✅ Módulos Concluídos

### **1. Autenticação e Autorização** ✅
- [x] Login/Logout
- [x] JWT Authentication
- [x] Gestão de usuários
- [x] Perfis e permissões
- [x] Logs de auditoria

### **2. Cadastros Básicos** ✅
- [x] Unidades de medida
- [x] Categorias de produto
- [x] Fornecedores
- [x] Clientes
- [x] Centros de trabalho

### **3. Engenharia de Produtos** ✅
- [x] CRUD de produtos
- [x] BOMs (Bill of Materials)
- [x] Versionamento de BOMs
- [x] Explosão de BOM multinível
- [x] Ativação exclusiva de BOMs

### **4. Interface** ✅
- [x] Dashboard principal
- [x] Componentes reutilizáveis (Button, Card, etc.)
- [x] Sistema de navegação
- [x] Responsividade

---

## 🚧 Módulos em Desenvolvimento

### **Fase 1: Roteiros de Produção (Routing)** 🔧
**Prioridade**: Alta | **Estimativa**: 1-2 dias

#### **Backend**
- [ ] Criar `routing.validator.ts`
  - Schema para criar roteiro
  - Schema para atualizar roteiro
  - Schema para adicionar operação
  - Schema para ativar/desativar roteiro
  
- [ ] Criar `routing.service.ts`
  - `create()` - Criar roteiro
  - `getAll()` - Listar roteiros com filtros
  - `getById()` - Buscar roteiro por ID
  - `getByProduct()` - Buscar roteiros de um produto
  - `update()` - Atualizar roteiro
  - `delete()` - Excluir roteiro
  - `setActive()` - Ativar roteiro (desativa outros)
  - `addOperation()` - Adicionar operação
  - `updateOperation()` - Atualizar operação
  - `deleteOperation()` - Remover operação
  - `calculateTotalTime()` - Calcular tempo total do roteiro

- [ ] Criar `routing.controller.ts`
  - Endpoints REST para todas as operações
  - Tratamento de erros
  - Validação de entrada

- [ ] Criar `routing.routes.ts`
  - Registrar rotas no router principal
  - Aplicar middleware de autenticação
  - Aplicar middleware de validação

#### **Frontend**
- [ ] Criar `routing.service.ts`
  - Cliente HTTP para APIs de roteiro
  
- [ ] Criar `routing.store.ts`
  - Gerenciamento de estado com Pinia
  - Cache de roteiros por produto
  
- [ ] Criar `RoutingManagerModal.vue`
  - Modal para gerenciar roteiros de um produto
  - Listar roteiros (com versões)
  - Formulário de criação/edição
  - Gerenciar operações (adicionar, editar, remover)
  - Ativar/desativar roteiros
  - Visualizar tempos calculados

- [ ] Integrar com `ProductsView.vue`
  - Adicionar botão "Roteiros" na listagem de produtos
  - Abrir modal de roteiros

#### **Dados de Teste**
- [ ] Adicionar roteiros de exemplo no seed
  - Roteiro para PA-001 (Smartphone)
  - Roteiro para PA-002 (Notebook)
  - Roteiro para SA-001 (Placa Mãe)
  - Roteiro para SA-003 (Carcaça)

#### **Testes**
- [ ] Testar criação de roteiro
- [ ] Testar versionamento
- [ ] Testar ativação exclusiva
- [ ] Testar cálculo de tempos
- [ ] Testar integração com produtos e centros de trabalho

---

### **Fase 2: Ordens de Produção** 📋
**Prioridade**: Alta | **Estimativa**: 2-3 dias

#### **Backend**
- [ ] Criar `production-order.validator.ts`
  - Schema para criar ordem
  - Schema para atualizar ordem
  - Schema para mudar status
  - Schema para apontar produção

- [ ] Criar `production-order.service.ts`
  - `create()` - Criar ordem (com cálculo de materiais e operações)
  - `getAll()` - Listar ordens com filtros
  - `getById()` - Buscar ordem por ID
  - `update()` - Atualizar ordem
  - `delete()` - Excluir ordem
  - `changeStatus()` - Mudar status da ordem
  - `calculateMaterials()` - Calcular necessidades via BOM
  - `calculateOperations()` - Calcular operações via Routing
  - `updateProgress()` - Atualizar progresso da ordem

- [ ] Criar `production-order.controller.ts`
  - Endpoints REST
  - Lógica de negócio complexa

- [ ] Criar `production-order.routes.ts`
  - Rotas com autenticação e validação

#### **Frontend**
- [ ] Criar `production-order.service.ts`
- [ ] Criar `production-order.store.ts`
- [ ] Criar `ProductionOrdersView.vue`
  - Listagem de ordens
  - Filtros (status, produto, data)
  - Formulário de criação
  - Detalhes da ordem (materiais, operações)
  - Acompanhamento de progresso

#### **Dados de Teste**
- [ ] Adicionar ordens de exemplo no seed
  - Ordem para produzir 10 Smartphones
  - Ordem para produzir 5 Notebooks

#### **Testes**
- [ ] Testar criação de ordem
- [ ] Testar cálculo de materiais
- [ ] Testar cálculo de operações
- [ ] Testar mudança de status
- [ ] Testar fluxo completo

---

### **Fase 3: Apontamentos de Produção** ⏱️
**Prioridade**: Média | **Estimativa**: 1-2 dias

#### **Backend**
- [ ] Criar `production-pointing.validator.ts`
- [ ] Criar `production-pointing.service.ts`
  - `create()` - Criar apontamento
  - `getAll()` - Listar apontamentos
  - `getByOrder()` - Apontamentos de uma ordem
  - `getByOperator()` - Apontamentos de um operador
  - `update()` - Atualizar apontamento
  - `delete()` - Excluir apontamento

- [ ] Criar `production-pointing.controller.ts`
- [ ] Criar `production-pointing.routes.ts`

#### **Frontend**
- [ ] Criar `production-pointing.service.ts`
- [ ] Criar `production-pointing.store.ts`
- [ ] Criar `ProductionPointingView.vue`
  - Interface simplificada para operadores
  - Seleção de ordem e operação
  - Registro de início/fim
  - Apontamento de quantidade boa/refugo
  - Timer visual

#### **Dados de Teste**
- [ ] Adicionar apontamentos de exemplo no seed

#### **Testes**
- [ ] Testar registro de apontamento
- [ ] Testar atualização de status da ordem
- [ ] Testar cálculo de tempos

---

### **Fase 4: Dashboards e Relatórios** 📊
**Prioridade**: Baixa | **Estimativa**: 1 dia

#### **Backend**
- [ ] Criar `dashboard.service.ts`
  - Agregação de KPIs
  - Dados para gráficos
  
- [ ] Criar `report.service.ts`
  - Relatórios de produção
  - Relatórios de eficiência
  - Relatórios de refugo

- [ ] Criar endpoints de dashboard e relatórios

#### **Frontend**
- [ ] Atualizar `DashboardView.vue`
  - Carregar dados reais
  - Gráficos de produção
  - KPIs dinâmicos
  
- [ ] Criar `ReportsView.vue`
  - Seleção de relatório
  - Filtros de data
  - Exportação (PDF, Excel)

#### **Testes**
- [ ] Testar cálculo de KPIs
- [ ] Testar geração de relatórios

---

## 📊 Progresso Geral

| Fase | Módulo | Status | Progresso |
|------|--------|--------|-----------|
| ✅ | Autenticação | Concluído | 100% |
| ✅ | Cadastros Básicos | Concluído | 100% |
| ✅ | Produtos e BOMs | Concluído | 100% |
| ✅ | Interface Base | Concluído | 100% |
| 🚧 | Roteiros | Pendente | 0% |
| 🚧 | Ordens de Produção | Pendente | 0% |
| 🚧 | Apontamentos | Pendente | 0% |
| 🚧 | Dashboards | Pendente | 0% |

**Progresso Total**: 50% (4/8 módulos principais)

---

## 🎯 Próximos Passos Imediatos

### **Agora: Implementar Roteiros de Produção**

1. **Backend** (1h)
   - Criar validator
   - Criar service com lógica de negócio
   - Criar controller
   - Criar routes
   - Registrar no router principal

2. **Frontend** (1h)
   - Criar service
   - Criar store
   - Criar modal de gerenciamento
   - Integrar com produtos

3. **Dados de Teste** (30min)
   - Adicionar roteiros no seed
   - Testar com produtos existentes

4. **Testes** (30min)
   - Validar fluxo completo
   - Testar edge cases

---

## 📝 Notas Técnicas

### **Padrões de Código**
- Backend: Validator → Service → Controller → Routes
- Frontend: Service → Store → View/Component
- Sempre usar TypeScript com tipagem forte
- Seguir convenções de nomenclatura existentes

### **Estrutura de Arquivos**
```
backend/src/
├── validators/
│   └── routing.validator.ts
├── services/
│   └── routing.service.ts
├── controllers/
│   └── routing.controller.ts
└── routes/
    └── routing.routes.ts

frontend/src/
├── services/
│   └── routing.service.ts
├── stores/
│   └── routing.store.ts
└── components/
    └── products/
        └── RoutingManagerModal.vue
```

### **Dependências**
- Roteiros → Produtos, Centros de Trabalho
- Ordens → Produtos, BOMs, Roteiros
- Apontamentos → Ordens, Operações, Usuários
- Dashboards → Todos os módulos

---

## 🚀 Metas de Entrega

- **Sprint 1** (Concluído): Autenticação, Cadastros, Produtos, BOMs
- **Sprint 2** (Atual): Roteiros de Produção
- **Sprint 3**: Ordens de Produção
- **Sprint 4**: Apontamentos e Dashboards

**Data Prevista de Conclusão**: 3-4 dias úteis

---

## 📞 Suporte e Dúvidas

Para dúvidas ou ajustes no plano:
- Revisar documentação em `PRODUTOS_EXEMPLO.md` e `DADOS_SISTEMA.md`
- Consultar schema do banco em `backend/prisma/schema.prisma`
- Verificar exemplos de código nos módulos já implementados

---

**Última Atualização**: 20/10/2025 12:05
