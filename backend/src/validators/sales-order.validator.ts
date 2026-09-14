import Joi from 'joi';

/**
 * EXPEDIÇÃO — validação do Pedido de Venda.
 *
 * `orderNumber` NÃO aparece em nenhum schema, e isso é a regra de negócio, não
 * um esquecimento: o número é emitido pela sequência atômica no `create()` do
 * service (ver `document-sequence.service.ts`). Como `validate()` roda com
 * `stripUnknown: true`, um cliente que mandar `orderNumber` no corpo tem o
 * campo DESCARTADO silenciosamente em vez de conseguir escolher o número do
 * próprio documento — que é exatamente o que a sequência existe para impedir.
 *
 * `status` também não é aceito em lugar nenhum: o ciclo de vida do pedido só
 * anda pelas rotas de transição (`/confirm`, `/cancel`) e pelo despacho do
 * romaneio, nunca por um PUT que escreva o campo direto.
 */

const itemSchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do produto inválido',
    'any.required': 'Produto é obrigatório',
  }),
  quantity: Joi.number().positive().required().messages({
    'number.positive': 'Quantidade deve ser maior que zero',
    'any.required': 'Quantidade é obrigatória',
  }),
  unitPrice: Joi.number().min(0).required().messages({
    'number.min': 'Preço unitário não pode ser negativo',
    'any.required': 'Preço unitário é obrigatório',
  }),
});

export const createSalesOrderSchema = Joi.object({
  customerId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do cliente inválido',
    'any.required': 'Cliente é obrigatório',
  }),
  warehouseId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do armazém inválido',
    'any.required': 'Armazém é obrigatório',
  }),
  expectedShipDate: Joi.date().iso().allow(null).messages({
    'date.format': 'Data prevista de expedição inválida',
  }),
  notes: Joi.string().trim().max(500).allow('', null).messages({
    'string.max': 'Observação deve ter no máximo 500 caracteres',
  }),
  items: Joi.array().items(itemSchema).min(1).required().messages({
    'array.min': 'O pedido deve ter pelo menos um item',
    'any.required': 'Itens são obrigatórios',
  }),
});

/**
 * Edição só existe em DRAFT (regra aplicada no service). `items` é OPCIONAL:
 * omitir mantém os itens atuais; enviar SUBSTITUI a lista inteira, mesmo
 * contrato de `purchase-order.service.ts::update()`.
 */
export const updateSalesOrderSchema = Joi.object({
  customerId: Joi.string().uuid().messages({
    'string.guid': 'ID do cliente inválido',
  }),
  warehouseId: Joi.string().uuid().messages({
    'string.guid': 'ID do armazém inválido',
  }),
  expectedShipDate: Joi.date().iso().allow(null),
  notes: Joi.string().trim().max(500).allow('', null),
  items: Joi.array().items(itemSchema).min(1).messages({
    'array.min': 'O pedido deve ter pelo menos um item',
  }),
}).min(1);

export const listSalesOrderQuerySchema = Joi.object({
  status: Joi.string()
    .valid('DRAFT', 'CONFIRMED', 'SEPARATING', 'READY_TO_SHIP', 'SHIPPED', 'CANCELLED')
    .messages({ 'any.only': 'Status inválido' }),
  customerId: Joi.string().uuid().messages({
    'string.guid': 'ID do cliente inválido',
  }),
  search: Joi.string().trim().max(100),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
}).unknown(true);
