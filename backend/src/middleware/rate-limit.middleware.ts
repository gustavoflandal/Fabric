/**
 * Middleware de Rate Limiting
 * Protege a API contra abuso e ataques de força bruta
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { config } from '../config/env';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Limpar entradas antigas a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach(key => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  windowMs: number; // Janela de tempo em milissegundos
  max: number; // Máximo de requisições
  message?: string; // Mensagem de erro
  skipSuccessfulRequests?: boolean; // Não contar requisições bem-sucedidas
  keyGenerator?: (req: Request) => string; // Gerador customizado de chave
}

/**
 * Cria um middleware de rate limiting
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Muitas requisições deste IP, tente novamente mais tarde',
    skipSuccessfulRequests = false,
    keyGenerator = (req: Request) => {
      // Por padrão usa IP do cliente
      return req.ip || req.socket.remoteAddress || 'unknown';
    }
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      // Nova janela de tempo
      store[key] = {
        count: 1,
        resetTime: now + windowMs
      };
      return next();
    }

    // Incrementar contador
    store[key].count++;

    // Adicionar headers informativos
    const remaining = Math.max(0, max - store[key].count);
    const resetTime = Math.ceil((store[key].resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', resetTime.toString());

    if (store[key].count > max) {
      logger.warn(`Rate limit exceeded for ${key}`, {
        ip: key,
        count: store[key].count,
        limit: max
      });

      return res.status(429).json({
        status: 'error',
        message,
        retryAfter: resetTime
      });
    }

    // Se skipSuccessfulRequests, decrementar em requisições bem-sucedidas
    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          store[key].count = Math.max(0, store[key].count - 1);
        }
      });
    }

    next();
  };
}
/**
 * Rate limiter geral para toda a API
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: config.nodeEnv === 'development' ? 1000 : 100, // Mais flexível em dev
  message: 'Muitas requisições deste IP. Aguarde 15 minutos e tente novamente.'
});

/**
 * Rate limiter rigoroso para endpoints de autenticação
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: config.nodeEnv === 'development' ? 50 : 10, // Mais flexível em dev (10 em prod, 50 em dev)
  skipSuccessfulRequests: true, // Não contar logins bem-sucedidos
  message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.'
});

/**
 * Rate limiter para operações de escrita/modificação
 */
export const writeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: config.nodeEnv === 'development' ? 100 : 30, // Mais flexível em dev
  message: 'Muitas operações em um curto período. Aguarde um momento e tente novamente.'
});
