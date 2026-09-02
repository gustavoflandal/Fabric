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

#### LOT_EXPIRED — categoria `WAREHOUSE`, só com WMS licenciado
- **Implementado em 02/09/2026** (`notification-detector.service.ts::checkExpiringLots()`, chamado pelo job diário `backend/src/jobs/lot-expiry.job.ts`). Complemento da Fase 5 do WMS.
- **Quando:** `Lot.expiresAt` **no passado** e o lote **ainda com saldo** em alguma posição (`StockPositionBalance.quantity > 0`). Sem limite inferior — lote vencido há 400 dias com saldo alerta igual.
- **Destinatários:** `MANAGER` (mesmo padrão dos outros detectores de armazém/produção)
- **Ação:** Dar baixa via ajuste (`OUT` com `referenceType = 'ADJUSTMENT'` — ver F5.7) e liberar o endereço
- **Por que prioridade 4 (crítica):** o bloqueio de saída da Fase 5 (`stock.service.ts::assertLotNotExpiredForOutbound()`) é o *depois*: ele impede o vencido de sair, mas não impede que ele **continue ali**. O FEFO deixa de escolhê-lo, o picking recusa, e o lote some do fluxo ocupando endereço — enquanto o saldo agregado (`stock_balances`) ainda o conta como material disponível para o MRP. Não é aviso sobre o futuro, é estado errado do armazém agora, o mesmo degrau de `MATERIAL_UNAVAILABLE` e do `NO_SOURCE` da reposição.
- **`resourceType`/`resourceId`:** `Lot` / `lot.id`. `data` traz `productId`, `productCode`, `productName`, `lotNumber`, `expiresAt`, `days` (dias desde o vencimento), `totalQuantity` e **`positions`** — a lista completa de `{positionId, positionCode, quantity}` onde o saldo está parado. A mensagem mostra no máximo 3 endereços (`e mais N`); a lista inteira fica sempre no payload, porque o endereço exato é informação de quem vai executar a baixa.
- **`link`:** `/stock/products/<productId>` — a Fase 5 foi backend-only e não existe tela de lote; apontar para uma rota inventada seria pior que reusar a que `STOCK_BELOW_SAFETY` já usa.

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

#### LOT_EXPIRING_SOON — categoria `WAREHOUSE`, só com WMS licenciado
- **Implementado em 02/09/2026**, mesmo detector e mesmo job de `LOT_EXPIRED`.
- **Quando:** `Lot.expiresAt` dentro da **janela de alerta** (default **7 dias**, `LOT_EXPIRY_ALERT_DAYS`) **e** o lote ainda com saldo em alguma posição.
- **Destinatários:** `MANAGER`
- **Ação:** Priorizar a saída do lote (o FEFO da F5.6 já o coloca na frente), escalar para quem compra/vende, ou programar a baixa
- **Por que prioridade 3 e não 2:** o critério que o resto do sistema já usa é *prioridade 2 = diagnóstico* (`CAPACITY_LOW` — nada se perde se ficar dias sem leitura) e *prioridade 3 = prazo com consequência* (`STOCK_BELOW_SAFETY`, `PRODUCTION_DELAYED`, `REPLENISHMENT_NEEDED`). Lote a vencer é a forma mais dura de prazo que existe aqui — janela curta, **não renovável**, e o custo de perdê-la é a perda física do material. Fica no mesmo degrau de `STOCK_BELOW_SAFETY`: os dois dizem "aja nos próximos dias ou vai faltar material", um por falta, outro por vencimento.

**Condição comum aos dois eventos — "ainda com saldo":** lote sem saldo em posição alguma já foi consumido, expedido ou baixado; ele permanece na tabela como rastreabilidade histórica (`Restrict` nas FKs, F5.1/F5.2). Alertar sobre a validade de um lote que não existe mais no armazém seria ruído **crescente e permanente** — a cada dia a base tem mais lotes vencidos já tratados. Lote **sem `expiresAt`** também não gera evento nenhum (a coluna é nula de propósito: nem todo lote tem validade).

**Janela de alerta — `LOT_EXPIRY_ALERT_DAYS`** (`backend/src/config/env.ts`, mesmo padrão de `AUDIT_LOG_RETENTION_DAYS`):

| Decisão | Valor | Motivo |
|---|---|---|
| Janela default | 7 dias | Menor antecedência em que ainda cabe um ciclo de decisão completo (consultar, priorizar a saída, escalar ou dar baixa) sem depender de alguém de plantão no dia. 1–2 dias avisaria quando já não há o que fazer; 30 dias viraria relatório de inventário — num armazém com giro normal quase todo lote estaria na janela todo dia, e alerta que lista quase tudo não prioriza nada. |
| Configurável | `LOT_EXPIRY_ALERT_DAYS` | Prazo de validade é o parâmetro do domínio que mais varia entre instalações: alimento fresco quer 2–3 dias, insumo químico com descarte regulado quer 60–90. |
| Valor inválido | Cai no default | Ausente, não numérico, zero ou negativo. Janela 0 não é configuração, é o desligamento silencioso de metade do detector (só sobraria `LOT_EXPIRED`) — e silêncio por erro de digitação em `.env` é o pior modo de falha para um alerta. |
| Dedupe | **24h, por evento** | As 6h de `REPLENISHMENT_NEEDED` existem porque reposição muda dentro de um turno; validade não muda em uma hora. 24h é o mesmo de `STOCK_BELOW_SAFETY` e casa com a periodicidade diária do job: uma execução, uma notificação por lote. ⚠️ A chave é **(eventType, lotId)**, não só o lote — é isso que garante que a virada de `LOT_EXPIRING_SOON` para `LOT_EXPIRED` seja notificada; uma chave só por lote faria o aviso de véspera engolir justamente o alerta crítico do dia do vencimento. |
| Posição bloqueada | **Não é filtrada** | Ao contrário de F4.10, aqui não se gera tarefa que precise ser executável. Lote vencido numa posição bloqueada continua sendo exatamente o problema que o evento descreve. |

**Sem service separado** (diferente de `REPLENISHMENT_NEEDED`, que tem `replenishment.service.ts`): a reposição **cria tarefa** — tem regra de negócio, escrita e dedupe próprios, e é chamável fora da notificação. O alerta de validade é leitura pura, uma consulta e duas mensagens; um service só para embrulhar um `findMany` seria camada sem conteúdo. A consulta é **uma só** para os dois eventos (tudo que vence antes do horizonte inclui o que já venceu); a separação é feita em memória comparando com `now`.

#### REPLENISHMENT_NEEDED — categoria `WAREHOUSE`, só com WMS licenciado
- **F4.10 do plano do WMS** (`checkReplenishmentNeeded()`, job `backend/src/jobs/replenishment.job.ts`). Primeiro evento module-aware do sistema, e o que estabeleceu o padrão da categoria `WAREHOUSE`.
- **Quando:** saldo de uma posição de picking abaixo de `max(minStock, safetyStock)` do produto.
- **Prioridade:** 3 (`WARNING`) no caso normal — tarefa `REPLENISHMENT` gerada a partir do pulmão; **4 (`ERROR`)** quando não há saldo no pulmão para repor (`NO_SOURCE`), porque aí nem tarefa nasce e quem age é o supervisor, não o operador.
- **Dedupe:** 6h (reposição muda dentro de um turno), em duas camadas — a **tarefa** é deduplicada em `replenishment.service.ts` enquanto houver reposição aberta para o mesmo (produto, posição); a **notificação**, por `checkRecentNotification`.

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
- Recebe: `PRODUCTION_DELAYED`, `BOTTLENECK_DETECTED`, `MATERIAL_UNAVAILABLE`, `QUALITY_SCRAP_HIGH`, `STOCK_BELOW_SAFETY`, `CAPACITY_LOW`, `OPERATION_COMPLETED` — todos os eventos reais do núcleo PCP — e, **com o módulo WMS licenciado**, `REPLENISHMENT_NEEDED`, `LOT_EXPIRING_SOON` e `LOT_EXPIRED` (categoria `WAREHOUSE`).
- Os três eventos de armazém vão para `MANAGER` **por falta de perfil melhor**, não por escolha: um `WAREHOUSE_SUPERVISOR` seria o alvo certo no dia em que existir. Inventar `roleCode` que não está no seed é o defeito de 01/09/2026 documentado abaixo — produz notificação sem nenhum destinatário.

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

### **Jobs do WMS — fora do `notification-scheduler.service.ts`**

Os detectores condicionados a licença **não** moram no agendador acima. Cada um tem arquivo próprio em `backend/src/jobs/`, registrado em `server.ts`, com `isModuleEnabled('WMS')` na entrada e um `runManually()` para apuração sob demanda:

| Job | Frequência | Detector / evento |
|---|---|---|
| `replenishment.job.ts` | `*/30 6-22 * * *` (a cada 30 min, 6h–22h) | `checkReplenishmentNeeded()` → `REPLENISHMENT_NEEDED` |
| `lot-expiry.job.ts` | `0 6 * * *` (diariamente às 6h) | `checkExpiringLots()` → `LOT_EXPIRING_SOON` e `LOT_EXPIRED` |
| `stock-position-reconciliation.job.ts` | diário | invariante saldo por posição × saldo agregado (F1.3, não gera notificação) |

**Por que não são um sexto `cron.schedule` no scheduler:** aquele agendador é do **núcleo PCP**. Ele não importa `isModuleEnabled` em lugar nenhum, não tem nenhum job condicionado a licença e loga com `console.log` em vez do `logger` do winston. Colocar ali um job que só existe com WMS licenciado faria o agendador do núcleo passar a conhecer módulo opcional — exatamente a dependência que a seção 3.4 de `04_ARQUITETURA_MODULAR_LICENCIAMENTO.md` manda evitar.

**Por que a validade roda 1×/dia, e às 6h:** validade é função da **data** — entre uma execução e a seguinte o único evento possível é a virada do dia, então rodar de hora em hora produziria 24 varreduras para descobrir a mesma coisa (e o dedupe de 24h descartaria 23 delas). 6h é o início da janela do job de reposição, ou seja, a hora em que o armazém abre: o alerta já está no sino quando o primeiro turno chega. Fica **fora** das 8h do resumo diário de propósito — aquele resumo conta as não lidas do **dia civil anterior**, então um lote alertado hoje às 6h entra no resumo de amanhã, que é o comportamento certo (o resumo é a segunda chance de quem não leu, não uma duplicata imediata). Lote **vencido** com saldo sobe no log como `error`, e não `warn`: enquanto ninguém agir, o `stock_balances` está respondendo errado sobre o que há em estoque.

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

### **Módulos além do PCP (WMS/YMS) — feito para o WMS**
Registrado como pendente em 01/09/2026, resolvido pelas Fases 4b e 5 do plano do WMS. O padrão da seção 3.4 de `docs/fase-2026-09-modernizacao/04_ARQUITETURA_MODULAR_LICENCIAMENTO.md` está aplicado nos três eventos module-aware que existem hoje:

✅ `REPLENISHMENT_NEEDED` (F4.10) — o primeiro, que estabeleceu a categoria `WAREHOUSE`
✅ `LOT_EXPIRING_SOON` e `LOT_EXPIRED` (Fase 5, complemento de 02/09/2026)

Em todos: categoria `WAREHOUSE` dedicada (nunca `STOCK` — `NotificationPreference` é **por categoria**, e misturar as duas obrigaria o comprador que quer alerta de estoque baixo a receber tarefa de armazém, e vice-versa), `isModuleEnabled('WMS')` **antes** da consulta (fail-closed) e job próprio fora do `notification-scheduler.service.ts`.

⏳ **YMS** continua sem nenhum evento — nada a fazer até o módulo existir.

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

**Cobertura de testes da revisão 4:** `tests/services/notification-detector.service.test.ts` (15), `tests/services/email.service.test.ts` (19), `tests/integration/notification-dashboard.test.ts` (8). Suíte completa naquele momento: 28 arquivos, 261 testes.

---

**Revisão 5 — 02/09/2026:** alerta de **validade de lote** (`LOT_EXPIRING_SOON` prioridade 3 / `LOT_EXPIRED` prioridade 4, categoria `WAREHOUSE`), complemento da Fase 5 do WMS que ficou de fora do escopo original. Novo detector `checkExpiringLots()`, novo job diário `backend/src/jobs/lot-expiry.job.ts` (6h), nova variável `LOT_EXPIRY_ALERT_DAYS` (default 7). Nesta revisão o documento também passou a registrar `REPLENISHMENT_NEEDED` (F4.10), que existia no código desde a Fase 4b mas nunca tinha entrado aqui, e a seção "Módulos além do PCP" deixou de estar desatualizada. **Sem migration** — `Lot.expiresAt` e `StockPositionBalance.quantity` já existiam; o detector é leitura pura.

**Versão:** 2.3

**Cobertura de testes desta revisão:** `tests/services/lot-expiry-notification.service.test.ts` (17) — os dois eventos disparando, borda exata da janela, lote sem saldo / com linha zerada / sem `expiresAt` não disparando, dedupe por evento (incluindo a virada de "a vencer" para "vencido") e o detector não rodando sem WMS licenciado. Suíte completa: **31 arquivos, 308 testes, todos passando**; `npx tsc --noEmit` sem nenhum erro novo (os 66 restantes são os pré-existentes já documentados, nenhum nos arquivos tocados).
