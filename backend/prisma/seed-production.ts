import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedProduction() {
  console.log('🌱 Iniciando seed de dados de produção...');

  try {
    // Buscar dados necessários
    const products = await prisma.product.findMany({
      where: { active: true },
      take: 5,
    });

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
    const ordersData: any[] = [];

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
      });
    }

    // Criar ordens em lote
    console.log('📦 Criando ordens de produção...');
    for (const orderData of ordersData) {
      await prisma.productionOrder.create({
        data: orderData,
      });
    }

    console.log(`✅ ${ordersData.length} ordens de produção criadas com sucesso!`);

    // Estatísticas
    const completed = ordersData.filter(o => o.status === 'COMPLETED').length;
    const inProgress = ordersData.filter(o => o.status === 'IN_PROGRESS').length;
    const planned = ordersData.filter(o => o.status === 'PLANNED').length;

    console.log('\n📊 Resumo:');
    console.log(`   - Concluídas: ${completed}`);
    console.log(`   - Em Andamento: ${inProgress}`);
    console.log(`   - Planejadas: ${planned}`);
    console.log(`   - Total: ${ordersData.length}`);

    const totalProduced = ordersData.reduce((sum, o) => sum + o.producedQty, 0);
    const totalScrap = ordersData.reduce((sum, o) => sum + o.scrapQty, 0);
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
