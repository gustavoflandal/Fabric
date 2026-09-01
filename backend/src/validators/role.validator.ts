import Joi from 'joi';

export const createRoleSchema = Joi.object({
  code: Joi.string().min(2).max(50).uppercase().required().messages({
    'string.min': 'Código deve ter no mínimo 2 caracteres',
    'string.max': 'Código deve ter no máximo 50 caracteres',
    'any.required': 'Código é obrigatório',
  }),
  name: Joi.string().min(3).max(100).required().messages({
    'string.min': 'Nome deve ter no mínimo 3 caracteres',
    'string.max': 'Nome deve ter no máximo 100 caracteres',
    'any.required': 'Nome é obrigatório',
  }),
  description: Joi.string().max(500).optional(),
  permissionIds: Joi.array().items(Joi.string().uuid()).optional(),
});

export const updateRoleSchema = Joi.object({
  code: Joi.string().min(2).max(50).uppercase().optional(),
  name: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).optional(),
  active: Joi.boolean().optional(),
});

export const assignPermissionsSchema = Joi.object({
  permissionIds: Joi.array().items(Joi.string().uuid()).min(1).required().messages({
    'array.min': 'Pelo menos uma permissão deve ser selecionada',
    'any.required': 'Permissões são obrigatórias',
  }),
});
