import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAdminPermissions() {
  try {
    console.log('🔧 Verificando e corrigindo permissões do admin...\n');

    // 1. Verificar se o perfil ADMIN existe
    const adminRole = await prisma.role.findUnique({
      where: { code: 'ADMIN' },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!adminRole) {
      console.error('❌ Perfil ADMIN não encontrado!');
      process.exit(1);
    }

    console.log(`✅ Perfil ADMIN encontrado (ID: ${adminRole.id})`);
    console.log(`   Permissões atuais: ${adminRole.permissions.length}`);

    // 2. Buscar todas as permissões
    const allPermissions = await prisma.permission.findMany();
    console.log(`\n📋 Total de permissões no sistema: ${allPermissions.length}`);

    // 3. Verificar permissões de compras
    const purchasePermissions = allPermissions.filter(
      (p) => p.resource === 'orcamentos_compra' || p.resource === 'pedidos_compra'
    );
    
    console.log(`\n📦 Permissões de compras encontradas: ${purchasePermissions.length}`);
    purchasePermissions.forEach((p) => {
      console.log(`   - ${p.resource}:${p.action}`);
    });

    // 4. Verificar quais permissões o admin NÃO tem
    const adminPermissionIds = new Set(
      adminRole.permissions.map((rp) => rp.permission.id)
    );
    
    const missingPermissions = allPermissions.filter(
      (p) => !adminPermissionIds.has(p.id)
    );

    if (missingPermissions.length > 0) {
      console.log(`\n⚠️  Admin está faltando ${missingPermissions.length} permissões:`);
      missingPermissions.forEach((p) => {
        console.log(`   - ${p.resource}:${p.action} (${p.description})`);
      });

      // 5. Adicionar permissões faltantes
      console.log('\n🔧 Adicionando permissões faltantes...');
      
      await prisma.rolePermission.createMany({
        data: missingPermissions.map((p) => ({
          roleId: adminRole.id,
          permissionId: p.id,
        })),
        skipDuplicates: true,
      });

      console.log('✅ Permissões adicionadas com sucesso!');
    } else {
      console.log('\n✅ Admin já possui todas as permissões!');
    }

    // 6. Verificar usuário admin
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@fabric.com' },
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

    if (!adminUser) {
      console.error('\n❌ Usuário admin@fabric.com não encontrado!');
      process.exit(1);
    }

    console.log(`\n👤 Usuário admin encontrado (ID: ${adminUser.id})`);
    console.log(`   Perfis associados: ${adminUser.roles.length}`);
    
    adminUser.roles.forEach((ur) => {
      console.log(`   - ${ur.role.name} (${ur.role.permissions.length} permissões)`);
    });

    // Verificar se tem o perfil ADMIN
    const hasAdminRole = adminUser.roles.some((ur) => ur.role.code === 'ADMIN');
    
    if (!hasAdminRole) {
      console.log('\n⚠️  Usuário admin não está associado ao perfil ADMIN!');
      console.log('🔧 Associando perfil ADMIN ao usuário...');
      
      await prisma.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      });
      
      console.log('✅ Perfil ADMIN associado com sucesso!');
    }

    // 7. Listar permissões finais de compras do admin
    const finalAdminRole = await prisma.role.findUnique({
      where: { code: 'ADMIN' },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    const purchasePerms = finalAdminRole!.permissions.filter(
      (rp) =>
        rp.permission.resource === 'orcamentos_compra' ||
        rp.permission.resource === 'pedidos_compra'
    );

    console.log(`\n✅ Permissões finais de compras do ADMIN: ${purchasePerms.length}`);
    purchasePerms.forEach((rp) => {
      console.log(`   ✓ ${rp.permission.resource}:${rp.permission.action}`);
    });

    console.log('\n🎉 Correção concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao corrigir permissões:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminPermissions();
