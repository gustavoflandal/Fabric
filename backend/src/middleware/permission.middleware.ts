// backend/src/middleware/permission.middleware.ts
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { AppError } from './error.middleware';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { config } from '../config/env';

/**
 * Busca o usuário com toda a árvore de perfis/permissões. Extraído de
 * `requirePermission` (Fase 2 do assistente de IA) para ser reaproveitado por
 * `assistant.controller.ts::hasStockReadPermission` — sem essa extração, a
 * mesma query apareceria duplicada nos dois arquivos.
 */
export async function getUserWithPermissions(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
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
}

type UserWithPermissions = NonNullable<Awaited<ReturnType<typeof getUserWithPermissions>>>;

/** Checagem pura (sem I/O) sobre o resultado de `getUserWithPermissions`. */
export function userHasPermission(user: UserWithPermissions, resource: string, action: string): boolean {
  return user.roles.some((userRole) =>
    userRole.role.permissions.some(
      (rolePermission) =>
        rolePermission.permission.resource === resource && rolePermission.permission.action === action
    )
  );
}

export const requirePermission = (resource: string, action: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new AppError(401, 'Usuário não autenticado');
      }

      const user = await getUserWithPermissions(req.userId);

      if (!user) {
        throw new AppError(401, 'Usuário não encontrado');
      }

      const hasPermission = userHasPermission(user, resource, action);

      if (config.nodeEnv === 'development') {
        const userPermissions = user.roles.flatMap((ur) =>
          ur.role.permissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`)
        );
        logger.debug(`Permissão requerida: ${resource}:${action}`);
        logger.debug(`Usuário ${user.email} tem ${userPermissions.length} permissões`);
        logger.debug(`Tem permissão: ${hasPermission ? 'SIM' : 'NÃO'}`);

        if (!hasPermission) {
          const relevantPerms = user.roles.flatMap((ur) =>
            ur.role.permissions
              .filter((rp) => rp.permission.resource === resource)
              .map((rp) => rp.permission.action)
          );
          logger.debug(`Permissões de '${resource}': ${relevantPerms.join(', ') || 'nenhuma'}`);
        }
      }

      if (!hasPermission) {
        throw new AppError(403, `Permissão negada: ${resource}:${action} necessária`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
