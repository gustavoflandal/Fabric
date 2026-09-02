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
}).min(1);
