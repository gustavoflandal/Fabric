import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar permissões padrão
  console.log('📝 Criando permissões...');
  const permissions = [
    // Usuários
    { resource: 'users', action: 'create', description: 'Criar usuários' },
    { resource: 'users', action: 'read', description: 'Visualizar usuários' },
    { resource: 'users', action: 'update', description: 'Editar usuários' },
    { resource: 'users', action: 'delete', description: 'Excluir usuários' },
    
    // Perfis
    { resource: 'roles', action: 'create', description: 'Criar perfis' },
    { resource: 'roles', action: 'read', description: 'Visualizar perfis' },
    { resource: 'roles', action: 'update', description: 'Editar perfis' },
    { resource: 'roles', action: 'delete', description: 'Excluir perfis' },
    
    // Produtos
    { resource: 'products', action: 'create', description: 'Criar produtos' },
    { resource: 'products', action: 'read', description: 'Visualizar produtos' },
    { resource: 'products', action: 'update', description: 'Editar produtos' },
    { resource: 'products', action: 'delete', description: 'Excluir produtos' },
    
    // Ordens de Produção
    { resource: 'production_orders', action: 'create', description: 'Criar ordens de produção' },
    { resource: 'production_orders', action: 'read', description: 'Visualizar ordens de produção' },
    { resource: 'production_orders', action: 'update', description: 'Editar ordens de produção' },
    { resource: 'production_orders', action: 'delete', description: 'Excluir ordens de produção' },
    
    // Estoque
    { resource: 'stock', action: 'read', description: 'Visualizar estoque' },
    { resource: 'stock', action: 'update', description: 'Movimentar estoque' },
    
    // Relatórios
    { resource: 'reports', action: 'read', description: 'Visualizar relatórios' },
    { resource: 'reports', action: 'export', description: 'Exportar relatórios' },
    
    // Logs de Auditoria
    { resource: 'audit_logs', action: 'read', description: 'Visualizar logs de auditoria' },
    { resource: 'audit_logs', action: 'delete', description: 'Excluir logs de auditoria' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: {
        resource_action: {
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: {},
      create: perm,
    });
  }

  console.log(`✅ ${permissions.length} permissões criadas`);

  // Criar perfis
  console.log('👥 Criando perfis...');
  
  const allPermissions = await prisma.permission.findMany();
  
  // Criar ou atualizar perfil ADMIN
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {
      name: 'Administrador',
      description: 'Acesso total ao sistema',
    },
    create: {
      code: 'ADMIN',
      name: 'Administrador',
      description: 'Acesso total ao sistema',
    },
  });

  // Remover permissões antigas e adicionar todas as novas
  await prisma.rolePermission.deleteMany({
    where: { roleId: adminRole.id },
  });

  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({
      roleId: adminRole.id,
      permissionId: p.id,
    })),
  });

  await prisma.role.upsert({
    where: { code: 'MANAGER' },
    update: {},
    create: {
      code: 'MANAGER',
      name: 'Gerente',
      description: 'Gerente de produção com acesso a relatórios',
    },
  });

  await prisma.role.upsert({
    where: { code: 'OPERATOR' },
    update: {},
    create: {
      code: 'OPERATOR',
      name: 'Operador',
      description: 'Operador de produção',
    },
  });

  console.log('✅ Perfis criados: ADMIN, MANAGER, OPERATOR');

  // Criar usuário administrador
  console.log('🔑 Criando usuário administrador...');
  
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { email: 'admin@fabric.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@fabric.com',
      password: hashedPassword,
      roles: {
        create: {
          roleId: adminRole.id,
        },
      },
    },
  });

  console.log('✅ Usuário administrador criado');
  console.log('   Email: admin@fabric.com');
  console.log('   Senha: admin123');

  console.log('\n🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
