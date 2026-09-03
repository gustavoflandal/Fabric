# 🚀 Guia de Setup - Fabric PCP

## ✅ Estrutura Criada

O projeto Fabric foi inicializado com sucesso! Aqui está o que foi criado:

### **📁 Estrutura de Pastas**

```
Fabric/
├── backend/                    # API Node.js + TypeScript
│   ├── src/
│   │   ├── config/            # Configurações (env, database, logger)
│   │   ├── middleware/        # Middlewares (auth, error)
│   │   ├── app.ts             # Configuração Express
│   │   └── server.ts          # Entry point
│   ├── prisma/
│   │   └── schema.prisma      # Schema do banco (parcial)
│   ├── package.json
│   ├── tsconfig.json
│   └── .eslintrc.js
│
├── frontend/                   # SPA Vue 3 + TypeScript
│   ├── src/
│   │   ├── router/            # Vue Router
│   │   ├── views/             # Views
│   │   ├── App.vue
│   │   ├── main.ts
│   │   └── style.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── index.html
│
├── docs/                       # Documentação completa
│   ├── 01_VISAO_GERAL.md
│   ├── 02_MODELO_DADOS.md
│   ├── 03_MODELO_DADOS_PARTE2.md
│   ├── 04_MODELO_DADOS_PARTE3.md
│   ├── 05_APIS_ENDPOINTS.md
│   ├── 06_ROADMAP_IMPLEMENTACAO.md
│   └── 07_ESTRUTURA_PROJETO.md
│
├── .gitignore
├── .env.example
├── docker-compose.yml
├── README.md
└── README_PROMPT.md
```

## 🎯 Próximos Passos

### **1. Configurar Ambiente Local**

```powershell
# 1. Criar arquivo .env
Copy-Item .env.example backend\.env

# 2. Editar backend\.env e configurar:
# - DATABASE_URL (MySQL)
# - JWT_SECRET
# - JWT_REFRESH_SECRET
```

### **2. Instalar Dependências**

```powershell
# Backend
cd backend
npm install

# Frontend (em outro terminal)
cd frontend
npm install
```

### **3. Configurar Banco de Dados**

```powershell
# Certifique-se que o MySQL está rodando

# Criar banco de dados
mysql -u root -p
CREATE DATABASE fabric CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit

# Gerar Prisma Client
cd backend
npm run prisma:generate

# Executar migrations (quando estiverem prontas)
npm run prisma:migrate
```

### **4. Iniciar Desenvolvimento**

```powershell
# Terminal 1 - Backend
cd backend
npm run dev
# Servidor em: http://localhost:3001

# Terminal 2 - Frontend
cd frontend
npm run dev
# Aplicação em: http://localhost:5173
```

### **5. Verificar Funcionamento**

- **Backend Health Check**: http://localhost:3001/health
- **Backend API**: http://localhost:3001/api/v1
- **Frontend**: http://localhost:5173

## 📋 O Que Falta Implementar

### **Backend - Fase 1 (Próximos Passos)**

- [ ] Completar schema Prisma com todas as entidades
- [ ] Implementar AuthService e AuthController
- [ ] Implementar UserService e UserController
- [ ] Criar rotas de autenticação
- [ ] Implementar validadores Joi
- [ ] Criar seeds para dados iniciais
- [ ] Implementar testes unitários

### **Frontend - Fase 1**

- [ ] Criar AuthStore (Pinia)
- [ ] Criar AuthService (API client)
- [ ] Implementar views de Login/Register
- [ ] Criar componentes base (Button, Input, Modal)
- [ ] Implementar route guards
- [ ] Criar layout principal
- [ ] Configurar interceptor Axios

### **Infraestrutura**

- [ ] Configurar GitHub Actions (CI/CD)
- [ ] Criar Dockerfiles
- [ ] Configurar testes automatizados
- [ ] Documentar APIs com Swagger

## 🐳 Opção: Usar Docker

```powershell
# Iniciar todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar serviços
docker-compose down
```

**Armadilha ao adicionar dependência nova (`npm install` em `frontend/` ou `backend/`):** `docker-compose.yml` declara `/app/node_modules` como volume anônimo, de propósito (evita `node_modules` do host, compilado pra Windows, vazar pra dentro do container Linux). Consequência: esse volume **sobrevive a `docker compose build`** — a imagem fica com o `node_modules` novo, mas o container recriado continua montando o volume antigo por cima, escondendo a dependência nova. Sintoma: `Cannot find package 'X'` mesmo depois de rebuildar. Confirmado em 02/09/2026 com o `fabric-frontend` (Vitest instalado no host, container em crash-loop até isso ser corrigido). Correção:

```powershell
docker compose build <servico>
docker compose rm -f -s -v <servico>   # -v remove o volume anonimo orfao
docker compose up -d <servico>
```

`docker compose up -d --build <servico>` sozinho **não resolve** — precisa do `rm -v` no meio.

## 📚 Documentação

Toda a documentação técnica está na pasta `docs/`:

1. **Visão Geral** - Arquitetura e tecnologias
2. **Modelo de Dados** - Schema Prisma completo (3 partes)
3. **APIs e Endpoints** - Especificação da API RESTful
4. **Roadmap** - Plano de implementação em 4 fases
5. **Estrutura** - Organização de pastas e arquivos

## 🔧 Comandos Úteis

### **Backend**

```powershell
npm run dev          # Desenvolvimento
npm run build        # Build produção
npm run start        # Executar produção
npm run lint         # Verificar código
npm run prisma:studio # Abrir Prisma Studio
```

### **Frontend**

```powershell
npm run dev          # Desenvolvimento
npm run build        # Build produção
npm run preview      # Preview do build
npm run lint         # Verificar código
```

### **Git**

```powershell
git status           # Ver status
git add .            # Adicionar arquivos
git commit -m "msg"  # Commit
git push             # Enviar para GitHub
```

## 🎉 Status Atual

✅ Repositório Git inicializado  
✅ Estrutura de pastas criada  
✅ Configurações do projeto  
✅ Backend base implementado  
✅ Frontend base implementado  
✅ Schema Prisma parcial  
✅ Docker Compose configurado  
✅ Documentação completa  
✅ Primeiro commit realizado  

## 🚀 Começar a Desenvolver

Agora você pode:

1. **Instalar dependências** (backend e frontend)
2. **Configurar banco de dados**
3. **Iniciar servidores de desenvolvimento**
4. **Começar implementação da Fase 1**

Consulte o **Roadmap** (`docs/06_ROADMAP_IMPLEMENTACAO.md`) para ver o plano detalhado de implementação!
