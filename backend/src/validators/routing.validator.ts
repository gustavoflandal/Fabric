import Joi from 'joi';

export const createRoutingSchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.empty': 'ID do produto é obrigatório',
    'string.uuid': 'ID do produto inválido',
    'any.required': 'ID do produto é obrigatório',
  }),
  version: Joi.number().integer().min(1).default(1),
  description: Joi.string().trim().allow('', null),
  validFrom: Joi.date().iso().allow(null),
  validTo: Joi.date().iso().greater(Joi.ref('validFrom')).allow(null).messages({
    'date.greater': 'Data final deve ser maior que data inicial',
  }),
  active: Joi.boolean().default(true),
  operations: Joi.array().items(
    Joi.object({
      sequence: Joi.number().integer().min(1).required().messages({
        'number.base': 'Sequência deve ser um número',
        'number.min': 'Sequência deve ser maior que 0',
        'any.required': 'Sequência é obrigatória',
      }),
      workCenterId: Joi.string().uuid().required().messages({
        'string.empty': 'Centro de trabalho é obrigatório',
        'string.uuid': 'ID do centro de trabalho inválido',
        'any.required': 'Centro de trabalho é obrigatório',
      }),
      description: Joi.string().trim().required().messages({
        'string.empty': 'Descrição da operação é obrigatória',
        'any.required': 'Descrição da operação é obrigatória',
      }),
      setupTime: Joi.number().min(0).required().messages({
        'number.base': 'Tempo de setup deve ser um número',
        'number.min': 'Tempo de setup não pode ser negativo',
        'any.required': 'Tempo de setup é obrigatório',
      }),
      runTime: Joi.number().min(0).required().messages({
        'number.base': 'Tempo de execução deve ser um número',
        'number.min': 'Tempo de execução não pode ser negativo',
        'any.required': 'Tempo de execução é obrigatório',
      }),
      queueTime: Joi.number().min(0).default(0),
      moveTime: Joi.number().min(0).default(0),
      notes: Joi.string().trim().allow('', null),
    })
  ).min(1).required().messages({
    'array.min': 'Roteiro deve ter pelo menos uma operação',
    'any.required': 'Operações são obrigatórias',
  }),
});

export const updateRoutingSchema = Joi.object({
  description: Joi.string().trim().allow('', null),
  validFrom: Joi.date().iso().allow(null),
  validTo: Joi.date().iso().allow(null),
  active: Joi.boolean(),
  operations: Joi.array().items(
    Joi.object({
      id: Joi.string().uuid().optional(),
      sequence: Joi.number().integer().min(1).required(),
      workCenterId: Joi.string().uuid().required(),
      description: Joi.string().trim().required(),
      setupTime: Joi.number().min(0).required(),
      runTime: Joi.number().min(0).required(),
      queueTime: Joi.number().min(0).default(0),
      moveTime: Joi.number().min(0).default(0),
      notes: Joi.string().trim().allow('', null),
    })
  ).min(1),
}).min(1);

export const setActiveRoutingSchema = Joi.object({
  active: Joi.boolean().required(),
});
