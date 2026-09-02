import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from './error.middleware';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return next(new AppError(400, 'Erro de validação', true, errors));
    }

    req.body = value;
    next();
  };
};

/**
 * F1.4 do plano do WMS: mesma ideia de `validate()`, mas para a query string
 * (rotas de LEITURA não têm body para validar).
 *
 * Diferença deliberada em relação a `validate()`: **não reatribui
 * `req.query`**. No Express 4 `req.query` é um getter definido no protótipo
 * (`defineGetter`, sem setter), então `req.query = value` falha em strict mode
 * — o mesmo truque que funciona com `req.body` não funciona aqui. Este
 * middleware então só ACEITA ou REJEITA a entrada; o controller continua lendo
 * `req.query` normalmente. Consequência prática: sem coerção nem
 * `stripUnknown`, o controller lê strings, que é exatamente o que ele precisa
 * para filtros por id.
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query, { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      return next(new AppError(400, 'Erro de validação', true, errors));
    }

    next();
  };
};
