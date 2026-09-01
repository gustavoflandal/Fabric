import { prisma } from '../config/database';

export class DashboardService {
  async getStatistics() {
    // Estatísticas gerais
    const [
      totalProducts,
      totalOrders,
      ordersInProgress,
      ordersCompleted,
      totalPointings,
      activeUsers,
    ] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.productionOrder.count(),
      prisma.productionOrder.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.productionOrder.count({ where: { status: 'COMPLETED' } }),
      prisma.productionPointing.count(),
      prisma.user.count({ where: { active: true } }),
    ]);

    return {
      products: totalProducts,
      orders: {
        total: totalOrders,
        inProgress: ordersInProgress,
        completed: ordersCompleted,
      },
      pointings: totalPointings,
      users: activeUsers,
    };
  }

  async getProductionMetrics() {
    // Ordens por status
    const ordersByStatus = await prisma.productionOrder.groupBy({
      by: ['status'],
      _count: true,
    });

    // Ordens recentes (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrders = await prisma.productionOrder.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        quantity: true,
        producedQty: true,
        scheduledStart: true,
        scheduledEnd: true,
        product: {
          select: { code: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Eficiência de produção
    const completedOrders = await prisma.productionOrder.findMany({
      where: { status: 'COMPLETED' },
      select: {
        quantity: true,
        producedQty: true,
        scrapQty: true,
      },
    });

    const totalPlanned = completedOrders.reduce((sum, o) => sum + o.quantity, 0);
    const totalProduced = completedOrders.reduce((sum, o) => sum + o.producedQty, 0);
    const totalScrap = completedOrders.reduce((sum, o) => sum + o.scrapQty, 0);

    const efficiency = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0;
    const scrapRate = totalProduced > 0 ? (totalScrap / (totalProduced + totalScrap)) * 100 : 0;

    return {
      ordersByStatus: ordersByStatus.map(item => ({
        status: item.status,
        count: item._count,
      })),
      recentOrders,
      efficiency: {
        planned: totalPlanned,
        produced: totalProduced,
        scrap: totalScrap,
        efficiencyRate: efficiency,
        scrapRate,
      },
    };
  }

  async getWorkCenterMetrics() {
    const workCenters = await prisma.workCenter.findMany({
      where: { active: true },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        capacity: true,
        efficiency: true,
      },
    });

    // Operações por centro de trabalho
    const operationsByCenter = await Promise.all(
      workCenters.map(async (wc) => {
        const operations = await prisma.productionOrderOperation.count({
          where: { workCenterId: wc.id },
        });

        const completedOps = await prisma.productionOrderOperation.count({
          where: {
            workCenterId: wc.id,
            status: 'COMPLETED',
          },
        });

        const inProgressOps = await prisma.productionOrderOperation.count({
          where: {
            workCenterId: wc.id,
            status: 'IN_PROGRESS',
          },
        });

        return {
          workCenter: {
            code: wc.code,
            name: wc.name,
            type: wc.type,
          },
          operations: {
            total: operations,
            completed: completedOps,
            inProgress: inProgressOps,
          },
          capacity: wc.capacity,
          efficiency: wc.efficiency,
        };
      })
    );

    return operationsByCenter;
  }

  async getTopProducts(limit = 5) {
    // Produtos mais produzidos
    const orders = await prisma.productionOrder.findMany({
      where: { status: { in: ['COMPLETED', 'IN_PROGRESS'] } },
      select: {
        productId: true,
        producedQty: true,
        product: {
          select: { code: true, name: true, type: true },
        },
      },
    });

    // Agrupar por produto
    const productMap = new Map<string, { product: any; quantity: number }>();

    orders.forEach((order) => {
      const existing = productMap.get(order.productId);
      if (existing) {
        existing.quantity += order.producedQty;
      } else {
        productMap.set(order.productId, {
          product: order.product,
          quantity: order.producedQty,
        });
      }
    });

    // Ordenar e pegar top N
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);

    return topProducts;
  }

  async getRecentActivity(limit = 10) {
    // Atividades recentes (ordens criadas, apontamentos, etc)
    const recentOrders = await prisma.productionOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        createdAt: true,
        product: {
          select: { code: true, name: true },
        },
      },
    });

    const recentPointings = await prisma.productionPointing.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        quantityGood: true,
        createdAt: true,
        productionOrder: {
          select: { orderNumber: true },
        },
        operation: {
          select: { sequence: true, description: true },
        },
        user: {
          select: { name: true },
        },
      },
    });

    return {
      orders: recentOrders,
      pointings: recentPointings,
    };
  }

  async getProductionTrend(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await prisma.productionOrder.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        quantity: true,
        producedQty: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Agrupar por dia
    const dailyData = new Map<string, { planned: number; produced: number; orders: number }>();

    orders.forEach((order) => {
      const date = order.createdAt.toISOString().split('T')[0];
      const existing = dailyData.get(date) || { planned: 0, produced: 0, orders: 0 };

      existing.planned += order.quantity;
      existing.produced += order.producedQty;
      existing.orders += 1;

      dailyData.set(date, existing);
    });

    return Array.from(dailyData.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));
  }
}

export default new DashboardService();
