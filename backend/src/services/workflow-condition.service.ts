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
