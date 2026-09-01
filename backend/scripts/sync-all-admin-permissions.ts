import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Atualizando permissões do ADMIN para incluir TODOS os módulos...');

  const adminRole = await prisma.role.findUnique({
    where: { code: 'ADMIN' },
  });

  if (!adminRole) {
    throw new Error('Role ADMIN não encontrada');
  }

  // Buscar TODAS as permissões existentes
  const allPermissions = await prisma.permission.findMany();

  console.log(`📋 Total de permissões no sistema: ${allPermissions.length}`);

  let updated = 0;
  let alreadyExists = 0;

  for (const permission of allPermissions) {
    const exists = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
    });

    if (!exists) {
      await prisma.rolePermission.create({
        data: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      });
      console.log(`✅ Permissão atribuída: ${permission.resource} - ${permission.action}`);
      updated++;
    } else {
      alreadyExists++;
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`   - Permissões novas atribuídas: ${updated}`);
  console.log(`   - Permissões já existentes: ${alreadyExists}`);
  console.log(`   - Total de permissões do ADMIN: ${allPermissions.length}`);
  console.log('\n✨ ADMIN agora tem TODAS as permissões do sistema!');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao atualizar permissões:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
