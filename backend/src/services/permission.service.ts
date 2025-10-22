import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreatePermissionDto {
  resource: string;
  action: string;
  description?: string;
}

export class PermissionService {
  async getAll() {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });

    // Agrupar por recurso
    const grouped = permissions.reduce((acc, permission) => {
      if (!acc[permission.resource]) {
        acc[permission.resource] = [];
      }
      acc[permission.resource].push(permission);
      return acc;
    }, {} as Record<string, typeof permissions>);

    return {
      all: permissions,
      grouped,
    };
  }

  async getById(id: string) {
    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new AppError(404, 'Permissão não encontrada');
    }

    return permission;
  }

  async create(data: CreatePermissionDto) {
    // Verificar se já existe
    const existing = await prisma.permission.findFirst({
      where: {
        resource: data.resource,
        action: data.action,
      },
    });

    if (existing) {
      throw new AppError(409, 'Permissão já cadastrada');
    }

    // Criar permissão
    const permission = await prisma.permission.create({
      data,
    });

    return permission;
  }

  async delete(id: string) {
    // Verificar se permissão existe
    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new AppError(404, 'Permissão não encontrada');
    }

    // Deletar permissão
    await prisma.permission.delete({
      where: { id },
    });

    return { message: 'Permissão excluída com sucesso' };
  }

  async seedDefaultPermissions() {
    const defaultPermissions = [
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
      
      // Abas do Sistema - Módulos
      { resource: 'modules', action: 'view_general', description: 'Visualizar módulos Gerais' },
      { resource: 'modules', action: 'view_pcp', description: 'Visualizar módulos PCP' },
      { resource: 'modules', action: 'view_wms', description: 'Visualizar módulos WMS' },
      { resource: 'modules', action: 'view_yms', description: 'Visualizar módulos YMS' },
      
      // PCP - Dashboard
      { resource: 'pcp.dashboard', action: 'view', description: 'Visualizar Dashboard do PCP' },
      
      // WMS - Contagem de Estoque
      { resource: 'counting', action: 'create', description: 'Criar planos de contagem' },
      { resource: 'counting', action: 'read', description: 'Visualizar contagens' },
      { resource: 'counting', action: 'update', description: 'Editar contagens' },
      { resource: 'counting', action: 'delete', description: 'Excluir contagens' },
      { resource: 'counting', action: 'execute', description: 'Executar contagem' },
      { resource: 'counting.plans', action: 'print', description: 'Imprimir formulário de plano de contagem em PDF' },
    ];

    const created = [];
    for (const perm of defaultPermissions) {
      const existing = await prisma.permission.findFirst({
        where: {
          resource: perm.resource,
          action: perm.action,
        },
      });

      if (!existing) {
        const permission = await prisma.permission.create({
          data: perm,
        });
        created.push(permission);
      }
    }

    return {
      message: `${created.length} permissões criadas`,
      created,
    };
  }
}

export default new PermissionService();
