import Joi from 'joi';

export const createEquipmentSchema = Joi.object({
  code: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Código é obrigatório',
    'any.required': 'Código é obrigatório',
  }),
  name: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Nome é obrigatório',
    'any.required': 'Nome é obrigatório',
  }),
  workCenterId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do centro de trabalho inválido',
    'any.required': 'Centro de trabalho é obrigatório',
  }),
  manufacturer: Joi.string().trim().allow('', null),
  model: Joi.string().trim().allow('', null),
  active: Joi.boolean().default(true),
});

export const updateEquipmentSchema = Joi.object({
  code: Joi.string().trim().min(1),
  name: Joi.string().trim().min(1),
  workCenterId: Joi.string().uuid().messages({
    'string.guid': 'ID do centro de trabalho inválido',
  }),
  manufacturer: Joi.string().trim().allow('', null),
  model: Joi.string().trim().allow('', null),
  active: Joi.boolean(),
}).min(1);

export const listEquipmentQuerySchema = Joi.object({
  workCenterId: Joi.string().uuid(),
  active: Joi.boolean(),
  search: Joi.string(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
