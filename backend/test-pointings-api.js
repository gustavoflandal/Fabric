// Testar API de apontamentos
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  console.log('🧪 Testando dados de apontamentos...\n');

  // Verificar apontamentos no banco
  const pointings = await prisma.productionPointing.findMany({
    include: {
      productionOrder: {
        select: {
          orderNumber: true,
        }
      },
      operation: {
        select: {
          sequence: true,
          description: true,
        }
      },
      user: {
        select: {
          name: true,
        }
      }
    },
    take: 10,
  });

  console.log(`📊 Total de apontamentos no banco: ${pointings.length}`);
  
  if (pointings.length > 0) {
    console.log('\n✅ Primeiros 5 apontamentos:');
    pointings.slice(0, 5).forEach((p, i) => {
      console.log(`\n${i + 1}. Apontamento ${p.id.substring(0, 8)}...`);
      console.log(`   Ordem: ${p.productionOrder.orderNumber}`);
      console.log(`   Operação: ${p.operation.sequence} - ${p.operation.description}`);
      console.log(`   Usuário: ${p.user.name}`);
      console.log(`   Início: ${p.startTime.toISOString()}`);
      console.log(`   Fim: ${p.endTime.toISOString()}`);
      console.log(`   Qtd Boa: ${p.quantityGood}`);
      console.log(`   Refugo: ${p.quantityScrap}`);
    });
  } else {
    console.log('⚠️  Nenhum apontamento encontrado!');
  }

  await prisma.$disconnect();
}

test().catch(console.error);
