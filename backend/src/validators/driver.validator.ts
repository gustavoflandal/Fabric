import Joi from 'joi';

export const createDriverSchema = Joi.object({
  name: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Nome é obrigatório',
    'any.required': 'Nome é obrigatório',
  }),
  cpf: Joi.string().trim().pattern(/^\d{11}$/).required().messages({
    'string.pattern.base': 'CPF deve conter 11 dígitos numéricos, sem pontuação',
    'any.required': 'CPF é obrigatório',
  }),
  supplierId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do fornecedor inválido',
    'any.required': 'Fornecedor é obrigatório',
  }),
});

export const updateDriverSchema = Joi.object({
  name: Joi.string().trim().min(1),
  cpf: Joi.string().trim().pattern(/^\d{11}$/).messages({
    'string.pattern.base': 'CPF deve conter 11 dígitos numéricos, sem pontuação',
  }),
  supplierId: Joi.string().uuid().messages({
    'string.guid': 'ID do fornecedor inválido',
  }),
}).min(1);

export const setDriverBlockedSchema = Joi.object({
  blocked: Joi.boolean().required(),
  blockedReason: Joi.string().trim().allow('', null),
});

export const listDriverQuerySchema = Joi.object({
  supplierId: Joi.string().uuid(),
  blocked: Joi.boolean(),
  search: Joi.string(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
