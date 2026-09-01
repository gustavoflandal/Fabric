import Joi from 'joi';

export const createProductionOrderSchema = Joi.object({
  orderNumber: Joi.string().trim().max(50).required().messages({
    'string.empty': 'Número da ordem é obrigatório',
    'string.max': 'Número da ordem deve ter no máximo 50 caracteres',
    'any.required': 'Número da ordem é obrigatório',
  }),
  productId: Joi.string().uuid().required().messages({
    'string.empty': 'Produto é obrigatório',
    'string.uuid': 'ID do produto inválido',
    'any.required': 'Produto é obrigatório',
  }),
  quantity: Joi.number().min(0.01).required().messages({
    'number.base': 'Quantidade deve ser um número',
    'number.min': 'Quantidade deve ser maior que zero',
    'any.required': 'Quantidade é obrigatória',
  }),
  scheduledStart: Joi.date().iso().required().messages({
    'date.base': 'Data de início agendada inválida',
    'any.required': 'Data de início agendada é obrigatória',
  }),
  scheduledEnd: Joi.date().iso().greater(Joi.ref('scheduledStart')).required().messages({
    'date.base': 'Data de fim agendada inválida',
    'date.greater': 'Data de fim deve ser maior que data de início',
    'any.required': 'Data de fim agendada é obrigatória',
  }),
  priority: Joi.number().integer().min(1).max(10).default(5),
  notes: Joi.string().trim().allow('', null),
});

export const updateProductionOrderSchema = Joi.object({
  orderNumber: Joi.string().trim().max(50),
  quantity: Joi.number().min(0.01),
  scheduledStart: Joi.date().iso(),
  scheduledEnd: Joi.date().iso(),
  priority: Joi.number().integer().min(1).max(10),
  notes: Joi.string().trim().allow('', null),
}).min(1);

export const changeStatusSchema = Joi.object({
  status: Joi.string()
    .valid('PLANNED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
    .required()
    .messages({
      'any.only': 'Status inválido',
      'any.required': 'Status é obrigatório',
    }),
  notes: Joi.string().trim().allow('', null),
});

export const updateProgressSchema = Joi.object({
  producedQuantity: Joi.number().min(0).required().messages({
    'number.base': 'Quantidade produzida deve ser um número',
    'number.min': 'Quantidade produzida não pode ser negativa',
    'any.required': 'Quantidade produzida é obrigatória',
  }),
  scrapQuantity: Joi.number().min(0).default(0),
});
