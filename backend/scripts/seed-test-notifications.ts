import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTestNotifications() {
  try {
    console.log('🚀 Iniciando criação de notificações de teste...\n');

    // Busca o usuário admin
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@fabric.com' }
    });

    if (!adminUser) {
      console.error('❌ Usuário admin não encontrado!');
      return;
    }

    console.log(`✅ Usuário encontrado: ${adminUser.name} (${adminUser.email})\n`);

    // Limpar notificações antigas primeiro
    await prisma.notification.deleteMany({
      where: { userId: adminUser.id }
    });
    console.log('🗑️  Notificações antigas removidas\n');

    // Notificações críticas de produção (no estilo da imagem)
    const criticalNotifications = [
      {
        userId: adminUser.id,
        type: 'INFO',
        category: 'PURCHASE',
        eventType: 'PURCHASE_APPROVED',
        title: 'Compra Aprovada',
        message: 'Pedido de compra foi aprovado',
        priority: 3, // HIGH
        link: '/purchases',
        resourceType: 'Purchase',
        resourceId: 'purchase-001',
        data: JSON.stringify({
          purchaseId: 'purchase-001',
          status: 'approved',
        }),
      },
      {
        userId: adminUser.id,
        type: 'ALERT',
        category: 'COUNTING',
        eventType: 'COUNTING_PENDING',
        title: 'Contagem Pendente',
        message: 'Há uma sessão de contagem aguardando',
        priority: 3, // HIGH
        link: '/inventory/counting',
        resourceType: 'Counting',
        resourceId: 'counting-001',
        data: JSON.stringify({
          countingId: 'counting-001',
          status: 'pending',
        }),
      },
      {
        userId: adminUser.id,
        type: 'INFO',
        category: 'PRODUCTION',
        eventType: 'PRODUCTION_COMPLETED',
        title: 'Produção Concluída',
        message: 'Ordem OP-0001 foi concluída',
        priority: 3, // HIGH
        link: '/pcp/production-orders/op-0001',
        resourceType: 'ProductionOrder',
        resourceId: 'op-0001',
        data: JSON.stringify({
          orderId: 'op-0001',
          status: 'completed',
        }),
      },
      {
        userId: adminUser.id,
        type: 'ALERT',
        category: 'STOCK',
        eventType: 'STOCK_LOW',
        title: 'Estoque Baixo',
        message: 'O produto PROD-001 está com estoque baixo',
        priority: 3, // HIGH
        link: '/inventory/products/prod-001',
        resourceType: 'Product',
        resourceId: 'prod-001',
        data: JSON.stringify({
          productId: 'prod-001',
          currentStock: 5,
          minimumStock: 20,
        }),
      },
    ];

    // Cria as notificações
    console.log('📝 Criando notificações...\n');
    
    for (const notification of criticalNotifications) {
      const created = await prisma.notification.create({
        data: notification,
      });
      
      const priorityLabel = ['', 'BAIXA', 'MÉDIA', 'ALTA', 'CRÍTICA'][created.priority];
      console.log(`✅ Criada: ${created.title} [${priorityLabel}]`);
    }

    // Estatísticas finais
    const totalNotifications = await prisma.notification.count({
      where: { userId: adminUser.id },
    });

    const criticalCount = await prisma.notification.count({
      where: { 
        userId: adminUser.id,
        priority: { gte: 3 },
        read: false,
        archived: false,
      },
    });

    console.log('\n📊 Estatísticas:');
    console.log(`   Total de notificações: ${totalNotifications}`);
    console.log(`   Notificações críticas não lidas: ${criticalCount}`);
    console.log('\n✅ Notificações de teste criadas com sucesso!');
    console.log('💡 Acesse o sistema para visualizá-las no centro de notificações.');

  } catch (error) {
    console.error('❌ Erro ao criar notificações:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedTestNotifications();
