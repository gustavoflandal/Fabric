import Joi from 'joi';

// ✅ Fase 2 item 2.2 do cronograma: storagePositionService.updatePosition
// passava `data: any` direto pro Prisma sem nenhum filtro - o cliente podia
// tentar sobrescrever campos de identidade (structureId, warehouseCode,
// streetCode, floor, position) que não deveriam mudar por essa rota. Só os
// atributos físicos/de bloqueio ficam editáveis aqui.

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

export const updateStoragePositionSchema = Joi.object({
  positionType: Joi.string().valid(...POSITION_TYPES),
  weightCapacity: Joi.number().greater(0),
  height: Joi.number().greater(0),
  width: Joi.number().greater(0),
  depth: Joi.number().greater(0),
  maxHeight: Joi.number().greater(0),
  blocked: Joi.boolean(),
}).min(1);
