import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addWarehousePermissions() {
  try {
    console.log('🔧 Adicionando permissões de armazéns...\n');

    // Buscar o perfil admin
    const adminRole = await prisma.role.findUnique({
      where: { code: 'ADMIN' }
    });

    if (!adminRole) {
      console.error('❌ Perfil ADMIN não encontrado');
      return;
    }

    console.log(`✅ Perfil ADMIN encontrado: ${adminRole.name}\n`);

    // Definir todas as permissões de armazéns
    const allPermissions = [
      // Armazéns
      {
        resource: 'armazens',
        action: 'criar',
        description: 'Criar armazéns'
      },
      {
        resource: 'armazens',
        action: 'visualizar',
        description: 'Visualizar armazéns'
      },
      {
        resource: 'armazens',
        action: 'editar',
        description: 'Editar armazéns'
      },
      {
        resource: 'armazens',
        action: 'excluir',
        description: 'Excluir armazéns'
      },
      // Estruturas de Armazém
      {
        resource: 'estruturas_armazem',
        action: 'criar',
        description: 'Criar estruturas de armazém'
      },
      {
        resource: 'estruturas_armazem',
        action: 'visualizar',
        description: 'Visualizar estruturas de armazém'
      },
      {
        resource: 'estruturas_armazem',
        action: 'editar',
        description: 'Editar estruturas de armazém'
      },
      {
        resource: 'estruturas_armazem',
        action: 'excluir',
        description: 'Excluir estruturas de armazém'
      },
      {
        resource: 'estruturas_armazem',
        action: 'gerar_posicoes',
        description: 'Gerar posições de armazenagem'
      },
      {
        resource: 'estruturas_armazem',
        action: 'excluir_posicoes',
        description: 'Excluir posições de armazenagem'
      }
    ];

    let addedCount = 0;
    let existingCount = 0;

    for (const permData of allPermissions) {
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

addWarehousePermissions();
