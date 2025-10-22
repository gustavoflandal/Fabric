import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { AppError } from './error.middleware';
import { logger } from '../config/logger';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userName?: string;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (config.nodeEnv === 'development') {
      logger.debug('Auth Middleware', {
        path: req.path,
        method: req.method,
        hasToken: !!authHeader
      });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Token não fornecido');
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
      email: string;
      name?: string;
    };
    
    if (config.nodeEnv === 'development') {
      logger.debug(`Token válido para: ${decoded.email}`);
    }

    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userName = decoded.name;

    next();
  } catch (error) {
    if (config.nodeEnv === 'development') {
      logger.debug('Erro na autenticação:', error instanceof Error ? error.message : error);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError(401, 'Token inválido'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'Token expirado'));
    }
    next(error);
  }
};
