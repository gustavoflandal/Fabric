import Joi from 'joi';

export const generateYardSpotsSchema = Joi.object({
  count: Joi.number().integer().min(1).max(500).required().messages({
    'number.min': 'Quantidade deve ser entre 1 e 500',
    'number.max': 'Quantidade deve ser entre 1 e 500',
    'any.required': 'Quantidade é obrigatória',
  }),
});

export const updateYardSpotSchema = Joi.object({
  code: Joi.string().trim().min(1),
}).min(1);

export const setYardSpotBlockedSchema = Joi.object({
  blocked: Joi.boolean().required(),
  blockedReason: Joi.string().trim().allow('', null),
});

export const listYardSpotQuerySchema = Joi.object({
  areaId: Joi.string().uuid(),
  blocked: Joi.boolean(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
