# YMS — Cadastros Base (Docas, Motoristas/Veículos/Frotas, Parâmetros)

**Data:** 2026-09-08
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** 1 de 5 do YMS (as próximas, nesta ordem, são: Agendamento + Portaria/Check-in; Pátio; Operação de Doca; Dashboard/KPIs — cada uma com seu próprio ciclo spec → plano → implementação)

## 0. Contexto e origem

O usuário trouxe um documento de especificação de requisitos do YMS (Yard Management System) de outra plataforma (Senior X / Bluesoft ERP, `YMS Gestão de Pátio.pdf`) como referência de requisitos — não como spec literal a replicar feature a feature. O documento descreve 6 pilares (Agendamento, Portaria/Check-in, Pátio, Docas, Motoristas/Veículos, Dashboard/KPIs), grande demais para um spec só. Este documento cobre só o primeiro sub-projeto: os cadastros que os outros 4 pilares vão referenciar (Docas, Motoristas, Veículos, Frotas, Parâmetros por armazém).

**YMS já existe como módulo licenciável no schema** (`LicensedModule.code = 'YMS'`, hoje `enabled: false`) e a permissão `modules.view_yms` já está no seed, atribuída a ADMIN/MANAGER — infraestrutura de licenciamento e o gate de UI já estavam reservados, este é o primeiro sub-projeto a de fato usá-los.

## 1. Decisões de escopo (confirmadas com o usuário)

- **Docas do YMS reaproveitam o endereço físico do WMS.** Já existe `StoragePosition` com `positionType: DOCA` no WMS (posição endereçável onde a carga fica parada durante carga/descarga) — fisicamente é o mesmo lugar que o YMS chama de "doca". Decisão: nova entidade `YardDock`, com vínculo **opcional** (`storagePositionId` nullable) à `StoragePosition` existente — não estende `StoragePosition` (misturaria ocupação-por-saldo-de-estoque do WMS com ocupação-por-veículo do YMS, dois conceitos diferentes) nem cria um cadastro totalmente desvinculado (os dois cadastros divergiriam com o tempo).
- **Motoristas e Veículos pertencem a um `Supplier` já cadastrado** (transportadora/fornecedor) — não é um cadastro avulso. `Driver.supplierId` e `Vehicle.supplierId` são obrigatórios.
- **"Frota" é um subconjunto de veículos de um mesmo fornecedor**, não o fornecedor inteiro — nova entidade `Fleet`, pertence a um `Supplier`, agrupa `Vehicle`s daquele mesmo fornecedor. Bloquear uma frota bloqueia implicitamente todos os veículos vinculados a ela (checado na validação, não duplicado como campo em cada veículo).
- **Parâmetros são por Armazém** (`Warehouse`, já suporta múltiplos), não uma configuração única pra toda a instalação — plantas diferentes podem operar pátio de formas diferentes.
- **Auditoria de mudança de parâmetros não precisa de tabela nova.** Já existe `AuditLog` + `audit.middleware.ts` capturando usuário/data/valor antigo/valor novo automaticamente nas rotas mutantes — a rota de parâmetros do YMS só precisa passar por esse middleware como qualquer outra rota do projeto.
- **"Restrição por Planta" (usuário só vê os dados do seu armazém) fica fora de escopo desta rodada.** Não existe hoje nenhum vínculo `User`↔`Warehouse` no sistema — implementar isso de verdade é uma mudança transversal (afetaria WMS também, não só YMS), não algo do cadastro de Docas. YMS nasce sem essa restrição, mesmo padrão atual do WMS (usuário com permissão vê todos os armazéns). Registrado como melhoria futura transversal.
- **Validações de check-in (bloqueio de duplicidade de placa ativa, bloqueio de roteiro TMS repetido) ficam fora deste spec** — pertencem ao sub-projeto de Agendamento + Portaria, que consome os cadastros daqui mas ainda não foi especificado.
- **Status operacional de doca (Ocupada/Disponível) fica fora deste spec** — é estado de execução (qual veículo está em qual doca agora), pertence ao sub-projeto de Operação de Doca. Aqui só existe o cadastro estático da doca.

## 2. Desenho

### 2.1 Modelo de dados

```prisma
enum DockServiceType {
  RECEBIMENTO
  EXPEDICAO
  MULTIUSO
}

enum VehicleType {
  TRUCK
  TOCO
  CAVALO
  MECANICO
  VAN
  UTILITARIO
  OUTROS
}

model YardWarehouseParams {
  id                     String   @id @default(uuid())
  warehouseId            String   @unique
  useYard                Boolean  @default(true)  // "Uso de Pátio" - se false, fluxo é Portaria -> Doca direto
  delayToleranceMinutes  Int      @default(15)     // 0-60, validado no Joi
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  warehouse Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)

  @@map("yard_warehouse_params")
}

model YardDock {
  id                String           @id @default(uuid())
  code              String           // único por armazém, não globalmente - ver validação
  serviceType       DockServiceType
  warehouseId       String
  storagePositionId String?          @unique // vínculo opcional 1:1 com StoragePosition (tipo DOCA)
  active            Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  warehouse       Warehouse        @relation(fields: [warehouseId], references: [id])
  storagePosition StoragePosition? @relation(fields: [storagePositionId], references: [id], onDelete: SetNull)

  @@unique([warehouseId, code])
  @@map("yard_docks")
}

model Fleet {
  id            String   @id @default(uuid())
  name          String
  supplierId    String
  blocked       Boolean  @default(false)
  blockedReason String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  supplier Supplier  @relation(fields: [supplierId], references: [id])
  vehicles Vehicle[]

  @@map("fleets")
}

model Driver {
  id            String   @id @default(uuid())
  name          String
  cpf           String   @unique
  supplierId    String
  blocked       Boolean  @default(false)
  blockedReason String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  supplier Supplier @relation(fields: [supplierId], references: [id])

  @@map("drivers")
}

model Vehicle {
  id            String      @id @default(uuid())
  plate         String      @unique // validado nos 2 formatos (Mercosul/antigo) no Joi, não no banco
  type          VehicleType
  supplierId    String
  fleetId       String?
  blocked       Boolean     @default(false)
  blockedReason String?
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  supplier Supplier @relation(fields: [supplierId], references: [id])
  fleet    Fleet?   @relation(fields: [fleetId], references: [id], onDelete: SetNull)

  @@map("vehicles")
}
```

**Relações reversas obrigatórias nos models existentes** (Prisma exige os dois lados de toda relação declarados, senão o schema não valida): `Warehouse` precisa ganhar `yardParams YardWarehouseParams?` e `docks YardDock[]`; `Supplier` precisa ganhar `fleets Fleet[]`, `drivers Driver[]` e `vehicles Vehicle[]`; `StoragePosition` precisa ganhar `yardDock YardDock?`. Nenhum campo próprio novo nesses 3 models, só as relações reversas.

**Invariante validada no service, não no banco (Prisma não expressa FK cruzada condicional):** se `Vehicle.fleetId` for informado, a `Fleet` referenciada precisa ter o MESMO `supplierId` do veículo — não é possível colocar um veículo de um fornecedor numa frota de outro fornecedor. Erro 400 claro se violado, mesmo padrão de validação cruzada já usado em outros services do projeto (ex.: `assertEquipmentExists` em Manutenção).

`YardDock.code` é único por armazém (`@@unique([warehouseId, code])`), não globalmente — dois armazéns podem ter uma "Doca 1" cada, seguindo o mesmo padrão de `StoragePosition.code`/`streetCode`, que também são escopados por armazém.

### 2.2 Validação de placa

Dois formatos aceitos, sem hífen (Joi, em `vehicle.validator.ts`):
- **Mercosul**: `/^[A-Z]{3}\d[A-Z]\d{2}$/` (3 letras, 1 número, 1 letra, 2 números — ex. `ABC1D23`)
- **Antigo**: `/^[A-Z]{3}\d{4}$/` (3 letras, 4 números — ex. `ABC1234`)

```typescript
const PLATE_REGEX = /^([A-Z]{3}\d[A-Z]\d{2}|[A-Z]{3}\d{4})$/
```

Entrada normalizada para maiúsculas antes de validar/salvar (transformação no validator, não confiar em o frontend já mandar maiúsculo).

### 2.3 RBAC e licenciamento

Segue exatamente o padrão já estabelecido (Manutenção, WMS):
- Módulo licenciável: `requireModule('YMS')` no ponto de mount de todas as rotas novas (`routes/index.ts`), nunca rota a rota.
- Recurso RBAC `yard`, ações `visualizar` (leitura) e `gerenciar` (CRUD de docas/motoristas/veículos/frotas, bloquear/desbloquear, editar parâmetros). Sem ação `executar` nesta etapa — não há nenhuma operação de execução nos cadastros base (isso aparece nos próximos sub-projetos, quando houver ações como "iniciar carga/descarga").
- `modules.view_yms` já existe no seed — não precisa ser criado, só efetivamente usado pela primeira vez.
- Frontend não consulta licenciamento — gate de UI é só a permissão RBAC, igual aos demais módulos.

### 2.4 Frontend

4 telas novas, seguindo o padrão `DataTable.vue` + `AppModal.vue` já usado em Equipment/MaintenancePlan, nativas em dark mode desde o primeiro commit:
- `YardDockListView.vue` — CRUD de docas, seletor de armazém, campo de busca por código de `StoragePosition` pra vincular (opcional). **Não cria endpoint novo no WMS**: reaproveita `GET /storage-positions/by-code/:code`, que já existe — só é usável por quem também tem `estruturas_armazem:visualizar` (natural para ADMIN/MANAGER, que já têm as duas permissões; um usuário só-YMS sem essa permissão simplesmente não vê/usa esse campo, cadastra a doca sem vínculo).
- `DriverListView.vue` — CRUD de motoristas, seletor de fornecedor, ação de bloquear/desbloquear com motivo.
- `VehicleListView.vue` — CRUD de veículos, seletor de fornecedor, seletor de frota (filtrado pelo fornecedor escolhido), ação de bloquear/desbloquear.
- `FleetListView.vue` — CRUD de frotas, seletor de fornecedor, ação de bloquear/desbloquear (com aviso de quantos veículos serão afetados).

Mais uma tela pequena, não uma listagem:
- Seção "Parâmetros de Pátio" dentro da tela de edição/detalhe de Armazém já existente (ou uma nova sub-rota `/warehouses/:id/yard-params`, a task de implementação decide o melhor encaixe na navegação existente) — `useYard` (toggle) e `delayToleranceMinutes` (input numérico 0-60).

**A aba "Pátio" no Dashboard já existe** (`DashboardView.vue`, `activeTab === 'yms'`, gate `authStore.canViewYMS` — computed já implementado em `auth.store.ts`, ligado a `modules.view_yms`), como placeholder com 5 cards desabilitados ("Em breve"): Agendamento, Docas, Check-in/out, Tempo de Pátio, Relatórios YMS. Esta etapa: trocar o card "Docas" por um `RouterLink` de verdade (mesmo padrão da aba Manutenção) e ADICIONAR 3 novos cards ativos (Motoristas, Frotas, Veículos) — os outros 4 cards (Agendamento, Check-in/out, Tempo de Pátio, Relatórios YMS) continuam "Em breve", pertencem a sub-projetos futuros.

### 2.5 O que NÃO entra nesta etapa

- Agendamento de veículos, check-in de portaria, validações de duplicidade de placa/roteiro ativo — sub-projeto seguinte.
- Alocação de vaga de pátio, chamada automática de veículos, bloqueio por área/vaga — sub-projeto de Pátio.
- Status operacional de doca (OC/DP), início/término de carga/descarga — sub-projeto de Operação de Doca.
- Dashboard consolidado de Portaria/Pátio/Doca, KPIs, modo histórico — sub-projeto de Dashboard/KPIs.
- Restrição de visibilidade por planta (usuário↔armazém) — fora de escopo, melhoria transversal futura (seção 1).
- Integração com TMS (agendamento de expedição via roteiro) — o projeto não tem módulo de TMS; se/quando o sub-projeto de Agendamento for especificado, tratar como cadastro manual de agendamento, não integração automática.

## 3. Testes

- Backend: testes de integração (Jest + MySQL real) para CRUD de cada um dos 5 recursos (`YardWarehouseParams`, `YardDock`, `Driver`, `Vehicle`, `Fleet`), RBAC (`yard:visualizar`/`gerenciar`), licenciamento (`requireModule('YMS')` retorna 404 com módulo desabilitado), e os 2 casos de validação cruzada: placa em formato inválido rejeitada; veículo não pode ser colocado em frota de outro fornecedor.
- Frontend: Vitest + Vue Test Utils, mesmo padrão de Manutenção (Pinia real, só a camada HTTP mockada) para as 4 views + a seção de parâmetros.
- Sem testes E2E manuais previstos neste sub-projeto (cadastro puro, sem fluxo operacional pra validar contra o banco real) — a verificação end-to-end faz mais sentido quando o sub-projeto de Agendamento/Portaria também estiver pronto e o ciclo completo puder ser testado.
