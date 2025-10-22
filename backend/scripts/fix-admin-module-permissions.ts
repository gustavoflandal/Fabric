import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAdminModulePermissions() {
  console.log('🔍 Verificando permissões do módulo para ADMIN...\n');

  // Buscar perfil ADMIN
  const adminRole = await prisma.role.findFirst({
    where: { code: 'ADMIN' },
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  });

  if (!adminRole) {
    console.error('❌ Perfil ADMIN não encontrado!');
    return;
  }

  console.log(`📋 Perfil: ${adminRole.name} (${adminRole.code})`);
  console.log(`📊 Permissões atuais: ${adminRole.permissions.length}\n`);

  // Permissões de módulos necessárias
  const modulePermissions = [
    { resource: 'modules', action: 'view_pcp', description: 'Visualizar módulos PCP' },
    { resource: 'modules', action: 'view_wms', description: 'Visualizar módulos WMS' },
    { resource: 'modules', action: 'view_yms', description: 'Visualizar módulos YMS' },
  ];

  let created = 0;
  let assigned = 0;

  for (const permData of modulePermissions) {
    // Criar ou buscar permissão
    let permission = await prisma.permission.findFirst({
      where: {
        resource: permData.resource,
        action: permData.action,
      },
    });

    if (!permission) {
      permission = await prisma.permission.create({
        data: permData,
      });
      console.log(`✅ Permissão criada: ${permData.resource}.${permData.action}`);
      created++;
    } else {
      console.log(`⏭️  Permissão já existe: ${permData.resource}.${permData.action}`);
    }

    // Verificar se já está atribuída ao ADMIN
    const existingAssignment = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
    });

    if (!existingAssignment) {
      await prisma.rolePermission.create({
        data: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      });
      console.log(`   ✅ Atribuída ao ADMIN`);
      assigned++;
    } else {
      console.log(`   ⏭️  Já atribuída ao ADMIN`);
    }
  }

  console.log('\n📊 Resumo:');
  console.log(`   Permissões criadas: ${created}`);
  console.log(`   Permissões atribuídas ao ADMIN: ${assigned}`);

  // Listar todas as permissões de módulos do ADMIN
  console.log('\n🔐 Permissões de módulos do ADMIN:');
  const updatedAdmin = await prisma.role.findUnique({
    where: { id: adminRole.id },
    include: {
      permissions: {
        include: {
          permission: true
        },
        where: {
          permission: {
            resource: 'modules'
          }
        }
      }
    }
  });

  updatedAdmin?.permissions.forEach(rp => {
    console.log(`   ✓ ${rp.permission.resource}.${rp.permission.action} - ${rp.permission.description}`);
  });

  console.log('\n✨ Processo concluído!');
}

fixAdminModulePermissions()
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
