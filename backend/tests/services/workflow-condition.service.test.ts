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
