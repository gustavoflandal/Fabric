# 📁 Fabric - Estrutura do Projeto

## 📋 Visão Geral

Estrutura de pastas seguindo os mesmos padrões do VagaLume com separação clara entre backend e frontend.

---

## 🗂 Estrutura Completa

```
fabric/
├── 📁 backend/                     # API Node.js + TypeScript
│   ├── 📁 prisma/
│   │   ├── 📄 schema.prisma        # Schema do banco de dados
│   │   ├── 📁 migrations/          # Migrations do Prisma
│   │   └── 📄 seed.ts              # Dados iniciais
│   │
│   ├── 📁 src/
│   │   ├── 📁 config/
│   │   │   ├── 📄 database.ts      # Configuração Prisma
│   │   │   ├── 📄 env.ts           # Variáveis de ambiente
│   │   │   ├── 📄 jwt.ts           # Configuração JWT
│   │   │   └── 📄 logger.ts        # Winston logger
│   │   │
│   │   ├── 📁 controllers/         # Controllers da API
│   │   │   ├── 📄 auth.controller.ts
│   │   │   ├── 📄 user.controller.ts
│   │   │   ├── 📄 product.controller.ts
│   │   │   ├── 📄 bom.controller.ts
│   │   │   ├── 📄 routing.controller.ts
│   │   │   ├── 📄 mrp.controller.ts
│   │   │   ├── 📄 stock.controller.ts
│   │   │   ├── 📄 production.controller.ts
│   │   │   ├── 📄 purchase.controller.ts
│   │   │   ├── 📄 maintenance.controller.ts
│   │   │   ├── 📄 quality.controller.ts
│   │   │   └── 📄 kpi.controller.ts
│   │   │
│   │   ├── 📁 services/            # Lógica de negócio
│   │   │   ├── 📄 auth.service.ts
│   │   │   ├── 📄 user.service.ts
│   │   │   ├── 📄 product.service.ts
│   │   │   ├── 📄 bom.service.ts
│   │   │   ├── 📄 routing.service.ts
│   │   │   ├── 📄 mrp.service.ts
│   │   │   ├── 📄 stock.service.ts
│   │   │   ├── 📄 production.service.ts
│   │   │   ├── 📄 purchase.service.ts
│   │   │   ├── 📄 maintenance.service.ts
│   │   │   ├── 📄 quality.service.ts
│   │   │   └── 📄 kpi.service.ts
│   │   │
│   │   ├── 📁 middleware/          # Middlewares Express
│   │   │   ├── 📄 auth.middleware.ts
│   │   │   ├── 📄 error.middleware.ts
│   │   │   ├── 📄 validation.middleware.ts
│   │   │   ├── 📄 permission.middleware.ts
│   │   │   └── 📄 audit.middleware.ts
│   │   │
│   │   ├── 📁 routes/              # Rotas da API
│   │   │   ├── 📄 index.ts         # Agregador de rotas
│   │   │   ├── 📄 auth.routes.ts
│   │   │   ├── 📄 user.routes.ts
│   │   │   ├── 📄 master-data.routes.ts
│   │   │   ├── 📄 product.routes.ts
│   │   │   ├── 📄 bom.routes.ts
│   │   │   ├── 📄 routing.routes.ts
│   │   │   ├── 📄 mrp.routes.ts
│   │   │   ├── 📄 stock.routes.ts
│   │   │   ├── 📄 production.routes.ts
│   │   │   ├── 📄 purchase.routes.ts
│   │   │   ├── 📄 maintenance.routes.ts
│   │   │   ├── 📄 quality.routes.ts
│   │   │   └── 📄 kpi.routes.ts
│   │   │
│   │   ├── 📁 validators/          # Schemas de validação Joi
│   │   │   ├── 📄 auth.validator.ts
│   │   │   ├── 📄 product.validator.ts
│   │   │   ├── 📄 bom.validator.ts
│   │   │   ├── 📄 production.validator.ts
│   │   │   └── 📄 ...
│   │   │
│   │   ├── 📁 utils/               # Utilitários
│   │   │   ├── 📄 password.util.ts
│   │   │   ├── 📄 jwt.util.ts
│   │   │   ├── 📄 date.util.ts
│   │   │   ├── 📄 calculation.util.ts
│   │   │   └── 📄 response.util.ts
│   │   │
│   │   ├── 📁 types/               # Tipos TypeScript
│   │   │   ├── 📄 auth.types.ts
│   │   │   ├── 📄 product.types.ts
│   │   │   ├── 📄 production.types.ts
│   │   │   ├── 📄 express.d.ts
│   │   │   └── 📄 ...
│   │   │
│   │   ├── 📁 jobs/                # Background jobs (opcional)
│   │   │   ├── 📄 mrp.job.ts
│   │   │   ├── 📄 kpi-calculation.job.ts
│   │   │   └── 📄 notification.job.ts
│   │   │
│   │   ├── 📄 app.ts               # Configuração Express
│   │   └── 📄 server.ts            # Entry point
│   │
│   ├── 📁 tests/                   # Testes
│   │   ├── 📁 unit/
│   │   ├── 📁 integration/
│   │   └── 📁 e2e/
│   │
│   ├── 📄 .env.example             # Exemplo de variáveis
│   ├── 📄 .eslintrc.js             # ESLint config
│   ├── 📄 .prettierrc              # Prettier config
│   ├── 📄 tsconfig.json            # TypeScript config
│   ├── 📄 package.json
│   └── 📄 README.md
│
├── 📁 frontend/                    # SPA Vue 3 + TypeScript
│   ├── 📁 public/
│   │   ├── 📄 favicon.ico
│   │   └── 📁 images/
│   │
│   ├── 📁 src/
│   │   ├── 📁 assets/              # Assets estáticos
│   │   │   ├── 📁 images/
│   │   │   ├── 📁 icons/
│   │   │   └── 📄 logo.png
│   │   │
│   │   ├── 📁 components/          # Componentes reutilizáveis
│   │   │   ├── 📁 common/
│   │   │   │   ├── 📄 Button.vue
│   │   │   │   ├── 📄 Input.vue
│   │   │   │   ├── 📄 Select.vue
│   │   │   │   ├── 📄 Modal.vue
│   │   │   │   ├── 📄 DataTable.vue
│   │   │   │   ├── 📄 Pagination.vue
│   │   │   │   └── 📄 Loading.vue
│   │   │   │
│   │   │   ├── 📁 product/
│   │   │   │   ├── 📄 ProductCard.vue
│   │   │   │   ├── 📄 ProductForm.vue
│   │   │   │   └── 📄 ProductSearch.vue
│   │   │   │
│   │   │   ├── 📁 bom/
│   │   │   │   ├── 📄 BOMTree.vue
│   │   │   │   ├── 📄 BOMEditor.vue
│   │   │   │   └── 📄 BOMItem.vue
│   │   │   │
│   │   │   ├── 📁 production/
│   │   │   │   ├── 📄 ProductionBoard.vue
│   │   │   │   ├── 📄 ProductionCard.vue
│   │   │   │   ├── 📄 PointingForm.vue
│   │   │   │   └── 📄 OperationStatus.vue
│   │   │   │
│   │   │   ├── 📁 stock/
│   │   │   │   ├── 📄 StockCard.vue
│   │   │   │   ├── 📄 StockMovement.vue
│   │   │   │   └── 📄 InventoryCounter.vue
│   │   │   │
│   │   │   ├── 📁 charts/
│   │   │   │   ├── 📄 LineChart.vue
│   │   │   │   ├── 📄 BarChart.vue
│   │   │   │   ├── 📄 PieChart.vue
│   │   │   │   └── 📄 GaugeChart.vue
│   │   │   │
│   │   │   └── 📁 kpi/
│   │   │       ├── 📄 KPICard.vue
│   │   │       ├── 📄 KPIWidget.vue
│   │   │       └── 📄 Dashboard.vue
│   │   │
│   │   ├── 📁 layouts/             # Layouts
│   │   │   ├── 📄 DefaultLayout.vue
│   │   │   ├── 📄 AuthLayout.vue
│   │   │   ├── 📄 Sidebar.vue
│   │   │   ├── 📄 Navbar.vue
│   │   │   └── 📄 Footer.vue
│   │   │
│   │   ├── 📁 views/               # Views/Páginas
│   │   │   ├── 📁 auth/
│   │   │   │   ├── 📄 Login.vue
│   │   │   │   └── 📄 Register.vue
│   │   │   │
│   │   │   ├── 📁 dashboard/
│   │   │   │   ├── 📄 Executive.vue
│   │   │   │   ├── 📄 Production.vue
│   │   │   │   └── 📄 Maintenance.vue
│   │   │   │
│   │   │   ├── 📁 master-data/
│   │   │   │   ├── 📄 WorkCenters.vue
│   │   │   │   ├── 📄 Suppliers.vue
│   │   │   │   └── 📄 Customers.vue
│   │   │   │
│   │   │   ├── 📁 products/
│   │   │   │   ├── 📄 ProductList.vue
│   │   │   │   ├── 📄 ProductDetail.vue
│   │   │   │   ├── 📄 ProductForm.vue
│   │   │   │   ├── 📄 BOMList.vue
│   │   │   │   └── 📄 RoutingList.vue
│   │   │   │
│   │   │   ├── 📁 planning/
│   │   │   │   ├── 📄 MRP.vue
│   │   │   │   ├── 📄 MRPResults.vue
│   │   │   │   ├── 📄 MPS.vue
│   │   │   │   └── 📄 SalesOrders.vue
│   │   │   │
│   │   │   ├── 📁 stock/
│   │   │   │   ├── 📄 StockList.vue
│   │   │   │   ├── 📄 StockMovements.vue
│   │   │   │   ├── 📄 Inventory.vue
│   │   │   │   └── 📄 Warehouses.vue
│   │   │   │
│   │   │   ├── 📁 production/
│   │   │   │   ├── 📄 ProductionOrders.vue
│   │   │   │   ├── 📄 ProductionDetail.vue
│   │   │   │   ├── 📄 Pointing.vue
│   │   │   │   └── 📄 ProductionBoard.vue
│   │   │   │
│   │   │   ├── 📁 purchase/
│   │   │   │   ├── 📄 PurchaseOrders.vue
│   │   │   │   ├── 📄 Quotations.vue
│   │   │   │   └── 📄 MaterialReceipts.vue
│   │   │   │
│   │   │   ├── 📁 maintenance/
│   │   │   │   ├── 📄 Equipment.vue
│   │   │   │   ├── 📄 MaintenancePlans.vue
│   │   │   │   └── 📄 MaintenanceOrders.vue
│   │   │   │
│   │   │   ├── 📁 quality/
│   │   │   │   ├── 📄 Inspections.vue
│   │   │   │   ├── 📄 NonConformities.vue
│   │   │   │   └── 📄 Certificates.vue
│   │   │   │
│   │   │   └── 📁 reports/
│   │   │       ├── 📄 KPIs.vue
│   │   │       ├── 📄 Reports.vue
│   │   │       └── 📄 Analytics.vue
│   │   │
│   │   ├── 📁 router/              # Vue Router
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 guards.ts
│   │   │   └── 📄 routes.ts
│   │   │
│   │   ├── 📁 stores/              # Pinia stores
│   │   │   ├── 📄 auth.store.ts
│   │   │   ├── 📄 user.store.ts
│   │   │   ├── 📄 product.store.ts
│   │   │   ├── 📄 bom.store.ts
│   │   │   ├── 📄 routing.store.ts
│   │   │   ├── 📄 mrp.store.ts
│   │   │   ├── 📄 stock.store.ts
│   │   │   ├── 📄 production.store.ts
│   │   │   ├── 📄 purchase.store.ts
│   │   │   ├── 📄 maintenance.store.ts
│   │   │   ├── 📄 quality.store.ts
│   │   │   └── 📄 kpi.store.ts
│   │   │
│   │   ├── 📁 services/            # API clients
│   │   │   ├── 📄 api.service.ts   # Axios base
│   │   │   ├── 📄 auth.service.ts
│   │   │   ├── 📄 product.service.ts
│   │   │   ├── 📄 production.service.ts
│   │   │   └── 📄 ...
│   │   │
│   │   ├── 📁 composables/         # Composables Vue
│   │   │   ├── 📄 useAuth.ts
│   │   │   ├── 📄 usePermissions.ts
│   │   │   ├── 📄 useNotification.ts
│   │   │   ├── 📄 usePagination.ts
│   │   │   └── 📄 useForm.ts
│   │   │
│   │   ├── 📁 utils/               # Utilitários
│   │   │   ├── 📄 format.ts
│   │   │   ├── 📄 validation.ts
│   │   │   ├── 📄 date.ts
│   │   │   └── 📄 constants.ts
│   │   │
│   │   ├── 📁 types/               # Tipos TypeScript
│   │   │   ├── 📄 auth.types.ts
│   │   │   ├── 📄 product.types.ts
│   │   │   ├── 📄 production.types.ts
│   │   │   └── 📄 ...
│   │   │
│   │   ├── 📄 App.vue              # Componente raiz
│   │   ├── 📄 main.ts              # Entry point
│   │   └── 📄 style.css            # Estilos globais
│   │
│   ├── 📄 .env.example
│   ├── 📄 .eslintrc.js
│   ├── 📄 .prettierrc
│   ├── 📄 index.html
│   ├── 📄 tsconfig.json
│   ├── 📄 vite.config.ts
│   ├── 📄 tailwind.config.js
│   ├── 📄 package.json
│   └── 📄 README.md
│
├── 📁 docs/                        # Documentação
│   ├── 📄 01_VISAO_GERAL.md
│   ├── 📄 02_MODELO_DADOS.md
│   ├── 📄 03_MODELO_DADOS_PARTE2.md
│   ├── 📄 04_MODELO_DADOS_PARTE3.md
│   ├── 📄 05_APIS_ENDPOINTS.md
│   ├── 📄 06_ROADMAP_IMPLEMENTACAO.md
│   └── 📄 07_ESTRUTURA_PROJETO.md
│
├── 📁 docker/                      # Arquivos Docker
│   ├── 📄 Dockerfile.backend
│   ├── 📄 Dockerfile.frontend
│   └── 📄 nginx.conf
│
├── 📁 scripts/                     # Scripts de automação
│   ├── 📄 setup.sh
│   ├── 📄 deploy.sh
│   └── 📄 backup.sh
│
├── 📄 docker-compose.yml           # Orquestração
├── 📄 docker-compose.dev.yml       # Desenvolvimento
├── 📄 docker-compose.prod.yml      # Produção
├── 📄 .gitignore
├── 📄 .env.example
├── 📄 README.md
└── 📄 LICENSE
```

---

## 📝 Convenções de Nomenclatura

### **Backend**
- **Controllers**: `{entity}.controller.ts` (ex: `product.controller.ts`)
- **Services**: `{entity}.service.ts` (ex: `product.service.ts`)
- **Routes**: `{entity}.routes.ts` (ex: `product.routes.ts`)
- **Validators**: `{entity}.validator.ts`
- **Types**: `{entity}.types.ts`

### **Frontend**
- **Components**: PascalCase (ex: `ProductCard.vue`)
- **Views**: PascalCase (ex: `ProductList.vue`)
- **Stores**: camelCase + `.store.ts` (ex: `product.store.ts`)
- **Services**: camelCase + `.service.ts` (ex: `product.service.ts`)
- **Composables**: `use` + PascalCase (ex: `useAuth.ts`)

---

## 🎯 Próximos Passos

1. Criar estrutura de pastas
2. Configurar package.json (backend e frontend)
3. Implementar schema Prisma completo
4. Configurar Docker Compose
5. Iniciar implementação da Fase 1
