import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProduction() {
  console.log('🌱 Iniciando seed de dados de produção...');

  try {
    // Buscar dados necessários. Prioriza produtos que já têm roteiro ativo —
    // sem roteiro, a ordem não ganha operações, e sem operações
    // seed-pointings.ts não tem em que basear apontamentos (a tela de
    // Apontamentos de Produção ficaria sempre vazia).
    const allProducts = await prisma.product.findMany({
      where: { active: true },
      include: {
        routings: {
          where: { active: true },
          include: { operations: { orderBy: { sequence: 'asc' } } },
        },
      },
    });
    const productsWithRouting = allProducts.filter((p) => p.routings.length > 0);
    const products = (productsWithRouting.length > 0 ? productsWithRouting : allProducts).slice(0, 5);

    const users = await prisma.user.findMany({ take: 3 });
    
    if (products.length === 0) {
      console.log('⚠️  Nenhum produto encontrado. Execute o seed principal primeiro.');
      return;
    }
    
    if (users.length === 0) {
      console.log('⚠️  Nenhum usuário encontrado. Execute o seed principal primeiro.');
      return;
    }
    
    console.log(`✅ Encontrados ${products.length} produtos e ${users.length} usuários`);

    // Deletar ordens existentes para recriar
    console.log('🗑️  Deletando ordens existentes...');
    await prisma.productionOrder.deleteMany({});
    console.log('✅ Ordens deletadas');

    const userId = users[0].id;

    // Criar ordens de produção com diferentes status e datas
    const today = new Date();
    // Cada entrada guarda o `product` (com o roteiro já incluído) ao lado do
    // `data` da ordem, para depois da criação poder gerar as operações
    // (ProductionOrderOperation) copiando do roteiro do produto.
    const ordersData: Array<{ data: any; product: (typeof products)[number] }> = [];

    // Ordens concluídas (últimos 30 dias)
    for (let i = 0; i < 10; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - daysAgo - 5);
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const product = products[i % products.length];
      const quantity = 50 + Math.floor(Math.random() * 150);
      const producedQty = Math.floor(quantity * (0.85 + Math.random() * 0.15)); // 85-100%
      const scrapQty = Math.floor(producedQty * (Math.random() * 0.1)); // 0-10% de refugo

      ordersData.push({
        data: {
          orderNumber: `OP-2025-${String(i + 1).padStart(3, '0')}`,
          productId: product.id,
          quantity,
          producedQty,
          scrapQty,
          status: 'COMPLETED',
          priority: Math.floor(Math.random() * 3) + 1,
          scheduledStart: startDate,
          scheduledEnd: endDate,
          actualStart: startDate,
          actualEnd: endDate,
          createdBy: userId,
        },
        product,
      });
    }

    // Ordens em andamento
    for (let i = 10; i < 15; i++) {
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 2);
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);

      const product = products[i % products.length];
      const quantity = 50 + Math.floor(Math.random() * 150);
      const producedQty = Math.floor(quantity * (Math.random() * 0.6)); // 0-60% produzido
      const scrapQty = Math.floor(producedQty * (Math.random() * 0.08));

      ordersData.push({
        data: {
          orderNumber: `OP-2025-${String(i + 1).padStart(3, '0')}`,
          productId: product.id,
          quantity,
          producedQty,
          scrapQty,
          status: 'IN_PROGRESS',
          priority: Math.floor(Math.random() * 3) + 1,
          scheduledStart: startDate,
          scheduledEnd: endDate,
          actualStart: startDate,
          actualEnd: null,
          createdBy: userId,
        },
        product,
      });
    }

    // Ordens planejadas
    for (let i = 15; i < 20; i++) {
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 10) + 1);
      
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 4);

      const product = products[i % products.length];
      const quantity = 50 + Math.floor(Math.random() * 150);

      ordersData.push({
        data: {
          orderNumber: `OP-2025-${String(i + 1).padStart(3, '0')}`,
          productId: product.id,
          quantity,
          producedQty: 0,
          scrapQty: 0,
          status: 'PLANNED',
          priority: Math.floor(Math.random() * 3) + 1,
          scheduledStart: startDate,
          scheduledEnd: endDate,
          actualStart: null,
          actualEnd: null,
          createdBy: userId,
        },
        product,
      });
    }

    // Criar ordens em lote e, para cada uma, as operações copiadas do
    // roteiro ativo do produto — sem isso a ordem não tem em que
    // seed-pointings.ts se basear para gerar apontamentos, e a tela de
    // Apontamentos de Produção fica sempre vazia.
    console.log('📦 Criando ordens de produção...');
    let operationsCreated = 0;
    for (const { data, product } of ordersData) {
      const order = await prisma.productionOrder.create({ data });

      const routingOperations = product.routings[0]?.operations ?? [];
      if (routingOperations.length === 0) continue;

      // Quantas operações já estão concluídas, de acordo com o status da ordem.
      const completedCount =
        data.status === 'COMPLETED'
          ? routingOperations.length
          : data.status === 'IN_PROGRESS'
            ? Math.max(1, Math.floor(routingOperations.length / 2))
            : 0;

      for (let opIndex = 0; opIndex < routingOperations.length; opIndex++) {
        const routingOp = routingOperations[opIndex];
        const isCompleted = opIndex < completedCount;
        const isCurrent = data.status === 'IN_PROGRESS' && opIndex === completedCount;
        const status = isCompleted ? 'COMPLETED' : isCurrent ? 'IN_PROGRESS' : 'PENDING';

        const totalPlannedTime = routingOp.setupTime + routingOp.runTime * data.quantity;
        const completedQty = isCompleted ? data.quantity : isCurrent ? Math.floor(data.quantity * 0.4) : 0;

        await prisma.productionOrderOperation.create({
          data: {
            productionOrderId: order.id,
            sequence: routingOp.sequence,
            workCenterId: routingOp.workCenterId,
            description: routingOp.description,
            plannedQty: data.quantity,
            completedQty,
            scrapQty: isCompleted ? Math.floor(completedQty * (Math.random() * 0.05)) : 0,
            setupTime: routingOp.setupTime,
            runTime: routingOp.runTime,
            totalPlannedTime,
            actualTime: isCompleted || isCurrent ? totalPlannedTime * (0.9 + Math.random() * 0.2) : 0,
            status,
            actualStart: isCompleted || isCurrent ? data.actualStart : null,
            actualEnd: isCompleted ? data.actualEnd ?? data.actualStart : null,
          },
        });
        operationsCreated++;
      }
    }

    console.log(`✅ ${ordersData.length} ordens de produção criadas com sucesso!`);
    console.log(`✅ ${operationsCreated} operações de ordem criadas!`);

    // Estatísticas
    const completed = ordersData.filter((o) => o.data.status === 'COMPLETED').length;
    const inProgress = ordersData.filter((o) => o.data.status === 'IN_PROGRESS').length;
    const planned = ordersData.filter((o) => o.data.status === 'PLANNED').length;

    console.log('\n📊 Resumo:');
    console.log(`   - Concluídas: ${completed}`);
    console.log(`   - Em Andamento: ${inProgress}`);
    console.log(`   - Planejadas: ${planned}`);
    console.log(`   - Total: ${ordersData.length}`);

    const totalProduced = ordersData.reduce((sum, o) => sum + o.data.producedQty, 0);
    const totalScrap = ordersData.reduce((sum, o) => sum + o.data.scrapQty, 0);
    const scrapRate = totalProduced > 0 ? (totalScrap / (totalProduced + totalScrap)) * 100 : 0;

    console.log(`\n📈 Métricas:`);
    console.log(`   - Total Produzido: ${totalProduced}`);
    console.log(`   - Total Refugo: ${totalScrap}`);
    console.log(`   - Taxa de Refugo: ${scrapRate.toFixed(2)}%`);

  } catch (error) {
    console.error('❌ Erro ao criar dados de produção:', error);
    throw error;
  }
}

seedProduction()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✅ Seed de produção concluído!');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
