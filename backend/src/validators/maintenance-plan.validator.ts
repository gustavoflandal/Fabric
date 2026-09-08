import Joi from 'joi';

export const createMaintenancePlanSchema = Joi.object({
  equipmentId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do equipamento inválido',
    'any.required': 'Equipamento é obrigatório',
  }),
  name: Joi.string().trim().min(1).required().messages({
    'string.empty': 'Nome é obrigatório',
    'any.required': 'Nome é obrigatório',
  }),
  description: Joi.string().trim().max(5000).allow('', null).messages({
    'string.max': 'Descrição deve ter no máximo 5000 caracteres',
  }),
  frequencyDays: Joi.number().integer().greater(0).required().messages({
    'number.greater': 'Frequência deve ser maior que zero dias',
    'any.required': 'Frequência é obrigatória',
  }),
  // Opcional: se ausente, o service calcula now() + frequencyDays.
  nextDueDate: Joi.date().iso(),
  active: Joi.boolean().default(true),
});

export const updateMaintenancePlanSchema = Joi.object({
  equipmentId: Joi.string().uuid().messages({
    'string.guid': 'ID do equipamento inválido',
  }),
  name: Joi.string().trim().min(1),
  description: Joi.string().trim().max(5000).allow('', null).messages({
    'string.max': 'Descrição deve ter no máximo 5000 caracteres',
  }),
  frequencyDays: Joi.number().integer().greater(0).messages({
    'number.greater': 'Frequência deve ser maior que zero dias',
  }),
  nextDueDate: Joi.date().iso(),
  active: Joi.boolean(),
}).min(1);

export const listMaintenancePlanQuerySchema = Joi.object({
  equipmentId: Joi.string().uuid(),
  active: Joi.boolean(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
