import Joi from 'joi';

export const createYardVisitSchema = Joi.object({
  warehouseId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do armazém inválido',
    'any.required': 'Armazém é obrigatório',
  }),
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO').required().messages({
    'any.only': 'Tipo de serviço inválido',
    'any.required': 'Tipo de serviço é obrigatório',
  }),
  supplierId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do fornecedor inválido',
  }),
  purchaseOrderId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do pedido de compra inválido',
  }),
  scheduledAt: Joi.date().iso().required().messages({
    'any.required': 'Data/hora agendada é obrigatória',
  }),
  notes: Joi.string().trim().max(70).allow('', null).messages({
    'string.max': 'Observação deve ter no máximo 70 caracteres',
  }),
  driverId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do motorista inválido',
  }),
  vehicleId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do veículo inválido',
  }),
});

export const updateYardVisitSchema = Joi.object({
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO').messages({
    'any.only': 'Tipo de serviço inválido',
  }),
  supplierId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do fornecedor inválido',
  }),
  purchaseOrderId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do pedido de compra inválido',
  }),
  scheduledAt: Joi.date().iso(),
  notes: Joi.string().trim().max(70).allow('', null).messages({
    'string.max': 'Observação deve ter no máximo 70 caracteres',
  }),
}).min(1);

export const checkInYardVisitSchema = Joi.object({
  driverId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do motorista inválido',
    'any.required': 'Motorista é obrigatório para o check-in',
  }),
  vehicleId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do veículo inválido',
    'any.required': 'Veículo é obrigatório para o check-in',
  }),
});

export const listYardVisitQuerySchema = Joi.object({
  warehouseId: Joi.string().uuid(),
  status: Joi.string().valid('SCHEDULED', 'CHECKED_IN', 'CANCELLED'),
  serviceType: Joi.string().valid('RECEBIMENTO', 'EXPEDICAO', 'MULTIUSO'),
  vehicleId: Joi.string().uuid(),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
