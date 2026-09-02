import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

/**
 * F1.3 e F1.4 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5,
 * Fase 1) — leitura do saldo por posição.
 *
 * A ESCRITA de `stock_position_balances` mora exclusivamente em
 * `stock.service.ts::applyMovement()`, que é onde estão a transação, o lock
 * pessimista e a ordem determinística de travamento. Este service é só leitura
 * e reconciliação — se algum dia precisar escrever saldo, o caminho é chamar
 * `stockService.registerMovement*()`, nunca dar update direto aqui.
 *
 * SERIALIZAÇÃO (decisão D2, seção 4.4): `quantity` é `Decimal(18,4)`, não
 * `Float`. `Prisma.Decimal` não é um number JS, e converter para number na
 * borda da API jogaria fora justamente a precisão pela qual a coluna foi criada
 * assim. Portanto **todo endpoint desta fase expõe quantidade como STRING**
 * (`Decimal.toString()`, ex.: `"12.5"` — sem zeros à direita, é o valor
 * decimal exato). É o cuidado que a decisão D2 antecipa para os endpoints novos,
 * e o frontend (F1.6) já nascerá ciente disso. Os endpoints ANTIGOS de estoque
 * continuam devolvendo number — eles leem `stock_balances`, que segue `Float`.
 */

/** Tolerância de comparação entre a soma (DECIMAL) e o agregado (DOUBLE). */
// O agregado `stock_balances.quantity` ainda é DOUBLE (dívida do item 4.1 do
// cronograma, adiada com justificativa) e a soma por posição é DECIMAL(18,4).
// Comparar os dois com `>` puro faria um ruído de ponto flutuante da ordem de
// 1e-12 virar "divergência". A tolerância é 1 unidade da última casa que o
// DECIMAL(18,4) representa: qualquer diferença menor que isso não é
// representável como quantidade real, é ruído.
const DIVERGENCE_TOLERANCE = 0.0001;

const serializeQuantity = (value: Prisma.Decimal): string => value.toString();

const positionSelect = {
  id: true,
  code: true,
  warehouseCode: true,
  streetCode: true,
  floor: true,
  position: true,
  positionType: true,
  blocked: true,
  structureId: true,
} as const;

const productSelect = {
  id: true,
  code: true,
  name: true,
  type: true,
} as const;

/**
 * F1.4 — saldo de um produto detalhado por posição.
 * Só posições com linha de saldo aparecem; a soma delas pode ser MENOR que o
 * saldo agregado (a diferença é o saldo ainda não endereçado — ver a nota em
 * `getDivergences`).
 */
export const getBalancesByProduct = async (productId: string) => {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { ...productSelect, stockBalance: { select: { quantity: true } } },
  });

  if (!product) {
    throw new AppError(404, 'Produto não encontrado');
  }

  const rows = await prisma.stockPositionBalance.findMany({
    where: { productId },
    include: {
      storagePosition: {
        select: {
          ...positionSelect,
          structure: { select: { id: true, streetCode: true, warehouseId: true } },
        },
      },
    },
    orderBy: { storagePosition: { code: 'asc' } },
  });

  const addressedQty = rows.reduce(
    (sum, row) => sum.plus(row.quantity),
    new Prisma.Decimal(0)
  );
  const aggregateQty = product.stockBalance?.quantity ?? 0;

  const { stockBalance, ...productData } = product;

  return {
    product: productData,
    // Saldo agregado (`stock_balances`) — number, contrato antigo preservado.
    aggregateQuantity: aggregateQty,
    // Soma do que está endereçado — string (Decimal, ver nota de serialização).
    addressedQuantity: serializeQuantity(addressedQty),
    // Parcela ainda não endereçada, explícita em vez de deixada para o
    // consumidor deduzir. Ver `getDivergences` para o porquê de ela existir.
    unaddressedQuantity: serializeQuantity(
      new Prisma.Decimal(aggregateQty).minus(addressedQty)
    ),
    positions: rows.map((row) => ({
      storagePositionId: row.storagePositionId,
      position: row.storagePosition,
      quantity: serializeQuantity(row.quantity),
      version: row.version,
      updatedAt: row.updatedAt,
    })),
  };
};

/**
 * F1.4 — saldo de uma posição específica: todos os produtos que estão ali.
 */
export const getBalancesByPosition = async (storagePositionId: string) => {
  const position = await prisma.storagePosition.findUnique({
    where: { id: storagePositionId },
    select: {
      ...positionSelect,
      structure: {
        select: {
          id: true,
          streetCode: true,
          warehouse: { select: { id: true, code: true, name: true } },
        },
      },
    },
  });

  if (!position) {
    throw new AppError(404, 'Posição de armazenagem não encontrada');
  }

  const rows = await prisma.stockPositionBalance.findMany({
    where: { storagePositionId },
    include: { product: { select: productSelect } },
    orderBy: { product: { code: 'asc' } },
  });

  return {
    position,
    // Ocupação derivada do saldo, não de flag (decisão D3: `occupied` foi
    // removido na F0.4 justamente para não haver duas versões da verdade).
    occupied: rows.some((row) => row.quantity.greaterThan(0)),
    products: rows.map((row) => ({
      product: row.product,
      quantity: serializeQuantity(row.quantity),
      version: row.version,
      updatedAt: row.updatedAt,
    })),
  };
};

/**
 * F1.4 — posições OCUPADAS (saldo > 0) de um armazém ou de uma estrutura.
 *
 * Filtro obrigatório (um dos dois): sem escopo, esta consulta varreria o
 * armazém inteiro de uma instalação grande a cada chamada. Exigir o escopo é
 * mais honesto que paginar um resultado que ninguém quer inteiro.
 */
export const getOccupiedPositions = async (filters: {
  warehouseId?: string;
  structureId?: string;
}) => {
  const { warehouseId, structureId } = filters;

  if (!warehouseId && !structureId) {
    throw new AppError(400, 'Informe warehouseId ou structureId');
  }

  // `structureId` tem precedência quando os dois vêm: é o recorte mais estreito.
  if (structureId) {
    const structure = await prisma.warehouseStructure.findUnique({
      where: { id: structureId },
      select: { id: true },
    });
    if (!structure) {
      throw new AppError(404, 'Estrutura de armazém não encontrada');
    }
  } else if (warehouseId) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true },
    });
    if (!warehouse) {
      throw new AppError(404, 'Armazém não encontrado');
    }
  }

  const rows = await prisma.stockPositionBalance.findMany({
    where: {
      quantity: { gt: 0 },
      storagePosition: structureId ? { structureId } : { structure: { warehouseId } },
    },
    include: {
      product: { select: productSelect },
      storagePosition: { select: positionSelect },
    },
    orderBy: [{ storagePosition: { code: 'asc' } }, { product: { code: 'asc' } }],
  });

  // Agrupa por posição em memória: a query já vem ordenada por código de
  // posição e o recorte é sempre um armazém/estrutura, então o volume aqui é o
  // de um armazém, não o da base inteira.
  const byPosition = new Map<
    string,
    {
      position: (typeof rows)[number]['storagePosition'];
      totalQuantity: Prisma.Decimal;
      products: { product: (typeof rows)[number]['product']; quantity: string }[];
    }
  >();

  for (const row of rows) {
    let entry = byPosition.get(row.storagePositionId);
    if (!entry) {
      entry = {
        position: row.storagePosition,
        totalQuantity: new Prisma.Decimal(0),
        products: [],
      };
      byPosition.set(row.storagePositionId, entry);
    }
    entry.totalQuantity = entry.totalQuantity.plus(row.quantity);
    entry.products.push({ product: row.product, quantity: serializeQuantity(row.quantity) });
  }

  return [...byPosition.values()].map((entry) => ({
    position: entry.position,
    totalQuantity: serializeQuantity(entry.totalQuantity),
    products: entry.products,
  }));
};

export interface PositionBalanceDivergence {
  productId: string;
  productCode: string;
  productName: string;
  /** Saldo agregado em `stock_balances` (Float, contrato antigo). */
  aggregateQuantity: number;
  /** SUM(`stock_position_balances.quantity`) do produto, como string. */
  addressedQuantity: string;
  /** Excesso endereçado sobre o agregado (sempre > 0 numa divergência). */
  difference: string;
}

/**
 * F1.3 — invariante de consistência entre o saldo por posição e o agregado.
 *
 * A regra desta fase é `SUM(StockPositionBalance.quantity) <= StockBalance.quantity`
 * por produto, e **não** `==`. O motivo é concreto: nenhum fluxo de produção
 * informa posição ainda (recebimento, contagem, reserva de produção e as
 * entradas/saídas manuais chamam `applyMovement` sem `positionId`), então o
 * normal, hoje, é o agregado ser MAIOR que a soma endereçada. Essa diferença é
 * saldo legítimo "não endereçado", e vai encolhendo à medida que as fases 2 a 4
 * conectarem cada fluxo ao endereço. Exigir `==` agora acusaria a base inteira
 * como divergente todo dia.
 *
 * O que é divergência de verdade é o outro lado: `SUM > agregado` significa que
 * há mais material endereçado do que existe no produto — ou seja, saldo por
 * posição e roll-up saíram de sincronia, o que só pode ter acontecido por
 * escrita fora de `applyMovement()`. Isso é bug, e é o que este relatório
 * reporta.
 *
 * Quando a Fase 4 fechar o ciclo e todo movimento nascer endereçado, esta
 * checagem deve endurecer para `==` (e a parcela não endereçada vira zero).
 */
export const getDivergences = async (): Promise<PositionBalanceDivergence[]> => {
  // SQL cru em vez de groupBy do Prisma: a comparação é entre um agregado desta
  // tabela e uma coluna de OUTRA tabela, o que o `having` do Prisma não
  // expressa — sem isso seria preciso trazer a soma de todos os produtos para
  // a aplicação e filtrar em memória.
  const rows = await prisma.$queryRaw<
    {
      productId: string;
      productCode: string;
      productName: string;
      aggregateQuantity: number | null;
      addressedQuantity: Prisma.Decimal;
    }[]
  >`
    SELECT
      p.id                        AS productId,
      p.code                      AS productCode,
      p.name                      AS productName,
      sb.quantity                 AS aggregateQuantity,
      SUM(spb.quantity)           AS addressedQuantity
    FROM stock_position_balances spb
    INNER JOIN products p       ON p.id = spb.productId
    LEFT  JOIN stock_balances sb ON sb.productId = spb.productId
    GROUP BY p.id, p.code, p.name, sb.quantity
    HAVING SUM(spb.quantity) - COALESCE(sb.quantity, 0) > ${DIVERGENCE_TOLERANCE}
    ORDER BY p.code
  `;

  return rows.map((row) => {
    const aggregate = Number(row.aggregateQuantity ?? 0);
    const addressed = new Prisma.Decimal(row.addressedQuantity);

    return {
      productId: row.productId,
      productCode: row.productCode,
      productName: row.productName,
      aggregateQuantity: aggregate,
      addressedQuantity: serializeQuantity(addressed),
      difference: serializeQuantity(addressed.minus(aggregate)),
    };
  });
};

export default {
  getBalancesByProduct,
  getBalancesByPosition,
  getOccupiedPositions,
  getDivergences,
};
