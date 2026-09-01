const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Adicionando permissões de contagem...\n');

  // Buscar role ADMIN
  const adminRole = await prisma.role.findFirst({
    where: { code: 'ADMIN' }
  });

  if (!adminRole) {
    console.log('❌ Role ADMIN não encontrada!');
    return;
  }

  console.log(`✅ Role ADMIN encontrada: ${adminRole.id}`);

  // Permissões de contagem
  const countingPermissions = [
    { resource: 'counting_plans', action: 'create', description: 'Criar planos de contagem' },
    { resource: 'counting_plans', action: 'read', description: 'Visualizar planos de contagem' },
    { resource: 'counting_plans', action: 'update', description: 'Atualizar planos de contagem' },
    { resource: 'counting_plans', action: 'delete', description: 'Deletar planos de contagem' },
    { resource: 'counting_sessions', action: 'create', description: 'Criar sessões de contagem' },
    { resource: 'counting_sessions', action: 'read', description: 'Visualizar sessões de contagem' },
    { resource: 'counting_sessions', action: 'update', description: 'Atualizar sessões de contagem' },
    { resource: 'counting_sessions', action: 'execute', description: 'Executar contagem' },
    { resource: 'counting_items', action: 'create', description: 'Criar itens de contagem' },
    { resource: 'counting_items', action: 'read', description: 'Visualizar itens de contagem' },
    { resource: 'counting_items', action: 'update', description: 'Atualizar itens de contagem' },
  ];

  console.log('\n📋 Criando permissões...');
  
  for (const perm of countingPermissions) {
    const permission = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action
        }
      },
      update: {},
      create: {
        resource: perm.resource,
        action: perm.action,
        description: perm.description
      }
    });

    // Associar permissão ao role ADMIN
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id
        }
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id
      }
    });

    console.log(`✅ ${perm.resource}:${perm.action}`);
  }

  console.log('\n✅ Permissões adicionadas com sucesso!');
  
  // Verificar permissões do admin
  const adminPermissions = await prisma.rolePermission.findMany({
    where: { roleId: adminRole.id },
    include: { permission: true }
  });

  console.log(`\n📊 Total de permissões do ADMIN: ${adminPermissions.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
