import Joi from 'joi';
import { POSITION_TYPES } from './warehouse-structure.validator';

/**
 * F4.6 do plano do WMS — validação de entrada das regras de armazenagem.
 * Joi (não Zod), o validator do backend deste projeto desde a Fase 2.
 *
 * A INVARIANTE DE ESCOPO (`productId` XOR `categoryId`) aparece em DOIS lugares,
 * e não é redundância inútil:
 *   * aqui, com `.xor()`, para devolver 400 com mensagem clara ANTES de tocar o
 *     banco;
 *   * em `storage-rule.service.ts::assertScope()`, porque o service é chamável
 *     fora da rota (seed, script de onboarding, teste) e a invariante não pode
 *     depender de quem chamou. Ver a nota no `schema.prisma` sobre por que ela
 *     não é um CHECK constraint.
 */

const scopeMessages = {
  'object.xor':
    'Informe productId OU categoryId (uma regra tem escopo de produto ou de categoria, nunca os dois)',
  'object.missing':
    'Informe productId ou categoryId — uma regra precisa de escopo',
};

export const createStorageRuleSchema = Joi.object({
  productId: Joi.string().uuid().messages({
    'string.guid': 'ID do produto inválido',
  }),
  categoryId: Joi.string().uuid().messages({
    'string.guid': 'ID da categoria inválido',
  }),
  // Nulo/ausente = "qualquer tipo de posição serve" (ver o schema).
  positionType: Joi.string()
    .valid(...POSITION_TYPES)
    .allow(null),
  priority: Joi.number().integer().min(0).default(0),
  requiresQuarantine: Joi.boolean().default(false),
  active: Joi.boolean().default(true),
})
  .xor('productId', 'categoryId')
  .messages(scopeMessages);

/**
 * No update o escopo NÃO é validado por `.xor()`: um PATCH que só muda
 * `priority` não manda escopo nenhum, e `.xor()` o recusaria. A invariante é
 * checada no service sobre o resultado do MERGE com a regra existente — que é
 * o único ponto em que ela pode ser avaliada corretamente.
 */
export const updateStorageRuleSchema = Joi.object({
  productId: Joi.string().uuid().allow(null),
  categoryId: Joi.string().uuid().allow(null),
  positionType: Joi.string()
    .valid(...POSITION_TYPES)
    .allow(null),
  priority: Joi.number().integer().min(0),
  requiresQuarantine: Joi.boolean(),
  active: Joi.boolean(),
}).min(1);

/** `GET /storage-rules` */
export const listStorageRulesQuerySchema = Joi.object({
  productId: Joi.string().uuid(),
  categoryId: Joi.string().uuid(),
  active: Joi.boolean(),
}).unknown(true);

/**
 * `GET /storage-rules/suggest` — a sugestão de endereço.
 *
 * `quantity` é obrigatória: sem ela não há como avaliar capacidade de peso nem
 * empilhamento, e a "sugestão" degeneraria numa lista de posições livres.
 */
export const suggestPositionQuerySchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do produto inválido',
    'any.required': 'productId é obrigatório',
  }),
  quantity: Joi.number().greater(0).required().messages({
    'number.greater': 'Quantidade deve ser maior que zero',
    'any.required': 'quantity é obrigatória',
  }),
}).unknown(true);
