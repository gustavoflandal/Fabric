import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.middleware';
import { isModuleEnabled } from '../services/licensed-module.service';

/**
 * F0.8 do plano do WMS — seção 3.1 de
 * docs/fase-2026-09-modernizacao/04_ARQUITETURA_MODULAR_LICENCIAMENTO.md.
 *
 * Segunda camada de checagem, entre autenticação e RBAC. A ordem por
 * requisição é:
 *
 *   authMiddleware        -> o requisitante está autenticado?
 *   requireModule(codigo) -> a INSTALAÇÃO tem esse módulo licenciado?
 *   requirePermission()   -> o USUÁRIO tem essa permissão?
 *
 * Sem esta camada, licenciar um módulo e permitir que um usuário o veja eram a
 * mesma checagem rasa: qualquer admin de um cliente só-PCP poderia se
 * autoconceder `armazens:visualizar` e usar rotas que não deveriam existir para
 * ele.
 *
 * Aplicado NO PONTO DE MONTAGEM das rotas (routes/index.ts), não rota a rota:
 * uma linha por montagem bloqueia a superfície inteira do módulo, e uma rota
 * nova adicionada ao módulo já nasce protegida.
 *
 * Responde **404, não 403**: de propósito. A intenção é que o módulo pareça
 * não existir para quem não o licenciou — 403 revelaria que a funcionalidade
 * existe e está apenas fora do alcance, o que é informação comercial que não
 * interessa expor.
 *
 * `PCP` (núcleo) NÃO deve ser passado aqui: é sempre habilitado, checá-lo seria
 * custo por requisição sem benefício e risco de travar o núcleo por um erro de
 * configuração.
 */
export const requireModule = (code: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const enabled = await isModuleEnabled(code);

      if (!enabled) {
        throw new AppError(404, `Route ${req.originalUrl} not found`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
