# Workflow Dinâmico do WMS (Recebimento) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a cadeia de recebimento hardcoded do WMS (`DESCARGA→CONFERENCIA→ETIQUETAGEM→[QUARENTENA]→ALOCACAO`) por um motor de workflow configurável — templates com nós de decisão binária avaliados por um motor de condições livre, editados num canvas visual de arrastar-e-soltar com paleta fixa de operações.

**Architecture:** Três modelos Prisma novos (`WorkflowTemplate`/`WorkflowNode`/`WorkflowEdge`) guardam o grafo; um motor de condições puro (`evaluateRule`) e um resolvedor de grafo (`resolveWorkflowTasks`) substituem a montagem hardcoded em `warehouse-task.service.ts::createReceiptTaskChain`, com fallback automático para a cadeia atual quando nenhum template ativo se aplica. O frontend ganha CRUD de templates (lista + editor em canvas, via `@vue-flow/core`) seguindo o design system existente.

**Tech Stack:** Express + Prisma + Joi + Jest/ts-jest (backend); Vue 3 `<script setup>` + TypeScript + Pinia + Tailwind + `@vue-flow/core` (frontend, dependência nova).

## Global Constraints

- Escopo: só direção `ENTRADA` (Recebimento) tem executor nesta etapa. O campo `direction` existe no modelo para a fase futura de saída/cross-docking, mas não é exposto na UI nem tem lógica de execução própria.
- Motor de condições: árvore JSON com E/OU (`ConditionRule`), campos fechados: `product.weight`, `product.volume`, `product.packagingType`, `product.segregationGroup`, `product.maxStackQty`, `product.lotTracked`, `product.categoryId`, `order.supplierId`. Operadores: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`.
- Palette de tipos de nó fixa: `DESCARGA`, `CONFERENCIA`, `ETIQUETAGEM`, `QUARENTENA`, `SEGREGACAO`, `AMOSTRAGEM`, `ALOCACAO`, `DECISAO` (só os 7 primeiros viram `WarehouseTask` real — `DECISAO` é controle de fluxo).
- Todo caminho do grafo termina obrigatoriamente em `ALOCACAO`; `ALOCACAO` nunca tem saída; todo nó `DECISAO` tem exatamente 2 saídas (`SIM`/`NAO`) e uma `conditionRule`; sem ciclos; sem nós órfãos.
- Zero-config preserva 100% do comportamento atual: sem template ativo que bata com o recebimento, `createReceiptTaskChain` usa exatamente a lógica hoje existente (`RECEIPT_TASK_CHAIN` + `resolveQuarantineRequirement`), inalterada.
- RBAC: reaproveita o recurso `estruturas_armazem` (mesmo precedente de `StorageRule` — "quem desenha a estrutura física é quem desenha o fluxo"), sem seed novo. Rotas montadas sob `requireModule('WMS')`.
- IDs de modelo novo: `@id @default(uuid())`, mesma convenção do resto do schema (43 dos 43 modelos existentes usam `uuid()`, nenhum usa `cuid()`).
- Frontend: `AppLayout`/`DataTable`/`FormField`/`AppModal`/`StatusBadge` para toda tela que não seja o canvas; o canvas usa `@vue-flow/core` com nós customizados estilizados nas cores/tipografia Tailwind do projeto (sem o tema visual default da lib).

---

## Task 1: Schema Prisma — enums e modelos do motor de workflow

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Migration: gerada por `prisma migrate dev` (não escrita à mão)

**Interfaces:**
- Produces: enums `WorkflowDirection`, `WorkflowNodeType`, `WorkflowEdgeBranch` e modelos `WorkflowTemplate`/`WorkflowNode`/`WorkflowEdge` do `@prisma/client` — toda task seguinte importa destes tipos gerados.

- [ ] **Step 1: Estender `WarehouseTaskType` com os dois tipos novos**

Em `backend/prisma/schema.prisma:1573-1581`, o enum hoje é:

```prisma
enum WarehouseTaskType {
  DESCARGA
  CONFERENCIA
  ETIQUETAGEM
  QUARENTENA
  ALOCACAO
  PICKING
  REPLENISHMENT
}
```

Trocar para:

```prisma
enum WarehouseTaskType {
  DESCARGA
  CONFERENCIA
  ETIQUETAGEM
  QUARENTENA
  SEGREGACAO
  AMOSTRAGEM
  ALOCACAO
  PICKING
  REPLENISHMENT
}
```

Nenhum `switch` no backend itera `WarehouseTaskType` de forma não-exaustiva (verificado: o único `switch (type)` do projeto, em `stock.service.ts:174`, é sobre um enum de `StockMovement`, não este) — adicionar os dois valores não quebra nada existente.

- [ ] **Step 2: Adicionar os três enums novos e os três modelos novos**

Inserir logo após o bloco do `WarehouseTaskType` (depois da linha 1581, antes do comentário de `WarehouseTaskStatus`):

```prisma
// F-WORKFLOW — direção do fluxo. Só ENTRADA (Recebimento) tem executor nesta
// fase; SAIDA existe no modelo para permitir que cross-docking seja plugado
// depois sem migração nem redesenho de WorkflowTemplate/Node/Edge.
enum WorkflowDirection {
  ENTRADA
  SAIDA
}

// F-WORKFLOW — paleta FIXA de operações do canvas visual. DECISAO é o único
// valor que não vira WarehouseTask real (é controle de fluxo puro, resolvido
// em tempo de criação do recebimento — ver workflow-resolver.service.ts). Os
// outros 7 espelham WarehouseTaskType de propósito (mesmos nomes): um nó
// DESCARGA no grafo produz uma WarehouseTask DESCARGA de verdade.
enum WorkflowNodeType {
  DESCARGA
  CONFERENCIA
  ETIQUETAGEM
  QUARENTENA
  SEGREGACAO
  AMOSTRAGEM
  ALOCACAO
  DECISAO
}

// F-WORKFLOW — qual das duas saídas de um nó DECISAO uma aresta representa.
enum WorkflowEdgeBranch {
  SIM
  NAO
}

// F-WORKFLOW — um fluxo configurável pelo admin (spec:
// docs/superpowers/specs/2026-09-04-workflow-dinamico-wms-design.md).
// `entryNodeId` é opcional no schema (não pode ser NOT NULL apontando pra uma
// tabela filha que só existe DEPOIS do template criado — problema clássico de
// referência circular na criação) mas é OBRIGATÓRIO por regra de negócio: o
// service de CRUD (workflow-template.service.ts) nunca deixa um template
// persistido sem entryNodeId válido.
model WorkflowTemplate {
  id          String            @id @default(uuid())
  name        String
  description String?
  direction   WorkflowDirection @default(ENTRADA)
  active      Boolean           @default(true)
  // Maior prioridade vence quando mais de um template tem triggerRule
  // batendo com o mesmo recebimento — ver pickTemplate() em
  // workflow-resolver.service.ts.
  priority    Int               @default(0)
  // ConditionRule (workflow-condition.service.ts) serializado. NULL = este
  // template nunca é selecionado automaticamente (precisa de condição
  // explícita — não existe "template catch-all" implícito).
  triggerRule Json?
  entryNodeId String?

  nodes WorkflowNode[]
  edges WorkflowEdge[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // "Quais templates de ENTRADA ativos, do maior pro menor priority" — a
  // consulta de pickTemplate().
  @@index([direction, active, priority])
  @@map("workflow_templates")
}

model WorkflowNode {
  id         String           @id @default(uuid())
  templateId String
  type       WorkflowNodeType
  label      String?
  // ConditionRule serializado — só usado quando type = DECISAO.
  conditionRule Json?
  // Só layout do canvas (arrastar-e-soltar livre) — não participa da
  // resolução do grafo.
  positionX  Float
  positionY  Float

  // Cascade: apagar o template apaga seus nós/arestas — não faz sentido nó
  // órfão de template nenhum.
  template WorkflowTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@index([templateId])
  @@map("workflow_nodes")
}

model WorkflowEdge {
  id         String              @id @default(uuid())
  templateId String
  fromNodeId String
  toNodeId   String
  // NULL nos nós que não são DECISAO (só uma saída possível); SIM/NAO quando
  // fromNode é DECISAO.
  branch     WorkflowEdgeBranch?

  template WorkflowTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@index([templateId])
  @@index([fromNodeId])
  @@map("workflow_edges")
}
```

- [ ] **Step 3: Subir o banco de teste isolado (se ainda não estiver rodando)**

Run (de `backend/`): `npm run test:db:up`
Expected: container `fabric-mysql-test` up e saudável (porta 3307).

- [ ] **Step 4: Gerar a migration contra o banco de teste**

Run (de `backend/`):
```bash
node ./node_modules/dotenv-cli/cli.js -e .env.test -- npx prisma migrate dev --name add_workflow_engine --skip-seed
```
Expected: prompt de confirmação (se houver) aceito automaticamente pelo modo não-interativo do Prisma quando a migration é apenas aditiva; saída "Your database is now in sync with your schema" e um novo diretório em `backend/prisma/migrations/<timestamp>_add_workflow_engine/` com `migration.sql` contendo `CREATE TABLE` para as 3 tabelas novas e `ALTER TABLE ... MODIFY COLUMN` (ou equivalente MySQL) para o enum de `WarehouseTaskType`.

- [ ] **Step 5: Verificar que o client gerado compila**

Run (de `backend/`): `npx tsc --noEmit`
Expected: mesma contagem de erros pré-existente do baseline (nenhum erro novo — os tipos `WorkflowTemplate`/`WorkflowNode`/`WorkflowEdge`/`WorkflowNodeType`/`WorkflowEdgeBranch`/`WorkflowDirection` já saem exportados de `@prisma/client` só por rodar `migrate dev`, que chama `generate` sozinho).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(backend): adiciona modelo de dados do workflow dinamico do WMS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Motor de condições (`workflow-condition.service.ts`)

**Files:**
- Create: `backend/src/services/workflow-condition.service.ts`
- Test: `backend/tests/services/workflow-condition.service.test.ts`

**Interfaces:**
- Consumes: nada (função pura, sem dependência de banco).
- Produces: `ConditionRule` (tipo), `ConditionField`, `CONDITION_FIELDS`, `ReceivingContext`, `ReceivingItemProduct`, `evaluateRule(rule: ConditionRule, context: ReceivingContext): boolean` — Tasks 3, 4 e 5 importam estes diretamente.

- [ ] **Step 1: Escrever os testes que falham**

Create `backend/tests/services/workflow-condition.service.test.ts`:

```ts
import { evaluateRule, ConditionRule, ReceivingContext } from '../../src/services/workflow-condition.service';

const heavyProduct = {
  weight: 800,
  volume: 2,
  packagingType: 'PALLET',
  segregationGroup: 'QUIMICO',
  maxStackQty: 2,
  lotTracked: true,
  categoryId: 'cat-quimicos',
};

const lightProduct = {
  weight: 5,
  volume: 0.1,
  packagingType: 'CAIXA',
  segregationGroup: null,
  maxStackQty: 20,
  lotTracked: false,
  categoryId: 'cat-geral',
};

function contextWith(...products: (typeof heavyProduct | typeof lightProduct)[]): ReceivingContext {
  return {
    order: { supplierId: 'sup-1' },
    items: products.map((product) => ({ product })),
  };
}

describe('workflow-condition.service — evaluateRule', () => {
  it('avalia um único critério (gt) numérico', () => {
    const rule: ConditionRule = { field: 'product.weight', operator: 'gt', value: 500 };
    expect(evaluateRule(rule, contextWith(heavyProduct))).toBe(true);
    expect(evaluateRule(rule, contextWith(lightProduct))).toBe(false);
  });

  it('avalia eq em campo de texto', () => {
    const rule: ConditionRule = { field: 'product.segregationGroup', operator: 'eq', value: 'QUIMICO' };
    expect(evaluateRule(rule, contextWith(heavyProduct))).toBe(true);
    expect(evaluateRule(rule, contextWith(lightProduct))).toBe(false);
  });

  it('avalia eq em campo booleano', () => {
    const rule: ConditionRule = { field: 'product.lotTracked', operator: 'eq', value: true };
    expect(evaluateRule(rule, contextWith(heavyProduct))).toBe(true);
    expect(evaluateRule(rule, contextWith(lightProduct))).toBe(false);
  });

  it('avalia contains em texto, sem diferenciar maiúsculas/minúsculas', () => {
    const rule: ConditionRule = { field: 'product.packagingType', operator: 'contains', value: 'allet' };
    expect(evaluateRule(rule, contextWith(heavyProduct))).toBe(true);
  });

  it('agrupa com AND — precisa das duas condições', () => {
    const rule: ConditionRule = {
      op: 'AND',
      clauses: [
        { field: 'product.weight', operator: 'gt', value: 500 },
        { field: 'product.categoryId', operator: 'eq', value: 'cat-quimicos' },
      ],
    };
    expect(evaluateRule(rule, contextWith(heavyProduct))).toBe(true);
    expect(evaluateRule(rule, contextWith(lightProduct))).toBe(false);
  });

  it('agrupa com OR — basta uma condição', () => {
    const rule: ConditionRule = {
      op: 'OR',
      clauses: [
        { field: 'product.weight', operator: 'gt', value: 500 },
        { field: 'product.segregationGroup', operator: 'eq', value: 'INEXISTENTE' },
      ],
    };
    expect(evaluateRule(rule, contextWith(heavyProduct))).toBe(true);
    expect(evaluateRule(rule, contextWith(lightProduct))).toBe(false);
  });

  it('suporta grupos aninhados (AND dentro de OR)', () => {
    const rule: ConditionRule = {
      op: 'OR',
      clauses: [
        {
          op: 'AND',
          clauses: [
            { field: 'product.weight', operator: 'gt', value: 500 },
            { field: 'product.lotTracked', operator: 'eq', value: true },
          ],
        },
        { field: 'product.packagingType', operator: 'eq', value: 'CAIXA' },
      ],
    };
    expect(evaluateRule(rule, contextWith(heavyProduct))).toBe(true);
    expect(evaluateRule(rule, contextWith(lightProduct))).toBe(true); // bate pelo segundo clause
  });

  it('avalia condição sobre o pedido (order.supplierId), não só o produto', () => {
    const rule: ConditionRule = { field: 'order.supplierId', operator: 'eq', value: 'sup-1' };
    expect(evaluateRule(rule, contextWith(lightProduct))).toBe(true);
    expect(evaluateRule(rule, { order: { supplierId: 'sup-2' }, items: [{ product: lightProduct }] })).toBe(false);
  });

  it('EXISTENCIAL entre itens: basta UM item do recebimento satisfazer a regra inteira', () => {
    // Recebimento com um item leve e um pesado — a regra (que exige peso E
    // categoria juntos) só pode ser satisfeita pelo item pesado, mas isso já
    // basta para o recebimento inteiro "bater". Este é o comportamento
    // documentado no spec/plano: quantificação existencial por ITEM, não por
    // campo isolado (um item leve de categoria "cat-quimicos" não deveria
    // "emprestar" sua categoria para o peso de outro item).
    const rule: ConditionRule = {
      op: 'AND',
      clauses: [
        { field: 'product.weight', operator: 'gt', value: 500 },
        { field: 'product.categoryId', operator: 'eq', value: 'cat-quimicos' },
      ],
    };
    expect(evaluateRule(rule, contextWith(lightProduct, heavyProduct))).toBe(true);
  });

  it('NÃO mistura campos de itens diferentes: dois itens que juntos "completariam" a regra, mas nenhum sozinho, não batem', () => {
    const partialA = { ...lightProduct, weight: 900, categoryId: 'cat-geral' }; // peso bate, categoria não
    const partialB = { ...lightProduct, weight: 5, categoryId: 'cat-quimicos' }; // categoria bate, peso não
    const rule: ConditionRule = {
      op: 'AND',
      clauses: [
        { field: 'product.weight', operator: 'gt', value: 500 },
        { field: 'product.categoryId', operator: 'eq', value: 'cat-quimicos' },
      ],
    };
    expect(evaluateRule(rule, contextWith(partialA, partialB))).toBe(false);
  });

  it('campo nulo no produto nunca satisfaz a condição', () => {
    const rule: ConditionRule = { field: 'product.segregationGroup', operator: 'eq', value: 'QUIMICO' };
    expect(evaluateRule(rule, contextWith(lightProduct))).toBe(false);
  });

  it('recebimento sem itens nunca bate com nenhuma regra', () => {
    const rule: ConditionRule = { field: 'product.weight', operator: 'gt', value: 0 };
    expect(evaluateRule(rule, { order: { supplierId: 'sup-1' }, items: [] })).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx jest tests/services/workflow-condition.service.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/workflow-condition.service'`

- [ ] **Step 3: Implementar**

Create `backend/src/services/workflow-condition.service.ts`:

```ts
/**
 * F-WORKFLOW — motor de condições livre do workflow dinâmico do WMS. Função
 * pura (sem banco, sem I/O): recebe uma árvore de condição e o contexto de um
 * recebimento, devolve true/false. Usado em dois lugares —
 * `WorkflowTemplate.triggerRule` (workflow-resolver.service.ts::pickTemplate)
 * e `WorkflowNode.conditionRule` de um nó DECISAO
 * (workflow-resolver.service.ts::resolveWorkflowTasks) — mesma árvore, mesmo
 * avaliador.
 *
 * QUANTIFICAÇÃO SOBRE OS ITENS DO RECEBIMENTO: um recebimento tem N itens
 * (produtos), cada um com seus próprios atributos. `evaluateRule` avalia a
 * árvore INTEIRA contra CADA item e retorna true se PELO MENOS UM item
 * satisfaz a árvore completa (existencial por item, não por campo isolado) —
 * ver os testes "NÃO mistura campos de itens diferentes". Isso replica o
 * mesmo critério conservador que `resolveQuarantineRequirement()`
 * (storage-rule.service.ts) já usa hoje: "se qualquer item do recebimento
 * pede X, o recebimento inteiro trata como X".
 */

export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains';

export const CONDITION_FIELDS = [
  'product.weight',
  'product.volume',
  'product.packagingType',
  'product.segregationGroup',
  'product.maxStackQty',
  'product.lotTracked',
  'product.categoryId',
  'order.supplierId',
] as const;

export type ConditionField = (typeof CONDITION_FIELDS)[number];

export interface ConditionLeaf {
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface ConditionGroup {
  op: 'AND' | 'OR';
  clauses: ConditionRule[];
}

export type ConditionRule = ConditionLeaf | ConditionGroup;

export interface ReceivingItemProduct {
  weight: number | null;
  volume: number | null;
  packagingType: string | null;
  segregationGroup: string | null;
  maxStackQty: number | null;
  lotTracked: boolean;
  categoryId: string | null;
}

export interface ReceivingOrderContext {
  supplierId: string;
}

export interface ReceivingContext {
  order: ReceivingOrderContext;
  items: { product: ReceivingItemProduct }[];
}

function isConditionGroup(rule: ConditionRule): rule is ConditionGroup {
  return 'op' in rule;
}

function resolveFieldValue(
  field: ConditionField,
  product: ReceivingItemProduct,
  order: ReceivingOrderContext
): string | number | boolean | null {
  switch (field) {
    case 'product.weight':
      return product.weight;
    case 'product.volume':
      return product.volume;
    case 'product.packagingType':
      return product.packagingType;
    case 'product.segregationGroup':
      return product.segregationGroup;
    case 'product.maxStackQty':
      return product.maxStackQty;
    case 'product.lotTracked':
      return product.lotTracked;
    case 'product.categoryId':
      return product.categoryId;
    case 'order.supplierId':
      return order.supplierId;
  }
}

function evaluateLeaf(
  leaf: ConditionLeaf,
  product: ReceivingItemProduct,
  order: ReceivingOrderContext
): boolean {
  const actual = resolveFieldValue(leaf.field, product, order);
  if (actual === null || actual === undefined) {
    return false;
  }

  switch (leaf.operator) {
    case 'eq':
      return actual === leaf.value;
    case 'ne':
      return actual !== leaf.value;
    case 'gt':
      return typeof actual === 'number' && typeof leaf.value === 'number' && actual > leaf.value;
    case 'gte':
      return typeof actual === 'number' && typeof leaf.value === 'number' && actual >= leaf.value;
    case 'lt':
      return typeof actual === 'number' && typeof leaf.value === 'number' && actual < leaf.value;
    case 'lte':
      return typeof actual === 'number' && typeof leaf.value === 'number' && actual <= leaf.value;
    case 'contains':
      return (
        typeof actual === 'string' &&
        typeof leaf.value === 'string' &&
        actual.toLowerCase().includes(leaf.value.toLowerCase())
      );
  }
}

function evaluateForItem(
  rule: ConditionRule,
  product: ReceivingItemProduct,
  order: ReceivingOrderContext
): boolean {
  if (isConditionGroup(rule)) {
    return rule.op === 'AND'
      ? rule.clauses.every((clause) => evaluateForItem(clause, product, order))
      : rule.clauses.some((clause) => evaluateForItem(clause, product, order));
  }
  return evaluateLeaf(rule, product, order);
}

export function evaluateRule(rule: ConditionRule, context: ReceivingContext): boolean {
  return context.items.some((item) => evaluateForItem(rule, item.product, context.order));
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx jest tests/services/workflow-condition.service.test.ts`
Expected: PASS — 12/12 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflow-condition.service.ts backend/tests/services/workflow-condition.service.test.ts
git commit -m "feat(backend): adiciona motor de condicoes do workflow dinamico

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Validação do grafo (`workflow-graph.service.ts`)

**Files:**
- Create: `backend/src/services/workflow-graph.service.ts`
- Test: `backend/tests/services/workflow-graph.service.test.ts`

**Interfaces:**
- Consumes: `ConditionRule` de `workflow-condition.service.ts` (Task 2).
- Produces: `GraphNodeInput`, `GraphEdgeInput`, `validateWorkflowGraph(nodes: GraphNodeInput[], edges: GraphEdgeInput[], entryNodeId: string): string[]` (lista de erros; vazio = grafo válido) — Task 6 (CRUD) chama isto ao criar/editar um template.

- [ ] **Step 1: Escrever os testes que falham**

Create `backend/tests/services/workflow-graph.service.test.ts`:

```ts
import { validateWorkflowGraph, GraphNodeInput, GraphEdgeInput } from '../../src/services/workflow-graph.service';

// Grafo válido de referência: Descarga -> Conferencia -> Decisao -> (SIM) Quarentena -> Alocacao
//                                                              -> (NAO) Alocacao
function validGraph(): { nodes: GraphNodeInput[]; edges: GraphEdgeInput[]; entryNodeId: string } {
  const nodes: GraphNodeInput[] = [
    { id: 'n1', type: 'DESCARGA', conditionRule: null },
    { id: 'n2', type: 'CONFERENCIA', conditionRule: null },
    { id: 'n3', type: 'DECISAO', conditionRule: { field: 'product.weight', operator: 'gt', value: 500 } },
    { id: 'n4', type: 'QUARENTENA', conditionRule: null },
    { id: 'n5', type: 'ALOCACAO', conditionRule: null },
  ];
  const edges: GraphEdgeInput[] = [
    { fromNodeId: 'n1', toNodeId: 'n2', branch: null },
    { fromNodeId: 'n2', toNodeId: 'n3', branch: null },
    { fromNodeId: 'n3', toNodeId: 'n4', branch: 'SIM' },
    { fromNodeId: 'n3', toNodeId: 'n5', branch: 'NAO' },
    { fromNodeId: 'n4', toNodeId: 'n5', branch: null },
  ];
  return { nodes, edges, entryNodeId: 'n1' };
}

describe('workflow-graph.service — validateWorkflowGraph', () => {
  it('aceita o grafo de referência sem erros', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    expect(validateWorkflowGraph(nodes, edges, entryNodeId)).toEqual([]);
  });

  it('aceita o caso trivial: entrada já é Alocação, sem mais nada', () => {
    const nodes: GraphNodeInput[] = [{ id: 'n1', type: 'ALOCACAO', conditionRule: null }];
    expect(validateWorkflowGraph(nodes, [], 'n1')).toEqual([]);
  });

  it('rejeita entryNodeId que não existe no grafo', () => {
    const { nodes, edges } = validGraph();
    const errors = validateWorkflowGraph(nodes, edges, 'nao-existe');
    expect(errors).toContain('Nó de entrada não existe no fluxo.');
  });

  it('rejeita nó de entrada com conexão chegando nele', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    edges.push({ fromNodeId: 'n5', toNodeId: 'n1', branch: null });
    const errors = validateWorkflowGraph(nodes, edges, entryNodeId);
    expect(errors).toContain('O nó de entrada não pode ter conexões chegando nele.');
  });

  it('rejeita nó DECISAO sem conditionRule', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    nodes[2].conditionRule = null;
    const errors = validateWorkflowGraph(nodes, edges, entryNodeId);
    expect(errors.some((e) => e.includes('precisa de uma condição'))).toBe(true);
  });

  it('rejeita nó DECISAO com só uma saída', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    const withoutNao = edges.filter((e) => !(e.fromNodeId === 'n3' && e.branch === 'NAO'));
    const errors = validateWorkflowGraph(nodes, withoutNao, entryNodeId);
    expect(errors.some((e) => e.includes('exatamente duas saídas'))).toBe(true);
  });

  it('rejeita nó DECISAO com duas saídas do mesmo branch (SIM duplicado)', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    const withoutNao = edges.filter((e) => !(e.fromNodeId === 'n3' && e.branch === 'NAO'));
    withoutNao.push({ fromNodeId: 'n3', toNodeId: 'n5', branch: 'SIM' });
    const errors = validateWorkflowGraph(nodes, withoutNao, entryNodeId);
    expect(errors.some((e) => e.includes('exatamente duas saídas'))).toBe(true);
  });

  it('rejeita nó comum (não-DECISAO, não-ALOCACAO) com mais de uma saída', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    edges.push({ fromNodeId: 'n1', toNodeId: 'n4', branch: null });
    const errors = validateWorkflowGraph(nodes, edges, entryNodeId);
    expect(errors.some((e) => e.includes('só pode ter uma saída'))).toBe(true);
  });

  it('rejeita ALOCACAO com saída', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    edges.push({ fromNodeId: 'n5', toNodeId: 'n1', branch: null }); // também dispara o erro de entrada, ok
    const withoutBackToEntry = edges.filter((e) => e.fromNodeId !== 'n5' || e.toNodeId !== 'n1');
    withoutBackToEntry.push({ fromNodeId: 'n5', toNodeId: 'n4', branch: null });
    const errors = validateWorkflowGraph(nodes, withoutBackToEntry, entryNodeId);
    expect(errors.some((e) => e.includes('nó de Alocação não pode ter conexões saindo'))).toBe(true);
  });

  it('rejeita ciclo', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    const withCycle = edges.filter((e) => !(e.fromNodeId === 'n4' && e.toNodeId === 'n5'));
    withCycle.push({ fromNodeId: 'n4', toNodeId: 'n2', branch: null }); // n2 -> n3 -> n4 -> n2
    const errors = validateWorkflowGraph(nodes, withCycle, entryNodeId);
    expect(errors.some((e) => e.includes('ciclo'))).toBe(true);
  });

  it('rejeita nó órfão (não alcançável a partir da entrada)', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    nodes.push({ id: 'n6', type: 'SEGREGACAO', conditionRule: null });
    const errors = validateWorkflowGraph(nodes, edges, entryNodeId);
    expect(errors.some((e) => e.includes('não são alcançáveis'))).toBe(true);
  });

  it('rejeita caminho que termina num tipo diferente de ALOCACAO', () => {
    const nodes: GraphNodeInput[] = [
      { id: 'n1', type: 'DESCARGA', conditionRule: null },
      { id: 'n2', type: 'CONFERENCIA', conditionRule: null },
    ];
    const edges: GraphEdgeInput[] = [{ fromNodeId: 'n1', toNodeId: 'n2', branch: null }];
    const errors = validateWorkflowGraph(nodes, edges, 'n1');
    expect(errors.some((e) => e.includes('terminar em Alocação'))).toBe(true);
  });

  it('rejeita conexão apontando para nó inexistente', () => {
    const { nodes, edges, entryNodeId } = validGraph();
    edges.push({ fromNodeId: 'n5', toNodeId: 'nao-existe', branch: null });
    const withoutAlocSaida = edges.filter((e) => e.toNodeId !== 'nao-existe');
    withoutAlocSaida.push({ fromNodeId: 'n2', toNodeId: 'nao-existe', branch: null });
    const errors = validateWorkflowGraph(nodes, withoutAlocSaida, entryNodeId);
    expect(errors.some((e) => e.includes('nó inexistente'))).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx jest tests/services/workflow-graph.service.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/workflow-graph.service'`

- [ ] **Step 3: Implementar**

Create `backend/src/services/workflow-graph.service.ts`:

```ts
import { WorkflowNodeType } from '@prisma/client';
import { ConditionRule } from './workflow-condition.service';

/**
 * F-WORKFLOW — validação estrutural do grafo de um WorkflowTemplate. Roda no
 * BACKEND ao salvar (workflow-template.service.ts), não só na UI — o editor
 * visual roda a mesma checagem no cliente como feedback imediato, mas quem
 * decide o que persiste é sempre esta função (mesmo padrão de validação
 * dupla, cliente + servidor, já usado no resto do sistema).
 *
 * Aceita ids GENÉRICOS (string) de propósito: funciona tanto contra o grafo
 * já persistido (uuids reais) quanto contra o payload de criação, onde o
 * frontend ainda não tem uuid nenhum e usa ids temporários (clientId) — ver
 * workflow-template.service.ts.
 */

export interface GraphNodeInput {
  id: string;
  type: WorkflowNodeType;
  conditionRule: ConditionRule | null;
}

export interface GraphEdgeInput {
  fromNodeId: string;
  toNodeId: string;
  branch: 'SIM' | 'NAO' | null;
}

export function validateWorkflowGraph(
  nodes: GraphNodeInput[],
  edges: GraphEdgeInput[],
  entryNodeId: string
): string[] {
  const errors: string[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  if (!nodeById.has(entryNodeId)) {
    errors.push('Nó de entrada não existe no fluxo.');
    return errors; // sem entrada válida, o resto da checagem não tem base
  }

  const incomingCount = new Map<string, number>();
  const outgoingByNode = new Map<string, GraphEdgeInput[]>();
  for (const node of nodes) outgoingByNode.set(node.id, []);

  for (const edge of edges) {
    if (!nodeById.has(edge.fromNodeId) || !nodeById.has(edge.toNodeId)) {
      errors.push('Existe uma conexão apontando para um nó inexistente.');
      continue;
    }
    incomingCount.set(edge.toNodeId, (incomingCount.get(edge.toNodeId) ?? 0) + 1);
    outgoingByNode.get(edge.fromNodeId)!.push(edge);
  }

  if ((incomingCount.get(entryNodeId) ?? 0) > 0) {
    errors.push('O nó de entrada não pode ter conexões chegando nele.');
  }

  for (const node of nodes) {
    const outgoing = outgoingByNode.get(node.id) ?? [];

    if (node.type === 'DECISAO') {
      if (!node.conditionRule) {
        errors.push(`Nó de decisão "${node.id}" precisa de uma condição configurada.`);
      }
      const branches = new Set(outgoing.map((e) => e.branch));
      if (outgoing.length !== 2 || !branches.has('SIM') || !branches.has('NAO')) {
        errors.push(`Nó de decisão "${node.id}" precisa de exatamente duas saídas (SIM e NAO).`);
      }
    } else if (node.type === 'ALOCACAO') {
      if (outgoing.length !== 0) {
        errors.push('O nó de Alocação não pode ter conexões saindo dele — é sempre o último passo.');
      }
    } else if (outgoing.length > 1) {
      errors.push(`Nó "${node.id}" (${node.type}) só pode ter uma saída.`);
    }
  }

  // Alcançabilidade + ciclo, via DFS a partir da entrada.
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const terminalTypesFound = new Set<WorkflowNodeType>();
  let hasCycle = false;

  function visit(nodeId: string): void {
    if (inStack.has(nodeId)) {
      hasCycle = true;
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    inStack.add(nodeId);

    const node = nodeById.get(nodeId)!;
    const outgoing = (outgoingByNode.get(nodeId) ?? []).filter((e) => nodeById.has(e.toNodeId));
    if (outgoing.length === 0) {
      terminalTypesFound.add(node.type);
    }
    for (const edge of outgoing) {
      visit(edge.toNodeId);
    }
    inStack.delete(nodeId);
  }
  visit(entryNodeId);

  if (hasCycle) {
    errors.push('O fluxo tem um ciclo — uma sequência de conexões que volta a um nó já visitado.');
  }

  const orphanNodes = nodes.filter((n) => n.id !== entryNodeId && !visited.has(n.id));
  if (orphanNodes.length > 0) {
    errors.push('Existem nós no canvas que não são alcançáveis a partir da entrada.');
  }

  if (!hasCycle) {
    if (terminalTypesFound.size === 0) {
      errors.push('O fluxo não alcança nenhum nó terminal — verifique se há um caminho até Alocação.');
    } else if ([...terminalTypesFound].some((type) => type !== 'ALOCACAO')) {
      errors.push('Todo caminho do fluxo precisa terminar em Alocação.');
    }
  }

  return errors;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx jest tests/services/workflow-graph.service.test.ts`
Expected: PASS — 13/13 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflow-graph.service.ts backend/tests/services/workflow-graph.service.test.ts
git commit -m "feat(backend): adiciona validacao estrutural do grafo de workflow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Resolvedor de workflow (`workflow-resolver.service.ts`)

**Files:**
- Create: `backend/src/services/workflow-resolver.service.ts`
- Test: `backend/tests/services/workflow-resolver.service.test.ts`

**Interfaces:**
- Consumes: `ConditionRule`, `evaluateRule`, `ReceivingContext` de `workflow-condition.service.ts` (Task 2).
- Produces: `ResolvableTemplate`, `ResolvedTemplateNode`, `ResolvedTemplateEdge`, `pickTemplate(templates: ResolvableTemplate[], context: ReceivingContext): ResolvableTemplate | null`, `resolveWorkflowTasks(template: ResolvableTemplate, context: ReceivingContext): WorkflowNodeType[]` — Task 5 (integração) importa estas duas funções diretamente.

- [ ] **Step 1: Escrever os testes que falham**

Create `backend/tests/services/workflow-resolver.service.test.ts`:

```ts
import {
  pickTemplate,
  resolveWorkflowTasks,
  ResolvableTemplate,
} from '../../src/services/workflow-resolver.service';
import { ReceivingContext } from '../../src/services/workflow-condition.service';

const heavyContext: ReceivingContext = {
  order: { supplierId: 'sup-1' },
  items: [{ product: { weight: 800, volume: null, packagingType: null, segregationGroup: null, maxStackQty: null, lotTracked: false, categoryId: null } }],
};

const lightContext: ReceivingContext = {
  order: { supplierId: 'sup-1' },
  items: [{ product: { weight: 5, volume: null, packagingType: null, segregationGroup: null, maxStackQty: null, lotTracked: false, categoryId: null } }],
};

// Descarga -> Conferencia -> Decisao(peso>500) -[SIM]-> Quarentena -> Alocacao
//                                              -[NAO]-> Alocacao
function branchingTemplate(overrides: Partial<ResolvableTemplate> = {}): ResolvableTemplate {
  return {
    id: 'tpl-1',
    priority: 0,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    triggerRule: null,
    entryNodeId: 'n1',
    nodes: [
      { id: 'n1', type: 'DESCARGA', conditionRule: null },
      { id: 'n2', type: 'CONFERENCIA', conditionRule: null },
      { id: 'n3', type: 'DECISAO', conditionRule: { field: 'product.weight', operator: 'gt', value: 500 } },
      { id: 'n4', type: 'QUARENTENA', conditionRule: null },
      { id: 'n5', type: 'ALOCACAO', conditionRule: null },
    ],
    edges: [
      { fromNodeId: 'n1', toNodeId: 'n2', branch: null },
      { fromNodeId: 'n2', toNodeId: 'n3', branch: null },
      { fromNodeId: 'n3', toNodeId: 'n4', branch: 'SIM' },
      { fromNodeId: 'n3', toNodeId: 'n5', branch: 'NAO' },
      { fromNodeId: 'n4', toNodeId: 'n5', branch: null },
    ],
    ...overrides,
  };
}

describe('workflow-resolver.service — resolveWorkflowTasks', () => {
  it('segue o ramo SIM quando a condição bate', () => {
    const steps = resolveWorkflowTasks(branchingTemplate(), heavyContext);
    expect(steps).toEqual(['DESCARGA', 'CONFERENCIA', 'QUARENTENA', 'ALOCACAO']);
  });

  it('segue o ramo NAO quando a condição não bate', () => {
    const steps = resolveWorkflowTasks(branchingTemplate(), lightContext);
    expect(steps).toEqual(['DESCARGA', 'CONFERENCIA', 'ALOCACAO']);
  });

  it('resolve um template de nó único (entrada = Alocação)', () => {
    const trivial: ResolvableTemplate = {
      id: 'tpl-2',
      priority: 0,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      triggerRule: null,
      entryNodeId: 'only',
      nodes: [{ id: 'only', type: 'ALOCACAO', conditionRule: null }],
      edges: [],
    };
    expect(resolveWorkflowTasks(trivial, lightContext)).toEqual(['ALOCACAO']);
  });

  it('lança AppError se a entrada apontar para um nó que não existe', () => {
    const broken = branchingTemplate({ entryNodeId: 'nao-existe' });
    expect(() => resolveWorkflowTasks(broken, lightContext)).toThrow(/entrada inválida/);
  });

  it('lança AppError se um ciclo em runtime estourar o guard', () => {
    const cyclic = branchingTemplate({
      edges: [
        { fromNodeId: 'n1', toNodeId: 'n2', branch: null },
        { fromNodeId: 'n2', toNodeId: 'n1', branch: null }, // n1 <-> n2, nunca chega em Alocacao
      ],
    });
    expect(() => resolveWorkflowTasks(cyclic, lightContext)).toThrow(/ciclo/);
  });
});

describe('workflow-resolver.service — pickTemplate', () => {
  it('retorna null quando nenhum template tem triggerRule batendo', () => {
    const templates = [branchingTemplate({ triggerRule: { field: 'product.weight', operator: 'gt', value: 99999 } })];
    expect(pickTemplate(templates, heavyContext)).toBeNull();
  });

  it('retorna null quando o template não tem triggerRule (null nunca casa sozinho)', () => {
    const templates = [branchingTemplate({ triggerRule: null })];
    expect(pickTemplate(templates, heavyContext)).toBeNull();
  });

  it('retorna o template cujo triggerRule bate', () => {
    const templates = [branchingTemplate({ id: 'tpl-match', triggerRule: { field: 'product.weight', operator: 'gt', value: 100 } })];
    expect(pickTemplate(templates, heavyContext)?.id).toBe('tpl-match');
  });

  it('entre dois que batem, escolhe o de maior priority', () => {
    const low = branchingTemplate({ id: 'tpl-low', priority: 1, triggerRule: { field: 'product.weight', operator: 'gt', value: 0 } });
    const high = branchingTemplate({ id: 'tpl-high', priority: 5, triggerRule: { field: 'product.weight', operator: 'gt', value: 0 } });
    expect(pickTemplate([low, high], heavyContext)?.id).toBe('tpl-high');
  });

  it('em empate de priority, escolhe o mais recentemente atualizado — independente da ordem do array de entrada', () => {
    const older = branchingTemplate({
      id: 'tpl-older',
      priority: 3,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      triggerRule: { field: 'product.weight', operator: 'gt', value: 0 },
    });
    const newer = branchingTemplate({
      id: 'tpl-newer',
      priority: 3,
      updatedAt: new Date('2026-06-01T00:00:00Z'),
      triggerRule: { field: 'product.weight', operator: 'gt', value: 0 },
    });
    expect(pickTemplate([older, newer], heavyContext)?.id).toBe('tpl-newer');
    expect(pickTemplate([newer, older], heavyContext)?.id).toBe('tpl-newer');
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx jest tests/services/workflow-resolver.service.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/workflow-resolver.service'`

- [ ] **Step 3: Implementar**

Create `backend/src/services/workflow-resolver.service.ts`:

```ts
import { WorkflowNodeType } from '@prisma/client';
import { AppError } from '../middleware/error.middleware';
import { ConditionRule, ReceivingContext, evaluateRule } from './workflow-condition.service';

/**
 * F-WORKFLOW — o resolvedor de grafo. Substitui a montagem hardcoded de
 * `RECEIPT_TASK_CHAIN` (warehouse-task.service.ts) QUANDO existe um
 * WorkflowTemplate ativo cujo triggerRule bate com o recebimento — ver a
 * integração em warehouse-task.service.ts::createReceiptTaskChain (Task 5).
 *
 * `pickTemplate`/`resolveWorkflowTasks` recebem o grafo já carregado do banco
 * (formato simplificado, sem depender do client do Prisma diretamente) —
 * função pura, testável sem banco.
 */

export interface ResolvedTemplateNode {
  id: string;
  type: WorkflowNodeType;
  conditionRule: ConditionRule | null;
}

export interface ResolvedTemplateEdge {
  fromNodeId: string;
  toNodeId: string;
  branch: 'SIM' | 'NAO' | null;
}

export interface ResolvableTemplate {
  id: string;
  priority: number;
  // Desempate quando dois templates ativos têm a MESMA priority e ambos
  // batem com o mesmo recebimento (risco registrado no spec, resolvido
  // aqui): o mais RECENTEMENTE ATUALIZADO vence. Não depende da ordem em que
  // o chamador passou o array — `pickTemplate` é determinístico sozinho.
  updatedAt: Date;
  triggerRule: ConditionRule | null;
  entryNodeId: string;
  nodes: ResolvedTemplateNode[];
  edges: ResolvedTemplateEdge[];
}

/**
 * Maior priority, entre os templates cujo triggerRule bate, vence; empate de
 * priority é resolvido por `updatedAt` mais recente. `null` em `triggerRule`
 * nunca casa sozinho — só um template com condição EXPLÍCITA pode ser
 * selecionado (ver Global Constraints do plano/spec).
 */
export function pickTemplate(
  templates: ResolvableTemplate[],
  context: ReceivingContext
): ResolvableTemplate | null {
  const matching = templates
    .filter((t) => t.triggerRule !== null && evaluateRule(t.triggerRule, context))
    .sort((a, b) => b.priority - a.priority || b.updatedAt.getTime() - a.updatedAt.getTime());

  return matching[0] ?? null;
}

export function resolveWorkflowTasks(
  template: ResolvableTemplate,
  context: ReceivingContext
): WorkflowNodeType[] {
  const nodeById = new Map(template.nodes.map((n) => [n.id, n]));
  const outgoingByNode = new Map<string, ResolvedTemplateEdge[]>();
  for (const node of template.nodes) outgoingByNode.set(node.id, []);
  for (const edge of template.edges) {
    outgoingByNode.get(edge.fromNodeId)?.push(edge);
  }

  let current = nodeById.get(template.entryNodeId);
  if (!current) {
    throw new AppError(500, `Template de workflow "${template.id}" tem entrada inválida.`);
  }

  const steps: WorkflowNodeType[] = [];
  let guard = 0;

  while (true) {
    if (++guard > template.nodes.length + 1) {
      throw new AppError(500, `Template de workflow "${template.id}" tem um ciclo — recebimento bloqueado.`);
    }

    if (current.type === 'DECISAO') {
      if (!current.conditionRule) {
        throw new AppError(500, `Nó de decisão "${current.id}" do template "${template.id}" sem condição configurada.`);
      }
      const branch = evaluateRule(current.conditionRule, context) ? 'SIM' : 'NAO';
      const edge = outgoingByNode.get(current.id)?.find((e) => e.branch === branch);
      if (!edge) {
        throw new AppError(500, `Nó de decisão "${current.id}" do template "${template.id}" sem saída "${branch}".`);
      }
      const next = nodeById.get(edge.toNodeId);
      if (!next) {
        throw new AppError(500, `Template de workflow "${template.id}" tem uma conexão para um nó inexistente.`);
      }
      current = next;
      continue;
    }

    steps.push(current.type);
    if (current.type === 'ALOCACAO') {
      break;
    }

    const edge = outgoingByNode.get(current.id)?.[0];
    if (!edge) {
      throw new AppError(500, `Template de workflow "${template.id}" tem um caminho que não termina em Alocação.`);
    }
    const next = nodeById.get(edge.toNodeId);
    if (!next) {
      throw new AppError(500, `Template de workflow "${template.id}" tem uma conexão para um nó inexistente.`);
    }
    current = next;
  }

  return steps;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx jest tests/services/workflow-resolver.service.test.ts`
Expected: PASS — 10/10 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/workflow-resolver.service.ts backend/tests/services/workflow-resolver.service.test.ts
git commit -m "feat(backend): adiciona resolvedor de grafo do workflow dinamico

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: Integrar o resolvedor em `createReceiptTaskChain`

**Files:**
- Modify: `backend/src/services/warehouse-task.service.ts:222-250`
- Modify: `backend/tests/integration/wms-receipt-tasks.test.ts` (arquivo real já existente — é aqui, via `POST /api/v1/purchase-receipts` com WMS licenciado, que a cadeia hoje é testada ponta a ponta; `createReceiptTaskChain` não tem teste unitário próprio hoje, então a integração é o ponto de verificação certo, não um arquivo novo)

**Interfaces:**
- Consumes: `toWarehouseTaskType` (novo helper local), `pickTemplate`/`resolveWorkflowTasks`/`ResolvableTemplate` de `workflow-resolver.service.ts` (Task 4), `ReceivingContext` de `workflow-condition.service.ts` (Task 2).
- Produces: nenhuma interface nova — `createReceiptTaskChain` mantém a mesma assinatura pública (`(tx, receiptId) => Promise<void>`), só a implementação interna muda.

- [ ] **Step 1: Ler o teste existente para confirmar o baseline**

Run: `npm run test:integration -- tests/integration/wms-receipt-tasks.test.ts`
Expected: PASS — todos os testes já existentes neste arquivo passam (baseline antes de qualquer mudança). O teste `'cria a cadeia de 5 tarefas...'` (dentro de `describe('com WMS licenciado', ...)`) é o que verifica a cadeia `DESCARGA→CONFERENCIA→ETIQUETAGEM→QUARENTENA→ALOCACAO` hoje — ele CONTINUA passando sem alteração depois desta task (nenhum `WorkflowTemplate` existe no banco de teste, então o fallback preserva o comportamento).

- [ ] **Step 2: Escrever os testes novos (ainda falham — a integração não existe)**

Adicionar, dentro do `describe('com WMS licenciado', ...)` já existente em `backend/tests/integration/wms-receipt-tasks.test.ts` (reaproveitando `loginReceiptUser()`/`createReceipt()`/`RECEIPT_PERMISSIONS` já definidos no topo do arquivo — ver Task 5, Step 1 acima para o que já existe lá), um `describe` novo logo depois do teste `'cria a cadeia de 5 tarefas...'`:

```ts
describe('com um WorkflowTemplate ativo (F-WORKFLOW)', () => {
  it('ignora templates inativos ou cujo triggerRule não bate, e cai na cadeia padrão', async () => {
    const { user, token } = await loginReceiptUser();

    // `createReceipt()` (helper já existente neste arquivo) cria o produto
    // via `createTestProduct()` SEM overrides — `weight` fica `null`. Nenhum
    // dos três templates abaixo bate: `inactive` está desligado; `noMatch`
    // exige weight > 99999; `wouldMatchIfHeavy` exige weight > 500, mas um
    // campo `null` nunca satisfaz condição nenhuma (workflow-condition.
    // service.ts::evaluateLeaf). Resultado esperado: cai no fallback —
    // a cadeia padrão de 5 tarefas, idêntica ao teste do baseline (Step 1).
    const inactive = await testPrisma.workflowTemplate.create({
      data: { name: 'Inativo', active: false, priority: 10, triggerRule: { field: 'product.weight', operator: 'gt', value: 0 } },
    });
    const noMatch = await testPrisma.workflowTemplate.create({
      data: { name: 'Não bate', active: true, priority: 10, triggerRule: { field: 'product.weight', operator: 'gt', value: 99999 } },
    });
    const wouldMatchIfHeavy = await testPrisma.workflowTemplate.create({
      data: { name: 'Só bate se pesado', active: true, priority: 5, triggerRule: { field: 'product.weight', operator: 'gt', value: 500 } },
    });

    const { res } = await createReceipt(token, user.id, 100);
    expect(res.status).toBe(201);

    const tasks = await testPrisma.warehouseTask.findMany({
      where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
      orderBy: { sequence: 'asc' },
    });
    expect(tasks.map((t) => t.type)).toEqual(['DESCARGA', 'CONFERENCIA', 'ETIQUETAGEM', 'QUARENTENA', 'ALOCACAO']);

    await testPrisma.workflowTemplate.deleteMany({ where: { id: { in: [inactive.id, noMatch.id, wouldMatchIfHeavy.id] } } });
  });

  it('gera a cadeia definida pelo template (sem Quarentena) quando o produto bate com o triggerRule', async () => {
    const { user, token } = await loginReceiptUser();

    const matching = await testPrisma.workflowTemplate.create({
      data: { name: 'Sem quarentena para produto pesado', active: true, priority: 1, triggerRule: { field: 'product.weight', operator: 'gt', value: 500 } },
    });
    const n1 = await testPrisma.workflowNode.create({ data: { templateId: matching.id, type: 'DESCARGA', positionX: 0, positionY: 0 } });
    const n2 = await testPrisma.workflowNode.create({ data: { templateId: matching.id, type: 'ALOCACAO', positionX: 0, positionY: 0 } });
    await testPrisma.workflowEdge.create({ data: { templateId: matching.id, fromNodeId: n1.id, toNodeId: n2.id } });
    await testPrisma.workflowTemplate.update({ where: { id: matching.id }, data: { entryNodeId: n1.id } });

    const product = await createTestProduct({ weight: 900 });
    const { order } = await createTestPurchaseOrder(user.id, [{ productId: product.id, quantity: 100, unitPrice: 10 }]);

    const res = await request(app)
      .post('/api/v1/purchase-receipts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        purchaseOrderId: order.id,
        receiptDate: new Date().toISOString(),
        items: [{ orderItemId: order.items[0].id, productId: product.id, quantityReceived: 100 }],
      });
    expect(res.status).toBe(201);

    const tasks = await testPrisma.warehouseTask.findMany({
      where: { reference: res.body.data.id, referenceType: 'PURCHASE_RECEIPT' },
      orderBy: { sequence: 'asc' },
    });
    expect(tasks.map((t) => t.type)).toEqual(['DESCARGA', 'ALOCACAO']);

    await testPrisma.workflowTemplate.delete({ where: { id: matching.id } });
  });
});
```

`createTestProduct` já é importado no topo do arquivo (`../helpers/fixtures`) — confirmar que segue assim; se a task anterior não tiver deixado o import, adicioná-lo junto aos demais nomes já importados de `'../helpers/fixtures'`.

- [ ] **Step 3: Rodar os testes novos e confirmar o resultado esperado**

Run: `npm run test:integration -- tests/integration/wms-receipt-tasks.test.ts`
Expected: o teste do baseline (Step 1) continua passando. Dos dois testes novos do Step 2: o segundo (`'gera a cadeia definida pelo template...'`) deve FALHAR, porque a cadeia gerada ainda é a de 5 passos, não `['DESCARGA', 'ALOCACAO']` — `createReceiptTaskChain` ainda não consulta `WorkflowTemplate`. O primeiro (`'ignora templates inativos ou cujo triggerRule não bate...'`) já deve PASSAR mesmo antes da Step 4 — e isso não é um sinal de teste quebrado: o código ANTIGO nem olha para `WorkflowTemplate`, então ele produz a cadeia padrão pelo motivo errado (ignorância, não avaliação correta da regra). É só depois da Step 4 que esse teste passa a validar o que seu nome promete — mantenha-o, ele deixa de ser "vácuo" assim que o código novo existe.

- [ ] **Step 4: Implementar a integração**

Em `backend/src/services/warehouse-task.service.ts`, adicionar o import no topo do arquivo (junto aos imports existentes):

```ts
import { pickTemplate, resolveWorkflowTasks, ResolvableTemplate } from './workflow-resolver.service';
import { ConditionRule, ReceivingContext } from './workflow-condition.service';
```

Adicionar, logo ANTES da declaração de `createReceiptTaskChain` (linha ~222):

```ts
/**
 * F-WORKFLOW — WorkflowNodeType e WarehouseTaskType compartilham os mesmos 7
 * nomes de operação de propósito (ver o comentário do enum em schema.prisma).
 * `resolveWorkflowTasks` nunca devolve DECISAO no array de steps (é consumido
 * internamente pelo loop, nunca empurrado pro resultado) — o `throw` aqui é
 * só a rede de segurança de tipo, não um caminho alcançável em uso normal.
 */
function toWarehouseTaskType(type: WorkflowNodeType): WarehouseTaskType {
  if (type === 'DECISAO') {
    throw new AppError(500, 'Nó de decisão não pode virar tarefa de armazém — erro interno do resolvedor.');
  }
  return type as unknown as WarehouseTaskType;
}
```

Trocar o corpo de `createReceiptTaskChain` (linhas ~222-250) de:

```ts
export const createReceiptTaskChain = async (
  tx: TransactionClient,
  receiptId: string
): Promise<void> => {
  const items = await tx.purchaseReceiptItem.findMany({
    where: { receiptId },
    select: { productId: true },
  });

  const needsQuarantine = await resolveQuarantineRequirement(
    tx,
    items.map((item) => item.productId)
  );

  const chain = RECEIPT_TASK_CHAIN.filter(
    (type) => type !== WarehouseTaskType.QUARENTENA || needsQuarantine
  );

  await tx.warehouseTask.createMany({
    data: chain.map((type, index) => ({
      type,
      status: WarehouseTaskStatus.PENDING,
      reference: receiptId,
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      sequence: index + 1,
      priority: 0,
    })),
  });
};
```

para:

```ts
export const createReceiptTaskChain = async (
  tx: TransactionClient,
  receiptId: string
): Promise<void> => {
  const items = await tx.purchaseReceiptItem.findMany({
    where: { receiptId },
    select: {
      productId: true,
      product: {
        select: {
          weight: true,
          volume: true,
          packagingType: true,
          segregationGroup: true,
          maxStackQty: true,
          lotTracked: true,
          categoryId: true,
        },
      },
    },
  });

  const receipt = await tx.purchaseReceipt.findUniqueOrThrow({
    where: { id: receiptId },
    select: { order: { select: { supplierId: true } } },
  });

  // F-WORKFLOW — o contexto que o motor de condições avalia. Lido na MESMA
  // transação que criou os itens (mesmo motivo do resto desta função:
  // `purchase-receipt.service.ts::create()` acabou de criá-los, ainda não
  // visíveis fora da transação).
  const context: ReceivingContext = {
    order: { supplierId: receipt.order.supplierId },
    items: items.map((item) => ({ product: item.product })),
  };

  const templateRows = await tx.workflowTemplate.findMany({
    where: { active: true, direction: 'ENTRADA' },
    include: { nodes: true, edges: true },
  });

  const templates: ResolvableTemplate[] = templateRows.map((t) => ({
    id: t.id,
    priority: t.priority,
    updatedAt: t.updatedAt,
    triggerRule: t.triggerRule as unknown as ConditionRule | null,
    entryNodeId: t.entryNodeId ?? '',
    nodes: t.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      conditionRule: n.conditionRule as unknown as ConditionRule | null,
    })),
    edges: t.edges.map((e) => ({
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      branch: e.branch,
    })),
  }));

  const matched = pickTemplate(templates, context);

  let chain: WarehouseTaskType[];

  if (matched) {
    // F-WORKFLOW — caminho NOVO: um template configurado pelo admin bate com
    // este recebimento.
    chain = resolveWorkflowTasks(matched, context).map(toWarehouseTaskType);
  } else {
    // Caminho ATUAL, inalterado: nenhum template configurado bate — o
    // recebimento se comporta exatamente como antes deste projeto.
    const needsQuarantine = await resolveQuarantineRequirement(
      tx,
      items.map((item) => item.productId)
    );

    chain = RECEIPT_TASK_CHAIN.filter(
      (type) => type !== WarehouseTaskType.QUARENTENA || needsQuarantine
    );
  }

  await tx.warehouseTask.createMany({
    data: chain.map((type, index) => ({
      type,
      status: WarehouseTaskStatus.PENDING,
      reference: receiptId,
      referenceType: RECEIPT_TASK_REFERENCE_TYPE,
      sequence: index + 1,
      priority: 0,
    })),
  });
};
```

- [ ] **Step 5: Rodar os testes novos e confirmar que passam**

Run: `npm run test:integration -- tests/integration/wms-receipt-tasks.test.ts`
Expected: PASS — os dois testes novos, mais todos os já existentes neste arquivo (sem regressão, incluindo o caminho "sem WMS licenciado" e o de "5 tarefas" do baseline).

- [ ] **Step 6: Rodar a suíte completa do backend para confirmar zero regressão em `purchase-receipt.service.ts` e afins**

Run: `npm run test:integration`
Expected: PASS — mesma contagem do baseline mais os testes novos deste plano; nenhum teste pré-existente quebrado (em particular `wms-lot-receipt.test.ts` e `wms-receipt-chain-4b.test.ts`, que também exercitam `createReceiptTaskChain` por outros caminhos).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/warehouse-task.service.ts backend/tests/integration/wms-receipt-tasks.test.ts
git commit -m "feat(backend): integra o resolvedor de workflow na cadeia de recebimento

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: CRUD de `WorkflowTemplate` (validator + service + controller + routes)

**Files:**
- Create: `backend/src/validators/workflow-template.validator.ts`
- Create: `backend/src/services/workflow-template.service.ts`
- Create: `backend/src/controllers/workflow-template.controller.ts`
- Create: `backend/src/routes/workflow-template.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/integration/workflow-template.test.ts`

**Interfaces:**
- Consumes: `validateWorkflowGraph`/`GraphNodeInput`/`GraphEdgeInput` de `workflow-graph.service.ts` (Task 3); `ConditionRule`/`CONDITION_FIELDS` de `workflow-condition.service.ts` (Task 2).
- Produces: rotas HTTP `GET/POST/PUT/DELETE /wms-workflow-templates` e `POST /wms-workflow-templates/:id/duplicate` — Task 7 (frontend service) as consome.

- [ ] **Step 1: Validator**

Create `backend/src/validators/workflow-template.validator.ts`:

```ts
import Joi from 'joi';
import { CONDITION_FIELDS } from '../services/workflow-condition.service';

/**
 * F-WORKFLOW — validação de entrada do CRUD de WorkflowTemplate. A árvore
 * `ConditionRule` é RECURSIVA (grupo AND/OR contém outras ConditionRule) —
 * usa o idioma padrão do Joi para schemas recursivos: `.id()` no nó raiz e
 * `Joi.link('#conditionRule')` nos clauses, resolvido pela própria lib.
 *
 * Nós/arestas chegam com CLIENT IDS (strings arbitrárias geradas no
 * navegador antes de qualquer persistência) — o service resolve esses ids
 * para uuid real ao criar. Por isso `id`/`fromClientId`/`toClientId` aqui são
 * `Joi.string().required()` livre, não `.uuid()`.
 */

const conditionOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains'];

const conditionLeafSchema = Joi.object({
  field: Joi.string().valid(...CONDITION_FIELDS).required(),
  operator: Joi.string().valid(...conditionOperators).required(),
  value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).required(),
});

const conditionRuleSchema = Joi.alternatives()
  .id('conditionRule')
  .try(
    conditionLeafSchema,
    Joi.object({
      op: Joi.string().valid('AND', 'OR').required(),
      clauses: Joi.array().items(Joi.link('#conditionRule')).min(1).required(),
    })
  );

const NODE_TYPES = ['DESCARGA', 'CONFERENCIA', 'ETIQUETAGEM', 'QUARENTENA', 'SEGREGACAO', 'AMOSTRAGEM', 'ALOCACAO', 'DECISAO'];

const nodeSchema = Joi.object({
  clientId: Joi.string().required(),
  type: Joi.string().valid(...NODE_TYPES).required(),
  label: Joi.string().allow('', null),
  conditionRule: conditionRuleSchema.allow(null),
  positionX: Joi.number().required(),
  positionY: Joi.number().required(),
});

const edgeSchema = Joi.object({
  fromClientId: Joi.string().required(),
  toClientId: Joi.string().required(),
  branch: Joi.string().valid('SIM', 'NAO').allow(null),
});

export const createWorkflowTemplateSchema = Joi.object({
  name: Joi.string().min(1).max(120).required(),
  description: Joi.string().allow('', null),
  priority: Joi.number().integer().min(0).default(0),
  active: Joi.boolean().default(true),
  triggerRule: conditionRuleSchema.allow(null),
  entryClientId: Joi.string().required(),
  nodes: Joi.array().items(nodeSchema).min(1).required(),
  edges: Joi.array().items(edgeSchema).required(),
});

export const updateWorkflowTemplateSchema = createWorkflowTemplateSchema;

export const listWorkflowTemplatesQuerySchema = Joi.object({
  active: Joi.boolean(),
}).unknown(true);
```

- [ ] **Step 2: Service**

Create `backend/src/services/workflow-template.service.ts`:

```ts
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { validateWorkflowGraph, GraphNodeInput, GraphEdgeInput } from './workflow-graph.service';
import { ConditionRule } from './workflow-condition.service';

interface NodeDto {
  clientId: string;
  type: GraphNodeInput['type'];
  label?: string | null;
  conditionRule?: ConditionRule | null;
  positionX: number;
  positionY: number;
}

interface EdgeDto {
  fromClientId: string;
  toClientId: string;
  branch?: 'SIM' | 'NAO' | null;
}

export interface WorkflowTemplateDto {
  name: string;
  description?: string | null;
  priority?: number;
  active?: boolean;
  triggerRule?: ConditionRule | null;
  entryClientId: string;
  nodes: NodeDto[];
  edges: EdgeDto[];
}

/**
 * Roda `validateWorkflowGraph` (Task 3) contra os CLIENT IDS do payload —
 * a função é agnóstica a se o id é temporário ou um uuid persistido (ver a
 * nota em workflow-graph.service.ts).
 */
function assertValidGraph(data: WorkflowTemplateDto): void {
  const graphNodes: GraphNodeInput[] = data.nodes.map((n) => ({
    id: n.clientId,
    type: n.type,
    conditionRule: n.conditionRule ?? null,
  }));
  const graphEdges: GraphEdgeInput[] = data.edges.map((e) => ({
    fromNodeId: e.fromClientId,
    toNodeId: e.toClientId,
    branch: e.branch ?? null,
  }));

  const errors = validateWorkflowGraph(graphNodes, graphEdges, data.entryClientId);
  if (errors.length > 0) {
    throw new AppError(400, errors.join(' '));
  }
}

const workflowTemplateService = {
  async list(active?: boolean) {
    return prisma.workflowTemplate.findMany({
      where: active === undefined ? {} : { active },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });
  },

  async getById(id: string) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id },
      include: { nodes: true, edges: true },
    });
    if (!template) {
      throw new AppError(404, 'Template de workflow não encontrado');
    }
    return template;
  },

  async create(data: WorkflowTemplateDto) {
    assertValidGraph(data);

    return prisma.$transaction(async (tx) => {
      const template = await tx.workflowTemplate.create({
        data: {
          name: data.name,
          description: data.description ?? null,
          priority: data.priority ?? 0,
          active: data.active ?? true,
          triggerRule: (data.triggerRule ?? null) as object | null,
        },
      });

      const clientIdToNodeId = new Map<string, string>();
      for (const node of data.nodes) {
        const created = await tx.workflowNode.create({
          data: {
            templateId: template.id,
            type: node.type,
            label: node.label ?? null,
            conditionRule: (node.conditionRule ?? null) as object | null,
            positionX: node.positionX,
            positionY: node.positionY,
          },
        });
        clientIdToNodeId.set(node.clientId, created.id);
      }

      for (const edge of data.edges) {
        await tx.workflowEdge.create({
          data: {
            templateId: template.id,
            fromNodeId: clientIdToNodeId.get(edge.fromClientId)!,
            toNodeId: clientIdToNodeId.get(edge.toClientId)!,
            branch: edge.branch ?? null,
          },
        });
      }

      const entryNodeId = clientIdToNodeId.get(data.entryClientId);
      if (!entryNodeId) {
        throw new AppError(400, 'entryClientId não corresponde a nenhum nó enviado.');
      }

      return tx.workflowTemplate.update({
        where: { id: template.id },
        data: { entryNodeId },
        include: { nodes: true, edges: true },
      });
    });
  },

  /**
   * Substitui TODOS os nós/arestas do template pelo payload novo — o editor
   * visual sempre envia o grafo inteiro a cada "Salvar" (não há PATCH parcial
   * de nó/aresta individual). Delete-then-recreate dentro de uma transação:
   * mais simples e correto do que tentar diffar client ids contra uuids
   * antigos, e o grafo é pequeno (dezenas de nós, não milhares).
   */
  async update(id: string, data: WorkflowTemplateDto) {
    assertValidGraph(data);

    const existing = await prisma.workflowTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Template de workflow não encontrado');
    }

    return prisma.$transaction(async (tx) => {
      await tx.workflowTemplate.update({ where: { id }, data: { entryNodeId: null } });
      await tx.workflowEdge.deleteMany({ where: { templateId: id } });
      await tx.workflowNode.deleteMany({ where: { templateId: id } });

      const clientIdToNodeId = new Map<string, string>();
      for (const node of data.nodes) {
        const created = await tx.workflowNode.create({
          data: {
            templateId: id,
            type: node.type,
            label: node.label ?? null,
            conditionRule: (node.conditionRule ?? null) as object | null,
            positionX: node.positionX,
            positionY: node.positionY,
          },
        });
        clientIdToNodeId.set(node.clientId, created.id);
      }

      for (const edge of data.edges) {
        await tx.workflowEdge.create({
          data: {
            templateId: id,
            fromNodeId: clientIdToNodeId.get(edge.fromClientId)!,
            toNodeId: clientIdToNodeId.get(edge.toClientId)!,
            branch: edge.branch ?? null,
          },
        });
      }

      const entryNodeId = clientIdToNodeId.get(data.entryClientId);
      if (!entryNodeId) {
        throw new AppError(400, 'entryClientId não corresponde a nenhum nó enviado.');
      }

      return tx.workflowTemplate.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description ?? null,
          priority: data.priority ?? 0,
          active: data.active ?? true,
          triggerRule: (data.triggerRule ?? null) as object | null,
          entryNodeId,
        },
        include: { nodes: true, edges: true },
      });
    });
  },

  async remove(id: string) {
    const existing = await prisma.workflowTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Template de workflow não encontrado');
    }
    // Cascade (schema.prisma) apaga nodes/edges junto.
    await prisma.workflowTemplate.delete({ where: { id } });
  },

  /** Cópia completa (nós, arestas, entrada) com novo nome e `active: false` — o admin revisa antes de ativar a cópia. */
  async duplicate(id: string) {
    const original = await prisma.workflowTemplate.findUnique({
      where: { id },
      include: { nodes: true, edges: true },
    });
    if (!original) {
      throw new AppError(404, 'Template de workflow não encontrado');
    }

    return prisma.$transaction(async (tx) => {
      const copy = await tx.workflowTemplate.create({
        data: {
          name: `${original.name} (cópia)`,
          description: original.description,
          priority: original.priority,
          active: false,
          triggerRule: original.triggerRule as object | null,
        },
      });

      const oldToNewNodeId = new Map<string, string>();
      for (const node of original.nodes) {
        const created = await tx.workflowNode.create({
          data: {
            templateId: copy.id,
            type: node.type,
            label: node.label,
            conditionRule: node.conditionRule as object | null,
            positionX: node.positionX,
            positionY: node.positionY,
          },
        });
        oldToNewNodeId.set(node.id, created.id);
      }

      for (const edge of original.edges) {
        await tx.workflowEdge.create({
          data: {
            templateId: copy.id,
            fromNodeId: oldToNewNodeId.get(edge.fromNodeId)!,
            toNodeId: oldToNewNodeId.get(edge.toNodeId)!,
            branch: edge.branch,
          },
        });
      }

      return tx.workflowTemplate.update({
        where: { id: copy.id },
        data: { entryNodeId: original.entryNodeId ? oldToNewNodeId.get(original.entryNodeId) : null },
        include: { nodes: true, edges: true },
      });
    });
  },
};

export default workflowTemplateService;
```

- [ ] **Step 3: Controller**

Create `backend/src/controllers/workflow-template.controller.ts`:

```ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import workflowTemplateService from '../services/workflow-template.service';

export class WorkflowTemplateController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const active = req.query.active === undefined ? undefined : req.query.active === 'true';
      const data = await workflowTemplateService.list(active);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowTemplateService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowTemplateService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Template de workflow criado com sucesso', data });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowTemplateService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Template de workflow atualizado com sucesso', data });
    } catch (error) {
      return next(error);
    }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await workflowTemplateService.remove(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Template de workflow excluído com sucesso' });
    } catch (error) {
      return next(error);
    }
  }

  async duplicate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowTemplateService.duplicate(req.params.id);
      return res.status(201).json({ status: 'success', message: 'Template de workflow duplicado com sucesso', data });
    } catch (error) {
      return next(error);
    }
  }
}

export default new WorkflowTemplateController();
```

- [ ] **Step 4: Routes**

Create `backend/src/routes/workflow-template.routes.ts`:

```ts
import { Router } from 'express';
import workflowTemplateController from '../controllers/workflow-template.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createWorkflowTemplateSchema,
  listWorkflowTemplatesQuerySchema,
  updateWorkflowTemplateSchema,
} from '../validators/workflow-template.validator';

/**
 * F-WORKFLOW — MONTADO SOB `requireModule('WMS')` em routes/index.ts.
 *
 * RBAC — recurso REAPROVEITADO, `estruturas_armazem`, mesmo precedente de
 * `storage-rule.routes.ts`: quem desenha a estrutura física do armazém é
 * quem desenha o fluxo de operação dela.
 */
const router = Router();

router.use(authMiddleware);

router.get(
  '/',
  requirePermission('estruturas_armazem', 'visualizar'),
  validateQuery(listWorkflowTemplatesQuerySchema),
  workflowTemplateController.list
);

router.get(
  '/:id',
  requirePermission('estruturas_armazem', 'visualizar'),
  workflowTemplateController.getById
);

router.post(
  '/',
  requirePermission('estruturas_armazem', 'criar'),
  validate(createWorkflowTemplateSchema),
  workflowTemplateController.create
);

router.post(
  '/:id/duplicate',
  requirePermission('estruturas_armazem', 'criar'),
  workflowTemplateController.duplicate
);

router.put(
  '/:id',
  requirePermission('estruturas_armazem', 'editar'),
  validate(updateWorkflowTemplateSchema),
  workflowTemplateController.update
);

router.delete(
  '/:id',
  requirePermission('estruturas_armazem', 'excluir'),
  workflowTemplateController.remove
);

export default router;
```

- [ ] **Step 5: Montar sob `requireModule('WMS')`**

Em `backend/src/routes/index.ts`, adicionar o import junto aos demais (perto de `storageRuleRoutes`):

```ts
import workflowTemplateRoutes from './workflow-template.routes';
```

E adicionar, logo depois de `router.use('/storage-rules', requireModule('WMS'), storageRuleRoutes);`:

```ts
// F-WORKFLOW: templates do motor de workflow dinâmico do WMS. Mesmo
// requireModule('WMS') do resto do armazém.
router.use('/wms-workflow-templates', requireModule('WMS'), workflowTemplateRoutes);
```

- [ ] **Step 6: Testes de integração**

Create `backend/tests/integration/workflow-template.test.ts`, seguindo EXATAMENTE o padrão de setup de `backend/tests/integration/module-licensing.test.ts` (import nomeado de `app`, `createUserWithPermissions` com um `{resource, action}` por entrada — não `actions: []` —, `login()` local que faz `POST /api/v1/auth/login` e devolve só a string do token, `setModule()` local, e os hooks `beforeEach`/`afterEach`/`afterAll` de `clearLicensedModuleCache`/`cleanDatabase`/`disconnectTestDb`):

```ts
import request from 'supertest';
import { app } from '../../src/app';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createUserWithPermissions } from '../helpers/fixtures';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return res.body.data.accessToken as string;
};

const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

describe('Integração: templates de workflow do WMS', () => {
  beforeEach(() => {
    clearLicensedModuleCache();
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('POST /api/v1/wms-workflow-templates', () => {
    it('cria um template com grafo válido (Descarga -> Alocacao) e retorna 201', async () => {
      await setModule('WMS', true);
      const token = await login([
        { resource: 'estruturas_armazem', action: 'criar' },
        { resource: 'estruturas_armazem', action: 'visualizar' },
      ]);

      const response = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Fluxo padrão de teste',
          priority: 1,
          triggerRule: { field: 'product.weight', operator: 'gt', value: 0 },
          entryClientId: 'c1',
          nodes: [
            { clientId: 'c1', type: 'DESCARGA', positionX: 0, positionY: 0 },
            { clientId: 'c2', type: 'ALOCACAO', positionX: 0, positionY: 100 },
          ],
          edges: [{ fromClientId: 'c1', toClientId: 'c2' }],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.entryNodeId).toBeTruthy();
      expect(response.body.data.nodes).toHaveLength(2);
    });

    it('rejeita um grafo inválido (Alocacao com saída) com 400', async () => {
      await setModule('WMS', true);
      const token = await login([{ resource: 'estruturas_armazem', action: 'criar' }]);

      const response = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Fluxo inválido',
          entryClientId: 'c1',
          nodes: [
            { clientId: 'c1', type: 'ALOCACAO', positionX: 0, positionY: 0 },
            { clientId: 'c2', type: 'DESCARGA', positionX: 0, positionY: 100 },
          ],
          edges: [{ fromClientId: 'c1', toClientId: 'c2' }],
        });

      expect(response.status).toBe(400);
    });

    it('rejeita payload sem entryClientId com 400 (Joi)', async () => {
      await setModule('WMS', true);
      const token = await login([{ resource: 'estruturas_armazem', action: 'criar' }]);

      const response = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sem entrada', nodes: [], edges: [] });

      expect(response.status).toBe(400);
    });

    it('sem WMS licenciado, retorna 404 (requireModule), mesmo com a permissão', async () => {
      await setModule('WMS', false);
      const token = await login([{ resource: 'estruturas_armazem', action: 'criar' }]);

      const response = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'x', entryClientId: 'c1', nodes: [{ clientId: 'c1', type: 'ALOCACAO', positionX: 0, positionY: 0 }], edges: [] });

      expect(response.status).toBe(404);
    });

    it('sem permissão estruturas_armazem:criar, retorna 403', async () => {
      await setModule('WMS', true);
      const token = await login([]);

      const response = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'x', entryClientId: 'c1', nodes: [{ clientId: 'c1', type: 'ALOCACAO', positionX: 0, positionY: 0 }], edges: [] });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/wms-workflow-templates/:id, PUT, DELETE, /duplicate', () => {
    it('cria, edita o grafo inteiro, duplica e exclui um template', async () => {
      await setModule('WMS', true);
      const token = await login([
        { resource: 'estruturas_armazem', action: 'criar' },
        { resource: 'estruturas_armazem', action: 'editar' },
        { resource: 'estruturas_armazem', action: 'excluir' },
        { resource: 'estruturas_armazem', action: 'visualizar' },
      ]);

      const created = await request(app)
        .post('/api/v1/wms-workflow-templates')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Original',
          entryClientId: 'c1',
          nodes: [{ clientId: 'c1', type: 'ALOCACAO', positionX: 0, positionY: 0 }],
          edges: [],
        });
      const id = created.body.data.id;

      const updated = await request(app)
        .put(`/api/v1/wms-workflow-templates/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Editado',
          entryClientId: 'c1',
          nodes: [
            { clientId: 'c1', type: 'DESCARGA', positionX: 0, positionY: 0 },
            { clientId: 'c2', type: 'ALOCACAO', positionX: 0, positionY: 100 },
          ],
          edges: [{ fromClientId: 'c1', toClientId: 'c2' }],
        });
      expect(updated.status).toBe(200);
      expect(updated.body.data.nodes).toHaveLength(2);

      const duplicated = await request(app)
        .post(`/api/v1/wms-workflow-templates/${id}/duplicate`)
        .set('Authorization', `Bearer ${token}`);
      expect(duplicated.status).toBe(201);
      expect(duplicated.body.data.active).toBe(false);
      expect(duplicated.body.data.name).toBe('Editado (cópia)');

      const deleted = await request(app)
        .delete(`/api/v1/wms-workflow-templates/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleted.status).toBe(200);

      const getAfterDelete = await request(app)
        .get(`/api/v1/wms-workflow-templates/${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getAfterDelete.status).toBe(404);
    });
  });
});
```

- [ ] **Step 7: Rodar os testes e confirmar que passam**

Run: `npm run test:integration -- tests/integration/workflow-template.test.ts`
Expected: PASS — 7/7 testes.

- [ ] **Step 8: Rodar a suíte completa**

Run: `npm run test:integration`
Expected: PASS, sem regressão no total pré-existente.

- [ ] **Step 9: Commit**

```bash
git add backend/src/validators/workflow-template.validator.ts backend/src/services/workflow-template.service.ts backend/src/controllers/workflow-template.controller.ts backend/src/routes/workflow-template.routes.ts backend/src/routes/index.ts backend/tests/integration/workflow-template.test.ts
git commit -m "feat(backend): adiciona CRUD de templates de workflow do WMS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: Tipos + serviço + store do frontend

**Files:**
- Create: `frontend/src/types/workflow.types.ts`
- Create: `frontend/src/services/workflow-template.service.ts`
- Create: `frontend/src/stores/workflow-template.store.ts`
- Test: `frontend/src/stores/__tests__/workflow-template.store.spec.ts`

**Interfaces:**
- Produces: `ConditionRule`, `ConditionField`, `CONDITION_FIELDS`, `WorkflowNodeType`, `WorkflowNode`, `WorkflowEdge`, `WorkflowTemplate`, `WorkflowTemplateDto` (types); `workflowTemplateService` (objeto com `getAll/getById/create/update/delete/duplicate`); `useWorkflowTemplateStore` — Tasks 8-10 importam estes diretamente.

- [ ] **Step 1: Tipos**

Create `frontend/src/types/workflow.types.ts`:

```ts
export const CONDITION_FIELDS = [
  'product.weight',
  'product.volume',
  'product.packagingType',
  'product.segregationGroup',
  'product.maxStackQty',
  'product.lotTracked',
  'product.categoryId',
  'order.supplierId',
] as const

export type ConditionField = (typeof CONDITION_FIELDS)[number]
export type ConditionOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'

export interface ConditionLeaf {
  field: ConditionField
  operator: ConditionOperator
  value: string | number | boolean
}

export interface ConditionGroup {
  op: 'AND' | 'OR'
  clauses: ConditionRule[]
}

export type ConditionRule = ConditionLeaf | ConditionGroup

export const WORKFLOW_NODE_TYPES = [
  'DESCARGA',
  'CONFERENCIA',
  'ETIQUETAGEM',
  'QUARENTENA',
  'SEGREGACAO',
  'AMOSTRAGEM',
  'ALOCACAO',
  'DECISAO',
] as const

export type WorkflowNodeType = (typeof WORKFLOW_NODE_TYPES)[number]

export const WORKFLOW_NODE_LABELS: Record<WorkflowNodeType, string> = {
  DESCARGA: 'Descarga',
  CONFERENCIA: 'Conferência',
  ETIQUETAGEM: 'Etiquetagem',
  QUARENTENA: 'Quarentena',
  SEGREGACAO: 'Segregação',
  AMOSTRAGEM: 'Amostragem',
  ALOCACAO: 'Alocação',
  DECISAO: 'Decisão',
}

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  label: string | null
  conditionRule: ConditionRule | null
  positionX: number
  positionY: number
}

export interface WorkflowEdge {
  id: string
  fromNodeId: string
  toNodeId: string
  branch: 'SIM' | 'NAO' | null
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string | null
  active: boolean
  priority: number
  triggerRule: ConditionRule | null
  entryNodeId: string | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: string
  updatedAt: string
}

export interface WorkflowNodeDto {
  clientId: string
  type: WorkflowNodeType
  label?: string | null
  conditionRule?: ConditionRule | null
  positionX: number
  positionY: number
}

export interface WorkflowEdgeDto {
  fromClientId: string
  toClientId: string
  branch?: 'SIM' | 'NAO' | null
}

export interface WorkflowTemplateDto {
  name: string
  description?: string | null
  priority?: number
  active?: boolean
  triggerRule?: ConditionRule | null
  entryClientId: string
  nodes: WorkflowNodeDto[]
  edges: WorkflowEdgeDto[]
}
```

- [ ] **Step 2: Serviço**

Create `frontend/src/services/workflow-template.service.ts`:

```ts
import api from '@/services/api'
import type { ApiEnvelope } from '@/types/warehouse.types'
import type { WorkflowTemplate, WorkflowTemplateDto } from '@/types/workflow.types'

const workflowTemplateService = {
  async getAll(active?: boolean) {
    const params = new URLSearchParams()
    if (active !== undefined) params.append('active', String(active))
    return await api.get<ApiEnvelope<WorkflowTemplate[]>>(
      `/wms-workflow-templates?${params.toString()}`
    )
  },

  async getById(id: string) {
    return await api.get<ApiEnvelope<WorkflowTemplate>>(`/wms-workflow-templates/${id}`)
  },

  async create(data: WorkflowTemplateDto) {
    return await api.post<ApiEnvelope<WorkflowTemplate>>('/wms-workflow-templates', data)
  },

  async update(id: string, data: WorkflowTemplateDto) {
    return await api.put<ApiEnvelope<WorkflowTemplate>>(`/wms-workflow-templates/${id}`, data)
  },

  async delete(id: string) {
    return await api.delete<ApiEnvelope<null>>(`/wms-workflow-templates/${id}`)
  },

  async duplicate(id: string) {
    return await api.post<ApiEnvelope<WorkflowTemplate>>(`/wms-workflow-templates/${id}/duplicate`)
  },
}

export default workflowTemplateService
```

- [ ] **Step 3: Store**

Create `frontend/src/stores/workflow-template.store.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import workflowTemplateService from '@/services/workflow-template.service'
import type { WorkflowTemplate, WorkflowTemplateDto } from '@/types/workflow.types'

export const useWorkflowTemplateStore = defineStore('workflowTemplate', () => {
  const templates = ref<WorkflowTemplate[]>([])
  const loading = ref(false)

  const fetchTemplates = async (active?: boolean): Promise<WorkflowTemplate[]> => {
    loading.value = true
    try {
      const response = await workflowTemplateService.getAll(active)
      templates.value = response.data.data || []
      return templates.value
    } finally {
      loading.value = false
    }
  }

  const getTemplateById = async (id: string): Promise<WorkflowTemplate> => {
    const response = await workflowTemplateService.getById(id)
    return response.data.data
  }

  const createTemplate = async (data: WorkflowTemplateDto): Promise<WorkflowTemplate> => {
    const response = await workflowTemplateService.create(data)
    templates.value.push(response.data.data)
    return response.data.data
  }

  const updateTemplate = async (id: string, data: WorkflowTemplateDto): Promise<WorkflowTemplate> => {
    const response = await workflowTemplateService.update(id, data)
    const index = templates.value.findIndex((t) => t.id === id)
    if (index !== -1) templates.value[index] = response.data.data
    return response.data.data
  }

  const deleteTemplate = async (id: string): Promise<void> => {
    await workflowTemplateService.delete(id)
    templates.value = templates.value.filter((t) => t.id !== id)
  }

  const duplicateTemplate = async (id: string): Promise<WorkflowTemplate> => {
    const response = await workflowTemplateService.duplicate(id)
    templates.value.push(response.data.data)
    return response.data.data
  }

  return {
    templates,
    loading,
    fetchTemplates,
    getTemplateById,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  }
})
```

- [ ] **Step 4: Teste do store**

Create `frontend/src/stores/__tests__/workflow-template.store.spec.ts` (seguir o padrão de mock de `warehouse-structure.service` já usado pelos testes de store existentes em `frontend/src/stores/__tests__/`, se houver algum arquivo de referência neste diretório — mesma estrutura de `vi.mock`):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWorkflowTemplateStore } from '../workflow-template.store'
import workflowTemplateService from '@/services/workflow-template.service'

vi.mock('@/services/workflow-template.service', () => ({
  default: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    duplicate: vi.fn(),
  },
}))

const mockTemplate = {
  id: 't1',
  name: 'Fluxo teste',
  description: null,
  active: true,
  priority: 0,
  triggerRule: null,
  entryNodeId: 'n1',
  nodes: [],
  edges: [],
  createdAt: '',
  updatedAt: '',
}

describe('useWorkflowTemplateStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchTemplates popula templates a partir do service', async () => {
    vi.mocked(workflowTemplateService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockTemplate] },
    } as any)

    const store = useWorkflowTemplateStore()
    await store.fetchTemplates()

    expect(store.templates).toEqual([mockTemplate])
  })

  it('createTemplate adiciona o template criado à lista', async () => {
    vi.mocked(workflowTemplateService.create).mockResolvedValue({
      data: { status: 'success', data: mockTemplate },
    } as any)

    const store = useWorkflowTemplateStore()
    await store.createTemplate({ name: 'x', entryClientId: 'c1', nodes: [], edges: [] })

    expect(store.templates).toContainEqual(mockTemplate)
  })

  it('deleteTemplate remove o template da lista', async () => {
    vi.mocked(workflowTemplateService.getAll).mockResolvedValue({
      data: { status: 'success', data: [mockTemplate] },
    } as any)
    vi.mocked(workflowTemplateService.delete).mockResolvedValue({ data: { status: 'success' } } as any)

    const store = useWorkflowTemplateStore()
    await store.fetchTemplates()
    await store.deleteTemplate('t1')

    expect(store.templates).toEqual([])
  })
})
```

- [ ] **Step 5: Rodar os testes e o type-check**

Run: `npx vitest run src/stores/__tests__/workflow-template.store.spec.ts`
Expected: PASS — 3/3 testes.

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem de erros do baseline (nenhum erro novo).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/workflow.types.ts frontend/src/services/workflow-template.service.ts frontend/src/stores/workflow-template.store.ts frontend/src/stores/__tests__/workflow-template.store.spec.ts
git commit -m "feat(frontend): adiciona tipos, servico e store de templates de workflow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: Componente `ConditionRuleBuilder.vue`

**Files:**
- Create: `frontend/src/components/wms/ConditionRuleBuilder.vue`
- Test: `frontend/src/components/wms/__tests__/ConditionRuleBuilder.spec.ts`

**Interfaces:**
- Consumes: `ConditionRule`/`ConditionField`/`CONDITION_FIELDS`/`ConditionOperator` de `frontend/src/types/workflow.types.ts` (Task 7).
- Produces: componente Vue com prop `modelValue: ConditionRule | null` e evento `update:modelValue` (contrato v-model, família B — mesma família de `AppModal`) — Tasks 9 e 10 o usam tanto para `triggerRule` do template quanto para `conditionRule` de um nó `DECISAO`.

- [ ] **Step 1: Implementar**

Create `frontend/src/components/wms/ConditionRuleBuilder.vue`:

```vue
<template>
  <div class="space-y-2">
    <div v-if="isGroup(rule)" class="border border-gray-200 rounded-md p-3 space-y-2">
      <div class="flex items-center gap-2">
        <select
          :value="rule.op"
          class="text-xs border-gray-300 rounded-md"
          @change="setGroupOp(($event.target as HTMLSelectElement).value as 'AND' | 'OR')"
        >
          <option value="AND">E (todas as condições)</option>
          <option value="OR">OU (qualquer uma)</option>
        </select>
        <button type="button" class="text-xs text-red-600 hover:underline" @click="emitRule(null)">
          Remover grupo
        </button>
      </div>

      <ConditionRuleBuilder
        v-for="(clause, index) in rule.clauses"
        :key="index"
        :model-value="clause"
        @update:model-value="(value) => updateClause(index, value)"
      />

      <div class="flex gap-2">
        <button type="button" class="text-xs text-primary-600 hover:underline" @click="addClause('leaf')">
          + condição
        </button>
        <button type="button" class="text-xs text-primary-600 hover:underline" @click="addClause('group')">
          + subgrupo
        </button>
      </div>
    </div>

    <div v-else-if="rule" class="flex items-center gap-2">
      <select
        :value="rule.field"
        class="text-xs border-gray-300 rounded-md"
        @change="updateLeaf({ field: ($event.target as HTMLSelectElement).value as any })"
      >
        <option v-for="field in CONDITION_FIELDS" :key="field" :value="field">{{ field }}</option>
      </select>
      <select
        :value="rule.operator"
        class="text-xs border-gray-300 rounded-md"
        @change="updateLeaf({ operator: ($event.target as HTMLSelectElement).value as any })"
      >
        <option v-for="op in OPERATORS" :key="op" :value="op">{{ op }}</option>
      </select>
      <input
        :value="String(rule.value)"
        type="text"
        class="text-xs border-gray-300 rounded-md w-24"
        @input="updateLeaf({ value: coerceValue(($event.target as HTMLInputElement).value) })"
      />
      <button type="button" class="text-xs text-red-600 hover:underline" @click="emitRule(null)">✕</button>
    </div>

    <button v-else type="button" class="text-xs text-primary-600 hover:underline" @click="addClause('leaf')">
      + adicionar condição
    </button>
  </div>
</template>

<script setup lang="ts">
import { CONDITION_FIELDS } from '@/types/workflow.types'
import type { ConditionRule, ConditionLeaf, ConditionGroup, ConditionField } from '@/types/workflow.types'

const OPERATORS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains'] as const

interface Props {
  modelValue: ConditionRule | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: ConditionRule | null] }>()

const rule = props.modelValue

function isGroup(value: ConditionRule | null): value is ConditionGroup {
  return !!value && 'op' in value
}

function emitRule(value: ConditionRule | null): void {
  emit('update:modelValue', value)
}

function setGroupOp(op: 'AND' | 'OR'): void {
  if (isGroup(rule)) emitRule({ ...rule, op })
}

function updateClause(index: number, value: ConditionRule | null): void {
  if (!isGroup(rule)) return
  const clauses = [...rule.clauses]
  if (value === null) {
    clauses.splice(index, 1)
  } else {
    clauses[index] = value
  }
  emitRule({ ...rule, clauses })
}

function addClause(kind: 'leaf' | 'group'): void {
  const newClause: ConditionRule =
    kind === 'leaf'
      ? { field: CONDITION_FIELDS[0] as ConditionField, operator: 'eq', value: '' }
      : { op: 'AND', clauses: [] }

  if (isGroup(rule)) {
    emitRule({ ...rule, clauses: [...rule.clauses, newClause] })
  } else {
    emitRule(newClause)
  }
}

function updateLeaf(partial: Partial<ConditionLeaf>): void {
  if (!rule || isGroup(rule)) return
  emitRule({ ...rule, ...partial })
}

function coerceValue(raw: string): string | number | boolean {
  if (raw === 'true') return true
  if (raw === 'false') return false
  const asNumber = Number(raw)
  return raw !== '' && !Number.isNaN(asNumber) ? asNumber : raw
}
</script>
```

- [ ] **Step 2: Escrever o teste**

Create `frontend/src/components/wms/__tests__/ConditionRuleBuilder.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConditionRuleBuilder from '../ConditionRuleBuilder.vue'

describe('ConditionRuleBuilder', () => {
  it('mostra o botão de adicionar condição quando modelValue é null', () => {
    const wrapper = mount(ConditionRuleBuilder, { props: { modelValue: null } })
    expect(wrapper.text()).toContain('adicionar condição')
  })

  it('emite update:modelValue com uma condição simples ao clicar em "+ adicionar condição"', async () => {
    const wrapper = mount(ConditionRuleBuilder, { props: { modelValue: null } })
    await wrapper.find('button').trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toMatchObject({ operator: 'eq' })
  })

  it('renderiza um grupo AND/OR com seus clauses filhos', () => {
    const wrapper = mount(ConditionRuleBuilder, {
      props: {
        modelValue: {
          op: 'AND',
          clauses: [{ field: 'product.weight', operator: 'gt', value: 500 }],
        },
      },
    })
    expect(wrapper.find('select').exists()).toBe(true)
    expect(wrapper.text()).toContain('E (todas as condições)')
  })

  it('emite null ao remover uma condição simples', async () => {
    const wrapper = mount(ConditionRuleBuilder, {
      props: { modelValue: { field: 'product.weight', operator: 'gt', value: 500 } },
    })
    const removeButton = wrapper.findAll('button').find((b) => b.text() === '✕')!
    await removeButton.trigger('click')

    expect(wrapper.emitted('update:modelValue')![0][0]).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar os testes**

Run: `npx vitest run src/components/wms/__tests__/ConditionRuleBuilder.spec.ts`
Expected: PASS — 4/4 testes.

- [ ] **Step 4: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem de erros do baseline.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/wms/ConditionRuleBuilder.vue frontend/src/components/wms/__tests__/ConditionRuleBuilder.spec.ts
git commit -m "feat(frontend): adiciona construtor de regra de condicao reutilizavel

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: Lista de templates (`WorkflowTemplatesView.vue`) + rota + card do Dashboard

**Files:**
- Create: `frontend/src/views/wms/WorkflowTemplatesView.vue`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/DashboardView.vue:257-272`

**Interfaces:**
- Consumes: `useWorkflowTemplateStore` (Task 7); `AppLayout`/`DataTable`/`StatusBadge`/`AppModal` (`frontend/src/components/common/`).
- Produces: rota `/wms/workflows` — Task 11 (editor) adiciona `/wms/workflows/new` e `/wms/workflows/:id` ao lado desta no mesmo Step do router.

- [ ] **Step 1: Implementar a view**

Create `frontend/src/views/wms/WorkflowTemplatesView.vue`:

```vue
<template>
  <AppLayout title="Workflows do WMS" subtitle="Fluxos configuráveis de recebimento">
    <template #actions>
      <RouterLink
        to="/wms/workflows/new"
        class="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
      >
        Novo Workflow
      </RouterLink>
    </template>

    <DataTable
      :loading="store.loading"
      :items="store.templates"
      empty-title="Nenhum workflow configurado"
      empty-hint="Sem workflows ativos, o recebimento usa a cadeia padrão do sistema."
    >
      <template #head>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prioridade</th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
      </template>
      <template #row="{ item }">
        <td class="px-6 py-4 text-sm text-gray-900">{{ item.name }}</td>
        <td class="px-6 py-4 text-sm text-gray-600">{{ item.priority }}</td>
        <td class="px-6 py-4">
          <StatusBadge :label="item.active ? 'Ativo' : 'Inativo'" :tone="item.active ? 'success' : 'neutral'" />
        </td>
        <td class="px-6 py-4 text-right text-sm space-x-3">
          <RouterLink :to="`/wms/workflows/${item.id}`" class="text-primary-600 hover:underline">
            Editar
          </RouterLink>
          <button type="button" class="text-primary-600 hover:underline" @click="handleDuplicate(item.id)">
            Duplicar
          </button>
          <button type="button" class="text-red-600 hover:underline" @click="askDelete(item)">
            Excluir
          </button>
        </td>
      </template>
    </DataTable>

    <AppModal v-model="deleteModalOpen" title="Excluir workflow" size="sm">
      <p class="text-sm text-gray-700">
        Tem certeza que deseja excluir o workflow "{{ templateToDelete?.name }}"? Recebimentos já criados não são
        afetados — só a criação de novos, que passam a usar outro template (ou a cadeia padrão).
      </p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button type="button" class="px-4 py-2 text-sm text-gray-700" @click="deleteModalOpen = false">
            Cancelar
          </button>
          <button
            type="button"
            class="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
            @click="confirmDelete"
          >
            Excluir
          </button>
        </div>
      </template>
    </AppModal>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import AppLayout from '@/components/common/AppLayout.vue'
import DataTable from '@/components/common/DataTable.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import AppModal from '@/components/common/AppModal.vue'
import { useWorkflowTemplateStore } from '@/stores/workflow-template.store'
import type { WorkflowTemplate } from '@/types/workflow.types'

const store = useWorkflowTemplateStore()

const deleteModalOpen = ref(false)
const templateToDelete = ref<WorkflowTemplate | null>(null)

onMounted(() => {
  store.fetchTemplates()
})

function askDelete(template: WorkflowTemplate): void {
  templateToDelete.value = template
  deleteModalOpen.value = true
}

async function confirmDelete(): Promise<void> {
  if (!templateToDelete.value) return
  await store.deleteTemplate(templateToDelete.value.id)
  deleteModalOpen.value = false
  templateToDelete.value = null
}

async function handleDuplicate(id: string): Promise<void> {
  await store.duplicateTemplate(id)
}
</script>
```

- [ ] **Step 2: Rota**

Em `frontend/src/router/index.ts`, adicionar junto às demais rotas do WMS (perto de `/warehouse-structures`):

```ts
{
  path: '/wms/workflows',
  name: 'wms-workflows',
  component: () => import('../views/wms/WorkflowTemplatesView.vue'),
  meta: { requiresAuth: true },
},
```

(Seguir o mesmo formato de `meta` das rotas vizinhas — se as rotas de WMS usarem uma chave diferente de `requiresAuth`, ex. `requiresModule: 'WMS'`, usar a MESMA convenção já presente nas rotas de `/warehouse-structures`/`/warehouses` deste arquivo, não a hipotética acima.)

- [ ] **Step 3: Card no Dashboard**

Em `frontend/src/views/DashboardView.vue:257-265`, o bloco hoje é:

```html
<RouterLink
  to="/warehouse-structures"
  class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
>
  <div class="text-center">
    <div class="text-3xl mb-2">📦</div>
    <p class="text-sm font-medium text-gray-700">Estruturas de Armazém</p>
  </div>
</RouterLink>
```

Adicionar, logo depois deste bloco (antes do card "Recebimento" ainda em "Em breve"):

```html
<RouterLink
  to="/wms/workflows"
  class="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-400 hover:bg-primary-50 transition-colors cursor-pointer"
>
  <div class="text-center">
    <div class="text-3xl mb-2">🔀</div>
    <p class="text-sm font-medium text-gray-700">Workflows</p>
  </div>
</RouterLink>
```

- [ ] **Step 4: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem de erros do baseline.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/wms/WorkflowTemplatesView.vue frontend/src/router/index.ts frontend/src/views/DashboardView.vue
git commit -m "feat(frontend): adiciona lista de workflows do WMS e navegacao

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: Instalar `@vue-flow/core` e criar os nós customizados da paleta

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/components/wms/workflow-nodes/OperationNode.vue`
- Create: `frontend/src/components/wms/workflow-nodes/DecisionNode.vue`
- Create: `frontend/src/components/wms/workflow-nodes/EntryNode.vue`
- Test: `frontend/src/components/wms/workflow-nodes/__tests__/OperationNode.spec.ts`

**Interfaces:**
- Consumes: `WORKFLOW_NODE_LABELS`/`WorkflowNodeType` de `frontend/src/types/workflow.types.ts` (Task 7).
- Produces: 3 componentes de nó `@vue-flow/core` (recebem `data`/`selected` como props via slot `#node-<tipo>` do `<VueFlow>`) — Task 11 os registra no editor.

- [ ] **Step 1: Instalar a dependência**

Run (de `frontend/`): `npm install @vue-flow/core@^1.41.0`
Expected: `package.json`/`package-lock.json` ganham a dependência; comando sai com exit 0.

- [ ] **Step 2: `OperationNode.vue` (os 7 tipos de operação real — tudo exceto Decisão e a Entrada)**

Create `frontend/src/components/wms/workflow-nodes/OperationNode.vue`:

```vue
<template>
  <div
    class="px-3 py-2 rounded-lg border-2 bg-white text-xs font-semibold shadow-sm whitespace-nowrap"
    :class="isAlocacao ? 'border-green-500 bg-green-50' : 'border-primary-400'"
  >
    <Handle type="target" :position="Position.Left" />
    {{ ICONS[data.type] }} {{ WORKFLOW_NODE_LABELS[data.type] }}
    <Handle v-if="!isAlocacao" type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { WORKFLOW_NODE_LABELS } from '@/types/workflow.types'
import type { WorkflowNodeType } from '@/types/workflow.types'

const props = defineProps<{ data: { type: WorkflowNodeType } }>()

const ICONS: Record<string, string> = {
  DESCARGA: '📥',
  CONFERENCIA: '✅',
  ETIQUETAGEM: '🏷️',
  QUARENTENA: '⚠️',
  SEGREGACAO: '🔀',
  AMOSTRAGEM: '🧪',
  ALOCACAO: '📦',
}

const isAlocacao = computed(() => props.data.type === 'ALOCACAO')
</script>
```

- [ ] **Step 3: `DecisionNode.vue`**

Create `frontend/src/components/wms/workflow-nodes/DecisionNode.vue`:

```vue
<template>
  <div class="px-3 py-2 rounded-lg border-2 border-purple-400 bg-purple-50 text-xs font-semibold shadow-sm whitespace-nowrap">
    <Handle type="target" :position="Position.Left" />
    🔶 {{ data.label || 'Decisão' }}
    <Handle id="SIM" type="source" :position="Position.Bottom" style="left: 30%; background: #16a34a" />
    <Handle id="NAO" type="source" :position="Position.Bottom" style="left: 70%; background: #dc2626" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{ data: { label: string | null } }>()
</script>
```

- [ ] **Step 4: `EntryNode.vue`**

Create `frontend/src/components/wms/workflow-nodes/EntryNode.vue`:

```vue
<template>
  <div class="px-4 py-2 rounded-full border-2 border-gray-700 bg-gray-100 text-xs font-semibold shadow-sm">
    Entrada
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
</script>
```

- [ ] **Step 5: Teste**

Create `frontend/src/components/wms/workflow-nodes/__tests__/OperationNode.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { VueFlow } from '@vue-flow/core'
import OperationNode from '../OperationNode.vue'

describe('OperationNode', () => {
  it('mostra o rótulo e ícone do tipo de nó', () => {
    const wrapper = mount(OperationNode, {
      props: { data: { type: 'DESCARGA' } },
      global: { stubs: { Handle: true } },
    })
    expect(wrapper.text()).toContain('Descarga')
  })

  it('não renderiza handle de saída (source) para Alocação', () => {
    const wrapper = mount(OperationNode, {
      props: { data: { type: 'ALOCACAO' } },
      global: { stubs: { Handle: { template: '<div class="handle-stub" :data-type="type" />', props: ['type'] } } },
    })
    const sourceHandles = wrapper.findAll('.handle-stub[data-type="source"]')
    expect(sourceHandles).toHaveLength(0)
  })
})
```

(A referência a `VueFlow` no import serve só para confirmar que `@vue-flow/core` resolve corretamente neste arquivo de teste — o teste em si monta `OperationNode` isolado, sem precisar de um `<VueFlow>` ao redor, porque `Handle` é stubado.)

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run src/components/wms/workflow-nodes/__tests__/OperationNode.spec.ts`
Expected: PASS — 2/2 testes.

- [ ] **Step 7: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem de erros do baseline.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/wms/workflow-nodes
git commit -m "feat(frontend): adiciona vue-flow e os nos customizados da paleta do WMS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: Editor visual (`WorkflowTemplateEditorView.vue`)

**Files:**
- Create: `frontend/src/views/wms/WorkflowTemplateEditorView.vue`
- Modify: `frontend/src/router/index.ts`
- Test: `frontend/src/views/wms/__tests__/WorkflowTemplateEditorView.spec.ts`

**Interfaces:**
- Consumes: `useWorkflowTemplateStore` (Task 7); `ConditionRuleBuilder.vue` (Task 8); `OperationNode.vue`/`DecisionNode.vue`/`EntryNode.vue` (Task 10); `FormField`/`AppLayout` (`frontend/src/components/common/`); `VueFlow`, `useVueFlow`, `Panel` de `@vue-flow/core`.
- Produces: rotas `/wms/workflows/new` e `/wms/workflows/:id`.

- [ ] **Step 1: Implementar a view**

Create `frontend/src/views/wms/WorkflowTemplateEditorView.vue`:

```vue
<template>
  <AppLayout :title="isNew ? 'Novo Workflow' : 'Editar Workflow'" subtitle="Recebimento (WMS)">
    <template #actions>
      <button
        type="button"
        class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
        @click="handleSave"
      >
        Salvar
      </button>
    </template>

    <div v-if="clientErrors.length" class="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
      <p v-for="(error, index) in clientErrors" :key="index">{{ error }}</p>
    </div>

    <div class="grid grid-cols-4 gap-4 mb-4">
      <FormField label="Nome" required class="col-span-2">
        <input v-model="name" type="text" class="mock-input w-full rounded-md border-gray-300 text-sm" />
      </FormField>
      <FormField label="Prioridade">
        <input v-model.number="priority" type="number" min="0" class="w-full rounded-md border-gray-300 text-sm" />
      </FormField>
      <FormField label="Ativo">
        <input v-model="active" type="checkbox" class="mt-2" />
      </FormField>
    </div>

    <FormField label="Quando este workflow se aplica (condição de gatilho)" class="mb-4">
      <ConditionRuleBuilder v-model="triggerRule" />
    </FormField>

    <div class="flex gap-4" style="height: 520px">
      <div class="w-40 border border-gray-200 rounded-lg p-2 space-y-2 overflow-y-auto">
        <p class="label mb-1">Operações</p>
        <div
          v-for="type in PALETTE_TYPES"
          :key="type"
          class="text-xs border border-gray-300 rounded-md px-2 py-1 cursor-grab bg-gray-50"
          draggable="true"
          @dragstart="onDragStart($event, type)"
        >
          {{ WORKFLOW_NODE_LABELS[type] }}
        </div>
      </div>

      <div class="flex-1 border border-gray-200 rounded-lg" @drop="onDrop" @dragover.prevent>
        <VueFlow v-model:nodes="flowNodes" v-model:edges="flowEdges" @connect="onConnect" @node-click="onNodeClick">
          <template #node-entry="nodeProps">
            <EntryNode v-bind="nodeProps" />
          </template>
          <template #node-decision="nodeProps">
            <DecisionNode v-bind="nodeProps" />
          </template>
          <template #node-operation="nodeProps">
            <OperationNode v-bind="nodeProps" />
          </template>
        </VueFlow>
      </div>

      <div v-if="selectedNode" class="w-64 border border-gray-200 rounded-lg p-3 overflow-y-auto">
        <p class="label mb-2">Nó selecionado: {{ selectedNodeLabel }}</p>
        <template v-if="selectedNode.type === 'decision'">
          <FormField label="Condição">
            <ConditionRuleBuilder v-model="selectedNode.data.conditionRule" />
          </FormField>
        </template>
        <button type="button" class="mt-3 text-xs text-red-600 hover:underline" @click="removeSelectedNode">
          Remover nó
        </button>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VueFlow, useVueFlow, type Node, type Edge, type Connection } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import AppLayout from '@/components/common/AppLayout.vue'
import FormField from '@/components/common/FormField.vue'
import ConditionRuleBuilder from '@/components/wms/ConditionRuleBuilder.vue'
import EntryNode from '@/components/wms/workflow-nodes/EntryNode.vue'
import DecisionNode from '@/components/wms/workflow-nodes/DecisionNode.vue'
import OperationNode from '@/components/wms/workflow-nodes/OperationNode.vue'
import { useWorkflowTemplateStore } from '@/stores/workflow-template.store'
import { WORKFLOW_NODE_LABELS } from '@/types/workflow.types'
import type { ConditionRule, WorkflowNodeType, WorkflowTemplateDto } from '@/types/workflow.types'

const PALETTE_TYPES: WorkflowNodeType[] = [
  'DESCARGA',
  'CONFERENCIA',
  'ETIQUETAGEM',
  'QUARENTENA',
  'SEGREGACAO',
  'AMOSTRAGEM',
  'ALOCACAO',
  'DECISAO',
]

interface FlowNodeData {
  workflowType: WorkflowNodeType
  conditionRule?: ConditionRule | null
}

const route = useRoute()
const router = useRouter()
const store = useWorkflowTemplateStore()
const { project, findNode } = useVueFlow()

const isNew = computed(() => route.params.id === undefined)
const clientErrors = ref<string[]>([])

const name = ref('')
const priority = ref(0)
const active = ref(true)
const triggerRule = ref<ConditionRule | null>(null)

// F-WORKFLOW — a Entrada é um nó fixo, sempre presente e nunca removível: é
// o único ponto sem handle de destino. `flowNodes` mistura o nó de entrada
// (type 'entry') com os nós de operação (type 'operation') e de decisão
// (type 'decision') — o `type` do VueFlow (que escolhe o template de
// renderização) é diferente do `WorkflowNodeType` do domínio, guardado em
// `data.workflowType`.
const flowNodes = ref<Node<FlowNodeData>[]>([
  { id: 'entry', type: 'entry', position: { x: 40, y: 200 }, data: { workflowType: 'DESCARGA' } },
])
const flowEdges = ref<Edge[]>([])

onMounted(async () => {
  if (!isNew.value) {
    const template = await store.getTemplateById(route.params.id as string)
    name.value = template.name
    priority.value = template.priority
    active.value = template.active
    triggerRule.value = template.triggerRule

    flowNodes.value = template.nodes.map((n) => ({
      id: n.id,
      type: n.id === template.entryNodeId ? 'entry' : n.type === 'DECISAO' ? 'decision' : 'operation',
      position: { x: n.positionX, y: n.positionY },
      data: { workflowType: n.type, conditionRule: n.conditionRule, label: n.label },
    }))
    flowEdges.value = template.edges.map((e) => ({
      id: e.id,
      source: e.fromNodeId,
      target: e.toNodeId,
      sourceHandle: e.branch ?? undefined,
      type: 'smoothstep',
      label: e.branch ?? undefined,
    }))
  }
})

let nextNodeId = 1
function onDragStart(event: DragEvent, type: WorkflowNodeType): void {
  event.dataTransfer?.setData('application/workflow-node-type', type)
}

function onDrop(event: DragEvent): void {
  const type = event.dataTransfer?.getData('application/workflow-node-type') as WorkflowNodeType | undefined
  if (!type) return

  const position = project({ x: event.offsetX, y: event.offsetY })
  flowNodes.value.push({
    id: `node-${nextNodeId++}`,
    type: type === 'DECISAO' ? 'decision' : 'operation',
    position,
    data: { workflowType: type, conditionRule: type === 'DECISAO' ? null : undefined },
  })
}

function onConnect(connection: Connection): void {
  flowEdges.value.push({
    id: `edge-${connection.source}-${connection.target}-${connection.sourceHandle ?? ''}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle ?? undefined,
    type: 'smoothstep',
    label: connection.sourceHandle ?? undefined,
  })
}

const selectedNodeId = ref<string | null>(null)
const selectedNode = computed(() => (selectedNodeId.value ? findNode(selectedNodeId.value) : null))
const selectedNodeLabel = computed(() =>
  selectedNode.value ? WORKFLOW_NODE_LABELS[selectedNode.value.data.workflowType as WorkflowNodeType] : ''
)

function onNodeClick({ node }: { node: Node }): void {
  selectedNodeId.value = node.id
}

function removeSelectedNode(): void {
  if (!selectedNodeId.value || selectedNodeId.value === 'entry') return
  flowNodes.value = flowNodes.value.filter((n) => n.id !== selectedNodeId.value)
  flowEdges.value = flowEdges.value.filter(
    (e) => e.source !== selectedNodeId.value && e.target !== selectedNodeId.value
  )
  selectedNodeId.value = null
}

/**
 * F-WORKFLOW — validação no CLIENTE, mesma checagem conceitual do backend
 * (workflow-graph.service.ts, Task 3), como feedback imediato antes de
 * chamar a API. A validação VINCULANTE continua sendo a do backend — este
 * bloco só evita uma viagem de rede num erro óbvio (ex: nó de decisão sem
 * duas saídas), mesmo padrão já usado no resto do sistema (ex: quantidade
 * pendente no recebimento).
 */
function validateClientSide(): string[] {
  const errors: string[] = []
  const outgoingCount = new Map<string, number>()
  for (const edge of flowEdges.value) {
    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1)
  }

  for (const node of flowNodes.value) {
    const outgoing = outgoingCount.get(node.id) ?? 0
    if (node.type === 'decision' && outgoing !== 2) {
      errors.push(`O nó de decisão "${node.id}" precisa de exatamente duas saídas (Sim e Não).`)
    }
    if (node.data.workflowType === 'ALOCACAO' && outgoing > 0) {
      errors.push('O nó de Alocação não pode ter conexões saindo dele.')
    }
  }

  const hasAlocacao = flowNodes.value.some((n) => n.data.workflowType === 'ALOCACAO')
  if (!hasAlocacao) {
    errors.push('O fluxo precisa ter um nó de Alocação — é o passo final obrigatório.')
  }

  return errors
}

async function handleSave(): Promise<void> {
  clientErrors.value = validateClientSide()
  if (clientErrors.value.length > 0) return

  const dto: WorkflowTemplateDto = {
    name: name.value,
    priority: priority.value,
    active: active.value,
    triggerRule: triggerRule.value,
    entryClientId: 'entry',
    nodes: flowNodes.value.map((n) => ({
      clientId: n.id,
      type: n.data.workflowType,
      label: (n.data as { label?: string }).label ?? null,
      conditionRule: n.data.conditionRule ?? null,
      positionX: n.position.x,
      positionY: n.position.y,
    })),
    edges: flowEdges.value.map((e) => ({
      fromClientId: e.source,
      toClientId: e.target,
      branch: (e.sourceHandle as 'SIM' | 'NAO' | undefined) ?? null,
    })),
  }

  try {
    if (isNew.value) {
      await store.createTemplate(dto)
    } else {
      await store.updateTemplate(route.params.id as string, dto)
    }
    router.push('/wms/workflows')
  } catch (error: any) {
    clientErrors.value = [error?.response?.data?.message ?? 'Erro ao salvar o workflow.']
  }
}
</script>
```

- [ ] **Step 2: Rotas**

Em `frontend/src/router/index.ts`, adicionar junto à rota criada na Task 9:

```ts
{
  path: '/wms/workflows/new',
  name: 'wms-workflow-new',
  component: () => import('../views/wms/WorkflowTemplateEditorView.vue'),
  meta: { requiresAuth: true },
},
{
  path: '/wms/workflows/:id',
  name: 'wms-workflow-edit',
  component: () => import('../views/wms/WorkflowTemplateEditorView.vue'),
  meta: { requiresAuth: true },
},
```

(Registrar `/wms/workflows/new` ANTES de `/wms/workflows/:id` — mesma disciplina de rota fixa antes de paramétrica já usada no resto do router.)

- [ ] **Step 3: Teste — validação client-side**

Create `frontend/src/views/wms/__tests__/WorkflowTemplateEditorView.spec.ts` (foca só na função de validação client-side, que é a lógica testável sem montar o `<VueFlow>` inteiro — montar o componente completo exigiria mockar `useRoute`/`useVueFlow`/`ResizeObserver`, fora do escopo desta task; a cobertura de fluxo completo fica para verificação manual/E2E, registrada no Final check do plano):

```ts
import { describe, it, expect, vi } from 'vitest'

// F-WORKFLOW — NOTA PARA O IMPLEMENTADOR: extrair `validateClientSide` de
// WorkflowTemplateEditorView.vue para um módulo separado e testável
// isoladamente (ex: `frontend/src/views/wms/workflow-editor-validation.ts`,
// exportando `validateClientSide(nodes, edges): string[]` com a MESMA lógica
// que hoje está inline no <script setup>), e importar essa função de dentro
// do componente. Isso evita duplicar a lógica entre o componente e o teste, e
// evita ter que montar o <VueFlow> completo só para testar validação.

import { validateClientSide } from '../workflow-editor-validation'

describe('WorkflowTemplateEditorView — validateClientSide', () => {
  it('aceita um fluxo com Alocação e nenhuma decisão pendente', () => {
    const nodes = [
      { id: 'entry', type: 'entry', data: { workflowType: 'DESCARGA' } },
      { id: 'n2', type: 'operation', data: { workflowType: 'ALOCACAO' } },
    ]
    const edges = [{ id: 'e1', source: 'entry', target: 'n2' }]
    expect(validateClientSide(nodes as any, edges as any)).toEqual([])
  })

  it('rejeita nó de decisão sem duas saídas', () => {
    const nodes = [
      { id: 'entry', type: 'entry', data: { workflowType: 'DESCARGA' } },
      { id: 'n2', type: 'decision', data: { workflowType: 'DECISAO' } },
    ]
    const edges = [{ id: 'e1', source: 'entry', target: 'n2' }]
    const errors = validateClientSide(nodes as any, edges as any)
    expect(errors.some((e) => e.includes('duas saídas'))).toBe(true)
  })

  it('rejeita fluxo sem nenhum nó de Alocação', () => {
    const nodes = [{ id: 'entry', type: 'entry', data: { workflowType: 'DESCARGA' } }]
    const errors = validateClientSide(nodes as any, [])
    expect(errors.some((e) => e.includes('Alocação'))).toBe(true)
  })

  it('rejeita Alocação com conexão saindo', () => {
    const nodes = [
      { id: 'entry', type: 'entry', data: { workflowType: 'DESCARGA' } },
      { id: 'n2', type: 'operation', data: { workflowType: 'ALOCACAO' } },
      { id: 'n3', type: 'operation', data: { workflowType: 'DESCARGA' } },
    ]
    const edges = [
      { id: 'e1', source: 'entry', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ]
    const errors = validateClientSide(nodes as any, edges as any)
    expect(errors.some((e) => e.includes('Alocação não pode'))).toBe(true)
  })
})
```

Em `WorkflowTemplateEditorView.vue`, mover a função `validateClientSide` para `frontend/src/views/wms/workflow-editor-validation.ts` (mesma implementação do Step 1, exportada) e trocar a definição local por:

```ts
import { validateClientSide } from './workflow-editor-validation'
```

removendo a função `function validateClientSide(): string[] { ... }` do `<script setup>` — a chamada em `handleSave` passa a ser `validateClientSide(flowNodes.value, flowEdges.value)`.

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/views/wms/__tests__/WorkflowTemplateEditorView.spec.ts`
Expected: PASS — 4/4 testes.

- [ ] **Step 5: Type-check**

Run: `npx vue-tsc --noEmit`
Expected: mesma contagem de erros do baseline.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/views/wms/WorkflowTemplateEditorView.vue frontend/src/views/wms/workflow-editor-validation.ts frontend/src/views/wms/__tests__/WorkflowTemplateEditorView.spec.ts frontend/src/router/index.ts
git commit -m "feat(frontend): adiciona editor visual de workflow em canvas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Final check (após a Task 11, antes de finalizar a branch)

- [ ] Rodar a suíte completa do backend (`npm run test:integration`, de `backend/`) e confirmar zero regressão.
- [ ] Rodar `npx vue-tsc --noEmit` e `npx vitest run` completos (de `frontend/`) e confirmar zero regressão.
- [ ] Verificação manual/visual, de volta ao checkout principal com os containers Docker ativos (esta branch é desenvolvida em worktree isolado — ver `superpowers:using-git-worktrees`, sem acesso aos containers do dev stack): logar como admin, abrir `/wms/workflows`, criar um workflow com um nó de decisão (ex: peso > 500kg → Quarentena, senão → Alocação direto), salvar, registrar um recebimento de teste que bata com a condição e outro que não bata, e confirmar que a cadeia de `WarehouseTask` gerada corresponde ao fluxo desenhado.
- [ ] Confirmar visualmente que o canvas (paleta, nós, conexões, painel de configuração de decisão) está com a paleta de cores/tipografia do resto do sistema, não o tema default do `@vue-flow/core`.
