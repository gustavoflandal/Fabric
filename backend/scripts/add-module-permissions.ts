import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addModulePermissions() {
  console.log('🔐 Adicionando permissões de visualização de módulos...\n');

  const modulePermissions = [
    { 
      resource: 'modules', 
      action: 'view_pcp', 
      description: 'Visualizar módulos PCP (Planejamento e Controle da Produção)' 
    },
    { 
      resource: 'modules', 
      action: 'view_wms', 
      description: 'Visualizar módulos WMS (Warehouse Management System)' 
    },
    { 
      resource: 'modules', 
      action: 'view_yms', 
      description: 'Visualizar módulos YMS (Yard Management System)' 
    },
  ];

  const created = [];
  const skipped = [];

  for (const perm of modulePermissions) {
    const existing = await prisma.permission.findFirst({
      where: {
        resource: perm.resource,
        action: perm.action,
      },
    });

    if (existing) {
      console.log(`⏭️  Permissão já existe: ${perm.resource}.${perm.action}`);
      skipped.push(perm);
    } else {
      const permission = await prisma.permission.create({
        data: perm,
      });
      console.log(`✅ Permissão criada: ${perm.resource}.${perm.action}`);
      created.push(permission);
    }
  }

  console.log('\n📊 Resumo:');
  console.log(`   Criadas: ${created.length}`);
  console.log(`   Ignoradas (já existentes): ${skipped.length}`);

  // Adicionar automaticamente ao perfil de administrador
  console.log('\n👤 Atribuindo permissões ao perfil Administrador...');
  
  const adminRole = await prisma.role.findFirst({
    where: { code: 'ADMIN' }
  });

  if (adminRole) {
    let assignedCount = 0;
    for (const perm of created) {
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
        assignedCount++;
      }
    }
    console.log(`✅ ${assignedCount} permissões atribuídas ao perfil ADMIN`);
  } else {
    console.log('⚠️  Perfil ADMIN não encontrado');
  }

  console.log('\n✨ Processo concluído!');
}

addModulePermissions()
  .catch((error) => {
    console.error('❌ Erro ao adicionar permissões:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
