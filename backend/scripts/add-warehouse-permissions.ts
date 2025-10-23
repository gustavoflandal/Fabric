import { prisma } from '../src/config/database';

async function addWarehousePermissions() {
  console.log('🔧 Adicionando permissões para o módulo de Armazéns...');

  const permissions = [
    { resource: 'warehouses', action: 'view', description: 'Visualizar armazéns' },
    { resource: 'warehouses', action: 'create', description: 'Criar armazéns' },
    { resource: 'warehouses', action: 'update', description: 'Editar armazéns' },
    { resource: 'warehouses', action: 'delete', description: 'Excluir armazéns' },
  ];

  for (const perm of permissions) {
    const existing = await prisma.permission.findFirst({
      where: { resource: perm.resource, action: perm.action },
    });

    if (!existing) {
      await prisma.permission.create({ data: perm });
      console.log(`✅ Permissão criada: ${perm.resource}.${perm.action}`);
    } else {
      console.log(`⚠️ Permissão já existe: ${perm.resource}.${perm.action}`);
    }
  }

  console.log('✨ Permissões adicionadas com sucesso!');
}

addWarehousePermissions()
  .catch((error) => {
    console.error('❌ Erro ao adicionar permissões:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });