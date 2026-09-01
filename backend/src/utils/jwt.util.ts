import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env';

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface RefreshJwtPayload extends JwtPayload {
  jti: string;
}

export interface GeneratedRefreshToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export class JwtUtil {
  static generateAccessToken(payload: JwtPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  /**
   * ✅ Fase 2 item 2.3 do cronograma: cada refresh token gera um `jti`
   * (identificador único) que é persistido em RefreshToken (ver
   * auth.service.ts). Isso permite revogar/rotacionar tokens
   * individualmente - antes o refresh token era puramente stateless
   * (a assinatura JWT bastava), então nada impedia um token roubado de
   * continuar válido pelos 7 dias inteiros, mesmo após logout.
   */
  static generateRefreshToken(payload: JwtPayload): GeneratedRefreshToken {
    const jti = crypto.randomUUID();
    const token = jwt.sign({ ...payload, jti }, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    });
    const decoded = jwt.decode(token) as { exp: number };
    return { token, jti, expiresAt: new Date(decoded.exp * 1000) };
  }

  static verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  }

  static verifyRefreshToken(token: string): RefreshJwtPayload {
    return jwt.verify(token, config.jwt.refreshSecret) as RefreshJwtPayload;
  }
}
