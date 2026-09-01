import Joi from 'joi';

export const createProductionPointingSchema = Joi.object({
  productionOrderId: Joi.string().uuid().required().messages({
    'string.empty': 'Ordem de produção é obrigatória',
    'string.uuid': 'ID da ordem inválido',
    'any.required': 'Ordem de produção é obrigatória',
  }),
  operationId: Joi.string().uuid().required().messages({
    'string.empty': 'Operação é obrigatória',
    'string.uuid': 'ID da operação inválido',
    'any.required': 'Operação é obrigatória',
  }),
  workCenterId: Joi.string().uuid().required().messages({
    'string.empty': 'Centro de trabalho é obrigatório',
    'string.uuid': 'ID do centro inválido',
    'any.required': 'Centro de trabalho é obrigatório',
  }),
  startTime: Joi.date().iso().required().messages({
    'date.base': 'Data/hora de início inválida',
    'any.required': 'Data/hora de início é obrigatória',
  }),
  endTime: Joi.date().iso().greater(Joi.ref('startTime')).required().messages({
    'date.base': 'Data/hora de fim inválida',
    'date.greater': 'Data/hora de fim deve ser maior que início',
    'any.required': 'Data/hora de fim é obrigatória',
  }),
  goodQuantity: Joi.number().min(0).default(0).messages({
    'number.base': 'Quantidade boa deve ser um número',
    'number.min': 'Quantidade boa não pode ser negativa',
  }),
  scrapQuantity: Joi.number().min(0).default(0).messages({
    'number.base': 'Quantidade de refugo deve ser um número',
    'number.min': 'Quantidade de refugo não pode ser negativa',
  }),
  // ✅ Fase 1 item 1.5: faltavam no validator, mas o service sempre exigiu
  // esses dois campos - toda chamada real era rejeitada pelo Prisma com
  // "Argument runTime is missing" (o Joi descartava o que o cliente mandasse
  // por não estarem no schema de validação).
  setupTime: Joi.number().min(0).default(0).messages({
    'number.base': 'Tempo de setup deve ser um número',
    'number.min': 'Tempo de setup não pode ser negativo',
  }),
  runTime: Joi.number().min(0).required().messages({
    'number.base': 'Tempo de execução deve ser um número',
    'number.min': 'Tempo de execução não pode ser negativo',
    'any.required': 'Tempo de execução é obrigatório',
  }),
  notes: Joi.string().trim().allow('', null),
});

export const updateProductionPointingSchema = Joi.object({
  endTime: Joi.date().iso().allow(null),
  goodQuantity: Joi.number().min(0),
  scrapQuantity: Joi.number().min(0),
  notes: Joi.string().trim().allow('', null),
}).min(1);

export const finishPointingSchema = Joi.object({
  endTime: Joi.date().iso().required().messages({
    'date.base': 'Data/hora de fim inválida',
    'any.required': 'Data/hora de fim é obrigatória',
  }),
  goodQuantity: Joi.number().min(0).required().messages({
    'number.base': 'Quantidade boa deve ser um número',
    'number.min': 'Quantidade boa não pode ser negativa',
    'any.required': 'Quantidade boa é obrigatória',
  }),
  scrapQuantity: Joi.number().min(0).default(0),
  notes: Joi.string().trim().allow('', null),
});
