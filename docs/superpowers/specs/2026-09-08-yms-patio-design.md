# YMS — Pátio (Áreas, Vagas e Alocação)

**Data:** 2026-09-08
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** 3 de 5 do YMS (depende das Etapas 1 — Cadastros Base — e 2 — Agendamento + Check-in — estarem implementadas: consome `YardWarehouseParams.useYard`, e estende o `YardVisit` da Etapa 2)

## 0. Contexto e origem

Terceira etapa do YMS, decomposta do documento de referência `YMS Gestão de Pátio.pdf` (Senior X/Bluesoft, usado como referência de requisitos, não replicado literalmente). Cobre a parte de "Gestão de Pátio & Mapeamento" do pilar 3 do documento, a tabela de "Bloqueio por Área"/"Bloqueio por Vaga" da seção 3.2, e o Step 2 ("Pátio — Intermediário") da seção 4.

## 1. Decisões de escopo (confirmadas com o usuário)

- **"Chamada automática de veículos" fica fora desta etapa.** O documento lista essa ação junto de "Alocação em vaga de pátio" e "Movimentação para Doca", mas chamar o próximo veículo pressupõe saber quais docas estão livres (status OC/DP) — isso só existe na Etapa 4 (Operação de Doca), ainda não especificada. Esta etapa cobre só o que não depende de doca: cadastro de áreas/vagas e **alocação manual** de um veículo numa vaga livre.
- **"Quantidade de vagas" é um parâmetro de geração em lote, não um cadastro vaga a vaga.** Em vez de cadastrar cada vaga manualmente, o admin informa a quantidade e o sistema gera as vagas numeradas automaticamente dentro de uma área — mesmo padrão de `generatePositions` já usado no WMS para `StoragePosition`, e o mesmo espírito da "Inclusão em Lote" que o documento descreve para Docas. O cadastro individual continua existindo por cima disso, para ajustes pontuais (editar, bloquear uma vaga específica).
- **Capacidade do pátio é derivada, não um campo próprio.** Não existe um número de "capacidade máxima" configurado separadamente — é sempre a contagem de `YardSpot` ativas e não bloqueadas. Um campo redundante correria o risco de divergir da realidade (a mesma lição do porquê `StoragePosition.occupied` foi removido do WMS, `F0.4` do schema — ocupação sempre derivada, nunca uma flag própria).
- **Áreas/Vagas são conceito só do YMS, sem vínculo com o WMS.** Diferente das Docas (Etapa 1, que reaproveitam `StoragePosition` do tipo `DOCA`), pátio é espaço externo pra estacionar caminhão — não tem equivalente nenhum na estrutura de armazenagem interna do WMS (`WarehouseStructure`/`StoragePosition` modelam prateleiras/posições de estoque, não vagas de estacionamento).
- **A ação "Alocar Vaga" só existe quando `YardWarehouseParams.useYard = true`** do armazém da visita — se o armazém não usa pátio, o fluxo vai direto de `CHECKED_IN` pra Doca (Etapa 4), sem passar por `IN_YARD`.
- **Sem card próprio previsto no Dashboard original.** O documento não citou "Áreas e Vagas" como um dos 5 cards da aba Pátio (Agendamento/Docas/Check-in-out/Tempo de Pátio/Relatórios YMS) — os 3 restantes ("Em breve") têm outro significado (checkout, métricas de tempo, relatórios). Esta etapa adiciona um card NOVO à grade, "Pátio: Áreas e Vagas", em vez de forçar em algum dos cards existentes.

## 2. Desenho

### 2.1 Modelo de dados

```prisma
model YardArea {
  id            String   @id @default(uuid())
  warehouseId   String
  code          String
  name          String
  active        Boolean  @default(true)
  blocked       Boolean  @default(false)
  blockedReason String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  warehouse Warehouse  @relation(fields: [warehouseId], references: [id])
  spots     YardSpot[]

  @@unique([warehouseId, code])
  @@map("yard_areas")
}

model YardSpot {
  id            String   @id @default(uuid())
  areaId        String
  code          String
  active        Boolean  @default(true)
  blocked       Boolean  @default(false)
  blockedReason String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  area   YardArea    @relation(fields: [areaId], references: [id])
  visits YardVisit[]

  @@unique([areaId, code])
  @@map("yard_spots")
}
```

`YardVisit` (Etapa 2) ganha um campo e um novo valor de enum:

```prisma
enum YardVisitStatus {
  SCHEDULED
  CHECKED_IN
  IN_YARD    // novo — visita alocada numa vaga de pátio
  CANCELLED
}
```

```prisma
// Dentro de YardVisit, adicionar:
  yardSpotId String?

  // Dentro das relações de YardVisit, adicionar:
  yardSpot YardSpot? @relation(fields: [yardSpotId], references: [id])
```

**Relações reversas obrigatórias**: `Warehouse` ganha `yardAreas YardArea[]`.

`YardSpot.code` é único por área (`@@unique([areaId, code])`), não globalmente — mesmo critério já usado em `YardDock.code` (único por armazém) na Etapa 1.

### 2.2 Geração em lote de vagas

`POST /yard-areas/:areaId/spots/generate`, corpo `{ count: number }` (1-500, validado no Joi — um teto alto o bastante pra qualquer pátio real, baixo o bastante pra não permitir gerar um número absurdo por engano). Gera `count` vagas com código sequencial `${area.code}-01`, `${area.code}-02`, ... (padding de 2 dígitos até 99, 3 dígitos a partir de 100 — mesma lógica de padding usada em `buildPositionCode` do WMS, adaptada). Continua a numeração a partir da maior sequência já existente na área (não reinicia do 01 se a área já tem vagas — evita colidir com o `@@unique([areaId, code])`).

```typescript
async function generateSpots(areaId: string, count: number) {
  const area = await assertAreaExists(areaId)
  const existing = await prisma.yardSpot.count({ where: { areaId } })
  const spots = []
  for (let i = 1; i <= count; i++) {
    const sequence = existing + i
    spots.push({ areaId, code: `${area.code}-${String(sequence).padStart(2, '0')}` })
  }
  return prisma.yardSpot.createMany({ data: spots })
}
```

### 2.3 Alocação de vaga

`PATCH /yard-visits/:id/allocate-spot`, corpo `{ yardSpotId }`. Validações:
1. Visita precisa estar em `status: CHECKED_IN` (não dá pra alocar vaga de um agendamento que ainda não chegou, nem de uma visita já `IN_YARD`/`CANCELLED`).
2. `YardWarehouseParams.useYard` do armazém da visita precisa ser `true` — reaproveita `yardWarehouseParamsService.getByWarehouseId` (Etapa 1).
3. A vaga (`YardSpot`) precisa existir, estar `active`, não `blocked`, e sua `YardArea` também precisa estar `active`/não `blocked`.
4. A vaga precisa estar livre — nenhuma outra `YardVisit` com `status: IN_YARD` referenciando o mesmo `yardSpotId`.
5. A área da vaga precisa pertencer ao MESMO armazém da visita (`yardSpot.area.warehouseId === visit.warehouseId`).

Ao alocar: `status` vira `IN_YARD`, `yardSpotId` é preenchido. Não existe ação de "desalocar" nesta etapa — sair de `IN_YARD` (rumo a uma doca) é ação da Etapa 4, que vai reutilizar este mesmo campo/relação sem precisar de migration nova.

### 2.4 RBAC e licenciamento

- `yard:gerenciar` (já existente): CRUD de área/vaga, geração em lote, bloquear/desbloquear área/vaga.
- `yard:executar` (já existente, Etapa 2): ganha mais uma ação coberta — alocar visita em vaga.
- `requireModule('YMS')` no ponto de mount, mesmo padrão das etapas anteriores.

### 2.5 Frontend

- `YardAreaListView.vue` — CRUD de áreas, com link "Ver Vagas" por linha levando a `/yard/areas/:areaId/spots`.
- `YardSpotListView.vue` — vagas de UMA área (rota com `areaId` no path), com ação "Gerar vagas em lote" (modal pedindo a quantidade) e bloquear/desbloquear individual. Mostra, por vaga, se está livre ou qual placa está alocada nela agora (join com `YardVisit` em `IN_YARD`).
- `YardVisitListView.vue` (Etapa 2, modificada): visitas `CHECKED_IN` ganham o botão "Alocar Vaga" — só aparece quando `YardWarehouseParams.useYard` do armazém da visita é `true` (a view já carrega os parâmetros do armazém para o cálculo de pontualidade, reaproveita a mesma chamada). Abre modal listando vagas livres do armazém (todas as áreas, agrupadas visualmente por área).
- Novo card "Pátio: Áreas e Vagas" na grade da aba "Pátio" do Dashboard, ao lado dos cards já existentes (Agendamento, Docas, Motoristas, Frotas, Veículos — todos das Etapas 1 e 2 — mais os 3 "Em breve" que continuam intactos: Check-in/out, Tempo de Pátio, Relatórios YMS).

### 2.6 O que NÃO entra nesta etapa

- Chamada automática de veículos — depende de status de doca (Etapa 4).
- Movimentação de `IN_YARD` para Doca, checkout/liberação — Etapa 4.
- Mapa visual/gráfico do pátio (o documento menciona "localização exata de cada veículo" — esta etapa cobre a alocação lógica numa vaga com código, não um mapa 2D interativo; se isso vier a ser pedido, é um incremento futuro de UI sobre o mesmo modelo de dados).
- Dashboard consolidado, KPIs, modo histórico — Etapa 5.
- Restrição de visibilidade por planta — fora de escopo desde a Etapa 1.

## 3. Testes

- Backend: testes de integração cobrindo: geração em lote respeitando a numeração sequencial e continuando a partir do maior código já existente; rejeição de `count` fora do intervalo 1-500; alocação bem-sucedida transicionando `CHECKED_IN` → `IN_YARD`; as 5 validações da seção 2.3 (visita em status errado, `useYard` desligado, vaga/área bloqueada ou inativa, vaga já ocupada, vaga de armazém diferente da visita).
- Frontend: Vitest + Vue Test Utils, mesmo padrão das etapas anteriores.
