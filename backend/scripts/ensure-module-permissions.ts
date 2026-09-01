import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureModulePermissions() {
  console.log('🔐 Garantindo permissões de módulos do sistema...\n');

  // Todas as permissões de módulos necessárias
  const modulePermissions = [
    { 
      resource: 'modules', 
      action: 'view_general', 
      description: 'Visualizar módulo Geral (Administração)' 
    },
    { 
      resource: 'modules', 
      action: 'view_pcp', 
      description: 'Visualizar módulo PCP (Planejamento e Controle da Produção)' 
    },
    { 
      resource: 'modules', 
      action: 'view_wms', 
      description: 'Visualizar módulo WMS (Warehouse Management System)' 
    },
    { 
      resource: 'modules', 
      action: 'view_yms', 
      description: 'Visualizar módulo YMS (Yard Management System)' 
    },
  ];

  const created = [];
  const updated = [];
  const skipped = [];

  // Passo 1: Criar ou atualizar permissões
  console.log('📋 Passo 1: Verificando permissões...\n');
  
  for (const permData of modulePermissions) {
    const existing = await prisma.permission.findFirst({
      where: {
        resource: permData.resource,
        action: permData.action,
      },
    });

    if (existing) {
      // Atualizar descrição se necessário
      if (existing.description !== permData.description) {
        await prisma.permission.update({
          where: { id: existing.id },
          data: { description: permData.description },
        });
        console.log(`🔄 Permissão atualizada: ${permData.resource}.${permData.action}`);
        updated.push(existing);
      } else {
        console.log(`✅ Permissão já existe: ${permData.resource}.${permData.action}`);
        skipped.push(existing);
      }
    } else {
      const permission = await prisma.permission.create({
        data: permData,
      });
      console.log(`🆕 Permissão criada: ${permData.resource}.${permData.action}`);
      created.push(permission);
    }
  }

  console.log('\n📊 Resumo Passo 1:');
  console.log(`   ✨ Criadas: ${created.length}`);
  console.log(`   🔄 Atualizadas: ${updated.length}`);
  console.log(`   ⏭️  Já existentes: ${skipped.length}`);

  // Passo 2: Garantir que ADMIN tenha todas as permissões
  console.log('\n👤 Passo 2: Atribuindo permissões ao perfil ADMIN...\n');
  
  const adminRole = await prisma.role.findFirst({
    where: { code: 'ADMIN' }
  });

  if (!adminRole) {
    console.error('❌ ERRO: Perfil ADMIN não encontrado!');
    console.log('💡 Execute o seed do banco de dados primeiro: npm run db:seed');
    return;
  }

  // Buscar TODAS as permissões de módulos (incluindo as que já existiam)
  const allModulePermissions = await prisma.permission.findMany({
    where: {
      resource: 'modules',
      action: {
        in: ['view_general', 'view_pcp', 'view_wms', 'view_yms']
      }
    }
  });

  let assignedCount = 0;
  let alreadyAssignedCount = 0;

  for (const perm of allModulePermissions) {
    const existingAssignment = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
    });

    if (!existingAssignment) {
      await prisma.rolePermission.create({
        data: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      });
      console.log(`   ✅ Atribuída: ${perm.resource}.${perm.action}`);
      assignedCount++;
    } else {
      console.log(`   ⏭️  Já atribuída: ${perm.resource}.${perm.action}`);
      alreadyAssignedCount++;
    }
  }

  console.log('\n📊 Resumo Passo 2:');
  console.log(`   ✨ Atribuídas: ${assignedCount}`);
  console.log(`   ⏭️  Já atribuídas: ${alreadyAssignedCount}`);
  console.log(`   📋 Total: ${allModulePermissions.length}/4 permissões de módulos`);

  // Passo 3: Verificar usuários ADMIN
  console.log('\n👥 Passo 3: Verificando usuários com perfil ADMIN...\n');

  const adminUsers = await prisma.user.findMany({
    where: {
      roles: {
        some: {
          roleId: adminRole.id
        }
      }
    },
    select: {
      id: true,
      name: true,
      email: true,
    }
  });

  console.log(`   Encontrados ${adminUsers.length} usuário(s) ADMIN:`);
  adminUsers.forEach(user => {
    console.log(`   👤 ${user.name} (${user.email})`);
  });

  // Resumo Final
  console.log('\n' + '='.repeat(60));
  console.log('✨ PROCESSO CONCLUÍDO COM SUCESSO!');
  console.log('='.repeat(60));
  console.log('\n📋 Todas as 4 permissões de módulos estão garantidas:');
  console.log('   ✅ modules.view_general - Módulo Geral');
  console.log('   ✅ modules.view_pcp - Módulo PCP');
  console.log('   ✅ modules.view_wms - Módulo WMS');
  console.log('   ✅ modules.view_yms - Módulo YMS');
  console.log('\n👑 Perfil ADMIN tem acesso a todos os módulos');
  console.log(`📊 ${adminUsers.length} usuário(s) afetado(s)\n`);
  
  if (adminUsers.length === 0) {
    console.log('⚠️  ATENÇÃO: Nenhum usuário com perfil ADMIN encontrado!');
    console.log('💡 Você precisa criar um usuário e atribuir o perfil ADMIN.\n');
  }
}

ensureModulePermissions()
  .catch((error) => {
    console.error('\n❌ ERRO ao garantir permissões:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
