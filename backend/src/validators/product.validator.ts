import Joi from 'joi';

export const createProductSchema = Joi.object({
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
  description: Joi.string().trim().allow(null, ''),
  type: Joi.string().trim().max(50).required().messages({
    'string.empty': 'Tipo é obrigatório',
    'string.max': 'Tipo deve ter no máximo 50 caracteres',
    'any.required': 'Tipo é obrigatório',
  }),
  unitId: Joi.string().uuid().required().messages({
    'string.guid': 'Unidade inválida',
    'any.required': 'Unidade é obrigatória',
  }),
  categoryId: Joi.string().uuid().allow(null),
  leadTime: Joi.number().integer().min(0).default(0),
  lotSize: Joi.number().positive().precision(4).allow(null),
  minStock: Joi.number().min(0).default(0),
  maxStock: Joi.number().greater(Joi.ref('minStock')).allow(null),
  safetyStock: Joi.number().min(0).default(0),
  reorderPoint: Joi.number().min(0).allow(null),
  standardCost: Joi.number().min(0).precision(2).allow(null),
  lastCost: Joi.number().min(0).precision(2).allow(null),
  averageCost: Joi.number().min(0).precision(2).allow(null),
  active: Joi.boolean().default(true),
}).with('maxStock', 'minStock');

export const updateProductSchema = createProductSchema.fork(
  [
    'code',
    'name',
    'type',
    'unitId',
  ],
  (schema) => schema.optional()
).optional();
