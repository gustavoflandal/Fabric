import Joi from 'joi';

const bomItemSchema = Joi.object({
  componentId: Joi.string().uuid().required().messages({
    'string.guid': 'Componente inválido',
    'any.required': 'Componente é obrigatório',
  }),
  quantity: Joi.number().positive().precision(6).required().messages({
    'number.base': 'Quantidade deve ser numérica',
    'number.positive': 'Quantidade deve ser maior que zero',
    'any.required': 'Quantidade é obrigatória',
  }),
  unitId: Joi.string().uuid().required().messages({
    'string.guid': 'Unidade inválida',
    'any.required': 'Unidade é obrigatória',
  }),
  scrapFactor: Joi.number().min(0).precision(4).default(0).messages({
    'number.min': 'Fator de sucata não pode ser negativo',
  }),
  sequence: Joi.number().integer().min(1).messages({
    'number.min': 'Sequência deve ser maior ou igual a 1',
    'number.integer': 'Sequência deve ser um número inteiro',
  }),
  notes: Joi.string().allow('', null),
});

export const createBomSchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.guid': 'Produto inválido',
    'any.required': 'Produto é obrigatório',
  }),
  description: Joi.string().allow('', null),
  validFrom: Joi.date().optional(),
  validTo: Joi.date().optional(),
  active: Joi.boolean().optional(),
  version: Joi.number().integer().min(1).optional(),
  items: Joi.array().items(bomItemSchema).min(1).required().messages({
    'array.min': 'A BOM deve conter pelo menos um item',
    'any.required': 'Itens são obrigatórios',
  }),
});

export const updateBomSchema = Joi.object({
  description: Joi.string().allow('', null),
  validFrom: Joi.date().optional(),
  validTo: Joi.date().optional(),
  active: Joi.boolean().optional(),
  version: Joi.number().integer().min(1).optional(),
  items: Joi.array().items(bomItemSchema).min(1).optional().messages({
    'array.min': 'A BOM deve conter pelo menos um item',
  }),
}).min(1);

export const setActiveBomSchema = Joi.object({
  active: Joi.boolean().required().messages({
    'any.required': 'O campo "active" é obrigatório',
  }),
});
