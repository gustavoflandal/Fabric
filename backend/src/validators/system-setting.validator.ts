import Joi from 'joi';

export const updateSystemSettingSchema = Joi.object({
  value: Joi.string().allow('').required().messages({
    'any.required': 'value é obrigatório',
  }),
});
