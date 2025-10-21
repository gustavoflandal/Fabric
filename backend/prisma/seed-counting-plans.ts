import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📋 Criando planos de contagem adicionais...\n');

  // Buscar usuário admin
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@fabric.com' },
  });

  if (!admin) {
    console.error('❌ Usuário admin não encontrado.');
    process.exit(1);
  }

  // Buscar produtos
  const products = await prisma.product.findMany({
    where: { active: true },
    take: 50,
  });

  if (products.length === 0) {
    console.error('❌ Nenhum produto encontrado.');
    process.exit(1);
  }

  // Limpar apenas os planos criados por este seed (CONT-TEST-)
  console.log('🗑️  Removendo planos de teste existentes...');
  await prisma.countingPlan.deleteMany({
    where: {
      code: {
        startsWith: 'CONT-TEST-'
      }
    }
  });
  console.log('✅ Planos de teste anteriores removidos\n');

  // ============================================
  // PLANO 1: Contagem Mensal Completa
  // ============================================
  const plan1 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-TEST-001',
      name: 'Contagem Mensal Completa',
      description: 'Contagem completa de todos os produtos do estoque realizada mensalmente',
      type: 'FULL_INVENTORY',
      frequency: 'MONTHLY',
      status: 'ACTIVE',
      criteria: {
        includeAll: true,
      },
      allowBlindCount: false,
      requireRecount: true,
      tolerancePercent: 2.0,
      startDate: new Date('2025-01-01'),
      creator: {
        connect: { id: admin.id }
      },
    },
  });
  console.log(`✅ Plano criado: ${plan1.code} - ${plan1.name}`);

  // ============================================
  // PLANO 2: Contagem Cíclica Semanal - Produtos A
  // ============================================
  const plan2 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-TEST-002',
      name: 'Contagem Cíclica Semanal - Produtos A',
      description: 'Contagem semanal de produtos classe A (alto valor)',
      type: 'CYCLIC',
      frequency: 'WEEKLY',
      status: 'ACTIVE',
      criteria: {
        productTypes: ['PRODUTO_ACABADO'],
        minValue: 1000,
      },
      allowBlindCount: true,
      requireRecount: false,
      tolerancePercent: 1.0,
      startDate: new Date('2025-01-15'),
      creator: {
        connect: { id: admin.id }
      },
    },
  });
  console.log(`✅ Plano criado: ${plan2.code} - ${plan2.name}`);

  // ============================================
  // PLANO 3: Contagem Parcial - Matérias-Primas
  // ============================================
  const rawMaterials = products.filter(p => p.type === 'MATERIA_PRIMA').slice(0, 15);
  const plan3 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-TEST-003',
      name: 'Contagem Parcial - Matérias-Primas',
      description: 'Contagem quinzenal de matérias-primas críticas',
      type: 'SPOT',
      frequency: 'MONTHLY',
      status: 'ACTIVE',
      criteria: {
        productTypes: ['MATERIA_PRIMA'],
        specificProducts: rawMaterials.map(p => p.id),
      },
      allowBlindCount: false,
      requireRecount: true,
      tolerancePercent: 3.0,
      startDate: new Date('2025-01-10'),
      creator: {
        connect: { id: admin.id }
      },
    },
  });
  console.log(`✅ Plano criado: ${plan3.code} - ${plan3.name}`);

  // ============================================
  // PLANO 4: Contagem Trimestral - Produtos de Baixo Giro
  // ============================================
  const plan4 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-TEST-004',
      name: 'Contagem Trimestral - Produtos de Baixo Giro',
      description: 'Contagem trimestral de produtos com baixa movimentação',
      type: 'SPOT',
      frequency: 'QUARTERLY',
      status: 'ACTIVE',
      criteria: {
        lowTurnover: true,
        productTypes: ['PRODUTO_ACABADO', 'SEMIACABADO'],
      },
      allowBlindCount: false,
      requireRecount: false,
      tolerancePercent: 5.0,
      startDate: new Date('2025-01-01'),
      creator: {
        connect: { id: admin.id }
      },
    },
  });
  console.log(`✅ Plano criado: ${plan4.code} - ${plan4.name}`);

  // ============================================
  // PLANO 5: Contagem Diária - Produtos Perecíveis
  // ============================================
  const plan5 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-TEST-005',
      name: 'Contagem Diária - Produtos Perecíveis',
      description: 'Contagem diária de produtos com validade curta',
      type: 'CYCLIC',
      frequency: 'DAILY',
      status: 'ACTIVE',
      criteria: {
        perishable: true,
        productTypes: ['MATERIA_PRIMA'],
      },
      allowBlindCount: true,
      requireRecount: false,
      tolerancePercent: 0.5,
      startDate: new Date('2025-01-20'),
      creator: {
        connect: { id: admin.id }
      },
    },
  });
  console.log(`✅ Plano criado: ${plan5.code} - ${plan5.name}`);

  // ============================================
  // PLANO 6: Contagem Anual - Inventário Geral
  // ============================================
  const plan6 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-TEST-006',
      name: 'Contagem Anual - Inventário Geral',
      description: 'Inventário geral anual de todos os produtos e localizações',
      type: 'FULL_INVENTORY',
      frequency: 'SEMIANNUAL',
      status: 'DRAFT',
      criteria: {
        includeAll: true,
        includeInactive: true,
      },
      allowBlindCount: false,
      requireRecount: true,
      tolerancePercent: 1.0,
      startDate: new Date('2025-12-15'),
      creator: {
        connect: { id: admin.id }
      },
    },
  });
  console.log(`✅ Plano criado: ${plan6.code} - ${plan6.name}`);

  // ============================================
  // PLANO 7: Contagem Semanal - Embalagens
  // ============================================
  const plan7 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-TEST-007',
      name: 'Contagem Semanal - Embalagens',
      description: 'Contagem semanal de materiais de embalagem',
      type: 'SPOT',
      frequency: 'WEEKLY',
      status: 'ACTIVE',
      criteria: {
        productTypes: ['EMBALAGEM'],
      },
      allowBlindCount: true,
      requireRecount: false,
      tolerancePercent: 2.5,
      startDate: new Date('2025-01-08'),
      creator: {
        connect: { id: admin.id }
      },
    },
  });
  console.log(`✅ Plano criado: ${plan7.code} - ${plan7.name}`);

  // ============================================
  // PLANO 8: Contagem Mensal - Produtos em Excesso
  // ============================================
  const plan8 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-TEST-008',
      name: 'Contagem Mensal - Produtos em Excesso',
      description: 'Contagem mensal de produtos com estoque acima do máximo',
      type: 'SPOT',
      frequency: 'MONTHLY',
      status: 'PAUSED',
      criteria: {
        excessStock: true,
      },
      allowBlindCount: false,
      requireRecount: false,
      tolerancePercent: 3.0,
      startDate: new Date('2025-01-05'),
      creator: {
        connect: { id: admin.id }
      },
    },
  });
  console.log(`✅ Plano criado: ${plan8.code} - ${plan8.name}`);

  // ============================================
  // PLANO 9: Contagem Cíclica - Produtos Novos
  // ============================================
  const plan9 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-TEST-009',
      name: 'Contagem Cíclica - Produtos Novos',
      description: 'Contagem semanal de produtos cadastrados nos últimos 3 meses',
      type: 'CYCLIC',
      frequency: 'WEEKLY',
      status: 'ACTIVE',
      criteria: {
        recentProducts: true,
        daysThreshold: 90,
      },
      allowBlindCount: true,
      requireRecount: true,
      tolerancePercent: 1.5,
      startDate: new Date('2025-01-12'),
      creator: {
        connect: { id: admin.id }
      },
    },
  });
  console.log(`✅ Plano criado: ${plan9.code} - ${plan9.name}`);

  // ============================================
  // PLANO 10: Contagem Parcial - Produtos Críticos
  // ============================================
  const plan10 = await prisma.countingPlan.create({
    data: {
      code: 'CONT-TEST-010',
      name: 'Contagem Parcial - Produtos Críticos',
      description: 'Contagem diária de produtos com estoque crítico',
      type: 'SPOT',
      frequency: 'DAILY',
      status: 'ACTIVE',
      criteria: {
        criticalStock: true,
        belowMinimum: true,
      },
      allowBlindCount: false,
      requireRecount: true,
      tolerancePercent: 0.0,
      startDate: new Date('2025-01-18'),
      creator: {
        connect: { id: admin.id }
      },
    },
  });
  console.log(`✅ Plano criado: ${plan10.code} - ${plan10.name}`);

  console.log('\n✅ Seed de planos de contagem concluído!');
  console.log(`📊 Total: 10 planos criados`);
  console.log(`   - 3 Ativos (ACTIVE)`);
  console.log(`   - 1 Pausado (PAUSED)`);
  console.log(`   - 1 Rascunho (DRAFT)`);
  console.log(`   - Frequências: Diária, Semanal, Mensal, Trimestral, Anual`);
  console.log(`   - Tipos: Completa, Parcial, Cíclica`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
