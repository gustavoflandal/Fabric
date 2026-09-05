import { Request, Response, NextFunction } from 'express';
import auditLogService from '../services/audit-log.service';
import { AuthRequest } from './auth.middleware';
import { config } from '../config/env';
import { getSetting } from '../services/system-setting.service';

// Middleware para capturar automaticamente todas as requisições
export const auditMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  // Capturar o body original
  const originalBody = { ...req.body };

  // Interceptar o res.json para capturar a resposta
  const originalJson = res.json.bind(res);
  let responseBody: any;

  res.json = function (body: any) {
    responseBody = body;
    return originalJson(body);
  };

  // Quando a resposta terminar, criar o log
  res.on('finish', async () => {
    try {
      // Verificar modo de auditoria
      const auditMode = await getSetting('audit.mode', config.audit.mode);
      if (auditMode === 'none') {
        return; // Não logar nada
      }

      const durationMs = Date.now() - startTime;

      // Determinar ação baseada no método HTTP
      const actionMap: Record<string, string> = {
        GET: 'read',
        POST: 'create',
        PUT: 'update',
        PATCH: 'update',
        DELETE: 'delete',
      };

      const action = actionMap[req.method] || 'unknown';

      // Extrair recurso do path (ex: /api/v1/users -> users)
      const pathParts = req.path.split('/').filter(Boolean);
      const resource = pathParts[pathParts.length - 1] || 'unknown';

      // Lista de rotas que NÃO devem ser logadas.
      // ✅ Fase 2 item 2.5 do cronograma: /auth/login e /auth/register
      // removidos daqui - login (inclusive falho) é exatamente o tipo de
      // evento que uma trilha de auditoria precisa cobrir, e antes ficava
      // totalmente de fora (o retorno abaixo é incondicional, nem erros
      // eram logados). /auth/refresh continua excluído para não gerar um
      // log a cada renovação automática de token (alto volume, baixo valor);
      // se for preciso investigar abuso de refresh token, tratar à parte.
      const excludedPaths = [
        '/health',
        '/auth/refresh',
        '/auth/me',
        '/audit-logs',        // Não logar consultas de logs
        '/permissions',       // Não logar listagem de permissões
        '/statistics',        // Não logar estatísticas
      ];

      // Verificar se a rota deve ser excluída
      const shouldExclude = excludedPaths.some(path => req.path.includes(path));
      if (shouldExclude) {
        return;
      }

      // Aplicar lógica baseada no modo de auditoria
      const isReadOperation = req.method === 'GET';
      const isError = res.statusCode >= 400;
      const isWriteOperation = !isReadOperation;

      // Modo: errors_only - Logar apenas erros
      if (auditMode === 'errors_only' && !isError) {
        return;
      }

      // Modo: write_only - Logar apenas escritas e erros
      if (auditMode === 'write_only') {
        if (isReadOperation && !isError) {
          return; // Não logar leituras bem-sucedidas
        }
      }

      // Modo: all - Logar tudo (mas respeitar includeReads). Declarado fora
      // do `if` (default `false`) porque o gate final abaixo precisa dele
      // mesmo fora do modo 'all' — nos outros modos o valor não importa
      // (correção do bug pré-existente descrito no relatório da Task 6: o
      // gate final ignorava esta variável e nunca logava uma leitura
      // bem-sucedida, mesmo com includeReads=true).
      let includeReads = false;
      if (auditMode === 'all') {
        includeReads = await getSetting('audit.include_reads', config.audit.includeReads);
        if (isReadOperation && !includeReads && !isError) {
          return; // Não logar leituras se includeReads for false
        }
      }

      // Logar operações de escrita, erros, ou leituras bem-sucedidas quando
      // o modo 'all' pediu explicitamente para incluí-las.
      if (isWriteOperation || isError || (isReadOperation && includeReads)) {
        await auditLogService.create({
          userId: req.userId,
          action,
          resource,
          description: `${req.method} ${req.path}`,
          ipAddress: auditLogService.getIpAddress(req),
          userAgent: req.headers['user-agent'],
          method: req.method,
          endpoint: req.originalUrl,
          statusCode: res.statusCode,
          requestBody: sanitizeBody(originalBody),
          responseBody: sanitizeBody(responseBody),
          durationMs,
        });
      }
    } catch (error) {
      // Não quebrar a aplicação se o log falhar
      console.error('Erro ao criar audit log:', error);
    }
  });

  next();
};

// Função para remover dados sensíveis dos logs
function sanitizeBody(body: any): any {
  if (!body) return null;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'accessToken', 'refreshToken'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

// Decorator para logar ações específicas
export function AuditLog(resource: string, action: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const req = args[0] as AuthRequest;
      const result = await originalMethod.apply(this, args);

      // Logar após a execução bem-sucedida
      try {
        await auditLogService.logRequest(
          req,
          req.userId,
          action,
          resource,
          req.params?.id,
          `${action} ${resource}`
        );
      } catch (error) {
        console.error('Erro ao criar audit log:', error);
      }

      return result;
    };

    return descriptor;
  };
}
