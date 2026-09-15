# Integração de API para ERP

**Data:** 2026-09-15
**Status:** design aprovado, aguardando plano de implementação
**Etapa:** primeira entrega do módulo — API HTTP autenticada por API key, exposta pelo Fabric para um ERP externo consumir: consulta de saldo de estoque, criação de pedidos de venda e de compra, consulta de status de ordens de produção, e cadastro básico de produtos. Inclui a infraestrutura de segurança (Clientes de Integração, escopos, idempotência) e uma tela desktop nova para gerenciar os clientes. Fora de escopo desta entrega: o Fabric chamar a API de um ERP (a direção é sempre ERP → Fabric), sincronização automática/agendada, webhooks de saída, e qualquer entidade além das quatro listadas.

## Contexto e motivação

Segundo módulo dos dois pedidos pelo usuário junto com o Coletor de Dados/Mobile (ver `docs/superpowers/specs/2026-09-14-coletor-dados-mobile-wms-design.md`), tratados como specs independentes por serem subsistemas sem sobreposição de design: aquele é frontend mobile-first consumindo APIs majoritariamente já existentes; este é uma camada de backend nova com modelo de segurança de sistema-a-sistema (API key), servindo um cliente que não é uma pessoa logada.

Decisões levantadas com o usuário antes do desenho, na ordem em que foram fechadas:

1. **Direção:** o Fabric expõe a API; o ERP externo é quem inicia as chamadas.
2. **Escopo de dados:** consulta de estoque/saldo, escrita de pedidos de venda e de compra, consulta de status de ordens de produção, e cadastro básico de produtos — o ERP manda o cadastro básico e o Fabric complementa depois, pela tela normal, com os campos operacionais (peso/dimensões, controle de lote, mínimo/segurança, regras de armazenagem).
3. **Autenticação:** API key estática por cliente, não OAuth2/mTLS — mais simples de operar num projeto self-hosted que já não tem infraestrutura de token rotativo ou PKI.
4. **Reaproveitamento:** pedidos criados pelo ERP viram `SalesOrder`/`PurchaseOrder` de verdade, pelas MESMAS regras de negócio da tela desktop — sem staging table nem fluxo de conversão à parte.
5. **Licenciamento:** módulo licenciável próprio (`API_ERP`), mesmo padrão de WMS/YMS/MANUTENCAO/EXPEDICAO.
6. **Granularidade:** escopos por recurso (um cliente pode ter só leitura de estoque, por exemplo), não tudo-ou-nada.
7. **Gestão:** tela desktop nova para cadastrar/revogar clientes nesta entrega, não adiada.
8. **Idempotência:** endpoints de escrita aceitam `Idempotency-Key`; reenvio da mesma chave devolve a resposta original em vez de duplicar o registro.

## Abordagens consideradas

**Como os pedidos do ERP entram no sistema:**

- **A — Reaproveitar `SalesOrder`/`PurchaseOrder` e os services existentes (escolhida).** O endpoint do ERP é uma casca fina de autenticação/tradução na frente de `salesOrderService.create()`/`purchaseOrderService.create()` — mesma validação, mesmo banco, sem modelo duplicado. Decisão do usuário na brainstorm.
- **B — Fila/staging separada com conversão posterior.** Rejeitada: mais isolamento entre "o que o ERP mandou" e "o que virou pedido de verdade", mas seria um sistema de reconciliação inteiro para um caso que não tem motivo comprovado de precisar dessa distância — o ERP manda dados já prontos pra virar pedido, não um rascunho a ser revisado por um humano antes.

**Como o cliente de integração se autentica no resto do sistema (auditoria, `createdBy`, notificações):**

- **A — Conta-sistema (`User`) por `IntegrationClient`, sem senha utilizável (escolhida).** Cada cliente ganha um `User` interno associado; `apiKeyAuth` popula `req.userId` com o id dessa conta-sistema — o mesmo campo que `authMiddleware` já popula para usuários logados. Todo controller/service que já lê `req.userId!` (criação de pedido, auditoria, `createdBy`) funciona SEM MUDANÇA nenhuma. É o mesmo truque que fecha o maior risco de retrabalho desta entrega: sem ele, cada service tocado precisaria de um parâmetro `actorType`/`actorId` novo espalhado por várias camadas.
- **B — Campo `createdBy` opcional/nulável em cada entidade tocada, mais um `createdByIntegrationClient` paralelo.** Rejeitada: exigiria migração em `SalesOrder`, `PurchaseOrder` e potencialmente `Product`, além de mudar toda leitura de auditoria/relatório que hoje assume `createdBy` sempre aponta pra um usuário humano — risco e esforço bem maiores pra resolver o mesmo problema que a Opção A resolve com uma linha de `User` a mais por cliente.

**Onde os escopos do cliente de integração são modelados:**

- **A — Catálogo próprio, fixo (`enum IntegrationScope`), tabela filha simples (escolhida).** Só 5 escopos nesta entrega, um por endpoint. Simples de exibir na tela de cadastro (checkboxes fixos) e de checar (`requireScope('ESTOQUE_CONSULTAR')`).
- **B — Reaproveitar o catálogo `Permission`/`RolePermission` de usuário.** Rejeitada: misturaria escopos de API com o catálogo de permissões de usuário — apareceriam entradas sem sentido na tela de Perfis (que não tem cliente de integração nenhum pra atribuir), e o formato de exibição (checkbox de 5 opções fixas vs. lista longa de recurso:ação) é genuinamente diferente do que a tela de Perfis já resolve bem.

**Idempotência:**

- **A — `Idempotency-Key` armazenado por cliente, replay da resposta gravada (escolhida).** Cobre retry de rede real (o cenário descrito) sem exigir que o ERP resolva isso do lado dele.
- **B — Sem mecanismo dedicado, ERP responsável por não duplicar.** Rejeitada pelo usuário — decisão explícita na brainstorm.

## Desenho

### 1. Schema Prisma (3 models novos + 1 enum)

```prisma
enum IntegrationScope {
  ESTOQUE_CONSULTAR
  PEDIDOS_VENDA_CRIAR
  PEDIDOS_COMPRA_CRIAR
  PRODUCAO_CONSULTAR
  PRODUTOS_CRIAR
}

model IntegrationClient {
  id           String    @id @default(uuid())
  name         String
  apiKeyHash   String    @unique // SHA-256 hex da key — ver nota abaixo sobre por que não é bcrypt
  active       Boolean   @default(true)
  systemUserId String    @unique // conta-sistema associada — ver Abordagens Consideradas, item "conta-sistema"
  createdBy    String    // admin que cadastrou o cliente
  createdAt    DateTime  @default(now())
  revokedAt    DateTime?
  revokedBy    String?

  systemUser User                         @relation("IntegrationClientSystemUser", fields: [systemUserId], references: [id])
  creator    User                         @relation("IntegrationClientCreator", fields: [createdBy], references: [id])
  revoker    User?                        @relation("IntegrationClientRevoker", fields: [revokedBy], references: [id])
  scopes     IntegrationClientScopeGrant[]
  idempotencyKeys IntegrationIdempotencyKey[]

  @@map("integration_clients")
}

model IntegrationClientScopeGrant {
  id       String           @id @default(uuid())
  clientId String
  scope    IntegrationScope

  client IntegrationClient @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@unique([clientId, scope])
  @@map("integration_client_scopes")
}

// Reenvio da mesma (clientId, key) devolve a resposta gravada em vez de
// reexecutar o efeito colateral (criar pedido/produto de novo).
model IntegrationIdempotencyKey {
  id           String   @id @default(uuid())
  clientId     String
  key          String
  method       String
  path         String
  statusCode   Int
  responseBody Json
  createdAt    DateTime @default(now())

  client IntegrationClient @relation(fields: [clientId], references: [id], onDelete: Cascade)

  @@unique([clientId, key])
  @@map("integration_idempotency_keys")
}
```

`User` ganha três relações nomeadas novas: `integrationClientAsSystemUser IntegrationClient? @relation("IntegrationClientSystemUser")`, `integrationClientsCreated IntegrationClient[] @relation("IntegrationClientCreator")`, `integrationClientsRevoked IntegrationClient[] @relation("IntegrationClientRevoker")`.

**Conta-sistema:** criada junto com o `IntegrationClient`, no mesmo fluxo (transação). `email` = `integration+<uuid-curto>@fabric.internal` (domínio reservado, nunca resolve de verdade — só precisa ser único e nunca colidir com um email real cadastrado por um humano), `password` = hash bcrypt de um UUID aleatório descartado (ninguém sabe a senha, então ninguém loga como essa conta mesmo que `active: true`), `name` = `"Integração: <nome do cliente>"` (aparece em auditoria/histórico como autor). Sem `Role` atribuído — não precisa de permissão nenhuma de usuário (o gate real é `requireScope`, não `requirePermission`), e sem role ela nunca aparece em listas de destinatário de notificação filtradas por papel.

### 2. `LicensedModule` novo

`API_ERP` no seed de `licensedModules` (`backend/prisma/seed.ts`), mesmo padrão de `EXPEDICAO`. `enabled: false` por padrão — ao contrário dos módulos de negócio já entregues, este é uma superfície de integração que só faz sentido ligar quando um ERP real está pronto do outro lado; começar desligado é o comportamento seguro.

### 3. Permissões novas (RBAC de usuário, para a TELA de gestão — não confundir com `IntegrationScope`, que é RBAC do cliente de API)

| Recurso:Ação | Quem (seed) |
|---|---|
| `clientes_integracao:visualizar` | ADMIN |
| `clientes_integracao:criar` | ADMIN |
| `clientes_integracao:revogar` | ADMIN |

Só ADMIN nesta entrega — cadastrar um cliente de integração é decisão de infraestrutura/segurança, não de operação do dia a dia (diferente de `tarefas_armazem`/`ocorrencias`, que MANAGER e OPERATOR também tocam).

### 4. Backend — middlewares novos

- **`apiKeyAuth.middleware.ts`** — lê `X-API-Key`, calcula `SHA-256(key)` e busca `IntegrationClient` por `apiKeyHash` (busca indexada, O(1) — **não** usa bcrypt aqui: bcrypt exige um salt por linha, o que tornaria a busca por key impossível sem iterar TODOS os clientes ativos comparando um a um; correto para senha de usuário, de baixa entropia e buscada por email primeiro, mas errado para uma API key, que já nasce com entropia alta o bastante — 32+ bytes aleatórios — pra um hash determinístico e indexável ser seguro, o mesmo padrão que Stripe/GitHub usam pra token de API). Popula `req.userId = client.systemUserId` e `req.integrationClient = client`. Sem key, key inválida ou cliente `active: false` → 401 genérico (`"API key inválida ou ausente"` — não distingue "não existe" de "revogada", pra não vazar estado do cliente a quem não deveria saber que ele existe).
- **`requireScope(scope: IntegrationScope)`** — análogo a `requirePermission`, mas contra `req.integrationClient.scopes` em vez da árvore de `Role`/`Permission` de usuário. Sem o escopo → 403.
- **`idempotency.middleware.ts`** — só nas 3 rotas de escrita. Se `Idempotency-Key` presente E já existe `(clientId, key)`: devolve a resposta gravada, pula o handler. Senão: deixa passar, mas intercepta a resposta (`res.json` interceptado, mesmo padrão de middleware de captura de resposta) pra gravar `(clientId, key, method, path, statusCode, responseBody)` antes de devolver ao cliente. Sem `Idempotency-Key`: passa direto, sem gravar nada (o header é opcional — um ERP que não manda a chave simplesmente não tem essa proteção, mas não é bloqueado).

### 5. Backend — rotas novas, sob `/api/erp/v1/*`

Ponto de montagem em `routes/index.ts`, `requireModule('API_ERP')` no `router.use('/erp/v1', ...)`, ANTES de qualquer `apiKeyAuth` (sem o módulo, 404 mesmo com key válida — mesmo princípio de todo o resto do projeto).

| Rota | Escopo | Reaproveita | Dependência extra de módulo |
|---|---|---|---|
| `GET /stock/balance?productCode=` | `ESTOQUE_CONSULTAR` | `stockService` (consulta de saldo agregado) | nenhuma |
| `POST /sales-orders` | `PEDIDOS_VENDA_CRIAR` | `salesOrderService.create(dto, req.userId!)` | `requireModule('EXPEDICAO')` |
| `POST /purchase-orders` | `PEDIDOS_COMPRA_CRIAR` | `purchaseOrderService.create(dto, req.userId!)` | `requireModule('COMPRAS')` |
| `GET /production-orders` e `GET /production-orders/:orderNumber` | `PRODUCAO_CONSULTAR` | `productionOrderService` (status, progresso, datas) | nenhuma |
| `POST /products` | `PRODUTOS_CRIAR` | `productService` — upsert por `code`: cria se não existe; se existe, atualiza só `name`/`type`/`unitId`/`categoryId` — nunca toca campos operacionais (peso/dimensões, `lotTracked`, `minStock`/`safetyStock`, regras de armazenagem) | nenhuma |

Corpo/contrato de cada rota de escrita usa os MESMOS DTOs que os controllers desktop já usam (`CreateSalesOrderDto`, `CreatePurchaseOrderDto`) — o plano de implementação decide se reaproveita o Joi validator existente tal qual ou precisa de uma variante (ex. o ERP não manda `quotationId` opcional do fluxo de cotação).

Envelope de resposta/erro idêntico ao resto da API (`{status:'success', data}` / `{status:'error', message}`).

### 6. Frontend — tela desktop nova

- **`/integration-clients`** (Configurações), RBAC `clientes_integracao:visualizar`/`criar`/`revogar`. Lista clientes (nome, ativo/revogado, escopos, criado em). "Novo Cliente": nome + checkboxes dos 5 escopos → ao criar, modal mostra a API key gerada em texto puro **uma única vez**, com aviso explícito de que não será reexibida (botão copiar, sem persistir em lugar nenhum do estado do frontend além da renderização do modal). "Revogar": `active: false`, `revokedAt`/`revokedBy` gravados — nunca deleta a linha (mantém o histórico de auditoria de tudo que aquele cliente já fez). Rotação de key = revogar + criar outro cliente (sem endpoint de "gerar nova key pro mesmo cliente" nesta entrega — cada API key pertence a um `IntegrationClient` para a vida inteira dele).

## Tratamento de erro

- Sem `X-API-Key` ou key inválida/revogada → 401 genérico.
- Key válida, sem o escopo exigido pela rota → 403 com o nome do escopo faltante na mensagem.
- Módulo dependente desligado (EXPEDICAO/COMPRAS) → 404 na rota inteira, mesmo com key e escopo corretos.
- Corpo inválido (Joi) → 400, mesmo formato do resto da API.
- Replay de `Idempotency-Key` já vista → mesma resposta (status + corpo) da primeira vez, sem reexecutar o efeito colateral.

## Testes

- Backend (integração, banco real, mesmo padrão do resto do projeto): `apiKeyAuth` (key válida/inválida/revogada → 401 nos dois casos de falha), `requireScope` (403 sem escopo, passa com escopo certo), idempotência (mesma chave não duplica o pedido/produto; chave diferente executa de novo; sem chave não é bloqueado), os 5 endpoints ponta a ponta contra os services reais, e a 404 em cascata quando `EXPEDICAO`/`COMPRAS` está desligado mesmo com key/escopo corretos.
- Frontend: spec de `IntegrationClientsView.vue` — listar, criar com escopos selecionados, modal da key exibida uma única vez, revogar — mesmo padrão de teste das demais telas de configuração do projeto.
- Verificação manual: sem um ERP real disponível nesta entrega, verificação via `curl`/Postman/Insomnia simulando as chamadas que um ERP faria (key no header, corpo JSON) — reportada como tal, não como integração testada contra um ERP real. Teste com o ERP real do cliente fica a cargo do usuário antes de considerar o módulo pronto para uso em produção.

## Fora de escopo desta entrega

- O Fabric chamar a API de um ERP externo (a direção é sempre ERP → Fabric nesta entrega) — cogitado e descartado pelo usuário na brainstorm.
- Sincronização automática/agendada (cron) — a API é sob demanda, quem decide quando chamar é o ERP.
- Webhooks de saída (Fabric notificando o ERP quando algo muda) — o padrão de notificação em uso hoje (`NotificationRule`) é para usuários humanos, não para sistemas externos; extensão futura natural se aparecer necessidade real.
- Qualquer entidade além das quatro (estoque, pedidos de venda/compra, ordens de produção, produtos) — ex. financeiro, custos, apontamento de produção.
- Rotação de API key in-place (gerar nova key pro MESMO cliente, mantendo o mesmo registro/histórico) — nesta entrega, "rotacionar" é revogar + criar outro cliente.
- Expiração/limpeza automática de `IntegrationIdempotencyKey` antigas — cresce indefinidamente nesta entrega; rastreado como débito técnico, não bloqueador (o volume esperado de pedidos/produtos criados via integração é baixo o suficiente para não ser um problema prático a curto prazo).
