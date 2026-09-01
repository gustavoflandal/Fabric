# Índice da Documentação — Fabric

**Atualizado em:** 01/09/2026 — após faxina que removeu ~55 documentos obsoletos (relatórios de sessão, diários de bug-fix pontuais, snapshots de dados de seed e uma transcrição de chat colada por engano). O que resta abaixo é o que se pretende manter como referência viva.

**Aviso de defasagem:** os documentos numerados `01`-`07` e `DOCUMENTACAO_TECNICA.md`/`GUIA_USUARIO.md`/`README.md` ainda não passaram por essa revisão de conteúdo (só a faxina de remoção de arquivos obsoletos foi feita) — foram escritos no início do projeto e é esperado que tenham divergido do código atual em vários pontos, da mesma forma que `docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md` estava antes de ser reescrito. Trate-os como ponto de partida, não como verdade absoluta; confira contra `backend/prisma/schema.prisma` e o código antes de confiar em algo específico. Revisão de conteúdo desse núcleo é a próxima etapa planejada.

---

## Núcleo de referência (escrito no início do projeto — conteúdo não revisado ainda)

| Documento | Conteúdo |
|---|---|
| [`01_VISAO_GERAL.md`](./01_VISAO_GERAL.md) | Objetivo do sistema, contexto |
| [`02_MODELO_DADOS.md`](./02_MODELO_DADOS.md) | Modelo de dados — segurança, cadastros |
| [`03_MODELO_DADOS_PARTE2.md`](./03_MODELO_DADOS_PARTE2.md) | Modelo de dados — estoque e almoxarifado |
| [`04_MODELO_DADOS_PARTE3.md`](./04_MODELO_DADOS_PARTE3.md) | Modelo de dados — manutenção de ativos |
| [`05_APIS_ENDPOINTS.md`](./05_APIS_ENDPOINTS.md) | Endpoints da API REST |
| [`06_ROADMAP_IMPLEMENTACAO.md`](./06_ROADMAP_IMPLEMENTACAO.md) | Roadmap original por fases |
| [`07_ESTRUTURA_PROJETO.md`](./07_ESTRUTURA_PROJETO.md) | Estrutura de pastas do repositório |
| [`DOCUMENTACAO_TECNICA.md`](./DOCUMENTACAO_TECNICA.md) | Arquitetura, API, modelos, fluxos — visão consolidada |
| [`GUIA_USUARIO.md`](./GUIA_USUARIO.md) | Manual do usuário final |
| [`README.md`](./README.md) | Apresentação do projeto |

## Referência com conteúdo revisado nesta faxina

| Documento | Conteúdo |
|---|---|
| [`08_SISTEMA_AUDIT_LOGS.md`](./08_SISTEMA_AUDIT_LOGS.md) | Sistema de audit log: captura configurável por modo, limpeza manual e automática |
| [`09_MODULO_GESTAO_USUARIOS_COMPLETO.md`](./09_MODULO_GESTAO_USUARIOS_COMPLETO.md) | Módulo de usuários, perfis e permissões |
| [`PERMISSOES_SISTEMA.md`](./PERMISSOES_SISTEMA.md) | Lista real de permissões RBAC, reconciliada contra o código |
| [`SISTEMA_NOTIFICACOES.md`](./SISTEMA_NOTIFICACOES.md) | Sistema de notificações |

## Guias operacionais

| Documento | Conteúdo |
|---|---|
| [`SETUP.md`](./SETUP.md) | Setup inicial do ambiente de desenvolvimento |
| [`BACKUP_GUIDE.md`](./BACKUP_GUIDE.md) | Backup e restauração do banco (`npm run backup`/`restore`) |
| [`INSTALACAO_PDF.md`](./INSTALACAO_PDF.md) | Dependência de geração de PDF (`jspdf`) |
| [`10_TROUBLESHOOTING.md`](./10_TROUBLESHOOTING.md) | Problemas comuns e soluções |

## Análises e planejamento em andamento

| Documento | Conteúdo |
|---|---|
| [`fase-2026-09-modernizacao/`](./fase-2026-09-modernizacao/README.md) | Cronograma de modernização em execução (decisões técnicas, débito corrigido fase a fase) |
| [`fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md`](./fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md) | Análise e plano faseado para completar o WMS |

---

## Padrão para novos documentos

A partir desta faxina, documentação nova segue o padrão estabelecido em `fase-2026-09-modernizacao/`:

- **Documento de sessão/correção pontual não vira arquivo em `docs/`** — isso é o que a mensagem do commit é para. Um `.md` só se justifica se for referência que alguém vai consultar depois, não um relato do que foi feito numa tarde.
- **Toda afirmação sobre o código verifica contra o código antes de ser escrita** — não descrever de memória o que um model/endpoint faz; ler o arquivo.
- **Divergências e inconsistências reais são registradas, não escondidas** — um documento que esconde um problema para parecer arrumado engana quem lê depois.
- **Sem duplicação de tópico** — um assunto, um documento. Se surgir uma segunda versão, ela substitui a primeira (com nota do que mudou), não convive ao lado.
