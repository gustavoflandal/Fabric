# Arquitetura Modular e Licenciamento de Módulos

**Data:** 01/09/2026
**Status:** Decisão de arquitetura aprovada — plano de implementação, ainda não executado
**Branch:** `arquitetura-modular-licenciamento`
**Contexto:** decidido em conversa antes de retomar a implementação do WMS (`docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md`), porque o WMS é o primeiro módulo opcional real do sistema e precisa nascer já respeitando a fronteira descrita aqui.

---

## 1. Motivação

O Fabric é uma plataforma logística com módulos que podem ser licenciados de forma independente: um cliente pode contratar só o PCP (planejamento e controle de produção) sem o WMS (gestão de armazém), ou os dois juntos. O sistema precisa:

1. Funcionar completo com **só o PCP**, sem exigir nenhum dado ou fluxo do WMS.
2. Quando o WMS **também** estiver licenciado, integrar-se profundamente com o PCP (mesmo produto, mesmo estoque, mesmo recebimento — não dados duplicados) e estender processos existentes com comportamento novo.
3. Deixar claro, no código e no schema, o que é núcleo (sempre presente) e o que é extensão de um módulo opcional — para que adicionar YMS no futuro siga o mesmo padrão.

**Modelo de deploy confirmado:** uma instalação por cliente (não é SaaS multi-tenant compartilhado). Isso significa que licenciar um módulo é uma configuração por instalação, não um filtro por `tenantId` espalhado pelo schema — o problema é bem menor do que multi-tenancy real.

## 2. Estado atual verificado no código (01/09/2026)

- **Zero acoplamento cruzado hoje.** `stock.service.ts`, `production-order.service.ts`, `purchase-receipt.service.ts` e os serviços de contagem não importam nem referenciam `Warehouse`/`WarehouseStructure`/`StoragePosition` em nenhum ponto — confirmado por grep. Só `storage-position.service.ts` toca nesses models. O PCP já roda de ponta a ponta sem o módulo estrutural do WMS existir.
- **`StockBalance` (agregado por produto, PCP) já foi desenhado para não depender de posição** — decisão D1 de `WMS_IMPLEMENTATION_ANALYSIS.md`: o saldo por posição (`StockPositionBalance`, ainda não implementado) é uma camada aditiva por cima, não uma substituição. Essa decisão já estava alinhada com licenciamento modular antes de este documento existir.
- **O que existe hoje como "módulo" (`modules:view_pcp`/`view_wms`/`view_yms`) é só preferência de navegação por usuário**, checada no frontend (`auth.store.ts`) para mostrar/esconder abas. **Não há enforcement nenhum no backend** — se um usuário tiver a permissão `armazens:visualizar`, ele acessa `/warehouses` independente de qualquer coisa relacionada a "licença". Ou seja: hoje, licenciar um módulo e permitir que um usuário o veja são, na prática, a mesma checagem rasa — o que não sustenta uma venda real de "só PCP" (qualquer admin do cliente PCP-only poderia se autoconceder a permissão de WMS e usar rotas que não deveriam existir pra ele).
- **YMS não tem nenhum código hoje** — só o nome reservado na permissão. Não é um módulo real ainda, é um placeholder para quando existir.

## 3. Modelo proposto

Duas checagens em camadas, não uma:

```
Requisição → authMiddleware (autenticado?)
           → requireModule(modulo) (a INSTALAÇÃO tem esse módulo licenciado?)
           → requirePermission(recurso, ação) (o USUÁRIO tem essa permissão?)
```

`requireModule` é novo. `requirePermission` continua exatamente como está (RBAC por usuário, documentado em `PERMISSOES_SISTEMA.md`) — a mudança é que ele passa a ser a segunda camada, não a única.

### 3.1 Licenciamento por instalação

- Nova tabela, ex. `LicensedModule` (`code` — `PCP`, `WMS`, `YMS`; `enabled Boolean`), lida uma vez no boot e cacheada em memória (uma instalação não muda de módulo licenciado a cada request). `PCP` nasce sempre habilitado — é o núcleo, não opcional.
- Configurada no onboarding do cliente (seed ou script, não precisa de UI de autoatendimento nem chave de licença criptográfica — o modelo de deploy é uma instalação por cliente, gerenciada pelo fornecedor, não autoatendimento público).
- `requireModule(codigo)`: middleware aplicado **no ponto de montagem das rotas** (`routes/index.ts`), ex. `router.use('/warehouses', requireModule('WMS'), warehouseRoutes)` — bloqueia (404) a superfície inteira do módulo com uma linha por montagem, em vez de checagem espalhada rota a rota.
- Endpoint novo (`GET /system/licensed-modules` ou incluído em `GET /auth/me`) para o frontend saber quais módulos existem nesta instalação.
- Frontend: guard de rota do Vue Router e menu lateral passam a checar licença da instalação **e** permissão do usuário — hoje só checam a segunda.

### 3.2 Campos condicionais em entidades compartilhadas

Nem toda extensão de módulo é uma tabela nova. `Product` é o cadastro mais claro: com WMS licenciado, o cadastro de produto precisa de dados que um cliente só-PCP nunca preenche — peso, volume, embalagem, empilhamento (quantas unidades podem empilhar), segregação (grupo de incompatibilidade de armazenagem, ex. produtos que não podem ficar próximos).

- Esses campos entram no `Product` como **colunas opcionais** (nullable), não uma tabela `ProductWMS` separada — continuam sendo atributos do produto, só que só relevantes condicionalmente. Alimentam diretamente a regra de alocação (`StorageRule`, já prevista na Fase 4 do plano do WMS) e a checagem de capacidade de posição.
- A UI do formulário de produto mostra a seção "Dados para Armazenagem" **só quando o módulo WMS está licenciado** para a instalação — não é um campo a mais que todo cliente PCP precisa ignorar, ele nem aparece.
- Esse é o padrão a repetir para qualquer entidade compartilhada que WMS (ou um módulo futuro) precise estender: campos opcionais na mesma entidade, seção condicional na UI — nunca uma tabela paralela nem uma segunda fonte de verdade sobre o mesmo produto.

### 3.3 Processos que se ramificam por licença

Esta é a mudança mais profunda descoberta nesta conversa: **o mesmo processo de negócio tem dois comportamentos**, não é "WMS adiciona uma tela nova" — é "WMS muda como o processo já existente se executa".

**Recebimento (`PurchaseReceipt`):**
- Sem WMS: fluxo linear como já funciona hoje — criar recebimento, conferir quantidade (`acceptedQty`/`rejectedQty`), entrada direta no saldo (`StockBalance`). Continua exatamente assim, é o comportamento padrão do núcleo.
- Com WMS: o recebimento vira uma **orquestração de tarefas despachadas para coletor de dados ou smartphone**: descarga → conferência → etiquetagem → quarentena → alocação. Cada etapa é uma tarefa (`WarehouseTask`, já previsto na Fase 5 do plano do WMS) atribuída a um operador, executada em um dispositivo móvel, não uma ação síncrona de admin numa tela desktop.

**Separação/Expedição (picking/shipping):** mesmo padrão — confirmado nesta conversa que também vira orientado a tarefa/dispositivo quando WMS está ativo, pelo mesmo mecanismo de `WarehouseTask`.

Consequência prática para o plano do WMS já escrito: as Fases 4 ("Recebimento com conferência e endereçamento") e 5 ("Separação e tarefas de armazém") de `WMS_IMPLEMENTATION_ANALYSIS.md` foram desenhadas como sequenciais e quase independentes. Não são — quando WMS está ativo, recebimento **é** uma sequência de tarefas, e separação **é** a mesma mecânica aplicada à saída. Essas duas fases precisam ser refundidas numa revisão do plano antes da implementação (não feito neste documento — ver seção 5).

**Superfície de API para dispositivo móvel:** decorre diretamente do parágrafo acima. Tarefas de armazém (descarga, conferência, etiquetagem, quarentena, alocação, picking) precisam de endpoints enxutos e orientados a fluxo de trabalho — "minhas tarefas", "iniciar tarefa", "confirmar leitura de código de barras/posição", "concluir etapa" — distintos da API administrativa CRUD que já existe. Essa superfície só existe quando WMS está licenciado (é, ela mesma, parte do módulo). Fica registrado como requisito novo para quando a Fase 4/5 revisada do plano do WMS for desenhada — este documento não especifica os endpoints, só estabelece que essa camada existe e é WMS-only.

## 4. O que fica para depois (não decidido/feito agora)

- **Se "compras" (orçamentos/pedidos/recebimentos) é PCP-core ou um módulo próprio.** Proposta em aberto: por ora tratar como PCP-core (o recebimento sem WMS já funciona e faz parte do ciclo básico de produção — sem compra não tem matéria-prima). Nenhuma decisão formal tomada; revisitar se aparecer um caso real de cliente que quer produção sem compras formais.
- **Especificação dos endpoints de dispositivo móvel** e o desenho exato de `WarehouseTask` para recebimento/picking — depende da revisão das Fases 4/5 do plano do WMS.
- **UI de administração do licenciamento** (tela para o fornecedor ativar/desativar módulo de uma instalação) — hoje basta seed/script; uma tela só se justifica se o processo de onboarding pedir.
- **Implementação do mecanismo em si** (`LicensedModule`, `requireModule`, endpoint de módulos licenciados, guard de frontend) — este documento descreve o desenho, a implementação é uma tarefa separada, pequena e fundacional, recomendada **antes** de retomar a branch `wms-analise-planejamento` (ou em paralelo, mas sem o WMS assumir nenhum atalho que a torne inviável depois).

## 5. Impacto no plano do WMS existente

`WMS_IMPLEMENTATION_ANALYSIS.md` precisa de uma revisão (não feita aqui) que incorpore:

1. Fases 4 e 5 fundidas em uma única fase de "recebimento e separação orientados a tarefa", condicionada a WMS licenciado.
2. Extensão de `Product` com os campos de armazenagem (peso, volume, embalagem, empilhamento, segregação) como pré-requisito da Fase 4 (`StorageRule` já dependia de capacidade — agora depende também desses campos).
3. Nota explícita de que, sem WMS licenciado, `PurchaseReceipt` mantém o fluxo linear atual — a ramificação de processo é condicional, não uma migração forçada.

---

**Elaborado em:** 01/09/2026
**Baseado em:** verificação direta de acoplamento no código (`backend/src/services/`), leitura de `WMS_IMPLEMENTATION_ANALYSIS.md` e conversa que estabeleceu os requisitos de negócio (recebimento e separação orientados a tarefa quando WMS ativo; campos de armazenagem condicionais no produto).
