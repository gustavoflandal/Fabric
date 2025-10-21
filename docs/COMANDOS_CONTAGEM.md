# 📋 Comandos - Módulo de Contagem de Estoque

## 🗄️ Banco de Dados

### **1. Criar Migration**
```bash
cd backend
npx prisma migrate dev --name add_counting_module
```

### **2. Gerar Prisma Client**
```bash
npx prisma generate
```

### **3. Visualizar Banco (Prisma Studio)**
```bash
npx prisma studio
```

---

## 🌱 Seeds

### **1. Popular Localizações**
```bash
npm run prisma:seed-locations
```

### **2. Popular Planos de Contagem**
```bash
npm run prisma:seed-counting
```

---

## 🚀 Executar Aplicação

### **Backend**
```bash
cd backend
npm run dev
```

### **Frontend**
```bash
cd frontend
npm run dev
```

---

## 🧪 Testar Endpoints

### **Planos de Contagem**
```bash
# Listar planos
GET http://localhost:3000/api/counting/plans

# Criar plano
POST http://localhost:3000/api/counting/plans
{
  "name": "Contagem Cíclica - Produtos Críticos",
  "type": "CYCLIC",
  "frequency": "WEEKLY",
  "criteria": {
    "criticality": ["HIGH", "CRITICAL"]
  }
}

# Ativar plano
PATCH http://localhost:3000/api/counting/plans/:id/activate
```

### **Sessões de Contagem**
```bash
# Listar sessões
GET http://localhost:3000/api/counting/sessions

# Iniciar sessão
POST http://localhost:3000/api/counting/sessions/:id/start

# Completar sessão
POST http://localhost:3000/api/counting/sessions/:id/complete
```

### **Itens de Contagem**
```bash
# Listar itens de uma sessão
GET http://localhost:3000/api/counting/sessions/:sessionId/items

# Contar item
POST http://localhost:3000/api/counting/items/:id/count
{
  "countedQty": 485,
  "notes": "Contagem física realizada"
}

# Recontar item
POST http://localhost:3000/api/counting/items/:id/recount
{
  "recountQty": 485
}
```

---

## 📊 Relatórios

```bash
# Dashboard de contagens
GET http://localhost:3000/api/counting/dashboard

# Relatório de divergências
GET http://localhost:3000/api/counting/sessions/:id/report

# Exportar PDF
GET http://localhost:3000/api/counting/sessions/:id/export/pdf
```

---

## 🔧 Utilitários

### **Resetar Módulo de Contagem**
```bash
# Limpar todas as contagens (manter estrutura)
npm run prisma:reset-counting
```

### **Verificar Permissões**
```bash
# Listar permissões do módulo
npm run check-permissions counting
```

---

## 📱 Acessar Telas

```
Dashboard: http://localhost:5173/counting/dashboard
Planos: http://localhost:5173/counting/plans
Nova Contagem: http://localhost:5173/counting/plans/new
Executar: http://localhost:5173/counting/sessions/:id/execute
Relatórios: http://localhost:5173/counting/reports
```

---

**Ordem de Execução Recomendada:**

1. ✅ Criar migration
2. ✅ Gerar Prisma Client
3. ✅ Popular localizações
4. ✅ Popular planos de teste
5. ✅ Iniciar backend
6. ✅ Iniciar frontend
7. ✅ Acessar dashboard
