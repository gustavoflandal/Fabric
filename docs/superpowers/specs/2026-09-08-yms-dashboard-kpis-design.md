# YMS — Dashboard Consolidado e KPIs

**Data:** 2026-09-08
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** 5 de 5 do YMS (última) — depende das Etapas 1-4 estarem implementadas: agrega dados de `YardVisit` (Etapas 2-4), `YardSpot`/`YardArea` (Etapa 3), `YardDock` (Etapa 1), e do `AuditLog` genérico do projeto (já existente, fora do YMS).

## 0. Contexto e origem

Última etapa do YMS, decomposta do documento de referência `YMS Gestão de Pátio.pdf`, seção 6 ("Dashboard Consolidado & KPI's Operacionais"). É uma etapa só de LEITURA — agrega dados que as 4 etapas anteriores já produzem, sem introduzir nenhum novo conceito de domínio.

## 1. Decisões de escopo (confirmadas com o usuário)

- **Escopo por armazém é obrigatório** — um seletor no topo da tela, default o primeiro armazém licenciado. Sem isso, "ocupação %" não teria um denominador único (cada armazém tem seu próprio conjunto de vagas/docas). Mesmo critério já usado em `YardWarehouseParamsView` (Etapa 1) e nos dashboards de KPI já existentes do projeto (WMS, Manutenção).
- **Dois modos de consulta, um parâmetro (`days`)**: omitido = Modo Tempo Real (visitas ainda abertas: `CHECKED_IN`/`IN_YARD`/`AT_DOCK`); informado = Modo Histórico (visitas com `createdAt` dentro da janela, incluindo `COMPLETED`/`CANCELLED`) — mesmo padrão de `days` já usado em `wms-kpi.service.ts` e `maintenance-kpi.service.ts`.
- **Ocupação % nunca é `0` por falta de dado** — se o armazém não tem nenhuma vaga (`YardSpot`) ou nenhuma doca (`YardDock`) cadastrada, o indicador correspondente é `null` ("sem dados"), não `0%`. Mesmo critério de MTBF/MTTR de Manutenção.
- **"Modelo" do veículo** — retroagido à Etapa 1 (`Vehicle.model`, opcional) num commit separado, antes deste spec, especificamente porque esta etapa precisa exibi-lo na grade.
- **"Responsável pela movimentação" vem do `AuditLog` genérico do projeto**, não de um campo novo em `YardVisit`. O `AuditLog` já captura usuário+ação+data em toda rota mutante automaticamente (`audit.middleware.ts`) — a grade busca, em LOTE (uma consulta pra todas as visitas da página, nunca uma por linha), a entrada mais recente de cada visita por `resourceId`.
- **Sem tela de CRUD** — esta etapa é só leitura, uma view (`YardDashboardView.vue`).
- **Os 2 cards "Em breve" restantes ("Tempo de Pátio", "Relatórios YMS") somem e viram UM card só ("Dashboard")** — o documento trata isso como um painel consolidado único, não duas telas separadas; manter os dois como conceitos distintos criaria uma divisão artificial que o próprio documento não pede.

## 2. Desenho

### 2.1 Endpoint agregador

`GET /yard-dashboard?warehouseId=<uuid>&days=<number opcional>`

Sem model novo — o service consulta `YardVisit`, `YardSpot`, `YardDock` e `AuditLog` diretamente (já existentes) e monta a resposta agregada. Formato de resposta:

```typescript
interface YardDashboardResponse {
  mode: 'REALTIME' | 'HISTORICAL'
  totals: {
    portaria: number  // status CHECKED_IN
    patio: number     // status IN_YARD
    doca: number       // status AT_DOCK
  }
  occupancy: {
    patioPercent: number | null   // patio / vagas ativas não-bloqueadas, null se não há vaga cadastrada
    docaPercent: number | null    // doca / docas ativas, null se não há doca cadastrada
    patioRatio: string | null     // ex.: "3/10", null junto com patioPercent
    docaRatio: string | null
  }
  visits: YardDashboardVisitRow[]
}

interface YardDashboardVisitRow {
  id: string
  plate: string | null
  driverName: string | null
  vehicleModel: string | null
  serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO'
  supplierName: string | null
  origin: 'MANUAL' | 'PURCHASE_ORDER'          // derivado de purchaseOrderId
  currentLocation: 'PORTARIA' | 'PATIO' | 'DOCA' | 'CONCLUIDA' | 'CANCELADA'  // derivado do status
  scheduledAt: string
  punctuality: 'NO_HORARIO' | 'ANTECIPADO' | 'ATRASADO' | null
  performedBy: string | null                    // nome do usuário, do AuditLog
  notes: string | null
  totalDurationMinutes: number | null            // só quando CONCLUIDA
}
```

### 2.2 Cálculo dos totais e ocupação

```typescript
async function getDashboard(warehouseId: string, days?: number) {
  const mode = days ? 'HISTORICAL' : 'REALTIME'
  const where = days
    ? { warehouseId, createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } }
    : { warehouseId, status: { in: ['CHECKED_IN', 'IN_YARD', 'AT_DOCK'] } }

  const visits = await prisma.yardVisit.findMany({
    where,
    include: { supplier: true, driver: true, vehicle: true },
    orderBy: { scheduledAt: 'desc' },
  })

  const totals = {
    portaria: visits.filter((v) => v.status === 'CHECKED_IN').length,
    patio: visits.filter((v) => v.status === 'IN_YARD').length,
    doca: visits.filter((v) => v.status === 'AT_DOCK').length,
  }

  const [activeSpots, activeDocks] = await Promise.all([
    prisma.yardSpot.count({ where: { active: true, blocked: false, area: { warehouseId, active: true, blocked: false } } }),
    prisma.yardDock.count({ where: { warehouseId, active: true } }),
  ])

  const occupancy = {
    patioPercent: activeSpots > 0 ? Math.round((totals.patio / activeSpots) * 100) : null,
    docaPercent: activeDocks > 0 ? Math.round((totals.doca / activeDocks) * 100) : null,
    patioRatio: activeSpots > 0 ? `${totals.patio}/${activeSpots}` : null,
    docaRatio: activeDocks > 0 ? `${totals.doca}/${activeDocks}` : null,
  }

  // "Portaria" NUNCA tem ocupação % — o documento é explícito sobre isso (seção 6.2:
  // "A Portaria exibe apenas o volume total, pois não possui teto estático de
  // capacidade"). Não existe um `occupancy.portariaPercent` na resposta.

  const performedByMap = await getLatestPerformerByVisit(visits.map((v) => v.id))

  return { mode, totals, occupancy, visits: visits.map((v) => toDashboardRow(v, performedByMap)) }
}
```

### 2.3 Busca em lote do "responsável" via `AuditLog`

**Verificado contra o código real de `audit.middleware.ts` antes de fechar este spec** (não assumido): o middleware genérico do projeto NÃO grava `resourceId` no caminho de captura automática — só o decorator de classe `@AuditLog(resource, action)` (usado explicitamente por quem escreve um controller, não é automático) preenche esse campo, e nenhuma rota do YMS usa esse decorator. `resource` também não serve como filtro confiável: é derivado do ÚLTIMO segmento do path (`pathParts[pathParts.length - 1]`) — pra `PATCH /yard-visits/:id/check-in` isso grava `resource: 'check-in'`, não `'yard-visits'`; pra `PUT /yard-visits/:id` grava o próprio UUID da visita como "resource". Nenhum dos dois campos serve pra filtrar por visita do jeito que a primeira versão deste spec assumia.

O campo `resource` É previsível para as rotas de ação nomeada de `yard-visit.routes.ts` (Etapas 2-4) — pra `PATCH /yard-visits/:id/check-in`, o último segmento do path é literalmente `check-in`; o mesmo vale para `move-to-dock`, `start-loading`, `end-loading`, `complete`, `cancel`, `allocate-spot`. `AuditLog` já tem `@@index([resource])` (schema atual, não precisa de migration) — filtrar por esse campo é indexado, ao contrário de filtrar por `endpoint` (sem índice) ou por `createdAt` sozinho (sem índice). A rota genérica `PUT /yard-visits/:id` (editar agendamento) fica de fora deste cálculo de propósito: seu `resource` gravado seria o próprio UUID da visita (inconsistente, não filtrável), e editar campos de agendamento não é uma "movimentação" no sentido operacional que a grade quer mostrar — só as 7 ações de ciclo de vida contam.

```typescript
const VISIT_LIFECYCLE_ACTIONS = [
  'check-in', 'allocate-spot', 'move-to-dock', 'start-loading', 'end-loading', 'complete', 'cancel',
]
const VISIT_ID_IN_ENDPOINT = /\/yard-visits\/([a-f0-9-]{36})/i

async function getLatestPerformerByVisit(visitIds: string[]): Promise<Map<string, string>> {
  if (visitIds.length === 0) return new Map()

  // Filtro por `resource` (indexado) reduz o conjunto a só as ações de
  // ciclo de vida de QUALQUER visita do sistema — o UUID de qual visita é
  // extraído do `endpoint` depois, no lado da aplicação, e cruzado com
  // `visitIds` (as visitas desta página do dashboard).
  const logs = await prisma.auditLog.findMany({
    where: { resource: { in: VISIT_LIFECYCLE_ACTIONS } },
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { name: true } } },
  })

  const relevantIds = new Set(visitIds)
  const map = new Map<string, string>()
  for (const log of logs) {
    const match = log.endpoint?.match(VISIT_ID_IN_ENDPOINT)
    const visitId = match?.[1]
    if (visitId && relevantIds.has(visitId) && !map.has(visitId) && log.user) {
      map.set(visitId, log.user.name)
    }
  }
  return map
}
```

Ordenado por `createdAt: 'desc'`, o primeiro `endpoint` que bate com cada UUID (via `!map.has(visitId)`) é sempre o mais recente. **Limitação aceita**: esta consulta ainda varre TODAS as entradas de `AuditLog` com esses 7 valores de `resource`, de QUALQUER visita já criada no sistema (não só as da página atual) — o índice em `resource` torna isso rápido mesmo assim (não é um full table scan do `AuditLog` inteiro, que também registra todas as OUTRAS rotas do projeto inteiro), mas a task de implementação deve medir o volume real antes de assumir que isso escala indefinidamente; se o `AuditLog` crescer muito, um filtro adicional por `createdAt` (aceitando o custo de não ter índice nessa coluna sozinha) ou uma janela fixa (ex.: só os últimos 90 dias) é o ajuste natural, sem mudar a forma da consulta.

### 2.4 RBAC e licenciamento

- `GET /yard-dashboard` exige `yard:visualizar` (já existente) — é só leitura, não precisa de `executar`/`gerenciar`.
- `requireModule('YMS')` no ponto de mount, mesmo padrão das etapas anteriores.

### 2.5 Frontend

Uma tela, `YardDashboardView.vue`:
- Seletor de armazém no topo (obrigatório, default o primeiro).
- Seletor de período (`days`): vazio/"Tempo real" ou 7/30/90 dias — mesmo padrão de seletor já usado em `MaintenanceKpiDashboardView.vue`/`WmsKpiDashboardView.vue`.
- 3 cards de totais (Portaria/Pátio/Doca) + os 2 indicadores de ocupação % (Pátio/Doca — sem card de ocupação pra Portaria, conforme a regra da seção 2.2).
- Tabela com a grade detalhada (`DataTable.vue`, mesmo padrão das demais listagens do projeto, mas sem ações de CRUD — é só leitura).
- Substitui os 2 cards "Em breve" restantes ("Tempo de Pátio", "Relatórios YMS") por UM card "Dashboard" na grade da aba "Pátio".

### 2.6 O que NÃO entra nesta etapa

- Exportação (PDF/Excel) da grade — o documento não pede isso explicitamente pra este dashboard (WMS/Manutenção também não têm essa função nos seus próprios dashboards de KPI), fica como possível incremento futuro se pedido.
- Gráficos/visualizações além dos cards e da grade — os KPIs de WMS/Manutenção usam gráficos Chart.js; este dashboard é majoritariamente tabular por natureza (o documento descreve "grade detalhada", não gráficos), mantendo consistência com o que foi pedido, não com o que outros dashboards do projeto têm.
- Qualquer melhoria/automação das etapas anteriores (chamada automática, restrição por planta) — permanecem fora de escopo, como já registrado nos specs 1-4.

## 3. Testes

- Backend: testes de integração cobrindo: modo tempo real (só visitas abertas); modo histórico (inclui `COMPLETED`/`CANCELLED` dentro da janela, exclui fora dela); ocupação `null` quando não há vaga/doca cadastrada; ocupação calculada corretamente quando há; origem derivada corretamente (`MANUAL` vs `PURCHASE_ORDER`); local atual derivado corretamente para cada status; "responsável" retornando o usuário mais recente do `AuditLog` para uma visita com múltiplas ações registradas (ex.: check-in por um usuário, depois check-out por outro — confirma que retorna o do check-out, não o do check-in).
- Frontend: Vitest + Vue Test Utils, mesmo padrão das etapas anteriores.
