# 🔌 Fabric - APIs e Endpoints

## 📋 Visão Geral

API RESTful completa seguindo os mesmos padrões do VagaLume com autenticação JWT, validação Joi, paginação e tratamento de erros.

## 🔐 Autenticação

**Base URL:** `http://localhost:3001/api/v1`

### **Auth Endpoints**
```http
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET  /auth/me
```

## 👥 Usuários e Permissões

```http
GET/POST    /users
GET/PUT/DELETE /users/:id
GET/POST    /roles
GET/PUT/DELETE /roles/:id
GET         /audit-logs
```

## 📦 Cadastros Básicos

```http
# Centros de Trabalho
GET/POST    /work-centers
GET/PUT/DELETE /work-centers/:id
GET         /work-centers/:id/capacity

# Fornecedores e Clientes
GET/POST    /suppliers
GET/PUT/DELETE /suppliers/:id
GET/POST    /customers
GET/PUT/DELETE /customers/:id
```

## 🔧 Engenharia

```http
# Produtos
GET/POST    /products
GET/PUT/DELETE /products/:id
GET         /products/:id/bom
GET         /products/:id/routing

# BOMs
GET/POST    /boms
GET/PUT/DELETE /boms/:id
POST        /boms/:id/items
GET         /boms/:id/explode

# Roteiros
GET/POST    /routings
GET/PUT/DELETE /routings/:id
POST        /routings/:id/operations
```

## 📊 MRP e Planejamento

```http
POST /mrp/run
GET  /mrp/runs
GET  /mrp/runs/:id/requirements
GET  /mrp/runs/:id/purchase-suggestions
GET  /mrp/runs/:id/production-suggestions

GET/POST /mps
GET/POST /sales-orders
```

## 📦 Estoque

```http
GET  /stock
GET  /stock/product/:productId
POST /stock/movements
GET  /stock/movements
POST /stock/reserve

GET/POST /warehouses
GET/POST /inventories
POST /inventories/:id/counts
```

## 🏭 Produção

```http
GET/POST /production-orders
GET/PUT  /production-orders/:id
POST     /production-orders/:id/release
POST     /production-orders/:id/start
POST     /production-orders/:id/complete
POST     /production-orders/:id/pointings
POST     /production-orders/:id/material-consumption
GET      /production-orders/:id/status
```

## 🛒 Compras

```http
GET/POST /purchase-requisitions
GET/POST /purchase-quotations
GET/POST /purchase-orders
GET/PUT  /purchase-orders/:id
POST     /purchase-orders/:id/approve
GET/POST /material-receipts
POST     /material-receipts/:id/inspect
```

## 🛠️ Manutenção

```http
GET/POST /equipment
GET/POST /maintenance-plans
GET/POST /maintenance-orders
POST     /maintenance-orders/:id/start
POST     /maintenance-orders/:id/complete
POST     /maintenance-orders/:id/executions
```

## ✅ Qualidade

```http
GET/POST /inspection-plans
GET/POST /quality-inspections
POST     /quality-inspections/:id/measurements
GET/POST /non-conformities
POST     /non-conformities/:id/corrective-actions
GET/POST /quality-certificates
```

## 📈 Indicadores

```http
GET/POST /kpis
GET      /kpis/:id/values
POST     /kpis/:id/calculate
GET/POST /reports
POST     /reports/:id/execute
GET      /reports/executions/:id/download
GET/POST /dashboards
```

## 📋 Padrões de Resposta

### **Sucesso**
```json
{
  "data": {},
  "message": "Operação realizada com sucesso"
}
```

### **Lista com Paginação**
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

### **Erro**
```json
{
  "error": "Mensagem do erro",
  "code": "ERROR_CODE",
  "details": {}
}
```
