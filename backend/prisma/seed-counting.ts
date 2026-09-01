import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📋 Iniciando seed de contagem de estoque...\n');

  // Buscar usuário admin
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@fabric.com' },
  });

  if (!admin) {
    console.error('❌ Usuário admin não encontrado. Execute o seed principal primeiro.');
    process.exit(1);
  }

  // Buscar produtos
  const products = await prisma.product.findMany({
    where: { active: true },
  });

  if (products.length === 0) {
    console.error('❌ Nenhum produto encontrado. Execute o seed principal primeiro.');
    process.exit(1);
  }

  // Limpar dados existentes
  await prisma.countingItem.deleteMany();
  await prisma.countingSession.deleteMany();
  await prisma.countingPlan.deleteMany();
  console.log('🗑️  Dados de contagem anteriores removidos\n');

  // ============================================
  // PLANO 1: Contagem Cíclica - Produtos Críticos
  // ============================================
  const plan1 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-2025-001',
      name: 'Contagem Cíclica - Produtos Críticos',
      description: 'Contagem semanal de produtos com estoque crítico',
      type: 'CYCLIC',
      frequency: 'WEEKLY',
      status: 'ACTIVE',
      criteria: {
        criticality: ['HIGH', 'CRITICAL'],
        productTypes: ['MATERIA_PRIMA'],
      },
      allowBlindCount: false,
      requireRecount: true,
      tolerancePercent: 2.0,
      toleranceQty: 5,
      startDate: new Date(),
      nextExecution: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdBy: admin.id,
    },
  });
  console.log(`✅ ${plan1.code} - ${plan1.name}`);

  // ============================================
  // PLANO 2: Contagem Mensal - Todos os Produtos
  // ============================================
  const plan2 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-2025-002',
      name: 'Contagem Mensal - Todos os Produtos',
      description: 'Contagem completa mensal de todos os produtos',
      type: 'CYCLIC',
      frequency: 'MONTHLY',
      status: 'ACTIVE',
      criteria: {},
      allowBlindCount: true,
      requireRecount: true,
      tolerancePercent: 3.0,
      startDate: new Date(),
      nextExecution: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdBy: admin.id,
    },
  });
  console.log(`✅ ${plan2.code} - ${plan2.name}`);

  // ============================================
  // PLANO 3: Contagem Pontual - Produtos Acabados
  // ============================================
  const plan3 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-2025-003',
      name: 'Contagem Pontual - Produtos Acabados',
      description: 'Contagem sob demanda de produtos acabados',
      type: 'SPOT',
      frequency: 'ON_DEMAND',
      status: 'ACTIVE',
      criteria: {
        productTypes: ['PRODUTO_ACABADO'],
      },
      allowBlindCount: false,
      requireRecount: false,
      tolerancePercent: 1.0,
      startDate: new Date(),
      createdBy: admin.id,
    },
  });
  console.log(`✅ ${plan3.code} - ${plan3.name}`);

  // ============================================
  // SESSÃO 1: Em Progresso
  // ============================================
  const session1 = await prisma.countingSession.create({
    data: {
      code: 'SESS-2025-001',
      planId: plan1.id,
      status: 'IN_PROGRESS',
      scheduledDate: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      assignedTo: admin.id,
      totalItems: 0, // Será atualizado
      countedItems: 0,
      itemsWithDiff: 0,
    },
  });
  console.log(`\n📦 ${session1.code} - Em Progresso`);

  // Criar itens para sessão 1 (primeiros 10 produtos)
  const session1Products = products.slice(0, 10);
  let countedCount = 0;
  let diffCount = 0;

  for (let i = 0; i < session1Products.length; i++) {
    const product = session1Products[i];
    const systemQty = Math.floor(Math.random() * 500) + 100;
    const isCounted = i < 6; // Primeiros 6 já contados

    let countedQty = null;
    let difference = null;
    let differencePercent = null;
    let hasDifference = false;
    let status: any = 'PENDING';

    if (isCounted) {
      // Simular contagem com possível divergência
      const variance = (Math.random() - 0.5) * 0.1; // -5% a +5%
      countedQty = Math.floor(systemQty * (1 + variance));
      difference = countedQty - systemQty;
      differencePercent = (difference / systemQty) * 100;
      hasDifference = Math.abs(differencePercent) > 2; // Fora da tolerância de 2%
      status = hasDifference ? 'COUNTED' : 'ADJUSTED';
      countedCount++;
      if (hasDifference) diffCount++;
    }

    await prisma.countingItem.create({
      data: {
        sessionId: session1.id,
        productId: product.id,
        systemQty,
        countedQty,
        difference,
        differencePercent,
        hasDifference,
        status,
        countedBy: isCounted ? admin.id : null,
        countedAt: isCounted ? new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000) : null,
      },
    });
  }

  // Atualizar estatísticas da sessão 1
  await prisma.countingSession.update({
    where: { id: session1.id },
    data: {
      totalItems: session1Products.length,
      countedItems: countedCount,
      itemsWithDiff: diffCount,
    },
  });
  console.log(`  ├─ ${session1Products.length} itens criados`);
  console.log(`  ├─ ${countedCount} itens contados`);
  console.log(`  └─ ${diffCount} com divergência`);

  // ============================================
  // SESSÃO 2: Agendada para Hoje
  // ============================================
  const session2 = await prisma.countingSession.create({
    data: {
      code: 'SESS-2025-002',
      planId: plan2.id,
      status: 'SCHEDULED',
      scheduledDate: new Date(),
      totalItems: 0,
    },
  });
  console.log(`\n📅 ${session2.code} - Agendada para Hoje`);

  // Criar itens para sessão 2 (próximos 8 produtos)
  const session2Products = products.slice(10, 18);
  for (const product of session2Products) {
    const systemQty = Math.floor(Math.random() * 300) + 50;
    await prisma.countingItem.create({
      data: {
        sessionId: session2.id,
        productId: product.id,
        systemQty,
        status: 'PENDING',
      },
    });
  }

  await prisma.countingSession.update({
    where: { id: session2.id },
    data: { totalItems: session2Products.length },
  });
  console.log(`  └─ ${session2Products.length} itens criados`);

  // ============================================
  // SESSÃO 3: Completa (Histórico)
  // ============================================
  const completedDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 dias atrás
  const session3 = await prisma.countingSession.create({
    data: {
      code: 'SESS-2025-003',
      planId: plan1.id,
      status: 'COMPLETED',
      scheduledDate: completedDate,
      startedAt: completedDate,
      completedAt: new Date(completedDate.getTime() + 4 * 60 * 60 * 1000), // 4 horas depois
      assignedTo: admin.id,
      completedBy: admin.id,
      totalItems: 0,
      countedItems: 0,
      itemsWithDiff: 0,
      accuracyPercent: 0,
    },
  });
  console.log(`\n✅ ${session3.code} - Completa (7 dias atrás)`);

  // Criar itens para sessão 3 (todos contados e ajustados)
  const session3Products = products.slice(0, 12);
  let session3Diff = 0;

  for (const product of session3Products) {
    const systemQty = Math.floor(Math.random() * 400) + 100;
    const variance = (Math.random() - 0.5) * 0.06; // -3% a +3%
    const countedQty = Math.floor(systemQty * (1 + variance));
    const difference = countedQty - systemQty;
    const differencePercent = (difference / systemQty) * 100;
    const hasDifference = Math.abs(differencePercent) > 2;

    if (hasDifference) session3Diff++;

    await prisma.countingItem.create({
      data: {
        sessionId: session3.id,
        productId: product.id,
        systemQty,
        countedQty,
        finalQty: countedQty,
        difference,
        differencePercent,
        hasDifference,
        status: 'ADJUSTED',
        countedBy: admin.id,
        countedAt: new Date(completedDate.getTime() + Math.random() * 3 * 60 * 60 * 1000),
      },
    });
  }

  const accuracy = ((session3Products.length - session3Diff) / session3Products.length) * 100;

  await prisma.countingSession.update({
    where: { id: session3.id },
    data: {
      totalItems: session3Products.length,
      countedItems: session3Products.length,
      itemsWithDiff: session3Diff,
      accuracyPercent: accuracy,
    },
  });
  console.log(`  ├─ ${session3Products.length} itens contados`);
  console.log(`  ├─ ${session3Diff} com divergência`);
  console.log(`  └─ Acurácia: ${accuracy.toFixed(2)}%`);

  // ============================================
  // RESUMO
  // ============================================
  const totalPlans = await prisma.countingPlan.count();
  const totalSessions = await prisma.countingSession.count();
  const totalItems = await prisma.countingItem.count();

  console.log('\n📊 Resumo:');
  console.log(`   ${totalPlans} planos de contagem`);
  console.log(`   ${totalSessions} sessões de contagem`);
  console.log(`   ${totalItems} itens de contagem`);
  console.log('\n✅ Seed de contagem concluído com sucesso!\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar dados de contagem:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
