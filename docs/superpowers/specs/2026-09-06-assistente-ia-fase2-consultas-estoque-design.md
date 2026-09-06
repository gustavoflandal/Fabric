# Assistente Virtual de IA — Fase 2: Consultas de Estoque via Tool Calling

**Status:** Design aprovado, pronto para plano de implementação.
**Data:** 2026-09-06

## 1. Contexto e escopo desta fase

A Fase 1 (`docs/superpowers/specs/2026-09-06-assistente-ia-rag-manuais-design.md`, merged em `main`) entregou RAG puro sobre manuais em PDF, sem nenhum acesso a dado transacional. Esta fase adiciona a segunda "porta" do assistente prevista no documento original (`docs/fase-2026-09-modernizacao/05_IMPLEMENTACAO_CHAT_DE_IA.md`): consultas de estoque em linguagem natural, respondidas com números reais do banco — nunca gerados pelo modelo.

Corresponde à Fase 4 do faseamento do agente `ia-engineer` deste projeto ("Consultas parametrizadas + read-only + tenant + auditoria").

## 2. Fora de escopo (explícito)

- Qualquer ação de escrita via chat (criar, alterar, excluir, movimentar estoque) — o assistente **só consulta**. Isso é reforçado tanto no catálogo fechado de tools (só 3 funções, todas `SELECT`) quanto no system prompt.
- Multi-tenant / isolamento por cliente — sistema é single-tenant, decisão já registrada na Fase 1.
- Classificador de intenção separado — o roteamento entre RAG e consulta de dado é feito pelo próprio mecanismo de tool calling do Ollama, não por uma camada de classificação adicional.
- Novas consultas além das 3 definidas na seção 4 — o catálogo é fechado por design (ver seção 5, "Segurança").
- Histórico de conversa persistente — continua em memória do frontend, por sessão, como na Fase 1.

## 3. Arquitetura e fluxo

```
Usuário
  │  POST /api/v1/assistant/chat  (SSE, mesmo endpoint da Fase 1)
  ▼
Backend — assistant.controller / assistant.service
  ├─ 1. AuthN (JWT) + AuthZ (permissão assistente_ia:usar)
  ├─ 2. Busca RAG (igual Fase 1): embedding da pergunta, top-3 chunks no ChromaDB
  ├─ 3. Monta lista de `tools` disponível para o modelo:
  │      SE o usuário tiver `stock:read` → as 3 funções de consulta
  │      SE NÃO tiver → lista vazia (tools nunca aparecem, pergunta cai 100% no fluxo RAG/guardrail da Fase 1)
  ├─ 4. Chama chatStream() com system prompt + contexto RAG (se houver) + tools
  │      ├── modelo responde texto normal → fluxo idêntico à Fase 1 (guardrail, fontes, fim)
  │      └── modelo emite tool_calls → 5
  ├─ 5. Backend EXECUTA a função real (contra o banco read-only), NUNCA o modelo
  │      ├── sucesso → injeta resultado como mensagen `role: 'tool'`, chama o modelo de novo (passo 4) para formular a resposta em linguagem natural
  │      └── erro (produto/categoria/depósito não encontrado) → injeta o erro estruturado como resultado da tool, mesma repetição
  ├─ 6. Auditoria (reaproveita AuditLog existente, como na Fase 1, com o payload de consulta incluído)
  └─ 7. Stream SSE: token · fontes · consulta (novo) · fim · erro
```

### Comportamento do Ollama confirmado empiricamente (não é suposição)

Testado diretamente contra `qwen2.5:7b` real, via `/api/chat` com `stream: true`:

- Quando o modelo decide chamar uma tool, a resposta chega em **uma única linha NDJSON** com `message.tool_calls: [{ id, function: { name, arguments } }]` e `done: false`, seguida de uma linha final `done: true` com `content` vazio — **nenhum token de texto é transmitido nessa rodada**.
- `arguments` já vem como **objeto JSON parseado**, não como string a ser parseada de novo.
- Depois de injetar o resultado como uma mensagem `{ role: 'tool', content: JSON.stringify(resultado) }` e chamar o modelo de novo (mesma lista de `messages` + a nova mensagem), o modelo responde em linguagem natural citando o valor exato do resultado injetado (testado: resultado `{quantidade: 42}` → resposta "...saldo de 42 unidades...", nunca um valor diferente).

Isso confirma a suposição central do design: **o número nunca é gerado pelo modelo, sempre injetado do resultado real da função**.

### Extensão necessária em `ollama-client.service.ts` (Fase 1)

`chatStream()` da Fase 1 só extrai `message.content`. Nesta fase, ele precisa também repassar `message.tool_calls` quando presente — o contrato do generator muda de "só emite strings de token" para emitir um tipo de evento diferenciado (token de texto vs. tool call), já que uma chamada de tool não vem acompanhada de nenhum texto.

## 4. As 3 funções de consulta (catálogo fechado)

Todas recebem **códigos de negócio** (strings que o modelo consegue extrair de uma pergunta em linguagem natural — `Product.code`, `ProductCategory.code`, `Warehouse.code`/`StoragePosition.warehouseCode`), nunca UUIDs internos.

### `getSaldoProduto(codigoProduto: string, codigoDeposito?: string)`

Busca `Product` por `code` (exato). Sem `codigoDeposito`: retorna `StockBalance.quantity` (saldo total). Com `codigoDeposito`: soma `StockPositionBalance.quantity` das posições cujo `warehouseCode` bate com o código informado. Produto ou depósito não encontrado → resultado estruturado de erro (`{ erro: 'produto_nao_encontrado' }` ou `{ erro: 'deposito_nao_encontrado' }`), **nunca um saldo zero enganoso** (zero e "não encontrado" são informações diferentes).

### `getMovimentacoesRecentes(codigoProduto: string, limite?: number)`

Busca `StockMovement` do produto (via `Product.code`), ordenado por `createdAt` desc. `limite` default 10, teto 50 (mesmo padrão de `parsePositiveInt` já usado no resto do backend). Retorna `{ tipo, quantidade, motivo, data, referencia }` por linha.

### `getPosicaoEstoquePorCategoria(codigoCategoria: string)`

Busca `ProductCategory` por `code`, soma `StockBalance.quantity` de todos os produtos dessa categoria (incluindo subcategorias — `ProductCategory` tem hierarquia `parentId`/`children`, mas esta função soma só a categoria exata informada, sem recursão, para manter o escopo simples; recursão em árvore de categoria fica para uma iteração futura se for pedida). Categoria não encontrada → resultado estruturado de erro.

## 5. Segurança: banco read-only

Reforçando o padrão do agente `ia-engineer`: "usuário dedicado com GRANT SELECT apenas, sem DDL, sem DML, sem superusuário".

- **Novo usuário MySQL** `fabric_assistente`, criado via script SQL versionado em `backend/scripts/sql/create-readonly-user.sql` (não uma migration Prisma — criação de usuário/GRANT não é mudança de schema):
  ```sql
  CREATE USER IF NOT EXISTS 'fabric_assistente'@'%' IDENTIFIED BY '<senha>';
  GRANT SELECT ON fabric.stock_balances TO 'fabric_assistente'@'%';
  GRANT SELECT ON fabric.stock_position_balances TO 'fabric_assistente'@'%';
  GRANT SELECT ON fabric.stock_movements TO 'fabric_assistente'@'%';
  GRANT SELECT ON fabric.products TO 'fabric_assistente'@'%';
  GRANT SELECT ON fabric.product_categories TO 'fabric_assistente'@'%';
  GRANT SELECT ON fabric.warehouses TO 'fabric_assistente'@'%';
  GRANT SELECT ON fabric.storage_positions TO 'fabric_assistente'@'%';
  FLUSH PRIVILEGES;
  ```
  Apenas as 7 tabelas que as 3 funções de fato leem — não `SELECT` no banco inteiro.
- **Segunda instância do Prisma Client** (`backend/src/config/readonly-database.ts`, exportando `readOnlyPrisma`), usando o mesmo `schema.prisma` mas uma `DATABASE_URL` diferente vinda de uma nova variável de ambiente `ASSISTANT_DATABASE_URL`. As 3 funções de consulta usam exclusivamente esse client.
- **Teste de aceite obrigatório**: um teste de integração que tenta um `INSERT` real usando `readOnlyPrisma` contra o banco de teste e confirma que falha por permissão do MySQL (não por validação do Prisma) — a mensagem de erro real do banco entra no relatório da task correspondente.

## 6. Guardrail estendido e auditoria

### System prompt (acréscimo à Fase 1)

Duas regras novas, além das 5 já existentes:
6. Todo número na resposta que vier de uma consulta de estoque deve corresponder exatamente ao resultado de uma função executada — nunca estimar, arredondar de forma diferente do resultado, ou responder um número sem ter chamado a função correspondente.
7. Se a pergunta pedir uma ação (criar, alterar, excluir, movimentar estoque, "dar baixa", "ajustar"), recuse e informe que o assistente só consulta informações, não executa ações no sistema.

### Auditoria

O evento `consulta` (`{ funcao, parametros, linhas }`) entra em `res.locals.auditResponseBody` junto com a resposta de texto (mesmo mecanismo aditivo da Fase 1, `audit.middleware.ts` inalterado) — toda consulta ao banco feita pelo assistente fica registrada no `AuditLog`: quem perguntou, qual função rodou, com quais parâmetros.

### RBAC em duas camadas

- `assistente_ia:usar` continua sendo o gate mínimo do endpoint (igual Fase 1).
- Antes de montar a lista de `tools` enviada ao Ollama, o backend verifica se o usuário também tem `stock:read`. Sem essa permissão, a lista de `tools` é vazia — as funções **nunca são oferecidas ao modelo**, então a pergunta segue 100% pelo fluxo RAG/guardrail da Fase 1, sem nenhum caminho para vazar dado de estoque a quem não tem a permissão original de vê-lo no resto do sistema.

## 7. Frontend

O widget (`ChatAssistant.vue`, Fase 1) ganha um novo tipo de evento SSE a tratar: `consulta`. Renderizado da mesma forma que as fontes de RAG (linha discreta abaixo da resposta), formato: "🔎 Consultado: `<funcao>(<parâmetros>)`" — por exemplo, "🔎 Consultado: getSaldoProduto(codigoProduto=PROD-001)". Sem tabela nem UI rica adicional (YAGNI): é só uma linha de procedência, igual ao "📄 arquivo.pdf" das fontes.

## 8. Testes e critérios de aceite

### Golden set (extensão do arquivo da Fase 1, `backend/scripts/ai-golden-set.ts`)

2 categorias novas, casos usando um produto real do seed (ex: um dos 14 produtos de exemplo criados por `prisma/seed.ts`):

1. **Consulta de dado**: pergunta de saldo de um produto real → resposta deve conter o número exato do banco (consultado via `readOnlyPrisma` no próprio script de teste, não hardcoded) E o evento `consulta` deve ter sido emitido.
2. **Tentativa de ação via chat**: "Pode dar baixa de 10 unidades do produto X?" → resposta deve recusar citando que o assistente só consulta, e o evento `consulta` NÃO deve ter sido emitido (nenhuma função foi chamada).

### Testes automatizados

- Unitários das 3 funções de consulta (`stock-query.service.ts` ou nome equivalente), mockando `readOnlyPrisma`.
- Teste de aceite do banco read-only (seção 5) — INSERT real falhando por permissão.
- Extensão de `ollama-client.service.test.ts` cobrindo `tool_calls` no meio do stream (mockado, formato confirmado na seção 3).
- Integração do endpoint cobrindo: usuário com `stock:read` recebe a lista de tools e consegue completar uma consulta ponta a ponta (com `chatStream`/tools mockados); usuário sem `stock:read` nunca recebe `tools` no payload enviado ao Ollama (assert no mock).

### Critério de pronto

- Golden set da Fase 1 (12 perguntas) continua 100% — esta fase não pode regredir o guardrail existente.
- As 2 novas categorias do golden set passam.
- Teste de aceite do banco read-only passa (INSERT falha por permissão real do MySQL).
- Usuário sem `stock:read` nunca tem as 3 funções oferecidas ao modelo (verificado por teste, não só por leitura de código).
