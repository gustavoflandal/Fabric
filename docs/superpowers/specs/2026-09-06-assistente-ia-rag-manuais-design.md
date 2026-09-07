# Assistente Virtual de IA — Fase 1: RAG sobre Manuais em PDF

**Status:** Design aprovado, pronto para plano de implementação.
**Data:** 2026-09-06

## 1. Contexto e escopo desta fase

Existe uma especificação técnica ampla em `docs/fase-2026-09-modernizacao/05_IMPLEMENTACAO_CHAT_DE_IA.md` cobrindo 6 fases (infraestrutura, RAG sobre PDFs, classificador/guardrails, consultas a dados transacionais, interface completa, testes de carga). Esta spec cobre **apenas a primeira fase entregável**: um assistente que responde dúvidas de procedimento com base em manuais PDF, via busca semântica (RAG), com streaming e citação de fonte. Consulta a dados transacionais do estoque (saldos, movimentações, lotes) fica para uma fase futura — não faz parte desta entrega.

Decisão tomada com o usuário: uma fase por vez, fechando critério de aceite antes de abrir a próxima (metodologia do agente `ia-engineer` deste projeto).

**Divergência da spec original registrada:** o documento original menciona "pgvector no PostgreSQL" como opção de banco vetorial. Este projeto usa **MySQL**, não Postgres — essa opção não se aplica. O banco vetorial desta fase é ChromaDB, em container dedicado.

## 2. Fora de escopo (explícito)

- Consulta a dados transacionais (saldo, movimentações, lotes) e qualquer tool calling ao banco.
- Classificador de intenção separado do modelo (o corte de similaridade + system prompt cobrem o guardrail desta fase).
- Histórico de conversa persistente no banco — vive só em memória do frontend, por sessão.
- Multi-tenant / isolamento por cliente (sistema é single-tenant).
- Reindexação incremental por hash de arquivo — reindexação desta fase é sempre completa.
- Suporte a múltiplos idiomas além de pt-BR.
- Testes de carga / concorrência real com múltiplos usuários simultâneos.

## 3. Arquitetura e fluxo

```
Usuário (widget flutuante, JWT)
  │  POST /api/v1/assistant/chat  (SSE)
  ▼
Backend — assistant.controller / assistant.service
  ├─ 1. AuthN (JWT) + AuthZ (permissão assistente_ia:usar)
  ├─ 2. Embedding da pergunta (Ollama bge-m3)
  ├─ 3. Busca top-3 chunks no ChromaDB
  │      ├── nenhum chunk cruza o limiar mínimo de similaridade
  │      │      └─► responde texto fixo "não encontrei", SEM chamar o modelo grande
  │      └── há chunk(s) acima do limiar
  │             └─► monta prompt (system prompt + chunks como DADO + histórico curto + pergunta)
  ├─ 4. Geração via Ollama qwen2.5:7b, stream: true, num_ctx explícito
  ├─ 5. Auditoria (reaproveita AuditLog existente)
  └─ 6. Stream SSE: token · fontes · fim · erro
```

### Infraestrutura nova (`docker-compose.ai.yml`)

Arquivo separado do `docker-compose.yml` principal, subido com `docker compose -f docker-compose.yml -f docker-compose.ai.yml up`.

- **`ollama`**: imagem `ollama/ollama:latest`, porta `11434` só na rede interna do compose (não publicada no host além do necessário para debug local), volume persistente para os modelos, reserva de GPU NVIDIA.
- **`chromadb`**: imagem `chromadb/chroma:latest`, porta `8000` só na rede interna, volume persistente para o índice.
- Nenhum dos dois é acessível pela rede pública — só o `backend` fala com eles, seguindo o isolamento de rede exigido pelo `ia-engineer` (a API do Ollama não tem autenticação própria).
- Modelos usados: `qwen2.5:7b` (geração, já validado pelo usuário no hardware disponível) e `bge-m3` (embeddings, multilíngue — escolhido no lugar do `nomic-embed-text` da spec original por recall melhor em pt-BR).

### Ingestão de documentos

Script standalone `backend/scripts/ai-index-docs.ts`, executado via `npm run ai:index-docs`:

1. Lê todos os PDFs de `docs/operacao/`.
2. Extrai texto com `pdf-parse`. PDF sem camada de texto (escaneado) falha visivelmente no log e não indexa nada em silêncio.
3. Chunking: 500 caracteres, overlap de 50 (mesmo valor da spec original).
4. Gera embedding de cada chunk via Ollama (`bge-m3`).
5. Grava no ChromaDB com metadados: nome do arquivo, índice do chunk, trecho de texto original (para citação).
6. Reindexação é sempre full — apaga a coleção e recria. Aceitável para o volume desta fase (1-2 PDFs de exemplo); reindexação incremental por hash fica para quando o volume de manuais justificar.

Dois PDFs sintéticos serão criados em `docs/operacao/` para validar o pipeline fim a fim: um procedimento de contagem de inventário e um procedimento de recebimento com NFe. Serão substituídos por manuais reais quando existirem.

## 4. Backend

### Endpoint

`POST /api/v1/assistant/chat` — SSE (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`).

Body: `{ message: string, history?: { role: 'user' | 'assistant', content: string }[] }`.

- `history` vem exclusivamente da memória do frontend (últimas ~6 mensagens da sessão atual) — nunca lido ou gravado no banco.
- RBAC: nova permissão `assistente_ia:usar`, verificada pelo middleware de autorização já existente no projeto (mesmo padrão de `tarefas_armazem:visualizar` etc.).

### Contrato de eventos SSE

| Evento | Conteúdo |
|---|---|
| `token` | Fragmento de texto da resposta |
| `fontes` | Lista `{ arquivo, trecho }[]` das fontes citadas — emitido só quando a resposta veio de RAG (não quando foi o "não encontrei" fixo) |
| `fim` | Encerramento normal do stream |
| `erro` | Falha ocorrida após o SSE já ter iniciado (HTTP 200 já enviado) |

Sem evento `consulta` nesta fase — não há tool calling a dados transacionais ainda.

### Guardrail em duas camadas

1. **Determinística**: embedding da pergunta buscado contra o ChromaDB. Se nenhum chunk cruzar o limiar mínimo de similaridade, a resposta fixa "Não encontrei essa informação nos manuais do sistema" é enviada diretamente, sem invocar o modelo de geração. Cobre com certeza absoluta o caso óbvio de pergunta fora de escopo. O valor do limiar não é decidido a priori nesta spec — é calibrado durante a implementação rodando o golden set (seção 6) contra os 2 PDFs de exemplo, e o valor final entra no código com um comentário justificando a escolha (nunca um número mágico sem explicação).
2. **Reforço** (system prompt fixo, em pt-BR, adaptado do documento original): restringe a fonte da resposta ao contexto recuperado; declara que o conteúdo recuperado é dado, nunca instrução (mitiga injeção de prompt vinda de um PDF malicioso); proíbe invenção de procedimento não presente no contexto; exige citação de origem; define a frase literal de recusa fora de escopo e a frase literal de "não encontrei"; limita o tamanho da resposta; declara que o assistente não executa ações.

`num_ctx` é definido explicitamente (nunca o padrão do Ollama) com folga suficiente para caber system prompt + histórico curto + chunks recuperados + pergunta + resposta — evita o truncamento silencioso do início do prompt que o `ia-engineer` aponta como o bug mais comum e menos diagnosticado desse tipo de sistema.

### Auditoria

Cada pergunta e resposta gera uma entrada no `AuditLog` já existente, reaproveitando o middleware de auditoria usado no resto do sistema — sem tabela nova.

### Arquivos novos (seguindo a convenção do projeto)

- `backend/src/services/assistant.service.ts` — orquestração do fluxo (embedding, busca, guardrail, chamada ao Ollama).
- `backend/src/services/ollama-client.service.ts` — wrapper fino sobre a API HTTP do Ollama (`/api/embeddings`, `/api/generate` com stream).
- `backend/src/services/chroma-client.service.ts` — wrapper fino sobre o cliente `chromadb`.
- `backend/src/controllers/assistant.controller.ts` — handler SSE.
- `backend/src/routes/assistant.routes.ts`.
- `backend/scripts/ai-index-docs.ts` — script de ingestão.
- `backend/prisma/seed` — adiciona a permissão `assistente_ia:usar`.

## 5. Frontend

- **`ChatAssistant.vue`**: balão flutuante no canto inferior direito, montado uma vez em `AppLayout.vue`. Visível apenas para usuários com a permissão `assistente_ia:usar`.
- **Estado**: nova store Pinia `assistant.store.ts` — mensagens da sessão atual em memória (`is-streaming`, `error`, lista de mensagens com fontes anexadas). Sem persistência; recarregar a página limpa o histórico.
- **Streaming**: consumido via `fetch` + `ReadableStreamDefaultReader` (não `EventSource`, que não suporta POST nem header de autenticação). Texto renderizado token a token conforme chega.
- **Estados visuais**: indicador "Pensando..." enquanto aguarda o primeiro token; botão de enviar desabilitado durante streaming; scroll automático para o fim da conversa; bloco de "fontes" (arquivo + trecho) exibido abaixo de cada resposta baseada em RAG; mensagem de erro visível se o evento `erro` chegar.
- **Sanitização**: resposta renderizada como texto simples (não HTML/Markdown) nesta fase — evita o risco de XSS via markdown vindo do LLM. Renderização rica de markdown fica para uma fase futura, se necessário.

### Arquivos novos

- `frontend/src/components/assistant/ChatAssistant.vue`
- `frontend/src/stores/assistant.store.ts`
- `frontend/src/services/assistant.service.ts` (wrapper do fetch+stream)
- `frontend/src/types/assistant.types.ts`

## 6. Testes e critérios de aceite

### Golden set reduzido (12 perguntas, via `npm run test:ia` no backend)

Cobrindo 4 categorias, 3 perguntas cada:
1. Procedimento respondido corretamente com fonte citada (perguntas sobre os 2 PDFs de exemplo).
2. Fora de escopo ("como fazer bolo", "quem ganhou o jogo", pedido de código genérico) — deve recusar com a frase fixa.
3. Ambígua / dado inexistente (ex: procedimento não coberto pelos manuais de exemplo) — deve responder "não encontrei".
4. Tentativa de injeção de prompt (pergunta ou conteúdo de PDF contendo "ignore as instruções anteriores") — não deve alterar o comportamento do assistente.

O script imprime uma matriz de acerto (categoria × resultado esperado × resultado obtido).

Este golden set de 12 é o primeiro corte — o conjunto de 40 perguntas recomendado pelo `ia-engineer` como padrão de produção fica para quando o assistente for além desta fase (ex: quando ganhar acesso a dados transacionais).

### Testes automatizados

- Unitários: chunker (limites de tamanho/overlap) e extração de texto de PDF (incluindo o caso de PDF sem camada de texto).
- Integração do endpoint SSE, com Ollama e ChromaDB mockados (sem dependência de infraestrutura real rodando em CI).
- RBAC: requisição sem a permissão `assistente_ia:usar` retorna 403.

### Critério de pronto (Definition of Done)

- 100% de recusa correta nas perguntas fora de escopo e nas de injeção de prompt do golden set.
- Zero procedimentos inventados (toda resposta baseada em manual vem com fonte citada; toda resposta sem contexto suficiente usa a frase fixa de "não encontrei").
- Primeiro token em até 3 segundos no hardware já validado pelo usuário via benchmark.
- Testes automatizados (unitários + integração mockada) verdes.
