import { prisma } from '../config/database';
import stockService from './stock.service';
import { eventBus, SystemEvents } from '../events/event-bus';

export interface MaterialConsumption {
  pointingId: string;
  productionOrderId: string;
  orderNumber: string;
  productId: string;
  productCode: string;
  productName: string;
  materials: {
    componentId: string;
    componentCode: string;
    componentName: string;
    theoreticalQty: number;
    actualQty: number;
    variance: number;
    variancePercent: number;
    movementId?: string;
  }[];
  totalVariance: number;
}

export class MaterialConsumptionService {
  /**
   * Consome materiais automaticamente ao criar apontamento
   */
  async consumeMaterials(pointingId: string, userId: string): Promise<MaterialConsumption> {
    // Buscar apontamento com dados necessários
    const pointing = await prisma.productionPointing.findUnique({
      where: { id: pointingId },
      include: {
        productionOrder: {
          include: {
            product: {
              include: {
                boms: {
                  where: { active: true },
                  include: {
                    items: {
                      include: {
                        component: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        operation: true,
      },
    });

    if (!pointing) {
      throw new Error('Apontamento não encontrado');
    }

    const order = pointing.productionOrder;
    const bom = order.product.boms[0];

    if (!bom) {
      console.log(`[MaterialConsumption] Produto ${order.product.code} não possui BOM ativa`);
      return {
        pointingId,
        productionOrderId: order.id,
        orderNumber: order.orderNumber,
        productId: order.product.id,
        productCode: order.product.code,
        productName: order.product.name,
        materials: [],
        totalVariance: 0,
      };
    }

    const materials: MaterialConsumption['materials'] = [];
    let totalVariance = 0;

    // Para cada material da BOM
    for (const bomItem of bom.items) {
      // Calcular quantidade teórica
      const theoreticalQty = bomItem.quantity * pointing.quantityGood * (1 + bomItem.scrapFactor);
      
      // Por enquanto, quantidade real = teórica (pode ser ajustado manualmente depois)
      const actualQty = theoreticalQty;
      
      const variance = actualQty - theoreticalQty;
      const variancePercent = theoreticalQty > 0 ? (variance / theoreticalQty) * 100 : 0;

      try {
        // Registrar saída de estoque
        const movement = await stockService.registerMovement({
          productId: bomItem.componentId,
          type: 'OUT',
          quantity: actualQty,
          reason: `Consumo de produção - OP ${order.orderNumber}`,
          reference: pointing.id,
          referenceType: 'PRODUCTION',
          userId,
          notes: `Apontamento: ${pointing.id}, Operação: ${pointing.operation.operationName}`,
        });

        materials.push({
          componentId: bomItem.componentId,
          componentCode: bomItem.component.code,
          componentName: bomItem.component.name,
          theoreticalQty,
          actualQty,
          variance,
          variancePercent,
          movementId: movement.id,
        });

        totalVariance += Math.abs(variance);
      } catch (error: any) {
        console.error(`[MaterialConsumption] Erro ao consumir material ${bomItem.component.code}:`, error.message);
        
        // Se falhar (ex: estoque insuficiente), registrar mas não quebrar o processo
        materials.push({
          componentId: bomItem.componentId,
          componentCode: bomItem.component.code,
          componentName: bomItem.component.name,
          theoreticalQty,
          actualQty: 0,
          variance: -theoreticalQty,
          variancePercent: -100,
        });

        // Emitir evento de erro
        await eventBus.emit(SystemEvents.SYSTEM_ERROR, {
          type: 'MATERIAL_CONSUMPTION_FAILED',
          pointingId,
          productionOrderId: order.id,
          componentId: bomItem.componentId,
          error: error.message,
        });
      }
    }

    const consumption: MaterialConsumption = {
      pointingId,
      productionOrderId: order.id,
      orderNumber: order.orderNumber,
      productId: order.product.id,
      productCode: order.product.code,
      productName: order.product.name,
      materials,
      totalVariance,
    };

    console.log(`[MaterialConsumption] Consumo registrado para OP ${order.orderNumber}: ${materials.length} materiais`);

    return consumption;
  }

  /**
   * Reverte consumo de materiais (ao cancelar apontamento)
   */
  async reverseMaterialConsumption(pointingId: string, userId: string): Promise<void> {
    // Buscar movimentações relacionadas ao apontamento
    const movements = await prisma.stockMovement.findMany({
      where: {
        reference: pointingId,
        referenceType: 'PRODUCTION',
        type: 'OUT',
      },
      include: {
        product: true,
      },
    });

    if (movements.length === 0) {
      console.log(`[MaterialConsumption] Nenhuma movimentação encontrada para apontamento ${pointingId}`);
      return;
    }

    // Para cada movimentação, criar entrada reversa
    for (const movement of movements) {
      await stockService.registerMovement({
        productId: movement.productId,
        type: 'IN',
        quantity: movement.quantity,
        reason: `Estorno de consumo - Apontamento cancelado`,
        reference: pointingId,
        referenceType: 'PRODUCTION',
        userId,
        notes: `Estorno da movimentação ${movement.id}`,
      });
    }

    console.log(`[MaterialConsumption] ${movements.length} movimentações revertidas para apontamento ${pointingId}`);
  }

  /**
   * Calcula variação de consumo (real vs teórico)
   */
  async calculateConsumptionVariance(productionOrderId: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: productionOrderId },
      include: {
        product: {
          include: {
            boms: {
              where: { active: true },
              include: {
                items: {
                  include: {
                    component: true,
                  },
                },
              },
            },
          },
        },
        pointings: true,
      },
    });

    if (!order) {
      throw new Error('Ordem de produção não encontrada');
    }

    const bom = order.product.boms[0];
    if (!bom) {
      throw new Error('Produto não possui BOM ativa');
    }

    // Calcular quantidade total produzida
    const totalProduced = order.pointings.reduce((sum, p) => sum + p.quantityGood, 0);

    const variances = [];

    for (const bomItem of bom.items) {
      // Quantidade teórica total
      const theoreticalQty = bomItem.quantity * totalProduced * (1 + bomItem.scrapFactor);

      // Quantidade real consumida (buscar movimentações)
      const movements = await prisma.stockMovement.findMany({
        where: {
          productId: bomItem.componentId,
          reference: { in: order.pointings.map(p => p.id) },
          referenceType: 'PRODUCTION',
          type: 'OUT',
        },
      });

      const actualQty = movements.reduce((sum, m) => sum + m.quantity, 0);
      const variance = actualQty - theoreticalQty;
      const variancePercent = theoreticalQty > 0 ? (variance / theoreticalQty) * 100 : 0;

      variances.push({
        componentId: bomItem.componentId,
        componentCode: bomItem.component.code,
        componentName: bomItem.component.name,
        theoreticalQty,
        actualQty,
        variance,
        variancePercent,
        status: Math.abs(variancePercent) > 10 ? 'ALERT' : 'OK',
      });
    }

    return {
      productionOrderId: order.id,
      orderNumber: order.orderNumber,
      totalProduced,
      variances,
      totalVariance: variances.reduce((sum, v) => sum + Math.abs(v.variance), 0),
    };
  }

  /**
   * Obtém relatório de consumo de materiais por período
   */
  async getConsumptionReport(startDate: Date, endDate: Date) {
    const movements = await prisma.stockMovement.findMany({
      where: {
        type: 'OUT',
        referenceType: 'PRODUCTION',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
            averageCost: true,
            lastCost: true,
          },
        },
      },
    });

    const byProduct: Record<string, any> = {};

    for (const movement of movements) {
      const key = movement.productId;

      if (!byProduct[key]) {
        byProduct[key] = {
          productId: movement.product.id,
          productCode: movement.product.code,
          productName: movement.product.name,
          totalQuantity: 0,
          totalValue: 0,
          movementCount: 0,
        };
      }

      const cost = movement.product.averageCost || movement.product.lastCost || 0;

      byProduct[key].totalQuantity += movement.quantity;
      byProduct[key].totalValue += movement.quantity * cost;
      byProduct[key].movementCount++;
    }

    return {
      period: { start: startDate, end: endDate },
      totalProducts: Object.keys(byProduct).length,
      totalMovements: movements.length,
      products: Object.values(byProduct).sort((a, b) => b.totalValue - a.totalValue),
    };
  }
}

export default new MaterialConsumptionService();
