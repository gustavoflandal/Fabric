import Joi from 'joi';
import {
  POSITION_TYPES,
  RACK_POSITION_TYPES,
} from './warehouse-structure.validator';

// ✅ Fase 2 item 2.2 do cronograma: storagePositionService.updatePosition
// passava `data: any` direto pro Prisma sem nenhum filtro - o cliente podia
// tentar sobrescrever campos de identidade (structureId, warehouseCode,
// streetCode, floor, position) que não deveriam mudar por essa rota. Só os
// atributos físicos/de bloqueio ficam editáveis aqui.
//
// F0.1 do plano do WMS: `code` também é campo de identidade (é derivado de
// warehouseCode/streetCode/floor/position) e por isso NÃO é editável aqui —
// stripUnknown do validate() descarta se vier no body.
//
// F0.3: os campos dimensionais são opcionais para tipos de ÁREA e obrigatórios
// para tipos de rack. A lista canônica de tipos e a regra condicional moram em
// warehouse-structure.validator.ts para não divergirem entre os dois arquivos.

const dimensional = (label: string) =>
  Joi.number().greater(0).when('positionType', {
    is: Joi.valid(...RACK_POSITION_TYPES).required(),
    then: Joi.required().messages({
      'any.required': `${label} é obrigatório para tipos de posição com paletização (rack)`,
    }),
    otherwise: Joi.optional().allow(null),
  });

export const updateStoragePositionSchema = Joi.object({
  positionType: Joi.string().valid(...POSITION_TYPES),
  weightCapacity: dimensional('Capacidade de peso'),
  height: dimensional('Altura'),
  width: dimensional('Largura'),
  depth: dimensional('Profundidade'),
  maxHeight: dimensional('Altura máxima'),
  blocked: Joi.boolean(),
  // F4.10: marcar/desmarcar a posição como ÁREA DE PICKING. Entra por esta
  // rota, e não por uma rota nova, pela mesma razão de `blocked`: é um atributo
  // operacional da posição individual, editável por quem já pode editar a
  // posição (`storage_positions:update`). Não é campo de identidade nem
  // dimensional, então fica fora da regra condicional por `positionType`.
  isPickingArea: Joi.boolean(),
}).min(1);

/**
 * F2.4 — `GET /storage-positions/:id/movements`.
 *
 * Todos os filtros são opcionais: sem nenhum, a rota devolve o histórico
 * recente daquele endereço (o recorte já é a própria posição, então não há o
 * risco de varredura que fez `occupied` exigir escopo na Fase 1).
 *
 * `limit` é validado aqui só para recusar lixo explícito (`?limit=abc`,
 * `?limit=-1`); o teto de fato é aplicado no controller via
 * `parsePositiveInt(..., 500)`, no mesmo padrão do histórico de produto.
 *
 * `.unknown(true)` pelo mesmo motivo de `occupiedPositionsQuerySchema`:
 * `validateQuery()` não reatribui `req.query` e portanto não consegue aplicar
 * `stripUnknown` — sem isso, um `?_=timestamp` de cache-busting do cliente
 * viraria 400.
 */
export const positionMovementsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(500).messages({
    'number.base': 'limit deve ser um número inteiro',
    'number.min': 'limit deve ser maior que zero',
  }),
  productId: Joi.string().uuid().messages({
    'string.guid': 'productId deve ser um UUID válido',
  }),
}).unknown(true);
