import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPointings() {
  console.log('🌱 Iniciando seed de apontamentos de produção...');

  try {
    // Buscar ordens de produção e usuários
    const orders = await prisma.productionOrder.findMany({
      where: {
        status: { in: ['IN_PROGRESS', 'COMPLETED'] }
      },
      include: {
        operations: true,
      },
      take: 10,
    });

    const users = await prisma.user.findMany({ take: 3 });
    
    if (orders.length === 0 || users.length === 0) {
      console.log('⚠️  Ordens ou usuários não encontrados.');
      return;
    }

    console.log(`✅ Encontradas ${orders.length} ordens e ${users.length} usuários`);

    // Deletar apontamentos antigos
    await prisma.productionPointing.deleteMany({});
    console.log('🗑️  Apontamentos antigos deletados');

    const pointings: any[] = [];
    const today = new Date();

    // Para cada ordem, criar apontamentos nas operações
    for (const order of orders) {
      if (order.operations.length === 0) continue;

      // Criar apontamentos para cada operação
      for (let i = 0; i < order.operations.length; i++) {
        const operation = order.operations[i];
        const user = users[i % users.length];

        // Apontamentos concluídos (operações anteriores)
        if (i < order.operations.length - 1 || order.status === 'COMPLETED') {
          const daysAgo = Math.floor(Math.random() * 20) + 1;
          const startTime = new Date(today);
          startTime.setDate(startTime.getDate() - daysAgo);
          startTime.setHours(8, 0, 0, 0);

          const endTime = new Date(startTime);
          const duration = 2 + Math.floor(Math.random() * 6); // 2-8 horas
          endTime.setHours(startTime.getHours() + duration);

          const quantityGood = Math.floor(order.quantity * (0.85 + Math.random() * 0.15));
          const quantityScrap = Math.floor(quantityGood * (Math.random() * 0.05)); // 0-5% refugo

          pointings.push({
            productionOrderId: order.id,
            operationId: operation.id,
            userId: user.id,
            startTime,
            endTime,
            quantityGood,
            quantityScrap,
            notes: `Apontamento automático - Op ${operation.sequence}`,
          });
        } 
        // Apontamentos em andamento (última operação de ordens IN_PROGRESS)
        else if (order.status === 'IN_PROGRESS') {
          const startTime = new Date(today);
          startTime.setHours(8, 0, 0, 0);

          pointings.push({
            productionOrderId: order.id,
            operationId: operation.id,
            userId: user.id,
            startTime,
            endTime: null,
            quantityGood: 0,
            quantityScrap: 0,
            notes: `Em andamento - Op ${operation.sequence}`,
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
    const completed = pointings.filter(p => p.endTime !== null).length;
    const inProgress = pointings.filter(p => p.endTime === null).length;

    console.log('\n📊 Resumo:');
    console.log(`   - Concluídos: ${completed}`);
    console.log(`   - Em Andamento: ${inProgress}`);
    console.log(`   - Total: ${pointings.length}`);
    console.log(`   - Ordens: ${orders.length}`);

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
