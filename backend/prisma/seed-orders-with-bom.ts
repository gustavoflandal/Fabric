import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📋 Criando ordens de produção para produtos com BOM...\n');

  try {
    // Buscar produtos que têm BOM ativa
    const productsWithBom = await prisma.product.findMany({
      where: {
        boms: {
          some: {
            active: true,
          },
        },
      },
      include: {
        boms: {
          where: { active: true },
          include: {
            items: {
              include: {
                component: true,
              },
            },
          },
        },
        routings: {
          where: { active: true },
          include: {
            operations: true,
          },
        },
      },
    });

    console.log(`✅ Encontrados ${productsWithBom.length} produtos com BOM ativa\n`);

    if (productsWithBom.length === 0) {
      console.log('⚠️  Nenhum produto com BOM encontrado. Execute primeiro: npm run prisma:seed');
      return;
    }

    // Buscar usuário admin
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@fabric.com' },
    });

    if (!adminUser) {
      console.log('⚠️  Usuário admin não encontrado');
      return;
    }

    const today = new Date();
    const ordersToCreate = [];

    // Para cada produto com BOM, criar 2-3 ordens em diferentes status
    for (const product of productsWithBom) {
      console.log(`📦 Criando ordens para: ${product.code} - ${product.name}`);

      // Ordem 1: PLANEJADA (futuro)
      const scheduledStart1 = new Date(today);
      scheduledStart1.setDate(scheduledStart1.getDate() + 5);
      const scheduledEnd1 = new Date(scheduledStart1);
      scheduledEnd1.setDate(scheduledEnd1.getDate() + product.leadTime);

      const order1 = await prisma.productionOrder.create({
        data: {
          orderNumber: `OP-${today.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          productId: product.id,
          quantity: 50 + Math.floor(Math.random() * 50), // 50-100
          producedQty: 0,
          scrapQty: 0,
          priority: 5 + Math.floor(Math.random() * 5), // 5-10
          status: 'PLANNED',
          scheduledStart: scheduledStart1,
          scheduledEnd: scheduledEnd1,
          notes: `Ordem planejada para ${product.name}`,
          createdBy: adminUser.id,
        },
      });

      // Criar operações se houver roteiro
      if (product.routings.length > 0) {
        const routing = product.routings[0];
        for (const op of routing.operations) {
          await prisma.productionOrderOperation.create({
            data: {
              productionOrderId: order1.id,
              sequence: op.sequence,
              workCenterId: op.workCenterId,
              description: op.description,
              plannedQty: order1.quantity,
              setupTime: op.setupTime,
              runTime: op.runTime,
              totalPlannedTime: op.setupTime + (op.runTime * order1.quantity),
              status: 'PENDING',
            },
          });
        }
      }

      ordersToCreate.push(order1);
      console.log(`  ✅ ${order1.orderNumber} - PLANEJADA (${order1.quantity} unidades)`);

      // Ordem 2: LIBERADA (próximos dias)
      const scheduledStart2 = new Date(today);
      scheduledStart2.setDate(scheduledStart2.getDate() + 1);
      const scheduledEnd2 = new Date(scheduledStart2);
      scheduledEnd2.setDate(scheduledEnd2.getDate() + product.leadTime);

      const order2 = await prisma.productionOrder.create({
        data: {
          orderNumber: `OP-${today.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          productId: product.id,
          quantity: 30 + Math.floor(Math.random() * 40), // 30-70
          producedQty: 0,
          scrapQty: 0,
          priority: 7 + Math.floor(Math.random() * 3), // 7-10
          status: 'RELEASED',
          scheduledStart: scheduledStart2,
          scheduledEnd: scheduledEnd2,
          notes: `Ordem liberada para produção - ${product.name}`,
          createdBy: adminUser.id,
        },
      });

      // Criar operações
      if (product.routings.length > 0) {
        const routing = product.routings[0];
        for (const op of routing.operations) {
          await prisma.productionOrderOperation.create({
            data: {
              productionOrderId: order2.id,
              sequence: op.sequence,
              workCenterId: op.workCenterId,
              description: op.description,
              plannedQty: order2.quantity,
              setupTime: op.setupTime,
              runTime: op.runTime,
              totalPlannedTime: op.setupTime + (op.runTime * order2.quantity),
              status: 'PENDING',
            },
          });
        }
      }

      ordersToCreate.push(order2);
      console.log(`  ✅ ${order2.orderNumber} - LIBERADA (${order2.quantity} unidades)`);

      // Ordem 3: EM PROGRESSO (iniciada)
      const scheduledStart3 = new Date(today);
      scheduledStart3.setDate(scheduledStart3.getDate() - 2);
      const scheduledEnd3 = new Date(scheduledStart3);
      scheduledEnd3.setDate(scheduledEnd3.getDate() + product.leadTime);
      const actualStart3 = new Date(scheduledStart3);
      actualStart3.setHours(actualStart3.getHours() + 1);

      const quantity3 = 80 + Math.floor(Math.random() * 40); // 80-120
      const producedQty3 = Math.floor(quantity3 * (0.4 + Math.random() * 0.3)); // 40-70% concluído
      const scrapQty3 = Math.floor(producedQty3 * 0.03); // 3% de refugo

      const order3 = await prisma.productionOrder.create({
        data: {
          orderNumber: `OP-${today.getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          productId: product.id,
          quantity: quantity3,
          producedQty: producedQty3,
          scrapQty: scrapQty3,
          priority: 8 + Math.floor(Math.random() * 3), // 8-10
          status: 'IN_PROGRESS',
          scheduledStart: scheduledStart3,
          scheduledEnd: scheduledEnd3,
          actualStart: actualStart3,
          notes: `Ordem em andamento - ${product.name} (${Math.round((producedQty3/quantity3)*100)}% concluída)`,
          createdBy: adminUser.id,
        },
      });

      // Criar operações com progresso
      if (product.routings.length > 0) {
        const routing = product.routings[0];
        const totalOps = routing.operations.length;
        const completedOps = Math.floor(totalOps * 0.5); // 50% das operações concluídas

        for (let i = 0; i < routing.operations.length; i++) {
          const op = routing.operations[i];
          const isCompleted = i < completedOps;
          const isInProgress = i === completedOps;

          await prisma.productionOrderOperation.create({
            data: {
              productionOrderId: order3.id,
              sequence: op.sequence,
              workCenterId: op.workCenterId,
              description: op.description,
              plannedQty: order3.quantity,
              completedQty: isCompleted ? order3.quantity : (isInProgress ? producedQty3 : 0),
              setupTime: op.setupTime,
              runTime: op.runTime,
              totalPlannedTime: op.setupTime + (op.runTime * order3.quantity),
              actualTime: isCompleted ? (op.setupTime + (op.runTime * order3.quantity) * 1.05) : 0,
              status: isCompleted ? 'COMPLETED' : (isInProgress ? 'IN_PROGRESS' : 'PENDING'),
            },
          });
        }
      }

      ordersToCreate.push(order3);
      console.log(`  ✅ ${order3.orderNumber} - EM PROGRESSO (${producedQty3}/${quantity3} unidades - ${Math.round((producedQty3/quantity3)*100)}%)`);

      console.log('');
    }

    console.log(`\n✅ ${ordersToCreate.length} ordens de produção criadas com sucesso!\n`);

    // Resumo
    const summary = {
      planned: ordersToCreate.filter(o => o.status === 'PLANNED').length,
      released: ordersToCreate.filter(o => o.status === 'RELEASED').length,
      inProgress: ordersToCreate.filter(o => o.status === 'IN_PROGRESS').length,
    };

    console.log('📊 Resumo:');
    console.log(`   - Planejadas: ${summary.planned}`);
    console.log(`   - Liberadas: ${summary.released}`);
    console.log(`   - Em Progresso: ${summary.inProgress}`);
    console.log(`   - Total: ${ordersToCreate.length}`);

    console.log('\n✅ Seed de ordens com BOM concluído!\n');

  } catch (error) {
    console.error('❌ Erro ao criar ordens:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
