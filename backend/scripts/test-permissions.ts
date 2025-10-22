import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPermissions() {
  const userId = '0532eebc-637c-445f-ae8e-ab39d64937cd'; // ID do admin

  console.log('🔍 Testando busca de permissões exatamente como o middleware faz...\n');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    console.error('❌ Usuário não encontrado!');
    return;
  }

  console.log(`👤 Usuário: ${user.email}`);
  console.log(`   Perfis: ${user.roles.length}\n`);

  user.roles.forEach((userRole) => {
    console.log(`📋 Perfil: ${userRole.role.name} (${userRole.role.code})`);
    console.log(`   Permissões: ${userRole.role.permissions.length}`);
    
    const purchasePerms = userRole.role.permissions.filter(
      (rp) =>
        rp.permission.resource === 'orcamentos_compra' ||
        rp.permission.resource === 'pedidos_compra'
    );
    
    console.log(`   Permissões de compras: ${purchasePerms.length}`);
    purchasePerms.forEach((rp) => {
      console.log(`      ✓ ${rp.permission.resource}:${rp.permission.action}`);
    });
  });

  // Testar verificação de permissão específica
  console.log('\n🧪 Testando verificação de permissão...');
  
  const resource = 'orcamentos_compra';
  const action = 'visualizar';
  
  const hasPermission = user.roles.some((userRole) =>
    userRole.role.permissions.some(
      (rolePermission) =>
        rolePermission.permission.resource === resource &&
        rolePermission.permission.action === action
    )
  );

  console.log(`   Verificando: ${resource}:${action}`);
  console.log(`   Resultado: ${hasPermission ? '✅ TEM PERMISSÃO' : '❌ NÃO TEM PERMISSÃO'}`);

  // Testar outra permissão
  const resource2 = 'pedidos_compra';
  const action2 = 'visualizar';
  
  const hasPermission2 = user.roles.some((userRole) =>
    userRole.role.permissions.some(
      (rolePermission) =>
        rolePermission.permission.resource === resource2 &&
        rolePermission.permission.action === action2
    )
  );

  console.log(`   Verificando: ${resource2}:${action2}`);
  console.log(`   Resultado: ${hasPermission2 ? '✅ TEM PERMISSÃO' : '❌ NÃO TEM PERMISSÃO'}`);

  await prisma.$disconnect();
}

testPermissions().catch(console.error);
