import Joi from 'joi';

export const createFleetSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Nome é obrigatório',
    'any.required': 'Nome é obrigatório',
  }),
  supplierId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do fornecedor inválido',
    'any.required': 'Fornecedor é obrigatório',
  }),
});

export const updateFleetSchema = Joi.object({
  name: Joi.string().trim().min(1),
}).min(1);

export const setFleetBlockedSchema = Joi.object({
  blocked: Joi.boolean().required(),
  blockedReason: Joi.string().trim().allow('', null),
});

export const listFleetQuerySchema = Joi.object({
  supplierId: Joi.string().uuid(),
  blocked: Joi.boolean(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
