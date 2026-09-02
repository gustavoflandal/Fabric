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
}

export default new PermissionService();
