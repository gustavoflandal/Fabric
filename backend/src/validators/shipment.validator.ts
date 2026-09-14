import Joi from 'joi';

/**
 * EXPEDIÇÃO — validação do Romaneio.
 *
 * `shipmentNumber` e `status` não aparecem em nenhum schema, pelo mesmo motivo
 * de `orderNumber` no pedido de venda: o número vem da sequência atômica e o
 * status só anda pelas rotas de transição. `stripUnknown: true` descarta os
 * dois se o cliente mandar.
 *
 * `warehouseId` também NÃO é aceito: ele é HERDADO do `SalesOrder`. Um romaneio
 * que saísse de um armazém diferente do pedido separaria material de um lugar
 * onde o pedido nunca prometeu ter estoque.
 */

export const createShipmentSchema = Joi.object({
  salesOrderId: Joi.string().uuid().required().messages({
    'string.guid': 'ID do pedido de venda inválido',
    'any.required': 'Pedido de venda é obrigatório',
  }),
  notes: Joi.string().trim().max(500).allow('', null).messages({
    'string.max': 'Observação deve ter no máximo 500 caracteres',
  }),
  items: Joi.array()
    .items(
      Joi.object({
        salesOrderItemId: Joi.string().uuid().required().messages({
          'string.guid': 'ID do item do pedido inválido',
          'any.required': 'Item do pedido é obrigatório',
        }),
        quantity: Joi.number().positive().required().messages({
          'number.positive': 'Quantidade deve ser maior que zero',
          'any.required': 'Quantidade é obrigatória',
        }),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'O romaneio deve ter pelo menos um item',
      'any.required': 'Itens são obrigatórios',
    }),
});

export const listShipmentQuerySchema = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'SEPARATING', 'READY', 'DISPATCHED', 'CANCELLED')
    .messages({ 'any.only': 'Status inválido' }),
  salesOrderId: Joi.string().uuid().messages({
    'string.guid': 'ID do pedido de venda inválido',
  }),
  warehouseId: Joi.string().uuid().messages({
    'string.guid': 'ID do armazém inválido',
  }),
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
}).unknown(true);
