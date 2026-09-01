import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🏭 Criando armazéns...');

  const warehouses = [
    {
      code: 'ARM-001',
      name: 'Armazém Central',
      legalName: 'Armazém Central Fabric Ltda',
      document: '12.345.678/0001-90',
      email: 'central@fabric.com',
      phone: '(11) 3456-7890',
      address: 'Av. Industrial, 1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
      country: 'BR',
      managerName: 'João Silva',
      capacity: 5000.0,
      description: 'Armazém principal para produtos acabados e matéria-prima',
      active: true,
    },
    {
      code: 'ARM-002',
      name: 'Armazém Zona Sul',
      legalName: 'Armazém Zona Sul Fabric Ltda',
      document: '23.456.789/0001-01',
      email: 'zonasul@fabric.com',
      phone: '(11) 3456-7891',
      address: 'Rua dos Comerciantes, 500',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '04000-000',
      country: 'BR',
      managerName: 'Maria Santos',
      capacity: 3000.0,
      description: 'Armazém secundário para distribuição zona sul',
      active: true,
    },
    {
      code: 'ARM-003',
      name: 'Armazém Norte',
      legalName: 'Armazém Norte Fabric Ltda',
      document: '34.567.890/0001-12',
      email: 'norte@fabric.com',
      phone: '(11) 3456-7892',
      address: 'Av. Norte, 2000',
      city: 'Guarulhos',
      state: 'SP',
      zipCode: '07000-000',
      country: 'BR',
      managerName: 'Pedro Oliveira',
      capacity: 4000.0,
      description: 'Armazém para produtos em trânsito e cross-docking',
      active: true,
    },
    {
      code: 'ARM-004',
      name: 'Armazém Refrigerado',
      legalName: 'Armazém Refrigerado Fabric Ltda',
      document: '45.678.901/0001-23',
      email: 'refrigerado@fabric.com',
      phone: '(11) 3456-7893',
      address: 'Rua da Logística, 100',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '02000-000',
      country: 'BR',
      managerName: 'Ana Costa',
      capacity: 1500.0,
      description: 'Armazém climatizado para produtos sensíveis à temperatura',
      active: true,
    },
    {
      code: 'ARM-005',
      name: 'Armazém CD Campinas',
      legalName: 'Centro de Distribuição Campinas Fabric Ltda',
      document: '56.789.012/0001-34',
      email: 'campinas@fabric.com',
      phone: '(19) 3456-7890',
      address: 'Rod. Anhanguera, km 95',
      city: 'Campinas',
      state: 'SP',
      zipCode: '13000-000',
      country: 'BR',
      managerName: 'Carlos Mendes',
      capacity: 6000.0,
      description: 'Centro de distribuição regional para interior de São Paulo',
      active: true,
    },
    {
      code: 'ARM-006',
      name: 'Armazém Inativo - Teste',
      legalName: 'Armazém Teste Ltda',
      document: '67.890.123/0001-45',
      email: 'teste@fabric.com',
      phone: '(11) 9999-9999',
      address: 'Rua Teste, 1',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '00000-000',
      country: 'BR',
      managerName: 'Teste Silva',
      capacity: 100.0,
      description: 'Armazém de teste - inativo',
      active: false,
    },
  ];

  for (const warehouse of warehouses) {
    const created = await prisma.warehouse.upsert({
      where: { code: warehouse.code },
      update: warehouse,
      create: warehouse,
    });
    console.log(`✅ Armazém criado: ${created.code} - ${created.name}`);
  }

  console.log(`\n✨ ${warehouses.length} armazéns criados com sucesso!`);
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar armazéns:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
