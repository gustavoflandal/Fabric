# Limpeza de Logs de Auditoria - Fabric PCP

## 📋 Visão Geral

Funcionalidade para administradores limparem logs de auditoria por período, com permissão específica e interface intuitiva.

## 🔐 Permissão

### Nova Permissão Criada
```
Recurso: audit_logs
Ação: delete
Descrição: Excluir logs de auditoria
```

### Atribuição
- ✅ Perfil **ADMIN** tem a permissão por padrão
- ✅ Pode ser atribuída a outros perfis conforme necessário

## 🔧 Backend

### Endpoint
```http
DELETE /api/v1/audit-logs/clean
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

### Resposta de Sucesso
```json
{
  "status": "success",
  "data": {
    "count": 150,
    "startDate": "2024-01-01T00:00:00.000Z",
    "endDate": "2024-12-31T23:59:59.999Z"
  },
  "message": "150 logs excluídos com sucesso"
}
```

### Resposta de Erro
```json
{
  "status": "error",
  "message": "startDate e endDate são obrigatórios"
}
```

### Validações
- ✅ Requer autenticação (JWT)
- ✅ Requer permissão `audit_logs:delete`
- ✅ `startDate` obrigatório
- ✅ `endDate` obrigatório
- ✅ Datas devem ser válidas

### Service Method
```typescript
async deleteLogs(startDate: Date, endDate: Date) {
  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  return {
    count: result.count,
    startDate,
    endDate,
  };
}
```

## 🎨 Frontend

### Localização
**Tela**: `/audit-logs`  
**Botão**: "🗑️ Limpar Logs" (vermelho, ao lado de "Limpar Filtros")

### Modal de Limpeza

#### Campos
1. **Data Início** (obrigatório)
   - Input type="date"
   - Seleciona data inicial do período

2. **Data Fim** (obrigatório)
   - Input type="date"
   - Seleciona data final do período

#### Avisos
- ⚠️ **Banner amarelo**: Alerta que a ação é irreversível
- ✅ **Mensagem de sucesso**: Mostra quantos logs foram excluídos
- ❌ **Mensagem de erro**: Exibe erros de validação ou servidor

#### Botões
- **Sair** (esquerda): Fecha o modal
- **Cancelar** (direita): Fecha o modal
- **Confirmar Exclusão** (direita, vermelho): Executa a exclusão

### Fluxo de Uso

1. **Abrir Modal**
   - Usuário clica em "🗑️ Limpar Logs"
   - Modal abre com campos vazios

2. **Selecionar Período**
   - Usuário seleciona data início
   - Usuário seleciona data fim

3. **Confirmar**
   - Usuário clica em "Confirmar Exclusão"
   - Sistema pede confirmação adicional (alert nativo)
   - Usuário confirma novamente

4. **Execução**
   - Sistema envia requisição ao backend
   - Mostra "Excluindo..." no botão
   - Desabilita todos os botões

5. **Resultado**
   - ✅ **Sucesso**: Mostra mensagem verde com quantidade excluída
   - ❌ **Erro**: Mostra mensagem vermelha com erro
   - Após 2 segundos (sucesso): Fecha modal e recarrega logs

### Validações Frontend
- ✅ Campos obrigatórios
- ✅ Confirmação dupla (modal + alert)
- ✅ Desabilita botões durante execução
- ✅ Feedback visual de loading

## 🔒 Segurança

### Proteções Implementadas

1. **Autenticação**
   - Requer JWT token válido
   - Usuário deve estar logado

2. **Autorização**
   - Verifica permissão `audit_logs:delete`
   - Apenas usuários com permissão podem executar

3. **Confirmação Dupla**
   - Modal de confirmação
   - Alert nativo adicional
   - Previne exclusões acidentais

4. **Auditoria**
   - A própria exclusão é logada
   - Registra quem excluiu
   - Registra período excluído

5. **Irreversibilidade**
   - Avisos claros na interface
   - Não há "desfazer"
   - Logs excluídos não podem ser recuperados

## 📊 Casos de Uso

### 1. Limpeza Periódica
**Cenário**: Sistema com muitos logs acumulados  
**Ação**: Administrador limpa logs antigos mensalmente  
**Período**: Logs com mais de 90 dias

```
Data Início: 2023-01-01
Data Fim: 2023-12-31
Resultado: 50.000 logs excluídos
```

### 2. Limpeza de Testes
**Cenário**: Ambiente de desenvolvimento com dados de teste  
**Ação**: Limpar logs de testes antes de produção  
**Período**: Todos os logs de teste

```
Data Início: 2024-01-01
Data Fim: 2024-01-31
Resultado: 1.200 logs excluídos
```

### 3. Conformidade LGPD
**Cenário**: Solicitação de exclusão de dados  
**Ação**: Excluir logs de usuário específico  
**Nota**: Usar filtros antes de excluir

```
1. Filtrar por userId
2. Verificar período
3. Limpar logs filtrados
```

### 4. Liberação de Espaço
**Cenário**: Banco de dados próximo do limite  
**Ação**: Excluir logs mais antigos  
**Período**: Logs com mais de 1 ano

```
Data Início: 2022-01-01
Data Fim: 2022-12-31
Resultado: 100.000 logs excluídos
```

## ⚠️ Avisos Importantes

### Não Fazer
- ❌ Excluir logs sem backup
- ❌ Excluir logs recentes sem motivo
- ❌ Excluir logs durante auditoria
- ❌ Dar permissão para usuários não-admin

### Fazer
- ✅ Fazer backup antes de excluir
- ✅ Definir política de retenção
- ✅ Documentar exclusões importantes
- ✅ Manter logs de pelo menos 90 dias

### Boas Práticas
1. **Política de Retenção**
   - Definir período mínimo (ex: 90 dias)
   - Automatizar limpeza futura
   - Documentar política

2. **Backup**
   - Exportar logs antes de excluir
   - Manter backup em storage separado
   - Testar restauração

3. **Auditoria**
   - Registrar todas exclusões
   - Manter log de quem excluiu
   - Revisar exclusões periodicamente

4. **Conformidade**
   - Seguir LGPD/GDPR
   - Atender requisitos de auditoria
   - Manter evidências necessárias

## 🧪 Testes

### Teste Manual

1. **Login como Admin**
   ```
   Email: admin@fabric.com
   Senha: admin123
   ```

2. **Acessar Logs**
   ```
   URL: http://localhost:5175/audit-logs
   ```

3. **Abrir Modal**
   ```
   Clicar em "🗑️ Limpar Logs"
   ```

4. **Testar Validações**
   ```
   - Tentar confirmar sem datas
   - Selecionar apenas data início
   - Selecionar apenas data fim
   ```

5. **Executar Limpeza**
   ```
   - Selecionar período de teste
   - Confirmar exclusão
   - Verificar mensagem de sucesso
   - Verificar logs foram removidos
   ```

### Teste de Permissão

1. **Criar usuário sem permissão**
2. **Tentar acessar endpoint**
3. **Verificar erro 403 Forbidden**

### Teste de Auditoria

1. **Executar limpeza**
2. **Verificar novo log criado**
3. **Confirmar dados do log**:
   - Ação: delete
   - Recurso: audit_logs
   - Usuário: admin
   - Período excluído

## 📈 Melhorias Futuras

### Curto Prazo
- [ ] Exportar logs antes de excluir
- [ ] Preview de quantos logs serão excluídos
- [ ] Filtro por recurso/ação antes de excluir

### Médio Prazo
- [ ] Agendamento de limpeza automática
- [ ] Política de retenção configurável
- [ ] Arquivamento em vez de exclusão

### Longo Prazo
- [ ] Backup automático antes de excluir
- [ ] Restauração de logs arquivados
- [ ] Dashboard de uso de espaço

## 📚 Arquivos Modificados

### Backend (4 arquivos)
```
prisma/seed.ts                          - Nova permissão
src/services/audit-log.service.ts       - Método deleteLogs
src/controllers/audit-log.controller.ts - Endpoint deleteLogs
src/routes/audit-log.routes.ts          - Rota DELETE /clean
```

### Frontend (2 arquivos)
```
src/services/audit-log.service.ts       - Método deleteLogs
src/views/audit/AuditLogsView.vue       - Modal e UI
```

---

**Status**: ✅ Funcionalidade Completa e Testada  
**Data**: 19/10/2024  
**Versão**: 1.0  
**Permissão**: audit_logs:delete
