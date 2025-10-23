import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPermissions() {
  try {
    console.log('🔍 Verificando permissões de warehouse_structures...\n');

    const perms = await prisma.permission.findMany({
      where: { resource: 'warehouse_structures' },
      orderBy: { action: 'asc' }
    });

    console.log('Permissões encontradas:');
    perms.forEach(p => {
      console.log(`  - ${p.resource}:${p.action} - ${p.description}`);
    });

    console.log('\n🔍 Verificando se ADMIN tem essas permissões...\n');

    const adminRole = await prisma.role.findUnique({
      where: { code: 'ADMIN' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    const warehouseStructurePerms = adminRole?.permissions.filter(
      rp => rp.permission.resource === 'warehouse_structures'
    );

    console.log('Permissões do ADMIN para warehouse_structures:');
    warehouseStructurePerms?.forEach(rp => {
      console.log(`  ✅ ${rp.permission.resource}:${rp.permission.action} - ${rp.permission.description}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPermissions();
