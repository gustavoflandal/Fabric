import Joi from 'joi';

// ✅ Fase 2 item 2.2 do cronograma: warehouse.routes.ts nunca teve validator.

export const createWarehouseSchema = Joi.object({
  code: Joi.string().trim().min(1).max(50).required().messages({
    'any.required': 'Código é obrigatório',
  }),
  name: Joi.string().trim().min(1).max(191).required().messages({
    'any.required': 'Nome é obrigatório',
  }),
  legalName: Joi.string().trim().max(191).allow('', null),
  document: Joi.string().trim().max(30).allow('', null),
  email: Joi.string().trim().email().allow('', null).messages({
    'string.email': 'E-mail inválido',
  }),
  phone: Joi.string().trim().max(30).allow('', null),
  address: Joi.string().trim().max(191).allow('', null),
  city: Joi.string().trim().max(100).allow('', null),
  state: Joi.string().trim().max(2).allow('', null),
  zipCode: Joi.string().trim().max(20).allow('', null),
  country: Joi.string().trim().max(2),
  managerName: Joi.string().trim().max(191).allow('', null),
  capacity: Joi.number().min(0).allow(null),
  description: Joi.string().trim().allow('', null),
  active: Joi.boolean(),
});

export const updateWarehouseSchema = createWarehouseSchema.fork(
  ['code', 'name'],
  (schema) => schema.optional()
).min(1);
