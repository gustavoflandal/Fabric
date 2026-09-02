import Joi from 'joi';

// ✅ Fase 2 item 2.2 do cronograma: endpoints de estoque não tinham nenhuma
// validação de schema - o service só falhava tarde (ou pior, aceitava
// valores absurdos) quando os campos vinham errados/faltando.

export const registerEntrySchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.uuid': 'ID do produto inválido',
    'any.required': 'Produto é obrigatório',
  }),
  quantity: Joi.number().greater(0).required().messages({
    'number.greater': 'Quantidade deve ser maior que zero',
    'any.required': 'Quantidade é obrigatória',
  }),
  reason: Joi.string().trim().min(3).max(255).required().messages({
    'string.min': 'Motivo deve ter no mínimo 3 caracteres',
    'any.required': 'Motivo é obrigatório',
  }),
  reference: Joi.string().trim().max(191).allow('', null),
  notes: Joi.string().trim().allow('', null),
});

export const registerExitSchema = registerEntrySchema;

export const registerAdjustmentSchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.uuid': 'ID do produto inválido',
    'any.required': 'Produto é obrigatório',
  }),
  quantity: Joi.number().min(0).required().messages({
    'number.min': 'Quantidade não pode ser negativa',
    'any.required': 'Quantidade é obrigatória',
  }),
  reason: Joi.string().trim().min(3).max(255).required().messages({
    'string.min': 'Motivo deve ter no mínimo 3 caracteres',
    'any.required': 'Motivo é obrigatório',
  }),
  notes: Joi.string().trim().allow('', null),
});
