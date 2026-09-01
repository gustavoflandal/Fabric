import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserPermissions() {
  console.log('🔍 Verificando permissões do usuário admin...\n');

  // Buscar usuário admin
  const user = await prisma.user.findFirst({
    where: { email: 'admin@fabric.com' },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    console.error('❌ Usuário admin não encontrado!');
    return;
  }

  console.log(`👤 Usuário: ${user.name} (${user.email})`);
  console.log(`📋 Roles: ${user.roles.length}\n`);

  // Extrair todas as permissões
  const allPermissions: string[] = [];
  for (const userRole of user.roles) {
    console.log(`\n🔐 Role: ${userRole.role.name} (${userRole.role.code})`);
    console.log(`   Permissões: ${userRole.role.permissions.length}`);
    
    for (const rolePerm of userRole.role.permissions) {
      const permKey = `${rolePerm.permission.resource}.${rolePerm.permission.action}`;
      if (!allPermissions.includes(permKey)) {
        allPermissions.push(permKey);
      }
    }
  }

  console.log(`\n📊 Total de permissões únicas: ${allPermissions.length}`);
  
  // Filtrar permissões de módulos
  const modulePermissions = allPermissions.filter(p => p.startsWith('modules.'));
  console.log(`\n📋 Permissões de módulos (${modulePermissions.length}):`);
  modulePermissions.forEach(p => console.log(`   ✓ ${p}`));

  await prisma.$disconnect();
}

checkUserPermissions()
  .then(() => {
    console.log('\n✨ Verificação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro:', error);
    process.exit(1);
  });
