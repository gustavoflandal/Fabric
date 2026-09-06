import { readOnlyPrisma } from '../config/readonly-database';

/**
 * Catálogo FECHADO de consultas de estoque para o assistente de IA (Fase 2).
 * Só estas 3 funções — nada de SQL dinâmico. Todas usam `readOnlyPrisma`
 * exclusivamente (usuário MySQL GRANT SELECT apenas, ver
 * config/readonly-database.ts). Todas recebem CÓDIGOS de negócio (o que um
 * modelo consegue extrair de uma pergunta em linguagem natural), nunca UUIDs
 * internos.
 */

export type ConsultaErro = { erro: string };

export interface SaldoProdutoResult {
  codigoProduto: string;
  nomeProduto: string;
  quantidade: number;
  deposito: string | null;
}

export interface MovimentacaoResult {
  tipo: string;
  quantidade: number;
  motivo: string;
  referencia: string | null;
  data: Date;
}

export interface PosicaoCategoriaResult {
  codigoCategoria: string;
  nomeCategoria: string;
  quantidadeTotal: number;
  quantidadeProdutos: number;
}

const MAX_MOVIMENTACOES = 50;
const DEFAULT_MOVIMENTACOES = 10;

export async function getSaldoProduto(
  codigoProduto: string,
  codigoDeposito?: string
): Promise<SaldoProdutoResult | ConsultaErro> {
  const product = await readOnlyPrisma.product.findUnique({ where: { code: codigoProduto } });
  if (!product) {
    return { erro: 'produto_nao_encontrado' };
  }

  if (!codigoDeposito) {
    const balance = await readOnlyPrisma.stockBalance.findUnique({ where: { productId: product.id } });
    return {
      codigoProduto: product.code,
      nomeProduto: product.name,
      quantidade: balance?.quantity ?? 0,
      deposito: null,
    };
  }

  const positionBalances = await readOnlyPrisma.stockPositionBalance.findMany({
    where: { productId: product.id, storagePosition: { warehouseCode: codigoDeposito } },
    select: { quantity: true },
  });

  if (positionBalances.length === 0) {
    return { erro: 'deposito_nao_encontrado' };
  }

  const quantidade = positionBalances.reduce((sum, p) => sum + Number(p.quantity), 0);

  return {
    codigoProduto: product.code,
    nomeProduto: product.name,
    quantidade,
    deposito: codigoDeposito,
  };
}

export async function getMovimentacoesRecentes(
  codigoProduto: string,
  limite?: number
): Promise<MovimentacaoResult[] | ConsultaErro> {
  const product = await readOnlyPrisma.product.findUnique({ where: { code: codigoProduto } });
  if (!product) {
    return { erro: 'produto_nao_encontrado' };
  }

  const take = Math.min(limite && limite > 0 ? limite : DEFAULT_MOVIMENTACOES, MAX_MOVIMENTACOES);

  const movements = await readOnlyPrisma.stockMovement.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: 'desc' },
    take,
  });

  return movements.map((m) => ({
    tipo: m.type,
    quantidade: m.quantity,
    motivo: m.reason,
    referencia: m.reference,
    data: m.createdAt,
  }));
}

export async function getPosicaoEstoquePorCategoria(
  codigoCategoria: string
): Promise<PosicaoCategoriaResult | ConsultaErro> {
  const category = await readOnlyPrisma.productCategory.findUnique({
    where: { code: codigoCategoria },
    include: { products: { include: { stockBalance: true } } },
  });

  if (!category) {
    return { erro: 'categoria_nao_encontrada' };
  }

  const quantidadeTotal = category.products.reduce((sum, p) => sum + (p.stockBalance?.quantity ?? 0), 0);

  return {
    codigoCategoria: category.code,
    nomeCategoria: category.name,
    quantidadeTotal,
    quantidadeProdutos: category.products.length,
  };
}
