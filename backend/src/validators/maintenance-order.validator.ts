import Joi from 'joi';

// Só corretiva é criável via API — preventiva só nasce do job (Task 5).
export const createMaintenanceOrderSchema = Joi.object({
  equipmentId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do equipamento inválido',
    'any.required': 'Equipamento é obrigatório',
  }),
  problemDescription: Joi.string().trim().min(1).max(5000).required().messages({
    'string.empty': 'Descrição do problema é obrigatória',
    'any.required': 'Descrição do problema é obrigatória',
    'string.max': 'Descrição do problema deve ter no máximo 5000 caracteres',
  }),
  assignedTo: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do responsável inválido',
  }),
});

export const completeMaintenanceOrderSchema = Joi.object({
  resolutionNotes: Joi.string().trim().min(1).max(5000).required().messages({
    'string.empty': 'Descreva a solução aplicada',
    'any.required': 'Descreva a solução aplicada',
    'string.max': 'Solução aplicada deve ter no máximo 5000 caracteres',
  }),
});

export const cancelMaintenanceOrderSchema = Joi.object({
  reason: Joi.string().trim().max(5000).allow('', null).messages({
    'string.max': 'Motivo do cancelamento deve ter no máximo 5000 caracteres',
  }),
});

export const updateMaintenanceOrderSchema = Joi.object({
  assignedTo: Joi.string().uuid().allow(null).messages({
    'string.guid': 'ID do responsável inválido',
  }),
}).min(1);

export const listMaintenanceOrderQuerySchema = Joi.object({
  equipmentId: Joi.string().uuid(),
  type: Joi.string().valid('PREVENTIVE', 'CORRECTIVE'),
  status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1),
}).unknown(true);
