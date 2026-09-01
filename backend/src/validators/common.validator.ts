import Joi from 'joi';

/**
 * ✅ Fase 2 item 2.4 do cronograma: senha mínima era 6 caracteres sem
 * nenhuma exigência de complexidade em todo o sistema (registro, criação de
 * usuário, troca de senha). Padrão único reaproveitado por auth.validator.ts
 * e user.validator.ts.
 */
export const strongPasswordSchema = Joi.string()
  .min(12)
  .pattern(/[a-z]/)
  .message('Senha deve conter pelo menos uma letra minúscula')
  .pattern(/[A-Z]/)
  .message('Senha deve conter pelo menos uma letra maiúscula')
  .pattern(/[0-9]/)
  .message('Senha deve conter pelo menos um número')
  .pattern(/[^A-Za-z0-9]/)
  .message('Senha deve conter pelo menos um caractere especial')
  .messages({
    'string.min': 'Senha deve ter no mínimo 12 caracteres',
    'any.required': 'Senha é obrigatória',
  });
