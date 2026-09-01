import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

const prisma = new PrismaClient();

export interface DashboardKPIs {
  ordersInProgress: number;
  ordersTotal: number;
  efficiency: number;
  efficiencyTrend: number;
  scrapRate: number;
  scrapQuantity: number;
  delayedOrders: number;
}

export interface OrdersByStatus {
  status: string;
  count: number;
}

export interface DailyProduction {
  date: string;
  produced: number;
  planned: number;
}

export interface WorkCenterEfficiency {
  name: string;
  efficiency: number;
}

export interface TopProduct {
  name: string;
  quantity: number;
}

export interface WorkCenterOccupation {
  name: string;
  occupation: number;
}

export interface TimeDistribution {
  date: string;
  setupTime: number;
  executionTime: number;
}

class PCPDashboardService {
  /**
   * Obtém todos os KPIs do dashboard
   */
  async getKPIs(): Promise<DashboardKPIs> {
    const today = new Date();
    const yesterday = subDays(today, 1);

    // Total de ordens
    const ordersTotal = await prisma.productionOrder.count();

    // Ordens em progresso
    const ordersInProgress = await prisma.productionOrder.count({
      where: { status: 'IN_PROGRESS' }
    });

    // Ordens atrasadas (scheduled end passou mas não foi concluída)
    const delayedOrders = await prisma.productionOrder.count({
      where: {
        scheduledEnd: { lt: today },
        status: { in: ['PLANNED', 'IN_PROGRESS'] }
      }
    });

    // Eficiência de hoje
    const todayEfficiency = await this.calculateDailyEfficiency(today);
    const yesterdayEfficiency = await this.calculateDailyEfficiency(yesterday);
    const efficiencyTrend = yesterdayEfficiency > 0 
      ? ((todayEfficiency - yesterdayEfficiency) / yesterdayEfficiency) * 100 
      : 0;

    // Taxa de refugo
    const scrapData = await prisma.productionOrder.aggregate({
      _sum: {
        scrapQty: true,
        producedQty: true
      }
    });

    const scrapQuantity = scrapData._sum.scrapQty || 0;
    const totalProduced = scrapData._sum.producedQty || 0;
    const scrapRate = totalProduced > 0 
      ? (scrapQuantity / (totalProduced + scrapQuantity)) * 100 
      : 0;

    return {
      ordersInProgress,
      ordersTotal,
      efficiency: Math.round(todayEfficiency * 10) / 10,
      efficiencyTrend: Math.round(efficiencyTrend * 10) / 10,
      scrapRate: Math.round(scrapRate * 10) / 10,
      scrapQuantity: Math.round(scrapQuantity),
      delayedOrders
    };
  }

  /**
   * Calcula a eficiência de um dia específico
   */
  private async calculateDailyEfficiency(date: Date): Promise<number> {
    const startDate = startOfDay(date);
    const endDate = endOfDay(date);

    const pointings = await prisma.productionPointing.findMany({
      where: {
        startTime: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        operation: true
      }
    });

    if (pointings.length === 0) return 0;

    let totalEfficiency = 0;
    let count = 0;

    for (const pointing of pointings) {
      const plannedTime = pointing.operation.runTime * pointing.quantityGood;
      const actualTime = pointing.runTime;
      
      if (actualTime > 0) {
        const efficiency = (plannedTime / actualTime) * 100;
        totalEfficiency += Math.min(efficiency, 150); // Cap em 150%
        count++;
      }
    }

    return count > 0 ? totalEfficiency / count : 0;
  }

  /**
   * Obtém contagem de ordens por status
   */
  async getOrdersByStatus(): Promise<OrdersByStatus[]> {
    const statusCounts = await prisma.productionOrder.groupBy({
      by: ['status'],
      _count: {
        id: true
      }
    });

    return statusCounts.map(item => ({
      status: item.status,
      count: item._count.id
    }));
  }

  /**
   * Obtém produção diária dos últimos N dias
   */
  async getDailyProduction(days: number = 7): Promise<DailyProduction[]> {
    const result: DailyProduction[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(today, i);
      const startDate = startOfDay(date);
      const endDate = endOfDay(date);

      // Quantidade produzida
      const produced = await prisma.productionPointing.aggregate({
        where: {
          startTime: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          quantityGood: true
        }
      });

      // Quantidade planejada para o dia
      const planned = await prisma.productionOrder.aggregate({
        where: {
          scheduledStart: {
            lte: endDate
          },
          scheduledEnd: {
            gte: startDate
          }
        },
        _sum: {
          quantity: true
        }
      });

      result.push({
        date: format(date, 'yyyy-MM-dd'),
        produced: Math.round(produced._sum.quantityGood || 0),
        planned: Math.round(planned._sum.quantity || 0)
      });
    }

    return result;
  }

  /**
   * Obtém eficiência por centro de trabalho
   */
  async getWorkCenterEfficiency(): Promise<WorkCenterEfficiency[]> {
    const workCenters = await prisma.workCenter.findMany({
      where: { active: true },
      include: {
        productionOperations: {
          where: {
            status: { in: ['IN_PROGRESS', 'COMPLETED'] }
          },
          include: {
            pointings: {
              where: {
                startTime: {
                  gte: subDays(new Date(), 7)
                }
              }
            }
          }
        }
      }
    });

    const efficiencies: WorkCenterEfficiency[] = [];

    for (const wc of workCenters) {
      let totalEfficiency = 0;
      let count = 0;

      for (const operation of wc.productionOperations) {
        for (const pointing of operation.pointings) {
          const plannedTime = operation.runTime * pointing.quantityGood;
          const actualTime = pointing.runTime;

          if (actualTime > 0) {
            const efficiency = (plannedTime / actualTime) * 100;
            totalEfficiency += Math.min(efficiency, 150);
            count++;
          }
        }
      }

      const avgEfficiency = count > 0 ? totalEfficiency / count : 0;

      efficiencies.push({
        name: wc.name,
        efficiency: Math.round(avgEfficiency * 10) / 10
      });
    }

    return efficiencies.sort((a, b) => b.efficiency - a.efficiency);
  }

  /**
   * Obtém os top N produtos mais produzidos
   */
  async getTopProducts(limit: number = 5): Promise<TopProduct[]> {
    const products = await prisma.productionOrder.groupBy({
      by: ['productId'],
      _sum: {
        producedQty: true
      },
      orderBy: {
        _sum: {
          producedQty: 'desc'
        }
      },
      take: limit
    });

    const topProducts: TopProduct[] = [];

    for (const item of products) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true }
      });

      if (product) {
        topProducts.push({
          name: product.name,
          quantity: Math.round(item._sum.producedQty || 0)
        });
      }
    }

    return topProducts;
  }

  /**
   * Obtém ocupação dos centros de trabalho
   */
  async getWorkCenterOccupation(): Promise<WorkCenterOccupation[]> {
    const workCenters = await prisma.workCenter.findMany({
      where: { active: true },
      include: {
        productionOperations: {
          where: {
            status: { in: ['IN_PROGRESS', 'PENDING'] }
          }
        }
      }
    });

    const occupations: WorkCenterOccupation[] = [];

    for (const wc of workCenters) {
      // Calcula tempo total planejado para operações pendentes/em progresso
      const totalPlannedTime = wc.productionOperations.reduce(
        (sum, op) => sum + op.totalPlannedTime,
        0
      );

      // Calcula ocupação como % da capacidade diária (assumindo 16h = 960min por dia)
      const dailyCapacity = wc.capacity * 960; // 960 minutos = 16 horas
      const occupation = dailyCapacity > 0 
        ? (totalPlannedTime / dailyCapacity) * 100 
        : 0;

      occupations.push({
        name: wc.name,
        occupation: Math.min(Math.round(occupation * 10) / 10, 100)
      });
    }

    return occupations;
  }

  /**
   * Obtém distribuição de tempo (setup vs execução) dos últimos N dias
   */
  async getTimeDistribution(days: number = 7): Promise<TimeDistribution[]> {
    const result: TimeDistribution[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(today, i);
      const startDate = startOfDay(date);
      const endDate = endOfDay(date);

      const pointings = await prisma.productionPointing.aggregate({
        where: {
          startTime: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: {
          setupTime: true,
          runTime: true
        }
      });

      result.push({
        date: format(date, 'yyyy-MM-dd'),
        setupTime: Math.round(pointings._sum.setupTime || 0),
        executionTime: Math.round(pointings._sum.runTime || 0)
      });
    }

    return result;
  }

  /**
   * Obtém todos os dados do dashboard de uma vez
   */
  async getAllDashboardData() {
    const [
      kpis,
      ordersByStatus,
      dailyProduction,
      workCenterEfficiency,
      topProducts,
      workCenterOccupation,
      timeDistribution
    ] = await Promise.all([
      this.getKPIs(),
      this.getOrdersByStatus(),
      this.getDailyProduction(7),
      this.getWorkCenterEfficiency(),
      this.getTopProducts(5),
      this.getWorkCenterOccupation(),
      this.getTimeDistribution(7)
    ]);

    return {
      kpis,
      ordersByStatus,
      dailyProduction,
      workCenterEfficiency,
      topProducts,
      workCenterOccupation,
      timeDistribution
    };
  }
}

export default new PCPDashboardService();
