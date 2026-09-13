import { PrismaClient } from '@prisma/client';
import { generatePositions } from '../src/services/storage-position.service';
import stockService from '../src/services/stock.service';

const prisma = new PrismaClient();

async function main() {
  console.log('🏗️ Criando estruturas de armazenagem...');

  // Buscar os armazéns existentes (ordem determinística: o índice de cada
  // armazém no array abaixo é usado para distribuir as estruturas).
  const warehouses = await prisma.warehouse.findMany({
    where: { active: true },
    orderBy: { code: 'asc' }
  });

  if (warehouses.length === 0) {
    console.log('❌ Nenhum armazém encontrado. Execute primeiro o script seed-warehouses.ts');
    return;
  }

  const structures = [
    // Estruturas para Armazém Central (ARM-001)
    {
      warehouseId: warehouses[0].id,
      streetCode: 'RUA-A-01',
      floors: 5,
      positions: 20,
      weightCapacity: 1500.0,
      height: 600.0,
      width: 120.0,
      depth: 100.0,
      maxHeight: 580.0,
      blocked: false,
      positionType: 'PORTA_PALETES',
    },
    {
      warehouseId: warehouses[0].id,
      streetCode: 'RUA-A-02',
      floors: 4,
      positions: 16,
      weightCapacity: 2000.0,
      height: 500.0,
      width: 140.0,
      depth: 110.0,
      maxHeight: 480.0,
      blocked: false,
      positionType: 'PORTA_PALETES',
    },
    {
      warehouseId: warehouses[0].id,
      streetCode: 'RUA-B-01',
      floors: 3,
      positions: 12,
      weightCapacity: 800.0,
      height: 400.0,
      width: 100.0,
      depth: 80.0,
      maxHeight: 380.0,
      blocked: false,
      positionType: 'MINI_PORTA_PALETES',
    },
    {
      warehouseId: warehouses[0].id,
      streetCode: 'RUA-C-01',
      floors: 6,
      positions: 30,
      weightCapacity: 2500.0,
      height: 700.0,
      width: 150.0,
      depth: 120.0,
      maxHeight: 680.0,
      blocked: false,
      positionType: 'DRIVE_IN',
    },
    // Estruturas para Armazém Zona Sul (ARM-002)
    {
      warehouseId: warehouses[1]?.id || warehouses[0].id,
      streetCode: 'RUA-D-01',
      floors: 4,
      positions: 18,
      weightCapacity: 1200.0,
      height: 550.0,
      width: 130.0,
      depth: 105.0,
      maxHeight: 530.0,
      blocked: false,
      positionType: 'FLOW_RACK',
    },
    {
      warehouseId: warehouses[1]?.id || warehouses[0].id,
      streetCode: 'RUA-D-02',
      floors: 5,
      positions: 22,
      weightCapacity: 1800.0,
      height: 600.0,
      width: 125.0,
      depth: 100.0,
      maxHeight: 580.0,
      blocked: false,
      positionType: 'PUSH_BACK',
    },
    {
      warehouseId: warehouses[1]?.id || warehouses[0].id,
      streetCode: 'RUA-E-01',
      floors: 3,
      positions: 15,
      weightCapacity: 1000.0,
      height: 450.0,
      width: 110.0,
      depth: 90.0,
      maxHeight: 430.0,
      blocked: false,
      positionType: 'CANTILEVER',
    },
    // Estruturas para Armazém Norte (ARM-003)
    {
      warehouseId: warehouses[2]?.id || warehouses[0].id,
      streetCode: 'RUA-F-01',
      floors: 8,
      positions: 40,
      weightCapacity: 3000.0,
      height: 900.0,
      width: 160.0,
      depth: 130.0,
      maxHeight: 880.0,
      blocked: false,
      positionType: 'AUTOPORTANTE',
    },
    {
      warehouseId: warehouses[2]?.id || warehouses[0].id,
      streetCode: 'RUA-G-01',
      floors: 2,
      positions: 10,
      weightCapacity: 500.0,
      height: 300.0,
      width: 80.0,
      depth: 60.0,
      maxHeight: 280.0,
      blocked: false,
      positionType: 'ESTANTES_INDUSTRIAIS',
    },
    {
      warehouseId: warehouses[2]?.id || warehouses[0].id,
      streetCode: 'RUA-H-01',
      floors: 4,
      positions: 20,
      weightCapacity: 1500.0,
      height: 550.0,
      width: 120.0,
      depth: 100.0,
      maxHeight: 530.0,
      blocked: false,
      positionType: 'RACKS',
    },
    // Estruturas para Armazém Refrigerado (ARM-004)
    {
      warehouseId: warehouses[3]?.id || warehouses[0].id,
      streetCode: 'RUA-I-01',
      floors: 3,
      positions: 12,
      weightCapacity: 1000.0,
      height: 400.0,
      width: 110.0,
      depth: 90.0,
      maxHeight: 380.0,
      blocked: false,
      positionType: 'DRIVE_THROUGH',
    },
    {
      warehouseId: warehouses[3]?.id || warehouses[0].id,
      streetCode: 'RUA-I-02',
      floors: 4,
      positions: 16,
      weightCapacity: 1200.0,
      height: 500.0,
      width: 120.0,
      depth: 95.0,
      maxHeight: 480.0,
      blocked: false,
      positionType: 'FLOW_RACK',
    },
    // Estruturas para CD Campinas (ARM-005)
    {
      warehouseId: warehouses[4]?.id || warehouses[0].id,
      streetCode: 'RUA-J-01',
      floors: 10,
      positions: 50,
      weightCapacity: 4000.0,
      height: 1000.0,
      width: 180.0,
      depth: 140.0,
      maxHeight: 980.0,
      blocked: false,
      positionType: 'MINI_LOAD',
    },
    {
      warehouseId: warehouses[4]?.id || warehouses[0].id,
      streetCode: 'RUA-K-01',
      floors: 3,
      positions: 18,
      weightCapacity: 1500.0,
      height: 450.0,
      width: 130.0,
      depth: 100.0,
      maxHeight: 430.0,
      blocked: false,
      positionType: 'CARROSSEL',
    },
    {
      warehouseId: warehouses[4]?.id || warehouses[0].id,
      streetCode: 'RUA-L-01',
      floors: 2,
      positions: 8,
      weightCapacity: 800.0,
      height: 350.0,
      width: 100.0,
      depth: 80.0,
      maxHeight: 330.0,
      blocked: false,
      positionType: 'MEZANINO',
    },
    // Uma estrutura bloqueada para teste
    {
      warehouseId: warehouses[0].id,
      streetCode: 'RUA-Z-99',
      floors: 2,
      positions: 8,
      weightCapacity: 500.0,
      height: 300.0,
      width: 90.0,
      depth: 70.0,
      maxHeight: 280.0,
      blocked: true,
      positionType: 'PORTA_PALETES',
    },
  ];

  const createdStructures = [];
  for (const structure of structures) {
    const created = await prisma.warehouseStructure.create({
      data: structure,
    });
    createdStructures.push(created);
    console.log(`✅ Estrutura criada: ${created.streetCode} - ${created.positionType}`);
  }

  console.log(`\n✨ ${structures.length} estruturas de armazenagem criadas com sucesso!`);

  // ============================================
  // Gerar as posições (endereços) de cada estrutura — sem isso a tabela
  // storage_positions fica vazia e nenhuma tela de WMS (ocupação, putaway,
  // picking, contagem por endereço) tem o que mostrar.
  // ============================================
  console.log('\n🧭 Gerando posições de armazenagem...');
  let totalPositions = 0;
  for (const structure of createdStructures) {
    const positions = await generatePositions(structure.id);
    totalPositions += positions.length;
    console.log(`  ✅ ${structure.streetCode}: ${positions.length} posições geradas`);

    // Marca o nível do chão (andar 1) como área de picking numa rua a cada
    // duas — dá para a tela de reposição (F4.10) ter picking E pulmão de
    // verdade para comparar, sem marcar TODA posição como picking.
    if (!structure.blocked) {
      await prisma.storagePosition.updateMany({
        where: { structureId: structure.id, floor: 1 },
        data: { isPickingArea: true },
      });
    }
  }
  console.log(`✨ ${totalPositions} posições geradas no total.`);

  // ============================================
  // Popular saldo endereçado (stock_position_balances) para um subconjunto de
  // produtos — sem isso as posições existem mas aparecem sempre vazias, e as
  // telas de ocupação/putaway/contagem por endereço não têm nada para exibir.
  // ============================================
  console.log('\n📦 Populando saldo endereçado em algumas posições...');

  const admin = await prisma.user.findFirst({ where: { email: 'admin@fabric.com' } });
  const products = await prisma.product.findMany({ where: { active: true } });

  if (!admin || products.length === 0) {
    console.log('⚠️  Usuário admin ou produtos não encontrados — pulei o saldo endereçado.');
  } else {
    // Só as ruas NÃO bloqueadas dos 2 primeiros armazéns (ARM-001/ARM-002),
    // para manter o volume de movimentações gerado sob controle sem deixar a
    // ocupação vazia demais para avaliar as telas.
    const mainWarehouseIds = new Set([warehouses[0]?.id, warehouses[1]?.id].filter(Boolean));
    const mainStructures = createdStructures.filter(
      (s) => mainWarehouseIds.has(s.warehouseId) && !s.blocked
    );

    let balancesCreated = 0;
    for (let i = 0; i < mainStructures.length; i++) {
      const structure = mainStructures[i];
      const positions = await prisma.storagePosition.findMany({
        where: { structureId: structure.id, floor: 1 },
        orderBy: { position: 'asc' },
        take: 6, // 6 primeiras posições do chão de cada rua principal
      });

      for (let j = 0; j < positions.length; j++) {
        const position = positions[j];
        const product = products[(i * 6 + j) % products.length];
        const quantity = 20 + Math.floor(Math.random() * 180); // 20–200

        await stockService.registerMovement({
          productId: product.id,
          type: 'IN',
          quantity,
          reason: 'Carga inicial de endereçamento (seed)',
          referenceType: 'ADJUSTMENT',
          userId: admin.id,
          toPositionId: position.id,
        });
        balancesCreated++;
      }
    }
    console.log(`✅ ${balancesCreated} saldos endereçados criados em ${mainStructures.length} ruas.`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar estruturas:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
