import { prisma } from '../src/config/database';

/**
 * Script para criar centros de trabalho
 */

async function createWorkCenters() {
  console.log('🏭 Criando centros de trabalho...\n');

  try {
    const centersToCreate = [
      { 
        code: 'CT-MONT', 
        name: 'Montagem Principal', 
        description: 'Centro de trabalho para montagem de produtos eletrônicos',
        type: 'MACHINE',
        costPerHour: 80.00, 
        capacity: 8,
        efficiency: 0.85,
      },
      { 
        code: 'CT-SOLD', 
        name: 'Soldagem SMT', 
        description: 'Centro de trabalho para soldagem de componentes SMT',
        type: 'MACHINE',
        costPerHour: 120.00, 
        capacity: 8,
        efficiency: 0.90,
      },
      { 
        code: 'CT-TEST', 
        name: 'Teste e Qualidade', 
        description: 'Centro de trabalho para testes funcionais e controle de qualidade',
        type: 'MANUAL',
        costPerHour: 60.00, 
        capacity: 8,
        efficiency: 0.85,
      },
      { 
        code: 'CT-EMB', 
        name: 'Embalagem', 
        description: 'Centro de trabalho para embalagem e expedição',
        type: 'MANUAL',
        costPerHour: 40.00, 
        capacity: 8,
        efficiency: 0.95,
      },
      { 
        code: 'CT-TEAR', 
        name: 'Tecelagem', 
        description: 'Centro de trabalho para tecelagem de tecidos',
        type: 'MACHINE',
        costPerHour: 100.00, 
        capacity: 8,
        efficiency: 0.80,
      },
      { 
        code: 'CT-TINT', 
        name: 'Tinturaria', 
        description: 'Centro de trabalho para tingimento de tecidos',
        type: 'MACHINE',
        costPerHour: 90.00, 
        capacity: 8,
        efficiency: 0.75,
      },
      { 
        code: 'CT-ACAB', 
        name: 'Acabamento', 
        description: 'Centro de trabalho para acabamento de tecidos',
        type: 'MANUAL',
        costPerHour: 70.00, 
        capacity: 8,
        efficiency: 0.85,
      },
    ];

    let created = 0;
    let updated = 0;

    for (const center of centersToCreate) {
      // Verificar se já existe
      const existing = await prisma.workCenter.findFirst({
        where: { code: center.code },
      });

      if (existing) {
        // Atualizar
        await prisma.workCenter.update({
          where: { id: existing.id },
          data: {
            name: center.name,
            description: center.description,
            type: center.type,
            costPerHour: center.costPerHour,
            capacity: center.capacity,
            efficiency: center.efficiency,
            active: true,
          },
        });
        console.log(`   ✅ Atualizado: ${center.code} - ${center.name} (R$ ${center.costPerHour.toFixed(2)}/h)`);
        updated++;
      } else {
        // Criar novo
        await prisma.workCenter.create({
          data: {
            code: center.code,
            name: center.name,
            description: center.description,
            type: center.type,
            costPerHour: center.costPerHour,
            capacity: center.capacity,
            efficiency: center.efficiency,
            active: true,
          },
        });
        console.log(`   ✅ Criado: ${center.code} - ${center.name} (R$ ${center.costPerHour.toFixed(2)}/h)`);
        created++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Processo concluído!`);
    console.log(`   🆕 Criados: ${created}`);
    console.log(`   🔄 Atualizados: ${updated}`);
    console.log('='.repeat(60) + '\n');

    // Listar todos os centros de trabalho
    const allCenters = await prisma.workCenter.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });

    console.log('📋 Centros de Trabalho Cadastrados:\n');
    for (const center of allCenters) {
      console.log(`${center.code} - ${center.name}`);
      console.log(`   Custo/hora: R$ ${center.costPerHour.toFixed(2)}`);
      console.log(`   Capacidade: ${center.capacity}h/dia`);
      console.log(`   Eficiência: ${(center.efficiency * 100).toFixed(0)}%\n`);
    }

  } catch (error) {
    console.error('❌ Erro ao criar centros de trabalho:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
createWorkCenters()
  .then(() => {
    console.log('✅ Script executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
