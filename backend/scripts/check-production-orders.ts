import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando ordens de produção...\n');

  const orders = await prisma.productionOrder.findMany({
    include: {
      product: true,
      operations: {
        include: {
          workCenter: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`📋 Total de ordens: ${orders.length}\n`);

  if (orders.length === 0) {
    console.log('❌ Não há ordens de produção no banco\n');
    console.log('💡 Vou criar uma ordem de exemplo...\n');

    // Buscar produto que tenha routing
    const productsWithRouting = await prisma.product.findMany({
      where: {
        routings: {
          some: {
            active: true,
            operations: {
              some: {},
            },
          },
        },
      },
      include: {
        routings: {
          where: { active: true },
          include: {
            operations: true,
          },
        },
      },
      take: 1,
    });

    if (productsWithRouting.length === 0) {
      console.log('❌ Não há produtos com roteiro ativo no banco');
      console.log('💡 Execute create-routings-and-costs.ts para criar roteiros');
      return;
    }

    const product = productsWithRouting[0];
    console.log(`✅ Produto encontrado: ${product.code} - ${product.name}`);
    console.log(`   Roteiro com ${product.routings[0].operations.length} operações\n`);

    // Buscar usuário admin
    const admin = await prisma.user.findUnique({
      where: { email: 'admin@fabric.com' },
    });

    if (!admin) {
      console.log('❌ Usuário admin não encontrado');
      return;
    }

    // Criar ordem de produção
    const orderNumber = `OP-${Date.now().toString().slice(-6)}`;
    const scheduledStart = new Date();
    const scheduledEnd = new Date();
    scheduledEnd.setDate(scheduledEnd.getDate() + 7);

    const order = await prisma.productionOrder.create({
      data: {
        orderNumber,
        productId: product.id,
        quantity: 10,
        producedQty: 0,
        scrapQty: 0,
        status: 'PLANNED',
        priority: 5,
        scheduledStart,
        scheduledEnd,
        notes: 'Ordem criada automaticamente para testes',
        createdBy: admin.id,
      },
    });

    console.log(`✅ Ordem criada: ${order.orderNumber}\n`);

    // Criar operações baseadas no routing
    const routing = product.routings[0];
    for (const op of routing.operations) {
      await prisma.productionOrderOperation.create({
        data: {
          productionOrderId: order.id,
          sequence: op.sequence,
          workCenterId: op.workCenterId,
          description: op.description,
          plannedQty: order.quantity,
          setupTime: op.setupTime,
          runTime: op.runTime,
          totalPlannedTime: op.setupTime + (op.runTime * order.quantity),
          status: 'PENDING',
        },
      });
    }

    console.log(`✅ ${routing.operations.length} operações criadas\n`);

    // Buscar ordem completa
    const fullOrder = await prisma.productionOrder.findUnique({
      where: { id: order.id },
      include: {
        product: true,
        operations: {
          include: {
            workCenter: true,
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    console.log('📊 Detalhes da ordem criada:');
    console.log(`   Número: ${fullOrder!.orderNumber}`);
    console.log(`   Produto: ${fullOrder!.product!.code} - ${fullOrder!.product!.name}`);
    console.log(`   Quantidade: ${fullOrder!.quantity}`);
    console.log(`   Operações: ${fullOrder!.operations.length}`);
    
    if (fullOrder!.operations.length > 0) {
      console.log('\n   Lista de operações:');
      fullOrder!.operations.forEach(op => {
        console.log(`   ${op.sequence}. ${op.workCenter?.code} - ${op.description}`);
        console.log(`      Setup: ${op.setupTime}h | Run: ${op.runTime}h/un | Total: ${op.totalPlannedTime}h`);
      });
    }
  } else {
    for (const order of orders) {
      console.log(`📦 ${order.orderNumber} - ${order.product?.code}`);
      console.log(`   Produto: ${order.product?.name}`);
      console.log(`   Quantidade: ${order.quantity} | Status: ${order.status}`);
      console.log(`   Operações: ${order.operations.length}`);
      
      if (order.operations.length === 0) {
        console.log('   ⚠️  ORDEM SEM OPERAÇÕES!');
        
        // Verificar se o produto tem routing
        const routing = await prisma.routing.findFirst({
          where: {
            productId: order.productId,
            active: true,
          },
          include: {
            operations: true,
          },
        });

        if (routing) {
          console.log(`   💡 Produto tem roteiro com ${routing.operations.length} operações`);
          console.log('   🔧 Criando operações...');

          for (const op of routing.operations) {
            await prisma.productionOrderOperation.create({
              data: {
                productionOrderId: order.id,
                sequence: op.sequence,
                workCenterId: op.workCenterId,
                description: op.description,
                plannedQty: order.quantity,
                setupTime: op.setupTime,
                runTime: op.runTime,
                totalPlannedTime: op.setupTime + (op.runTime * order.quantity),
                status: 'PENDING',
              },
            });
          }

          console.log(`   ✅ ${routing.operations.length} operações criadas!`);
        } else {
          console.log('   ❌ Produto não tem roteiro ativo');
        }
      } else {
        console.log('   Operações:');
        order.operations.forEach(op => {
          console.log(`      ${op.sequence}. ${op.workCenter?.code} - ${op.description} (${op.status})`);
        });
      }
      console.log('');
    }
  }

  console.log('\n✅ Verificação concluída!');
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
