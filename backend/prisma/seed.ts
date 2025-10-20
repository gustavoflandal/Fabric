import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar permissões padrão
  console.log('📝 Criando permissões...');
  const permissions = [
    // Usuários
    { resource: 'users', action: 'create', description: 'Criar usuários' },
    { resource: 'users', action: 'read', description: 'Visualizar usuários' },
    { resource: 'users', action: 'update', description: 'Editar usuários' },
    { resource: 'users', action: 'delete', description: 'Excluir usuários' },
    
    // Perfis
    { resource: 'roles', action: 'create', description: 'Criar perfis' },
    { resource: 'roles', action: 'read', description: 'Visualizar perfis' },
    { resource: 'roles', action: 'update', description: 'Editar perfis' },
    { resource: 'roles', action: 'delete', description: 'Excluir perfis' },
    
    // Produtos
    { resource: 'products', action: 'create', description: 'Criar produtos' },
    { resource: 'products', action: 'read', description: 'Visualizar produtos' },
    { resource: 'products', action: 'update', description: 'Editar produtos' },
    { resource: 'products', action: 'delete', description: 'Excluir produtos' },
    
    // BOMs (Estruturas de Produto)
    { resource: 'boms', action: 'create', description: 'Criar BOMs' },
    { resource: 'boms', action: 'read', description: 'Visualizar BOMs' },
    { resource: 'boms', action: 'update', description: 'Editar BOMs' },
    { resource: 'boms', action: 'delete', description: 'Excluir BOMs' },
    
    // Roteiros de Produção
    { resource: 'routings', action: 'create', description: 'Criar roteiros' },
    { resource: 'routings', action: 'read', description: 'Visualizar roteiros' },
    { resource: 'routings', action: 'update', description: 'Editar roteiros' },
    { resource: 'routings', action: 'delete', description: 'Excluir roteiros' },
    
    // Ordens de Produção
    { resource: 'production_orders', action: 'create', description: 'Criar ordens de produção' },
    { resource: 'production_orders', action: 'read', description: 'Visualizar ordens de produção' },
    { resource: 'production_orders', action: 'update', description: 'Editar ordens de produção' },
    { resource: 'production_orders', action: 'delete', description: 'Excluir ordens de produção' },
    { resource: 'production_orders', action: 'execute', description: 'Executar ordens de produção' },
    
    // Apontamentos de Produção
    { resource: 'production_pointings', action: 'create', description: 'Criar apontamentos' },
    { resource: 'production_pointings', action: 'read', description: 'Visualizar apontamentos' },
    { resource: 'production_pointings', action: 'update', description: 'Editar apontamentos' },
    { resource: 'production_pointings', action: 'delete', description: 'Excluir apontamentos' },
    
    // Centros de Trabalho
    { resource: 'work_centers', action: 'create', description: 'Criar centros de trabalho' },
    { resource: 'work_centers', action: 'read', description: 'Visualizar centros de trabalho' },
    { resource: 'work_centers', action: 'update', description: 'Editar centros de trabalho' },
    { resource: 'work_centers', action: 'delete', description: 'Excluir centros de trabalho' },
    
    // Fornecedores
    { resource: 'suppliers', action: 'create', description: 'Criar fornecedores' },
    { resource: 'suppliers', action: 'read', description: 'Visualizar fornecedores' },
    { resource: 'suppliers', action: 'update', description: 'Editar fornecedores' },
    { resource: 'suppliers', action: 'delete', description: 'Excluir fornecedores' },
    
    // Clientes
    { resource: 'customers', action: 'create', description: 'Criar clientes' },
    { resource: 'customers', action: 'read', description: 'Visualizar clientes' },
    { resource: 'customers', action: 'update', description: 'Editar clientes' },
    { resource: 'customers', action: 'delete', description: 'Excluir clientes' },
    
    // Estoque
    { resource: 'stock', action: 'read', description: 'Visualizar estoque' },
    { resource: 'stock', action: 'update', description: 'Movimentar estoque' },
    { resource: 'stock', action: 'entry', description: 'Registrar entrada de estoque' },
    { resource: 'stock', action: 'exit', description: 'Registrar saída de estoque' },
    { resource: 'stock', action: 'adjustment', description: 'Ajustar estoque' },
    
    // MRP (Planejamento de Materiais)
    { resource: 'mrp', action: 'read', description: 'Visualizar MRP' },
    { resource: 'mrp', action: 'execute', description: 'Executar MRP' },
    { resource: 'mrp', action: 'consolidate', description: 'Consolidar necessidades' },
    
    // Relatórios
    { resource: 'reports', action: 'read', description: 'Visualizar relatórios' },
    { resource: 'reports', action: 'export', description: 'Exportar relatórios' },
    { resource: 'reports', action: 'production', description: 'Relatório de produção' },
    { resource: 'reports', action: 'efficiency', description: 'Relatório de eficiência' },
    { resource: 'reports', action: 'quality', description: 'Relatório de qualidade' },
    
    // Logs de Auditoria
    { resource: 'audit_logs', action: 'read', description: 'Visualizar logs de auditoria' },
    { resource: 'audit_logs', action: 'delete', description: 'Excluir logs de auditoria' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: {},
      create: perm,
    });
  }

  console.log(`✅ ${permissions.length} permissões criadas`);

  // Criar perfis
  console.log('👥 Criando perfis...');
  
  const allPermissions = await prisma.permission.findMany();
  
  // Criar ou atualizar perfil ADMIN
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {
      name: 'Administrador',
      description: 'Acesso total ao sistema',
    },
    create: {
      code: 'ADMIN',
      name: 'Administrador',
      description: 'Acesso total ao sistema',
    },
  });

  // Remover permissões antigas e adicionar todas as novas
  await prisma.rolePermission.deleteMany({
    where: { roleId: adminRole.id },
  });

  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({
      roleId: adminRole.id,
      permissionId: p.id,
    })),
  });

  await prisma.role.upsert({
    where: { code: 'MANAGER' },
    update: {},
    create: {
      code: 'MANAGER',
      name: 'Gerente',
      description: 'Gerente de produção com acesso a relatórios',
    },
  });

  await prisma.role.upsert({
    where: { code: 'OPERATOR' },
    update: {},
    create: {
      code: 'OPERATOR',
      name: 'Operador',
      description: 'Operador de produção',
    },
  });

  console.log('✅ Perfis criados: ADMIN, MANAGER, OPERATOR');

  // Criar usuário administrador
  console.log('🔑 Criando usuário administrador...');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { email: 'admin@fabric.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@fabric.com',
      password: hashedPassword,
      roles: {
        create: {
          roleId: adminRole.id,
        },
      },
    },
  });

  console.log('✅ Usuário administrador criado');
  console.log('   Email: admin@fabric.com');
  console.log('   Senha: admin123');

  // Criar unidades de medida
  console.log('📏 Criando unidades de medida...');
  
  const units = [
    { code: 'UN', name: 'Unidade', type: 'quantity', symbol: 'un', active: true },
    { code: 'KG', name: 'Quilograma', type: 'weight', symbol: 'kg', active: true },
    { code: 'G', name: 'Grama', type: 'weight', symbol: 'g', active: true },
    { code: 'L', name: 'Litro', type: 'volume', symbol: 'L', active: true },
    { code: 'ML', name: 'Mililitro', type: 'volume', symbol: 'mL', active: true },
    { code: 'M', name: 'Metro', type: 'length', symbol: 'm', active: true },
    { code: 'CM', name: 'Centímetro', type: 'length', symbol: 'cm', active: true },
    { code: 'CX', name: 'Caixa', type: 'quantity', symbol: 'cx', active: true },
    { code: 'PC', name: 'Peça', type: 'quantity', symbol: 'pc', active: true },
  ];

  for (const unit of units) {
    await prisma.unitOfMeasure.upsert({
      where: { code: unit.code },
      update: {},
      create: unit,
    });
  }

  console.log(`✅ ${units.length} unidades de medida criadas`);

  // Criar categorias de produto
  console.log('📦 Criando categorias de produto...');
  
  const categories = [
    { code: 'ELETRO', name: 'Eletrônicos', description: 'Produtos eletrônicos' },
    { code: 'METAL', name: 'Metálicos', description: 'Componentes metálicos' },
    { code: 'PLAST', name: 'Plásticos', description: 'Componentes plásticos' },
    { code: 'QUIM', name: 'Químicos', description: 'Produtos químicos e reagentes' },
    { code: 'EMB', name: 'Embalagens', description: 'Materiais de embalagem' },
  ];

  for (const category of categories) {
    await prisma.productCategory.upsert({
      where: { code: category.code },
      update: {},
      create: category,
    });
  }

  console.log(`✅ ${categories.length} categorias de produto criadas`);

  // Criar produtos de exemplo
  console.log('📦 Criando produtos de exemplo...');
  
  // Buscar IDs das unidades e categorias
  const unitUN = await prisma.unitOfMeasure.findUnique({ where: { code: 'UN' } });
  const unitKG = await prisma.unitOfMeasure.findUnique({ where: { code: 'KG' } });
  const unitG = await prisma.unitOfMeasure.findUnique({ where: { code: 'G' } });
  const unitPC = await prisma.unitOfMeasure.findUnique({ where: { code: 'PC' } });
  const unitM = await prisma.unitOfMeasure.findUnique({ where: { code: 'M' } });
  
  const catEletro = await prisma.productCategory.findUnique({ where: { code: 'ELETRO' } });
  const catMetal = await prisma.productCategory.findUnique({ where: { code: 'METAL' } });
  const catPlast = await prisma.productCategory.findUnique({ where: { code: 'PLAST' } });
  const catQuim = await prisma.productCategory.findUnique({ where: { code: 'QUIM' } });
  const catEmb = await prisma.productCategory.findUnique({ where: { code: 'EMB' } });

  const products = [
    // Produtos Acabados
    {
      code: 'PA-001',
      name: 'Smartphone XPro',
      description: 'Smartphone de última geração',
      type: 'finished',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 5,
      minStock: 10,
      safetyStock: 5,
      standardCost: 1500.00,
      active: true,
    },
    {
      code: 'PA-002',
      name: 'Notebook Ultra',
      description: 'Notebook profissional',
      type: 'finished',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 7,
      minStock: 5,
      safetyStock: 3,
      standardCost: 3500.00,
      active: true,
    },
    
    // Semiacabados
    {
      code: 'SA-001',
      name: 'Placa Mãe Montada',
      description: 'Placa mãe com componentes soldados',
      type: 'semi_finished',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 3,
      minStock: 20,
      safetyStock: 10,
      standardCost: 800.00,
      active: true,
    },
    {
      code: 'SA-002',
      name: 'Display LCD Montado',
      description: 'Display com touch screen',
      type: 'semi_finished',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 2,
      minStock: 30,
      safetyStock: 15,
      standardCost: 300.00,
      active: true,
    },
    {
      code: 'SA-003',
      name: 'Carcaça Plástica',
      description: 'Carcaça injetada e pintada',
      type: 'semi_finished',
      unitId: unitUN!.id,
      categoryId: catPlast!.id,
      leadTime: 2,
      minStock: 50,
      safetyStock: 20,
      standardCost: 50.00,
      active: true,
    },
    
    // Matérias-primas
    {
      code: 'MP-001',
      name: 'Chip Processador A15',
      description: 'Processador de alta performance',
      type: 'raw_material',
      unitId: unitPC!.id,
      categoryId: catEletro!.id,
      leadTime: 15,
      minStock: 100,
      safetyStock: 50,
      standardCost: 250.00,
      active: true,
    },
    {
      code: 'MP-002',
      name: 'Memória RAM 8GB',
      description: 'Módulo de memória DDR4',
      type: 'raw_material',
      unitId: unitPC!.id,
      categoryId: catEletro!.id,
      leadTime: 10,
      minStock: 200,
      safetyStock: 100,
      standardCost: 120.00,
      active: true,
    },
    {
      code: 'MP-003',
      name: 'Bateria Li-Ion 4000mAh',
      description: 'Bateria de lítio recarregável',
      type: 'raw_material',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 12,
      minStock: 150,
      safetyStock: 75,
      standardCost: 80.00,
      active: true,
    },
    {
      code: 'MP-004',
      name: 'Parafuso M2x5mm',
      description: 'Parafuso de fixação',
      type: 'raw_material',
      unitId: unitPC!.id,
      categoryId: catMetal!.id,
      leadTime: 5,
      minStock: 5000,
      safetyStock: 2000,
      standardCost: 0.05,
      active: true,
    },
    {
      code: 'MP-005',
      name: 'Resina ABS Natural',
      description: 'Resina plástica para injeção',
      type: 'raw_material',
      unitId: unitKG!.id,
      categoryId: catQuim!.id,
      leadTime: 20,
      minStock: 500,
      safetyStock: 200,
      standardCost: 15.00,
      active: true,
    },
    {
      code: 'MP-006',
      name: 'Tinta Spray Preta',
      description: 'Tinta para acabamento',
      type: 'raw_material',
      unitId: unitUN!.id,
      categoryId: catQuim!.id,
      leadTime: 7,
      minStock: 50,
      safetyStock: 20,
      standardCost: 25.00,
      active: true,
    },
    {
      code: 'MP-007',
      name: 'Cabo USB-C',
      description: 'Cabo de dados e carregamento',
      type: 'raw_material',
      unitId: unitUN!.id,
      categoryId: catEletro!.id,
      leadTime: 8,
      minStock: 200,
      safetyStock: 100,
      standardCost: 12.00,
      active: true,
    },
    
    // Embalagens
    {
      code: 'EMB-001',
      name: 'Caixa Papelão 30x20x10',
      description: 'Caixa para produto acabado',
      type: 'packaging',
      unitId: unitUN!.id,
      categoryId: catEmb!.id,
      leadTime: 3,
      minStock: 500,
      safetyStock: 200,
      standardCost: 3.50,
      active: true,
    },
    {
      code: 'EMB-002',
      name: 'Manual do Usuário',
      description: 'Manual impresso',
      type: 'packaging',
      unitId: unitUN!.id,
      categoryId: catEmb!.id,
      leadTime: 5,
      minStock: 1000,
      safetyStock: 500,
      standardCost: 1.20,
      active: true,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: {},
      create: product,
    });
  }

  console.log(`✅ ${products.length} produtos criados`);

  // Criar BOMs para os produtos
  console.log('🔧 Criando BOMs...');

  // Verificar se BOMs já existem
  const existingBoms = await prisma.bOM.count();
  if (existingBoms > 0) {
    console.log('⚠️  BOMs já existem, pulando criação...');
  } else {
    // Buscar produtos criados
  const smartphone = await prisma.product.findUnique({ where: { code: 'PA-001' } });
  const notebook = await prisma.product.findUnique({ where: { code: 'PA-002' } });
  const placaMae = await prisma.product.findUnique({ where: { code: 'SA-001' } });
  const display = await prisma.product.findUnique({ where: { code: 'SA-002' } });
  const carcaca = await prisma.product.findUnique({ where: { code: 'SA-003' } });
  const processador = await prisma.product.findUnique({ where: { code: 'MP-001' } });
  const memoria = await prisma.product.findUnique({ where: { code: 'MP-002' } });
  const bateria = await prisma.product.findUnique({ where: { code: 'MP-003' } });
  const parafuso = await prisma.product.findUnique({ where: { code: 'MP-004' } });
  const resina = await prisma.product.findUnique({ where: { code: 'MP-005' } });
  const tinta = await prisma.product.findUnique({ where: { code: 'MP-006' } });
  const cabo = await prisma.product.findUnique({ where: { code: 'MP-007' } });
  const caixa = await prisma.product.findUnique({ where: { code: 'EMB-001' } });
  const manual = await prisma.product.findUnique({ where: { code: 'EMB-002' } });

  // BOM para SA-001 (Placa Mãe Montada)
  await prisma.bOM.create({
    data: {
      productId: placaMae!.id,
      version: 1,
      description: 'BOM da Placa Mãe Montada',
      active: true,
      items: {
        create: [
          {
            componentId: processador!.id,
            quantity: 1,
            unitId: unitPC!.id,
            scrapFactor: 0.02,
            sequence: 10,
            notes: 'Processador principal',
          },
          {
            componentId: memoria!.id,
            quantity: 2,
            unitId: unitPC!.id,
            scrapFactor: 0.01,
            sequence: 20,
            notes: 'Módulos de memória',
          },
          {
            componentId: parafuso!.id,
            quantity: 4,
            unitId: unitPC!.id,
            scrapFactor: 0.05,
            sequence: 30,
            notes: 'Fixação dos componentes',
          },
        ],
      },
    },
  });

  // BOM para SA-003 (Carcaça Plástica)
  const bomCarcaca = await prisma.bOM.create({
    data: {
      productId: carcaca!.id,
      version: 1,
      description: 'BOM da Carcaça Plástica',
      active: true,
      items: {
        create: [
          {
            componentId: resina!.id,
            quantity: 0.2,
            unitId: unitKG!.id,
            scrapFactor: 0.1,
            sequence: 10,
            notes: 'Matéria-prima para injeção',
          },
          {
            componentId: tinta!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.05,
            sequence: 20,
            notes: 'Acabamento superficial',
          },
        ],
      },
    },
  });

  // BOM para PA-001 (Smartphone XPro)
  const bomSmartphone = await prisma.bOM.create({
    data: {
      productId: smartphone!.id,
      version: 1,
      description: 'BOM do Smartphone XPro',
      active: true,
      items: {
        create: [
          {
            componentId: placaMae!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 10,
            notes: 'Placa principal montada',
          },
          {
            componentId: display!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.02,
            sequence: 20,
            notes: 'Display touch screen',
          },
          {
            componentId: carcaca!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 30,
            notes: 'Carcaça externa',
          },
          {
            componentId: bateria!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 40,
            notes: 'Bateria recarregável',
          },
          {
            componentId: cabo!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 50,
            notes: 'Cabo de carregamento',
          },
          {
            componentId: parafuso!.id,
            quantity: 8,
            unitId: unitPC!.id,
            scrapFactor: 0.1,
            sequence: 60,
            notes: 'Fixação da carcaça',
          },
          {
            componentId: caixa!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.02,
            sequence: 70,
            notes: 'Embalagem do produto',
          },
          {
            componentId: manual!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 80,
            notes: 'Manual de instruções',
          },
        ],
      },
    },
  });

  // BOM para PA-002 (Notebook Ultra)
  const bomNotebook = await prisma.bOM.create({
    data: {
      productId: notebook!.id,
      version: 1,
      description: 'BOM do Notebook Ultra',
      active: true,
      items: {
        create: [
          {
            componentId: placaMae!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 10,
            notes: 'Placa mãe principal',
          },
          {
            componentId: display!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.02,
            sequence: 20,
            notes: 'Display LCD 15.6"',
          },
          {
            componentId: memoria!.id,
            quantity: 2,
            unitId: unitPC!.id,
            scrapFactor: 0.01,
            sequence: 30,
            notes: 'Memória RAM adicional',
          },
          {
            componentId: bateria!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 40,
            notes: 'Bateria de longa duração',
          },
          {
            componentId: cabo!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 50,
            notes: 'Cabo de alimentação',
          },
          {
            componentId: parafuso!.id,
            quantity: 16,
            unitId: unitPC!.id,
            scrapFactor: 0.1,
            sequence: 60,
            notes: 'Fixação do gabinete',
          },
          {
            componentId: caixa!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.02,
            sequence: 70,
            notes: 'Embalagem do produto',
          },
          {
            componentId: manual!.id,
            quantity: 1,
            unitId: unitUN!.id,
            scrapFactor: 0.01,
            sequence: 80,
            notes: 'Manual de instruções',
          },
        ],
      },
    },
  });

    console.log('✅ 4 BOMs criadas:');
    console.log('   - SA-001 (Placa Mãe Montada)');
    console.log('   - SA-003 (Carcaça Plástica)');
    console.log('   - PA-001 (Smartphone XPro)');
    console.log('   - PA-002 (Notebook Ultra)');
  }

  // Criar centros de trabalho
  console.log('🏭 Criando centros de trabalho...');
  
  const workCenters = [
    {
      code: 'CT-001',
      name: 'Linha de Montagem 1',
      description: 'Linha principal de montagem de produtos eletrônicos',
      type: 'assembly',
      capacity: 100,
      efficiency: 0.95,
      costPerHour: 150.00,
      active: true,
    },
    {
      code: 'CT-002',
      name: 'Linha de Montagem 2',
      description: 'Linha secundária de montagem',
      type: 'assembly',
      capacity: 80,
      efficiency: 0.90,
      costPerHour: 120.00,
      active: true,
    },
    {
      code: 'CT-003',
      name: 'Injeção de Plásticos',
      description: 'Máquinas injetoras de plástico',
      type: 'manufacturing',
      capacity: 50,
      efficiency: 0.85,
      costPerHour: 200.00,
      active: true,
    },
    {
      code: 'CT-004',
      name: 'Pintura e Acabamento',
      description: 'Cabine de pintura e acabamento superficial',
      type: 'finishing',
      capacity: 60,
      efficiency: 0.88,
      costPerHour: 100.00,
      active: true,
    },
    {
      code: 'CT-005',
      name: 'Controle de Qualidade',
      description: 'Inspeção e testes de qualidade',
      type: 'quality',
      capacity: 120,
      efficiency: 1.0,
      costPerHour: 80.00,
      active: true,
    },
    {
      code: 'CT-006',
      name: 'Embalagem',
      description: 'Setor de embalagem final',
      type: 'packaging',
      capacity: 150,
      efficiency: 0.98,
      costPerHour: 60.00,
      active: true,
    },
  ];

  for (const wc of workCenters) {
    await prisma.workCenter.upsert({
      where: { code: wc.code },
      update: {},
      create: wc,
    });
  }

  console.log(`✅ ${workCenters.length} centros de trabalho criados`);

  // Criar fornecedores
  console.log('🚚 Criando fornecedores...');
  
  const suppliers = [
    {
      code: 'FOR-001',
      name: 'TechComponents Ltda',
      legalName: 'TechComponents Componentes Eletrônicos Ltda',
      document: '12.345.678/0001-90',
      email: 'vendas@techcomponents.com.br',
      phone: '(11) 3456-7890',
      address: 'Rua dos Componentes, 123',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-567',
      country: 'BR',
      paymentTerms: '30/60 dias',
      leadTime: 15,
      rating: 4.5,
      active: true,
    },
    {
      code: 'FOR-002',
      name: 'PlastiPro Indústria',
      legalName: 'PlastiPro Indústria de Plásticos S.A.',
      document: '23.456.789/0001-01',
      email: 'comercial@plastipro.com.br',
      phone: '(11) 2345-6789',
      address: 'Av. Industrial, 456',
      city: 'Guarulhos',
      state: 'SP',
      zipCode: '07012-345',
      country: 'BR',
      paymentTerms: '45 dias',
      leadTime: 20,
      rating: 4.2,
      active: true,
    },
    {
      code: 'FOR-003',
      name: 'EmbalaFácil',
      legalName: 'EmbalaFácil Embalagens ME',
      document: '34.567.890/0001-12',
      email: 'atendimento@embalafacil.com.br',
      phone: '(11) 4567-8901',
      address: 'Rua das Caixas, 789',
      city: 'Osasco',
      state: 'SP',
      zipCode: '06234-567',
      country: 'BR',
      paymentTerms: '30 dias',
      leadTime: 7,
      rating: 4.8,
      active: true,
    },
  ];

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { code: supplier.code },
      update: {},
      create: supplier,
    });
  }

  console.log(`✅ ${suppliers.length} fornecedores criados`);

  // Criar clientes
  console.log('👥 Criando clientes...');
  
  const customers = [
    {
      code: 'CLI-001',
      name: 'TechStore Varejo',
      legalName: 'TechStore Comércio de Eletrônicos Ltda',
      document: '45.678.901/0001-23',
      email: 'compras@techstore.com.br',
      phone: '(11) 5678-9012',
      address: 'Av. Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01310-100',
      country: 'BR',
      paymentTerms: '30/60/90 dias',
      creditLimit: 500000.00,
      active: true,
    },
    {
      code: 'CLI-002',
      name: 'MegaEletro Distribuidora',
      legalName: 'MegaEletro Distribuidora de Eletrônicos S.A.',
      document: '56.789.012/0001-34',
      email: 'pedidos@megaeletro.com.br',
      phone: '(21) 6789-0123',
      address: 'Rua do Comércio, 500',
      city: 'Rio de Janeiro',
      state: 'RJ',
      zipCode: '20040-020',
      country: 'BR',
      paymentTerms: '45/60 dias',
      creditLimit: 1000000.00,
      active: true,
    },
    {
      code: 'CLI-003',
      name: 'InfoShop Online',
      legalName: 'InfoShop Comércio Eletrônico Ltda',
      document: '67.890.123/0001-45',
      email: 'fornecedores@infoshop.com.br',
      phone: '(11) 7890-1234',
      address: 'Rua Virtual, 100',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '04567-890',
      country: 'BR',
      paymentTerms: '30 dias',
      creditLimit: 300000.00,
      active: true,
    },
  ];

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { code: customer.code },
      update: {},
      create: customer,
    });
  }

  console.log(`✅ ${customers.length} clientes criados`);

  // Criar usuários adicionais
  console.log('👤 Criando usuários adicionais...');
  
  const managerRole = await prisma.role.findUnique({ where: { code: 'MANAGER' } });
  const operatorRole = await prisma.role.findUnique({ where: { code: 'OPERATOR' } });
  
  const hashedPasswordManager = await bcrypt.hash('manager123', 10);
  const hashedPasswordOperator = await bcrypt.hash('operator123', 10);
  
  const manager = await prisma.user.upsert({
    where: { email: 'gerente@fabric.com' },
    update: {},
    create: {
      name: 'João Gerente',
      email: 'gerente@fabric.com',
      password: hashedPasswordManager,
      roles: {
        create: {
          roleId: managerRole!.id,
        },
      },
    },
  });

  const operator1 = await prisma.user.upsert({
    where: { email: 'operador1@fabric.com' },
    update: {},
    create: {
      name: 'Maria Operadora',
      email: 'operador1@fabric.com',
      password: hashedPasswordOperator,
      roles: {
        create: {
          roleId: operatorRole!.id,
        },
      },
    },
  });

  const operator2 = await prisma.user.upsert({
    where: { email: 'operador2@fabric.com' },
    update: {},
    create: {
      name: 'Pedro Operador',
      email: 'operador2@fabric.com',
      password: hashedPasswordOperator,
      roles: {
        create: {
          roleId: operatorRole!.id,
        },
      },
    },
  });

  console.log('✅ 3 usuários adicionais criados:');
  console.log('   - gerente@fabric.com / manager123');
  console.log('   - operador1@fabric.com / operator123');
  console.log('   - operador2@fabric.com / operator123');

  // Criar roteiros de produção
  console.log('🔧 Criando roteiros de produção...');

  // Buscar produtos e centros de trabalho
  const smartphone = await prisma.product.findUnique({ where: { code: 'PA-001' } });
  const notebook = await prisma.product.findUnique({ where: { code: 'PA-002' } });
  const placaMae = await prisma.product.findUnique({ where: { code: 'SA-001' } });
  const carcaca = await prisma.product.findUnique({ where: { code: 'SA-003' } });

  const ct001 = await prisma.workCenter.findUnique({ where: { code: 'CT-001' } });
  const ct002 = await prisma.workCenter.findUnique({ where: { code: 'CT-002' } });
  const ct003 = await prisma.workCenter.findUnique({ where: { code: 'CT-003' } });
  const ct004 = await prisma.workCenter.findUnique({ where: { code: 'CT-004' } });
  const ct005 = await prisma.workCenter.findUnique({ where: { code: 'CT-005' } });
  const ct006 = await prisma.workCenter.findUnique({ where: { code: 'CT-006' } });

  // Verificar se roteiros já existem
  const existingRoutings = await prisma.routing.count();
  if (existingRoutings > 0) {
    console.log('⚠️  Roteiros já existem, pulando criação...');
  } else {
    // Roteiro para SA-001 (Placa Mãe Montada)
    await prisma.routing.create({
      data: {
        productId: placaMae!.id,
        version: 1,
        description: 'Processo de montagem da placa mãe',
        active: true,
        operations: {
          create: [
            {
              sequence: 10,
              workCenterId: ct001!.id,
              description: 'Montagem de componentes na placa',
              setupTime: 15,
              runTime: 8,
              queueTime: 5,
              moveTime: 2,
              notes: 'Inserir processador e memórias',
            },
            {
              sequence: 20,
              workCenterId: ct005!.id,
              description: 'Teste de funcionamento',
              setupTime: 5,
              runTime: 3,
              queueTime: 2,
              moveTime: 1,
              notes: 'Verificar POST e funcionamento básico',
            },
          ],
        },
      },
    });

    // Roteiro para SA-003 (Carcaça Plástica)
    await prisma.routing.create({
      data: {
        productId: carcaca!.id,
        version: 1,
        description: 'Processo de fabricação da carcaça',
        active: true,
        operations: {
          create: [
            {
              sequence: 10,
              workCenterId: ct003!.id,
              description: 'Injeção do plástico',
              setupTime: 30,
              runTime: 5,
              queueTime: 10,
              moveTime: 2,
              notes: 'Temperatura: 200°C',
            },
            {
              sequence: 20,
              workCenterId: ct004!.id,
              description: 'Pintura e acabamento',
              setupTime: 20,
              runTime: 10,
              queueTime: 15,
              moveTime: 3,
              notes: 'Aplicar 2 camadas de tinta',
            },
            {
              sequence: 30,
              workCenterId: ct005!.id,
              description: 'Inspeção de qualidade',
              setupTime: 5,
              runTime: 2,
              queueTime: 2,
              moveTime: 1,
              notes: 'Verificar acabamento e dimensões',
            },
          ],
        },
      },
    });

    // Roteiro para PA-001 (Smartphone XPro)
    await prisma.routing.create({
      data: {
        productId: smartphone!.id,
        version: 1,
        description: 'Linha de montagem completa do smartphone',
        active: true,
        operations: {
          create: [
            {
              sequence: 10,
              workCenterId: ct001!.id,
              description: 'Montagem da estrutura principal',
              setupTime: 20,
              runTime: 15,
              queueTime: 5,
              moveTime: 2,
              notes: 'Fixar placa mãe na carcaça',
            },
            {
              sequence: 20,
              workCenterId: ct001!.id,
              description: 'Instalação de display e bateria',
              setupTime: 10,
              runTime: 12,
              queueTime: 3,
              moveTime: 1,
              notes: 'Conectar flat cables',
            },
            {
              sequence: 30,
              workCenterId: ct002!.id,
              description: 'Fechamento e fixação',
              setupTime: 5,
              runTime: 8,
              queueTime: 2,
              moveTime: 1,
              notes: 'Aparafusar e selar',
            },
            {
              sequence: 40,
              workCenterId: ct005!.id,
              description: 'Teste funcional completo',
              setupTime: 10,
              runTime: 10,
              queueTime: 5,
              moveTime: 2,
              notes: 'Testar todas as funções',
            },
            {
              sequence: 50,
              workCenterId: ct006!.id,
              description: 'Embalagem final',
              setupTime: 5,
              runTime: 5,
              queueTime: 2,
              moveTime: 1,
              notes: 'Embalar com acessórios',
            },
          ],
        },
      },
    });

    // Roteiro para PA-002 (Notebook Ultra)
    await prisma.routing.create({
      data: {
        productId: notebook!.id,
        version: 1,
        description: 'Linha de montagem completa do notebook',
        active: true,
        operations: {
          create: [
            {
              sequence: 10,
              workCenterId: ct001!.id,
              description: 'Montagem da base e placa mãe',
              setupTime: 25,
              runTime: 20,
              queueTime: 5,
              moveTime: 2,
              notes: 'Fixar placa e componentes na base',
            },
            {
              sequence: 20,
              workCenterId: ct001!.id,
              description: 'Instalação de memórias e bateria',
              setupTime: 10,
              runTime: 10,
              queueTime: 3,
              moveTime: 1,
              notes: 'Instalar módulos RAM adicionais',
            },
            {
              sequence: 30,
              workCenterId: ct002!.id,
              description: 'Montagem do display',
              setupTime: 15,
              runTime: 15,
              queueTime: 5,
              moveTime: 2,
              notes: 'Conectar e fixar tela LCD',
            },
            {
              sequence: 40,
              workCenterId: ct002!.id,
              description: 'Montagem do teclado e touchpad',
              setupTime: 10,
              runTime: 12,
              queueTime: 3,
              moveTime: 1,
              notes: 'Conectar flat cables',
            },
            {
              sequence: 50,
              workCenterId: ct005!.id,
              description: 'Teste funcional e burn-in',
              setupTime: 15,
              runTime: 30,
              queueTime: 10,
              moveTime: 2,
              notes: 'Teste completo de 30 minutos',
            },
            {
              sequence: 60,
              workCenterId: ct006!.id,
              description: 'Embalagem e etiquetagem',
              setupTime: 5,
              runTime: 8,
              queueTime: 2,
              moveTime: 1,
              notes: 'Embalar com acessórios e manual',
            },
          ],
        },
      },
    });

    console.log('✅ 4 roteiros criados:');
    console.log('   - SA-001 (Placa Mãe) - 2 operações');
    console.log('   - SA-003 (Carcaça) - 3 operações');
    console.log('   - PA-001 (Smartphone) - 5 operações');
    console.log('   - PA-002 (Notebook) - 6 operações');
  }

  // Criar ordens de produção
  console.log('📋 Criando ordens de produção...');

  // Verificar se ordens já existem
  const existingOrders = await prisma.productionOrder.count();
  if (existingOrders > 0) {
    console.log('⚠️  Ordens de produção já existem, pulando criação...');
  } else {
    const smartphone = await prisma.product.findUnique({ where: { code: 'PA-001' } });
    const notebook = await prisma.product.findUnique({ where: { code: 'PA-002' } });
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@fabric.com' } });

    // Ordem 1: Smartphone - Planejada
    const order1 = await prisma.productionOrder.create({
      data: {
        orderNumber: 'OP-2025-001',
        productId: smartphone!.id,
        quantity: 50,
        producedQty: 0,
        scrapQty: 0,
        priority: 7,
        status: 'PLANNED',
        scheduledStart: new Date('2025-01-15T08:00:00'),
        scheduledEnd: new Date('2025-01-20T18:00:00'),
        notes: 'Ordem para atender pedido da TechStore',
        createdBy: adminUser!.id,
      },
    });

    // Calcular operações para ordem 1
    const routing1 = await prisma.routing.findFirst({
      where: { productId: smartphone!.id, active: true },
      include: { operations: true },
    });

    if (routing1) {
      for (const op of routing1.operations) {
        await prisma.productionOrderOperation.create({
          data: {
            productionOrderId: order1.id,
            sequence: op.sequence,
            workCenterId: op.workCenterId,
            description: op.description,
            plannedQty: order1.quantity,
            setupTime: op.setupTime,
            runTime: op.runTime,
            totalPlannedTime: op.setupTime + (op.runTime * order1.quantity),
            status: 'PENDING',
          },
        });
      }
    }

    // Ordem 2: Notebook - Liberada
    const order2 = await prisma.productionOrder.create({
      data: {
        orderNumber: 'OP-2025-002',
        productId: notebook!.id,
        quantity: 20,
        producedQty: 0,
        scrapQty: 0,
        priority: 5,
        status: 'RELEASED',
        scheduledStart: new Date('2025-01-10T08:00:00'),
        scheduledEnd: new Date('2025-01-18T18:00:00'),
        notes: 'Ordem para MegaEletro Distribuidora',
        createdBy: adminUser!.id,
      },
    });

    // Calcular operações para ordem 2
    const routing2 = await prisma.routing.findFirst({
      where: { productId: notebook!.id, active: true },
      include: { operations: true },
    });

    if (routing2) {
      for (const op of routing2.operations) {
        await prisma.productionOrderOperation.create({
          data: {
            productionOrderId: order2.id,
            sequence: op.sequence,
            workCenterId: op.workCenterId,
            description: op.description,
            plannedQty: order2.quantity,
            setupTime: op.setupTime,
            runTime: op.runTime,
            totalPlannedTime: op.setupTime + (op.runTime * order2.quantity),
            status: 'PENDING',
          },
        });
      }
    }

    // Ordem 3: Smartphone - Em Progresso
    const order3 = await prisma.productionOrder.create({
      data: {
        orderNumber: 'OP-2025-003',
        productId: smartphone!.id,
        quantity: 100,
        producedQty: 45,
        scrapQty: 3,
        priority: 10,
        status: 'IN_PROGRESS',
        scheduledStart: new Date('2025-01-05T08:00:00'),
        scheduledEnd: new Date('2025-01-12T18:00:00'),
        actualStart: new Date('2025-01-05T08:15:00'),
        notes: 'Ordem urgente - Cliente InfoShop',
        createdBy: adminUser!.id,
      },
    });

    // Calcular operações para ordem 3
    if (routing1) {
      for (const op of routing1.operations) {
        await prisma.productionOrderOperation.create({
          data: {
            productionOrderId: order3.id,
            sequence: op.sequence,
            workCenterId: op.workCenterId,
            description: op.description,
            plannedQty: order3.quantity,
            completedQty: op.sequence <= 30 ? order3.quantity : 45,
            setupTime: op.setupTime,
            runTime: op.runTime,
            totalPlannedTime: op.setupTime + (op.runTime * order3.quantity),
            actualTime: op.sequence <= 30 ? op.setupTime + (op.runTime * order3.quantity) : 0,
            status: op.sequence <= 30 ? 'COMPLETED' : op.sequence === 40 ? 'IN_PROGRESS' : 'PENDING',
          },
        });
      }
    }

    // Ordem 4: Notebook - Concluída
    const order4 = await prisma.productionOrder.create({
      data: {
        orderNumber: 'OP-2024-099',
        productId: notebook!.id,
        quantity: 30,
        producedQty: 30,
        scrapQty: 2,
        priority: 5,
        status: 'COMPLETED',
        scheduledStart: new Date('2024-12-20T08:00:00'),
        scheduledEnd: new Date('2024-12-28T18:00:00'),
        actualStart: new Date('2024-12-20T08:00:00'),
        actualEnd: new Date('2024-12-27T16:30:00'),
        notes: 'Ordem concluída com sucesso',
        createdBy: adminUser!.id,
      },
    });

    // Calcular operações para ordem 4
    if (routing2) {
      for (const op of routing2.operations) {
        await prisma.productionOrderOperation.create({
          data: {
            productionOrderId: order4.id,
            sequence: op.sequence,
            workCenterId: op.workCenterId,
            description: op.description,
            plannedQty: order4.quantity,
            completedQty: order4.quantity,
            setupTime: op.setupTime,
            runTime: op.runTime,
            totalPlannedTime: op.setupTime + (op.runTime * order4.quantity),
            actualTime: op.setupTime + (op.runTime * order4.quantity) * 1.05,
            status: 'COMPLETED',
          },
        });
      }
    }

    // Ordem 5: Smartphone - Cancelada
    await prisma.productionOrder.create({
      data: {
        orderNumber: 'OP-2024-095',
        productId: smartphone!.id,
        quantity: 25,
        producedQty: 0,
        scrapQty: 0,
        priority: 3,
        status: 'CANCELLED',
        scheduledStart: new Date('2024-12-15T08:00:00'),
        scheduledEnd: new Date('2024-12-20T18:00:00'),
        notes: 'Ordem cancelada - Cliente cancelou pedido',
        createdBy: adminUser!.id,
      },
    });

    console.log('✅ 5 ordens de produção criadas:');
    console.log('   - OP-2025-001: 50 Smartphones (Planejada)');
    console.log('   - OP-2025-002: 20 Notebooks (Liberada)');
    console.log('   - OP-2025-003: 100 Smartphones (Em Progresso - 45%)');
    console.log('   - OP-2024-099: 30 Notebooks (Concluída)');
    console.log('   - OP-2024-095: 25 Smartphones (Cancelada)');
  }

  console.log('\n🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
