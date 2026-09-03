# Troubleshooting - Fabric PCP

## 🐛 Problemas Comuns e Soluções

### Frontend

#### Modal Fecha Durante Digitação

**Problema**: Modal de formulário fecha sozinho enquanto o usuário está digitando.

**Causa**: 
- `watch` sendo executado múltiplas vezes
- Click no overlay fechando o modal acidentalmente
- Props sendo atualizadas e resetando o formulário

**Solução**:
```typescript
// ❌ ERRADO - Executa sempre que isOpen muda
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    // Reset form
  }
});

// ✅ CORRETO - Só executa quando abre (false -> true)
watch(() => props.isOpen, (newValue, oldValue) => {
  if (newValue && !oldValue) {
    // Reset form apenas ao abrir
  }
});
```

E remover click handler do overlay:
```vue
<!-- ❌ ERRADO -->
<div @click="handleClose">

<!-- ✅ CORRETO -->
<div>
```

#### CORS Error

**Problema**: `Access to XMLHttpRequest has been blocked by CORS policy`

**Causa**: Backend não está aceitando requisições da porta do frontend.

**Solução**:
```typescript
// backend/src/app.ts
app.use(cors({ 
  origin: ['http://localhost:5173', 'http://localhost:5175', 'http://localhost:5174'],
  credentials: true 
}));
```

#### Login Não Funciona

**Problema**: Login não retorna erro mas não redireciona.

**Causa**: Formato de resposta do backend diferente do esperado.

**Solução**:
```typescript
// Backend retorna: { status: 'success', data: {...} }
// Frontend deve acessar: response.data.data

async login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await api.post('/auth/login', credentials)
  return response.data.data // Acessar data.data
}
```

#### Tailwind CSS Não Carrega

**Problema**: Estilos não aparecem, apenas HTML sem formatação.

**Causa**: Falta arquivo `postcss.config.js`.

**Solução**:
```javascript
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

Reiniciar servidor: `npm run dev`

### Backend

#### Erro de Conexão com Banco

**Problema**: `Error: connect ECONNREFUSED 127.0.0.1:3306`

**Causa**: MySQL não está rodando ou credenciais incorretas.

**Solução**:
```bash
# Verificar se MySQL está rodando
docker ps

# Iniciar MySQL
docker-compose up -d mysql

# Verificar logs
docker-compose logs mysql
```

#### Migrations Não Aplicadas

**Problema**: Tabelas não existem no banco.

**Causa**: Migrations não foram executadas.

**Solução**:
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

#### Seed Não Funciona

**Problema**: Usuário admin não existe.

**Causa**: Seed não foi executado.

**Solução**:
```bash
cd backend
npm run seed
```

#### JWT Token Inválido

**Problema**: `401 Unauthorized` em todas requisições.

**Causa**: Token expirado ou JWT_SECRET diferente.

**Solução**:
1. Fazer logout e login novamente
2. Verificar `.env` do backend tem `JWT_SECRET` correto
3. Limpar localStorage do navegador

### Docker

#### Container Não Inicia

**Problema**: `docker-compose up` falha.

**Causa**: Porta já em uso ou erro no Dockerfile.

**Solução**:
```bash
# Verificar portas em uso
netstat -ano | findstr :3306
netstat -ano | findstr :3005

# Parar todos containers
docker-compose down

# Rebuild
docker-compose up --build
```

#### Volume Permissions

**Problema**: Erro de permissão no volume do MySQL.

**Solução**:
```bash
# Remover volumes
docker-compose down -v

# Recriar
docker-compose up -d
```

## 🔍 Debug Tips

### Frontend

#### Console Logs
```typescript
// Adicionar logs temporários
console.log('AuthStore: Chamando login...', credentials)
console.log('Resposta:', response)
console.error('Erro:', error)
```

#### Vue DevTools
- Instalar extensão Vue DevTools
- Inspecionar state do Pinia
- Ver props e emits dos componentes

#### Network Tab
- Abrir DevTools > Network
- Verificar requisições
- Ver status codes
- Inspecionar payloads

### Backend

#### Logger
```typescript
import { logger } from './config/logger';

logger.info('Processando login', { email });
logger.error('Erro ao criar usuário', { error });
logger.debug('Query executada', { sql, params });
```

#### Prisma Studio
```bash
cd backend
npx prisma studio
```
Abre interface web para visualizar dados.

#### Logs do Container
```bash
docker-compose logs -f backend
docker-compose logs -f mysql
```

## 📊 Checklist de Verificação

### Antes de Reportar Bug

- [ ] Verificar console do navegador
- [ ] Verificar Network tab
- [ ] Verificar logs do backend
- [ ] Tentar em modo anônimo
- [ ] Limpar cache e localStorage
- [ ] Verificar se backend está rodando
- [ ] Verificar se banco está acessível
- [ ] Verificar variáveis de ambiente

### Setup Inicial

- [ ] Docker instalado
- [ ] Node.js 18+ instalado
- [ ] MySQL rodando (via Docker)
- [ ] Backend rodando na porta 3005
- [ ] Frontend rodando na porta 5173/5175
- [ ] Migrations aplicadas
- [ ] Seed executado
- [ ] CORS configurado

## 🚨 Erros Críticos

### "Cannot read property of undefined"

**Causa**: Tentando acessar propriedade de objeto que não existe.

**Solução**: Usar optional chaining
```typescript
// ❌ ERRADO
user.roles.map(r => r.id)

// ✅ CORRETO
user?.roles?.map(r => r.id) || []
```

### "Maximum call stack size exceeded"

**Causa**: Loop infinito ou recursão sem fim.

**Solução**: Verificar watchers e computed properties
```typescript
// ❌ ERRADO - Loop infinito
watch(() => state.value, () => {
  state.value = newValue // Dispara watch novamente
})

// ✅ CORRETO
watch(() => state.value, () => {
  // Não modifica state aqui
})
```

### "EADDRINUSE: address already in use"

**Causa**: Porta já está sendo usada.

**Solução**:
```bash
# Windows
netstat -ano | findstr :3005
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3005 | xargs kill -9
```

## 📞 Suporte

Se o problema persistir:

1. Verificar documentação em `/docs`
2. Verificar logs completos
3. Criar issue com:
   - Descrição do problema
   - Passos para reproduzir
   - Logs relevantes
   - Screenshots se aplicável

---

**Última atualização**: 19/10/2024  
**Versão**: 1.0
