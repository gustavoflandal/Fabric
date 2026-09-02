import Joi from 'joi';

// ✅ Fase 2 item 2.2 do cronograma: endpoints de estoque não tinham nenhuma
// validação de schema - o service só falhava tarde (ou pior, aceitava
// valores absurdos) quando os campos vinham errados/faltando.

export const registerEntrySchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.uuid': 'ID do produto inválido',
    'any.required': 'Produto é obrigatório',
  }),
  quantity: Joi.number().greater(0).required().messages({
    'number.greater': 'Quantidade deve ser maior que zero',
    'any.required': 'Quantidade é obrigatória',
  }),
  reason: Joi.string().trim().min(3).max(255).required().messages({
    'string.min': 'Motivo deve ter no mínimo 3 caracteres',
    'any.required': 'Motivo é obrigatório',
  }),
  reference: Joi.string().trim().max(191).allow('', null),
  notes: Joi.string().trim().allow('', null),
});

export const registerExitSchema = registerEntrySchema;

/**
 * F2.4 — `GET /stock/movements/:productId`, que ganhou o filtro opcional por
 * endereço. Validar a query aqui evita que um `positionId` malformado devolva
 * uma lista vazia silenciosa (que o consumidor leria como "nada aconteceu
 * nesse endereço") em vez de um 400.
 *
 * `.unknown(true)` / teto de `limit` aplicado no controller: mesmas razões
 * anotadas em `positionMovementsQuerySchema` (storage-position.validator.ts).
 */
export const movementsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(500).messages({
    'number.base': 'limit deve ser um número inteiro',
    'number.min': 'limit deve ser maior que zero',
  }),
  positionId: Joi.string().uuid().messages({
    'string.guid': 'positionId deve ser um UUID válido',
  }),
}).unknown(true);

/**
 * F2.3 do plano do WMS — `POST /stock/transfer` (transferência interna).
 *
 * Joi, e não Zod: é a convenção real do projeto
 * (`middleware/validation.middleware.ts`), apesar de o texto do plano
 * mencionar Zod — a mesma decisão já registrada em stock-position.validator.ts.
 *
 * O que NÃO é validado aqui, de propósito: existência das posições, bloqueio do
 * destino e saldo suficiente na origem. Todas dependem do estado do banco e são
 * checadas em `stock.service.ts::applyMovement()`, DENTRO da transação e com os
 * locks adquiridos — antecipá-las aqui daria uma resposta que já pode estar
 * errada quando a escrita acontecer (TOCTOU). Este schema cobre só o que é
 * verificável a partir do próprio payload.
 */
export const transferSchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do produto inválido',
    'any.required': 'Produto é obrigatório',
  }),
  fromPositionId: Joi.string().uuid().required().messages({
    'string.guid': 'Posição de origem inválida',
    'any.required': 'Posição de origem é obrigatória',
  }),
  // `invalid(ref)`: origem igual a destino é um no-op que debitaria e
  // creditaria a mesma linha. O service também recusa (é ele quem garante a
  // regra para chamadores internos); aqui a rejeição sai na borda, com o nome
  // do campo.
  toPositionId: Joi.string()
    .uuid()
    .required()
    .invalid(Joi.ref('fromPositionId'))
    .messages({
      'string.guid': 'Posição de destino inválida',
      'any.required': 'Posição de destino é obrigatória',
      'any.invalid': 'Posição de destino deve ser diferente da origem',
    }),
  quantity: Joi.number().greater(0).required().messages({
    'number.greater': 'Quantidade deve ser maior que zero',
    'any.required': 'Quantidade é obrigatória',
  }),
  reason: Joi.string().trim().min(3).max(255).required().messages({
    'string.min': 'Motivo deve ter no mínimo 3 caracteres',
    'any.required': 'Motivo é obrigatório',
  }),
  reference: Joi.string().trim().max(191).allow('', null),
  notes: Joi.string().trim().allow('', null),
  // Fase 5 — o lote transferido. OPCIONAL na borda pelo mesmo critério do resto
  // deste arquivo: se ele é obrigatório depende de `Product.lotTracked`, que é
  // estado do banco. Quem valida a pertinência do lote (existe? é deste produto?
  // o produto controla lote? venceu?) é `applyMovement()`, com o lock na mão.
  lotId: Joi.string().uuid().allow(null).messages({
    'string.guid': 'Lote inválido',
  }),
});

export const registerAdjustmentSchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.uuid': 'ID do produto inválido',
    'any.required': 'Produto é obrigatório',
  }),
  quantity: Joi.number().min(0).required().messages({
    'number.min': 'Quantidade não pode ser negativa',
    'any.required': 'Quantidade é obrigatória',
  }),
  reason: Joi.string().trim().min(3).max(255).required().messages({
    'string.min': 'Motivo deve ter no mínimo 3 caracteres',
    'any.required': 'Motivo é obrigatório',
  }),
  notes: Joi.string().trim().allow('', null),
});
