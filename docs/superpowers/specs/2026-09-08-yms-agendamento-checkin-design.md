# YMS — Agendamento de Veículos + Portaria (Check-in)

**Data:** 2026-09-08
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** 2 de 5 do YMS (depende da Etapa 1 — Cadastros Base — estar implementada: `Driver`, `Vehicle`, `Fleet`, `YardWarehouseParams`, `DockServiceType`)

## 0. Contexto e origem

Segunda etapa do YMS, decomposta do documento de referência `YMS Gestão de Pátio.pdf` (Senior X/Bluesoft, usado como referência de requisitos, não replicado literalmente). Cobre os pilares "Agendamento de Veículos" e a parte de "Check-in" do pilar "Controle de Portaria" do documento — as seções 3.3 e o Step 1 ("Portaria/Check-in") da seção 4.

**Pré-requisito**: esta etapa consome `Driver`, `Vehicle`, `YardWarehouseParams` (para `delayToleranceMinutes`) da Etapa 1 (Cadastros Base) — precisa dela implementada primeiro.

## 1. Decisões de escopo (confirmadas com o usuário)

- **Agendamento e Check-in são a MESMA entidade** (`YardVisit`), não dois modelos separados — o documento já trata como uma jornada contínua (uma visita nasce agendada ou nasce já no check-in, para o caso de quem chega sem agendamento prévio — "Registro de entrada (Manual/TMS/Pedido)" é uma ação listada na própria Portaria, não só no Agendamento).
- **Expedição nasce só manual nesta etapa.** O documento pede integração automática de agendamento de Expedição com roteiros de TMS — este projeto não tem TMS nem um conceito de pedido de venda/expedição para se apoiar. Recebimento SIM tem integração automática (via `PurchaseOrder`, que já existe). Não há plano de adicionar TMS ou um "pedido de expedição" só para viabilizar isso agora.
- **Sem roteamento para Pátio/Doca nesta etapa.** O documento permite "Direcionar para Pátio ou Doca" já no check-in, mas alocação de vaga de pátio e operação de doca (status OC/DP) são sub-projetos futuros (Etapas 3 e 4), ainda não especificados. `YardVisit` para nesta etapa em `CHECKED_IN` — sem campo de destino, sem ação de rotear.
- **Status de pontualidade (NO_HORARIO/ANTECIPADO/ATRASADO) é calculado, nunca persistido** — mesmo critério já usado em MTBF/MTTR de Manutenção ("nunca salvar o que dá para derivar"). Compara `scheduledAt` contra `checkedInAt` (ou contra agora, se ainda não fez check-in) usando `YardWarehouseParams.delayToleranceMinutes` do armazém da visita.
- **"Excluir agendamento" só é permitido em `status: SCHEDULED`.** Depois do check-in, o registro vira histórico de auditoria — só pode ser cancelado (`status: CANCELLED`), nunca apagado.
- **RBAC: nova ação `yard:executar`**, seguindo o mesmo padrão de três ações já usado em `manutencao` (visualizar/executar/gerenciar). `executar` cobre criar agendamento (incluindo preenchimento manual, equivalente à "Permissão 3765" do documento) e fazer check-in. `yard:gerenciar` (já existente da Etapa 1) passa a cobrir editar/excluir/cancelar agendamento — sem distinção de "próprio vs. de terceiro": o modelo não rastreia quem criou a visita (`createdBy` fica fora de escopo, não há requisito citado para isso), então a permissão é a mesma para qualquer visita.
- **Sem campo `source` separado.** A origem do registro ("Inclusão Manual" vs "Agendamento de Recebimento") é derivada de `purchaseOrderId` ser nulo ou não — um campo `source` redundante violaria DRY. "Roteiro TMS" nunca é um valor possível de origem neste projeto (sem TMS), não precisa aparecer no vocabulário.

## 2. Desenho

### 2.1 Modelo de dados

```prisma
enum YardVisitStatus {
  SCHEDULED
  CHECKED_IN
  CANCELLED
}

model YardVisit {
  id              String            @id @default(uuid())
  warehouseId     String
  serviceType     DockServiceType
  supplierId      String?
  purchaseOrderId String?
  scheduledAt     DateTime
  status          YardVisitStatus   @default(SCHEDULED)
  notes           String?           @db.VarChar(70)
  driverId        String?
  vehicleId       String?
  checkedInAt     DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  warehouse     Warehouse      @relation(fields: [warehouseId], references: [id])
  supplier      Supplier?      @relation(fields: [supplierId], references: [id])
  purchaseOrder PurchaseOrder? @relation(fields: [purchaseOrderId], references: [id])
  driver        Driver?        @relation(fields: [driverId], references: [id])
  vehicle       Vehicle?       @relation(fields: [vehicleId], references: [id])

  @@index([warehouseId, status])
  @@index([vehicleId, status])
  @@map("yard_visits")
}
```

Reaproveita `DockServiceType` (RECEBIMENTO/EXPEDICAO/MULTIUSO) da Etapa 1 — mesmo vocabulário, sem duplicar enum. `notes` já nasce `@db.VarChar(70)` (não `String?` puro) — o limite de 70 caracteres do documento é um requisito de negócio explícito, vale reforçar no schema, não só no validator (lição do achado de Manutenção sobre `VARCHAR(191)` vs `@db.Text`: aqui é o caso oposto, um limite pequeno e deliberado, então o tipo do banco deve refletir exatamente esse limite, não deixar `String?` genérico que o MySQL trataria como `VARCHAR(191)` por padrão, folgado demais para a regra de negócio).

**Relações reversas obrigatórias nos models existentes**: `Warehouse` ganha `yardVisits YardVisit[]`; `Supplier` ganha `yardVisits YardVisit[]`; `PurchaseOrder` ganha `yardVisits YardVisit[]`; `Driver` ganha `yardVisits YardVisit[]`; `Vehicle` ganha `yardVisits YardVisit[]`.

### 2.2 Cálculo de pontualidade (nunca persistido)

```typescript
type PunctualityStatus = 'NO_HORARIO' | 'ANTECIPADO' | 'ATRASADO'

function computePunctuality(
  scheduledAt: Date,
  referenceTime: Date, // checkedInAt se já fez check-in, senão "agora"
  toleranceMinutes: number
): PunctualityStatus {
  const diffMinutes = (referenceTime.getTime() - scheduledAt.getTime()) / 60000
  if (Math.abs(diffMinutes) <= toleranceMinutes) return 'NO_HORARIO'
  return diffMinutes < 0 ? 'ANTECIPADO' : 'ATRASADO'
}
```

Calculado no backend (service), devolvido como campo derivado na resposta da API (nunca gravado no banco) — mesmo padrão de `computeMttr`/`computeMtbfByEquipment` em `maintenance-kpi.service.ts`, que também nunca persistem o resultado.

### 2.3 Validações críticas de check-in

Ao fazer check-in (`PATCH /yard-visits/:id/check-in`, com `driverId`+`vehicleId` no corpo):
1. **Motorista bloqueado**: `Driver.blocked === true` → rejeitar (400).
2. **Veículo bloqueado**: `Vehicle.blocked === true` → rejeitar (400).
3. **Duplicidade de placa ativa**: existe outra `YardVisit` com o mesmo `vehicleId` em `status: CHECKED_IN` → rejeitar (400) — é a checagem "já possui operação ativa na Portaria, Pátio ou Doca" do documento; nesta etapa, "ativa" significa `CHECKED_IN` (não há ainda estado de Pátio/Doca para checar, serão adicionados nos sub-projetos seguintes sem precisar mudar esta regra — é a mesma condição, só que o conjunto de status que conta como "ativo" cresce depois).
4. **Motorista e veículo pertencem ao mesmo fornecedor** da visita (`driver.supplierId === visit.supplierId` e `vehicle.supplierId === visit.supplierId`) — quando `visit.supplierId` está preenchido. Se a visita for Expedição manual sem fornecedor definido, esta checagem não se aplica.

### 2.4 RBAC e licenciamento

- Nova ação `yard:executar` (seed da Etapa 1 precisa ser atualizado: adicionar a ação à tabela de permissões e a MANAGER/OPERATOR, mesmo padrão de `manutencao: ['visualizar', 'executar', 'gerenciar']`).
- Rotas: `POST /yard-visits` (criar agendamento) e `PATCH /yard-visits/:id/check-in` exigem `yard:executar`. `PUT /yard-visits/:id` (editar) e `DELETE /yard-visits/:id` exigem `yard:gerenciar`. `GET` exige `yard:visualizar`.
- `requireModule('YMS')` no ponto de mount, mesmo padrão da Etapa 1.

### 2.5 Frontend

Uma tela: `YardVisitListView.vue` — lista agendamentos e check-ins (mesma entidade), com coluna de pontualidade (calculada, badge colorido: verde=NO_HORARIO, azul=ANTECIPADO, vermelho=ATRASADO) que só aparece quando aplicável (uma visita `CANCELLED` não mostra pontualidade). Duas ações de criação:
- "Novo Agendamento": formulário com fornecedor (opcional para Expedição), tipo de serviço, data/hora, observação (max 70). Se tipo RECEBIMENTO e um `PurchaseOrder` for selecionado, pré-preenche fornecedor/data a partir dele.
- "Check-in Direto" (walk-in): mesmo formulário do agendamento, mais motorista+veículo, cria já em `CHECKED_IN`.

Na listagem, uma visita `SCHEDULED` tem os botões "Fazer Check-in" (abre modal pedindo motorista+veículo) e "Excluir" (só neste status); uma visita `CHECKED_IN` tem só "Cancelar"; nenhuma ação de exclusão depois do check-in.

Este trabalho preenche o card "Agendamento" da aba "Pátio" do Dashboard (hoje "Em breve"). O card "Check-in/out" continua "Em breve" — cobre só a metade "check-in" aqui (dentro do mesmo fluxo de "Agendamento"), "checkout/liberação" é fase futura (Etapa 4, Operação de Doca).

### 2.6 O que NÃO entra nesta etapa

- Alocação de vaga de pátio, chamada automática de veículos, bloqueio por área/vaga — Etapa 3 (Pátio).
- Status operacional de doca (OC/DP), início/término de carga/descarga, checkout/liberação — Etapa 4 (Operação de Doca).
- Integração com TMS ou qualquer pedido de expedição/venda — não existe no projeto, fora de escopo indefinidamente até que essa necessidade surja de verdade.
- Bloqueio de roteiro TMS repetido — não aplicável sem TMS.
- Dashboard consolidado, KPIs, modo histórico — Etapa 5.
- Restrição de visibilidade por planta (usuário↔armazém) — fora de escopo desde a Etapa 1, mesma decisão vale aqui.

## 3. Testes

- Backend: testes de integração (Jest + MySQL real) cobrindo: criação de agendamento manual; criação de agendamento de Recebimento pré-preenchido a partir de `PurchaseOrder`; check-in bem-sucedido calculando pontualidade correta nos 3 casos (no horário, antecipado, atrasado); as 4 validações da seção 2.3 (motorista bloqueado, veículo bloqueado, placa duplicada ativa, motorista/veículo de fornecedor diferente da visita); exclusão permitida só em `SCHEDULED`; cancelamento de visita já com check-in.
- Frontend: Vitest + Vue Test Utils, mesmo padrão das etapas anteriores (Pinia real, só a camada HTTP mockada).
