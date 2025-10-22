import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addCountingPrintPermission() {
  try {
    console.log('🚀 Adicionando permissão de impressão de formulário de contagem...\n');

    // Criar/atualizar a permissão
    const permission = await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: 'counting.plans',
          action: 'print',
        },
      },
      update: {},
      create: {
        resource: 'counting.plans',
        action: 'print',
        description: 'Imprimir formulário de plano de contagem em PDF',
      },
    });

    console.log('✅ Permissão criada/atualizada:');
    console.log(`   ID: ${permission.id}`);
    console.log(`   Resource: ${permission.resource}`);
    console.log(`   Action: ${permission.action}`);
    console.log(`   Description: ${permission.description}\n`);

    // Buscar todos os roles
    const roles = await prisma.role.findMany();
    console.log(`📋 Atribuindo permissão para ${roles.length} roles...\n`);

    let assignedCount = 0;

    for (const role of roles) {
      // Verificar se já existe
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
      });

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
        console.log(`   ✅ Atribuída ao role: ${role.name}`);
        assignedCount++;
      } else {
        console.log(`   ⏭️  Role ${role.name} já possui a permissão`);
      }
    }

    console.log(`\n✅ Permissão atribuída a ${assignedCount} role(s)`);
    console.log('✅ Processo concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao adicionar permissão:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addCountingPrintPermission();
