# Sistema de Logs de Auditoria - Fabric PCP

## 📋 Visão Geral

Sistema completo de captura e gestão de logs de auditoria para rastreabilidade e segurança de todas as operações realizadas no sistema Fabric.

## 🎯 Objetivos

- **Rastreabilidade**: Registrar todas as operações importantes do sistema
- **Segurança**: Identificar acessos não autorizados e atividades suspeitas
- **Conformidade**: Atender requisitos de auditoria e compliance
- **Análise**: Fornecer dados para análise de uso e comportamento

## 📊 Estrutura de Dados

### Modelo AuditLog

```prisma
model AuditLog {
  id            String    @id @default(uuid())
  userId        String?
  action        String    // create, read, update, delete
  resource      String    // users, roles, products, etc
  resourceId    String?
  description   String?
  
  // Dados da requisição HTTP
  ipAddress     String?
  userAgent     String?
  method        String?   // GET, POST, PUT, DELETE
  endpoint      String?
  statusCode    Int?
  
  // Dados de auditoria
  requestBody   Json?
  responseBody  Json?
  oldValues     Json?
  newValues     Json?
  errorMessage  String?
  durationMs    Int?
  
  createdAt     DateTime  @default(now())
  
  user          User?     @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@index([resource])
  @@index([action])
  @@index([createdAt])
}
```

## 🔧 Funcionalidades

### 1. Captura Automática

**Middleware de Auditoria** (`audit.middleware.ts`):
- Intercepta todas as requisições HTTP
- Captura dados da requisição e resposta
- Registra tempo de execução
- Sanitiza dados sensíveis (senhas, tokens)

```typescript
// Aplicado globalmente no app.ts
app.use(auditMiddleware);
```

### 2. Dados Capturados

#### Informações do Usuário
- ID do usuário autenticado
- Nome e email (via relação)

#### Informações da Requisição
- Método HTTP (GET, POST, PUT, DELETE)
- Endpoint acessado
- IP de origem
- User Agent (navegador/dispositivo)
- Body da requisição (sanitizado)

#### Informações da Resposta
- Status code HTTP
- Body da resposta (sanitizado)
- Tempo de execução (ms)
- Mensagens de erro (se houver)

#### Contexto da Operação
- Ação realizada (create, read, update, delete)
- Recurso afetado (users, products, etc)
- ID do recurso específico
- Descrição da operação

### 3. Sanitização de Dados

Campos sensíveis são automaticamente redactados:
- `password` → `***REDACTED***`
- `token` → `***REDACTED***`
- `accessToken` → `***REDACTED***`
- `refreshToken` → `***REDACTED***`

### 4. Filtros e Exclusões

**Não são logadas**:
- Requisições de health check
- Login/Register (para não logar senhas)
- Requisições GET bem-sucedidas (opcional)

**São sempre logadas**:
- Todas operações de escrita (POST, PUT, DELETE)
- Requisições com erro (status >= 400)

## 📡 API Endpoints

### Listar Logs
```http
GET /api/v1/audit-logs?page=1&limit=100&resource=users&action=create&startDate=2024-01-01&endDate=2024-12-31
```

**Filtros disponíveis**:
- `userId`: Filtrar por usuário
- `resource`: Filtrar por recurso
- `action`: Filtrar por ação
- `startDate`: Data início
- `endDate`: Data fim

### Buscar Log Específico
```http
GET /api/v1/audit-logs/:id
```

### Logs de um Recurso
```http
GET /api/v1/audit-logs/resource/:resource/:resourceId
```

Exemplo: `/api/v1/audit-logs/resource/users/abc-123`

### Estatísticas
```http
GET /api/v1/audit-logs/statistics?startDate=2024-01-01&endDate=2024-12-31
```

Retorna:
- Total de logs
- Logs por ação
- Logs por recurso
- Top 10 usuários mais ativos

## 🎨 Interface Web

### Tela de Logs de Auditoria

**Localização**: `/audit-logs`

**Recursos**:
- ✅ Listagem paginada de logs
- ✅ Filtros por recurso, ação e data
- ✅ Cards de estatísticas
- ✅ Visualização detalhada de cada log
- ✅ Badges coloridos por tipo de ação
- ✅ Indicadores de status HTTP
- ✅ Formatação de datas em PT-BR

**Cores por Ação**:
- 🟢 **CREATE** - Verde
- 🔵 **READ** - Azul
- 🟡 **UPDATE** - Amarelo
- 🔴 **DELETE** - Vermelho

**Cores por Status HTTP**:
- 🟢 **2xx** - Sucesso (Verde)
- 🟡 **3xx** - Redirecionamento (Amarelo)
- 🔴 **4xx/5xx** - Erro (Vermelho)

## 📈 Estatísticas e Análises

### Métricas Disponíveis

1. **Total de Logs**: Quantidade total de operações registradas
2. **Ações Mais Comuns**: Ranking de ações (create, update, etc)
3. **Recursos Mais Acessados**: Ranking de recursos
4. **Usuários Mais Ativos**: Top 10 usuários

### Análises Possíveis

- **Auditoria de Segurança**: Identificar acessos suspeitos
- **Análise de Uso**: Entender padrões de utilização
- **Performance**: Identificar endpoints lentos (durationMs)
- **Erros**: Rastrear falhas e problemas
- **Compliance**: Evidências para auditorias

## 🔒 Segurança

### Proteção de Dados

1. **Sanitização Automática**: Dados sensíveis são redactados
2. **Acesso Restrito**: Apenas usuários autenticados
3. **Logs Imutáveis**: Não há endpoint de edição/exclusão
4. **Retenção**: Definir política de retenção (ex: 90 dias)

### Boas Práticas

- ✅ Não logar dados sensíveis completos
- ✅ Implementar rotação de logs
- ✅ Monitorar tentativas de acesso não autorizado
- ✅ Alertar sobre padrões suspeitos
- ✅ Backup regular dos logs

## 🚀 Casos de Uso

### 1. Investigação de Incidentes
```
Usuário reporta alteração não autorizada
→ Filtrar logs por recurso e período
→ Identificar quem fez a alteração
→ Ver valores antigos e novos
→ Rastrear IP e dispositivo
```

### 2. Auditoria de Compliance
```
Auditor solicita evidências
→ Exportar logs do período
→ Mostrar todas operações em dados sensíveis
→ Comprovar rastreabilidade
```

### 3. Análise de Performance
```
Sistema lento em horário específico
→ Filtrar logs por período
→ Ordenar por durationMs
→ Identificar endpoints problemáticos
→ Otimizar queries
```

### 4. Detecção de Fraude
```
Padrão suspeito de acessos
→ Analisar logs por usuário
→ Identificar horários incomuns
→ Verificar IPs diferentes
→ Bloquear acesso se necessário
```

## 📝 Exemplos de Logs

### Criação de Usuário
```json
{
  "id": "log-123",
  "userId": "user-admin",
  "action": "create",
  "resource": "users",
  "resourceId": "user-new",
  "description": "POST /api/v1/users",
  "method": "POST",
  "endpoint": "/api/v1/users",
  "statusCode": 201,
  "ipAddress": "192.168.1.100",
  "durationMs": 45,
  "requestBody": {
    "name": "João Silva",
    "email": "joao@example.com",
    "password": "***REDACTED***"
  },
  "createdAt": "2024-10-19T20:00:00Z"
}
```

### Atualização de Produto
```json
{
  "id": "log-456",
  "userId": "user-123",
  "action": "update",
  "resource": "products",
  "resourceId": "prod-789",
  "description": "PUT /api/v1/products/prod-789",
  "method": "PUT",
  "statusCode": 200,
  "oldValues": { "price": 100.00 },
  "newValues": { "price": 120.00 },
  "durationMs": 32
}
```

### Erro de Autenticação
```json
{
  "id": "log-789",
  "userId": null,
  "action": "read",
  "resource": "auth",
  "description": "POST /api/v1/auth/login",
  "method": "POST",
  "statusCode": 401,
  "ipAddress": "203.0.113.42",
  "errorMessage": "Credenciais inválidas",
  "durationMs": 15
}
```

## 🔄 Próximas Melhorias

### Curto Prazo
- [ ] Exportação de logs (CSV, JSON)
- [ ] Alertas por email em eventos críticos
- [ ] Dashboard de segurança
- [ ] Filtro por IP

### Médio Prazo
- [ ] Integração com SIEM
- [ ] Machine Learning para detecção de anomalias
- [ ] Relatórios automáticos
- [ ] Retenção automática de logs

### Longo Prazo
- [ ] Blockchain para logs imutáveis
- [ ] Análise preditiva
- [ ] Compliance automatizado (LGPD, SOC2)
- [ ] Integração com ferramentas de BI

## 📚 Referências

- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [ISO 27001 - Audit Logs](https://www.iso.org/isoiec-27001-information-security.html)

---

**Documentação atualizada em**: 19/10/2024  
**Versão**: 1.0  
**Autor**: Sistema Fabric PCP
