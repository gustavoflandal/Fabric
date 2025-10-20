import { prisma } from '../config/database';
import { eventBus, SystemEvents } from '../events/event-bus';

export interface StockMovementDto {
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  reference?: string;
  referenceType?: 'PRODUCTION' | 'PURCHASE' | 'ADJUSTMENT' | 'MANUAL';
  userId: string;
  notes?: string;
}

export interface StockBalance {
  productId: string;
  product: any;
  quantity: number;
  minStock: number;
  maxStock: number;
  safetyStock: number;
  status: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
  lastMovement?: Date;
}

export class StockServiceRefactored {
  /**
   * Registra uma movimentação de estoque
   */
  async registerMovement(data: StockMovementDto) {
    // Validar produto
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new Error('Produto não encontrado');
    }

    // Validar quantidade
    if (data.quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    // Se for saída, verificar se há estoque disponível
    if (data.type === 'OUT') {
      const currentBalance = await this.getBalance(data.productId);
      
      if (currentBalance.quantity < data.quantity) {
        throw new Error(
          `Estoque insuficiente. Disponível: ${currentBalance.quantity}, ` +
          `Solicitado: ${data.quantity}`
        );
      }
    }

    // Criar movimentação
    const movement = await prisma.stockMovement.create({
      data: {
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        reference: data.reference,
        referenceType: data.referenceType,
        userId: data.userId,
        notes: data.notes,
      },
      include: {
        product: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Emitir evento
    await eventBus.emit(SystemEvents.STOCK_MOVEMENT_CREATED, {
      movementId: movement.id,
      productId: movement.productId,
      type: movement.type,
      quantity: movement.quantity,
      reference: movement.reference,
    });

    // Verificar níveis de estoque
    await this.checkStockLevels(data.productId);

    return movement;
  }

  /**
   * Obtém saldo REAL de estoque de um produto
   */
  async getBalance(productId: string): Promise<StockBalance> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        unit: true,
      },
    });

    if (!product) {
      throw new Error('Produto não encontrado');
    }

    // Calcular saldo baseado em movimentações REAIS
    const movements = await prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });

    let quantity = 0;
    let lastMovement: Date | undefined;

    for (const movement of movements) {
      if (movement.type === 'IN' || movement.type === 'ADJUSTMENT') {
        quantity += movement.quantity;
      } else if (movement.type === 'OUT') {
        quantity -= movement.quantity;
      }

      if (!lastMovement || movement.createdAt > lastMovement) {
        lastMovement = movement.createdAt;
      }
    }

    const minStock = product.minStock || 0;
    const maxStock = product.maxStock || 1000;
    const safetyStock = product.safetyStock || 0;

    // Determinar status
    let status: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS' = 'OK';
    
    if (quantity < safetyStock) {
      status = 'CRITICAL';
    } else if (quantity < minStock) {
      status = 'LOW';
    } else if (quantity > maxStock) {
      status = 'EXCESS';
    }

    return {
      productId: product.id,
      product,
      quantity,
      minStock,
      maxStock,
      safetyStock,
      status,
      lastMovement,
    };
  }

  /**
   * Lista todos os saldos de estoque
   */
  async getAllBalances(filters?: {
    status?: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
    type?: string;
    categoryId?: string;
  }): Promise<StockBalance[]> {
    const where: any = { active: true };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        unit: true,
      },
    });

    const balances: StockBalance[] = [];

    for (const product of products) {
      const balance = await this.getBalance(product.id);

      // Filtrar por status se especificado
      if (filters?.status && balance.status !== filters.status) {
        continue;
      }

      balances.push(balance);
    }

    return balances;
  }

  /**
   * Obtém histórico de movimentações de um produto
   */
  async getMovementHistory(
    productId: string,
    filters?: {
      type?: 'IN' | 'OUT' | 'ADJUSTMENT';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ) {
    const where: any = { productId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });

    return movements;
  }

  /**
   * Verifica níveis de estoque e emite alertas
   */
  private async checkStockLevels(productId: string): Promise<void> {
    const balance = await this.getBalance(productId);

    if (balance.status === 'CRITICAL') {
      await eventBus.emit(SystemEvents.STOCK_LEVEL_CRITICAL, {
        productId: balance.productId,
        productCode: balance.product.code,
        productName: balance.product.name,
        currentQty: balance.quantity,
        safetyStock: balance.safetyStock,
        minStock: balance.minStock,
      });
    } else if (balance.status === 'LOW') {
      await eventBus.emit(SystemEvents.STOCK_LEVEL_LOW, {
        productId: balance.productId,
        productCode: balance.product.code,
        productName: balance.product.name,
        currentQty: balance.quantity,
        minStock: balance.minStock,
      });
    } else if (balance.status === 'EXCESS') {
      await eventBus.emit(SystemEvents.STOCK_LEVEL_EXCESS, {
        productId: balance.productId,
        productCode: balance.product.code,
        productName: balance.product.name,
        currentQty: balance.quantity,
        maxStock: balance.maxStock,
      });
    }
  }

  /**
   * Ajuste manual de estoque
   */
  async adjustStock(
    productId: string,
    newQuantity: number,
    reason: string,
    userId: string,
    notes?: string
  ) {
    const currentBalance = await this.getBalance(productId);
    const difference = newQuantity - currentBalance.quantity;

    if (difference === 0) {
      throw new Error('Nova quantidade é igual à quantidade atual');
    }

    const type = difference > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(difference);

    return this.registerMovement({
      productId,
      type,
      quantity,
      reason: `Ajuste: ${reason}`,
      referenceType: 'ADJUSTMENT',
      userId,
      notes: `Quantidade anterior: ${currentBalance.quantity}, Nova quantidade: ${newQuantity}. ${notes || ''}`,
    });
  }

  /**
   * Consolidação de estoque (para relatórios)
   */
  async getStockConsolidation(filters?: {
    categoryId?: string;
    type?: string;
    status?: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
  }) {
    const balances = await this.getAllBalances(filters);

    const consolidation = {
      totalProducts: balances.length,
      totalValue: 0,
      byStatus: {
        OK: 0,
        LOW: 0,
        CRITICAL: 0,
        EXCESS: 0,
      },
      byCategory: {} as Record<string, number>,
      products: balances,
    };

    for (const balance of balances) {
      // Contar por status
      consolidation.byStatus[balance.status]++;

      // Calcular valor total
      const cost = balance.product.averageCost || balance.product.lastCost || 0;
      consolidation.totalValue += balance.quantity * cost;

      // Agrupar por categoria
      const categoryName = balance.product.category?.name || 'Sem Categoria';
      if (!consolidation.byCategory[categoryName]) {
        consolidation.byCategory[categoryName] = 0;
      }
      consolidation.byCategory[categoryName]++;
    }

    return consolidation;
  }
}

export default new StockServiceRefactored();
