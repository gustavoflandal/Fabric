import Joi from 'joi';

const PLATE_PATTERN = /^([A-Za-z]{3}\d[A-Za-z]\d{2}|[A-Za-z]{3}\d{4})$/;

export const createVehicleSchema = Joi.object({
  plate: Joi.string().trim().pattern(PLATE_PATTERN).required().messages({
    'string.pattern.base': 'Placa em formato inválido (use ABC1234 ou ABC1D23, sem hífen)',
    'any.required': 'Placa é obrigatória',
  }),
  type: Joi.string().valid('TRUCK', 'TOCO', 'CAVALO', 'MECANICO', 'VAN', 'UTILITARIO', 'OUTROS').required().messages({
    'any.only': 'Tipo de rodado inválido',
    'any.required': 'Tipo de rodado é obrigatório',
  }),
  model: Joi.string().trim().max(100).allow('', null),
  supplierId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do fornecedor inválido',
    'any.required': 'Fornecedor é obrigatório',
  }),
  fleetId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID da frota inválido',
  }),
});

export const updateVehicleSchema = Joi.object({
  plate: Joi.string().trim().pattern(PLATE_PATTERN).messages({
    'string.pattern.base': 'Placa em formato inválido (use ABC1234 ou ABC1D23, sem hífen)',
  }),
  type: Joi.string().valid('TRUCK', 'TOCO', 'CAVALO', 'MECANICO', 'VAN', 'UTILITARIO', 'OUTROS').messages({
    'any.only': 'Tipo de rodado inválido',
  }),
  model: Joi.string().trim().max(100).allow('', null),
  supplierId: Joi.string().uuid().messages({
    'string.guid': 'ID do fornecedor inválido',
  }),
  fleetId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID da frota inválido',
  }),
}).min(1);

export const setVehicleBlockedSchema = Joi.object({
  blocked: Joi.boolean().required(),
  blockedReason: Joi.string().trim().allow('', null),
});

export const listVehicleQuerySchema = Joi.object({
  supplierId: Joi.string().uuid(),
  fleetId: Joi.string().uuid(),
  type: Joi.string().valid('TRUCK', 'TOCO', 'CAVALO', 'MECANICO', 'VAN', 'UTILITARIO', 'OUTROS'),
  blocked: Joi.boolean(),
  search: Joi.string(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
