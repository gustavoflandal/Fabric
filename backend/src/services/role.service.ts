import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

export interface CreateRoleDto {
  code: string;
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleDto {
  code?: string;
  name?: string;
  description?: string;
  active?: boolean;
}

export class RoleService {
  async getAll() {
    const roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: {
              select: {
                id: true,
                resource: true,
                action: true,
                description: true,
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
      usersCount: role._count.users,
    }));
  }

  async getById(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        users: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new AppError(404, 'Perfil não encontrado');
    }

    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
      users: role.users.map((ur) => ur.user),
    };
  }

  async create(data: CreateRoleDto) {
    // Verificar se código já existe
    const existingRole = await prisma.role.findUnique({
      where: { code: data.code },
    });

    if (existingRole) {
      throw new AppError(409, 'Código de perfil já cadastrado');
    }

    // Criar perfil
    const role = await prisma.role.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        permissions: data.permissionIds
          ? {
              create: data.permissionIds.map((permissionId) => ({
                permissionId,
              })),
            }
          : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };
  }

  async update(id: string, data: UpdateRoleDto) {
    // Verificar se perfil existe
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      throw new AppError(404, 'Perfil não encontrado');
    }

    // Se estiver alterando código, verificar se já existe
    if (data.code && data.code !== existingRole.code) {
      const codeExists = await prisma.role.findUnique({
        where: { code: data.code },
      });

      if (codeExists) {
        throw new AppError(409, 'Código de perfil já cadastrado');
      }
    }

    // Atualizar perfil
    const role = await prisma.role.update({
      where: { id },
      data,
    });

    return role;
  }

  async delete(id: string) {
    // Verificar se perfil existe
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      throw new AppError(404, 'Perfil não encontrado');
    }

    // Verificar se há usuários com este perfil
    if (role._count.users > 0) {
      throw new AppError(
        400,
        `Não é possível excluir. Existem ${role._count.users} usuário(s) com este perfil`
      );
    }

    // Deletar perfil
    await prisma.role.delete({
      where: { id },
    });

    return { message: 'Perfil excluído com sucesso' };
  }

  async assignPermissions(roleId: string, permissionIds: string[]) {
    // Verificar se perfil existe
    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new AppError(404, 'Perfil não encontrado');
    }

    // Remover permissões antigas
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Adicionar novas permissões
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
    });

    return { message: 'Permissões atribuídas com sucesso' };
  }
}

export default new RoleService();
