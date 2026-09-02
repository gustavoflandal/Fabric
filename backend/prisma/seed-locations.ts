// ⚠️ FORA DA CADEIA DE SEED — F0.6 do plano do WMS
// (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md).
//
// `Location` foi CONGELADO: o endereçamento físico do sistema é a árvore
// `Warehouse -> WarehouseStructure -> StoragePosition` (decisão 4.1). Manter
// duas hierarquias de endereço em paralelo produziria dois saldos, duas
// contagens e duas versões da verdade sobre onde o material está.
//
// Este arquivo continua no repositório apenas como histórico. O script npm
// `prisma:seed-locations` foi removido do package.json e nenhum outro seed o
// invoca — NÃO reintroduza a chamada. O drop de `Location`/`LocationType`
// acontece na Fase 3 (F3.1), depois que `CountingItem` migrar para
// `storagePositionId`.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏢 Iniciando seed de localizações...\n');

  // Limpar localizações existentes
  await prisma.location.deleteMany();
  console.log('🗑️  Localizações antigas removidas\n');

  // Criar Armazém Principal
  const warehouse = await prisma.location.create({
    data: {
      code: 'ARM-01',
      name: 'Armazém Principal',
      type: 'WAREHOUSE',
      active: true,
    },
  });
  console.log(`✅ ${warehouse.code} - ${warehouse.name}`);

  // Criar Áreas do Armazém
  const areas = [
    { code: 'ARM-01-A', name: 'Área A - Matérias-Primas', type: 'AREA', parentId: warehouse.id },
    { code: 'ARM-01-B', name: 'Área B - Semiacabados', type: 'AREA', parentId: warehouse.id },
    { code: 'ARM-01-C', name: 'Área C - Produtos Acabados', type: 'AREA', parentId: warehouse.id },
    { code: 'ARM-01-D', name: 'Área D - Embalagens', type: 'AREA', parentId: warehouse.id },
  ];

  const createdAreas = [];
  for (const area of areas) {
    const created = await prisma.location.create({ data: area });
    createdAreas.push(created);
    console.log(`  ├─ ${created.code} - ${created.name}`);
  }

  // Criar Corredores na Área A (Matérias-Primas)
  const corridorsA = [
    { code: 'ARM-01-A-C1', name: 'Corredor A1', parentId: createdAreas[0].id },
    { code: 'ARM-01-A-C2', name: 'Corredor A2', parentId: createdAreas[0].id },
    { code: 'ARM-01-A-C3', name: 'Corredor A3', parentId: createdAreas[0].id },
  ];

  const createdCorridorsA = [];
  for (const corridor of corridorsA) {
    const created = await prisma.location.create({
      data: { ...corridor, type: 'CORRIDOR' },
    });
    createdCorridorsA.push(created);
    console.log(`    ├─ ${created.code} - ${created.name}`);
  }

  // Criar Prateleiras no Corredor A1
  const shelvesA1 = [];
  for (let i = 1; i <= 5; i++) {
    const shelf = await prisma.location.create({
      data: {
        code: `ARM-01-A-C1-P${String(i).padStart(2, '0')}`,
        name: `Prateleira ${i}`,
        type: 'SHELF',
        parentId: createdCorridorsA[0].id,
      },
    });
    shelvesA1.push(shelf);
    console.log(`      ├─ ${shelf.code} - ${shelf.name}`);

    // Criar Posições na Prateleira
    for (let j = 1; j <= 4; j++) {
      const bin = await prisma.location.create({
        data: {
          code: `ARM-01-A-C1-P${String(i).padStart(2, '0')}-${String(j).padStart(2, '0')}`,
          name: `Posição ${j}`,
          type: 'BIN',
          parentId: shelf.id,
        },
      });
      if (j === 1) {
        console.log(`        ├─ ${bin.code} - ${bin.name}`);
      }
    }
  }

  // Criar Corredores na Área B (Semiacabados)
  const corridorsB = [
    { code: 'ARM-01-B-C1', name: 'Corredor B1', parentId: createdAreas[1].id },
    { code: 'ARM-01-B-C2', name: 'Corredor B2', parentId: createdAreas[1].id },
  ];

  for (const corridor of corridorsB) {
    const created = await prisma.location.create({
      data: { ...corridor, type: 'CORRIDOR' },
    });
    console.log(`    ├─ ${created.code} - ${created.name}`);

    // Criar Prateleiras
    for (let i = 1; i <= 3; i++) {
      await prisma.location.create({
        data: {
          code: `${created.code}-P${String(i).padStart(2, '0')}`,
          name: `Prateleira ${i}`,
          type: 'SHELF',
          parentId: created.id,
        },
      });
    }
  }

  // Criar Corredores na Área C (Produtos Acabados)
  const corridorsC = [
    { code: 'ARM-01-C-C1', name: 'Corredor C1', parentId: createdAreas[2].id },
    { code: 'ARM-01-C-C2', name: 'Corredor C2', parentId: createdAreas[2].id },
    { code: 'ARM-01-C-C3', name: 'Corredor C3', parentId: createdAreas[2].id },
  ];

  for (const corridor of corridorsC) {
    const created = await prisma.location.create({
      data: { ...corridor, type: 'CORRIDOR' },
    });
    console.log(`    ├─ ${created.code} - ${created.name}`);

    // Criar Prateleiras
    for (let i = 1; i <= 4; i++) {
      await prisma.location.create({
        data: {
          code: `${created.code}-P${String(i).padStart(2, '0')}`,
          name: `Prateleira ${i}`,
          type: 'SHELF',
          parentId: created.id,
        },
      });
    }
  }

  // Criar Corredores na Área D (Embalagens)
  const corridorsD = [
    { code: 'ARM-01-D-C1', name: 'Corredor D1', parentId: createdAreas[3].id },
  ];

  for (const corridor of corridorsD) {
    const created = await prisma.location.create({
      data: { ...corridor, type: 'CORRIDOR' },
    });
    console.log(`    ├─ ${created.code} - ${created.name}`);

    // Criar Prateleiras
    for (let i = 1; i <= 2; i++) {
      await prisma.location.create({
        data: {
          code: `${created.code}-P${String(i).padStart(2, '0')}`,
          name: `Prateleira ${i}`,
          type: 'SHELF',
          parentId: created.id,
        },
      });
    }
  }

  // Criar Área de Piso (Floor)
  const floor = await prisma.location.create({
    data: {
      code: 'ARM-01-PISO',
      name: 'Área de Piso',
      type: 'FLOOR',
      parentId: warehouse.id,
    },
  });
  console.log(`  ├─ ${floor.code} - ${floor.name}`);

  // Contar total de localizações criadas
  const total = await prisma.location.count();

  console.log(`\n✅ ${total} localizações criadas com sucesso!\n`);

  // Mostrar estrutura hierárquica
  console.log('📊 Estrutura criada:');
  console.log(`   1 Armazém`);
  console.log(`   ├─ 4 Áreas`);
  console.log(`   ├─ 9 Corredores`);
  console.log(`   ├─ 5 Prateleiras (Corredor A1) + outras`);
  console.log(`   └─ 20 Posições (Corredor A1)`);
  console.log(`\n   Total: ${total} localizações`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar localizações:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
