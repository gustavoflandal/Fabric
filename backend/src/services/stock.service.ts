import { prisma } from '../config/database';

export interface StockMovement {
  id: string;
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  reference?: string;
  userId: string;
  createdAt: Date;
}

export interface StockBalance {
  productId: string;
  product: any;
  quantity: number;
  minStock: number;
  maxStock: number;
  status: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
  lastMovement?: Date;
}

export class StockService {
  /**
   * Obtém saldo de estoque de um produto
   */
  async getBalance(productId: string): Promise<StockBalance> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
      },
    });

    if (!product) {
      throw new Error('Produto não encontrado');
    }

    // TODO: Calcular saldo real baseado em movimentações
    // Por enquanto, retorna valores simulados
    const quantity = Math.floor(Math.random() * 200);
    
    const minStock = product.minStock || 0;
    const maxStock = product.maxStock || 100;
    
    let status: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS' = 'OK';
    if (quantity < minStock * 0.5) {
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
      status,
      lastMovement: new Date(),
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
   * Registra entrada de estoque
   */
  async registerEntry(data: {
    productId: string;
    quantity: number;
    reason: string;
    reference?: string;
    userId: string;
  }): Promise<any> {
    // TODO: Implementar tabela de movimentações
    // Por enquanto, apenas simula
    
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new Error('Produto não encontrado');
    }

    if (data.quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    return {
      id: `mov-${Date.now()}`,
      type: 'IN',
      ...data,
      createdAt: new Date(),
    };
  }

  /**
   * Registra saída de estoque
   */
  async registerExit(data: {
    productId: string;
    quantity: number;
    reason: string;
    reference?: string;
    userId: string;
  }): Promise<any> {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new Error('Produto não encontrado');
    }

    if (data.quantity <= 0) {
      throw new Error('Quantidade deve ser maior que zero');
    }

    // Verificar saldo disponível
    const balance = await this.getBalance(data.productId);
    if (balance.quantity < data.quantity) {
      throw new Error('Saldo insuficiente em estoque');
    }

    return {
      id: `mov-${Date.now()}`,
      type: 'OUT',
      ...data,
      createdAt: new Date(),
    };
  }

  /**
   * Registra ajuste de estoque
   */
  async registerAdjustment(data: {
    productId: string;
    quantity: number;
    reason: string;
    userId: string;
  }): Promise<any> {
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new Error('Produto não encontrado');
    }

    return {
      id: `mov-${Date.now()}`,
      type: 'ADJUSTMENT',
      ...data,
      createdAt: new Date(),
    };
  }

  /**
   * Obtém movimentações de um produto
   */
  async getMovements(productId: string, limit = 50): Promise<any[]> {
    const movements = await prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return movements;
  }

  /**
   * Obtém produtos com estoque baixo
   */
  async getLowStockProducts(): Promise<StockBalance[]> {
    const balances = await this.getAllBalances();
    return balances.filter(b => b.status === 'LOW' || b.status === 'CRITICAL');
  }

  /**
   * Obtém produtos com estoque em excesso
   */
  async getExcessStockProducts(): Promise<StockBalance[]> {
    const balances = await this.getAllBalances();
    return balances.filter(b => b.status === 'EXCESS');
  }

  /**
   * Obtém resumo do estoque
   */
  async getSummary(): Promise<any> {
    const balances = await this.getAllBalances();
    
    const total = balances.length;
    const ok = balances.filter(b => b.status === 'OK').length;
    const low = balances.filter(b => b.status === 'LOW').length;
    const critical = balances.filter(b => b.status === 'CRITICAL').length;
    const excess = balances.filter(b => b.status === 'EXCESS').length;
    
    const totalValue = balances.reduce((sum, b) => {
      return sum + (b.quantity * (b.product.standardCost || 0));
    }, 0);

    return {
      total,
      ok,
      low,
      critical,
      excess,
      totalValue,
      lastUpdate: new Date(),
    };
  }

  /**
   * Reserva estoque para uma ordem de produção
   */
  async reserveForOrder(orderId: string, userId: string): Promise<any> {
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        product: true,
      },
    });

    if (!order) {
      throw new Error('Ordem de produção não encontrada');
    }

    // Buscar BOM ativa do produto
    const activeBom = await prisma.bOM.findFirst({
      where: {
        productId: order.productId,
        active: true,
      },
      include: {
        items: {
          include: {
            component: true,
          },
        },
      },
    });

    if (!activeBom) {
      throw new Error('BOM ativa não encontrada para o produto');
    }

    const reservations = [];
    
    for (const bomItem of activeBom.items) {
      const requiredQty = bomItem.quantity * order.quantity * (1 + bomItem.scrapFactor);
      const balance = await this.getBalance(bomItem.componentId);
      
      if (balance.quantity < requiredQty) {
        throw new Error(`Estoque insuficiente para ${bomItem.component.code}`);
      }
      
      // Registrar saída
      const movement = await this.registerExit({
        productId: bomItem.componentId,
        quantity: requiredQty,
        reason: 'Reserva para produção',
        reference: order.orderNumber,
        userId,
      });
      
      reservations.push(movement);
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      reservations,
      totalItems: reservations.length,
    };
  }
}

export default new StockService();
