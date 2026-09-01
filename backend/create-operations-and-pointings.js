// Script para criar operações e apontamentos
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Criando operações e apontamentos...\n');

  // Buscar ordens
  const orders = await prisma.productionOrder.findMany({
    take: 10,
    include: {
      product: {
        include: {
          routings: {
            where: { active: true },
            include: {
              operations: {
                include: {
                  workCenter: true
                }
              }
            }
          }
        }
      }
    }
  });

  console.log(`📦 Encontradas ${orders.length} ordens`);

  const users = await prisma.user.findMany({ take: 3 });

  // Para cada ordem, criar operações baseadas no roteiro
  for (const order of orders) {
    const routing = order.product.routings[0];
    
    if (!routing || routing.operations.length === 0) {
      console.log(`⚠️  Ordem ${order.orderNumber} sem roteiro, criando operações padrão...`);
      
      // Criar operações padrão
      const defaultOps = [
        { sequence: 10, description: 'Preparação', setupTime: 30, runTime: 60 },
        { sequence: 20, description: 'Processamento', setupTime: 15, runTime: 120 },
        { sequence: 30, description: 'Acabamento', setupTime: 15, runTime: 45 },
        { sequence: 40, description: 'Inspeção', setupTime: 0, runTime: 30 },
      ];

      const workCenters = await prisma.workCenter.findMany({ take: 4 });

      for (let i = 0; i < defaultOps.length; i++) {
        const op = defaultOps[i];
        await prisma.productionOrderOperation.create({
          data: {
            productionOrderId: order.id,
            sequence: op.sequence,
            description: op.description,
            workCenterId: workCenters[i % workCenters.length].id,
            setupTime: op.setupTime,
            runTime: op.runTime,
            plannedQty: order.quantity,
            completedQty: 0,
            scrapQty: 0,
            totalPlannedTime: op.setupTime + op.runTime,
            actualTime: 0,
            status: i === 0 ? 'IN_PROGRESS' : 'PENDING',
            scheduledStart: new Date(),
            scheduledEnd: new Date(Date.now() + 86400000 * (i + 1)),
          }
        });
      }
      
      console.log(`   ✅ 4 operações criadas para ${order.orderNumber}`);
    }
  }

  // Buscar ordens com operações
  const ordersWithOps = await prisma.productionOrder.findMany({
    where: {
      status: { in: ['IN_PROGRESS', 'COMPLETED'] }
    },
    include: {
      operations: true,
    },
    take: 10,
  });

  console.log(`\n📊 Criando apontamentos...`);

  // Deletar apontamentos antigos
  await prisma.productionPointing.deleteMany({});

  let pointingCount = 0;
  const today = new Date();

  for (const order of ordersWithOps) {
    for (let i = 0; i < order.operations.length; i++) {
      const operation = order.operations[i];
      const user = users[i % users.length];

      // Criar apontamento concluído para operações anteriores
      if (i < 2 || order.status === 'COMPLETED') {
        const daysAgo = Math.floor(Math.random() * 15) + 1;
        const startTime = new Date(today);
        startTime.setDate(startTime.getDate() - daysAgo);
        startTime.setHours(8, 0, 0, 0);

        const endTime = new Date(startTime);
        const duration = 2 + Math.floor(Math.random() * 4);
        endTime.setHours(startTime.getHours() + duration);

        const quantityGood = Math.floor(order.quantity * (0.9 + Math.random() * 0.1));
        const quantityScrap = Math.floor(quantityGood * (Math.random() * 0.03));

        await prisma.productionPointing.create({
          data: {
            productionOrder: { connect: { id: order.id } },
            operation: { connect: { id: operation.id } },
            user: { connect: { id: user.id } },
            startTime,
            endTime,
            runTime: duration * 60, // em minutos
            quantityGood,
            quantityScrap,
            notes: `Operação ${operation.sequence} - ${operation.description}`,
          }
        });
        
        pointingCount++;
      }
      // Não criar apontamento em andamento (schema não permite endTime null)
    }
  }

  console.log(`✅ ${pointingCount} apontamentos criados!`);
  console.log('\n🎉 Concluído!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
