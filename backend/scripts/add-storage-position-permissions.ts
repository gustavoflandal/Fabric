import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addStoragePositionPermissions() {
  try {
    console.log('🔧 Adicionando permissões de posições de armazenagem...\n');

    // Buscar o perfil admin
    const adminRole = await prisma.role.findUnique({
      where: { code: 'ADMIN' }
    });

    if (!adminRole) {
      console.error('❌ Perfil ADMIN não encontrado');
      return;
    }

    console.log(`✅ Perfil ADMIN encontrado: ${adminRole.name}\n`);

    // Definir as novas permissões
    const newPermissions = [
      {
        resource: 'warehouse_structures',
        action: 'create',
        description: 'Criar estruturas de armazém'
      },
      {
        resource: 'warehouse_structures',
        action: 'read',
        description: 'Visualizar estruturas de armazém'
      },
      {
        resource: 'warehouse_structures',
        action: 'update',
        description: 'Editar estruturas de armazém'
      },
      {
        resource: 'warehouse_structures',
        action: 'delete',
        description: 'Excluir estruturas de armazém'
      },
      {
        resource: 'warehouse_structures',
        action: 'gerar_posicoes',
        description: 'Gerar posições de armazenagem'
      },
      {
        resource: 'warehouse_structures',
        action: 'excluir_posicoes',
        description: 'Excluir posições de armazenagem'
      }
    ];

    let addedCount = 0;
    let existingCount = 0;

    for (const permData of newPermissions) {
      // Criar ou buscar a permissão
      const permission = await prisma.permission.upsert({
        where: {
          resource_action: {
            resource: permData.resource,
            action: permData.action
          }
        },
        update: {
          description: permData.description
        },
        create: permData
      });

      // Verificar se o admin já tem essa permissão
      const existingRolePermission = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: permission.id
          }
        }
      });

      if (!existingRolePermission) {
        await prisma.rolePermission.create({
          data: {
            roleId: adminRole.id,
            permissionId: permission.id
          }
        });
        console.log(`✅ Adicionada: ${permData.resource}:${permData.action} - ${permData.description}`);
        addedCount++;
      } else {
        console.log(`ℹ️  Já existe: ${permData.resource}:${permData.action}`);
        existingCount++;
      }
    }

    console.log(`\n📊 Resumo:`);
    console.log(`   ${addedCount} permissões adicionadas`);
    console.log(`   ${existingCount} permissões já existentes`);
    console.log(`\n✅ Processo concluído com sucesso!`);

  } catch (error) {
    console.error('❌ Erro ao adicionar permissões:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addStoragePositionPermissions();
