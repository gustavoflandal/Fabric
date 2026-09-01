# Configuração de Audit Logs

## 🎯 Melhorias Implementadas

### 1. Grid Recarrega Após Exclusão ✅

**Problema**: Após excluir logs, o grid não atualizava

**Solução**: 
- Limpa os filtros automaticamente
- Recarrega logs e estatísticas
- Grid mostra estado atualizado

### 2. Controle de Captura de Logs ✅

**Problema**: Sistema capturava muitos logs desnecessários

**Solução**: Configuração flexível via variáveis de ambiente

## ⚙️ Configuração

### Arquivo: `.env`

```env
# Audit Logs Configuration
# Tipos de logs a capturar: all, write_only, errors_only, none
AUDIT_LOG_MODE=write_only

# Se true, loga também operações GET (apenas no modo 'all')
AUDIT_LOG_INCLUDE_READS=false
```

## 📋 Modos de Auditoria

### 1. `write_only` (Padrão - Recomendado)

**Captura**:
- ✅ POST (Criações)
- ✅ PUT/PATCH (Atualizações)
- ✅ DELETE (Exclusões)
- ✅ Erros (status >= 400)

**NÃO Captura**:
- ❌ GET bem-sucedidos (Leituras)

**Uso**: Produção - Captura apenas mudanças importantes

**Exemplo**:
```
✅ POST /api/v1/users (criar usuário)
✅ PUT /api/v1/users/123 (atualizar usuário)
✅ DELETE /api/v1/users/123 (excluir usuário)
❌ GET /api/v1/users (listar usuários)
✅ GET /api/v1/users/999 → 404 (erro)
```

### 2. `errors_only`

**Captura**:
- ✅ Apenas erros (status >= 400)

**NÃO Captura**:
- ❌ Operações bem-sucedidas

**Uso**: Monitoramento de erros apenas

**Exemplo**:
```
❌ POST /api/v1/users → 200 (sucesso)
✅ POST /api/v1/users → 400 (erro validação)
✅ GET /api/v1/users/999 → 404 (não encontrado)
✅ POST /api/v1/auth/login → 401 (não autorizado)
```

### 3. `all`

**Captura**:
- ✅ Todas operações de escrita
- ✅ Todos os erros
- ✅ Leituras (se `AUDIT_LOG_INCLUDE_READS=true`)

**Uso**: Desenvolvimento ou auditoria completa

**Exemplo com `AUDIT_LOG_INCLUDE_READS=false`**:
```
✅ POST /api/v1/users
✅ PUT /api/v1/users/123
✅ DELETE /api/v1/users/123
❌ GET /api/v1/users
✅ GET /api/v1/users/999 → 404
```

**Exemplo com `AUDIT_LOG_INCLUDE_READS=true`**:
```
✅ POST /api/v1/users
✅ PUT /api/v1/users/123
✅ DELETE /api/v1/users/123
✅ GET /api/v1/users (também loga leituras)
✅ GET /api/v1/users/123
```

### 4. `none`

**Captura**:
- ❌ Nada

**Uso**: Desabilitar auditoria completamente

**Exemplo**:
```
❌ POST /api/v1/users
❌ GET /api/v1/users
❌ Qualquer operação
```

## 🚀 Como Usar

### Desenvolvimento (Capturar Tudo)

```env
AUDIT_LOG_MODE=all
AUDIT_LOG_INCLUDE_READS=true
```

### Produção (Recomendado)

```env
AUDIT_LOG_MODE=write_only
AUDIT_LOG_INCLUDE_READS=false
```

### Apenas Erros

```env
AUDIT_LOG_MODE=errors_only
```

### Desabilitar

```env
AUDIT_LOG_MODE=none
```

## 📊 Comparação de Volume

### Cenário: 10.000 requisições/dia

| Modo | Logs/dia | % do Total | Uso |
|------|----------|------------|-----|
| `none` | 0 | 0% | Sem auditoria |
| `errors_only` | ~100 | 1% | Apenas problemas |
| `write_only` | ~2.500 | 25% | **Recomendado** |
| `all` (reads=false) | ~2.500 | 25% | Igual write_only |
| `all` (reads=true) | ~10.000 | 100% | Tudo |

## 🔧 Implementação

### 1. Variáveis de Ambiente

**Arquivo**: `backend/src/config/env.ts`

```typescript
export const config = {
  // ...
  audit: {
    mode: process.env.AUDIT_LOG_MODE || 'write_only',
    includeReads: process.env.AUDIT_LOG_INCLUDE_READS === 'true',
  },
};
```

### 2. Middleware de Auditoria

**Arquivo**: `backend/src/middleware/audit.middleware.ts`

```typescript
// Verificar modo de auditoria
if (config.audit.mode === 'none') {
  return; // Não logar nada
}

const isReadOperation = req.method === 'GET';
const isError = res.statusCode >= 400;
const isWriteOperation = !isReadOperation;

// Modo: errors_only
if (config.audit.mode === 'errors_only' && !isError) {
  return;
}

// Modo: write_only
if (config.audit.mode === 'write_only') {
  if (isReadOperation && !isError) {
    return;
  }
}

// Modo: all
if (config.audit.mode === 'all') {
  if (isReadOperation && !config.audit.includeReads && !isError) {
    return;
  }
}
```

### 3. Frontend - Reload Após Exclusão

**Arquivo**: `frontend/src/views/audit/AuditLogsView.vue`

```typescript
const handleDeleteLogsFromFilters = async () => {
  // ... validações e confirmações
  
  const response = await auditLogService.deleteLogs(
    filters.value.startDate,
    filters.value.endDate
  );

  const count = response.data.data.count;
  alert(`✅ Sucesso!\n\n${count} logs foram excluídos permanentemente.`);
  
  // Limpar filtros e recarregar
  filters.value = {
    resource: '',
    action: '',
    startDate: '',
    endDate: '',
  };
  
  await loadLogs();
  await loadStatistics();
};
```

## 🧪 Como Testar

### 1. Testar Modo `write_only`

```bash
# Configurar
echo "AUDIT_LOG_MODE=write_only" >> backend/.env

# Reiniciar backend
npm run dev

# Testar
curl http://localhost:3001/api/v1/users  # Não loga
curl -X POST http://localhost:3001/api/v1/users  # Loga
```

### 2. Testar Modo `errors_only`

```bash
# Configurar
echo "AUDIT_LOG_MODE=errors_only" >> backend/.env

# Reiniciar backend
npm run dev

# Testar
curl http://localhost:3001/api/v1/users  # Não loga (200)
curl http://localhost:3001/api/v1/users/999  # Loga (404)
```

### 3. Testar Exclusão e Reload

```
1. Acessar /audit-logs
2. Selecionar datas
3. Clicar em "Limpar Logs do Período"
4. Confirmar
5. Verificar:
   - Filtros foram limpos ✅
   - Grid recarregou ✅
   - Logs foram excluídos ✅
```

## 📈 Benefícios

### Performance

- ✅ **75% menos logs** (write_only vs all)
- ✅ Banco de dados mais leve
- ✅ Queries mais rápidas

### Flexibilidade

- ✅ Configuração por ambiente
- ✅ Sem alterar código
- ✅ Mudança em tempo real (restart)

### Manutenção

- ✅ Logs mais relevantes
- ✅ Análise mais focada
- ✅ Limpeza menos frequente

## ⚠️ Recomendações

### Desenvolvimento

```env
AUDIT_LOG_MODE=all
AUDIT_LOG_INCLUDE_READS=true
```

**Por quê?**
- Ver todas as operações
- Debug facilitado
- Entender fluxo completo

### Homologação

```env
AUDIT_LOG_MODE=write_only
AUDIT_LOG_INCLUDE_READS=false
```

**Por quê?**
- Simular produção
- Testar volume real
- Validar performance

### Produção

```env
AUDIT_LOG_MODE=write_only
AUDIT_LOG_INCLUDE_READS=false
```

**Por quê?**
- Captura mudanças importantes
- Performance otimizada
- Compliance mantido

### Troubleshooting

```env
AUDIT_LOG_MODE=all
AUDIT_LOG_INCLUDE_READS=true
```

**Por quê?**
- Investigar problemas
- Ver todas as requisições
- Temporário (voltar depois)

## 🔄 Migração

### De Versão Anterior

1. **Criar arquivo `.env`**:
```bash
cd backend
cp .env.example .env
```

2. **Configurar modo**:
```env
AUDIT_LOG_MODE=write_only
AUDIT_LOG_INCLUDE_READS=false
```

3. **Reiniciar backend**:
```bash
npm run dev
```

4. **Verificar logs**:
- Deve logar apenas escritas
- Não deve logar GETs

## 📚 Arquivos Modificados

```
backend/
├── .env.example              [CRIADO]
├── src/
│   ├── config/
│   │   └── env.ts           [MODIFICADO]
│   └── middleware/
│       └── audit.middleware.ts [MODIFICADO]

frontend/
└── src/
    └── views/
        └── audit/
            └── AuditLogsView.vue [MODIFICADO]
```

## 🎯 Próximos Passos

### Imediato

1. ✅ Criar arquivo `.env` no backend
2. ✅ Configurar `AUDIT_LOG_MODE=write_only`
3. ✅ Reiniciar backend
4. ✅ Testar exclusão de logs

### Futuro

- [ ] Interface para alterar modo via admin
- [ ] Estatísticas por modo
- [ ] Alertas de volume anormal
- [ ] Rotação automática de logs

---

**Status**: ✅ Implementado  
**Data**: 19/10/2024  
**Modo Padrão**: `write_only`  
**Recomendação**: Manter `write_only` em produção
