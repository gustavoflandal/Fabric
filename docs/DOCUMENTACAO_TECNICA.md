# 🔧 Documentação Técnica - Sistema MES Fabric

**Versão**: 1.0.0  
**Data**: 20 de Outubro de 2025

---

## 📋 Índice

1. [Arquitetura do Sistema](#arquitetura)
2. [Estrutura de Pastas](#estrutura)
3. [API Endpoints](#api)
4. [Modelos de Dados](#modelos)
5. [Fluxos de Trabalho](#fluxos)
6. [Configuração](#configuracao)

---

## 🏗️ Arquitetura do Sistema {#arquitetura}

### **Visão Geral**

```
┌─────────────────────────────────────────────┐
│         CAMADA DE APRESENTAÇÃO              │
│              (Vue 3 + Vite)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Views   │  │  Stores  │  │ Services │  │
│  └──────────┘  └──────────┘  └──────────┘  │
└──────────────────┬──────────────────────────┘
                   │ HTTP/REST (Axios)
┌──────────────────▼──────────────────────────┐
│         CAMADA DE APLICAÇÃO                 │
│           (Express + TypeScript)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Routes  │→ │Controller│→ │ Service  │  │
│  └──────────┘  └──────────┘  └────┬─────┘  │
│                                    │        │
│  ┌──────────┐  ┌──────────┐      │        │
│  │Validator │  │Middleware│      │        │
│  └──────────┘  └──────────┘      │        │
└───────────────────────────────────┼────────┘
                                    │
┌───────────────────────────────────▼────────┐
│         CAMADA DE DADOS                    │
│         (Prisma ORM + PostgreSQL)          │
└────────────────────────────────────────────┘
```

### **Padrões Utilizados**

- **MVC** (Model-View-Controller)
- **Repository Pattern** (via Prisma)
- **Dependency Injection**
- **Middleware Pattern**
- **RESTful API**

---

## 📁 Estrutura de Pastas {#estrutura}

### **Backend**

```
backend/
├── prisma/
│   ├── schema.prisma          # Schema do banco
│   ├── migrations/            # Migrations
│   └── seed.ts               # Dados de teste
├── src/
│   ├── config/
│   │   └── database.ts       # Configuração Prisma
│   ├── controllers/          # Controllers (16)
│   │   ├── auth.controller.ts
│   │   ├── user.controller.ts
│   │   ├── product.controller.ts
│   │   ├── bom.controller.ts
│   │   ├── routing.controller.ts
│   │   ├── production-order.controller.ts
│   │   ├── production-pointing.controller.ts
│   │   ├── dashboard.controller.ts
│   │   └── ...
│   ├── services/             # Business Logic (16)
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── product.service.ts
│   │   ├── bom.service.ts
│   │   ├── routing.service.ts
│   │   ├── production-order.service.ts
│   │   ├── production-pointing.service.ts
│   │   ├── dashboard.service.ts
│   │   └── ...
│   ├── validators/           # Joi Schemas (13)
│   │   ├── auth.validator.ts
│   │   ├── user.validator.ts
│   │   ├── product.validator.ts
│   │   ├── bom.validator.ts
│   │   ├── routing.validator.ts
│   │   ├── production-order.validator.ts
│   │   ├── production-pointing.validator.ts
│   │   └── ...
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── permission.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── error.middleware.ts
│   ├── routes/               # Rotas (16)
│   │   ├── index.ts
│   │   ├── auth.routes.ts
│   │   ├── user.routes.ts
│   │   ├── product.routes.ts
│   │   ├── bom.routes.ts
│   │   ├── routing.routes.ts
│   │   ├── production-order.routes.ts
│   │   ├── production-pointing.routes.ts
│   │   ├── dashboard.routes.ts
│   │   └── ...
│   └── server.ts             # Entry point
├── .env                      # Variáveis de ambiente
└── package.json
```

### **Frontend**

```
frontend/
├── src/
│   ├── assets/               # Imagens, fontes
│   ├── components/
│   │   ├── common/           # Componentes reutilizáveis
│   │   │   ├── Button.vue
│   │   │   ├── Card.vue
│   │   │   ├── Input.vue
│   │   │   └── ...
│   │   ├── products/
│   │   │   ├── BomManagerModal.vue
│   │   │   └── RoutingManagerModal.vue
│   │   ├── production/
│   │   │   └── ProductionOrderDetailsModal.vue
│   │   └── roles/
│   │       └── PermissionsModal.vue
│   ├── services/             # HTTP Clients (16)
│   │   ├── api.service.ts
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── product.service.ts
│   │   ├── bom.service.ts
│   │   ├── routing.service.ts
│   │   ├── production-order.service.ts
│   │   ├── production-pointing.service.ts
│   │   ├── dashboard.service.ts
│   │   └── ...
│   ├── stores/               # Pinia Stores (10)
│   │   ├── auth.store.ts
│   │   ├── user.store.ts
│   │   ├── product.store.ts
│   │   ├── bom.store.ts
│   │   ├── routing.store.ts
│   │   ├── production-order.store.ts
│   │   ├── production-pointing.store.ts
│   │   └── ...
│   ├── views/                # Páginas (15+)
│   │   ├── LoginView.vue
│   │   ├── DashboardView.vue
│   │   ├── users/
│   │   │   └── UsersListView.vue
│   │   ├── roles/
│   │   │   └── RolesListView.vue
│   │   ├── products/
│   │   │   └── ProductsView.vue
│   │   ├── production/
│   │   │   ├── ProductionOrdersView.vue
│   │   │   └── ProductionPointingsView.vue
│   │   └── ...
│   ├── router/
│   │   └── index.ts          # Rotas do Vue Router
│   ├── App.vue
│   └── main.ts
├── .env                      # Variáveis de ambiente
└── package.json
```

---

## 🌐 API Endpoints {#api}

### **Base URL**: `http://localhost:3000/api`

### **Autenticação**
```
POST   /auth/login           - Login
POST   /auth/refresh         - Refresh token
POST   /auth/logout          - Logout
GET    /auth/me              - Dados do usuário logado
```

### **Usuários**
```
GET    /users                - Listar usuários
GET    /users/:id            - Buscar usuário
POST   /users                - Criar usuário
PUT    /users/:id            - Atualizar usuário
DELETE /users/:id            - Excluir usuário
PATCH  /users/:id/toggle-active - Ativar/Desativar
```

### **Perfis**
```
GET    /roles                - Listar perfis
GET    /roles/:id            - Buscar perfil
POST   /roles                - Criar perfil
PUT    /roles/:id            - Atualizar perfil
DELETE /roles/:id            - Excluir perfil
POST   /roles/:id/permissions - Atribuir permissões
```

### **Permissões**
```
GET    /permissions          - Listar todas
GET    /permissions/available - Permissões disponíveis
```

### **Produtos**
```
GET    /products             - Listar produtos
GET    /products/:id         - Buscar produto
POST   /products             - Criar produto
PUT    /products/:id         - Atualizar produto
DELETE /products/:id         - Excluir produto
PATCH  /products/:id/toggle-active - Ativar/Desativar
```

### **BOMs**
```
GET    /boms                 - Listar BOMs
GET    /boms/:id             - Buscar BOM
GET    /boms/product/:productId - BOMs de um produto
POST   /boms                 - Criar BOM
PUT    /boms/:id             - Atualizar BOM
DELETE /boms/:id             - Excluir BOM
PATCH  /boms/:id/activate    - Ativar BOM
GET    /boms/:id/explode     - Explodir BOM
POST   /boms/:id/calculate-requirements - Calcular necessidades
```

### **Roteiros**
```
GET    /routings             - Listar roteiros
GET    /routings/:id         - Buscar roteiro
GET    /routings/product/:productId - Roteiros de um produto
POST   /routings             - Criar roteiro
PUT    /routings/:id         - Atualizar roteiro
DELETE /routings/:id         - Excluir roteiro
PATCH  /routings/:id/activate - Ativar roteiro
GET    /routings/:id/operations - Operações do roteiro
POST   /routings/:id/calculate-time - Calcular tempo total
```

### **Ordens de Produção**
```
GET    /production-orders    - Listar ordens
GET    /production-orders/:id - Buscar ordem
POST   /production-orders    - Criar ordem
PUT    /production-orders/:id - Atualizar ordem
DELETE /production-orders/:id - Excluir ordem
PATCH  /production-orders/:id/status - Mudar status
PATCH  /production-orders/:id/progress - Atualizar progresso
GET    /production-orders/:id/materials - Materiais da ordem
GET    /production-orders/:id/operations - Operações da ordem
```

### **Apontamentos**
```
GET    /production-pointings - Listar apontamentos
GET    /production-pointings/:id - Buscar apontamento
GET    /production-pointings/my-pointings - Meus apontamentos
GET    /production-pointings/order/:orderId - Por ordem
GET    /production-pointings/operator/:userId - Por operador
POST   /production-pointings - Criar apontamento
PUT    /production-pointings/:id - Atualizar apontamento
PATCH  /production-pointings/:id/finish - Finalizar apontamento
DELETE /production-pointings/:id - Excluir apontamento
```

### **Dashboard**
```
GET    /dashboard/statistics - Estatísticas gerais
GET    /dashboard/production-metrics - Métricas de produção
GET    /dashboard/work-center-metrics - Métricas por centro
GET    /dashboard/top-products - Top produtos
GET    /dashboard/recent-activity - Atividades recentes
GET    /dashboard/production-trend - Tendência de produção
```

### **Outros Módulos**
```
# Unidades de Medida
GET/POST/PUT/DELETE /units-of-measure

# Categorias
GET/POST/PUT/DELETE /product-categories

# Centros de Trabalho
GET/POST/PUT/DELETE /work-centers

# Fornecedores
GET/POST/PUT/DELETE /suppliers

# Clientes
GET/POST/PUT/DELETE /customers

# Logs de Auditoria
GET    /audit-logs
DELETE /audit-logs/:id
```

---

## 📊 Modelos de Dados {#modelos}

### **User**
```typescript
{
  id: string (uuid)
  email: string (unique)
  password: string (hashed)
  name: string
  active: boolean
  createdAt: Date
  updatedAt: Date
  roles: Role[]
}
```

### **Product**
```typescript
{
  id: string (uuid)
  code: string (unique)
  name: string
  description?: string
  type: 'FINISHED_GOOD' | 'SEMI_FINISHED' | 'RAW_MATERIAL' | 'PACKAGING'
  unitOfMeasureId: string
  categoryId?: string
  active: boolean
  minStock: number
  maxStock: number
  standardCost: number
  lastCost: number
  averageCost: number
  createdAt: Date
  updatedAt: Date
}
```

### **BOM**
```typescript
{
  id: string (uuid)
  productId: string
  version: number
  description?: string
  active: boolean
  validFrom: Date
  validTo?: Date
  createdAt: Date
  updatedAt: Date
  items: BOMItem[]
}
```

### **BOMItem**
```typescript
{
  id: string (uuid)
  bomId: string
  componentId: string
  quantityPer: number
  scrapFactor: number
  sequence: number
}
```

### **Routing**
```typescript
{
  id: string (uuid)
  productId: string
  version: number
  description?: string
  active: boolean
  validFrom: Date
  validTo?: Date
  createdAt: Date
  updatedAt: Date
  operations: RoutingOperation[]
}
```

### **RoutingOperation**
```typescript
{
  id: string (uuid)
  routingId: string
  sequence: number
  workCenterId: string
  description: string
  setupTime: number (minutes)
  runTime: number (minutes per unit)
  queueTime: number
  moveTime: number
}
```

### **ProductionOrder**
```typescript
{
  id: string (uuid)
  orderNumber: string (unique)
  productId: string
  quantity: number
  producedQty: number
  scrapQty: number
  status: 'PLANNED' | 'RELEASED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  priority: number (1-10)
  scheduledStart: Date
  scheduledEnd: Date
  actualStart?: Date
  actualEnd?: Date
  notes?: string
  createdAt: Date
  updatedAt: Date
  materials: ProductionOrderMaterial[]
  operations: ProductionOrderOperation[]
}
```

### **ProductionPointing**
```typescript
{
  id: string (uuid)
  productionOrderId: string
  operationId: string
  userId: string
  quantityGood: number
  quantityScrap: number
  setupTime: number
  runTime: number
  startTime: Date
  endTime: Date
  notes?: string
  createdAt: Date
}
```

---

## 🔄 Fluxos de Trabalho {#fluxos}

### **Fluxo 1: Criação de Ordem de Produção**

```
1. Usuário seleciona produto
   ↓
2. Sistema busca BOM ativa do produto
   ↓
3. Sistema calcula materiais necessários
   (quantidade × quantityPer × (1 + scrapFactor))
   ↓
4. Sistema busca Routing ativo do produto
   ↓
5. Sistema calcula operações necessárias
   (setupTime + (runTime × quantidade))
   ↓
6. Ordem criada com status PLANNED
   ↓
7. Materiais e operações associados à ordem
```

### **Fluxo 2: Execução de Produção**

```
1. Gerente libera ordem (PLANNED → RELEASED)
   ↓
2. Operador inicia produção (RELEASED → IN_PROGRESS)
   - Sistema registra actualStart
   ↓
3. Para cada operação:
   a. Operador cria apontamento
   b. Registra início e fim
   c. Aponta quantidade boa e refugo
   d. Sistema atualiza progresso da operação
   ↓
4. Sistema atualiza progresso da ordem
   (menor quantidade entre todas as operações)
   ↓
5. Ao atingir 100%:
   - Sistema muda status para COMPLETED
   - Registra actualEnd
```

### **Fluxo 3: Mudança de Status**

```
PLANNED
  ↓ (Liberar)
RELEASED
  ↓ (Iniciar)
IN_PROGRESS
  ↓ (Concluir ou Auto ao 100%)
COMPLETED

Qualquer status → CANCELLED (Cancelar)
```

---

## ⚙️ Configuração {#configuracao}

### **Variáveis de Ambiente - Backend**

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fabric"

# JWT
JWT_SECRET="your-secret-key-minimum-32-characters"
JWT_REFRESH_SECRET="your-refresh-secret-minimum-32-characters"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN="http://localhost:5173"
```

### **Variáveis de Ambiente - Frontend**

```env
# API
VITE_API_URL=http://localhost:3000/api
```

### **Scripts Disponíveis**

**Backend:**
```bash
npm run dev              # Desenvolvimento
npm run build            # Build para produção
npm run start            # Iniciar produção
npm run prisma:migrate   # Executar migrations
npm run prisma:seed      # Popular banco
npm run prisma:studio    # Abrir Prisma Studio
```

**Frontend:**
```bash
npm run dev              # Desenvolvimento
npm run build            # Build para produção
npm run preview          # Preview do build
npm run lint             # Lint do código
```

---

## 🔐 Autenticação e Autorização

### **Fluxo de Autenticação**

```
1. POST /auth/login
   - Valida credenciais
   - Gera access token (1h)
   - Gera refresh token (7d)
   - Retorna tokens + dados do usuário

2. Requisições subsequentes
   - Header: Authorization: Bearer {access_token}
   - Middleware valida token
   - Extrai userId do token
   - Disponibiliza em req.userId

3. Token expira
   - Frontend detecta erro 401
   - POST /auth/refresh com refresh_token
   - Recebe novo access_token
   - Retenta requisição original

4. Logout
   - POST /auth/logout
   - Invalida tokens
   - Remove do localStorage
```

### **Verificação de Permissões**

```typescript
// Middleware de permissão
requirePermission('products', 'create')

// Verifica se usuário tem permissão
// Através dos perfis atribuídos
// Bloqueia acesso se não tiver
```

---

## 📈 Performance

### **Otimizações Implementadas**

1. **Queries Otimizadas**
   - Prisma com `include` seletivo
   - Apenas campos necessários

2. **Índices no Banco**
   - Campos de busca frequente
   - Chaves estrangeiras
   - Campos únicos

3. **Paginação**
   - Todas as listagens paginadas
   - Limite padrão: 100 itens

4. **Cache (Preparado)**
   - Redis pode ser adicionado
   - Cache de permissões
   - Cache de estatísticas

---

## 🧪 Testes

### **Testes Manuais Realizados**

✅ Login e autenticação  
✅ Criação de usuários  
✅ Atribuição de permissões  
✅ CRUD de produtos  
✅ Criação de BOMs multiníveis  
✅ Explosão de BOM  
✅ Criação de roteiros  
✅ Cálculo de tempos  
✅ Criação de ordens  
✅ Mudança de status  
✅ Atualização de progresso  
✅ Dashboard com dados reais  

### **Testes Automatizados (Sugeridos)**

```bash
# Backend
npm run test              # Unit tests
npm run test:e2e          # E2E tests
npm run test:coverage     # Coverage

# Frontend
npm run test:unit         # Unit tests
npm run test:e2e          # E2E tests (Playwright)
```

---

## 📝 Logs e Monitoramento

### **Logs Implementados**

- **Auditoria**: Todas as ações de escrita
- **Erros**: Middleware de erro centralizado
- **Acesso**: Logs de autenticação

### **Monitoramento (Sugerido)**

- **APM**: New Relic, Datadog
- **Logs**: ELK Stack, CloudWatch
- **Métricas**: Prometheus + Grafana

---

## 🚀 Deploy

### **Produção - Checklist**

- [ ] Configurar variáveis de ambiente
- [ ] Configurar banco de dados PostgreSQL
- [ ] Executar migrations
- [ ] Configurar HTTPS
- [ ] Configurar CORS
- [ ] Configurar rate limiting
- [ ] Configurar backup do banco
- [ ] Configurar monitoramento
- [ ] Configurar CI/CD

### **Plataformas Sugeridas**

**Backend:**
- Heroku
- AWS (EC2, ECS, Lambda)
- DigitalOcean
- Railway

**Frontend:**
- Vercel
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

**Banco de Dados:**
- AWS RDS
- Heroku Postgres
- DigitalOcean Managed Database
- Supabase

---

**Documentação Técnica Completa** ✅

*Última atualização: 20 de Outubro de 2025*
