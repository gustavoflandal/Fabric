import Joi from 'joi';

export const createYardAreaSchema = Joi.object({
  warehouseId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do armazém inválido',
    'any.required': 'Armazém é obrigatório',
  }),
  code: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Código é obrigatório',
    'any.required': 'Código é obrigatório',
  }),
  name: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Nome é obrigatório',
    'any.required': 'Nome é obrigatório',
  }),
});

export const updateYardAreaSchema = Joi.object({
  code: Joi.string().trim().min(1),
  name: Joi.string().trim().min(1),
}).min(1);

export const setYardAreaBlockedSchema = Joi.object({
  blocked: Joi.boolean().required(),
  blockedReason: Joi.string().trim().allow('', null),
});

export const listYardAreaQuerySchema = Joi.object({
  warehouseId: Joi.string().uuid(),
  blocked: Joi.boolean(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
