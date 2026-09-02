import Joi from 'joi';

// ✅ Fase 2 item 2.2 do cronograma: warehouse-structure.routes.ts nunca teve
// validator. Enum de positionType espelha o schema.prisma (PositionType).

// F0.3 do plano do WMS: PositionType passou a cobrir também tipos de ÁREA
// (não-rack). Um tipo de área não tem paletização, então peso/dimensão deixam
// de fazer sentido — no banco as colunas viraram nullable, e a obrigatoriedade
// (que é CONDICIONAL ao tipo, algo que o schema do banco não expressa) é
// aplicada aqui.
export const RACK_POSITION_TYPES = [
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

export const AREA_POSITION_TYPES = [
  'PISO',
  'DOCA',
  'QUARENTENA',
  'BLOQUEIO',
  'EXPEDICAO',
];

export const POSITION_TYPES = [...RACK_POSITION_TYPES, ...AREA_POSITION_TYPES];

/**
 * Campo dimensional condicional ao tipo de posição:
 * - tipo de RACK presente  -> obrigatório e > 0;
 * - tipo de ÁREA, ou positionType ausente (update parcial) -> opcional,
 *   aceitando null para "esta posição não tem essa dimensão".
 *
 * `is: Joi.valid(...).required()` é o idioma do Joi para "a chave existe E
 * casa com um destes valores" — sem o `.required()` dentro do `is`, a ausência
 * de positionType também cairia no ramo `then`.
 */
const dimensional = (label: string) =>
  Joi.number().greater(0).when('positionType', {
    is: Joi.valid(...RACK_POSITION_TYPES).required(),
    then: Joi.required().messages({
      'any.required': `${label} é obrigatório para tipos de posição com paletização (rack)`,
    }),
    otherwise: Joi.optional().allow(null),
  });

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
  weightCapacity: dimensional('Capacidade de peso'),
  height: dimensional('Altura'),
  width: dimensional('Largura'),
  depth: dimensional('Profundidade'),
  maxHeight: dimensional('Altura máxima'),
  positionType: Joi.string().valid(...POSITION_TYPES).required().messages({
    'any.only': `Tipo de posição inválido. Valores aceitos: ${POSITION_TYPES.join(', ')}`,
    'any.required': 'Tipo de posição é obrigatório',
  }),
  blocked: Joi.boolean(),
});

// Só as chaves de identidade viram opcionais no update. Os campos dimensionais
// NÃO entram no fork de propósito: a presença deles já é condicional ao
// positionType (ver `dimensional`), e um `.optional()` por cima desfaria essa
// regra — trocar uma estrutura de área para um tipo de rack continua exigindo
// que as dimensões venham no mesmo request.
export const updateWarehouseStructureSchema = createWarehouseStructureSchema.fork(
  ['warehouseId', 'streetCode', 'floors', 'positions', 'positionType'],
  (schema) => schema.optional()
).min(1);
