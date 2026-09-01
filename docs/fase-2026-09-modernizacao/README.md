# Fase de Modernização e Estabilização — Setembro/2026

**Início da fase:** 01/09/2026
**Motivação:** o sistema Fabric MES/PCP acumulou ~11 meses de desenvolvimento de features desde o `PLANO_TRABALHO.md` original (out/2025). Antes de continuar adicionando módulos novos, esta fase faz um raio-x completo do sistema como ele está hoje em produção/desenvolvimento e organiza um cronograma de estabilização, segurança e qualidade.

## Como esta análise foi feita

Em vez de uma única passada manual, foram usados 6 agentes especializados em paralelo (via Claude Code), cada um auditando uma camada do sistema real (Node.js/Express/Prisma/MySQL no backend, Vue 3 no frontend — **não** a stack Go/Postgres/React que aparece por padrão na persona desses agentes em outros projetos; isso foi corrigido explicitamente em cada prompt):

| Agente | Escopo |
|---|---|
| `architect-review` | Arquitetura geral, layering, decisão Vue/React |
| `backend-architect` | Services, controllers, transações, race conditions |
| `database-architect` | schema.prisma, migrations, indexação, integridade |
| `frontend-developer` | Estado real da migração Vue→React, UX |
| `security-auditor` | Auth, RBAC, segredos, audit log |
| `test-automator` | Cobertura de testes e estratégia |

Os 6 relatórios foram cruzados, deduplicados e consolidados nos dois documentos abaixo.

## Documentos desta fase

1. [`01_ANALISE_DETALHADA_SISTEMA.md`](./01_ANALISE_DETALHADA_SISTEMA.md) — raio-x completo: o que existe, o que está quebrado, o que é dívida técnica, por camada.
2. [`02_CRONOGRAMA_IMPLEMENTACOES.md`](./02_CRONOGRAMA_IMPLEMENTACOES.md) — cronograma priorizado (Sprint 0 emergencial + 5 fases) para estabilizar e evoluir o sistema.

## Achados que mudam o entendimento anterior do projeto

- O `ANALISE_FALHAS_SISTEMA.md` (out/2025) apontava race condition em `stock.service.ts::reserveForOrder`. Essa função **foi corrigida**, mas o método realmente usado na maior parte do tráfego de estoque (`registerMovement`, usado por entradas/saídas manuais e recebimentos) **continua com o mesmo bug**, e a causa raiz é mais profunda do que parecia: **não existe tabela de saldo de estoque persistida** — o saldo é somado em memória a partir do histórico de movimentações a cada consulta, então não há linha para travar.
- O que parecia ser uma "migração Vue → React em andamento" (havia arquivos `.tsx` recentes) na verdade é **código morto que nunca rodou**: `react`/`react-dom` não estão instalados, `App.tsx` nunca é importado, e `npm run build` do frontend **está quebrado hoje** por causa desses arquivos.
- Existe uma falha de controle de acesso crítica não documentada antes: rotas de usuários, perfis e permissões **não verificam permissão**, apenas autenticação — qualquer usuário logado pode se promover a administrador.
- Um arquivo com credenciais reais (`backend/.env.migration`) está versionado no git.
