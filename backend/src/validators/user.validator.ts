import Joi from 'joi';

export const createUserSchema = Joi.object({
  name: Joi.string().min(3).max(100).required().messages({
    'string.min': 'Nome deve ter no mínimo 3 caracteres',
    'string.max': 'Nome deve ter no máximo 100 caracteres',
    'any.required': 'Nome é obrigatório',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'E-mail inválido',
    'any.required': 'E-mail é obrigatório',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Senha deve ter no mínimo 6 caracteres',
    'any.required': 'Senha é obrigatória',
  }),
  roleIds: Joi.array().items(Joi.string().uuid()).optional(),
});

export const updateUserSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  email: Joi.string().email().optional(),
  active: Joi.boolean().optional(),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Senha atual é obrigatória',
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'Nova senha deve ter no mínimo 6 caracteres',
    'any.required': 'Nova senha é obrigatória',
  }),
});

export const assignRolesSchema = Joi.object({
  roleIds: Joi.array().items(Joi.string().uuid()).min(1).required().messages({
    'array.min': 'Pelo menos um perfil deve ser selecionado',
    'any.required': 'Perfis são obrigatórios',
  }),
});
