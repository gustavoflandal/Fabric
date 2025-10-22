import { prisma } from '../src/config/database';

/**
 * Script para criar roteiros de produção e calcular custos padrão dos produtos
 */

async function createRoutingsAndCosts() {
  console.log('🏭 Criando roteiros de produção e calculando custos...\n');

  try {
    // Buscar produtos, centros de trabalho e unidades
    const products = await prisma.product.findMany({
      where: {
        code: { in: ['PA-001', 'PA-002', 'PA001', 'PA002', 'PA003'] },
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
      orderBy: { code: 'asc' },
    });

    const workCenters = await prisma.workCenter.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        costPerHour: true,
      },
      orderBy: { code: 'asc' },
    });

    console.log(`📦 Produtos encontrados: ${products.length}`);
    console.log(`🏭 Centros de trabalho: ${workCenters.length}\n`);

    if (workCenters.length === 0) {
      console.log('⚠️  Nenhum centro de trabalho encontrado. Criando centros básicos...\n');
      
      // Criar centros de trabalho básicos
      const centersToCreate = [
        { code: 'CT-MONT', name: 'Montagem Principal', costPerHour: 80.00, capacity: 8 },
        { code: 'CT-SOLD', name: 'Soldagem SMT', costPerHour: 120.00, capacity: 8 },
        { code: 'CT-TEST', name: 'Teste e Qualidade', costPerHour: 60.00, capacity: 8 },
        { code: 'CT-EMB', name: 'Embalagem', costPerHour: 40.00, capacity: 8 },
        { code: 'CT-TEAR', name: 'Tecelagem', costPerHour: 100.00, capacity: 8 },
        { code: 'CT-TINT', name: 'Tinturaria', costPerHour: 90.00, capacity: 8 },
        { code: 'CT-ACAB', name: 'Acabamento', costPerHour: 70.00, capacity: 8 },
      ];

      for (const center of centersToCreate) {
        await prisma.workCenter.create({
          data: {
            code: center.code,
            name: center.name,
            description: `Centro de trabalho para ${center.name.toLowerCase()}`,
            costPerHour: center.costPerHour,
            capacity: center.capacity,
            efficiency: 0.85,
            active: true,
          },
        });
        console.log(`   ✅ Centro criado: ${center.code} - ${center.name} (R$ ${center.costPerHour}/h)`);
      }

      // Recarregar centros de trabalho
      const newWorkCenters = await prisma.workCenter.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          costPerHour: true,
        },
        orderBy: { code: 'asc' },
      });
      
      workCenters.push(...newWorkCenters);
      console.log();
    }

    // Mapear produtos e centros de trabalho
    const productMap = new Map(products.map(p => [p.code, p]));
    const wcMap = new Map(workCenters.map(wc => [wc.code, wc]));

    // Definir roteiros de produção
    const routingsToCreate = [
      // PA-001: Smartphone XPro
      {
        productCode: 'PA-001',
        operations: [
          { 
            sequence: 10, 
            workCenter: 'CT-SOLD', 
            description: 'Soldagem de componentes SMT na placa mãe',
            setupTime: 0.5, // horas
            runTime: 0.25,  // horas por unidade
            queueTime: 0.1,
            moveTime: 0.05,
          },
          { 
            sequence: 20, 
            workCenter: 'CT-MONT', 
            description: 'Montagem da tela, bateria e câmera',
            setupTime: 0.25,
            runTime: 0.15,
            queueTime: 0.1,
            moveTime: 0.05,
          },
          { 
            sequence: 30, 
            workCenter: 'CT-TEST', 
            description: 'Teste funcional e calibração',
            setupTime: 0.1,
            runTime: 0.2,
            queueTime: 0.05,
            moveTime: 0.05,
          },
          { 
            sequence: 40, 
            workCenter: 'CT-EMB', 
            description: 'Embalagem e etiquetagem',
            setupTime: 0.1,
            runTime: 0.08,
            queueTime: 0.05,
            moveTime: 0,
          },
        ],
      },
      // PA-002: Notebook Ultra
      {
        productCode: 'PA-002',
        operations: [
          { 
            sequence: 10, 
            workCenter: 'CT-SOLD', 
            description: 'Soldagem de componentes na placa mãe do notebook',
            setupTime: 0.75,
            runTime: 0.4,
            queueTime: 0.15,
            moveTime: 0.1,
          },
          { 
            sequence: 20, 
            workCenter: 'CT-MONT', 
            description: 'Montagem de tela, teclado, HD, memória e bateria',
            setupTime: 0.5,
            runTime: 0.35,
            queueTime: 0.15,
            moveTime: 0.1,
          },
          { 
            sequence: 30, 
            workCenter: 'CT-MONT', 
            description: 'Instalação da carcaça e fechamento',
            setupTime: 0.25,
            runTime: 0.2,
            queueTime: 0.1,
            moveTime: 0.05,
          },
          { 
            sequence: 40, 
            workCenter: 'CT-TEST', 
            description: 'Teste de hardware, instalação de software e burn-in',
            setupTime: 0.15,
            runTime: 0.5,
            queueTime: 0.1,
            moveTime: 0.05,
          },
          { 
            sequence: 50, 
            workCenter: 'CT-EMB', 
            description: 'Embalagem com acessórios',
            setupTime: 0.15,
            runTime: 0.12,
            queueTime: 0.05,
            moveTime: 0,
          },
        ],
      },
      // PA001: Tecido Algodão 100% Cru
      {
        productCode: 'PA001',
        operations: [
          { 
            sequence: 10, 
            workCenter: 'CT-TEAR', 
            description: 'Tecelagem do fio de algodão',
            setupTime: 1.0,
            runTime: 0.5, // por metro
            queueTime: 0.2,
            moveTime: 0.1,
          },
          { 
            sequence: 20, 
            workCenter: 'CT-ACAB', 
            description: 'Acabamento e inspeção',
            setupTime: 0.5,
            runTime: 0.1,
            queueTime: 0.1,
            moveTime: 0.05,
          },
        ],
      },
      // PA002: Tecido Poliéster Premium
      {
        productCode: 'PA002',
        operations: [
          { 
            sequence: 10, 
            workCenter: 'CT-TEAR', 
            description: 'Tecelagem do fio de poliéster',
            setupTime: 0.75,
            runTime: 0.4,
            queueTime: 0.15,
            moveTime: 0.1,
          },
          { 
            sequence: 20, 
            workCenter: 'CT-TINT', 
            description: 'Tingimento',
            setupTime: 1.5,
            runTime: 0.3,
            queueTime: 0.3,
            moveTime: 0.1,
          },
          { 
            sequence: 30, 
            workCenter: 'CT-ACAB', 
            description: 'Acabamento premium',
            setupTime: 0.5,
            runTime: 0.15,
            queueTime: 0.1,
            moveTime: 0,
          },
        ],
      },
      // PA003: Tecido Misto 50/50
      {
        productCode: 'PA003',
        operations: [
          { 
            sequence: 10, 
            workCenter: 'CT-TEAR', 
            description: 'Tecelagem da mescla de fios',
            setupTime: 1.25,
            runTime: 0.45,
            queueTime: 0.2,
            moveTime: 0.1,
          },
          { 
            sequence: 20, 
            workCenter: 'CT-TINT', 
            description: 'Tingimento',
            setupTime: 1.5,
            runTime: 0.35,
            queueTime: 0.3,
            moveTime: 0.1,
          },
          { 
            sequence: 30, 
            workCenter: 'CT-ACAB', 
            description: 'Acabamento e inspeção',
            setupTime: 0.5,
            runTime: 0.12,
            queueTime: 0.1,
            moveTime: 0,
          },
        ],
      },
    ];

    let routingsCreated = 0;
    let operationsCreated = 0;

    for (const routingDef of routingsToCreate) {
      const product = productMap.get(routingDef.productCode);
      
      if (!product) {
        console.log(`⚠️  Produto ${routingDef.productCode} não encontrado, pulando...`);
        continue;
      }

      console.log(`\n${'='.repeat(70)}`);
      console.log(`📋 Criando roteiro para: ${routingDef.productCode} - ${product.name}`);
      console.log('='.repeat(70));

      // Verificar se já existe roteiro ativo
      const existingRouting = await prisma.routing.findFirst({
        where: {
          productId: product.id,
          active: true,
        },
      });

      if (existingRouting) {
        console.log(`⚠️  Roteiro já existe, desativando versão antiga...`);
        await prisma.routing.update({
          where: { id: existingRouting.id },
          data: { active: false },
        });
      }

      // Criar roteiro
      const routing = await prisma.routing.create({
        data: {
          productId: product.id,
          version: existingRouting ? existingRouting.version + 1 : 1,
          description: `Roteiro de produção para ${product.name}`,
          validFrom: new Date(),
          active: true,
        },
      });

      console.log(`✅ Roteiro criado (v${routing.version})`);
      routingsCreated++;

      let totalSetupTime = 0;
      let totalRunTimePerUnit = 0;
      let totalLaborCost = 0;

      // Criar operações
      for (const opDef of routingDef.operations) {
        const workCenter = wcMap.get(opDef.workCenter);
        
        if (!workCenter) {
          console.log(`   ⚠️  Centro de trabalho ${opDef.workCenter} não encontrado!`);
          continue;
        }

        await prisma.routingOperation.create({
          data: {
            routingId: routing.id,
            sequence: opDef.sequence,
            workCenterId: workCenter.id,
            description: opDef.description,
            setupTime: opDef.setupTime,
            runTime: opDef.runTime,
            queueTime: opDef.queueTime,
            moveTime: opDef.moveTime,
          },
        });

        const opLaborCost = (opDef.setupTime + opDef.runTime) * workCenter.costPerHour;
        totalSetupTime += opDef.setupTime;
        totalRunTimePerUnit += opDef.runTime;
        totalLaborCost += opLaborCost;

        console.log(`\n   ${opDef.sequence}. ${workCenter.name}`);
        console.log(`      ${opDef.description}`);
        console.log(`      Setup: ${opDef.setupTime}h | Runtime: ${opDef.runTime}h | Queue: ${opDef.queueTime}h | Move: ${opDef.moveTime}h`);
        console.log(`      Custo MO: R$ ${opLaborCost.toFixed(2)} (${workCenter.costPerHour}/h)`);
        
        operationsCreated++;
      }

      console.log(`\n   📊 Total do Roteiro:`);
      console.log(`      Setup Total: ${totalSetupTime.toFixed(2)}h`);
      console.log(`      Runtime Total/un: ${totalRunTimePerUnit.toFixed(2)}h`);
      console.log(`      Custo MO Total: R$ ${totalLaborCost.toFixed(2)}`);

      // Calcular custo padrão do produto
      await calculateStandardCost(product.id, totalLaborCost);
    }

    console.log('\n' + '='.repeat(70));
    console.log(`✅ Processo concluído!`);
    console.log(`   📋 Roteiros criados: ${routingsCreated}`);
    console.log(`   🔧 Operações criadas: ${operationsCreated}`);
    console.log('='.repeat(70) + '\n');

    // Mostrar resumo final
    await showFinalSummary();

  } catch (error) {
    console.error('❌ Erro ao criar roteiros:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Calcular custo padrão do produto (material + mão de obra)
 */
async function calculateStandardCost(productId: string, laborCost: number) {
  // Buscar BOM do produto para calcular custo de materiais
  const bom = await prisma.bOM.findFirst({
    where: {
      productId,
      active: true,
    },
    include: {
      items: {
        include: {
          component: {
            select: {
              code: true,
              name: true,
              lastCost: true,
              averageCost: true,
            },
          },
        },
      },
    },
  });

  let materialCost = 0;

  if (bom) {
    for (const item of bom.items) {
      // Usar lastCost se disponível, senão usar averageCost, senão estimar
      const componentCost = item.component.lastCost || item.component.averageCost || 50; // Estimar R$ 50 se não houver custo
      const itemCost = componentCost * item.quantity * (1 + item.scrapFactor);
      materialCost += itemCost;
    }
  }

  const standardCost = materialCost + laborCost;

  // Atualizar produto com custo padrão
  await prisma.product.update({
    where: { id: productId },
    data: {
      standardCost,
      lastCost: standardCost, // Também atualizar lastCost
      averageCost: standardCost, // E averageCost
    },
  });

  console.log(`\n   💰 Custo Padrão Calculado:`);
  console.log(`      Material: R$ ${materialCost.toFixed(2)}`);
  console.log(`      Mão de Obra: R$ ${laborCost.toFixed(2)}`);
  console.log(`      TOTAL: R$ ${standardCost.toFixed(2)}`);
}

/**
 * Mostrar resumo final com todos os produtos, BOMs, roteiros e custos
 */
async function showFinalSummary() {
  console.log('📊 RESUMO FINAL - Produtos, BOMs, Roteiros e Custos:\n');

  const products = await prisma.product.findMany({
    where: {
      code: { in: ['PA-001', 'PA-002', 'PA001', 'PA002', 'PA003'] },
    },
    include: {
      boms: {
        where: { active: true },
        include: {
          items: {
            include: {
              component: { select: { code: true, name: true } },
              unit: { select: { code: true } },
            },
            orderBy: { sequence: 'asc' },
          },
        },
      },
      routings: {
        where: { active: true },
        include: {
          operations: {
            include: {
              workCenter: { select: { code: true, name: true, costPerHour: true } },
            },
            orderBy: { sequence: 'asc' },
          },
        },
      },
      unit: { select: { code: true } },
    },
    orderBy: { code: 'asc' },
  });

  for (const product of products) {
    console.log('='.repeat(70));
    console.log(`📦 ${product.code} - ${product.name}`);
    console.log(`   Tipo: ${product.type} | Unidade: ${product.unit.code}`);
    console.log(`   💰 Custo Padrão: R$ ${product.standardCost?.toFixed(2) || '0.00'}`);
    
    // BOM
    if (product.boms.length > 0) {
      const bom = product.boms[0];
      console.log(`\n   📋 BOM (v${bom.version}) - ${bom.items.length} componentes:`);
      for (const item of bom.items) {
        console.log(`      ${item.sequence}. ${item.component.code} - ${item.quantity} ${item.unit.code} (refugo: ${(item.scrapFactor * 100).toFixed(1)}%)`);
      }
    } else {
      console.log(`\n   ⚠️  Sem BOM cadastrada`);
    }

    // Roteiro
    if (product.routings.length > 0) {
      const routing = product.routings[0];
      console.log(`\n   🔧 Roteiro (v${routing.version}) - ${routing.operations.length} operações:`);
      
      let totalTime = 0;
      for (const op of routing.operations) {
        const opTime = op.setupTime + op.runTime + op.queueTime + op.moveTime;
        totalTime += opTime;
        console.log(`      ${op.sequence}. ${op.workCenter.name} - ${opTime.toFixed(2)}h (R$ ${op.workCenter.costPerHour}/h)`);
      }
      console.log(`      ⏱️  Tempo total: ${totalTime.toFixed(2)}h`);
    } else {
      console.log(`\n   ⚠️  Sem roteiro cadastrado`);
    }

    console.log();
  }

  console.log('='.repeat(70));
}

// Executar script
createRoutingsAndCosts()
  .then(() => {
    console.log('\n✅ Script executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });
