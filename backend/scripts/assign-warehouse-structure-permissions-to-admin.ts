import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('👮‍♂️ Atribuindo permissões de estrutura de armazém ao admin...');

  const adminRole = await prisma.role.findUnique({
    where: { code: 'ADMIN' },
  });

  if (!adminRole) {
    throw new Error('Role ADMIN não encontrada');
  }

  const permissions = await prisma.permission.findMany({
    where: { resource: 'warehouse_structures' },
  });

  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
    console.log(`✅ Permissão atribuída: ${permission.resource} - ${permission.action}`);
  }

  console.log('✨ Permissões atribuídas ao admin com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao atribuir permissões:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });