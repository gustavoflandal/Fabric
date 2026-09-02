const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando dados existentes...\n');

  // Verificar contagens
  const counts = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    notifications: await prisma.notification.count(),
    stockMovements: await prisma.stockMovement.count(),
    productionOrders: await prisma.productionOrder.count(),
    productionPointings: await prisma.productionPointing.count(),
    countingPlans: await prisma.countingPlan.count(),
    countingSessions: await prisma.countingSession.count(),
    countingItems: await prisma.countingItem.count()
  };

  console.log('📊 Contagem atual:');
  console.log(JSON.stringify(counts, null, 2));

  // Buscar usuário admin
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@fabric.com' }
  });

  if (!adminUser) {
    console.log('\n❌ Usuário admin não encontrado!');
    return;
  }

  console.log('\n✅ Usuário admin:', adminUser.email);

  // Verificar notificações não lidas
  const unreadNotifications = await prisma.notification.findMany({
    where: {
      userId: adminUser.id,
      read: false
    },
    take: 5
  });

  console.log(`\n🔔 Notificações não lidas: ${unreadNotifications.length}`);
  if (unreadNotifications.length > 0) {
    console.log('Exemplos:', unreadNotifications.map(n => n.title));
  }

  // Se não houver dados suficientes, criar
  if (counts.products < 10) {
    console.log('\n📦 Criando produtos de teste...');
    for (let i = 1; i <= 20; i++) {
      await prisma.product.upsert({
        where: { code: `PROD-${String(i).padStart(3, '0')}` },
        update: {},
        create: {
          code: `PROD-${String(i).padStart(3, '0')}`,
          name: `Produto Teste ${i}`,
          description: `Produto para testes ${i}`,
          type: i % 3 === 0 ? 'FINISHED' : i % 3 === 1 ? 'RAW_MATERIAL' : 'SEMI_FINISHED',
          unitOfMeasure: 'UN',
          minStock: 10,
          maxStock: 100,
          reorderPoint: 20,
          standardCost: 10 + (i * 2),
          sellingPrice: 20 + (i * 3),
          isActive: true
        }
      });
    }
    console.log('✅ 20 produtos criados');
  }

  // F3.1 do plano do WMS: o bloco que semeava `Location` saiu junto com o model.
  // O endereçamento do sistema é `Warehouse -> WarehouseStructure ->
  // StoragePosition`, semeado por scripts/seed-warehouses.ts e
  // scripts/seed-warehouse-structures.ts.

  if (counts.notifications < 5) {
    console.log('\n🔔 Criando notificações...');
    const notificationTypes = [
      { type: 'STOCK_LOW', title: 'Estoque Baixo', message: 'O produto PROD-001 está com estoque baixo' },
      { type: 'PRODUCTION_COMPLETED', title: 'Produção Concluída', message: 'Ordem OP-0001 foi concluída' },
      { type: 'COUNTING_PENDING', title: 'Contagem Pendente', message: 'Há uma sessão de contagem aguardando' },
      { type: 'PURCHASE_APPROVED', title: 'Compra Aprovada', message: 'Pedido de compra foi aprovado' },
      { type: 'SYSTEM_INFO', title: 'Atualização do Sistema', message: 'Nova versão disponível' }
    ];
    
    for (const notif of notificationTypes) {
      await prisma.notification.create({
        data: {
          userId: adminUser.id,
          type: notif.type,
          category: 'SYSTEM',
          eventType: notif.type,
          title: notif.title,
          message: notif.message,
          read: false,
          archived: false,
          priority: 5
        }
      });
    }
    console.log('✅ 5 notificações criadas');
  }

  if (counts.countingPlans < 2) {
    console.log('\n📋 Criando planos de contagem...');
    
    const products = await prisma.product.findMany({ take: 15 });

    for (let i = 1; i <= 3; i++) {
      const plan = await prisma.countingPlan.create({
        data: {
          code: `PLAN-${String(i).padStart(3, '0')}`,
          name: `Plano de Contagem ${i}`,
          description: `Plano de teste ${i} - ${i === 1 ? 'Mensal' : i === 2 ? 'Semanal' : 'Diário'}`,
          type: i === 1 ? 'FULL_INVENTORY' : i === 2 ? 'SPOT' : 'CYCLIC',
          frequency: i === 1 ? 'MONTHLY' : i === 2 ? 'WEEKLY' : 'DAILY',
          status: 'ACTIVE',
          startDate: new Date(),
          creator: {
            connect: { id: adminUser.id }
          }
        }
      });

      // Adicionar produtos ao plano
      for (let j = 0; j < 5; j++) {
        const product = products[i * 5 + j];
        if (product) {
          await prisma.countingPlanProduct.create({
            data: {
              planId: plan.id,
              productId: product.id,
              priority: 5 - j
            }
          });
        }
      }

      // Criar sessão
      const session = await prisma.countingSession.create({
        data: {
          code: `SESS-${plan.code}-001`,
          plan: { connect: { id: plan.id } },
          scheduledDate: new Date(),
          status: i === 1 ? 'IN_PROGRESS' : 'SCHEDULED'
        }
      });

      // Criar itens de contagem
      const planProducts = await prisma.countingPlanProduct.findMany({
        where: { planId: plan.id }
      });

      // F3.1/F3.2: item de contagem SEM endereço - é o caminho só-PCP, e este
      // script não semeia saldo por posição. Com WMS licenciado, quem gera item
      // endereçado é countingSessionService.create(), a partir de
      // StockPositionBalance.
      for (const planProduct of planProducts) {
        await prisma.countingItem.create({
          data: {
            sessionId: session.id,
            productId: planProduct.productId,
            systemQty: 50 + Math.floor(Math.random() * 50),
            status: 'PENDING'
          }
        });
      }
    }
    console.log('✅ 3 planos de contagem criados com sessões e itens');
  }

  if (counts.productionOrders < 3) {
    console.log('\n🏭 Criando ordens de produção...');
    const products = await prisma.product.findMany({ 
      take: 5 
    });

    for (let i = 0; i < Math.min(5, products.length); i++) {
      await prisma.productionOrder.create({
        data: {
          orderNumber: `OP-${String(i + 1).padStart(4, '0')}`,
          productId: products[i].id,
          quantity: 100 + (i * 10),
          status: i === 0 ? 'IN_PROGRESS' : i === 1 ? 'COMPLETED' : 'PENDING',
          priority: i + 1,
          startDate: new Date(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          createdBy: adminUser.id
        }
      });
    }
    console.log('✅ Ordens de produção criadas');
  }

  if (counts.stockMovements < 10) {
    console.log('\n📊 Criando movimentações de estoque...');
    const products = await prisma.product.findMany({ take: 10 });

    for (const product of products) {
      const qty = 50 + Math.floor(Math.random() * 50);
      await prisma.stockMovement.create({
        data: {
          product: { connect: { id: product.id } },
          type: 'IN',
          quantity: qty,
          reason: 'Entrada inicial de estoque',
          user: { connect: { id: adminUser.id } }
        }
      });
    }
    console.log('✅ Movimentações de estoque criadas');
  }

  // Contagem final
  console.log('\n📊 CONTAGEM FINAL:');
  const finalCounts = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    notifications: await prisma.notification.count(),
    stockMovements: await prisma.stockMovement.count(),
    productionOrders: await prisma.productionOrder.count(),
    countingPlans: await prisma.countingPlan.count(),
    countingSessions: await prisma.countingSession.count(),
    countingItems: await prisma.countingItem.count()
  };
  console.log(JSON.stringify(finalCounts, null, 2));

  console.log('\n✅ Processo concluído!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
