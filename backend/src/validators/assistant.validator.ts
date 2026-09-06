import Joi from 'joi';

/**
 * Assistente de IA — Fase 1. `history` é a memória de sessão do FRONTEND
 * (nunca lida/gravada no banco — spec seção 3/5); o backend só valida a
 * forma e o limita a 6 itens como segunda barreira (o service já corta em
 * `MAX_HISTORY_MESSAGES`).
 */
const assistantHistoryItemSchema = Joi.object({
  role: Joi.string().valid('user', 'assistant').required(),
  content: Joi.string().max(2000).required(),
});

export const chatSchema = Joi.object({
  message: Joi.string().trim().min(1).max(1000).required().messages({
    'string.empty': 'A mensagem é obrigatória',
    'string.max': 'A mensagem deve ter no máximo 1000 caracteres',
    'any.required': 'A mensagem é obrigatória',
  }),
  history: Joi.array().items(assistantHistoryItemSchema).max(6).optional(),
});
