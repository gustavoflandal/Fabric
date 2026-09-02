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
- category: PRODUCTION | STOCK | PURCHASE | QUALITY | CAPACITY | WAREHOUSE
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
- **Destinatários:** `MANAGER` (não inclui o operador da ordem)
- **Ação:** Verificar estoque e iniciar compra urgente
- **Nota técnica (corrigido em 02/09/2026):** lia o estoque somando `stock_movements` do zero a cada verificação. Agora consulta `stock_balances` — a linha por produto que `stock.service.ts::applyMovement()` mantém na mesma transação da movimentação desde a Fase 1. A leitura é **em lote** (uma consulta para toda a BOM), e não `getBalance()` por item: `getBalance()` faz 3 consultas por produto, monta limiares/status que o detector não usa e ainda faz `upsert` — um caminho de leitura passaria a escrever linha de saldo para todo componente que nunca movimentou. Componente sem linha de saldo é lido como 0, exatamente o que a soma anterior produzia. Comportamento observável idêntico (mesma comparação `currentStock < required`, mesmo evento).

#### QUALITY_SCRAP_HIGH
- **Quando:** Taxa de refugo acima do limite (padrão: 5%)
- **Destinatários:** `MANAGER` + o operador específico que registrou o apontamento
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
- **Destinatários:** `MANAGER` (corrigido em 01/09/2026 — buscava `BUYER`/`STOCK_MANAGER`, perfis inexistentes; não entregava a ninguém)
- **Ação:** Iniciar processo de compra
- **Nota técnica (corrigido em 02/09/2026):** `checkLowStock()` tinha o mesmo defeito de `MATERIAL_UNAVAILABLE` e pesava mais — rodando de 15 em 15 minutos, ressomava o histórico inteiro de `stock_movements` de **cada** produto ativo (uma varredura por produto, crescendo sem limite com o histórico). Agora lê `stock_balances` em uma consulta só, independentemente do número de produtos.

### **Prioridade MÉDIA (2)** 📊

#### CAPACITY_LOW
- **Implementado em 02/09/2026** (`notification-detector.service.ts::detectLowCapacity()`, chamado pelo cron de 2h). Até então não existia em lugar nenhum do código.
- **Quando:** centro de trabalho com demanda na fila produzindo **abaixo de 50%** da capacidade esperada nas últimas **8 horas**. É o oposto de `BOTTLENECK_DETECTED`: lá o sintoma é fila grande, aqui é saída pequena.
- **Destinatários:** `MANAGER` (mesmo padrão dos outros detectores de produção)
- **Ação:** Investigar parada — quebra, falta de operador, falta de material

**Parâmetros e por quê** (constantes no topo do método):

| Decisão | Valor | Motivo |
|---|---|---|
| Janela | 8h (um turno) | O cron roda de 2 em 2h, então as janelas se sobrepõem: uma parada real é pega na passada seguinte, mas um buraco de 30 min (setup, almoço) se dilui. Janela de 2h, colada no período do cron, alarmaria a cada setup normal. |
| Limiar | < 50% do esperado | Capacidade cadastrada é nominal e quase sempre otimista. Alarmar em 80–90% produziria notificação constante em operação saudável — e alerta que toca sempre é alerta que ninguém lê. |
| Expectativa | `capacity × efficiency × horas` | `efficiency` (default 1.0) já existe no schema como fator de rendimento; ignorá-lo compararia a produção contra uma meta que o próprio cadastro diz não ser alcançável. Assume `capacity` em **unidades/hora**. |
| `capacity` nulo | Não gera evento | Sem expectativa cadastrada não há contra o que comparar. É o default do schema (`Float?`), então centro não parametrizado fica silencioso em vez de virar ruído. |
| Centro ocioso | Não gera evento | Exige ao menos uma operação `PENDING`/`IN_PROGRESS`. Centro parado por não ter o que fazer não está "abaixo da capacidade", está ocioso. Com fila e sem saída é justamente o caso que interessa. |
| Dedupe | 6h | O mesmo de `BOTTLENECK_DETECTED` — mesmo público e mesma natureza de problema. |

Produção real vem de `ProductionPointing.quantityGood` somado por `endTime` dentro da janela, em **uma** consulta agregada (`groupBy`), não uma por centro.

#### OPERATION_COMPLETED
- **Quando:** Operação de produção concluída
- **Destinatários:** Operador, Gerente de Produção
- **Ação:** Informativo

---

## 🔐 Regras por Perfil

O sistema tem só três perfis, seedados em `backend/prisma/seed.ts`: **`ADMIN`, `MANAGER` e `OPERATOR`** (ver `docs/PERMISSOES_SISTEMA.md`). Até 01/09/2026, `notification-detector.service.ts` buscava destinatários também por `getUsersByRole('BUYER')`, `('QUALITY_MANAGER')` e `('STOCK_MANAGER')` — perfis que nunca existiram, então essas buscas sempre voltavam vazias e três eventos (incluindo o mais crítico do sistema, `STOCK_BELOW_SAFETY`) não entregavam a ninguém além do que `MANAGER` já cobria. **Corrigido nesta atualização**: as três chamadas às roles inexistentes foram removidas, consolidando em `MANAGER`.

### **ADMIN**
- Recebe: Todas as notificações
- Prioridade mínima: 1 (todas)
- Canais: In-app + Email (canal de email implementado em 02/09/2026 — ver "Canal de Email" abaixo)

### **MANAGER**
- Recebe: `PRODUCTION_DELAYED`, `BOTTLENECK_DETECTED`, `MATERIAL_UNAVAILABLE`, `QUALITY_SCRAP_HIGH`, `STOCK_BELOW_SAFETY`, `CAPACITY_LOW`, `OPERATION_COMPLETED` — todos os eventos reais do sistema.

### **OPERATOR (Operador)**
- Recebe **`QUALITY_SCRAP_HIGH`** — não por assinatura de perfil: o detector inclui diretamente `pointing.user` (quem registrou o apontamento que gerou o refugo alto), então é sempre o operador daquele apontamento específico, nunca "todo operador".
- **Não recebe** `OPERATION_COMPLETED` (vai só para `MANAGER` — é aviso *para* o gestor de que uma operação terminou, não confirmação *para* quem a completou) nem `MATERIAL_UNAVAILABLE`.
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
- **Bug corrigido em 02/09/2026:** a data de corte era montada com `cutoffDate.setDate(cutoffDate.setDate() - daysOld)`. `setDate()` **sem argumento** devolve `NaN` (e já corrompe a data), então o cálculo virava `setDate(NaN)` e `cutoffDate` era `Invalid Date`, que o Prisma rejeita ao montar o filtro. Na prática este cron **lançava erro em toda execução, de hora em hora, e nunca removeu uma linha sequer** — a limpeza de notificações antigas nunca funcionou. Corrigido para `getDate()`. (O `tsc` já sinalizava: `TS2554: Expected 1 arguments, but got 0`, um dos ~70 erros pré-existentes do backend.)

### **Diariamente às 8h** — real (implementado em 02/09/2026)
- `sendDailySummary()` — dígest do dia anterior por gestor. Era stub ("Resumo diário não implementado ainda").

**Formato escolhido:** uma notificação `INFO`, prioridade 1, categoria `PRODUCTION`, por gestor (`MANAGER`), com a **contagem** de notificações de prioridade alta (3) e crítica (4) recebidas no **dia civil anterior** (00:00–23:59) que continuam **não lidas**.

- *Dia civil anterior*, não "desde o último resumo": rodando às 8h é o recorte que o gestor interpreta sem pensar ("ontem"), e não exige guardar estado de quando o job rodou.
- *Só não lidas*: o objetivo é resgatar o que passou batido. Contar o que já foi lido e tratado viraria relatório de volume.
- *Só prioridade ≥ 3*: mesmo corte de `getCriticalUnread()`.
- *Sem pendência, sem notificação*: zero crítica e zero alta não gera nada — um resumo que chega todo dia dizendo "nada a relatar" treina o usuário a ignorar a categoria.
- *Prioridade 1 e `INFO`*: é dígest, não alerta; não deve competir no topo da lista com os eventos que resume.
- *Categoria `PRODUCTION`*: o resumo não tem categoria própria e o conjunto é fechado (`CreateNotificationDto`), consumido por `NotificationPreference`. Inventar `SYSTEM` criaria uma categoria que nenhuma preferência, seed ou tela conhece; `PRODUCTION` é a categoria majoritária dos eventos resumidos.
- Dedupe de 20h por `resourceId = userId`: reinício do processo no mesmo dia não gera segundo resumo.

Não é relatório de BI — é o job deixando de ser no-op.

### **A cada 2 horas** — real (implementado em 02/09/2026)
- `detectLowCapacity()` — centros produzindo abaixo do esperado (evento `CAPACITY_LOW`, ver "Eventos Implementados" para os parâmetros). Era stub ("Verificação de capacidade não implementada ainda").

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

## 📧 Canal de Email

**Implementado em 02/09/2026.** Antes, `NotificationRule.email` e `NotificationPreference.email` existiam no schema e eram populados pelo seed, mas **nenhum código enviava email — e nenhum código sequer lia essas duas tabelas**. Faltavam as duas metades: o transporte e a decisão. Ambas entraram agora.

### Transporte — `backend/src/services/email.service.ts`
`nodemailer`, transporte criado sob demanda e reaproveitado. Escopo deliberadamente pequeno:

- **Best-effort, fire-and-forget.** `sendNotificationEmail()` nunca lança. O registro in-app é o que não pode falhar: uma queda do SMTP não pode derrubar a persistência da notificação nem a resposta HTTP de quem a disparou.
- **Sem fila de retry.** Falha é logada e descartada. In-app continua sendo a entrega confiável; email é conveniência.
- **Sem template engine.** Assunto = `title`, corpo = `message` + prioridade + link. O `link` da notificação é rota do SPA (`/production/orders/<id>`), então é convertido em URL absoluta com `FRONTEND_URL` — sem isso o email chegaria com link morto.

### Modo no-op
Sem `SMTP_HOST` configurado o serviço **não cria transporte** e todo envio vira no-op, com **um** aviso no log (não um por email). O sistema sobe normalmente — SMTP não é obrigatório para o boot. É o estado de todo ambiente de desenvolvimento e do banco de teste, então é um modo suportado, não apenas tolerado.

### Variáveis de ambiente (todas opcionais, em `backend/.env.example`)

| Variável | Default | Nota |
|---|---|---|
| `SMTP_HOST` | *(vazio)* | Vazio = modo no-op. É o único gatilho que liga o canal. |
| `SMTP_PORT` | `587` | |
| `SMTP_SECURE` | derivado da porta | `true` só para 465 (TLS implícito); 587/25 usam STARTTLS. |
| `SMTP_USER` | *(vazio)* | |
| `SMTP_PASSWORD` | *(vazio)* | |
| `SMTP_FROM` | `Fabric PCP <nao-responda@fabric.local>` | |

`SMTP_USER`/`SMTP_PASSWORD` seguem opcionais mesmo com host configurado — relay interno sem autenticação é cenário real; `auth` só é passado ao transporte quando os dois existem.

### Decisão de quem recebe — `notification.service.ts::resolveEmailRecipients()`
Primeiro consumidor de `NotificationRule`/`NotificationPreference` em todo o backend. Como não havia lógica anterior para reaproveitar, ela foi definida assim:

1. **Preferência do usuário ganha da regra do perfil.** Existindo `NotificationPreference` para (usuário, categoria), ela decide sozinha: `enabled=false` ou `priority < minPriority` cortam, e o valor de `email` é a resposta final. É escolha explícita de quem recebe; o perfil não deve sobrepô-la.
2. **Sem preferência, vale a regra do perfil.** Qualquer `NotificationRule` habilitada, de qualquer perfil do usuário, para aquele `eventType`, com `priority >= minPriority` e `email=true`, autoriza o envio (OR entre perfis — superset, mesma semântica aditiva do RBAC do projeto).
3. **Default é não enviar.** Sem preferência e sem regra, não sai email — igual ao default `email=false` das duas colunas.

O **canal in-app não passa por aqui**: continua sendo criado para todo destinatário que o detector escolher, exatamente como antes. Filtrar in-app por essas mesmas tabelas mudaria o comportamento observável de todos os detectores — é outra tarefa.

O disparo acontece em `create()`/`createBulk()`, **depois** de persistir e **sem `await`**. Sem SMTP configurado sai antes de qualquer consulta: o modo no-op não custa três queries de regra/preferência por notificação.

---

## 📊 Dashboard de Métricas

### Endpoints reais

**`GET /api/v1/notifications/metrics`** — *já existia* (`notificationService.getMetrics()`), ao contrário do que a versão anterior deste documento registrava como "não verificado". É o que o `frontend/src/stores/notification.store.ts` consome hoje. **Mantido intacto.**

**`GET /api/v1/notifications/dashboard`** — **novo (02/09/2026)**, `getDashboard()`. Convive com o anterior em vez de substituí-lo. Escopado ao usuário logado via `req.userId` (não é dashboard administrativo global). Retorna:

- `criticalUnread` — não lidas de prioridade 4
- `highUnread` — não lidas de prioridade 3
- `totalUnread`
- `byCategory` — não lidas por categoria, **shape estável**: toda categoria conhecida presente com 0 quando vazia, incluindo `WAREHOUSE` (Fase 4 do WMS). O consumidor não precisa conhecer a lista nem tratar chave ausente.
- `topEvents` — top 5 `eventType` do período (`?days=`, **padrão 30**, validado 1–365 por Joi)
- `dailyTrend` — 7 dias, **contíguos** (dias sem notificação vêm com zero, não omitidos: série com buraco vira gráfico que mente sobre o intervalo entre pontos), com `total`/`critical`/`high` separados
- `period` — `{ topEventsDays, trendDays }`

O que este acrescenta sobre `/metrics`: **separa as duas janelas** (em `getMetrics()` um único `days` controlava top de eventos *e* série temporal, então o top tinha só 7 dias de amostra), **preenche a série** e **separa alta de crítica** na tendência (`getMetrics()` rotula como `critical` tudo que é `priority >= 3`).

**Fora de escopo, deliberadamente:** "Tempo médio de resposta" e "centros de trabalho mais críticos" — o primeiro exige modelar tempo entre criação e `readAt` com política de o que conta como resposta; o segundo é métrica de produção, não de notificação. Nenhum gráfico ou tela foi construído: o endpoint entrega os números, a tela é decisão de produto pendente.

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

### **Detectores — feito**
✅ `NotificationDetector` + 5 cron jobs em `notification-scheduler.service.ts`
✅ Eventos críticos implementados (código existe e roda)
✅ **Corrigido (01/09/2026):** `getUsersByRole('BUYER')`, `('QUALITY_MANAGER')` e `('STOCK_MANAGER')` buscavam perfis que não existem — as três chamadas foram removidas, consolidando em `MANAGER`. `STOCK_BELOW_SAFETY`, que não entregava a ninguém, agora entrega.
✅ **Feito (02/09/2026):** os dois cron jobs que eram stub agora fazem trabalho real — `detectLowCapacity()` (2h, evento `CAPACITY_LOW`) e `sendDailySummary()` (8h). Nenhum job do scheduler é mais no-op.
✅ **Corrigido (02/09/2026):** `checkMaterialAvailability()` e `checkLowStock()` leem `stock_balances` em vez de ressomar `stock_movements`.

### **UI — feito**
✅ Página completa de notificações, ícone com badge, dropdown

### **Canal de email — feito (02/09/2026)**
✅ `email.service.ts` (nodemailer, best-effort, modo no-op sem SMTP) + `resolveEmailRecipients()` lendo `NotificationRule`/`NotificationPreference` pela primeira vez. Ver seção "Canal de Email".

### **Dashboard de métricas — feito (02/09/2026)**
✅ Verificado: `/notifications/metrics` já existia. `/notifications/dashboard` acrescentado. Ver seção "Dashboard de Métricas".
⚠️ **Só backend.** Nenhuma tela foi construída — a tela de métricas é decisão de produto, pendente de uma conversa sobre padrão visual do frontend.

### **Pendente de verdade**
⏳ Agrupamento inteligente de notificações
⏳ Tela do dashboard de métricas (o endpoint existe e está testado; falta o consumidor)
⏳ "Tempo médio de resposta" e "centros de trabalho mais críticos" — os dois widgets do desenho original que o endpoint **não** entrega (ver nota na seção "Dashboard de Métricas")
⏳ Fila/retry para email — hoje o envio é best-effort e uma falha de SMTP é logada e descartada

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

**Última atualização:** 02/09/2026 (revisão 4 — as quatro pendências da revisão 3 resolvidas: (1) `checkMaterialAvailability()` e `checkLowStock()` lendo `stock_balances`; (2) canal de email real — `email.service.ts` + `resolveEmailRecipients()`, primeiro consumidor de `NotificationRule`/`NotificationPreference`; (3) `CAPACITY_LOW` e resumo diário implementados, nenhum cron job é mais stub; (4) `GET /notifications/dashboard` — e verificado que `/notifications/metrics` já existia. Bônus: `cleanupExpired()` montava `Invalid Date` e o cron de limpeza lançava erro de hora em hora sem nunca remover nada.)
**Versão:** 2.2

**Cobertura de testes desta revisão:** `tests/services/notification-detector.service.test.ts` (15), `tests/services/email.service.test.ts` (19), `tests/integration/notification-dashboard.test.ts` (8). Suíte completa: 28 arquivos, 261 testes, todos passando.
