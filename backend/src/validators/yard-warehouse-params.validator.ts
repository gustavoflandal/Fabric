import Joi from 'joi';

export const upsertYardWarehouseParamsSchema = Joi.object({
  useYard: Joi.boolean().required().messages({
    'any.required': 'Uso de pátio é obrigatório',
  }),
  delayToleranceMinutes: Joi.number().integer().min(0).max(60).required().messages({
    'number.min': 'Tolerância de atraso deve estar entre 0 e 60 minutos',
    'number.max': 'Tolerância de atraso deve estar entre 0 e 60 minutos',
    'any.required': 'Tolerância de atraso é obrigatória',
  }),
});
