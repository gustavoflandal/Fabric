import Joi from 'joi';

export const getYardDashboardQuerySchema = Joi.object({
  warehouseId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do armazém inválido',
    'any.required': 'Armazém é obrigatório',
  }),
  days: Joi.number().integer().min(1).max(365),
}).unknown(true);
