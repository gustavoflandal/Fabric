import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔒 Criando permissões para estrutura de armazém...');

  const permissions = [
    { resource: 'warehouse_structures', action: 'view', description: 'Visualizar estruturas de armazém' },
    { resource: 'warehouse_structures', action: 'create', description: 'Criar estruturas de armazém' },
    { resource: 'warehouse_structures', action: 'update', description: 'Atualizar estruturas de armazém' },
    { resource: 'warehouse_structures', action: 'delete', description: 'Excluir estruturas de armazém' },
  ];

  for (const permission of permissions) {
    const created = await prisma.permission.upsert({
      where: { resource_action: { resource: permission.resource, action: permission.action } },
      update: permission,
      create: permission,
    });
    console.log(`✅ Permissão criada: ${created.resource} - ${created.action}`);
  }

  console.log('✨ Permissões criadas com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao criar permissões:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });