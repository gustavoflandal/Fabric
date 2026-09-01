# Sistema de Notificações PCP - Documentação Técnica

## 📋 Visão Geral

Sistema integrado de notificações para o PCP que substitui a seção de "Ações Rápidas" do dashboard por um **Centro de Notificações Inteligente** com alertas críticos e acionáveis.

---

## 🗄️ Estrutura do Banco de Dados

### Models Criados

#### **Notification**
Armazena todas as notificações do sistema.

```prisma
- id: UUID único
- userId: Usuário destinatário
- type: INFO | WARNING | ERROR | SUCCESS
- category: PRODUCTION | STOCK | PURCHASE | QUALITY | CAPACITY
- eventType: Tipo específico do evento (ex: PRODUCTION_DELAYED)
- title: Título da notificação
- message: Mensagem detalhada
- data: JSON com dados contextuais
- link: URL para navegação direta
- resourceType: Tipo do recurso (ProductionOrder, Product, etc)
- resourceId: ID do recurso
- read: Boolean (lida ou não)
- readAt: Data/hora da leitura
- archived: Boolean (arquivada ou não)
- archivedAt: Data/hora do arquivamento
- priority: 1 (baixa) a 4 (crítica)
- expiresAt: Data de expiração (opcional)
- createdAt: Data de criação
```

#### **NotificationRule**
Define regras de notificação por perfil (Role).

```prisma
- id: UUID único
- roleId: Perfil vinculado
- eventType: Tipo de evento que dispara
- enabled: Ativo/inativo
- minPriority: Prioridade mínima para notificar
- inApp: Notificação in-app habilitada
- email: Email habilitado
- conditions: JSON com condições adicionais
```

#### **NotificationPreference**
Preferências individuais do usuário por categoria.

```prisma
- id: UUID único
- userId: Usuário
- category: Categoria da notificação
- inApp: Habilitado in-app
- email: Habilitado email
- minPriority: Prioridade mínima
- enabled: Ativo/inativo
```

---

## 🎯 Eventos Implementados

### **Prioridade CRÍTICA (4)** 🔴

#### MATERIAL_UNAVAILABLE
- **Quando:** Material necessário não está disponível para produção
- **Destinatários:** Gerente de Produção, Comprador, Operador Atribuído
- **Ação:** Verificar estoque e iniciar compra urgente

#### QUALITY_SCRAP_HIGH
- **Quando:** Taxa de refugo acima do limite (padrão: 5%)
- **Destinatários:** Gerente de Qualidade, Gerente de Produção, Operador
- **Ação:** Parar produção e investigar causa

### **Prioridade ALTA (3)** ⚠️

#### PRODUCTION_DELAYED
- **Quando:** Ordem de produção atrasada em relação ao cronograma
- **Destinatários:** Gerente de Produção, Operador Atribuído
- **Ação:** Repriorizar ou realocar recursos

#### BOTTLENECK_DETECTED
- **Quando:** Centro de trabalho com fila acima do limite (padrão: 5 operações)
- **Destinatários:** Gerente de Produção, Manutenção
- **Ação:** Redistribuir carga ou adicionar capacidade

#### STOCK_BELOW_SAFETY
- **Quando:** Estoque abaixo do mínimo de segurança
- **Destinatários:** Comprador, Gerente de Estoque
- **Ação:** Iniciar processo de compra

### **Prioridade MÉDIA (2)** 📊

#### CAPACITY_LOW
- **Quando:** Centro de trabalho operando abaixo da capacidade esperada
- **Destinatários:** Gerente de Produção
- **Ação:** Investigar ociosidade

#### OPERATION_COMPLETED
- **Quando:** Operação de produção concluída
- **Destinatários:** Operador, Gerente de Produção
- **Ação:** Informativo

---

## 🔐 Regras por Perfil

### **ADMIN**
- Recebe: Todas as notificações
- Prioridade mínima: 1 (todas)
- Canais: In-app + Email

### **PRODUCTION_MANAGER (Gerente de Produção)**
- Recebe:
  - PRODUCTION_DELAYED
  - BOTTLENECK_DETECTED
  - MATERIAL_UNAVAILABLE
  - QUALITY_SCRAP_HIGH
  - CAPACITY_LOW
  - OPERATION_COMPLETED
- Prioridade mínima: 2
- Canais: In-app + Email (críticas)

### **OPERATOR (Operador)**
- Recebe (apenas suas ordens):
  - OPERATION_COMPLETED
  - MATERIAL_UNAVAILABLE
  - QUALITY_SCRAP_HIGH
- Prioridade mínima: 3
- Canais: In-app
- Filtro: `assignedToUser: true`

### **BUYER (Comprador)**
- Recebe:
  - STOCK_BELOW_SAFETY
  - MATERIAL_UNAVAILABLE
- Prioridade mínima: 2
- Canais: In-app + Email

### **QUALITY_MANAGER (Gerente de Qualidade)**
- Recebe:
  - QUALITY_SCRAP_HIGH
- Prioridade mínima: 2
- Canais: In-app + Email

---

## ⚙️ Detectores Automáticos (Cron Jobs)

### **A cada 5 minutos**
- `detectProductionDelays()` - Verifica ordens atrasadas
- `detectBottlenecks()` - Identifica gargalos em centros de trabalho

### **A cada 15 minutos**
- `checkCapacity()` - Monitora capacidade dos centros

### **Diariamente às 8h**
- `sendDailySummary()` - Envia resumo do dia

### **A cada 1 hora**
- `cleanupOldNotifications()` - Remove notificações antigas (30 dias)

---

## 🎨 Interface do Usuário

### **Centro de Notificações no Dashboard**
Substitui a seção "Ações Rápidas" com:

```
┌─────────────────────────────────────────────────────┐
│  🔔 Notificações Críticas                           │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🔴 CRÍTICO (2)                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Material Indisponível                         │ │
│  │ Chip A15 necessário para OP-2025-0042        │ │
│  │ há 15 minutos                     [Ver Ordem] │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ⚠️  ALTA (3)                                       │
│  ┌───────────────────────────────────────────────┐ │
│  │ Ordem Atrasada                                │ │
│  │ OP-2025-0038 atrasada em 2 dias              │ │
│  │ há 3 horas                        [Ver Ordem] │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Ver Todas as Notificações (12)] →                │
└─────────────────────────────────────────────────────┘
```

### **Notification Bell (Header)**
- Ícone de sino com badge de contagem
- Dropdown com últimas 5 notificações
- Link para página completa

### **Página Completa de Notificações**
- Filtros por categoria, prioridade, status
- Agrupamento inteligente
- Ações em massa (marcar todas como lidas)
- Histórico completo

---

## 📊 Dashboard de Métricas

### **Widgets**
1. **Notificações Críticas** - Contagem em tempo real
2. **Notificações Altas** - Contagem
3. **Total Não Lidas** - Contagem
4. **Tempo Médio de Resposta** - Minutos

### **Gráficos**
- Tendência de notificações (últimos 7 dias)
- Distribuição por categoria
- Top 5 eventos mais frequentes
- Centros de trabalho mais críticos

---

## 🔄 Fluxo de Criação de Notificação

```typescript
1. Evento ocorre no sistema
   ↓
2. Detector identifica o evento
   ↓
3. Busca regras aplicáveis (por perfil)
   ↓
4. Verifica preferências do usuário
   ↓
5. Cria notificação no banco
   ↓
6. Envia via canais habilitados (in-app, email)
   ↓
7. Usuário recebe e pode interagir
```

---

## 🚀 Próximos Passos

### **Fase 1 - Fundação (Sprint 1)**
✅ Schema Prisma criado
⏳ Migração do banco
⏳ Services básicos (NotificationService)
⏳ Componente NotificationBell
⏳ Substituir Ações Rápidas no Dashboard

### **Fase 2 - Detectores (Sprint 2)**
⏳ NotificationDetector service
⏳ Integração com módulos existentes
⏳ Cron jobs
⏳ Eventos críticos implementados

### **Fase 3 - UI Completa (Sprint 3)**
⏳ Página completa de notificações
⏳ Dashboard de métricas
⏳ Filtros e busca
⏳ Preferências do usuário

### **Fase 4 - Refinamento (Sprint 4)**
⏳ Notificações por email
⏳ Agrupamento inteligente
⏳ Testes e ajustes
⏳ Documentação final

---

## 📝 Comandos Úteis

```bash
# Gerar migração
cd backend
npx prisma migrate dev --name add_notifications_system

# Regenerar Prisma Client
npx prisma generate

# Seed de regras padrão
npm run prisma:seed-notifications
```

---

## 🎯 Métricas de Sucesso

- ✅ Redução de 50% no tempo de resposta a eventos críticos
- ✅ 100% de eventos críticos notificados em < 5 minutos
- ✅ Taxa de leitura > 80% para notificações críticas
- ✅ Satisfação do usuário > 4/5

---

**Última atualização:** 21/10/2025
**Versão:** 1.0.0
