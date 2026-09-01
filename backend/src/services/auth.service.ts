import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { PasswordUtil } from '../utils/password.util';
import { JwtUtil } from '../utils/jwt.util';
import { AppError } from '../middleware/error.middleware';

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(data: RegisterDto): Promise<AuthResponse> {
    // Verificar se usuário já existe
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
      },
    });

    // Gerar tokens
    const payload = { userId: user.id, email: user.email, name: user.name };
    const accessToken = JwtUtil.generateAccessToken(payload);
    const refresh = JwtUtil.generateRefreshToken(payload);
    await prisma.refreshToken.create({
      data: { userId: user.id, jti: refresh.jti, expiresAt: refresh.expiresAt },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
      refreshToken: refresh.token,
    };
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new AppError(401, 'Credenciais inválidas');
    }

    // Verificar senha (com proteção para dados legados/corrompidos)
    let isPasswordValid = false;
    try {
      isPasswordValid = await PasswordUtil.compare(data.password, user.password);
    } catch (error) {
      logger.warn('Falha ao validar hash de senha no login', {
        userId: user.id,
        email: user.email,
      });
      throw new AppError(401, 'Credenciais inválidas');
    }

    if (!isPasswordValid) {
      throw new AppError(401, 'Credenciais inválidas');
    }

    // Verificar se usuário está ativo
    if (!user.active) {
      throw new AppError(403, 'Usuário inativo');
    }

    // Atualizar último login (não deve bloquear autenticação)
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      });
    } catch (error) {
      logger.warn('Não foi possível atualizar lastLogin', {
        userId: user.id,
        email: user.email,
      });
    }

    // Gerar tokens
    const payload = { userId: user.id, email: user.email, name: user.name };
    const accessToken = JwtUtil.generateAccessToken(payload);
    const refresh = JwtUtil.generateRefreshToken(payload);
    await prisma.refreshToken.create({
      data: { userId: user.id, jti: refresh.jti, expiresAt: refresh.expiresAt },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
      refreshToken: refresh.token,
    };
  }

  /**
   * ✅ Fase 2 item 2.3 do cronograma: além de checar a assinatura/expiração
   * do JWT, agora confirma que o `jti` existe em RefreshToken, pertence a
   * esse usuário e não foi revogado - sem isso, um refresh token roubado
   * continuava valido mesmo depois de um logout, pelos 7 dias inteiros
   * (o JWT sozinho não sabia nada sobre revogação).
   *
   * Rotação: o token usado é revogado e um novo par access+refresh é
   * emitido a cada chamada - um refresh token só pode ser usado uma vez.
   * Se o mesmo `jti` for apresentado de novo (já revogado), é sinal de que
   * o token vazou e está sendo reusado; a chamada é rejeitada.
   */
  async refreshToken(token: string): Promise<RefreshResponse> {
    try {
      // Verificar refresh token (assinatura e expiração)
      const payload = JwtUtil.verifyRefreshToken(token);

      const stored = await prisma.refreshToken.findUnique({ where: { jti: payload.jti } });

      if (!stored || stored.userId !== payload.userId || stored.revokedAt || stored.expiresAt < new Date()) {
        throw new AppError(401, 'Token inválido');
      }

      // Verificar se usuário ainda existe e está ativo
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.active) {
        throw new AppError(401, 'Token inválido');
      }

      // Rotação: revoga o token usado e emite um novo par
      const newPayload = { userId: user.id, email: user.email, name: user.name };
      const accessToken = JwtUtil.generateAccessToken(newPayload);
      const newRefresh = JwtUtil.generateRefreshToken(newPayload);

      await prisma.$transaction([
        prisma.refreshToken.update({
          where: { jti: payload.jti },
          data: { revokedAt: new Date() },
        }),
        prisma.refreshToken.create({
          data: { userId: user.id, jti: newRefresh.jti, expiresAt: newRefresh.expiresAt },
        }),
      ]);

      return { accessToken, refreshToken: newRefresh.token };
    } catch (error) {
      throw new AppError(401, 'Token inválido ou expirado');
    }
  }

  /**
   * ✅ Fase 2 item 2.3 do cronograma: logout agora revoga de verdade -
   * antes só retornava 200 sem invalidar nada ("Futuramente pode
   * implementar blacklist de tokens"). Revoga todos os refresh tokens
   * ativos do usuário (todas as sessões), não só a que fez a chamada -
   * mais simples que exigir o cliente mandar o refresh token no logout, e
   * é o comportamento que a maioria dos usuários espera de "sair".
   */
  async logout(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        active: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                permissions: {
                  select: {
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
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'Usuário não encontrado');
    }

    // Flatten the roles structure
    const formattedUser = {
      ...user,
      roles: user.roles.map((ur) => ({
        ...ur.role,
        permissions: ur.role.permissions.map((rp) => rp.permission),
      })),
    };

    return formattedUser;
  }
}

export default new AuthService();
