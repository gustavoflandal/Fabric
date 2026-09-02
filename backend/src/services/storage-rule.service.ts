import { PositionType, Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

type TransactionClient = Prisma.TransactionClient;
type DbClient = TransactionClient | typeof prisma;

/**
 * F4.6 do plano do WMS (WMS_IMPLEMENTATION_ANALYSIS.md, seção 5, Fase 4).
 *
 * DUAS responsabilidades, e a segunda é a que importa:
 *
 *   1. CRUD de `StorageRule` (regra de endereçamento por produto ou categoria).
 *   2. `suggestPosition()` — dado produto + quantidade, QUAL endereço usar.
 *
 * O SERVIÇO SUGERE, NÃO IMPÕE (requisito explícito de F4.6). Quem endereça
 * (`POST /warehouse-tasks/:id/putaway`, F4.5, já existente) continua aceitando
 * qualquer posição que o operador informar — a sugestão é o valor que o coletor
 * mostra pré-preenchido, não uma trava. O motivo é operacional, não técnico: o
 * operador enxerga o palete e o corredor, o sistema enxerga colunas; quando os
 * dois discordam num armazém real, quem está certo é quase sempre o operador. O
 * que o sistema NÃO abre mão (e continua barrando em `completePutaway`) é
 * posição bloqueada — isso não é preferência, é interdição.
 *
 * DIREÇÃO DE IMPORT: este arquivo importa `prisma` e mais nada de domínio. Ele é
 * consumido por `warehouse-task.service.ts` (resolução da quarentena) e pelo
 * controller de regras. Não importa `stock.service` nem `warehouse-task.service`
 * — manter isto como folha é o que permite chamá-lo de dentro de qualquer
 * transação sem risco de ciclo de módulos.
 */

export interface StorageRuleDto {
  productId?: string | null;
  categoryId?: string | null;
  positionType?: PositionType | null;
  priority?: number;
  requiresQuarantine?: boolean;
  active?: boolean;
}

/**
 * A invariante de escopo: EXATAMENTE UM entre produto e categoria.
 *
 * Regra com os dois preenchidos é ambígua (a categoria do produto pode nem ser
 * a categoria da regra) e regra com nenhum dos dois é uma regra global
 * disfarçada — se um dia houver caso de uso para "regra padrão da instalação",
 * ela deve ser um conceito explícito, não o efeito colateral de dois campos
 * nulos. Ver a nota no `schema.prisma` sobre por que isto não é um CHECK.
 */
const assertScope = (data: { productId?: string | null; categoryId?: string | null }) => {
  const hasProduct = Boolean(data.productId);
  const hasCategory = Boolean(data.categoryId);

  if (hasProduct && hasCategory) {
    throw new AppError(
      400,
      'Regra de armazenagem tem escopo de PRODUTO ou de CATEGORIA, nunca os dois — ' +
        'informe apenas um.'
    );
  }

  if (!hasProduct && !hasCategory) {
    throw new AppError(
      400,
      'Regra de armazenagem precisa de um escopo: informe productId ou categoryId.'
    );
  }
};

const ruleSelect = {
  id: true,
  productId: true,
  categoryId: true,
  positionType: true,
  priority: true,
  requiresQuarantine: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  product: { select: { id: true, code: true, name: true } },
  category: { select: { id: true, code: true, name: true } },
} as const;

export const createRule = async (data: StorageRuleDto) => {
  assertScope(data);

  if (data.productId) {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      select: { id: true },
    });
    if (!product) {
      throw new AppError(404, 'Produto não encontrado');
    }
  }

  if (data.categoryId) {
    const category = await prisma.productCategory.findUnique({
      where: { id: data.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new AppError(404, 'Categoria de produto não encontrada');
    }
  }

  return prisma.storageRule.create({
    data: {
      productId: data.productId ?? null,
      categoryId: data.categoryId ?? null,
      positionType: data.positionType ?? null,
      priority: data.priority ?? 0,
      requiresQuarantine: data.requiresQuarantine ?? false,
      active: data.active ?? true,
    },
    select: ruleSelect,
  });
};

export const listRules = async (filters?: {
  productId?: string;
  categoryId?: string;
  active?: boolean;
}) => {
  return prisma.storageRule.findMany({
    where: {
      ...(filters?.productId ? { productId: filters.productId } : {}),
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters?.active !== undefined ? { active: filters.active } : {}),
    },
    select: ruleSelect,
    // Mesma ordenação da resolução (ver `resolveRules`): produto antes de
    // categoria, prioridade maior antes. A tela do supervisor lê a lista na
    // ordem em que a regra é de fato aplicada — não numa ordem qualquer que
    // depois confunde quem tenta entender por que a sugestão saiu diferente.
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });
};

export const updateRule = async (id: string, data: StorageRuleDto) => {
  const existing = await prisma.storageRule.findUnique({
    where: { id },
    select: { id: true, productId: true, categoryId: true },
  });

  if (!existing) {
    throw new AppError(404, 'Regra de armazenagem não encontrada');
  }

  // O escopo é validado sobre o resultado do merge, não sobre o corpo: um PUT
  // que só manda `categoryId` numa regra que já tem `productId` produziria uma
  // regra com os dois preenchidos, e checar só o corpo deixaria passar.
  const merged = {
    productId: data.productId !== undefined ? data.productId : existing.productId,
    categoryId: data.categoryId !== undefined ? data.categoryId : existing.categoryId,
  };
  assertScope(merged);

  return prisma.storageRule.update({
    where: { id },
    data: {
      ...(data.productId !== undefined ? { productId: data.productId } : {}),
      ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
      ...(data.positionType !== undefined ? { positionType: data.positionType } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.requiresQuarantine !== undefined
        ? { requiresQuarantine: data.requiresQuarantine }
        : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
    select: ruleSelect,
  });
};

export const deleteRule = async (id: string) => {
  const existing = await prisma.storageRule.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(404, 'Regra de armazenagem não encontrada');
  }

  await prisma.storageRule.delete({ where: { id } });
};

// ============================================================================
// RESOLUÇÃO DE REGRA
// ============================================================================

type ResolvedRule = {
  id: string;
  positionType: PositionType | null;
  priority: number;
  requiresQuarantine: boolean;
  scope: 'PRODUCT' | 'CATEGORY';
};

/**
 * As regras aplicáveis a um produto, JÁ NA ORDEM DE PRECEDÊNCIA:
 *
 *   1. regras do próprio produto, `priority` DESC;
 *   2. regras da categoria do produto, `priority` DESC.
 *
 * Produto ganha de categoria SEMPRE, mesmo com prioridade menor — a
 * especificidade é o critério primário e a prioridade só desempata dentro do
 * mesmo escopo. Sem essa hierarquia, uma regra de categoria com `priority` alta
 * silenciosamente sequestraria a regra escrita para um produto específico, que
 * é justamente a exceção que alguém se deu ao trabalho de cadastrar.
 *
 * Aceita `db` para poder ser chamado de dentro da transação de criação do
 * recebimento (resolução da quarentena) sem abrir uma segunda conexão.
 */
export const resolveRules = async (
  db: DbClient,
  productId: string
): Promise<ResolvedRule[]> => {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, categoryId: true },
  });

  if (!product) {
    return [];
  }

  const rules = await db.storageRule.findMany({
    where: {
      active: true,
      OR: [
        { productId: product.id },
        ...(product.categoryId ? [{ categoryId: product.categoryId }] : []),
      ],
    },
    select: {
      id: true,
      productId: true,
      categoryId: true,
      positionType: true,
      priority: true,
      requiresQuarantine: true,
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  const scoped = rules.map((rule) => ({
    id: rule.id,
    positionType: rule.positionType,
    priority: rule.priority,
    requiresQuarantine: rule.requiresQuarantine,
    scope: (rule.productId ? 'PRODUCT' : 'CATEGORY') as 'PRODUCT' | 'CATEGORY',
  }));

  // Ordenação estável em memória (produto antes de categoria), preservando o
  // `priority DESC` que o banco já aplicou dentro de cada grupo.
  return [
    ...scoped.filter((r) => r.scope === 'PRODUCT'),
    ...scoped.filter((r) => r.scope === 'CATEGORY'),
  ];
};

/**
 * F4.6 — RESOLUÇÃO DA QUARENTENA, o `// TODO Fase 4b` que a Fase 4a deixou
 * aberto em `warehouse-task.service.ts`.
 *
 * O problema da Fase 4a era a ausência de um lugar onde declarar "este material
 * precisa de inspeção antes de ser endereçado". `StorageRule.requiresQuarantine`
 * é esse lugar; a decisão passa a ser:
 *
 *   * existe regra aplicável ao produto (ou à sua categoria)? A regra MAIS
 *     ESPECÍFICA E DE MAIOR PRIORIDADE decide — é `resolveRules()[0]`.
 *   * NÃO existe regra nenhuma? Gera QUARENTENA, como na Fase 4a.
 *
 * Por que o fallback continua sendo "gera": o argumento da Fase 4a não mudou —
 * pular uma inspeção necessária põe material não conferido no estoque
 * disponível; executar uma inspeção dispensável é um toque a mais no coletor.
 * O que mudou, e é o ponto do item, é que agora existe COMO desligar: antes o
 * comportamento era inatingível por configuração, agora é o default de um
 * sistema não configurado.
 *
 * DECISÃO SOBRE O RECEBIMENTO INTEIRO, não por item: a cadeia de tarefas é do
 * recebimento (F4.3), e um único item que exija inspeção quarentena a carga —
 * separar fisicamente meio palete para inspecionar só uma parte não é o
 * processo que a cadeia modela. Daí o "algum produto exige" abaixo.
 */
export const resolveQuarantineRequirement = async (
  db: DbClient,
  productIds: string[]
): Promise<boolean> => {
  const unique = [...new Set(productIds)];

  if (unique.length === 0) {
    return true;
  }

  for (const productId of unique) {
    const rules = await resolveRules(db, productId);

    if (rules.length === 0) {
      // Sem sinal nenhum sobre este produto: default seguro.
      return true;
    }

    if (rules[0].requiresQuarantine) {
      return true;
    }
  }

  return false;
};

// ============================================================================
// SUGESTÃO DE POSIÇÃO
// ============================================================================

export interface PositionSuggestion {
  positionId: string;
  code: string;
  positionType: PositionType;
  currentQuantity: string;
  score: number;
  reasons: string[];
}

export interface SuggestPositionResult {
  productId: string;
  quantity: string;
  /** Regra que produziu as candidatas (null = nenhuma regra cadastrada). */
  appliedRuleId: string | null;
  suggestion: PositionSuggestion | null;
  /** Alternativas viáveis, já ordenadas — o coletor mostra as 3 primeiras. */
  alternatives: PositionSuggestion[];
  /** Por que cada posição descartada foi descartada (diagnóstico do supervisor). */
  rejected: { code: string; reason: string }[];
}

/** Quantas alternativas acompanham a sugestão. Payload de coletor é pequeno. */
const MAX_ALTERNATIVES = 3;

type CandidatePosition = {
  id: string;
  code: string;
  positionType: PositionType;
  weightCapacity: number | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  maxHeight: number | null;
};

/**
 * F4.6 — a sugestão de endereço.
 *
 * ORDEM DE APLICAÇÃO (é a ordem que o item do plano pede, nesta sequência):
 *
 *   1. **Regra** (`StorageRule`): produto antes de categoria, prioridade DESC.
 *      A primeira regra que produzir ao menos UMA posição viável vence; regra
 *      que não produz nenhuma candidata cede a vez para a seguinte, em vez de
 *      fazer a sugestão inteira falhar. Uma regra que aponta para um tipo de
 *      posição lotado é uma regra sem resposta hoje, não uma regra errada.
 *      Sem nenhuma regra cadastrada, TODAS as posições não bloqueadas são
 *      candidatas — ausência de regra não é proibição.
 *   2. **Capacidade**, cruzando os dois lados que a Fase 0 criou justamente
 *      para isto: `StoragePosition` (peso, dimensão) × `Product` (peso
 *      unitário, empilhamento, dimensão). Ver `evaluateCapacity()`.
 *   3. **Segregação**: posição ocupada por grupo INCOMPATÍVEL é descartada;
 *      posição ocupada pelo MESMO grupo é preferida.
 *
 * DEFINIÇÃO DE "INCOMPATÍVEL" (decisão desta fase, registrada porque é o ponto
 * em que seria fácil inventar demais): grupo DIFERENTE e NÃO-NULO. Ou seja,
 * `ALIMENTO` não entra numa posição que já tem `QUIMICO`, mas entra numa
 * posição que tem produto sem grupo declarado. Uma matriz de compatibilidade
 * par-a-par (`ALIMENTO` × `QUIMICO` = proibido, `ALIMENTO` × `EMBALAGEM` = ok)
 * seria mais expressiva e é o que um WMS maduro tem — mas ninguém pediu, ela
 * exigiria um segundo model para ser configurável e, sem configuração, seria
 * uma tabela de constantes chutada por quem escreveu o código. A regra simples
 * é conservadora na direção certa: no máximo ela deixa de sugerir uma posição
 * que serviria.
 *
 * PRODUTO SEM DADO FÍSICO (o caso comum de quem acabou de licenciar o WMS):
 * `Product.weight`/`maxStackQty`/dimensões são opcionais desde F0.9. Campo nulo
 * significa "não sei", e "não sei" NÃO reprova a posição — reprovar tudo por
 * falta de cadastro tornaria a sugestão inútil exatamente para quem mais
 * precisa dela. O que o campo nulo faz é não somar ponto: a posição passa, mas
 * sem a confirmação de que cabe.
 */
export const suggestPosition = async (
  productId: string,
  quantity: number | Prisma.Decimal
): Promise<SuggestPositionResult> => {
  const requested = new Prisma.Decimal(quantity);

  if (requested.lessThanOrEqualTo(0)) {
    throw new AppError(400, 'Quantidade para sugestão deve ser maior que zero');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      code: true,
      categoryId: true,
      weight: true,
      width: true,
      height: true,
      depth: true,
      maxStackQty: true,
      segregationGroup: true,
    },
  });

  if (!product) {
    throw new AppError(404, 'Produto não encontrado');
  }

  const rules = await resolveRules(prisma, product.id);

  // Cada "tentativa" é uma regra; a última é o fallback sem regra nenhuma.
  const attempts: { ruleId: string | null; positionType: PositionType | null }[] =
    rules.length > 0
      ? rules.map((rule) => ({ ruleId: rule.id, positionType: rule.positionType }))
      : [{ ruleId: null, positionType: null }];

  const rejected: { code: string; reason: string }[] = [];

  for (const attempt of attempts) {
    const candidates = await prisma.storagePosition.findMany({
      where: {
        blocked: false,
        ...(attempt.positionType ? { positionType: attempt.positionType } : {}),
      },
      select: {
        id: true,
        code: true,
        positionType: true,
        weightCapacity: true,
        height: true,
        width: true,
        depth: true,
        maxHeight: true,
      },
      // Ordem determinística de desempate: duas posições com o mesmo score
      // sempre saem na mesma ordem entre duas chamadas, senão a tela do
      // operador "dança" a cada refresh (mesma preocupação de `listByReceipt`).
      orderBy: { code: 'asc' },
    });

    if (candidates.length === 0) {
      continue;
    }

    const scored = await scoreCandidates(product, requested, candidates, rejected);

    if (scored.length > 0) {
      return {
        productId: product.id,
        quantity: requested.toString(),
        appliedRuleId: attempt.ruleId,
        suggestion: scored[0],
        alternatives: scored.slice(1, 1 + MAX_ALTERNATIVES),
        rejected,
      };
    }
  }

  return {
    productId: product.id,
    quantity: requested.toString(),
    appliedRuleId: null,
    suggestion: null,
    alternatives: [],
    rejected,
  };
};

/**
 * Avalia e pontua as candidatas de uma tentativa. Devolve só as VIÁVEIS, da
 * melhor para a pior; as descartadas vão para `rejected` com o motivo.
 *
 * O SCORE (maior é melhor), e a razão de cada peso:
 *
 *   +100  já tem ESTE produto              consolidar é o ganho operacional
 *                                          maior: menos endereços para o mesmo
 *                                          SKU = picking mais curto e contagem
 *                                          mais barata.
 *   + 50  já tem o MESMO grupo de segregação  mantém o armazém setorizado sem
 *                                          precisar de uma regra por produto.
 *   + 25  posição VAZIA                    melhor que ocupada por grupo neutro
 *                                          (não cria mistura nova), pior que
 *                                          consolidar.
 *   + 10  capacidade de peso CONFIRMADA    desempate a favor de quem tem dado
 *   +  5  empilhamento CONFIRMADO          cadastrado — sem virar requisito.
 *
 * Os pesos são deliberadamente espaçados por ordem de grandeza: nenhuma soma de
 * critérios fracos reverte um critério forte (consolidação nunca perde para
 * "tem peso cadastrado"), então o resultado é explicável em uma frase, que é o
 * que o supervisor precisa ao contestar uma sugestão.
 */
const scoreCandidates = async (
  product: {
    id: string;
    weight: number | null;
    width: number | null;
    height: number | null;
    depth: number | null;
    maxStackQty: number | null;
    segregationGroup: string | null;
  },
  requested: Prisma.Decimal,
  candidates: CandidatePosition[],
  rejected: { code: string; reason: string }[]
): Promise<PositionSuggestion[]> => {
  const positionIds = candidates.map((c) => c.id);

  // Ocupação atual de TODAS as candidatas numa consulta só (a alternativa
  // óbvia — uma consulta por posição dentro do laço — é o N+1 que a Fase 1 já
  // eliminou do saldo por endereço).
  const balances = await prisma.stockPositionBalance.findMany({
    where: { storagePositionId: { in: positionIds }, quantity: { gt: 0 } },
    select: {
      storagePositionId: true,
      productId: true,
      quantity: true,
      product: { select: { weight: true, segregationGroup: true } },
    },
  });

  const occupancy = new Map<
    string,
    {
      totalWeight: Prisma.Decimal;
      sameProductQty: Prisma.Decimal;
      groups: Set<string>;
      occupied: boolean;
    }
  >();

  for (const position of candidates) {
    occupancy.set(position.id, {
      totalWeight: new Prisma.Decimal(0),
      sameProductQty: new Prisma.Decimal(0),
      groups: new Set<string>(),
      occupied: false,
    });
  }

  for (const balance of balances) {
    const entry = occupancy.get(balance.storagePositionId);
    if (!entry) continue;

    entry.occupied = true;

    if (balance.product.weight !== null) {
      entry.totalWeight = entry.totalWeight.plus(
        new Prisma.Decimal(balance.product.weight).times(balance.quantity)
      );
    }

    if (balance.productId === product.id) {
      entry.sameProductQty = entry.sameProductQty.plus(balance.quantity);
    }

    if (balance.product.segregationGroup) {
      entry.groups.add(balance.product.segregationGroup);
    }
  }

  const viable: PositionSuggestion[] = [];

  for (const position of candidates) {
    const entry = occupancy.get(position.id)!;
    const reasons: string[] = [];
    let score = 0;

    // ---- SEGREGAÇÃO -------------------------------------------------------
    // "Incompatível" = grupo diferente e não-nulo (ver a nota do cabeçalho).
    const incompatible = [...entry.groups].filter(
      (group) => group !== product.segregationGroup
    );

    if (incompatible.length > 0) {
      rejected.push({
        code: position.code,
        reason: `ocupada por grupo de segregação incompatível (${incompatible.join(', ')})`,
      });
      continue;
    }

    // ---- CAPACIDADE DE PESO ----------------------------------------------
    if (product.weight !== null && position.weightCapacity !== null) {
      const addedWeight = new Prisma.Decimal(product.weight).times(requested);
      const projected = entry.totalWeight.plus(addedWeight);

      if (projected.greaterThan(new Prisma.Decimal(position.weightCapacity))) {
        rejected.push({
          code: position.code,
          reason:
            `capacidade de peso excedida (${projected.toFixed(2)} kg > ` +
            `${position.weightCapacity} kg)`,
        });
        continue;
      }

      score += 10;
      reasons.push(
        `peso projetado ${projected.toFixed(2)} kg de ${position.weightCapacity} kg`
      );
    }

    // ---- EMPILHAMENTO -----------------------------------------------------
    // `maxStackQty` é "quantas unidades podem ser empilhadas" (F0.9) — o teto é
    // por POSIÇÃO, então o que conta é o saldo do MESMO produto já ali mais o
    // que se pretende colocar.
    if (product.maxStackQty !== null) {
      const projectedQty = entry.sameProductQty.plus(requested);

      if (projectedQty.greaterThan(new Prisma.Decimal(product.maxStackQty))) {
        rejected.push({
          code: position.code,
          reason:
            `empilhamento máximo excedido (${projectedQty.toString()} > ` +
            `${product.maxStackQty})`,
        });
        continue;
      }

      score += 5;
      reasons.push(`empilhamento ${projectedQty.toString()}/${product.maxStackQty}`);
    }

    // ---- DIMENSÃO ---------------------------------------------------------
    // Checagem UNITÁRIA: uma unidade do produto cabe no vão da posição? Não é
    // um cálculo de cubagem (quantas cabem) — isso dependeria de padrão de
    // paletização e orientação, que o cadastro não tem. O que esta checagem
    // pega é o erro grosseiro e caro: mandar uma peça de 3 m para uma posição
    // de 1,2 m. `maxHeight` (altura útil) tem precedência sobre `height`
    // (altura do vão) quando as duas existem, que é a semântica que a Fase 0
    // deu aos campos.
    const dimensionFailure = checkDimensions(product, position);
    if (dimensionFailure) {
      rejected.push({ code: position.code, reason: dimensionFailure });
      continue;
    }

    // ---- PREFERÊNCIAS -----------------------------------------------------
    if (entry.sameProductQty.greaterThan(0)) {
      score += 100;
      reasons.push('já contém este produto (consolidação)');
    } else if (product.segregationGroup && entry.groups.has(product.segregationGroup)) {
      score += 50;
      reasons.push(`já contém o grupo de segregação ${product.segregationGroup}`);
    } else if (!entry.occupied) {
      score += 25;
      reasons.push('posição vazia');
    }

    viable.push({
      positionId: position.id,
      code: position.code,
      positionType: position.positionType,
      currentQuantity: entry.sameProductQty.toString(),
      score,
      reasons,
    });
  }

  // `code` como desempate final mantém a saída determinística (as candidatas já
  // chegaram ordenadas por código, mas `sort` do JS só é estável por
  // especificação a partir do ES2019 — depender disso implicitamente seria
  // frágil).
  return viable.sort((a, b) => b.score - a.score || (a.code < b.code ? -1 : 1));
};

const checkDimensions = (
  product: { width: number | null; height: number | null; depth: number | null },
  position: {
    width: number | null;
    height: number | null;
    depth: number | null;
    maxHeight: number | null;
  }
): string | null => {
  const usableHeight = position.maxHeight ?? position.height;

  const checks: [string, number | null, number | null][] = [
    ['largura', product.width, position.width],
    ['altura', product.height, usableHeight],
    ['profundidade', product.depth, position.depth],
  ];

  for (const [label, productValue, positionValue] of checks) {
    if (productValue !== null && positionValue !== null && productValue > positionValue) {
      return `${label} do produto (${productValue} m) não cabe na posição (${positionValue} m)`;
    }
  }

  return null;
};

export default {
  createRule,
  listRules,
  updateRule,
  deleteRule,
  resolveRules,
  resolveQuarantineRequirement,
  suggestPosition,
};
