import Joi from 'joi';

// ✅ Fase 2 item 2.2 do cronograma: warehouse-structure.routes.ts nunca teve
// validator. Enum de positionType espelha o schema.prisma (StoragePositionType).

const POSITION_TYPES = [
  'PORTA_PALETES',
  'MINI_PORTA_PALETES',
  'DRIVE_IN',
  'DRIVE_THROUGH',
  'PUSH_BACK',
  'FLOW_RACK',
  'CANTILEVER',
  'MEZANINO',
  'AUTOPORTANTE',
  'RACKS',
  'CARROSSEL',
  'MINI_LOAD',
  'ESTANTES_INDUSTRIAIS',
];

export const createWarehouseStructureSchema = Joi.object({
  warehouseId: Joi.string().uuid().required().messages({
    'string.uuid': 'ID do armazém inválido',
    'any.required': 'Armazém é obrigatório',
  }),
  streetCode: Joi.string().trim().min(1).max(50).required().messages({
    'any.required': 'Código da rua é obrigatório',
  }),
  floors: Joi.number().integer().greater(0).required(),
  positions: Joi.number().integer().greater(0).required(),
  weightCapacity: Joi.number().greater(0).required(),
  height: Joi.number().greater(0).required(),
  width: Joi.number().greater(0).required(),
  depth: Joi.number().greater(0).required(),
  maxHeight: Joi.number().greater(0).required(),
  positionType: Joi.string().valid(...POSITION_TYPES).required().messages({
    'any.only': `Tipo de posição inválido. Valores aceitos: ${POSITION_TYPES.join(', ')}`,
    'any.required': 'Tipo de posição é obrigatório',
  }),
  blocked: Joi.boolean(),
});

export const updateWarehouseStructureSchema = createWarehouseStructureSchema.fork(
  ['warehouseId', 'streetCode', 'floors', 'positions', 'weightCapacity', 'height', 'width', 'depth', 'maxHeight', 'positionType'],
  (schema) => schema.optional()
).min(1);
