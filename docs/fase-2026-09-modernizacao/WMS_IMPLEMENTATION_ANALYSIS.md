# Análise de Implementação — WMS (Warehouse Management System)

**Data:** 01/09/2026
**Versão:** 2.0 (reescrita completa — substitui a versão 1.0 de 22/10/2025, obsoleta)
**Branch de análise:** `wms-analise-planejamento`
**Escopo:** análise do estado real do schema e do código, decisão arquitetural sobre endereçamento físico, e plano faseado para completar o WMS.
**Natureza deste documento:** análise e planejamento. Nenhum código, schema ou migration foi alterado na produção deste documento.

---

## Nota sobre a versão anterior

A versão 1.0 (22/10/2025) está obsoleta e foi integralmente substituída. Ela partia de um schema que não existe mais e propunha criar do zero componentes que hoje já estão implementados (saldo de estoque persistido, plano de contagem multiproduto, atribuição de contadores por papel, recebimento de compras funcional). Além disso, o arquivo continha, ao final, um bloco de texto colado por engano — transcrição de uma sessão de trabalho de outro ambiente, referenciando um documento inexistente neste repositório e uma stack de frontend que este projeto nunca usou. Esse bloco foi removido.

Para o registro: o frontend do Fabric é **100% Vue 3**, decisão formalizada em [`fase-2026-09-modernizacao/03_DECISAO_STACK_FRONTEND.md`](./fase-2026-09-modernizacao/03_DECISAO_STACK_FRONTEND.md).

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
| Separação/picking e tarefas de armazém | ❌ Não existe |
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

### Fase 0 — Saneamento do endereçamento (pré-requisito, ~1,5 semana)

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

**Entregável:** endereço único, persistido, buscável por código, capaz de representar área e rack; `Location` congelado; base de saldo pronta para escalar em dimensão.

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

### Fase 4 — Recebimento com conferência e endereçamento (~2 semanas)

| # | Ação | Esforço |
|---|---|---|
| F4.1 | Separar conferência de entrada: `PurchaseReceipt.status` ganha estado intermediário (`CONFERIDO`) entre `PENDING` e `APPROVED`. Conferir registra quantidades; endereçar dá entrada no saldo. | 2-3 dias |
| F4.2 | Novo model `ReceiptPutaway`: `receiptItemId`, `storagePositionId`, `quantity Decimal(18,4)`, `userId`, `putawayAt`. Tabela separada porque **um item conferido pode ser endereçado em mais de uma posição** — colocar `storagePositionId` direto em `PurchaseReceiptItem` limitaria a uma, o que quebra no primeiro recebimento grande. Validação: `SUM(quantity) == acceptedQty`. | 3 dias |
| F4.3 | Entrada de estoque passa a ocorrer no endereçamento (`ReceiptPutaway`), gerando `StockMovement` tipo `IN` com `toPositionId`, dentro da transação já existente de `purchase-receipt.service.ts`. `updateProductCosts()` inalterado. | 2-3 dias |
| F4.4 | Novo model `StorageRule`: regra de sugestão de posição por produto/categoria/`PositionType`, com prioridade, validando capacidade de peso e dimensão contra `StoragePosition`. Serviço de sugestão consultado na tela de endereçamento (sugere, não impõe). | 3-4 dias |
| F4.5 | **Numeração de documentos atômica**: qualquer número sequencial novo (e, de quebra, `receiptNumber`) sai do padrão `count() + 1` para uma tabela de sequência com lock ou coluna auto-incremento — achado registrado na Fase 1 do cronograma de modernização. | 1-2 dias |
| F4.6 | Frontend: **primeira tela de recebimento do sistema** (a API existe desde a Fase 1 e nunca teve view) — conferência + endereçamento com sugestão de posição. | 4-5 dias |

**Entregável:** o material entra pelo processo real de armazém — confere, endereça, e só então vira saldo, com sugestão automática de destino.

### Fase 5 — Separação e tarefas de armazém (~2 semanas)

| # | Ação | Esforço |
|---|---|---|
| F5.1 | Novo model `WarehouseTask`: tipo (`PUTAWAY`, `PICKING`, `TRANSFER`, `REPLENISHMENT`, `COUNTING`), status, posição origem/destino, produto, quantidade, prioridade, `assignedTo` (FK `users`), `version` para lock otimista. | 3 dias |
| F5.2 | Fila de tarefas por operador, com atribuição e conclusão. Reaproveitar o padrão de papéis já validado em `CountingAssignment`/`CounterRole`. | 2-3 dias |
| F5.3 | `stock.service.ts::reserveForOrder()` passa a **escolher a posição** de saída (estratégia FIFO por `updatedAt` da linha de saldo, com gancho para FEFO caso a Fase 6 aconteça), em vez de debitar o saldo global. Manter os testes de concorrência existentes verdes. | 3-4 dias |
| F5.4 | Reposição: quando o saldo da posição de picking cai abaixo de um mínimo, gerar tarefa `REPLENISHMENT` a partir do pulmão. Integrar ao `notification-detector.service.ts` já existente. | 2-3 dias |
| F5.5 | Frontend: painel de tarefas do operador. | 3-4 dias |

**Entregável:** o armazém deixa de ser só um registro de onde está e passa a dirigir o que fazer.

### Fase 6 — Lote, validade e rastreabilidade (condicional, ~2-3 semanas)

**Só executar mediante requisito de negócio explícito** (decisão D6). Se acontecer: `Lot` (`lotNumber`, `productId`, `manufacturedAt`, `expiresAt`, `supplierId`) como terceira dimensão de `StockPositionBalance` e de `StockMovement`, com FEFO em `reserveForOrder()` e bloqueio de saída de lote vencido. Impacta todas as operações de saldo das fases 1-5 — daí a recomendação de não antecipar.

### Resumo do cronograma

| Fase | Foco | Esforço | Depende de |
|---|---|---|---|
| 0 | Saneamento do endereçamento | ~1,5 sem | — |
| 1 | Saldo por posição | ~2 sem | 0 |
| 2 | Movimentação rastreada e transferência | ~1,5 sem | 1 |
| 3 | Contagem por endereço (+ drop de `Location`) | ~1,5 sem | 1, 2 |
| 4 | Recebimento com conferência e endereçamento | ~2 sem | 1, 2 |
| 5 | Separação e tarefas | ~2 sem | 1, 2, 4 |
| 6 | Lote e validade (condicional) | ~2-3 sem | 1-5 |
| | **Total (fases 0-5)** | **~10,5 semanas** | |

Fases 3 e 4 são independentes entre si e podem ser paralelizadas se houver mais de um desenvolvedor. Fases 0, 1 e 2 são estritamente sequenciais — todas mexem no mesmo caminho crítico de escrita de saldo, e mexer nele em paralelo é a receita para reabrir as race conditions corrigidas na Fase 1 do cronograma de modernização.

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

---

## 7. O que deliberadamente **não** está neste plano

Registrado para evitar que uma futura análise reproponha o que já existe:

- **Recriar o módulo de contagem** (plano multiproduto, atribuição de contadores, papéis, recontagem, tolerâncias, contagem cega, agendamento cíclico) — está completo, testado e com frontend em produção (seção 2.5).
- **Criar `StockBalance` do zero** — existe desde a Fase 1, transacional e com lock (seção 2.1).
- **Criar `GoodsReceipt`/`GoodsReceiptItem`** — `PurchaseReceipt`/`PurchaseReceiptItem` já cobrem o papel e funcionam (decisão D5).
- **Criar `ProductLocation`** (tabela de produto × endereço fixo) — é o que `StorageRule` (F4.4) resolve de forma mais flexível, e um endereço fixo por produto conflita com saldo por posição.
- **Migrar o frontend para outra stack** — decisão formal registrada, Vue 3 permanece.

---

**Elaborado em:** 01/09/2026
**Baseado em:** leitura integral de `backend/prisma/schema.prisma`, varredura de `backend/src/{services,controllers,routes,validators}/`, `frontend/src/` e dos documentos de [`docs/fase-2026-09-modernizacao/`](./fase-2026-09-modernizacao/).
**Status:** proposta para revisão. Nenhuma alteração de código ou schema foi realizada.
