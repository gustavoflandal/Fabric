# Análise de Implementação — WMS (Warehouse Management System)

**Data:** 01/09/2026 (revisão 2.1)
**Versão:** 2.1 (revisão da seção 5 — substitui a v2.0, mesma data)
**Branch de análise:** `revisao-plano-wms-modular`
**Escopo:** análise do estado real do schema e do código, decisão arquitetural sobre endereçamento físico, e plano faseado para completar o WMS.
**Natureza deste documento:** análise e planejamento. Nenhum código, schema ou migration foi alterado na produção deste documento.

---

## Nota sobre a versão anterior

A versão 1.0 (22/10/2025) está obsoleta e foi integralmente substituída. Ela partia de um schema que não existe mais e propunha criar do zero componentes que hoje já estão implementados (saldo de estoque persistido, plano de contagem multiproduto, atribuição de contadores por papel, recebimento de compras funcional). Além disso, o arquivo continha, ao final, um bloco de texto colado por engano — transcrição de uma sessão de trabalho de outro ambiente, referenciando um documento inexistente neste repositório e uma stack de frontend que este projeto nunca usou. Esse bloco foi removido.

Para o registro: o frontend do Fabric é **100% Vue 3**, decisão formalizada em [`fase-2026-09-modernizacao/03_DECISAO_STACK_FRONTEND.md`](./fase-2026-09-modernizacao/03_DECISAO_STACK_FRONTEND.md).

## Nota sobre a revisão 2.1

A v2.0 tratava "Fase 4 — Recebimento" e "Fase 5 — Separação e tarefas" como fases sequenciais e quase independentes. Uma decisão de arquitetura posterior — [`04_ARQUITETURA_MODULAR_LICENCIAMENTO.md`](./04_ARQUITETURA_MODULAR_LICENCIAMENTO.md) — estabeleceu que **não são independentes**: o Fabric licencia módulos por instalação (um cliente pode ter só o PCP), e quando o WMS está licenciado, tanto o recebimento quanto a separação passam a ser a **mesma mecânica** — uma sequência de tarefas (`WarehouseTask`) despachadas para coletor de dados ou smartphone (descarga, conferência, etiquetagem, quarentena, alocação no recebimento; picking na separação). Sem WMS licenciado, o recebimento continua exatamente como funciona hoje — linear, sem tarefas.

Esta revisão funde as antigas Fases 4 e 5 numa só (nova Fase 4, seção 5), adiciona a extensão condicional de `Product` com dados de armazenagem (peso, volume, embalagem, empilhamento, segregação — pré-requisito de negócio identificado na mesma decisão) e adiciona a superfície de API para dispositivo móvel, que não estava escopada antes. A Fase 6 (lote/validade, condicional) permanece igual, renumerada para Fase 5.

---

## 1. Sumário executivo

O Fabric hoje tem **duas modelagens independentes de "onde as coisas ficam guardadas"**, que não se conhecem, não se referenciam e não compartilham nenhum dado:

| | `Location` | `Warehouse` → `WarehouseStructure` → `StoragePosition` |
|---|---|---|
| Modelagem | Árvore auto-referenciada genérica, 6 tipos | Três níveis fixos: armazém → estrutura (rua) → posição (andar/posição) |
| API dedicada | **Nenhuma** (sem service, controller, rota ou validator) | Completa: 3 services, 3 controllers, 3 arquivos de rotas com RBAC e validators |
| Frontend | **Nenhum** | 3 services, 2 stores Pinia, 2 views Vue roteadas |
| Uso no domínio | `CountingItem.locationId` (opcional) — **nunca preenchido por código nenhum** | Nenhum: não tem relação com `Product`, `StockBalance`, `StockMovement`, `CountingItem` nem `Location` |
| Dados | Apenas via `backend/prisma/seed-locations.ts` | Via API e `backend/scripts/seed-warehouses.ts` / `seed-warehouse-structures.ts` |

Ou seja: um subsistema é **schema morto** (existe no banco, não é escrito por nenhuma linha de código de aplicação), e o outro é um **cadastro vivo mas ilhado** (tem CRUD completo ponta a ponta, mas nenhum fluxo de estoque, produção ou contagem o utiliza).

**Recomendação central (detalhada na seção 4): consolidar todo o endereçamento físico em `Warehouse → WarehouseStructure → StoragePosition`, depreciar e remover `Location` e o enum `LocationType`.** A migração de dados é trivial porque `CountingItem.locationId` está sempre `NULL` na prática.

O que falta para o Fabric ter um WMS de fato não é modelar endereços — é **ligar o endereço ao estoque**: saldo por posição, movimentação com origem/destino, endereçamento no recebimento e contagem por endereço. É isso que o plano faseado da seção 5 cobre.

---

## 2. Estado atual — o que existe de fato

Levantamento feito sobre `backend/prisma/schema.prisma` (1150 linhas), `backend/src/{services,controllers,routes,validators}/` e `frontend/src/`.

### 2.1 Saldo de estoque — `StockBalance` (schema linha ~309)

Existe e está funcional. É um **agregado por produto**, não por localização:

```prisma
model StockBalance {
  id        String   @id @default(uuid())
  productId String   @unique
  quantity  Float    @default(0)
  version   Int      @default(0)
  updatedAt DateTime @updatedAt
  product   Product  @relation(fields: [productId], references: [id])
  @@map("stock_balances")
}
```

- `productId` é `@unique` → **uma linha por produto**. Não há `locationId`, `lotNumber` nem qualquer outra dimensão.
- Foi introduzido na Fase 1 (itens 1.1/1.2 de [`02_CRONOGRAMA_IMPLEMENTACOES.md`](./fase-2026-09-modernizacao/02_CRONOGRAMA_IMPLEMENTACOES.md)) para substituir o cálculo de saldo em memória somando `stock_movements` a cada consulta — o problema não era só performance, era que **não existia linha para travar**, então duas movimentações concorrentes liam o mesmo saldo fantasma.
- `stock.service.ts::applyMovement()` faz `upsert` da linha, depois `SELECT quantity FROM stock_balances WHERE productId = ? FOR UPDATE` (raw), valida saldo, cria a movimentação e atualiza `quantity` + `version`. Tudo dentro da transação do chamador. Há `registerMovementInTransaction()` público para chamadores que já têm transação própria (usado por `purchase-receipt.service.ts::cancel()`).

**Ponto de atenção para o WMS:** `getAllBalances()` itera todos os produtos ativos chamando `getBalance()` um a um, e cada `getBalance()` faz 2-3 queries (produto, saldo, última movimentação). É um N+1 que hoje já custa caro e que **multiplicaria** ao adicionar uma dimensão de localização. Ver item F0.5 do plano.

### 2.2 Movimentação — `StockMovement` (schema linha ~531)

```
productId, type (String: IN | OUT | ADJUSTMENT), quantity (Float), reason,
reference (String?), referenceType (String?), countingSessionId (String?, FK),
userId, notes, createdAt
```

- **Não tem** `fromLocationId`, `toLocationId`, `lotNumber` nem qualquer referência a posição.
- `type` é `String` livre, não enum, com três valores documentados em comentário. **Não existe `TRANSFER`** — transferência interna não é representável hoje.
- `reference`/`referenceType` são polimórficos, sem FK (documentado como intencional no schema).
- `countingSessionId` é FK dedicada, criada na Fase 1 item 1.3 para substituir o uso indevido de `reference` para ajustes de contagem. É o **precedente do projeto** para "referência que merece integridade referencial ganha FK própria" — vale para o endereçamento também.
- Índices: `[productId]`, `[productId, createdAt]`, `[type]`, `[createdAt]`, `[reference]`, `[referenceType, reference]`.

### 2.3 `Location` (schema linha ~804) — schema morto

```prisma
model Location {
  id, code (@unique), name, type (LocationType), parentId, active, createdAt, updatedAt
  parent   Location?  @relation("LocationHierarchy", ...)
  children Location[] @relation("LocationHierarchy")
  countingItems CountingItem[]
}

enum LocationType { WAREHOUSE, AREA, CORRIDOR, SHELF, BIN, FLOOR }
```

Verificações feitas:

| Verificação | Resultado |
|---|---|
| `backend/src/services/location.service.ts` | Não existe |
| `backend/src/controllers/location.controller.ts` | Não existe |
| `backend/src/routes/location.routes.ts` | Não existe; `routes/index.ts` não registra `/locations` |
| Ocorrências de `locationId` em `backend/src/` | **Zero** |
| Ocorrências de `Location` em `backend/src/` | 5, todas `include: { location: true }` em `counting-item.service.ts` (4) e `counting-session.service.ts` (1) |
| `frontend/src/` — service, store ou view de localização | Não existe (só o campo `locationId?: string` em `types/counting.types.ts`) |
| Origem dos dados | Exclusivamente `backend/prisma/seed-locations.ts` |

A única relação de domínio de `Location` é `CountingItem.locationId` (opcional). E `counting-session.service.ts`, ao criar os itens da sessão, faz `createMany` passando apenas `sessionId`, `productId`, `systemQty` e `status` — **`locationId` nunca é informado**. Não há endpoint que o preencha depois. Portanto a coluna é `NULL` para 100% dos itens de contagem gerados pelo sistema.

Consequência prática: a constraint `@@unique([sessionId, productId, locationId])` de `CountingItem` funciona hoje como `@@unique([sessionId, productId])`, já que a terceira coluna é sempre nula.

### 2.4 `Warehouse` / `WarehouseStructure` / `StoragePosition` (schema linhas ~1061-1149) — cadastro vivo e ilhado

Modelagem de três níveis com endereçamento de rack real:

```
Warehouse (code, name, dados cadastrais, capacity)
  └── WarehouseStructure  (streetCode, floors, positions, weightCapacity,
                           height, width, depth, maxHeight, blocked, positionType)
        └── StoragePosition (warehouseCode, streetCode, floor, position, positionType,
                             weightCapacity, height, width, depth, maxHeight,
                             blocked, occupied)
```

`enum PositionType`: `PORTA_PALETES`, `MINI_PORTA_PALETES`, `DRIVE_IN`, `DRIVE_THROUGH`, `PUSH_BACK`, `FLOW_RACK`, `CANTILEVER`, `MEZANINO`, `AUTOPORTANTE`, `RACKS`, `CARROSSEL`, `MINI_LOAD`, `ESTANTES_INDUSTRIAIS` — nomenclatura de estruturas de armazenagem reais.

Está **cabeado ponta a ponta**:

| Camada | Arquivos |
|---|---|
| Services | `warehouse.service.ts`, `warehouse-structure.service.ts`, `storage-position.service.ts` |
| Controllers | `warehouse.controller.ts`, `warehouse-structure.controller.ts`, `storage-position.controller.ts` |
| Rotas | `warehouse.routes.ts`, `warehouse-structure.routes.ts`, `storage-position.routes.ts`, todas registradas em `routes/index.ts` (`/warehouses`, `/warehouse-structures`, `/storage-positions`) |
| RBAC | `requirePermission('armazens', ...)` aplicado (Fase 2 item 2.1) |
| Validators | `warehouse.validator.ts`, `warehouse-structure.validator.ts`, `storage-position.validator.ts` (Fase 2 item 2.2) |
| Frontend | `services/warehouse.service.ts`, `services/warehouse-structure.service.ts`, `services/storage-position.service.ts`; `stores/warehouse.store.ts`, `stores/warehouse-structure.store.ts`; views `WarehousesView.vue`, `WarehouseStructuresView.vue` (roteadas) |
| Seeds | `backend/scripts/seed-warehouses.ts`, `backend/scripts/seed-warehouse-structures.ts` |

`storage-position.service.ts::generatePositions()` gera as posições combinatoriamente a partir da estrutura (`floors × positions`), herdando capacidade, dimensões, `positionType` e `blocked` da estrutura-pai.

**Três problemas encontrados neste subsistema**, todos relevantes antes de usá-lo como base do WMS:

1. **O código do endereço não é persistido.** `getPositionsByStructure()` monta o código em memória:
   `${warehouseCode}-${streetCode}-${floor(2)}-${position(2)}`.
   Não existe coluna `code`, portanto não há índice único sobre o endereço, não há como buscar uma posição pelo código (o que um leitor de código de barras exige), e nada impede duas estruturas de gerarem o mesmo endereço textual.

2. **`occupied` é uma flag morta.** Nenhuma linha do backend ou do frontend escreve nesse campo — busca por `occupied` retorna zero ocorrências fora do próprio schema (que ainda mantém `@@index([occupied])`). É um campo denormalizado que passaria a divergir do saldo real no instante em que a alocação existisse.

3. **Só representa posição de rack.** Todos os campos dimensionais (`weightCapacity`, `height`, `width`, `depth`, `maxHeight`) e `floors`/`positions` são obrigatórios em `WarehouseStructure`. Não há como representar área de piso, doca, quarentena, área de bloqueio ou expedição — que um WMS precisa endereçar tanto quanto um porta-paletes.

E, o mais importante: **`StoragePosition` não tem nenhuma relação com `Product`, `StockBalance`, `StockMovement`, `CountingItem` ou `Location`.** É um cadastro de estrutura física sem consumidor de negócio.

### 2.5 Módulo de contagem — maduro, não precisa ser refeito

`CountingPlan`, `CountingSession`, `CountingItem`, `CountingPlanProduct`, `CountingAssignment` + enums `CountingType`, `CountingFrequency`, `CountingPlanStatus`, `SessionStatus`, `CountingItemStatus`, `CounterRole` (schema linhas ~824-1059).

Já resolvido e em produção:

- Plano com **múltiplos produtos** (`CountingPlanProduct`, com `priority`).
- **Múltiplos contadores por sessão, com papel** (`CountingAssignment` + `CounterRole`: `PRIMARY`, `SECONDARY`, `VALIDATOR`, `SUPERVISOR`).
- Planos cíclicos com `frequency` e `nextExecution`; agendador em `counting-scheduler.service.ts`.
- Contagem cega (`allowBlindCount`), recontagem obrigatória (`requireRecount`), tolerâncias por percentual e por quantidade.
- Lock otimista (`version` em `CountingSession` e `CountingItem`) + lock pessimista (`SELECT ... FOR UPDATE`) em `count()`/`recount()`, com testes de concorrência automatizados (Fase 3 item 3.3, que achou e corrigiu um bug real).
- Ajuste de estoque ao fim da sessão via `stockService.registerMovement()`, com sinal correto (sobra → `IN`, quebra → `OUT`) e `countingSessionId` preenchido.
- Frontend completo: 6 views Vue roteadas, `counting.store.ts`, ~28 endpoints.

**Nada disso deve ser reproposto.** Os pontos que restam são os que dependem de endereçamento:

- `CountingItem.sequence` (`Int?`, default `0`) existe no schema mas **nenhum service o popula** — foi criado para ordenar a rota de contagem e está esperando um endereço físico para ordenar por.
- `systemQty` vem do saldo agregado por produto; com saldo por posição, passa a ser saldo da posição.
- `counting.routes.ts` (28 endpoints) ficou sem validators — pendência conhecida da Fase 2 item 2.2.

### 2.6 Compras e recebimento — base existente, sem endereçamento

`Supplier`, `PurchaseQuotation`/`Item`, `PurchaseOrder`/`Item`, `PurchaseReceipt`/`Item` existem e o fluxo de recebimento **funciona ponta a ponta** (corrigido e testado ao vivo na Fase 1 item 1.6: criar recebimento → saldo/custo → status do pedido → cancelar → estorno → reversão de status).

```
PurchaseReceipt     (receiptNumber @unique, orderId, receiptDate, receivedBy, status, notes)
PurchaseReceiptItem (receiptId, orderItemId, productId, quantity, acceptedQty, rejectedQty, notes)
```

O que já dá para aproveitar: a conferência quantitativa básica já existe (`quantity` recebida vs `acceptedQty` vs `rejectedQty`), e `PurchaseOrderItem.receivedQty` tem lock otimista (`version`, Fase 4 item 4.2).

O que falta para ser recebimento de WMS:

- **Nenhum endereço de destino.** O item entra no saldo global do produto; não se registra onde foi guardado.
- Sem lote, validade, nota fiscal ou número de série.
- Sem etapa de conferência separada da entrada de estoque (hoje conferir = dar entrada, no mesmo ato).
- Sem regra de endereçamento (put-away) sugerindo destino.
- **Sem orquestração por tarefa.** Com WMS licenciado, o processo real de recebimento não é um formulário só — é descarga, conferência, etiquetagem, quarentena condicional e alocação, cada etapa executada por um operador em coletor/smartphone (ver seção 5, Fase 4). Nada disso existe hoje, nem o conceito de tarefa de armazém.
- `receiptNumber` é gerado com `purchaseReceipt.count() + 1` — não é atômico sob concorrência e reaproveita números após cancelamento (achado registrado na Fase 1). **Qualquer numeração nova do WMS não pode repetir esse padrão.**
- **Não existe tela.** A API de recebimento não é consumida por nenhuma view Vue (pendência registrada na decisão de stack do frontend).

### 2.7 Convenções do projeto que qualquer proposta deve seguir

Extraídas de [`fase-2026-09-modernizacao/`](./fase-2026-09-modernizacao/):

| Convenção | Referência |
|---|---|
| Erros via `AppError(status, msg)` nos services; controllers usam `next(err)`/`asyncHandler`, sem `try/catch` local | Fase 4 item 4.4 |
| Lock otimista com coluna `version Int @default(0)` para edição concorrente via formulário | Fase 4 item 4.2 |
| Lock pessimista (`SELECT ... FOR UPDATE` dentro de `$transaction`) para saldo e contagem | Fase 1 itens 1.1/1.2, Fase 3 item 3.3 |
| RBAC: `authMiddleware` + `requirePermission(recurso, acao)` em toda rota, inclusive leitura | Sprint 0 + Fase 2 itens 2.1/2.2 |
| Validators Zod por rota mutante, em `validators/*.validator.ts` via `validate(schema)` | Fase 2 item 2.2 |
| Testes de integração com MySQL real (`docker-compose.test.yml`), incluindo **teste de concorrência com requisições paralelas** para todo caminho que escreve saldo | Fase 3 itens 3.1/3.2/3.5 |
| Migrations SQL versionadas em `backend/prisma/migrations/`, sem drift (`prisma migrate diff` limpo) | Fase 1 item 1.4 |
| Frontend 100% Vue 3 + Pinia + Tailwind; feedback via `useToast`/`useConfirm`, nunca `alert()`/`confirm()` | Fase 5 itens 5.1/5.4 |
| Debounce em campos de busca via `useDebounce` | Fase 5 item 5.2 |

**Dívida herdada que impacta diretamente o WMS:** o item 4.1 (`Float` → `Decimal`) foi **adiado deliberadamente**, com justificativa registrada. Consequência: todo campo de quantidade e custo hoje é `Float`. As tabelas novas do WMS não devem herdar esse erro — ver decisão D2 na seção 4.4.

---

## 3. Diagnóstico — o gap real

Resumindo o que separa o Fabric de um WMS:

| Capacidade WMS | Estado |
|---|---|
| Cadastro de armazém e estrutura física | ✅ Existe e é usado (`Warehouse`/`WarehouseStructure`/`StoragePosition`) |
| Endereço único, legível e escaneável por posição | ❌ Código montado em memória, não persistido, sem índice |
| Saldo por produto | ✅ Existe (`StockBalance`), transacional e com lock |
| **Saldo por produto × posição** | ❌ Não existe |
| Movimentação auditada por produto | ✅ Existe (`StockMovement`) |
| **Movimentação com origem e destino (transferência interna)** | ❌ Não existe; nem o tipo `TRANSFER` existe |
| Recebimento de compra com conferência quantitativa | ✅ Existe (`PurchaseReceipt`/`Item`) |
| **Endereçamento (put-away) no recebimento** | ❌ Não existe |
| **Regra de endereçamento / sugestão de posição** | ❌ Não existe |
| Inventário cíclico com plano, sessão, papéis e recontagem | ✅ Existe e é maduro |
| **Contagem por endereço, com rota ordenada** | ❌ `CountingItem.sequence` existe mas nunca é populado |
| **Recebimento e separação orientados a tarefa (descarga/conferência/etiquetagem/quarentena/alocação/picking via `WarehouseTask`, despachadas a coletor/smartphone)** | ❌ Não existe — requisito confirmado em `04_ARQUITETURA_MODULAR_LICENCIAMENTO.md` |
| **Superfície de API para dispositivo móvel** (minhas tarefas, iniciar, escanear, concluir) | ❌ Não existe — toda API atual é administrativa/desktop |
| **Dados de armazenagem no cadastro de produto** (peso, volume, embalagem, empilhamento, segregação) | ❌ Não existe — pré-requisito de `StorageRule` |
| Lote / validade / número de série | ❌ Não existe |

Todos os itens em falta têm o mesmo pré-requisito: **um identificador de posição confiável para pendurar saldo e movimento**. É por isso que a decisão sobre `Location` vs `StoragePosition` não pode ficar em aberto — ela bloqueia tudo o mais.

---

## 4. Decisão arquitetural: `Location` vs `Warehouse`/`WarehouseStructure`/`StoragePosition`

### 4.1 Recomendação

> **Consolidar todo o endereçamento físico na árvore `Warehouse → WarehouseStructure → StoragePosition`, adotando `StoragePosition` como a unidade endereçável atômica do WMS. Depreciar e remover `Location` e o enum `LocationType`.**

Não se recomenda manter os dois modelos com propósitos distintos. Duas hierarquias de endereço em paralelo produzem, inevitavelmente, dois saldos, duas contagens e duas versões da verdade sobre onde o material está — que é exatamente o problema que um WMS existe para resolver.

### 4.2 Justificativa

**a) O custo de remoção de `Location` é praticamente zero.** Não há service, controller, rota, validator, store ou view. A única FK (`CountingItem.locationId`) nunca é escrita por código de aplicação — a coluna é `NULL` em 100% dos itens gerados pelo sistema. A remoção não exige migração de dados, apenas descartar o conteúdo do seed. Manter `Location` custaria escrever, do zero, toda a camada de API e frontend que o outro subsistema já tem pronta e com RBAC/validators aplicados.

**b) `Warehouse`/`WarehouseStructure`/`StoragePosition` já paga o custo de existir.** 3 services, 3 controllers, 3 arquivos de rotas com `requirePermission` e validators, 3 services de frontend, 2 stores, 2 views roteadas, 2 scripts de seed. Descartar esse subsistema em favor de `Location` significaria jogar fora trabalho funcional e reconstruí-lo.

**c) Modela restrições físicas que o WMS precisa; `Location` não.** Capacidade de peso, altura/largura/profundidade, altura máxima e tipo de estrutura (`PositionType`) são exatamente os dados de entrada de uma regra de endereçamento ("este pallet de 800 kg não cabe neste flow rack"). `Location` só tem `code`, `name` e `type` — endereçar por ela exigiria adicionar todos esses campos, ou seja, reconstruir `StoragePosition` com outro nome.

**d) Hierarquia fixa de 3 níveis é uma vantagem, não uma limitação, neste domínio.** A árvore auto-referenciada de `Location` tem profundidade arbitrária: responder "todas as posições deste armazém" exige CTE recursivo no MySQL, e nada no schema impede uma prateleira ser filha de outra prateleira. A estrutura `armazém → rua → (andar, posição)` resolve a mesma pergunta com um join simples, tem `@@unique([structureId, floor, position])` garantindo unicidade do endereço, e reflete a nomenclatura que o operador de armazém realmente usa.

**e) É consistente com o precedente do projeto.** A Fase 1 (item 1.3) já estabeleceu que referência que importa ganha FK própria em vez de campo genérico. `Location` é a versão "campo genérico" do endereçamento.

### 4.3 Contrapontos considerados

**"`Location` cobre piso e área, `StoragePosition` só cobre rack."** É verdade, e é o único argumento real a favor de `Location`. Mas a resposta certa é **estender** o modelo vivo, não manter o morto: adicionar valores de área ao `PositionType` (piso, doca, quarentena, bloqueio, expedição) e tornar os campos dimensionais opcionais para eles. Isso é uma migration pequena, contra reconstruir uma camada inteira de API. Item F0.3 do plano.

**"Manter `Location` como visão lógica/de negócio e `StoragePosition` como visão física."** Rejeitado. Não há requisito conhecido que peça duas taxonomias, ninguém consome `Location` hoje, e a distinção lógico/físico produziria uma tabela de mapeamento entre as duas — mais superfície para divergir, sem benefício articulado. Se um agrupamento lógico (zona de picking, curva ABC, área de temperatura controlada) for necessário depois, o caminho é um atributo ou uma tabela de zonas pendurada em `StoragePosition`, não uma segunda hierarquia de endereços.

**"Remover um model do schema é destrutivo."** A remoção é faseada: primeiro congela-se `Location` (sem novos usos), migra-se `CountingItem` para `storagePositionId`, e só então a migration de drop entra — depois que o WMS estiver usando o endereço novo em produção. Ver F0.6 e F3.1.

### 4.4 Decisões complementares

| # | Decisão | Motivo |
|---|---|---|
| **D1** | `StockBalance` (agregado por produto) **permanece**. O saldo por posição vai numa tabela nova, e o agregado passa a ser um roll-up mantido na mesma transação. | `StockBalance` é consumido por MRP, dashboards, notificações de estoque baixo, relatórios e 44 testes automatizados. Trocá-lo por saldo por posição de uma vez quebraria tudo isso simultaneamente. O roll-up mantém o contrato atual intacto enquanto a dimensão nova é introduzida. |
| **D2** | Toda tabela nova do WMS nasce com quantidades em `Decimal(18,4)` e valores monetários em `Decimal(18,4)`, **não** `Float`. | O item 4.1 do cronograma (`Float`→`Decimal`) foi adiado com justificativa; criar tabelas novas em `Float` amplia uma dívida já reconhecida. Como as tabelas são novas, não há consumidor de frontend para quebrar — o cuidado descrito no item 4.1 (serialização de `Decimal` como string) se aplica apenas aos endpoints novos, que já nascerão cientes disso. |
| **D3** | `StoragePosition.occupied` é **removido**; ocupação passa a ser derivada da existência de saldo na posição. | Flag denormalizada nunca escrita hoje; manter significaria criar imediatamente uma fonte de divergência com o saldo real. Se a leitura "posições livres" ficar cara, resolve-se com índice ou view materializada, não com flag manual. |
| **D4** | `StockMovement.type` migra de `String` para `enum StockMovementType` com `IN`, `OUT`, `ADJUSTMENT`, `TRANSFER`. | Transferência interna (mesma quantidade, muda de posição, saldo global inalterado) não é representável com os três tipos atuais, e é a operação mais frequente de um WMS. Enum evita valores livres divergentes. |
| **D5** | O recebimento endereçado é construído **sobre** `PurchaseReceipt`/`PurchaseReceiptItem` existentes. Não se cria `GoodsReceipt`/`GoodsReceiptItem`. | O fluxo atual funciona ponta a ponta e foi validado ao vivo na Fase 1. Criar um modelo paralelo de recebimento repetiria, no domínio de compras, exatamente o erro de duplicidade que este documento resolve no domínio de endereçamento. |
| **D6** | Lote/validade (`Lot`) **não** entra no plano principal. Fica como fase condicional, só se houver requisito de negócio explícito. | Adicionar lote como terceira dimensão do saldo (produto × posição × lote) multiplica a complexidade de toda operação de saldo, picking e contagem. Sem um requisito real (rastreabilidade regulatória, FEFO obrigatório), é complexidade especulativa. |

---

## 5. Plano faseado

Premissas: cada fase é entregável isoladamente e deixa o sistema funcionando; nenhuma fase quebra o contrato de API existente; toda escrita de saldo nova sai com teste de concorrência (padrão da Fase 3 do cronograma de modernização). As estimativas assumem um desenvolvedor.

### Fase 0 — Saneamento do endereçamento, licenciamento e dados de produto (pré-requisito, ~2,5-3 semanas)

Nada de saldo ainda. O objetivo é ter um endereço confiável em que pendurar dados.

| # | Ação | Esforço |
|---|---|---|
| F0.1 | Persistir `StoragePosition.code` (`String @unique`), gerado na criação com o formato hoje montado em memória (`ARM-RUA-AA-PP`). Migration com backfill das posições existentes. Índice único. `getPositionsByStructure()` passa a ler a coluna em vez de concatenar. | 1-2 dias |
| F0.2 | Endpoint `GET /storage-positions/by-code/:code` (busca por endereço — pré-requisito de qualquer operação com coletor/scanner). | 0,5 dia |
| F0.3 | Estender `PositionType` com tipos de área não-rack (`PISO`, `DOCA`, `QUARENTENA`, `BLOQUEIO`, `EXPEDICAO`) e tornar os campos dimensionais de `WarehouseStructure`/`StoragePosition` opcionais quando o tipo for de área. Ajustar validators. | 2 dias |
| F0.4 | Remover `StoragePosition.occupied` e o `@@index([occupied])` (decisão D3). | 0,5 dia |
| F0.5 | Corrigir o N+1 de `stock.service.ts::getAllBalances()` — uma query com join em vez de `getBalance()` por produto. **Pré-requisito de performance:** com saldo por posição, o padrão atual passaria de N para N×M queries. | 1-2 dias |
| F0.6 | Congelar `Location`: marcar como `@deprecated` no schema, remover `backend/prisma/seed-locations.ts` do fluxo de seed, documentar que nenhum código novo deve referenciá-lo. **Sem drop ainda** (o drop é F3.1, depois da migração de `CountingItem`). | 0,5 dia |
| F0.7 | Validators Zod para `counting.routes.ts` (pendência da Fase 2 item 2.2) — o módulo de contagem será alterado nas fases 3 e 4; entrar nele sem validação de entrada é reabrir risco já mapeado. | 2 dias |
| F0.8 | **Mecanismo de licenciamento por módulo** (`04_ARQUITETURA_MODULAR_LICENCIAMENTO.md`): model `LicensedModule` (`code`, `enabled`), middleware `requireModule(codigo)` aplicado no ponto de montagem das rotas de armazém em `routes/index.ts`, endpoint `GET /system/licensed-modules`, guard de rota e menu no frontend. `PCP` nasce sempre habilitado. Pré-requisito de tudo que segue: a Fase 4 revisada (seção 5.5) só existe de fato — ramificando o recebimento e a separação para orientação a tarefa — se este item estiver pronto. | 3-4 dias |
| F0.9 | Estender `Product` com campos opcionais de armazenagem: `weight`/`netWeight Float?`, `volume Float?` (ou `length`/`width`/`height Float?` com volume derivado), `packagingType String?`, `maxStackQty Int?` (empilhamento), `segregationGroup String?` (grupo de incompatibilidade de armazenagem). Migration puramente aditiva (colunas nullable, zero impacto em cliente só-PCP). Seção "Dados para Armazenagem" no formulário de produto, visível só com módulo WMS licenciado (depende de F0.8). Pré-requisito de `StorageRule` (F4.6). | 2-3 dias |

**Entregável:** endereço único, persistido, buscável por código, capaz de representar área e rack; `Location` congelado; base de saldo pronta para escalar em dimensão; módulo WMS licenciável por instalação; produto com os dados físicos que uma regra de endereçamento precisa.

### Fase 1 — Saldo por posição (~2 semanas)

O núcleo do WMS.

| # | Ação | Esforço |
|---|---|---|
| F1.1 | Novo model `StockPositionBalance`: `productId`, `storagePositionId`, `quantity Decimal(18,4)`, `version Int`, `updatedAt`, `@@unique([productId, storagePositionId])`, índices por `storagePositionId` e por `productId`. FKs reais para `products` e `storage_positions`. | 2-3 dias |
| F1.2 | `stock.service.ts::applyMovement()` estendido: quando a movimentação informar posição, travar (`FOR UPDATE`) a linha de `StockPositionBalance` **e** a de `StockBalance`, sempre em ordem determinística por id (evita deadlock em transferências), validar saldo na posição e escrever ambas na mesma transação. Movimentação sem posição continua funcionando como hoje (compatibilidade). | 3-4 dias |
| F1.3 | Invariante de consistência: `SUM(StockPositionBalance.quantity) == StockBalance.quantity` por produto (considerando o saldo não endereçado como uma parcela explícita). Job de reconciliação diário + endpoint de divergência, no padrão dos jobs existentes em `backend/src/jobs/`. | 2 dias |
| F1.4 | Endpoints: saldo por posição, saldo por produto detalhado por posição, posições ocupadas de um armazém. Com `requirePermission` e validators. | 2 dias |
| F1.5 | **Testes de concorrência obrigatórios** (padrão Fase 3): duas saídas paralelas da mesma posição, duas entradas paralelas na mesma posição, transferência paralela com a mesma origem. | 2-3 dias |
| F1.6 | Frontend: aba de saldo por endereço em `StockView.vue`; visualização de ocupação em `WarehouseStructuresView.vue`. | 3 dias |

**Entregável:** o sistema sabe **onde** cada quantidade está, com a mesma garantia transacional que o saldo global já tem.

### Fase 2 — Movimentação rastreada e transferência interna (~1,5 semana)

| # | Ação | Esforço |
|---|---|---|
| F2.1 | `StockMovement` ganha `fromPositionId String?` e `toPositionId String?` (FKs para `storage_positions`), com índices. Semântica: `IN` → só `to`; `OUT` → só `from`; `TRANSFER` → ambos obrigatórios; `ADJUSTMENT` → um dos dois. Validação no service com `AppError`. | 2 dias |
| F2.2 | Migrar `type` para `enum StockMovementType` incluindo `TRANSFER` (decisão D4). Migration com conversão dos valores existentes. | 1-2 dias |
| F2.3 | Operação de transferência interna: `POST /stock/transfer` — uma única movimentação `TRANSFER` que debita a origem e credita o destino na mesma transação, sem alterar `StockBalance` agregado. Validar capacidade e bloqueio da posição de destino. | 2-3 dias |
| F2.4 | Histórico de movimentação por posição (`GET /storage-positions/:id/movements`) e filtro por posição no histórico de produto. | 1 dia |
| F2.5 | Frontend: tela de transferência entre endereços, com busca de posição por código. | 2-3 dias |

**Entregável:** rastreabilidade completa de para onde o material foi, e a operação interna mais comum do armazém habilitada.

### Fase 3 — Contagem por endereço (~1,5 semana)

Aproveita integralmente o módulo maduro; só troca a dimensão.

| # | Ação | Esforço |
|---|---|---|
| F3.1 | `CountingItem.locationId` → `storagePositionId` (FK para `storage_positions`); `@@unique([sessionId, productId, storagePositionId])`. Migração de dados **trivial** (coluna sempre `NULL`). **Drop de `Location` e do enum `LocationType`** — conclusão da decisão da seção 4. | 2 dias |
| F3.2 | `counting-session.service.ts`: gerar um item de contagem **por posição com saldo** do produto, e `systemQty` passa a vir de `StockPositionBalance`. Critério de plano por rua/armazém, além de por produto. | 3 dias |
| F3.3 | Popular `CountingItem.sequence` — campo que existe desde o início e nunca foi usado — ordenando por `warehouseCode → streetCode → floor → position` (rota serpentina de contagem). | 1-2 dias |
| F3.4 | Ajuste pós-contagem passa a gerar movimentação **com posição** (`ADJUSTMENT` com `fromPositionId`/`toPositionId`), mantendo `countingSessionId`. | 1 dia |
| F3.5 | Frontend: `CountingSessionExecute.vue` exibe o endereço e segue a sequência de rota; busca de item por código de posição. | 2-3 dias |

**Entregável:** inventário cíclico endereçado, com rota otimizada — e `Location` finalmente removido do schema.

### Fase 4 — Recebimento e separação orientados a tarefa (~4-4,5 semanas)

**Substitui as antigas Fases 4 e 5 da v2.0** (ver "Nota sobre a revisão 2.1" no topo do documento). Com o módulo WMS licenciado (F0.8), recebimento e separação deixam de ser ações síncronas de tela administrativa e passam a ser sequências de `WarehouseTask` despachadas a coletor de dados ou smartphone. Sem WMS licenciado, o recebimento **permanece exatamente como funciona hoje** (linear, sem tarefas) — a ramificação é condicional, não uma migração forçada.

| # | Ação | Esforço |
|---|---|---|
| F4.1 | Novo model `WarehouseTask`: tipo (`DESCARGA`, `CONFERENCIA`, `ETIQUETAGEM`, `QUARENTENA`, `ALOCACAO`, `PICKING`, `TRANSFER`, `REPLENISHMENT`, `COUNTING`), status, referência polimórfica (`reference`/`referenceType`, mesmo precedente de `StockMovement` — uma tarefa pode pertencer a um recebimento, uma separação, etc.), posição origem/destino, produto, quantidade, prioridade, `assignedTo` (FK `users`), `version` para lock otimista. | 3-4 dias |
| F4.2 | Separar conferência de entrada: `PurchaseReceipt.status` ganha estado intermediário (`CONFERIDO`) entre `PENDING` e `APPROVED`. Conferir registra quantidades; endereçar dá entrada no saldo. Válido nos dois modos (com ou sem WMS). | 2-3 dias |
| F4.3 | **Orquestração de recebimento com WMS ativo**: ao criar o recebimento, `purchase-receipt.service.ts` gera a cadeia `DESCARGA → CONFERENCIA → ETIQUETAGEM → QUARENTENA (condicional, só se a regra F4.6 exigir) → ALOCACAO` como `WarehouseTask` encadeadas; concluir cada tarefa avança o status do recebimento. Sem WMS licenciado (`requireModule('WMS')` falso), o service segue o caminho síncrono atual sem gerar nenhuma tarefa — um único branch no início do método, não dois services paralelos. | 4-5 dias |
| F4.4 | Novo model `ReceiptPutaway`: `receiptItemId`, `storagePositionId`, `quantity Decimal(18,4)`, `userId`, `putawayAt`, `taskId` (FK para a `WarehouseTask` de `ALOCACAO` que a originou). Tabela separada porque **um item conferido pode ser endereçado em mais de uma posição**. Validação: `SUM(quantity) == acceptedQty`. | 3 dias |
| F4.5 | Entrada de estoque ocorre na conclusão da tarefa de alocação (`ReceiptPutaway`), gerando `StockMovement` tipo `IN` com `toPositionId`, dentro da transação já existente de `purchase-receipt.service.ts`. `updateProductCosts()` inalterado. | 2-3 dias |
| F4.6 | Novo model `StorageRule`: regra de sugestão de posição por produto/categoria/`PositionType`, com prioridade, validando capacidade de peso/dimensão (`StoragePosition`) **e** os campos de armazenagem do produto (F0.9: peso, empilhamento, segregação — ex. bloquear sugestão de posição já ocupada por grupo de segregação incompatível). Determina também se a tarefa de `QUARENTENA` é necessária. Serviço de sugestão consultado na tarefa de alocação (sugere, não impõe). | 4-5 dias |
| F4.7 | **Numeração de documentos atômica**: qualquer número sequencial novo (e, de quebra, `receiptNumber`) sai do padrão `count() + 1` para uma tabela de sequência com lock ou coluna auto-incremento — achado registrado na Fase 1 do cronograma de modernização. | 1-2 dias |
| F4.8 | `stock.service.ts::reserveForOrder()` passa a **escolher a posição** de saída (estratégia FIFO por `updatedAt` da linha de saldo, com gancho para FEFO caso a Fase 5 aconteça). Com WMS licenciado, gera tarefa(s) `PICKING` em vez de debitar direto; sem WMS, comportamento atual inalterado. Manter os testes de concorrência existentes verdes. | 3-4 dias |
| F4.9 | Fila de tarefas por operador (consulta, atribuição, conclusão), reaproveitando o padrão de papéis já validado em `CountingAssignment`/`CounterRole`. | 2-3 dias |
| F4.10 | Reposição: quando o saldo da posição de picking cai abaixo de um mínimo, gerar tarefa `REPLENISHMENT` a partir do pulmão. Integrar ao `notification-detector.service.ts` já existente. | 2-3 dias |
| F4.11 | **Superfície de API para dispositivo móvel**, distinta da API administrativa: `GET /warehouse-tasks/my` (tarefas do operador logado), `POST /warehouse-tasks/:id/start`, `POST /warehouse-tasks/:id/scan` (confirma leitura de código de barras de posição/produto), `POST /warehouse-tasks/:id/complete`. Endpoints enxutos, otimizados para payload pequeno e uso em coletor/smartphone — não é a mesma API CRUD do resto do sistema. Só existe com WMS licenciado. | 3-4 dias |
| F4.12 | Frontend desktop: tela de recebimento (conferência inicial — a API existe desde a Fase 1 do cronograma e nunca teve view) e painel de acompanhamento de tarefas para supervisor. Frontend mobile/PWA para o operador (consome F4.11) fica fora deste documento — é decisão de produto separada (nativo vs. PWA vs. app de terceiro para coletor), não uma escolha técnica que se resolve aqui. | 5-6 dias (desktop apenas) |

**Entregável:** com WMS licenciado, o material entra e sai do armazém pelo processo real — descarga, conferência, etiquetagem, quarentena quando aplicável, alocação sugerida, picking — cada etapa uma tarefa rastreável em dispositivo móvel. Sem WMS licenciado, nada muda no fluxo de compras/estoque que já existe.

### Fase 5 — Lote, validade e rastreabilidade (condicional, ~2-3 semanas)

**Só executar mediante requisito de negócio explícito** (decisão D6). Se acontecer: `Lot` (`lotNumber`, `productId`, `manufacturedAt`, `expiresAt`, `supplierId`) como terceira dimensão de `StockPositionBalance` e de `StockMovement`, com FEFO em `reserveForOrder()` e bloqueio de saída de lote vencido. Impacta todas as operações de saldo das fases 1-4 — daí a recomendação de não antecipar.

### Resumo do cronograma

| Fase | Foco | Esforço | Depende de |
|---|---|---|---|
| 0 | Saneamento do endereçamento + licenciamento por módulo + dados de armazenagem no produto | ~2,5-3 sem | — |
| 1 | Saldo por posição | ~2 sem | 0 |
| 2 | Movimentação rastreada e transferência | ~1,5 sem | 1 |
| 3 | Contagem por endereço (+ drop de `Location`) | ~1,5 sem | 1, 2 |
| 4 | Recebimento e separação orientados a tarefa | ~4-4,5 sem | 0, 1, 2 |
| 5 | Lote e validade (condicional) | ~2-3 sem | 1-4 |
| | **Total (fases 0-4)** | **~12-13,5 semanas** | |

Fase 3 e Fase 4 continuam largamente independentes entre si (podem ser paralelizadas com mais de um desenvolvedor), mas Fase 4 agora depende diretamente de F0.8 (licenciamento) e F0.9 (dados de produto), que antes não existiam como pré-requisito. Fases 0, 1 e 2 seguem estritamente sequenciais — todas mexem no mesmo caminho crítico de escrita de saldo, e mexer nele em paralelo é a receita para reabrir as race conditions corrigidas na Fase 1 do cronograma de modernização.

---

## 6. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Divergência entre saldo por posição e saldo agregado | Alto — duas verdades sobre estoque, exatamente o problema que o WMS resolve | Escrita das duas tabelas na mesma transação (F1.2), invariante verificada por job diário (F1.3), teste de concorrência obrigatório (F1.5) |
| Deadlock em transferência (duas transações travando as mesmas duas linhas em ordem oposta) | Médio — falhas intermitentes sob carga | Ordem determinística de aquisição de lock por id (F1.2); cenário coberto explicitamente em teste (F1.5) |
| Quebra do MRP, dashboards e notificações ao introduzir a dimensão de posição | Alto — módulos maduros em uso | Decisão D1: `StockBalance` permanece como contrato estável; a dimensão nova é aditiva |
| Performance de consultas de saldo | Médio | F0.5 corrige o N+1 **antes** de multiplicar a cardinalidade; índices em `StockPositionBalance` desde a criação |
| `Decimal` nas tabelas novas convivendo com `Float` nas antigas | Médio — aritmética mista e serialização JSON como string | Fronteira explícita: conversão só na borda do service, endpoints novos documentados; alinhado à justificativa do item 4.1 do cronograma |
| Drop de `Location` remover dado que alguém usava fora do sistema | Baixo | Coluna sempre `NULL`, sem API, sem tela; drop só na Fase 3, após o endereço novo estar em produção; migration reversível com backup prévio |
| Escopo inflar com lote/validade antes da base existir | Médio — atrasa tudo | Decisão D6: fase condicional e explicitamente última |
| `purchase-receipt.service.ts` acumular dois caminhos (com/sem WMS) que divergem com o tempo, um deles sub-testado | Alto — é justamente o service mais crítico de compras, já corrigido uma vez na Fase 1 do cronograma | F4.3 é um único branch no início do método, não dois services paralelos; todo teste de integração de recebimento roda nos dois modos (licenciado e não licenciado), não só num |
| Escopo do frontend mobile/PWA ficar subestimado por não ter sido desenhado aqui | Médio | F4.11 entrega só a API; F4.12 registra explicitamente que a escolha de frontend do coletor (nativo/PWA/terceiro) é decisão de produto separada, não estimada nesta revisão |

---

## 7. O que deliberadamente **não** está neste plano

Registrado para evitar que uma futura análise reproponha o que já existe:

- **Recriar o módulo de contagem** (plano multiproduto, atribuição de contadores, papéis, recontagem, tolerâncias, contagem cega, agendamento cíclico) — está completo, testado e com frontend em produção (seção 2.5).
- **Criar `StockBalance` do zero** — existe desde a Fase 1, transacional e com lock (seção 2.1).
- **Criar `GoodsReceipt`/`GoodsReceiptItem`** — `PurchaseReceipt`/`PurchaseReceiptItem` já cobrem o papel e funcionam (decisão D5).
- **Criar `ProductLocation`** (tabela de produto × endereço fixo) — é o que `StorageRule` (F4.6) resolve de forma mais flexível, e um endereço fixo por produto conflita com saldo por posição.
- **Migrar o frontend para outra stack** — decisão formal registrada, Vue 3 permanece.
- **Desenhar o frontend mobile/PWA do coletor de dados** — F4.11 entrega a API; qual tecnologia roda no dispositivo (PWA, app nativo, integração com coletor de terceiro) é decisão de produto que não foi tomada nesta revisão.
- **Multi-tenancy real (isolamento de dados por cliente no mesmo banco)** — o licenciamento por módulo (F0.8) resolve "quais módulos esta instalação tem", não "vários clientes no mesmo banco". Modelo de deploy confirmado é uma instalação por cliente (`04_ARQUITETURA_MODULAR_LICENCIAMENTO.md`).

---

**Elaborado em:** 01/09/2026 (v2.0); revisado em 01/09/2026 (v2.1 — seção 5, fusão das antigas Fases 4/5)
**Baseado em:** leitura integral de `backend/prisma/schema.prisma`, varredura de `backend/src/{services,controllers,routes,validators}/`, `frontend/src/`, dos documentos de [`docs/fase-2026-09-modernizacao/`](./) e da decisão registrada em [`04_ARQUITETURA_MODULAR_LICENCIAMENTO.md`](./04_ARQUITETURA_MODULAR_LICENCIAMENTO.md).
**Status:** proposta para revisão. Nenhuma alteração de código ou schema foi realizada.
