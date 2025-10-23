import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Adicionando permissão de atualização de posições...\n');

  // 1. Criar a permissão de atualização
  const permission = await prisma.permission.upsert({
    where: {
      resource_action: {
        resource: 'storage_positions',
        action: 'update'
      }
    },
    create: {
      resource: 'storage_positions',
      action: 'update',
      description: 'Atualizar posição de armazenagem (bloquear/desbloquear)'
    },
    update: {
      description: 'Atualizar posição de armazenagem (bloquear/desbloquear)'
    }
  });
  console.log('✅ Permissão storage_positions:update criada/atualizada');

  // 2. Buscar o papel ADMIN
  const adminRole = await prisma.role.findFirst({
    where: { code: 'ADMIN' }
  });

  if (!adminRole) {
    throw new Error('Papel ADMIN não encontrado');
  }

  // 3. Associar a permissão ao papel ADMIN
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: permission.id
      }
    },
    create: {
      roleId: adminRole.id,
      permissionId: permission.id
    },
    update: {}
  });
  console.log('✅ Permissão associada ao papel ADMIN');

  console.log('\n✅ Processo concluído!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
