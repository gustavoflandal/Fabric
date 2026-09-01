import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏭 Criando apontamentos de produção...\n');

  // Buscar usuário admin
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@fabric.com' },
  });

  if (!admin) {
    console.log('❌ Usuário admin não encontrado');
    return;
  }

  // Buscar ordens de produção com operações
  const orders = await prisma.productionOrder.findMany({
    where: {
      status: {
        in: ['RELEASED', 'IN_PROGRESS'],
      },
    },
    include: {
      product: true,
      operations: {
        include: {
          workCenter: true,
        },
        orderBy: { sequence: 'asc' },
      },
    },
    take: 3,
  });

  if (orders.length === 0) {
    console.log('❌ Não há ordens em progresso ou liberadas');
    return;
  }

  console.log(`📋 Ordens encontradas: ${orders.length}\n`);

  let totalPointings = 0;

  for (const order of orders) {
    console.log(`📦 ${order.orderNumber} - ${order.product?.code} (${order.product?.name})`);
    console.log(`   Quantidade: ${order.quantity} | Status: ${order.status}`);
    console.log(`   Operações: ${order.operations.length}\n`);

    if (order.operations.length === 0) {
      console.log('   ⚠️  Sem operações\n');
      continue;
    }

    // Criar apontamentos para cada operação
    for (let i = 0; i < order.operations.length; i++) {
      const operation = order.operations[i];
      
      // Decidir quantos apontamentos criar por operação
      const numPointings = Math.min(3, Math.ceil(order.quantity / 10));
      
      console.log(`   ${operation.sequence}. ${operation.workCenter?.code} - ${operation.description}`);
      
      let totalGood = 0;
      let totalScrap = 0;

      for (let j = 0; j < numPointings; j++) {
        // Calcular quantidades
        const remainingQty = order.quantity - totalGood;
        const maxQty = Math.min(remainingQty, Math.ceil(order.quantity / numPointings));
        const quantityGood = Math.max(1, Math.floor(Math.random() * maxQty) + 1);
        const quantityScrap = Math.random() < 0.2 ? Math.floor(Math.random() * 3) : 0;
        
        totalGood += quantityGood;
        totalScrap += quantityScrap;

        // Calcular tempos
        const setupTime = j === 0 ? operation.setupTime : 0; // Setup apenas no primeiro apontamento
        const runTime = operation.runTime * quantityGood;
        
        // Gerar datas
        const baseDate = new Date(order.scheduledStart);
        const dayOffset = i * 2 + j; // Espaçar os apontamentos
        baseDate.setDate(baseDate.getDate() + dayOffset);
        
        const startTime = new Date(baseDate);
        startTime.setHours(8 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));
        
        const endTime = new Date(startTime);
        const totalMinutes = (setupTime + runTime) * 60;
        endTime.setMinutes(endTime.getMinutes() + totalMinutes);

        // Criar apontamento
        const pointing = await prisma.productionPointing.create({
          data: {
            productionOrderId: order.id,
            operationId: operation.id,
            userId: admin.id,
            quantityGood,
            quantityScrap,
            setupTime,
            runTime,
            startTime,
            endTime,
            notes: j === 0 
              ? `Primeiro apontamento da operação ${operation.sequence}` 
              : quantityScrap > 0 
                ? `Apontamento com ${quantityScrap} peças refugadas`
                : null,
          },
        });

        console.log(`      ✅ Apontamento #${j + 1}: ${quantityGood} boas, ${quantityScrap} refugo`);
        console.log(`         ⏱️  ${startTime.toLocaleString('pt-BR')} → ${endTime.toLocaleString('pt-BR')}`);
        console.log(`         🕐 Setup: ${setupTime.toFixed(2)}h | Run: ${runTime.toFixed(2)}h`);
        
        totalPointings++;
      }

      console.log(`      📊 Total da operação: ${totalGood} boas, ${totalScrap} refugo\n`);

      // Atualizar quantidade completada na operação
      await prisma.productionOrderOperation.update({
        where: { id: operation.id },
        data: {
          completedQty: totalGood,
          scrapQty: totalScrap,
          actualTime: await calculateActualTime(operation.id),
          status: totalGood >= operation.plannedQty ? 'COMPLETED' : 'IN_PROGRESS',
        },
      });
    }

    // Atualizar a ordem de produção
    const orderTotalGood = await prisma.productionPointing.aggregate({
      where: { productionOrderId: order.id },
      _sum: { quantityGood: true },
    });

    const orderTotalScrap = await prisma.productionPointing.aggregate({
      where: { productionOrderId: order.id },
      _sum: { quantityScrap: true },
    });

    await prisma.productionOrder.update({
      where: { id: order.id },
      data: {
        producedQty: orderTotalGood._sum.quantityGood || 0,
        scrapQty: orderTotalScrap._sum.quantityScrap || 0,
        actualStart: order.actualStart || new Date(),
      },
    });

    console.log(`   ✅ Ordem atualizada: ${orderTotalGood._sum.quantityGood} produzidas, ${orderTotalScrap._sum.quantityScrap} refugo\n`);
    console.log('   ─────────────────────────────────────────────────────────\n');
  }

  console.log(`\n✅ Total de apontamentos criados: ${totalPointings}`);
  console.log('🎉 Apontamentos de produção criados com sucesso!\n');

  // Mostrar resumo
  console.log('📊 RESUMO POR ORDEM:\n');
  
  for (const order of orders) {
    const pointings = await prisma.productionPointing.findMany({
      where: { productionOrderId: order.id },
      include: {
        operation: {
          include: {
            workCenter: true,
          },
        },
      },
    });

    const totalGood = pointings.reduce((sum, p) => sum + p.quantityGood, 0);
    const totalScrap = pointings.reduce((sum, p) => sum + p.quantityScrap, 0);
    const totalTime = pointings.reduce((sum, p) => sum + p.setupTime + p.runTime, 0);

    console.log(`📦 ${order.orderNumber}`);
    console.log(`   Apontamentos: ${pointings.length}`);
    console.log(`   Produzidas: ${totalGood}/${order.quantity} (${((totalGood/order.quantity)*100).toFixed(1)}%)`);
    console.log(`   Refugo: ${totalScrap}`);
    console.log(`   Tempo total: ${totalTime.toFixed(2)}h`);
    console.log('');
  }
}

async function calculateActualTime(operationId: string): Promise<number> {
  const pointings = await prisma.productionPointing.findMany({
    where: { operationId },
  });

  return pointings.reduce((sum, p) => sum + p.setupTime + p.runTime, 0);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
