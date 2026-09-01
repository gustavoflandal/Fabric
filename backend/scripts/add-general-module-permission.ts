import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addGeneralModulePermission() {
  console.log('🔐 Adicionando permissão para módulo Geral...\n');

  const permissionData = {
    resource: 'modules',
    action: 'view_general',
    description: 'Visualizar módulos Gerais'
  };

  // Criar ou buscar permissão
  let permission = await prisma.permission.findFirst({
    where: {
      resource: permissionData.resource,
      action: permissionData.action,
    },
  });

  if (!permission) {
    permission = await prisma.permission.create({
      data: permissionData,
    });
    console.log(`✅ Permissão criada: ${permissionData.resource}.${permissionData.action}`);
  } else {
    console.log(`⏭️  Permissão já existe: ${permissionData.resource}.${permissionData.action}`);
  }

  // Buscar todos os perfis para atribuir a permissão
  const roles = await prisma.role.findMany();
  
  console.log(`\n👤 Atribuindo permissão a todos os perfis...\n`);
  
  let assignedCount = 0;
  for (const role of roles) {
    const existingAssignment = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
    });

    if (!existingAssignment) {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
      console.log(`   ✅ Atribuída ao perfil: ${role.name} (${role.code})`);
      assignedCount++;
    } else {
      console.log(`   ⏭️  Já atribuída ao perfil: ${role.name} (${role.code})`);
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   Permissão criada: ${permission ? 'Sim' : 'Já existia'}`);
  console.log(`   Perfis atualizados: ${assignedCount}/${roles.length}`);
  console.log('\n✨ Processo concluído!');
}

addGeneralModulePermission()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
