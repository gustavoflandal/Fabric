import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏗️ Criando estruturas de armazenagem...');

  // Buscar os armazéns existentes
  const warehouses = await prisma.warehouse.findMany({
    where: { active: true }
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

  for (const structure of structures) {
    const created = await prisma.warehouseStructure.create({
      data: structure,
    });
    console.log(`✅ Estrutura criada: ${created.streetCode} - ${created.positionType}`);
  }

  console.log(`\n✨ ${structures.length} estruturas de armazenagem criadas com sucesso!`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar estruturas:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
