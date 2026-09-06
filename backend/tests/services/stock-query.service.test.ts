import { readOnlyPrisma } from '../../src/config/readonly-database';
import {
  getSaldoProduto,
  getMovimentacoesRecentes,
  getPosicaoEstoquePorCategoria,
} from '../../src/services/stock-query.service';

jest.mock('../../src/config/readonly-database', () => ({
  readOnlyPrisma: {
    product: { findUnique: jest.fn() },
    stockBalance: { findUnique: jest.fn() },
    stockPositionBalance: { findMany: jest.fn() },
    stockMovement: { findMany: jest.fn() },
    productCategory: { findUnique: jest.fn() },
    storagePosition: { findFirst: jest.fn() },
  },
}));

const mockedPrisma = readOnlyPrisma as jest.Mocked<any>;

describe('stock-query.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSaldoProduto', () => {
    it('retorna erro estruturado quando o produto não existe', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue(null);

      const result = await getSaldoProduto('INEXISTENTE');

      expect(result).toEqual({ erro: 'produto_nao_encontrado' });
    });

    it('sem codigoDeposito retorna o saldo total de StockBalance', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue({ id: 'p1', code: 'PROD-001', name: 'Produto 1' });
      mockedPrisma.stockBalance.findUnique.mockResolvedValue({ quantity: 42 });

      const result = await getSaldoProduto('PROD-001');

      expect(result).toEqual({ codigoProduto: 'PROD-001', nomeProduto: 'Produto 1', quantidade: 42, deposito: null });
      expect(mockedPrisma.stockBalance.findUnique).toHaveBeenCalledWith({ where: { productId: 'p1' } });
    });

    it('com codigoDeposito inexistente retorna erro estruturado', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue({ id: 'p1', code: 'PROD-001', name: 'Produto 1' });
      mockedPrisma.storagePosition.findFirst.mockResolvedValue(null);

      const result = await getSaldoProduto('PROD-001', 'DEP-INEXISTENTE');

      expect(result).toEqual({ erro: 'deposito_nao_encontrado' });
      expect(mockedPrisma.storagePosition.findFirst).toHaveBeenCalledWith({
        where: { warehouseCode: 'DEP-INEXISTENTE' },
      });
    });

    it('com codigoDeposito existente mas produto com saldo zero retorna quantidade 0', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue({ id: 'p1', code: 'PROD-001', name: 'Produto 1' });
      mockedPrisma.storagePosition.findFirst.mockResolvedValue({ id: 'sp1', warehouseCode: 'DEP-01' });
      mockedPrisma.stockPositionBalance.findMany.mockResolvedValue([]);

      const result = await getSaldoProduto('PROD-001', 'DEP-01');

      expect(result).toEqual({ codigoProduto: 'PROD-001', nomeProduto: 'Produto 1', quantidade: 0, deposito: 'DEP-01' });
      expect(mockedPrisma.storagePosition.findFirst).toHaveBeenCalledWith({
        where: { warehouseCode: 'DEP-01' },
      });
    });

    it('com codigoDeposito soma as posições daquele armazém', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue({ id: 'p1', code: 'PROD-001', name: 'Produto 1' });
      mockedPrisma.storagePosition.findFirst.mockResolvedValue({ id: 'sp1', warehouseCode: 'DEP-01' });
      mockedPrisma.stockPositionBalance.findMany.mockResolvedValue([
        { quantity: 10 },
        { quantity: 15 },
      ]);

      const result = await getSaldoProduto('PROD-001', 'DEP-01');

      expect(result).toEqual({ codigoProduto: 'PROD-001', nomeProduto: 'Produto 1', quantidade: 25, deposito: 'DEP-01' });
      expect(mockedPrisma.stockPositionBalance.findMany).toHaveBeenCalledWith({
        where: { productId: 'p1', storagePosition: { warehouseCode: 'DEP-01' } },
        select: { quantity: true },
      });
    });
  });

  describe('getMovimentacoesRecentes', () => {
    it('retorna erro estruturado quando o produto não existe', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue(null);

      const result = await getMovimentacoesRecentes('INEXISTENTE');

      expect(result).toEqual({ erro: 'produto_nao_encontrado' });
    });

    it('retorna as movimentações mapeadas, limite default 10', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue({ id: 'p1', code: 'PROD-001' });
      mockedPrisma.stockMovement.findMany.mockResolvedValue([
        { type: 'ENTRY', quantity: 5, reason: 'Compra', reference: 'PED-1', createdAt: new Date('2026-01-01') },
      ]);

      const result = await getMovimentacoesRecentes('PROD-001');

      expect(result).toEqual([
        { tipo: 'ENTRY', quantidade: 5, motivo: 'Compra', referencia: 'PED-1', data: new Date('2026-01-01') },
      ]);
      expect(mockedPrisma.stockMovement.findMany).toHaveBeenCalledWith({
        where: { productId: 'p1' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('respeita o limite informado, com teto de 50', async () => {
      mockedPrisma.product.findUnique.mockResolvedValue({ id: 'p1', code: 'PROD-001' });
      mockedPrisma.stockMovement.findMany.mockResolvedValue([]);

      await getMovimentacoesRecentes('PROD-001', 500);

      expect(mockedPrisma.stockMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });
  });

  describe('getPosicaoEstoquePorCategoria', () => {
    it('retorna erro estruturado quando a categoria não existe', async () => {
      mockedPrisma.productCategory.findUnique.mockResolvedValue(null);

      const result = await getPosicaoEstoquePorCategoria('INEXISTENTE');

      expect(result).toEqual({ erro: 'categoria_nao_encontrada' });
    });

    it('soma o saldo de todos os produtos da categoria', async () => {
      mockedPrisma.productCategory.findUnique.mockResolvedValue({
        id: 'c1',
        code: 'CAT-01',
        name: 'Categoria 1',
        products: [{ stockBalance: { quantity: 10 } }, { stockBalance: { quantity: 20 } }, { stockBalance: null }],
      });

      const result = await getPosicaoEstoquePorCategoria('CAT-01');

      expect(result).toEqual({ codigoCategoria: 'CAT-01', nomeCategoria: 'Categoria 1', quantidadeTotal: 30, quantidadeProdutos: 3 });
    });
  });
});
