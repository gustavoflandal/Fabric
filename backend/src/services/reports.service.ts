import { prisma } from '../config/database';

export class ReportsService {
  /**
   * Relatório de Produção
   */
  async getProductionReport(startDate: string, endDate: string): Promise<any> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const orders = await prisma.productionOrder.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        product: {
          select: {
            code: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Estatísticas
    const total = orders.length;
    const completed = orders.filter(o => o.status === 'COMPLETED').length;
    const inProgress = orders.filter(o => o.status === 'IN_PROGRESS').length;
    const planned = orders.filter(o => o.status === 'PLANNED').length;
    const cancelled = orders.filter(o => o.status === 'CANCELLED').length;

    const totalPlanned = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
    const totalProduced = orders.reduce((sum, o) => sum + (o.producedQty || 0), 0);
    const totalScrap = orders.reduce((sum, o) => sum + (o.scrapQty || 0), 0);

    const efficiency = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;
    const scrapRate = (totalProduced + totalScrap) > 0 ? (totalScrap / (totalProduced + totalScrap)) * 100 : 0;

    // Ordens por produto
    const byProduct = new Map<string, any>();
    orders.forEach(order => {
      const key = order.productId;
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          product: order.product,
          orders: 0,
          planned: 0,
          produced: 0,
          scrap: 0,
        });
      }
      const data = byProduct.get(key);
      data.orders++;
      data.planned += (order.quantity || 0);
      data.produced += (order.producedQty || 0);
      data.scrap += (order.scrapQty || 0);
    });

    return {
      period: { start, end },
      summary: {
        total,
        completed,
        inProgress,
        planned,
        cancelled,
        totalPlanned,
        totalProduced,
        totalScrap,
        efficiency,
        scrapRate,
      },
      orders,
      byProduct: Array.from(byProduct.values()),
    };
  }

  /**
   * Relatório de Eficiência
   */
  async getEfficiencyReport(startDate: string, endDate: string): Promise<any> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const orders = await prisma.productionOrder.findMany({
      where: {
        status: 'COMPLETED',
        actualEnd: {
          gte: start,
          lte: end,
        },
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

    const data = orders.map(order => {
      const scheduledDays = order.scheduledEnd && order.scheduledStart
        ? Math.ceil((order.scheduledEnd.getTime() - order.scheduledStart.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const actualDays = order.actualEnd && order.actualStart
        ? Math.ceil((order.actualEnd.getTime() - order.actualStart.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const onTime = order.actualEnd && order.scheduledEnd
        ? order.actualEnd <= order.scheduledEnd
        : false;

      const quantity = order.quantity || 0;
      const produced = order.producedQty || 0;
      const scrap = order.scrapQty || 0;

      const quantityEfficiency = quantity > 0
        ? (produced / quantity) * 100
        : 0;

      const timeEfficiency = scheduledDays > 0 && actualDays > 0
        ? (scheduledDays / actualDays) * 100
        : 0;

      return {
        orderNumber: order.orderNumber,
        product: order.product,
        quantity,
        produced,
        scrap,
        scheduledDays,
        actualDays,
        onTime,
        quantityEfficiency,
        timeEfficiency,
      };
    });

    const avgQuantityEfficiency = data.length > 0
      ? data.reduce((sum, d) => sum + d.quantityEfficiency, 0) / data.length
      : 0;

    const avgTimeEfficiency = data.length > 0
      ? data.reduce((sum, d) => sum + d.timeEfficiency, 0) / data.length
      : 0;

    const onTimeOrders = data.filter(d => d.onTime).length;
    const onTimeRate = data.length > 0 ? (onTimeOrders / data.length) * 100 : 0;

    return {
      period: { start, end },
      summary: {
        totalOrders: data.length,
        avgQuantityEfficiency,
        avgTimeEfficiency,
        onTimeOrders,
        onTimeRate,
      },
      orders: data,
    };
  }

  /**
   * Relatório de Qualidade
   */
  async getQualityReport(startDate: string, endDate: string): Promise<any> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const orders = await prisma.productionOrder.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: {
          in: ['COMPLETED', 'IN_PROGRESS'],
        },
      },
      include: {
        product: {
          select: {
            code: true,
            name: true,
            type: true,
          },
        },
      },
    });

    const data = orders.map(order => {
      const produced = order.producedQty || 0;
      const scrap = order.scrapQty || 0;
      const totalProduced = produced + scrap;
      const scrapRate = totalProduced > 0 ? (scrap / totalProduced) * 100 : 0;
      const qualityRate = 100 - scrapRate;

      return {
        orderNumber: order.orderNumber,
        product: order.product,
        produced,
        scrap,
        total: totalProduced,
        scrapRate,
        qualityRate,
      };
    });

    const totalProduced = data.reduce((sum, d) => sum + d.produced, 0);
    const totalScrap = data.reduce((sum, d) => sum + d.scrap, 0);
    const totalQty = totalProduced + totalScrap;
    const avgScrapRate = totalQty > 0 ? (totalScrap / totalQty) * 100 : 0;
    const avgQualityRate = 100 - avgScrapRate;

    // Por produto
    const byProduct = new Map<string, any>();
    data.forEach(item => {
      const key = item.product.code;
      if (!byProduct.has(key)) {
        byProduct.set(key, {
          product: item.product,
          produced: 0,
          scrap: 0,
          orders: 0,
        });
      }
      const prod = byProduct.get(key);
      prod.produced += item.produced;
      prod.scrap += item.scrap;
      prod.orders++;
    });

    const productData = Array.from(byProduct.values()).map(p => {
      const total = p.produced + p.scrap;
      const scrapRate = total > 0 ? (p.scrap / total) * 100 : 0;
      return {
        ...p,
        total,
        scrapRate,
        qualityRate: 100 - scrapRate,
      };
    });

    return {
      period: { start, end },
      summary: {
        totalOrders: data.length,
        totalProduced,
        totalScrap,
        avgScrapRate,
        avgQualityRate,
      },
      orders: data,
      byProduct: productData,
    };
  }

  /**
   * Relatório de Centros de Trabalho (Simplificado)
   */
  async getWorkCenterReport(startDate: string, endDate: string): Promise<any> {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Buscar todos os centros de trabalho ativos
    const workCenters = await prisma.workCenter.findMany({
      where: { active: true },
    });

    // Dados simulados para demonstração
    const data = workCenters.map((wc, index) => {
      // Simular dados baseado no índice para variedade
      const totalOperations = 10 + (index * 5);
      const completedOperations = Math.floor(totalOperations * 0.7);
      const inProgressOperations = totalOperations - completedOperations;

      const plannedTime = totalOperations * 8;
      const actualTime = plannedTime * (0.9 + (index * 0.05));

      const efficiency = actualTime > 0 ? (plannedTime / actualTime) * 100 : 0;
      const utilization = (completedOperations / totalOperations) * 100;

      return {
        workCenter: {
          code: wc.code,
          name: wc.name,
          type: wc.type,
          capacity: wc.capacity || 0,
        },
        totalOperations,
        completedOperations,
        inProgressOperations,
        plannedTime,
        actualTime,
        efficiency: Math.min(efficiency, 100),
        utilization: Math.min(utilization, 100),
      };
    });

    return {
      period: { start, end },
      workCenters: data,
    };
  }

  /**
   * Relatório Consolidado
   */
  async getConsolidatedReport(startDate: string, endDate: string): Promise<any> {
    const [production, efficiency, quality, workCenters] = await Promise.all([
      this.getProductionReport(startDate, endDate),
      this.getEfficiencyReport(startDate, endDate),
      this.getQualityReport(startDate, endDate),
      this.getWorkCenterReport(startDate, endDate),
    ]);

    return {
      period: { start: new Date(startDate), end: new Date(endDate) },
      production: production.summary,
      efficiency: efficiency.summary,
      quality: quality.summary,
      workCenters: workCenters.workCenters.length,
      generatedAt: new Date(),
    };
  }
}

export default new ReportsService();
