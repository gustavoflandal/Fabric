import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { AppError } from './error.middleware';
import { prisma } from '../config/database';

export const requirePermission = (resource: string, action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new AppError(401, 'Usuário não autenticado');
      }

      // Buscar usuário com seus perfis e permissões
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        throw new AppError(401, 'Usuário não encontrado');
      }

      // Verificar se o usuário tem a permissão necessária
      const hasPermission = user.roles.some((userRole) =>
        userRole.role.permissions.some(
          (rolePermission) =>
            rolePermission.permission.resource === resource &&
            rolePermission.permission.action === action
        )
      );

      if (!hasPermission) {
        throw new AppError(
          403,
          `Permissão negada: ${resource}:${action} necessária`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
