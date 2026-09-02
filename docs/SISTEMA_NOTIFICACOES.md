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
- **Destinatários reais:** só `MANAGER` (a busca por "Comprador" usa um perfil que não existe — ver seção "Regras por Perfil"; não inclui o operador da ordem)
- **Ação:** Verificar estoque e iniciar compra urgente
- **Nota técnica:** recalcula o estoque somando `stock_movements` do zero a cada verificação, em vez de usar `StockBalance`/`stock.service.ts::getBalance()` (já otimizado desde a Fase 1 do cronograma de modernização) — candidato a correção, não feita aqui.

#### QUALITY_SCRAP_HIGH
- **Quando:** Taxa de refugo acima do limite (padrão: 5%)
- **Destinatários reais:** `MANAGER` + o operador específico que registrou o apontamento (não "Gerente de Qualidade" — perfil inexistente)
- **Ação:** Parar produção e investigar causa

### **Prioridade ALTA (3)** ⚠️

#### PRODUCTION_DELAYED
- **Quando:** Ordem de produção atrasada em relação ao cronograma
- **Destinatários reais:** só `MANAGER` (não inclui o operador atribuído à ordem)
- **Ação:** Repriorizar ou realocar recursos

#### BOTTLENECK_DETECTED
- **Quando:** Centro de trabalho com fila acima do limite (padrão: 5 operações)
- **Destinatários reais:** só `MANAGER` ("Manutenção" nunca existiu no código, é aspiracional)
- **Ação:** Redistribuir carga ou adicionar capacidade

#### STOCK_BELOW_SAFETY
- **Quando:** Estoque abaixo do mínimo de segurança
- **Destinatários reais: NENHUM.** Busca `getUsersByRole('BUYER')` + `getUsersByRole('STOCK_MANAGER')` — **os dois perfis não existem**. Esta é, hoje, a notificação mais crítica do sistema por descrição (estoque zerado dispara prioridade 4) e a única cujo caminho de entrega está **totalmente morto**, não parcialmente — nem `MANAGER` está na lista. Prioridade alta de correção se este alerta for considerado importante para o negócio.
- **Ação:** Iniciar processo de compra

### **Prioridade MÉDIA (2)** 📊

#### CAPACITY_LOW
- **Não existe no código.** `grep` por `CAPACITY_LOW`/`checkCapacity` em `notification-detector.service.ts` não retorna nada — é o mesmo evento do 5º cron job da seção "Detectores Automáticos" abaixo, que só loga "verificação de capacidade não implementada ainda". Mantido aqui só como registro do que foi planejado e nunca construído.

#### OPERATION_COMPLETED
- **Quando:** Operação de produção concluída
- **Destinatários:** Operador, Gerente de Produção
- **Ação:** Informativo

---

## 🔐 Regras por Perfil

**Achado ao atualizar este documento (01/09/2026):** `notification-detector.service.ts` busca destinatários por `getUsersByRole('BUYER')`, `getUsersByRole('QUALITY_MANAGER')` e `getUsersByRole('STOCK_MANAGER')` — mas os únicos perfis que de fato existem no sistema, seedados em `backend/prisma/seed.ts`, são **`ADMIN`, `MANAGER` e `OPERATOR`**. Não existe nem nunca existiu perfil `BUYER`, `QUALITY_MANAGER` ou `STOCK_MANAGER`. Na prática, toda notificação endereçada a esses três "perfis" busca uma lista vazia de usuários e não entrega a ninguém — as seções abaixo descrevem a *intenção* original do design (útil para saber o que cada evento deveria fazer), não o comportamento real de entrega. Ver `docs/PERMISSOES_SISTEMA.md` para o RBAC real do sistema.

### **ADMIN**
- Recebe: Todas as notificações
- Prioridade mínima: 1 (todas)
- Canais: In-app + Email (canal de email não implementado — ver "Próximos Passos")

### **MANAGER (mapeado no código como "Gerente de Produção", "Gerente de Qualidade" e "Comprador" simultaneamente)**
- Recebe, de fato: `PRODUCTION_DELAYED`, `BOTTLENECK_DETECTED`, `MATERIAL_UNAVAILABLE`, `CAPACITY_LOW`, `OPERATION_COMPLETED` (via `getUsersByRole('MANAGER')`, chamado em múltiplos detectores)
- **Não recebe** `QUALITY_SCRAP_HIGH` nem `STOCK_BELOW_SAFETY` de fato — esses dois chamam `getUsersByRole('QUALITY_MANAGER')`/`getUsersByRole('BUYER')`/`getUsersByRole('STOCK_MANAGER')`, que não retornam ninguém (ver achado acima). Se a intenção é que `MANAGER` receba esses eventos também, o código precisa ser corrigido para usar `'MANAGER'` em vez desses perfis inexistentes.

### **OPERATOR (Operador)**
- Recebe, de fato, só **`QUALITY_SCRAP_HIGH`** — e não por assinatura de perfil: o detector inclui diretamente `pointing.user` (quem registrou o apontamento que gerou o refugo alto) na lista de destinatários, então é sempre o operador daquele apontamento específico, nunca "todo operador".
- **Não recebe** `OPERATION_COMPLETED` (vai só para `MANAGER` — é aviso *para* o gestor de que uma operação terminou, não uma confirmação *para* quem a completou) nem `MATERIAL_UNAVAILABLE` (vai para `MANAGER` + `BUYER`, e `BUYER` não existe — ver achado acima).
- Canais: In-app

---

## ⚙️ Detectores Automáticos (Cron Jobs)

Corrigido contra `notification-scheduler.service.ts` (nomes de função e frequência exatos — os nomes abaixo divergiam do código real na versão anterior deste documento):

### **A cada 5 minutos** — real
- `detectProductionDelays()` — verifica ordens atrasadas
- `detectBottlenecks()` — identifica gargalos em centros de trabalho

### **A cada 15 minutos** — real
- `checkLowStock()` — verifica estoque abaixo do mínimo (é o job que deveria disparar `STOCK_BELOW_SAFETY`, hoje sem entrega — ver seção "Eventos Implementados")

### **A cada 1 hora** — real
- `notificationService.cleanupExpired(30)` — remove notificações antigas (30 dias)

### **Diariamente às 8h** — stub, não implementado
Job roda e loga "Resumo diário não implementado ainda". Não gera nenhuma notificação.

### **A cada 2 horas** — stub, não implementado
Job roda e loga "Verificação de capacidade não implementada ainda" (é o job por trás do evento `CAPACITY_LOW`, que também não existe — ver "Eventos Implementados").

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

**Corrigido em 01/09/2026** — o estado abaixo é o real, verificado no código (`notification.service.ts`, `notification-detector.service.ts`, `notification-scheduler.service.ts`, `frontend/src/components/notifications/`), não o planejado em 21/10/2025.

### **Fundação — feito**
✅ Schema Prisma (`Notification`/`NotificationRule`/`NotificationPreference`)
✅ `NotificationService`
✅ `NotificationBell.vue`, `NotificationCenter.vue`, `NotificationsView.vue`

### **Detectores — feito, com um achado**
✅ `NotificationDetector` + 5 cron jobs em `notification-scheduler.service.ts`
✅ Eventos críticos implementados (código existe e roda)
❌ **`getUsersByRole('BUYER')`, `getUsersByRole('QUALITY_MANAGER')` e `getUsersByRole('STOCK_MANAGER')` buscam perfis que não existem** — ver seção "Regras por Perfil" acima. `STOCK_BELOW_SAFETY` não entrega a ninguém; `MATERIAL_UNAVAILABLE` e `QUALITY_SCRAP_HIGH` entregam parcialmente (só a parte que já usava `MANAGER`). Não corrigido nesta atualização — é código, não documentação; registrado aqui para quem for tratar.
⏳ 5º cron job (verificação de capacidade a cada 2h) é um stub — loga "não implementado ainda" e não faz nada.

### **UI — feito**
✅ Página completa de notificações, ícone com badge, dropdown

### **Pendente de verdade**
⏳ Notificações por email (`email: Boolean` existe em `NotificationRule`/`NotificationPreference`, mas nenhum código envia email — nenhum `nodemailer` ou equivalente no projeto)
⏳ Dashboard de métricas (contagens/gráficos descritos abaixo) — não verificado nesta atualização, tratar como não confirmado
⏳ Agrupamento inteligente de notificações

### **Módulos além do PCP (WMS/YMS) — pendente, registrado em 01/09/2026**
Todo detector e evento hoje é do núcleo PCP. Quando o WMS (ou outro módulo opcional) tiver seu primeiro evento de notificação real (candidato: reposição de posição de picking, item F4.10 do plano do WMS), seguir `docs/fase-2026-09-modernizacao/04_ARQUITETURA_MODULAR_LICENCIAMENTO.md` seção 3.4: categoria `WAREHOUSE` dedicada (não misturar em `STOCK`), e o detector chama `isModuleEnabled('WMS')` (`backend/src/services/licensed-module.service.ts`, já existe desde a Fase 0 do WMS) **antes** de rodar sua consulta — uma instalação só-PCP não deve gastar ciclo calculando notificação de um módulo que não tem.

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

**Última atualização:** 01/09/2026 (revisão 2 — verificado contra o código real: perfis de destinatário corrigidos, `STOCK_BELOW_SAFETY` identificado como sem entrega, "Próximos Passos" atualizado, e nota sobre notificações module-aware para quando WMS/YMS tiverem eventos próprios)
**Versão:** 2.0
