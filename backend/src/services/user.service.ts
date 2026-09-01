import { prisma } from '../config/database';
import { PasswordUtil } from '../utils/password.util';
import { AppError } from '../middleware/error.middleware';

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  roleIds?: string[];
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  active?: boolean;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export class UserService {
  async getAll(page = 1, limit = 50, search?: string) {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          lastLogin: true,
          createdAt: true,
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => ({
        ...user,
        roles: user.roles.map((ur) => ur.role),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          include: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'Usuário não encontrado');
    }

    return {
      ...user,
      roles: user.roles.map((ur) => ur.role),
    };
  }

  async create(data: CreateUserDto) {
    // Verificar se email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(409, 'E-mail já cadastrado');
    }

    // Hash da senha
    const hashedPassword = await PasswordUtil.hash(data.password);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        roles: data.roleIds
          ? {
              create: data.roleIds.map((roleId) => ({
                roleId,
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        createdAt: true,
      },
    });

    return user;
  }

  async update(id: string, data: UpdateUserDto) {
    // Verificar se usuário existe
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new AppError(404, 'Usuário não encontrado');
    }

    // Se estiver alterando email, verificar se já existe
    if (data.email && data.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailExists) {
        throw new AppError(409, 'E-mail já cadastrado');
      }
    }

    // Atualizar usuário
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        updatedAt: true,
      },
    });

    return user;
  }

  async delete(id: string) {
    // Verificar se usuário existe
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new AppError(404, 'Usuário não encontrado');
    }

    // Deletar usuário (cascade vai deletar roles)
    await prisma.user.delete({
      where: { id },
    });

    return { message: 'Usuário excluído com sucesso' };
  }

  async changePassword(userId: string, data: ChangePasswordDto) {
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'Usuário não encontrado');
    }

    // Verificar senha atual
    const isPasswordValid = await PasswordUtil.compare(
      data.currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      throw new AppError(401, 'Senha atual incorreta');
    }

    // Hash da nova senha
    const hashedPassword = await PasswordUtil.hash(data.newPassword);

    // Atualizar senha
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Senha alterada com sucesso' };
  }

  async assignRoles(userId: string, roleIds: string[]) {
    // Verificar se usuário existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError(404, 'Usuário não encontrado');
    }

    // Remover roles antigas
    await prisma.userRole.deleteMany({
      where: { userId },
    });

    // Adicionar novas roles
    await prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId,
        roleId,
      })),
    });

    return { message: 'Perfis atribuídos com sucesso' };
  }
}

export default new UserService();
