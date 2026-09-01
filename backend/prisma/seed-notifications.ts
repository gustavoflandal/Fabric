import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔔 Iniciando seed de notificações...\n');

  // Buscar usuários existentes
  const users = await prisma.user.findMany({
    take: 5,
  });

  if (users.length === 0) {
    console.log('❌ Nenhum usuário encontrado. Execute o seed principal primeiro.');
    return;
  }

  console.log(`✅ ${users.length} usuários encontrados\n`);

  // Buscar algumas ordens de produção para referência
  const orders = await prisma.productionOrder.findMany({
    take: 3,
    include: {
      product: true,
    },
  });

  // Buscar alguns produtos para referência
  const products = await prisma.product.findMany({
    take: 3,
  });

  // Buscar centros de trabalho
  const workCenters = await prisma.workCenter.findMany({
    take: 2,
  });

  const notifications = [];
  
  console.log('📝 Criando notificações variadas para teste...\n');

  // Para cada usuário, criar notificações variadas
  for (const user of users) {
    // 1. NOTIFICAÇÃO CRÍTICA - Material Indisponível
    if (orders.length > 0) {
      notifications.push({
        userId: user.id,
        type: 'ERROR',
        category: 'PRODUCTION',
        eventType: 'MATERIAL_UNAVAILABLE',
        title: 'Material Indisponível',
        message: `Material Chip A15 necessário para OP ${orders[0].orderNumber} não está disponível. Necessário: 100, Disponível: 45`,
        data: {
          orderNumber: orders[0].orderNumber,
          materialName: 'Chip A15',
          required: 100,
          available: 45,
          shortage: 55,
        },
        link: `/production/orders/${orders[0].id}`,
        resourceType: 'ProductionOrder',
        resourceId: orders[0].id,
        priority: 4,
        read: false,
        archived: false,
      });
    }

    // 2. NOTIFICAÇÃO CRÍTICA - Taxa de Refugo Alta
    if (orders.length > 1) {
      notifications.push({
        userId: user.id,
        type: 'ERROR',
        category: 'QUALITY',
        eventType: 'QUALITY_SCRAP_HIGH',
        title: 'Taxa de Refugo Crítica',
        message: `OP ${orders[1].orderNumber} registrou 8.5% de refugo (limite: 5%). Investigação necessária.`,
        data: {
          orderNumber: orders[1].orderNumber,
          scrapRate: 8.5,
          maxScrapRate: 5,
          scrapQty: 17,
          goodQty: 200,
        },
        link: `/production/orders/${orders[1].id}`,
        resourceType: 'ProductionOrder',
        resourceId: orders[1].id,
        priority: 4,
        read: false,
        archived: false,
      });
    }

    // 3. NOTIFICAÇÃO ALTA - Ordem Atrasada
    if (orders.length > 0) {
      notifications.push({
        userId: user.id,
        type: 'WARNING',
        category: 'PRODUCTION',
        eventType: 'PRODUCTION_DELAYED',
        title: 'Ordem de Produção Atrasada',
        message: `OP ${orders[0].orderNumber} (${orders[0].product.name}) está atrasada em 3 dias`,
        data: {
          orderNumber: orders[0].orderNumber,
          productName: orders[0].product.name,
          delayDays: 3,
        },
        link: `/production/orders/${orders[0].id}`,
        resourceType: 'ProductionOrder',
        resourceId: orders[0].id,
        priority: 3,
        read: false,
        archived: false,
      });
    }

    // 4. NOTIFICAÇÃO ALTA - Gargalo Detectado
    if (workCenters.length > 0) {
      notifications.push({
        userId: user.id,
        type: 'WARNING',
        category: 'PRODUCTION',
        eventType: 'BOTTLENECK_DETECTED',
        title: 'Gargalo Detectado',
        message: `Centro de trabalho "${workCenters[0].name}" possui 8 operações na fila`,
        data: {
          workCenterId: workCenters[0].id,
          workCenterName: workCenters[0].name,
          queueSize: 8,
          threshold: 5,
        },
        link: `/work-centers/${workCenters[0].id}`,
        resourceType: 'WorkCenter',
        resourceId: workCenters[0].id,
        priority: 3,
        read: false,
        archived: false,
      });
    }

    // 5. NOTIFICAÇÃO ALTA - Estoque Baixo
    if (products.length > 0) {
      notifications.push({
        userId: user.id,
        type: 'WARNING',
        category: 'STOCK',
        eventType: 'STOCK_BELOW_SAFETY',
        title: 'Estoque Abaixo do Mínimo',
        message: `${products[0].name}: 15 unidades (mínimo: 50 unidades)`,
        data: {
          productCode: products[0].code,
          productName: products[0].name,
          currentStock: 15,
          minStock: 50,
        },
        link: `/stock/products/${products[0].id}`,
        resourceType: 'Product',
        resourceId: products[0].id,
        priority: 3,
        read: false,
        archived: false,
      });
    }

    // 6. NOTIFICAÇÃO MÉDIA - Operação Concluída
    if (orders.length > 2) {
      notifications.push({
        userId: user.id,
        type: 'SUCCESS',
        category: 'PRODUCTION',
        eventType: 'OPERATION_COMPLETED',
        title: 'Operação Concluída',
        message: `${user.name} concluiu operação de Montagem da OP ${orders[2].orderNumber}`,
        data: {
          orderNumber: orders[2].orderNumber,
          operationName: 'Montagem',
          operatorName: user.name,
          goodQty: 100,
          scrapQty: 2,
        },
        link: `/production/orders/${orders[2].id}`,
        resourceType: 'ProductionOrder',
        resourceId: orders[2].id,
        priority: 2,
        read: true, // Já lida
        readAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
        archived: false,
      });
    }

    // 7. NOTIFICAÇÃO MÉDIA - Capacidade Baixa
    if (workCenters.length > 1) {
      notifications.push({
        userId: user.id,
        type: 'INFO',
        category: 'CAPACITY',
        eventType: 'CAPACITY_LOW',
        title: 'Capacidade Reduzida',
        message: `${workCenters[1].name} operando a 65% da capacidade`,
        data: {
          workCenterId: workCenters[1].id,
          workCenterName: workCenters[1].name,
          capacityPercent: 65,
        },
        link: `/work-centers/${workCenters[1].id}`,
        resourceType: 'WorkCenter',
        resourceId: workCenters[1].id,
        priority: 2,
        read: false,
        archived: false,
      });
    }

    // 8. NOTIFICAÇÃO BAIXA - Informativa (já lida e arquivada)
    if (products.length > 1) {
      notifications.push({
        userId: user.id,
        type: 'INFO',
        category: 'STOCK',
        eventType: 'STOCK_MOVEMENT',
        title: 'Entrada de Material',
        message: `Recebimento de ${products[1].name}: 500 unidades`,
        data: {
          productName: products[1].name,
          quantity: 500,
          type: 'IN',
        },
        link: `/stock/products/${products[1].id}`,
        resourceType: 'Product',
        resourceId: products[1].id,
        priority: 1,
        read: true,
        readAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 dia atrás
        archived: true,
        archivedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 horas atrás
      });
    }

    // 9. NOTIFICAÇÃO CRÍTICA - Estoque Zerado
    if (products.length > 2) {
      notifications.push({
        userId: user.id,
        type: 'ERROR',
        category: 'STOCK',
        eventType: 'STOCK_BELOW_SAFETY',
        title: 'Estoque Zerado',
        message: `${products[2].name}: 0 unidades disponíveis. Produção pode parar!`,
        data: {
          productCode: products[2].code,
          productName: products[2].name,
          currentStock: 0,
          minStock: 100,
        },
        link: `/stock/products/${products[2].id}`,
        resourceType: 'Product',
        resourceId: products[2].id,
        priority: 4,
        read: false,
        archived: false,
      });
    }

    // 10. NOTIFICAÇÃO ALTA - Pedido de Compra Aprovado
    notifications.push({
      userId: user.id,
      type: 'SUCCESS',
      category: 'PURCHASE',
      eventType: 'PURCHASE_ORDER_APPROVED',
      title: 'Pedido de Compra Aprovado',
      message: `Pedido PC-2025-0156 no valor de R$ 45.890,00 foi aprovado`,
      data: {
        orderNumber: 'PC-2025-0156',
        value: 45890.00,
        supplier: 'TechSupply Ltda',
      },
      link: `/purchases/orders`,
      resourceType: 'PurchaseOrder',
      resourceId: 'temp-id',
      priority: 2,
      read: false,
      archived: false,
    });

    // 11. NOTIFICAÇÃO MÉDIA - Manutenção Programada
    if (workCenters.length > 0) {
      notifications.push({
        userId: user.id,
        type: 'WARNING',
        category: 'CAPACITY',
        eventType: 'MAINTENANCE_SCHEDULED',
        title: 'Manutenção Programada',
        message: `${workCenters[0].name} terá manutenção preventiva amanhã às 14h`,
        data: {
          workCenterId: workCenters[0].id,
          workCenterName: workCenters[0].name,
          scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        link: `/work-centers/${workCenters[0].id}`,
        resourceType: 'WorkCenter',
        resourceId: workCenters[0].id,
        priority: 2,
        read: false,
        archived: false,
      });
    }

    // 12. NOTIFICAÇÃO ALTA - Meta de Produção Atingida
    if (orders.length > 1) {
      notifications.push({
        userId: user.id,
        type: 'SUCCESS',
        category: 'PRODUCTION',
        eventType: 'PRODUCTION_GOAL_ACHIEVED',
        title: 'Meta de Produção Atingida',
        message: `Parabéns! Meta mensal de 5.000 unidades foi atingida com 3 dias de antecedência`,
        data: {
          goal: 5000,
          achieved: 5234,
          percentage: 104.68,
        },
        link: `/reports`,
        resourceType: 'Report',
        resourceId: 'monthly-goal',
        priority: 1,
        read: false,
        archived: false,
      });
    }
  }

  // Criar notificações no banco
  console.log(`📝 Criando ${notifications.length} notificações...\n`);

  let created = 0;
  for (const notification of notifications) {
    await prisma.notification.create({
      data: notification,
    });
    created++;
    
    const icon = notification.priority === 4 ? '🔴' : 
                 notification.priority === 3 ? '⚠️' : 
                 notification.priority === 2 ? '📊' : '📋';
    
    console.log(`${icon} ${notification.title} (${notification.category}) - Prioridade ${notification.priority}`);
  }

  console.log(`\n✅ ${created} notificações criadas com sucesso!\n`);

  // Estatísticas
  const stats = await prisma.notification.groupBy({
    by: ['priority'],
    _count: true,
  });

  console.log('📊 Estatísticas:');
  stats.forEach(stat => {
    const label = stat.priority === 4 ? 'Críticas' :
                  stat.priority === 3 ? 'Altas' :
                  stat.priority === 2 ? 'Médias' : 'Baixas';
    console.log(`   ${label}: ${stat._count}`);
  });

  const unreadCount = await prisma.notification.count({
    where: { read: false },
  });

  console.log(`   Não lidas: ${unreadCount}`);
  console.log(`   Total: ${created}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar notificações:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
