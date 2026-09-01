import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando permissões de contagem do administrador...\n');

  // Buscar usuário admin
  const admin = await prisma.user.findUnique({
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

  if (!admin) {
    console.log('❌ Usuário admin não encontrado!');
    return;
  }

  console.log(`✅ Usuário encontrado: ${admin.email}\n`);

  // Verificar permissões de contagem
  const countingPermissions = [
    'planos_contagem:criar',
    'planos_contagem:visualizar',
    'planos_contagem:editar',
    'planos_contagem:excluir',
    'planos_contagem:ativar',
    'planos_contagem:pausar',
    'sessoes_contagem:visualizar',
    'sessoes_contagem:criar',
    'sessoes_contagem:iniciar',
    'sessoes_contagem:completar',
    'sessoes_contagem:cancelar',
    'contagem:executar',
    'contagem:recontar',
    'contagem:aprovar_divergencia',
    'relatorios_contagem:visualizar',
    'relatorios_contagem:exportar',
    'stock:adjustment',
  ];

  const allPermissions = admin.roles.flatMap((userRole) =>
    userRole.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`)
  );

  console.log(`📋 Total de permissões do admin: ${allPermissions.length}\n`);

  console.log('🔍 Verificando permissões de contagem:\n');

  let missingCount = 0;
  for (const perm of countingPermissions) {
    const has = allPermissions.includes(perm);
    if (has) {
      console.log(`  ✅ ${perm}`);
    } else {
      console.log(`  ❌ ${perm} - FALTANDO!`);
      missingCount++;
    }
  }

  console.log(`\n📊 Resultado:`);
  console.log(`   ✅ Permissões presentes: ${countingPermissions.length - missingCount}`);
  console.log(`   ❌ Permissões faltando: ${missingCount}`);

  if (missingCount > 0) {
    console.log('\n⚠️  O usuário admin não tem todas as permissões de contagem!');
    console.log('💡 Execute o script fix-admin-permissions.ts para corrigir.');
  } else {
    console.log('\n🎉 Todas as permissões de contagem estão configuradas!');
  }

  // Verificar se as permissões existem no banco
  console.log('\n🔍 Verificando se as permissões existem no banco...\n');

  for (const perm of countingPermissions) {
    const [resource, action] = perm.split(':');
    const exists = await prisma.permission.findFirst({
      where: { resource, action },
    });

    if (!exists) {
      console.log(`  ❌ Permissão ${perm} não existe no banco!`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
