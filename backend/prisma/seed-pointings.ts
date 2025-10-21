import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPointings() {
  console.log('⏱️  Iniciando seed de apontamentos de produção...\n');

  try {
    // Buscar ordens de produção e usuários
    const orders = await prisma.productionOrder.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'COMPLETED'] }
      },
      include: {
        operations: {
          orderBy: { sequence: 'asc' }
        },
        product: true,
      },
    });

    const users = await prisma.user.findMany();
    
    if (orders.length === 0 || users.length === 0) {
      console.log('⚠️  Ordens ou usuários não encontrados.');
      return;
    }

    console.log(`✅ Encontradas ${orders.length} ordens e ${users.length} usuários`);

    // Deletar apontamentos antigos
    await prisma.productionPointing.deleteMany({});
    console.log('🗑️  Apontamentos antigos deletados\n');

    const pointings: any[] = [];
    const today = new Date();

    // Para cada ordem, criar apontamentos nas operações
    for (const order of orders) {
      if (order.operations.length === 0) continue;

      // Criar apontamentos para cada operação
      for (let i = 0; i < order.operations.length; i++) {
        const operation = order.operations[i];
        const user = users[i % users.length];

        // Criar apontamentos apenas para operações concluídas
        if (operation.status === 'COMPLETED' || order.status === 'COMPLETED') {
          const daysAgo = Math.floor(Math.random() * 20) + 1;
          const startTime = new Date(today);
          startTime.setDate(startTime.getDate() - daysAgo);
          startTime.setHours(8, 0, 0, 0);

          const endTime = new Date(startTime);
          const duration = 2 + Math.floor(Math.random() * 6); // 2-8 horas
          endTime.setHours(startTime.getHours() + duration);

          const quantityGood = Math.floor(order.quantity * (0.85 + Math.random() * 0.15));
          const quantityScrap = Math.floor(quantityGood * (Math.random() * 0.05)); // 0-5% refugo
          const runTime = duration * 60; // converter horas em minutos

          pointings.push({
            productionOrderId: order.id,
            operationId: operation.id,
            userId: user.id,
            startTime,
            endTime,
            runTime,
            quantityGood,
            quantityScrap,
            notes: `Apontamento automático - Op ${operation.sequence}`,
          });
        }
      }
    }

    // Criar apontamentos
    console.log('📦 Criando apontamentos...');
    for (const pointing of pointings) {
      await prisma.productionPointing.create({
        data: pointing,
      });
    }

    console.log(`✅ ${pointings.length} apontamentos criados com sucesso!`);

    // Estatísticas
    const totalQuantityGood = pointings.reduce((sum, p) => sum + p.quantityGood, 0);
    const totalQuantityScrap = pointings.reduce((sum, p) => sum + p.quantityScrap, 0);
    const scrapRate = totalQuantityGood > 0 ? (totalQuantityScrap / (totalQuantityGood + totalQuantityScrap)) * 100 : 0;

    console.log('\n📊 Resumo:');
    console.log(`   - Apontamentos: ${pointings.length}`);
    console.log(`   - Ordens: ${orders.length}`);
    console.log(`   - Quantidade Boa: ${totalQuantityGood}`);
    console.log(`   - Quantidade Refugo: ${totalQuantityScrap}`);
    console.log(`   - Taxa de Refugo: ${scrapRate.toFixed(2)}%`);

  } catch (error) {
    console.error('❌ Erro ao criar apontamentos:', error);
    throw error;
  }
}

seedPointings()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✅ Seed de apontamentos concluído!');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
