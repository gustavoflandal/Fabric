import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de dados de teste...\n');

  // 1. Verificar usuário admin
  let adminUser = await prisma.user.findFirst({
    where: { email: 'admin@fabric.com' }
  });

  if (!adminUser) {
    console.log('❌ Usuário admin não encontrado!');
    return;
  }

  console.log('✅ Usuário admin encontrado:', adminUser.email);

  // 2. Criar produtos de teste
  console.log('\n📦 Criando produtos...');
  const products = [];
  
  for (let i = 1; i <= 20; i++) {
    const product = await prisma.product.upsert({
      where: { code: `PROD-${String(i).padStart(3, '0')}` },
      update: {},
      create: {
        code: `PROD-${String(i).padStart(3, '0')}`,
        name: `Produto Teste ${i}`,
        description: `Descrição do produto ${i}`,
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
    products.push(product);
  }
  console.log(`✅ ${products.length} produtos criados/atualizados`);

  // 3. Criar localizações
  console.log('\n📍 Criando localizações...');
  const locations = [];
  
  for (let i = 1; i <= 10; i++) {
    const location = await prisma.location.upsert({
      where: { code: `LOC-${String(i).padStart(2, '0')}` },
      update: {},
      create: {
        code: `LOC-${String(i).padStart(2, '0')}`,
        name: `Localização ${i}`,
        type: i % 2 === 0 ? 'STORAGE' : 'PRODUCTION',
        isActive: true
      }
    });
    locations.push(location);
  }
  console.log(`✅ ${locations.length} localizações criadas/atualizadas`);

  // 4. Criar movimentações de estoque
  console.log('\n📊 Criando movimentações de estoque...');
  let stockMovementCount = 0;
  
  for (const product of products.slice(0, 10)) {
    for (const location of locations.slice(0, 5)) {
      await prisma.stockMovement.create({
        data: {
          productId: product.id,
          locationId: location.id,
          type: 'IN',
          quantity: 50 + Math.floor(Math.random() * 50),
          unitCost: product.standardCost,
          totalCost: product.standardCost * (50 + Math.floor(Math.random() * 50)),
          reason: 'Entrada inicial de estoque',
          userId: adminUser.id
        }
      });
      stockMovementCount++;
    }
  }
  console.log(`✅ ${stockMovementCount} movimentações criadas`);

  // 5. Criar ordens de produção
  console.log('\n🏭 Criando ordens de produção...');
  const productionOrders = [];
  
  for (let i = 1; i <= 5; i++) {
    const order = await prisma.productionOrder.create({
      data: {
        code: `OP-${String(i).padStart(4, '0')}`,
        productId: products[i].id,
        quantity: 100 + (i * 10),
        status: i === 1 ? 'IN_PROGRESS' : i === 2 ? 'COMPLETED' : 'PENDING',
        priority: i,
        startDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userId: adminUser.id
      }
    });
    productionOrders.push(order);
  }
  console.log(`✅ ${productionOrders.length} ordens de produção criadas`);

  // 6. Criar apontamentos de produção
  console.log('\n⏱️ Criando apontamentos de produção...');
  let pointingCount = 0;
  
  for (const order of productionOrders.slice(0, 3)) {
    await prisma.productionPointing.create({
      data: {
        productionOrderId: order.id,
        userId: adminUser.id,
        startTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
        endTime: new Date(),
        producedQty: 20,
        scrapQty: 2,
        status: 'COMPLETED'
      }
    });
    pointingCount++;
  }
  console.log(`✅ ${pointingCount} apontamentos criados`);

  // 7. Criar notificações
  console.log('\n🔔 Criando notificações...');
  const notifications = [];
  
  const notificationTypes = [
    { type: 'STOCK_LOW', title: 'Estoque Baixo', message: 'O produto PROD-001 está com estoque baixo' },
    { type: 'PRODUCTION_COMPLETED', title: 'Produção Concluída', message: 'Ordem OP-0001 foi concluída' },
    { type: 'COUNTING_PENDING', title: 'Contagem Pendente', message: 'Há uma sessão de contagem aguardando' },
    { type: 'PURCHASE_APPROVED', title: 'Compra Aprovada', message: 'Pedido de compra foi aprovado' },
    { type: 'SYSTEM_INFO', title: 'Atualização do Sistema', message: 'Nova versão disponível' }
  ];
  
  for (const notif of notificationTypes) {
    const notification = await prisma.notification.create({
      data: {
        userId: adminUser.id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        isRead: false
      }
    });
    notifications.push(notification);
  }
  console.log(`✅ ${notifications.length} notificações criadas`);

  // 8. Criar planos de contagem
  console.log('\n📋 Criando planos de contagem...');
  const countingPlans = [];
  
  for (let i = 1; i <= 3; i++) {
    const plan = await prisma.countingPlan.create({
      data: {
        code: `PLAN-${String(i).padStart(3, '0')}`,
        name: `Plano de Contagem ${i}`,
        description: `Plano de teste ${i}`,
        type: i === 1 ? 'FULL' : i === 2 ? 'PARTIAL' : 'CYCLIC',
        frequency: i === 1 ? 'MONTHLY' : i === 2 ? 'WEEKLY' : 'DAILY',
        priority: i * 3,
        status: 'ACTIVE',
        startDate: new Date(),
        userId: adminUser.id
      }
    });
    countingPlans.push(plan);

    // Adicionar produtos ao plano
    for (let j = 0; j < 5; j++) {
      await prisma.countingPlanProduct.create({
        data: {
          planId: plan.id,
          productId: products[i * 5 + j].id,
          priority: 5 - j
        }
      });
    }
  }
  console.log(`✅ ${countingPlans.length} planos de contagem criados`);

  // 9. Criar sessões de contagem
  console.log('\n📝 Criando sessões de contagem...');
  const countingSessions = [];
  
  for (const plan of countingPlans) {
    const session = await prisma.countingSession.create({
      data: {
        code: `SESS-${plan.code}`,
        planId: plan.id,
        scheduledDate: new Date(),
        status: 'PENDING'
      }
    });
    countingSessions.push(session);

    // Criar itens de contagem
    const planProducts = await prisma.countingPlanProduct.findMany({
      where: { planId: plan.id },
      include: { product: true }
    });

    for (const planProduct of planProducts) {
      for (const location of locations.slice(0, 2)) {
        await prisma.countingItem.create({
          data: {
            sessionId: session.id,
            productId: planProduct.productId,
            locationId: location.id,
            systemQty: 50 + Math.floor(Math.random() * 50),
            status: 'PENDING',
            sequence: Math.floor(Math.random() * 100)
          }
        });
      }
    }
  }
  console.log(`✅ ${countingSessions.length} sessões de contagem criadas`);

  // 10. Resumo final
  console.log('\n📊 RESUMO FINAL:');
  const finalCounts = {
    produtos: await prisma.product.count(),
    localizacoes: await prisma.location.count(),
    movimentacoes: await prisma.stockMovement.count(),
    ordensProducao: await prisma.productionOrder.count(),
    apontamentos: await prisma.productionPointing.count(),
    notificacoes: await prisma.notification.count(),
    planosContagem: await prisma.countingPlan.count(),
    sessoesContagem: await prisma.countingSession.count(),
    itensContagem: await prisma.countingItem.count()
  };

  console.log(JSON.stringify(finalCounts, null, 2));
  console.log('\n✅ Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
