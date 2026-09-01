import { prisma } from '../src/config/database';

async function assignWarehousePermissionsToAdmin() {
  console.log('🔧 Atribuindo permissões de Armazéns ao perfil ADMIN...');

  const adminRole = await prisma.role.findFirst({ where: { code: 'ADMIN' } });
  if (!adminRole) {
    console.error('❌ Perfil ADMIN não encontrado!');
    return;
  }

  const permissions = await prisma.permission.findMany({
    where: { resource: 'warehouses' },
  });

  for (const permission of permissions) {
    const existing = await prisma.rolePermission.findFirst({
      where: { roleId: adminRole.id, permissionId: permission.id },
    });

    if (!existing) {
      await prisma.rolePermission.create({
        data: { roleId: adminRole.id, permissionId: permission.id },
      });
      console.log(`✅ Permissão atribuída: ${permission.resource}.${permission.action}`);
    } else {
      console.log(`⚠️ Permissão já atribuída: ${permission.resource}.${permission.action}`);
    }
  }

  console.log('✨ Permissões atribuídas com sucesso!');
}

assignWarehousePermissionsToAdmin()
  .catch((error) => {
    console.error('❌ Erro ao atribuir permissões:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });