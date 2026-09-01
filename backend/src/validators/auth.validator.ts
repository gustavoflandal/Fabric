import Joi from 'joi';
import { strongPasswordSchema } from './common.validator';

export const registerSchema = Joi.object({
  name: Joi.string().min(3).max(100).required().messages({
    'string.min': 'Nome deve ter no mínimo 3 caracteres',
    'string.max': 'Nome deve ter no máximo 100 caracteres',
    'any.required': 'Nome é obrigatório',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'E-mail inválido',
    'any.required': 'E-mail é obrigatório',
  }),
  password: strongPasswordSchema.required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'E-mail inválido',
    'any.required': 'E-mail é obrigatório',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Senha é obrigatória',
  }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token é obrigatório',
  }),
});
