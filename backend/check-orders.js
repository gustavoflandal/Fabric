// Script para verificar as ordens no banco
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOrders() {
  console.log('🔍 Verificando ordens no banco de dados...\n');
  
  const orders = await prisma.productionOrder.findMany({
    include: {
      product: {
        select: {
          code: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
  
  console.log(`📊 Total de ordens: ${orders.length}\n`);
  
  const byStatus = {
    COMPLETED: 0,
    IN_PROGRESS: 0,
    PLANNED: 0,
    CANCELLED: 0,
  };
  
  orders.forEach(order => {
    byStatus[order.status] = (byStatus[order.status] || 0) + 1;
  });
  
  console.log('📈 Por Status:');
  console.log(`   - COMPLETED: ${byStatus.COMPLETED}`);
  console.log(`   - IN_PROGRESS: ${byStatus.IN_PROGRESS}`);
  console.log(`   - PLANNED: ${byStatus.PLANNED}`);
  console.log(`   - CANCELLED: ${byStatus.CANCELLED || 0}\n`);
  
  console.log('📅 Ordens Concluídas (com actualEnd):');
  const completed = orders.filter(o => o.status === 'COMPLETED');
  completed.slice(0, 5).forEach(order => {
    console.log(`   - ${order.orderNumber}`);
    console.log(`     Produto: ${order.product.code}`);
    console.log(`     Quantidade: ${order.quantity}`);
    console.log(`     Produzido: ${order.producedQty}`);
    console.log(`     Refugo: ${order.scrapQty}`);
    console.log(`     Início Real: ${order.actualStart ? order.actualStart.toISOString().split('T')[0] : 'null'}`);
    console.log(`     Fim Real: ${order.actualEnd ? order.actualEnd.toISOString().split('T')[0] : 'null'}`);
    console.log('');
  });
  
  if (completed.length > 0) {
    const dates = completed
      .filter(o => o.actualEnd)
      .map(o => o.actualEnd);
    
    if (dates.length > 0) {
      const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
      
      console.log('📅 Período das ordens concluídas:');
      console.log(`   De: ${minDate.toISOString().split('T')[0]}`);
      console.log(`   Até: ${maxDate.toISOString().split('T')[0]}`);
      console.log('\n💡 Use este período nos relatórios!');
    }
  }
  
  await prisma.$disconnect();
}

checkOrders().catch(console.error);
