import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function main() {
  console.log('🚚 Iniciando seed de YMS (Gestão de Pátio)...\n');

  const warehouses = await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
  const suppliers = await prisma.supplier.findMany({ where: { active: true } });
  const purchaseOrders = await prisma.purchaseOrder.findMany({ where: { status: { in: ['CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED'] } } });

  if (warehouses.length < 2 || suppliers.length === 0) {
    console.error('❌ É preciso ao menos 2 armazéns e 1 fornecedor. Execute prisma:seed-warehouses e o seed principal antes.');
    process.exit(1);
  }

  console.log('🗑️  Removendo dados de YMS anteriores...');
  await prisma.yardVisit.deleteMany({});
  await prisma.yardDock.deleteMany({});
  await prisma.yardSpot.deleteMany({});
  await prisma.yardArea.deleteMany({});
  await prisma.yardWarehouseParams.deleteMany({});
  await prisma.vehicle.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.fleet.deleteMany({});
  console.log('✅ Dados anteriores removidos\n');

  const yardWarehouses = warehouses.slice(0, 2);

  // ============================================
  // PARÂMETROS DE PÁTIO — um por armazém ativo
  // ============================================
  console.log('⚙️  Criando parâmetros de pátio...\n');
  for (const warehouse of warehouses) {
    await prisma.yardWarehouseParams.create({
      data: {
        warehouseId: warehouse.id,
        useYard: yardWarehouses.some((w) => w.id === warehouse.id),
        delayToleranceMinutes: 15,
      },
    });
  }
  console.log(`✅ ${warehouses.length} parâmetros de pátio criados\n`);

  // ============================================
  // ÁREAS E VAGAS — 2 áreas por armazém de pátio, ~5 vagas cada
  // ============================================
  console.log('🅿️  Criando áreas e vagas de pátio...\n');
  const spots: { id: string; areaId: string; warehouseId: string }[] = [];

  for (const warehouse of yardWarehouses) {
    const areaDefs = [
      { code: 'PATIO-A', name: 'Pátio de Espera A' },
      { code: 'PATIO-B', name: 'Pátio de Espera B' },
    ];

    for (const areaDef of areaDefs) {
      const area = await prisma.yardArea.create({
        data: {
          warehouseId: warehouse.id,
          code: areaDef.code,
          name: `${areaDef.name} — ${warehouse.name}`,
          active: true,
        },
      });

      for (let i = 1; i <= 5; i++) {
        // Uma vaga bloqueada por área, pra tela de vagas sempre ter um caso de bloqueio.
        const blocked = i === 5;
        const spot = await prisma.yardSpot.create({
          data: {
            areaId: area.id,
            code: `VG-${String(i).padStart(2, '0')}`,
            active: true,
            blocked,
            blockedReason: blocked ? 'Vaga em manutenção do piso' : null,
          },
        });
        spots.push({ id: spot.id, areaId: area.id, warehouseId: warehouse.id });
      }
      console.log(`  ✅ ${area.code} — ${area.name}: 5 vagas`);
    }
  }
  console.log(`\n✅ ${spots.length} vagas criadas\n`);

  // ============================================
  // DOCAS — 3 por armazém de pátio
  // ============================================
  console.log('🚪 Criando docas...\n');
  const docks: { id: string; warehouseId: string; serviceType: string }[] = [];

  for (const warehouse of yardWarehouses) {
    const dockDefs: Array<{ code: string; serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO' }> = [
      { code: 'DOCA-01', serviceType: 'RECEBIMENTO' },
      { code: 'DOCA-02', serviceType: 'EXPEDICAO' },
      { code: 'DOCA-03', serviceType: 'MULTIUSO' },
    ];

    for (const dockDef of dockDefs) {
      const dock = await prisma.yardDock.create({
        data: {
          code: dockDef.code,
          serviceType: dockDef.serviceType,
          warehouseId: warehouse.id,
          active: true,
        },
      });
      docks.push({ id: dock.id, warehouseId: warehouse.id, serviceType: dock.serviceType });
    }
    console.log(`  ✅ ${warehouse.code}: 3 docas`);
  }
  console.log(`\n✅ ${docks.length} docas criadas\n`);

  // ============================================
  // FROTAS
  // ============================================
  console.log('🚛 Criando frotas...\n');
  const fleets = [];
  for (let i = 0; i < Math.min(2, suppliers.length); i++) {
    const fleet = await prisma.fleet.create({
      data: {
        name: `Frota Própria ${suppliers[i].name}`,
        supplierId: suppliers[i].id,
        blocked: false,
      },
    });
    fleets.push(fleet);
    console.log(`  ✅ ${fleet.name}`);
  }
  console.log(`\n✅ ${fleets.length} frotas criadas\n`);

  // ============================================
  // MOTORISTAS
  // ============================================
  console.log('🧑‍✈️ Criando motoristas...\n');
  const driverNames = [
    'Carlos Alberto Souza',
    'José Roberto Lima',
    'Antônio Carlos Ferreira',
    'Francisco das Chagas Silva',
    'Raimundo Nonato Costa',
    'Sebastião Pereira Gomes',
  ];
  const drivers = [];
  for (let i = 0; i < driverNames.length; i++) {
    const supplier = suppliers[i % suppliers.length];
    const cpf = `${String(100 + i).padStart(3, '0')}.${String(200 + i).padStart(3, '0')}.${String(300 + i).padStart(3, '0')}-${String(10 + i).padStart(2, '0')}`;
    const driver = await prisma.driver.create({
      data: {
        name: driverNames[i],
        cpf,
        supplierId: supplier.id,
        blocked: i === driverNames.length - 1, // último motorista fica bloqueado, para a tela sempre ter um caso
        blockedReason: i === driverNames.length - 1 ? 'CNH vencida' : null,
      },
    });
    drivers.push(driver);
  }
  console.log(`✅ ${drivers.length} motoristas criados\n`);

  // ============================================
  // VEÍCULOS
  // ============================================
  console.log('🚚 Criando veículos...\n');
  const vehicleTypes: Array<'TRUCK' | 'TOCO' | 'CAVALO' | 'VAN' | 'UTILITARIO'> = [
    'TRUCK',
    'TOCO',
    'CAVALO',
    'VAN',
    'UTILITARIO',
    'TRUCK',
  ];
  const vehicleModels = ['Mercedes-Benz Atego', 'Volkswagen Delivery', 'Scania R450', 'Fiat Ducato', 'Fiat Fiorino', 'Volvo FH540'];
  const vehicles = [];
  for (let i = 0; i < vehicleTypes.length; i++) {
    const supplier = suppliers[i % suppliers.length];
    const fleet = fleets[i % Math.max(fleets.length, 1)];
    const plate = `${String.fromCharCode(65 + i)}${String.fromCharCode(66 + i)}${String.fromCharCode(67 + i)}${1000 + i * 111}`;
    const vehicle = await prisma.vehicle.create({
      data: {
        plate: plate.slice(0, 7).toUpperCase(),
        type: vehicleTypes[i],
        model: vehicleModels[i],
        supplierId: supplier.id,
        fleetId: fleets.length > 0 ? fleet?.id : undefined,
        blocked: false,
      },
    });
    vehicles.push(vehicle);
  }
  console.log(`✅ ${vehicles.length} veículos criados\n`);

  // ============================================
  // VISITAS — cobrindo os 6 status, distribuídas pelos armazéns/docas/vagas
  // ============================================
  console.log('📅 Criando visitas de pátio...\n');

  const visitPlans: Array<{
    status: 'SCHEDULED' | 'CHECKED_IN' | 'IN_YARD' | 'AT_DOCK' | 'COMPLETED' | 'CANCELLED';
    serviceType: 'RECEBIMENTO' | 'EXPEDICAO' | 'MULTIUSO';
    scheduledOffsetHours: number;
    useSpot: boolean;
    useDock: boolean;
    usePurchaseOrder: boolean;
  }> = [
    { status: 'SCHEDULED', serviceType: 'RECEBIMENTO', scheduledOffsetHours: 4, useSpot: false, useDock: false, usePurchaseOrder: true },
    { status: 'SCHEDULED', serviceType: 'EXPEDICAO', scheduledOffsetHours: 24, useSpot: false, useDock: false, usePurchaseOrder: false },
    { status: 'CHECKED_IN', serviceType: 'RECEBIMENTO', scheduledOffsetHours: -1, useSpot: false, useDock: false, usePurchaseOrder: true },
    { status: 'IN_YARD', serviceType: 'RECEBIMENTO', scheduledOffsetHours: -2, useSpot: true, useDock: false, usePurchaseOrder: true },
    { status: 'IN_YARD', serviceType: 'EXPEDICAO', scheduledOffsetHours: -1.5, useSpot: true, useDock: false, usePurchaseOrder: false },
    { status: 'AT_DOCK', serviceType: 'RECEBIMENTO', scheduledOffsetHours: -3, useSpot: false, useDock: true, usePurchaseOrder: true },
    { status: 'AT_DOCK', serviceType: 'MULTIUSO', scheduledOffsetHours: -2.5, useSpot: false, useDock: true, usePurchaseOrder: false },
    { status: 'COMPLETED', serviceType: 'RECEBIMENTO', scheduledOffsetHours: -30, useSpot: false, useDock: true, usePurchaseOrder: true },
    { status: 'COMPLETED', serviceType: 'EXPEDICAO', scheduledOffsetHours: -50, useSpot: false, useDock: true, usePurchaseOrder: false },
    { status: 'COMPLETED', serviceType: 'RECEBIMENTO', scheduledOffsetHours: -80, useSpot: false, useDock: true, usePurchaseOrder: true },
    { status: 'CANCELLED', serviceType: 'RECEBIMENTO', scheduledOffsetHours: -10, useSpot: false, useDock: false, usePurchaseOrder: false },
  ];

  let posIdx = 0;
  let purchaseOrderIdx = 0;
  let visitCount = 0;

  for (const plan of visitPlans) {
    const warehouse = yardWarehouses[visitCount % yardWarehouses.length];
    const driver = drivers[visitCount % drivers.length];
    const vehicle = vehicles[visitCount % vehicles.length];
    const supplier = suppliers[visitCount % suppliers.length];

    const scheduledAt = hoursFromNow(plan.scheduledOffsetHours);
    const availableSpots = spots.filter((s) => s.warehouseId === warehouse.id);
    const availableDocks = docks.filter((d) => d.warehouseId === warehouse.id && d.serviceType === plan.serviceType);

    const data: any = {
      warehouseId: warehouse.id,
      serviceType: plan.serviceType,
      supplierId: supplier.id,
      scheduledAt,
      status: plan.status,
      notes: `Visita gerada pelo seed (${plan.status})`,
      driverId: driver.id,
      vehicleId: vehicle.id,
    };

    if (plan.usePurchaseOrder && purchaseOrders.length > 0) {
      data.purchaseOrderId = purchaseOrders[purchaseOrderIdx % purchaseOrders.length].id;
      purchaseOrderIdx++;
    }

    // Timestamps progressivos coerentes com o status, mesmo padrão da máquina
    // de estados real (check-in -> pátio -> doca -> concluída).
    if (['CHECKED_IN', 'IN_YARD', 'AT_DOCK', 'COMPLETED'].includes(plan.status)) {
      data.checkedInAt = new Date(scheduledAt.getTime() + 10 * 60 * 1000);
    }
    if (plan.useSpot && availableSpots.length > 0) {
      data.yardSpotId = availableSpots[posIdx % availableSpots.length].id;
      posIdx++;
    }
    if ((plan.useDock || plan.status === 'AT_DOCK' || plan.status === 'COMPLETED') && availableDocks.length > 0) {
      data.yardDockId = availableDocks[0].id;
      data.dockArrivedAt = new Date((data.checkedInAt ?? scheduledAt).getTime() + 30 * 60 * 1000);
    }
    if (plan.status === 'AT_DOCK' || plan.status === 'COMPLETED') {
      data.loadingStartedAt = new Date((data.dockArrivedAt ?? scheduledAt).getTime() + 10 * 60 * 1000);
    }
    if (plan.status === 'COMPLETED') {
      data.loadingEndedAt = new Date(data.loadingStartedAt.getTime() + 45 * 60 * 1000);
      data.completedAt = new Date(data.loadingEndedAt.getTime() + 5 * 60 * 1000);
    }

    await prisma.yardVisit.create({ data });
    visitCount++;
    console.log(`  ✅ ${plan.status} — ${plan.serviceType} — ${warehouse.code}`);
  }

  console.log(`\n✅ ${visitCount} visitas de pátio criadas\n`);

  // ============================================
  // RESUMO
  // ============================================
  console.log('📊 Resumo:');
  console.log(`   ${warehouses.length} parâmetros de pátio`);
  console.log(`   ${spots.length} vagas em ${yardWarehouses.length * 2} áreas`);
  console.log(`   ${docks.length} docas`);
  console.log(`   ${fleets.length} frotas`);
  console.log(`   ${drivers.length} motoristas`);
  console.log(`   ${vehicles.length} veículos`);
  console.log(`   ${visitCount} visitas de pátio`);
  console.log('\n✅ Seed de YMS concluído com sucesso!\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar dados de YMS:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
