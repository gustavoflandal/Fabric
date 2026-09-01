import { prisma } from '../config/database';
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
    const refreshToken = JwtUtil.generateRefreshToken(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
      refreshToken,
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

    // Verificar senha
    const isPasswordValid = await PasswordUtil.compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new AppError(401, 'Credenciais inválidas');
    }

    // Verificar se usuário está ativo
    if (!user.active) {
      throw new AppError(403, 'Usuário inativo');
    }

    // Atualizar último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Gerar tokens
    const payload = { userId: user.id, email: user.email, name: user.name };
    const accessToken = JwtUtil.generateAccessToken(payload);
    const refreshToken = JwtUtil.generateRefreshToken(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token: string): Promise<{ accessToken: string }> {
    try {
      // Verificar refresh token
      const payload = JwtUtil.verifyRefreshToken(token);

      // Verificar se usuário ainda existe e está ativo
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user || !user.active) {
        throw new AppError(401, 'Token inválido');
      }

      // Gerar novo access token
      const newPayload = { userId: user.id, email: user.email, name: user.name };
      const accessToken = JwtUtil.generateAccessToken(newPayload);

      return { accessToken };
    } catch (error) {
      throw new AppError(401, 'Token inválido ou expirado');
    }
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
