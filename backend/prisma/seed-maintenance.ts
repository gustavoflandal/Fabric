import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function main() {
  console.log('🔧 Iniciando seed de Manutenção...\n');

  const workCenters = await prisma.workCenter.findMany();
  const users = await prisma.user.findMany();

  if (workCenters.length === 0 || users.length === 0) {
    console.error('❌ Centros de trabalho ou usuários não encontrados. Execute o seed principal primeiro.');
    process.exit(1);
  }

  const admin = users.find((u) => u.email === 'admin@fabric.com') || users[0];
  const technicians = users.filter((u) => u.email !== admin.email);
  const pickTechnician = (i: number) => (technicians.length > 0 ? technicians[i % technicians.length] : admin);

  console.log('🗑️  Removendo dados de manutenção anteriores...');
  await prisma.maintenanceOrder.deleteMany({});
  await prisma.maintenancePlan.deleteMany({});
  await prisma.equipment.deleteMany({});
  console.log('✅ Dados anteriores removidos\n');

  // ============================================
  // EQUIPAMENTOS — 2 por centro de trabalho (menos o último, só 1, e 1 inativo)
  // ============================================
  console.log('🏭 Criando equipamentos...\n');

  const equipmentSpecs = [
    { manufacturer: 'Festo', model: 'FX-2000' },
    { manufacturer: 'Siemens', model: 'S7-1200' },
    { manufacturer: 'ABB', model: 'IRB-460' },
    { manufacturer: 'Bosch', model: 'BR-500' },
    { manufacturer: 'Schneider', model: 'SC-Modicon' },
    { manufacturer: 'WEG', model: 'W22-IE3' },
    { manufacturer: 'Mitsubishi', model: 'MF-3000' },
    { manufacturer: 'Nardini', model: 'ND-CNC' },
    { manufacturer: 'Romi', model: 'RM-8000' },
    { manufacturer: 'Metalúrgica Atlas', model: 'AT-Compressor' },
  ];

  const equipmentList: { id: string; code: string; name: string }[] = [];
  let specIndex = 0;

  for (let wcIndex = 0; wcIndex < workCenters.length; wcIndex++) {
    const workCenter = workCenters[wcIndex];
    const equipmentPerCenter = wcIndex === workCenters.length - 1 ? 1 : 2;

    for (let n = 0; n < equipmentPerCenter; n++) {
      const spec = equipmentSpecs[specIndex % equipmentSpecs.length];
      specIndex++;
      const code = `EQP-${String(equipmentList.length + 1).padStart(3, '0')}`;
      const name = `${workCenter.name} — ${spec.manufacturer} ${n + 1}`;
      // O último equipamento criado fica inativo, para a tela de listagem
      // sempre ter ao menos um caso "Inativo" para o filtro.
      const active = !(wcIndex === workCenters.length - 1 && n === 0 && workCenters.length > 1);

      const equipment = await prisma.equipment.create({
        data: {
          code,
          name,
          workCenterId: workCenter.id,
          manufacturer: spec.manufacturer,
          model: spec.model,
          active,
        },
      });
      equipmentList.push(equipment);
      console.log(`  ✅ ${equipment.code} - ${equipment.name}${active ? '' : ' (inativo)'}`);
    }
  }

  console.log(`\n✅ ${equipmentList.length} equipamentos criados\n`);

  // ============================================
  // PLANOS DE MANUTENÇÃO PREVENTIVA — 1 por equipamento, frequências variadas
  // ============================================
  console.log('📋 Criando planos de manutenção preventiva...\n');

  const frequencies = [7, 15, 30, 60, 90];
  // Mistura de vencidos, vencendo hoje/amanhã e no futuro — para o dashboard
  // de manutenção sempre ter "atrasadas" e "próximas" para mostrar.
  const dueOffsets = [-10, -3, 0, 2, 5, 10, 20, 45, -1, 15];

  const plans: { id: string; equipmentId: string }[] = [];

  for (let i = 0; i < equipmentList.length; i++) {
    const equipment = equipmentList[i];
    const frequencyDays = frequencies[i % frequencies.length];
    const nextDueDate = daysFromNow(dueOffsets[i % dueOffsets.length]);

    const plan = await prisma.maintenancePlan.create({
      data: {
        equipmentId: equipment.id,
        name: `Preventiva ${frequencyDays} dias — ${equipment.name}`,
        description: `Rotina de manutenção preventiva a cada ${frequencyDays} dias: lubrificação, inspeção visual, verificação de folgas e testes de segurança.`,
        frequencyDays,
        nextDueDate,
        active: true,
      },
    });
    plans.push(plan);

    const status = nextDueDate < new Date() ? 'ATRASADO' : 'em dia';
    console.log(`  ✅ ${plan.name} — próxima em ${nextDueDate.toLocaleDateString('pt-BR')} (${status})`);
  }

  console.log(`\n✅ ${plans.length} planos de manutenção criados\n`);

  // ============================================
  // ORDENS DE MANUTENÇÃO — mistura de preventivas e corretivas, em todos os status
  // ============================================
  console.log('🛠️  Criando ordens de manutenção...\n');

  const correctiveProblems = [
    'Ruído anormal durante a operação',
    'Vazamento de óleo hidráulico identificado na inspeção de rotina',
    'Parada inesperada por superaquecimento',
    'Sensor de posição apresentando leitura inconsistente',
    'Vibração excessiva acima do limite tolerado',
    'Painel elétrico com falha intermitente',
  ];

  let orderCount = 0;

  // 1) Preventivas COMPLETED — histórico de manutenções já realizadas (uma por plano, nos primeiros planos)
  for (let i = 0; i < Math.min(4, plans.length); i++) {
    const plan = plans[i];
    const equipment = equipmentList.find((e) => e.id === plan.equipmentId)!;
    const startedAt = daysFromNow(-30 + i * 2);
    const completedAt = new Date(startedAt.getTime() + 3 * 60 * 60 * 1000);

    await prisma.maintenanceOrder.create({
      data: {
        equipmentId: equipment.id,
        planId: plan.id,
        type: 'PREVENTIVE',
        status: 'COMPLETED',
        problemDescription: 'Manutenção preventiva programada',
        resolutionNotes: 'Lubrificação e inspeção realizadas conforme checklist. Nenhuma anormalidade encontrada.',
        assignedTo: pickTechnician(i).id,
        createdAt: startedAt,
        startedAt,
        completedAt,
      },
    });
    orderCount++;
  }

  // 2) Preventivas PENDING — geradas a partir de planos vencidos/próximos, ainda não iniciadas
  for (let i = 4; i < Math.min(7, plans.length); i++) {
    const plan = plans[i];
    const equipment = equipmentList.find((e) => e.id === plan.equipmentId)!;

    await prisma.maintenanceOrder.create({
      data: {
        equipmentId: equipment.id,
        planId: plan.id,
        type: 'PREVENTIVE',
        status: 'PENDING',
        problemDescription: 'Manutenção preventiva programada — aguardando execução',
        assignedTo: pickTechnician(i).id,
        createdAt: daysFromNow(-1),
      },
    });
    orderCount++;
  }

  // 3) Preventiva IN_PROGRESS — uma em andamento agora
  if (plans.length > 7) {
    const plan = plans[7];
    const equipment = equipmentList.find((e) => e.id === plan.equipmentId)!;
    await prisma.maintenanceOrder.create({
      data: {
        equipmentId: equipment.id,
        planId: plan.id,
        type: 'PREVENTIVE',
        status: 'IN_PROGRESS',
        problemDescription: 'Manutenção preventiva programada',
        assignedTo: pickTechnician(7).id,
        createdAt: daysFromNow(-1),
        startedAt: new Date(Date.now() - 45 * 60 * 1000),
      },
    });
    orderCount++;
  }

  // 4) Corretivas — sem plano, cobrindo os 4 status, espalhadas pelos equipamentos
  const correctiveStatuses: Array<'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'> = [
    'PENDING',
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'COMPLETED',
    'CANCELLED',
  ];

  for (let i = 0; i < correctiveStatuses.length && i < equipmentList.length; i++) {
    const equipment = equipmentList[(i * 3) % equipmentList.length];
    const status = correctiveStatuses[i];
    const problem = correctiveProblems[i % correctiveProblems.length];
    const createdAt = daysFromNow(-15 + i * 2);

    const data: any = {
      equipmentId: equipment.id,
      type: 'CORRECTIVE',
      status,
      problemDescription: problem,
      assignedTo: pickTechnician(i + 2).id,
      createdAt,
    };

    if (status === 'IN_PROGRESS' || status === 'COMPLETED' || status === 'CANCELLED') {
      data.startedAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
    }
    if (status === 'COMPLETED') {
      data.completedAt = new Date(data.startedAt.getTime() + 4 * 60 * 60 * 1000);
      data.resolutionNotes = 'Peça substituída e equipamento testado — operação normalizada.';
    }
    if (status === 'CANCELLED') {
      data.resolutionNotes = 'Cancelada: problema resolvido por ajuste operacional, sem necessidade de intervenção técnica.';
    }

    await prisma.maintenanceOrder.create({ data });
    orderCount++;
  }

  console.log(`✅ ${orderCount} ordens de manutenção criadas\n`);

  // ============================================
  // RESUMO
  // ============================================
  const totalEquipment = await prisma.equipment.count();
  const totalPlans = await prisma.maintenancePlan.count();
  const totalOrders = await prisma.maintenanceOrder.count();

  console.log('📊 Resumo:');
  console.log(`   ${totalEquipment} equipamentos`);
  console.log(`   ${totalPlans} planos de manutenção`);
  console.log(`   ${totalOrders} ordens de manutenção`);
  console.log('\n✅ Seed de Manutenção concluído com sucesso!\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar dados de manutenção:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
