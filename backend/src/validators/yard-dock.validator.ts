import Joi from 'joi';

export const createYardDockSchema = Joi.object({
  code: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Código é obrigatório',
    'any.required': 'Código é obrigatório',
  }),
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO').required().messages({
    'any.only': 'Tipo de serviço inválido',
    'any.required': 'Tipo de serviço é obrigatório',
  }),
  warehouseId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do armazém inválido',
    'any.required': 'Armazém é obrigatório',
  }),
  storagePositionId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID da posição de armazenagem inválido',
  }),
  active: Joi.boolean().default(true),
});

export const updateYardDockSchema = Joi.object({
  code: Joi.string().trim().min(1),
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO').messages({
    'any.only': 'Tipo de serviço inválido',
  }),
  storagePositionId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID da posição de armazenagem inválido',
  }),
  active: Joi.boolean(),
}).min(1);

export const listYardDockQuerySchema = Joi.object({
  warehouseId: Joi.string().uuid(),
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO'),
  active: Joi.boolean(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
