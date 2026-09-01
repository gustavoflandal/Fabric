# Acesso ao Sistema Fabric

## ✅ Status dos Servidores

### Backend
```
✅ Rodando em: http://localhost:3001
✅ PID: 17516
✅ Status: LISTENING em todas as interfaces
```

### Frontend
```
✅ Rodando em: http://localhost:5173
✅ PID: 17052
✅ Status: LISTENING
```

## 🌐 URLs de Acesso

### Frontend (Interface do Usuário)
```
http://localhost:5173
```

**Rotas disponíveis**:
- `/login` - Login
- `/dashboard` - Dashboard principal
- `/users` - Gestão de usuários
- `/roles` - Gestão de perfis
- `/audit-logs` - Logs de auditoria

### Backend (API)
```
http://localhost:3001
```

**Endpoints principais**:
- `GET /health` - Health check
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/users` - Listar usuários
- `GET /api/v1/audit-logs` - Listar logs

## 🔐 Credenciais de Acesso

### Usuário Administrador
```
Email: admin@fabric.com
Senha: admin123
```

## 🚀 Como Acessar

### Opção 1: Navegador Direto

1. Abrir navegador
2. Acessar: `http://localhost:5173`
3. Fazer login com credenciais acima

### Opção 2: Browser Preview (IDE)

1. Clicar no botão "Open in Browser" que apareceu
2. Ou acessar: `http://127.0.0.1:52900`

## 🔍 Verificar se Está Rodando

### Verificar Portas

```powershell
# Frontend (5173)
netstat -ano | findstr :5173

# Backend (3001)
netstat -ano | findstr :3001
```

**Resultado esperado**: Linhas com "LISTENING"

### Testar Backend

```powershell
curl http://localhost:3001/health
```

**Resultado esperado**:
```json
{
  "status": "ok",
  "timestamp": "2024-10-19T..."
}
```

### Testar Frontend

Abrir navegador em: `http://localhost:5173`

**Resultado esperado**: Tela de login

## ⚠️ Problemas Comuns

### 1. "Site não pode ser acessado"

**Causa**: Servidores não estão rodando

**Solução**:
```powershell
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 2. "Connection refused"

**Causa**: Firewall bloqueando

**Solução**:
- Permitir Node.js no firewall
- Verificar antivírus

### 3. "404 Not Found"

**Causa**: Rota não existe

**Solução**:
- Verificar URL digitada
- Usar rotas listadas acima

### 4. "401 Unauthorized"

**Causa**: Token expirado

**Solução**:
- Fazer logout
- Fazer login novamente

## 📊 Monitoramento

### Logs do Backend

Terminal onde rodou `npm run dev` no backend mostra:
```
2025-10-19 21:46:34 [info]: 🚀 Server running on port 3001
2025-10-19 21:46:34 [info]: GET /api/v1/audit-logs
```

### Logs do Frontend

Terminal onde rodou `npm run dev` no frontend mostra:
```
VITE v5.x.x ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

### Console do Navegador

Pressione F12 para ver:
- Erros JavaScript
- Requisições HTTP
- Logs de debug

## 🔄 Reiniciar Servidores

### Se Precisar Reiniciar

**Backend**:
```powershell
# Parar: Ctrl+C no terminal
# Iniciar:
cd backend
npm run dev
```

**Frontend**:
```powershell
# Parar: Ctrl+C no terminal
# Iniciar:
cd frontend
npm run dev
```

## 🌐 Configuração de Rede

### Vite (Frontend)

**Arquivo**: `frontend/vite.config.ts`

```typescript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true
    }
  }
}
```

### Express (Backend)

**Arquivo**: `backend/src/index.ts`

```typescript
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

## 📱 Acesso de Outros Dispositivos

### Expor Frontend na Rede Local

```powershell
cd frontend
npm run dev -- --host
```

**Resultado**:
```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.100:5173/
```

Outros dispositivos na mesma rede podem acessar via IP da rede.

### Expor Backend na Rede Local

Backend já escuta em `0.0.0.0:3001`, acessível por:
```
http://192.168.1.100:3001
```

## 🔒 Segurança

### Desenvolvimento

- ✅ CORS habilitado para localhost
- ✅ Apenas HTTP (não HTTPS)
- ✅ Credenciais em texto claro (dev only)

### Produção

- ⚠️ Usar HTTPS
- ⚠️ Configurar CORS restritivo
- ⚠️ Variáveis de ambiente seguras
- ⚠️ Senhas fortes

## 📚 Estrutura de URLs

### Frontend Routes (Vue Router)

```
/                    → Redirect para /login ou /dashboard
/login               → Página de login
/dashboard           → Dashboard principal
/users               → Gestão de usuários
/users/new           → Criar usuário
/users/:id/edit      → Editar usuário
/roles               → Gestão de perfis
/roles/new           → Criar perfil
/roles/:id/edit      → Editar perfil
/audit-logs          → Logs de auditoria
```

### Backend Routes (Express)

```
GET  /health                        → Health check
POST /api/v1/auth/login            → Login
POST /api/v1/auth/register         → Registro
GET  /api/v1/auth/me               → Dados do usuário logado

GET    /api/v1/users               → Listar usuários
POST   /api/v1/users               → Criar usuário
GET    /api/v1/users/:id           → Buscar usuário
PUT    /api/v1/users/:id           → Atualizar usuário
DELETE /api/v1/users/:id           → Excluir usuário

GET    /api/v1/roles               → Listar perfis
POST   /api/v1/roles               → Criar perfil
GET    /api/v1/roles/:id           → Buscar perfil
PUT    /api/v1/roles/:id           → Atualizar perfil
DELETE /api/v1/roles/:id           → Excluir perfil

GET    /api/v1/audit-logs          → Listar logs
GET    /api/v1/audit-logs/:id      → Buscar log
DELETE /api/v1/audit-logs          → Limpar logs
GET    /api/v1/audit-logs/statistics → Estatísticas
```

## 🎯 Teste Rápido

### 1. Verificar Backend
```powershell
curl http://localhost:3001/health
```

### 2. Verificar Frontend
Abrir: `http://localhost:5173`

### 3. Fazer Login
```
Email: admin@fabric.com
Senha: admin123
```

### 4. Acessar Logs
Clicar em "Logs de Auditoria" no menu

### 5. Testar Filtros
Selecionar datas e aplicar filtros

---

**Status**: ✅ Sistema Rodando  
**Frontend**: http://localhost:5173  
**Backend**: http://localhost:3001  
**Login**: admin@fabric.com / admin123
