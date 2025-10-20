import Joi from 'joi';

export const createProductCategorySchema = Joi.object({
  code: Joi.string().trim().max(50).required().messages({
    'string.empty': 'Código é obrigatório',
    'string.max': 'Código deve ter no máximo 50 caracteres',
    'any.required': 'Código é obrigatório',
  }),
  name: Joi.string().trim().max(120).required().messages({
    'string.empty': 'Nome é obrigatório',
    'string.max': 'Nome deve ter no máximo 120 caracteres',
    'any.required': 'Nome é obrigatório',
  }),
  description: Joi.string().trim().allow('', null),
  parentId: Joi.string().uuid().allow(null),
});

export const updateProductCategorySchema = createProductCategorySchema.fork(
  ['code', 'name'],
  (schema) => schema.optional()
).optional();
