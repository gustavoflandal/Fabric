# 🔔 Sistema de Notificações - Guia de Teste

## 📋 Pré-requisitos

Antes de testar o sistema de notificações, certifique-se de que:

1. ✅ O banco de dados está rodando (MySQL)
2. ✅ A migração das notificações foi executada
3. ✅ O backend está rodando
4. ✅ Existem dados de teste no sistema (usuários, produtos, ordens)

---

## 🚀 Passo 1: Instalar Dependências (se necessário)

Se você ainda não instalou o `node-cron`:

```bash
cd backend
npm install node-cron
npm install -D @types/node-cron
```

**Nota:** Verifique no `package.json` se já está instalado (versão 4.2.1).

---

## 🎯 Passo 2: Criar Notificações de Teste

Execute o script de seed para popular notificações:

```bash
cd backend
npm run prisma:seed-notifications
```

### O que será criado:

Para cada usuário do sistema, serão criadas **8 notificações**:

#### 🔴 **Críticas (Prioridade 4)**
1. **Material Indisponível** - Falta de material para produção
2. **Taxa de Refugo Alta** - Refugo acima de 5%

#### ⚠️ **Altas (Prioridade 3)**
3. **Ordem Atrasada** - OP com 3 dias de atraso
4. **Gargalo Detectado** - Centro com 8 operações na fila
5. **Estoque Baixo** - Produto abaixo do mínimo

#### 📊 **Médias (Prioridade 2)**
6. **Operação Concluída** - Operação finalizada (já lida)
7. **Capacidade Baixa** - Centro operando a 65%

#### 📋 **Baixas (Prioridade 1)**
8. **Entrada de Material** - Informativa (arquivada)

---

## 🖥️ Passo 3: Iniciar o Backend

```bash
cd backend
npm run dev
```

Você deverá ver no console:

```
✅ Database connected successfully
✅ Event listeners initialized
✅ Notification scheduler initialized
[NotificationScheduler] ✅ 5 agendamentos iniciados:
  - A cada 5 min: Ordens atrasadas e gargalos
  - A cada 15 min: Níveis de estoque
  - Diariamente às 8h: Resumo do dia
  - A cada 1 hora: Limpeza de notificações antigas
  - A cada 2 horas: Capacidade dos centros
🚀 Server running on port 3001
```

---

## 🎨 Passo 4: Iniciar o Frontend

```bash
cd frontend
npm run dev
```

Acesse: `http://localhost:5173`

---

## 🧪 Passo 5: Testar as Funcionalidades

### **A) Notification Bell (Sino no Header)**

1. Faça login no sistema
2. Observe o **sino no header** (canto superior direito)
3. Você verá um **badge vermelho** com o número de notificações não lidas
4. **Clique no sino** para abrir o dropdown
5. Veja as últimas 5 notificações
6. Clique em **"Marcar todas como lidas"**

### **B) Centro de Notificações (Dashboard)**

1. Vá para o **Dashboard** (página inicial)
2. Observe o **Centro de Notificações** (onde ficavam as "Ações Rápidas")
3. Veja os **contadores por prioridade**:
   - 🔴 Críticas
   - ⚠️ Altas
   - 📊 Não Lidas
   - 📋 Total
4. Veja as notificações **críticas** e **altas** listadas
5. **Clique em uma notificação** para:
   - Marcar como lida automaticamente
   - Navegar para o recurso relacionado

### **C) Interações**

**Marcar como lida:**
- Clique em qualquer notificação
- O badge diminui automaticamente
- A notificação some da lista de não lidas

**Ver todas:**
- Clique em "Ver todas as notificações →"
- (Página completa ainda não implementada, mas o link está preparado)

---

## 🔄 Passo 6: Testar Eventos Automáticos

### **1. Liberar uma Ordem de Produção**

```
1. Vá em "Ordens de Produção"
2. Selecione uma ordem com status "PLANEJADA"
3. Clique em "Liberar"
4. O sistema verifica automaticamente se há material disponível
5. Se faltar material, uma notificação CRÍTICA será criada
```

### **2. Criar Apontamento com Refugo Alto**

```
1. Vá em "Apontamentos"
2. Crie um novo apontamento
3. Coloque quantidade de refugo > 5% (ex: 100 boas, 10 refugo = 10%)
4. Uma notificação CRÍTICA será criada automaticamente
```

### **3. Movimentar Estoque**

```
1. Vá em "Estoque"
2. Faça uma saída de material
3. Se o estoque ficar abaixo do mínimo, notificação ALTA será criada
```

### **4. Aguardar Cron Jobs**

```
- Após 5 minutos: Sistema verifica ordens atrasadas e gargalos
- Após 15 minutos: Sistema verifica estoque baixo
- Após 1 hora: Sistema limpa notificações antigas
```

---

## 📊 Passo 7: Verificar no Banco de Dados

Para ver as notificações diretamente no banco:

```bash
cd backend
npx prisma studio
```

Navegue até a tabela **notifications** e veja:
- Todas as notificações criadas
- Status de leitura
- Prioridades
- Dados contextuais (JSON)

---

## 🐛 Troubleshooting

### **Problema: Badge não aparece**

**Solução:**
```bash
# Verificar se há notificações no banco
cd backend
npx prisma studio
# Abra a tabela "notifications"
```

### **Problema: Notificações não aparecem no dropdown**

**Solução:**
```javascript
// Abra o console do navegador (F12)
// Verifique se há erros de API
// Teste a API diretamente:
fetch('http://localhost:3001/api/v1/notifications/critical', {
  headers: {
    'Authorization': 'Bearer SEU_TOKEN'
  }
})
```

### **Problema: Cron jobs não executam**

**Solução:**
```bash
# Verifique os logs do backend
# Deve aparecer:
[NotificationScheduler] ✅ 5 agendamentos iniciados
```

### **Problema: Erro "Cannot find module 'node-cron'"**

**Solução:**
```bash
cd backend
npm install node-cron
npm install -D @types/node-cron
```

---

## 🎯 Cenários de Teste Completos

### **Cenário 1: Fluxo de Material Indisponível**

```
1. Criar uma ordem de produção
2. Verificar que o produto tem BOM
3. Zerar o estoque de um componente
4. Liberar a ordem
5. ✅ Notificação crítica deve aparecer
6. Clicar na notificação
7. ✅ Deve navegar para a ordem
8. ✅ Badge deve diminuir
```

### **Cenário 2: Fluxo de Refugo Alto**

```
1. Criar apontamento com 100 boas e 10 refugo
2. ✅ Notificação crítica deve aparecer
3. Verificar no dropdown
4. ✅ Mensagem deve mostrar "10% de refugo"
5. Marcar como lida
6. ✅ Deve sumir da lista de não lidas
```

### **Cenário 3: Fluxo de Estoque Baixo**

```
1. Verificar estoque mínimo de um produto
2. Fazer saída até ficar abaixo do mínimo
3. ✅ Notificação alta deve aparecer
4. Verificar no Centro de Notificações
5. ✅ Deve aparecer na seção "ALTA"
```

---

## 📈 Métricas de Sucesso

Após os testes, você deve ter:

- ✅ Badge no sino mostrando contagem correta
- ✅ Dropdown funcionando com últimas 5 notificações
- ✅ Centro de Notificações mostrando críticas e altas
- ✅ Navegação funcionando ao clicar nas notificações
- ✅ Contadores atualizando automaticamente
- ✅ Notificações sendo criadas em eventos reais
- ✅ Cron jobs executando periodicamente

---

## 🎨 Próximas Melhorias (Opcional)

1. **Página Completa de Notificações**
   - Filtros avançados
   - Paginação
   - Busca

2. **WebSocket**
   - Notificações em tempo real
   - Sem necessidade de polling

3. **Email**
   - Enviar notificações críticas por email
   - Configurável por usuário

4. **Dashboard de Métricas**
   - Gráficos de tendências
   - Top eventos
   - Tempo de resposta

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do backend
2. Abra o console do navegador (F12)
3. Verifique a documentação: `SISTEMA_NOTIFICACOES.md`
4. Teste as APIs diretamente com Postman/Insomnia

---

**Última atualização:** 21/10/2025
**Versão:** 1.0.0
