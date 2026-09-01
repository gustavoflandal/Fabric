import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addPCPDashboardPermission() {
  try {
    console.log('🔧 Criando permissão para Dashboard PCP...');

    // Criar permissão
    const permission = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: 'pcp.dashboard',
          action: 'view'
        }
      },
      update: {},
      create: {
        resource: 'pcp.dashboard',
        action: 'view',
        description: 'Visualizar Dashboard do PCP'
      }
    });

    console.log('✅ Permissão criada:', permission);

    // Buscar todos os perfis
    const roles = await prisma.role.findMany({
      select: { id: true, code: true, name: true }
    });

    console.log(`\n📋 Atribuindo permissão aos perfis...`);

    let assigned = 0;
    for (const role of roles) {
      // Verificar se já existe
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        }
      });

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id
          }
        });
        console.log(`  ✅ ${role.name} (${role.code})`);
        assigned++;
      } else {
        console.log(`  ⏭️  ${role.name} (${role.code}) - já possui`);
      }
    }

    console.log(`\n✅ Permissão atribuída a ${assigned} perfis`);
    console.log('✅ Script concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao criar permissão:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addPCPDashboardPermission();
