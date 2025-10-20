import { prisma } from '../config/database';

export interface MRPRequirement {
  productId: string;
  product: any;
  requiredQty: number;
  availableQty: number;
  onOrderQty: number;
  netRequirement: number;
  suggestedAction: 'BUY' | 'PRODUCE' | 'NONE';
  leadTime: number;
  suggestedDate: Date;
}

export interface MRPResult {
  orderId: string;
  orderNumber: string;
  requirements: MRPRequirement[];
  totalItems: number;
  itemsToBuy: number;
  itemsToProduce: number;
  executedAt: Date;
}

export class MRPService {
  /**
   * Executa MRP para uma ordem de produção específica
   */
  async executeForOrder(orderId: string): Promise<MRPResult> {
    // Buscar ordem com produto
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

    const requirements: MRPRequirement[] = [];

    // Se não houver BOM, retornar vazio
    if (!activeBom || activeBom.items.length === 0) {
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        requirements: [],
        totalItems: 0,
        itemsToBuy: 0,
        itemsToProduce: 0,
        executedAt: new Date(),
      };
    }

    // Para cada material necessário
    for (const bomItem of activeBom.items) {
      const component = bomItem.component;
      
      // Calcular quantidade necessária
      const requiredQty = bomItem.quantity * order.quantity * (1 + bomItem.scrapFactor);
      
      // Calcular estoque disponível (simulado - será real quando implementar estoque)
      const availableQty = await this.getAvailableStock(component.id);
      
      // Calcular quantidade em pedidos (simulado)
      const onOrderQty = await this.getOnOrderQuantity(component.id);
      
      // Calcular necessidade líquida
      const netRequirement = Math.max(0, requiredQty - availableQty - onOrderQty);
      
      // Determinar ação sugerida
      let suggestedAction: 'BUY' | 'PRODUCE' | 'NONE' = 'NONE';
      if (netRequirement > 0) {
        suggestedAction = component.type === 'RAW_MATERIAL' ? 'BUY' : 'PRODUCE';
      }
      
      // Lead time (dias)
      const leadTime = component.type === 'RAW_MATERIAL' ? 7 : 3;
      
      // Data sugerida (subtrair lead time da data de início da ordem)
      const suggestedDate = new Date(order.scheduledStart);
      suggestedDate.setDate(suggestedDate.getDate() - leadTime);
      
      requirements.push({
        productId: component.id,
        product: component,
        requiredQty,
        availableQty,
        onOrderQty,
        netRequirement,
        suggestedAction,
        leadTime,
        suggestedDate,
      });
    }

    // Estatísticas
    const totalItems = requirements.length;
    const itemsToBuy = requirements.filter(r => r.suggestedAction === 'BUY').length;
    const itemsToProduce = requirements.filter(r => r.suggestedAction === 'PRODUCE').length;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      requirements,
      totalItems,
      itemsToBuy,
      itemsToProduce,
      executedAt: new Date(),
    };
  }

  /**
   * Executa MRP para múltiplas ordens
   */
  async executeForMultipleOrders(orderIds: string[]): Promise<MRPResult[]> {
    const results: MRPResult[] = [];
    
    for (const orderId of orderIds) {
      const result = await this.executeForOrder(orderId);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Executa MRP para todas as ordens planejadas e liberadas
   */
  async executeForAllPendingOrders(): Promise<MRPResult[]> {
    const orders = await prisma.productionOrder.findMany({
      where: {
        status: {
          in: ['PLANNED', 'RELEASED'],
        },
      },
      select: {
        id: true,
      },
    });

    const orderIds = orders.map(o => o.id);
    return this.executeForMultipleOrders(orderIds);
  }

  /**
   * Consolida necessidades de múltiplas ordens
   */
  async consolidateRequirements(orderIds: string[]): Promise<MRPRequirement[]> {
    const results = await this.executeForMultipleOrders(orderIds);
    
    // Agrupar por produto
    const consolidated = new Map<string, MRPRequirement>();
    
    for (const result of results) {
      for (const req of result.requirements) {
        const existing = consolidated.get(req.productId);
        
        if (existing) {
          // Somar quantidades
          existing.requiredQty += req.requiredQty;
          existing.netRequirement += req.netRequirement;
          // Manter a data mais próxima
          if (req.suggestedDate < existing.suggestedDate) {
            existing.suggestedDate = req.suggestedDate;
          }
        } else {
          consolidated.set(req.productId, { ...req });
        }
      }
    }
    
    return Array.from(consolidated.values());
  }

  /**
   * Gera sugestões de compra
   */
  async generatePurchaseSuggestions(orderIds?: string[]): Promise<any[]> {
    let requirements: MRPRequirement[];
    
    if (orderIds && orderIds.length > 0) {
      requirements = await this.consolidateRequirements(orderIds);
    } else {
      const results = await this.executeForAllPendingOrders();
      const allOrderIds = results.map(r => r.orderId);
      requirements = await this.consolidateRequirements(allOrderIds);
    }
    
    // Filtrar apenas itens para comprar
    const purchaseItems = requirements.filter(r => r.suggestedAction === 'BUY' && r.netRequirement > 0);
    
    return purchaseItems.map(item => ({
      product: item.product,
      quantity: item.netRequirement,
      suggestedDate: item.suggestedDate,
      leadTime: item.leadTime,
      priority: this.calculatePriority(item.suggestedDate),
    }));
  }

  /**
   * Gera sugestões de produção
   */
  async generateProductionSuggestions(orderIds?: string[]): Promise<any[]> {
    let requirements: MRPRequirement[];
    
    if (orderIds && orderIds.length > 0) {
      requirements = await this.consolidateRequirements(orderIds);
    } else {
      const results = await this.executeForAllPendingOrders();
      const allOrderIds = results.map(r => r.orderId);
      requirements = await this.consolidateRequirements(allOrderIds);
    }
    
    // Filtrar apenas itens para produzir
    const productionItems = requirements.filter(r => r.suggestedAction === 'PRODUCE' && r.netRequirement > 0);
    
    return productionItems.map(item => ({
      product: item.product,
      quantity: item.netRequirement,
      suggestedDate: item.suggestedDate,
      leadTime: item.leadTime,
      priority: this.calculatePriority(item.suggestedDate),
    }));
  }

  /**
   * Simula estoque disponível (será substituído pelo módulo de estoque real)
   */
  private async getAvailableStock(productId: string): Promise<number> {
    // TODO: Integrar com módulo de estoque real
    // Por enquanto, retorna valores simulados
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    
    if (!product) return 0;
    
    // Simular estoque baseado no tipo
    if (product.type === 'RAW_MATERIAL') {
      return Math.floor(Math.random() * 100); // 0-100 unidades
    } else if (product.type === 'SEMI_FINISHED') {
      return Math.floor(Math.random() * 50); // 0-50 unidades
    }
    
    return 0;
  }

  /**
   * Simula quantidade em pedidos (será substituído por dados reais)
   */
  private async getOnOrderQuantity(productId: string): Promise<number> {
    // TODO: Integrar com módulo de compras/ordens
    // Por enquanto, retorna 0
    return 0;
  }

  /**
   * Calcula prioridade baseada na data sugerida
   */
  private calculatePriority(suggestedDate: Date): 'HIGH' | 'MEDIUM' | 'LOW' {
    const today = new Date();
    const daysUntil = Math.ceil((suggestedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return 'HIGH'; // Atrasado
    if (daysUntil <= 7) return 'HIGH'; // Menos de 1 semana
    if (daysUntil <= 14) return 'MEDIUM'; // 1-2 semanas
    return 'LOW'; // Mais de 2 semanas
  }

  /**
   * Obtém resumo do MRP
   */
  async getSummary(): Promise<any> {
    const results = await this.executeForAllPendingOrders();
    
    const totalOrders = results.length;
    const totalRequirements = results.reduce((sum, r) => sum + r.totalItems, 0);
    const totalToBuy = results.reduce((sum, r) => sum + r.itemsToBuy, 0);
    const totalToProduce = results.reduce((sum, r) => sum + r.itemsToProduce, 0);
    
    return {
      totalOrders,
      totalRequirements,
      totalToBuy,
      totalToProduce,
      lastExecuted: new Date(),
    };
  }
}

export default new MRPService();
