import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addCountingPermissions() {
  console.log('🔐 Adicionando permissões de Contagem de Estoque...\n');

  const countingPermissions = [
    { 
      resource: 'counting', 
      action: 'create', 
      description: 'Criar planos de contagem' 
    },
    { 
      resource: 'counting', 
      action: 'read', 
      description: 'Visualizar contagens' 
    },
    { 
      resource: 'counting', 
      action: 'update', 
      description: 'Editar contagens' 
    },
    { 
      resource: 'counting', 
      action: 'delete', 
      description: 'Excluir contagens' 
    },
    { 
      resource: 'counting', 
      action: 'execute', 
      description: 'Executar contagem' 
    },
  ];

  const created = [];
  const skipped = [];

  for (const perm of countingPermissions) {
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

addCountingPermissions()
  .catch((error) => {
    console.error('❌ Erro ao adicionar permissões:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
