# 🗺 Fabric - Roadmap de Implementação

## 📋 Visão Geral

Plano de implementação em 4 fases seguindo a mesma metodologia do VagaLume.

---

## 🎯 Fase 1: Infraestrutura e Base (4-6 semanas)

### **Semana 1-2: Setup do Projeto**

#### **Backend**
- [ ] Criar estrutura de pastas
- [ ] Configurar TypeScript + Express
- [ ] Configurar Prisma ORM
- [ ] Setup MySQL database
- [ ] Configurar variáveis de ambiente
- [ ] Implementar middleware de erro
- [ ] Configurar Winston (logging)
- [ ] Setup ESLint + Prettier

#### **Frontend**
- [ ] Criar projeto Vue 3 + Vite
- [ ] Configurar TypeScript
- [ ] Setup TailwindCSS
- [ ] Configurar Vue Router
- [ ] Setup Pinia (state management)
- [ ] Criar layout base
- [ ] Implementar tema claro/escuro

#### **DevOps**
- [ ] Configurar Docker + Docker Compose
- [ ] Setup Git + GitHub
- [ ] Configurar scripts npm
- [ ] Documentação inicial

### **Semana 3-4: Autenticação e Usuários**

#### **Backend**
- [ ] Schema Prisma: User, Role, Permission
- [ ] Service: AuthService
- [ ] Controller: AuthController
- [ ] Routes: /auth/*
- [ ] Middleware: JWT authentication
- [ ] Implementar bcrypt para senhas
- [ ] Refresh token logic

#### **Frontend**
- [ ] Store: authStore (Pinia)
- [ ] Service: authService
- [ ] Views: Login, Register
- [ ] Components: LoginForm, RegisterForm
- [ ] Route guards
- [ ] Interceptor Axios (token)

#### **Testes**
- [ ] Testes unitários auth
- [ ] Testes de integração API

### **Semana 5-6: Cadastros Básicos**

#### **Backend**
- [ ] Schema: WorkCenter, Supplier, Customer, UnitOfMeasure, Shift, Calendar
- [ ] Services para cada entidade
- [ ] Controllers CRUD
- [ ] Routes: /work-centers, /suppliers, /customers, /units
- [ ] Validação Joi

#### **Frontend**
- [ ] Stores: masterDataStore
- [ ] Services: API clients
- [ ] Views: Listagens e formulários
- [ ] Components: DataTable, FormInput, Modal
- [ ] Navegação e menus

#### **Entregáveis Fase 1**
✅ Sistema de autenticação funcional  
✅ Cadastros básicos completos  
✅ Interface responsiva  
✅ Documentação técnica  

---

## 🔧 Fase 2: Engenharia e Planejamento (6-8 semanas)

### **Semana 7-9: Produtos e BOMs**

#### **Backend**
- [ ] Schema: Product, ProductCategory, BOM, BOMItem
- [ ] ProductService: CRUD + lógica de negócio
- [ ] BOMService: Explosão multinível
- [ ] Controllers e routes
- [ ] Validações complexas

#### **Frontend**
- [ ] Store: productStore, bomStore
- [ ] Views: Produtos, BOMs
- [ ] Component: BOMTree (hierarquia)
- [ ] Component: BOMEditor
- [ ] Busca e filtros avançados

### **Semana 10-12: Roteiros de Fabricação**

#### **Backend**
- [ ] Schema: Routing, RoutingOperation
- [ ] RoutingService
- [ ] Cálculo de lead time
- [ ] Cálculo de capacidade necessária

#### **Frontend**
- [ ] Store: routingStore
- [ ] Views: Roteiros
- [ ] Component: RoutingEditor
- [ ] Visualização de sequência

### **Semana 13-14: MRP Básico**

#### **Backend**
- [ ] Schema: MRPRun, MRPRequirement, Suggestions
- [ ] MRPService: Lógica de cálculo
- [ ] Explosão de BOM
- [ ] Cálculo de necessidades
- [ ] Geração de sugestões
- [ ] Background job (opcional)

#### **Frontend**
- [ ] Store: mrpStore
- [ ] Views: Executar MRP, Resultados
- [ ] Component: MRPResults
- [ ] Visualização de sugestões
- [ ] Conversão de sugestões

#### **Entregáveis Fase 2**
✅ Cadastro completo de produtos  
✅ BOMs multiníveis funcionais  
✅ Roteiros de fabricação  
✅ MRP básico operacional  

---

## 🏭 Fase 3: Execução e Controle (8-10 semanas)

### **Semana 15-17: Gestão de Estoque**

#### **Backend**
- [ ] Schema: Warehouse, Location, Stock, StockMovement, Lot
- [ ] StockService: Movimentações
- [ ] Controle de lotes
- [ ] Reservas de estoque
- [ ] Cálculo de disponibilidade (ATP)

#### **Frontend**
- [ ] Store: stockStore
- [ ] Views: Estoque, Movimentações
- [ ] Component: StockCard
- [ ] Consultas e relatórios
- [ ] Alertas de estoque baixo

### **Semana 18-20: Inventário**

#### **Backend**
- [ ] Schema: Inventory, InventoryCount
- [ ] InventoryService
- [ ] Contagem cíclica
- [ ] Ajustes de estoque

#### **Frontend**
- [ ] Views: Inventário
- [ ] Component: InventoryCounter
- [ ] App mobile-friendly para contagem

### **Semana 21-24: PCP e Produção**

#### **Backend**
- [ ] Schema: ProductionOrder, ProductionOrderOperation, ProductionPointing
- [ ] ProductionService
- [ ] Geração de OPs
- [ ] Liberação de OPs
- [ ] Apontamento de produção
- [ ] Consumo de materiais
- [ ] Controle de perdas

#### **Frontend**
- [ ] Store: productionStore
- [ ] Views: Ordens de Produção
- [ ] Component: ProductionBoard (Kanban)
- [ ] Component: PointingForm
- [ ] Dashboard de produção
- [ ] Apontamento mobile

### **Semana 25-26: Compras**

#### **Backend**
- [ ] Schema: PurchaseOrder, MaterialReceipt
- [ ] PurchaseService
- [ ] Workflow de aprovação
- [ ] Recebimento de materiais

#### **Frontend**
- [ ] Store: purchaseStore
- [ ] Views: Pedidos de Compra
- [ ] Component: PurchaseOrderForm
- [ ] Recebimento de materiais

#### **Entregáveis Fase 3**
✅ Controle completo de estoque  
✅ Rastreabilidade por lote  
✅ Ordens de produção funcionais  
✅ Apontamento de produção  
✅ Gestão de compras integrada  

---

## 📈 Fase 4: Apoio e Qualidade (6-8 semanas)

### **Semana 27-29: Manutenção**

#### **Backend**
- [ ] Schema: Equipment, MaintenancePlan, MaintenanceOrder
- [ ] MaintenanceService
- [ ] Planos preventivos
- [ ] Ordens de serviço
- [ ] Cálculo de indicadores (MTBF, MTTR)

#### **Frontend**
- [ ] Store: maintenanceStore
- [ ] Views: Equipamentos, Manutenção
- [ ] Component: MaintenanceCalendar
- [ ] Dashboard de manutenção

### **Semana 30-32: Qualidade**

#### **Backend**
- [ ] Schema: InspectionPlan, QualityInspection, NonConformity
- [ ] QualityService
- [ ] Planos de inspeção
- [ ] Registro de inspeções
- [ ] Não-conformidades
- [ ] Ações corretivas

#### **Frontend**
- [ ] Store: qualityStore
- [ ] Views: Inspeções, Não-conformidades
- [ ] Component: InspectionForm
- [ ] Certificados de qualidade

### **Semana 33-34: Indicadores e Relatórios**

#### **Backend**
- [ ] Schema: KPI, KPIValue, Report
- [ ] KPIService: Cálculo automático
- [ ] ReportService: Geração de relatórios
- [ ] Exportação PDF/Excel

#### **Frontend**
- [ ] Store: kpiStore, reportStore
- [ ] Views: Dashboard Executivo
- [ ] Component: KPICard
- [ ] Component: ChartWidget (Chart.js)
- [ ] Relatórios interativos

#### **Entregáveis Fase 4**
✅ Manutenção preventiva/corretiva  
✅ Controle de qualidade  
✅ Indicadores de performance  
✅ Dashboards executivos  
✅ Sistema completo e funcional  

---

## 📊 Cronograma Resumido

| Fase | Duração | Entregas Principais |
|------|---------|---------------------|
| **Fase 1** | 4-6 semanas | Autenticação, Cadastros Básicos |
| **Fase 2** | 6-8 semanas | Produtos, BOMs, Roteiros, MRP |
| **Fase 3** | 8-10 semanas | Estoque, Produção, Compras |
| **Fase 4** | 6-8 semanas | Manutenção, Qualidade, Indicadores |
| **Total** | **24-32 semanas** | **Sistema Completo** |

---

## 🎯 Próximos Passos Imediatos

1. **Criar estrutura de pastas do projeto**
2. **Configurar ambiente de desenvolvimento**
3. **Implementar schema Prisma completo**
4. **Iniciar Fase 1: Autenticação**
5. **Configurar CI/CD básico**
6. **Documentar APIs com Swagger**

---

## 📝 Observações

- Seguir os mesmos padrões do VagaLume
- Commits convencionais
- Code review obrigatório
- Testes unitários > 80% cobertura
- Documentação contínua
- Deploy incremental por fase
