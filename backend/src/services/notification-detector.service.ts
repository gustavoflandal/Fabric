import { prisma } from '../config/database';
import notificationService from './notification.service';

/**
 * Service responsável por detectar eventos e criar notificações automaticamente
 */
export class NotificationDetectorService {
  
  /**
   * Detectar ordens de produção atrasadas
   */
  async detectProductionDelays() {
    const now = new Date();

    const delayedOrders = await prisma.productionOrder.findMany({
      where: {
        status: { in: ['RELEASED', 'IN_PROGRESS'] },
        scheduledEnd: { lt: now },
      },
      include: {
        product: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    for (const order of delayedOrders) {
      const delayDays = Math.ceil(
        (now.getTime() - new Date(order.scheduledEnd).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Verificar se já foi notificado nas últimas 24h
      const alreadyNotified = await notificationService.checkRecentNotification(
        'PRODUCTION_DELAYED',
        order.id,
        24
      );

      if (!alreadyNotified) {
        // Buscar usuários que devem ser notificados (gerentes de produção)
        const recipients = await this.getUsersByRole('MANAGER');

        await notificationService.createBulk(
          recipients.map(u => u.id),
          {
            type: 'WARNING',
            category: 'PRODUCTION',
            eventType: 'PRODUCTION_DELAYED',
            title: 'Ordem de Produção Atrasada',
            message: `OP ${order.orderNumber} (${order.product.name}) está atrasada em ${delayDays} ${delayDays === 1 ? 'dia' : 'dias'}`,
            data: {
              orderNumber: order.orderNumber,
              productName: order.product.name,
              delayDays,
              scheduledEnd: order.scheduledEnd,
            },
            link: `/production/orders/${order.id}`,
            resourceType: 'ProductionOrder',
            resourceId: order.id,
            priority: 3, // Alta
          }
        );
      }
    }

    return delayedOrders.length;
  }

  /**
   * Detectar gargalos em centros de trabalho
   */
  async detectBottlenecks() {
    const threshold = 5; // Número de operações na fila que caracteriza gargalo

    const workCenters = await prisma.workCenter.findMany({
      where: { active: true },
      include: {
        productionOperations: {
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
          include: {
            productionOrder: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
      },
    });

    for (const wc of workCenters) {
      const queueSize = wc.productionOperations.length;

      if (queueSize >= threshold) {
        const alreadyNotified = await notificationService.checkRecentNotification(
          'BOTTLENECK_DETECTED',
          wc.id,
          6 // Notificar a cada 6 horas
        );

        if (!alreadyNotified) {
          const recipients = await this.getUsersByRole('MANAGER');

          await notificationService.createBulk(
            recipients.map(u => u.id),
            {
              type: 'WARNING',
              category: 'PRODUCTION',
              eventType: 'BOTTLENECK_DETECTED',
              title: 'Gargalo Detectado',
              message: `Centro de trabalho "${wc.name}" possui ${queueSize} operações na fila`,
              data: {
                workCenterId: wc.id,
                workCenterName: wc.name,
                queueSize,
                threshold,
                operations: wc.productionOperations.map(op => op.productionOrder.orderNumber),
              },
              link: `/work-centers/${wc.id}`,
              resourceType: 'WorkCenter',
              resourceId: wc.id,
              priority: 3, // Alta
            }
          );
        }
      }
    }
  }

  /**
   * Verificar disponibilidade de material para uma ordem
   */
  async checkMaterialAvailability(orderId: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        product: {
          include: {
            boms: {
              where: { active: true },
              include: {
                items: {
                  include: {
                    component: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!order || !order.product.boms[0]) {
      return;
    }

    const bom = order.product.boms[0];

    for (const bomItem of bom.items) {
      // Buscar estoque atual
      const stockMovements = await prisma.stockMovement.findMany({
        where: { productId: bomItem.componentId },
        select: { quantity: true, type: true },
      });

      const currentStock = stockMovements.reduce((acc, mov) => {
        return mov.type === 'IN' ? acc + mov.quantity : acc - mov.quantity;
      }, 0);

      const required = bomItem.quantity * order.quantity;

      if (currentStock < required) {
        // Buscar compradores e gerente de produção
        const buyers = await this.getUsersByRole('BUYER');
        const managers = await this.getUsersByRole('MANAGER');
        const recipients = [...buyers, ...managers];

        await notificationService.createBulk(
          recipients.map(u => u.id),
          {
            type: 'ERROR',
            category: 'PRODUCTION',
            eventType: 'MATERIAL_UNAVAILABLE',
            title: 'Material Indisponível',
            message: `Material "${bomItem.component.name}" insuficiente para OP ${order.orderNumber}. Necessário: ${required}, Disponível: ${currentStock}`,
            data: {
              orderNumber: order.orderNumber,
              materialCode: bomItem.component.code,
              materialName: bomItem.component.name,
              required,
              available: currentStock,
              shortage: required - currentStock,
            },
            link: `/production/orders/${order.id}`,
            resourceType: 'ProductionOrder',
            resourceId: order.id,
            priority: 4, // Crítica
          }
        );
      }
    }
  }

  /**
   * Monitorar taxa de refugo em apontamento
   */
  async monitorScrapRate(pointingId: string) {
    const pointing = await prisma.productionPointing.findUnique({
      where: { id: pointingId },
      include: {
        operation: {
          include: {
            productionOrder: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!pointing || pointing.goodQty === 0) {
      return;
    }

    const scrapRate = (pointing.scrapQty / (pointing.goodQty + pointing.scrapQty)) * 100;
    const maxScrapRate = 5; // 5% - Configurável

    if (scrapRate > maxScrapRate) {
      // Notificar gerente de qualidade, gerente de produção e operador
      const qualityManagers = await this.getUsersByRole('QUALITY_MANAGER');
      const productionManagers = await this.getUsersByRole('MANAGER');
      const recipients = [...qualityManagers, ...productionManagers, pointing.user];

      await notificationService.createBulk(
        recipients.map(u => u.id),
        {
          type: 'ERROR',
          category: 'QUALITY',
          eventType: 'QUALITY_SCRAP_HIGH',
          title: 'Taxa de Refugo Crítica',
          message: `Apontamento da OP ${pointing.operation.productionOrder.orderNumber} registrou ${scrapRate.toFixed(1)}% de refugo (limite: ${maxScrapRate}%)`,
          data: {
            orderNumber: pointing.operation.productionOrder.orderNumber,
            operationName: pointing.operation.name,
            scrapRate: scrapRate.toFixed(2),
            maxScrapRate,
            scrapQty: pointing.scrapQty,
            goodQty: pointing.goodQty,
            operatorName: pointing.user.name,
          },
          link: `/production/orders/${pointing.operation.orderId}`,
          resourceType: 'ProductionPointing',
          resourceId: pointing.id,
          priority: 4, // Crítica
        }
      );
    }
  }

  /**
   * Verificar estoque abaixo do mínimo
   */
  async checkLowStock() {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        minStock: { gt: 0 },
      },
      select: {
        id: true,
        code: true,
        name: true,
        minStock: true,
        unit: {
          select: {
            symbol: true,
          },
        },
      },
    });

    for (const product of products) {
      // Calcular estoque atual
      const stockMovements = await prisma.stockMovement.findMany({
        where: { productId: product.id },
        select: { quantity: true, type: true },
      });

      const currentStock = stockMovements.reduce((acc, mov) => {
        return mov.type === 'IN' ? acc + mov.quantity : acc - mov.quantity;
      }, 0);

      if (currentStock <= product.minStock) {
        const alreadyNotified = await notificationService.checkRecentNotification(
          'STOCK_BELOW_SAFETY',
          product.id,
          24
        );

        if (!alreadyNotified) {
          const buyers = await this.getUsersByRole('BUYER');
          const stockManagers = await this.getUsersByRole('STOCK_MANAGER');
          const recipients = [...buyers, ...stockManagers];

          const priority = currentStock === 0 ? 4 : 3; // Crítico se zerado, alto se baixo

          await notificationService.createBulk(
            recipients.map(u => u.id),
            {
              type: currentStock === 0 ? 'ERROR' : 'WARNING',
              category: 'STOCK',
              eventType: 'STOCK_BELOW_SAFETY',
              title: currentStock === 0 ? 'Estoque Zerado' : 'Estoque Abaixo do Mínimo',
              message: `${product.name}: ${currentStock} ${product.unit.symbol} (mínimo: ${product.minStock} ${product.unit.symbol})`,
              data: {
                productCode: product.code,
                productName: product.name,
                currentStock,
                minStock: product.minStock,
                unit: product.unit.symbol,
              },
              link: `/stock/products/${product.id}`,
              resourceType: 'Product',
              resourceId: product.id,
              priority,
            }
          );
        }
      }
    }
  }

  /**
   * Notificar conclusão de operação
   */
  async notifyOperationCompleted(pointingId: string) {
    const pointing = await prisma.productionPointing.findUnique({
      where: { id: pointingId },
      include: {
        operation: {
          include: {
            productionOrder: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!pointing) {
      return;
    }

    // Notificar gerente de produção
    const managers = await this.getUsersByRole('MANAGER');

    await notificationService.createBulk(
      managers.map(u => u.id),
      {
        type: 'SUCCESS',
        category: 'PRODUCTION',
        eventType: 'OPERATION_COMPLETED',
        title: 'Operação Concluída',
        message: `${pointing.user.name} concluiu operação da OP ${pointing.operation.productionOrder.orderNumber}`,
        data: {
          orderNumber: pointing.operation.productionOrder.orderNumber,
          operationName: pointing.operation.name,
          operatorName: pointing.user.name,
          goodQty: pointing.goodQty,
          scrapQty: pointing.scrapQty,
        },
        link: `/production/orders/${pointing.operation.orderId}`,
        resourceType: 'ProductionPointing',
        resourceId: pointing.id,
        priority: 2, // Média
      }
    );
  }

  /**
   * Helper: Buscar usuários por role code
   */
  private async getUsersByRole(roleCode: string) {
    const users = await prisma.user.findMany({
      where: {
        active: true,
        roles: {
          some: {
            role: {
              code: roleCode,
              active: true,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return users;
  }
}

export default new NotificationDetectorService();
