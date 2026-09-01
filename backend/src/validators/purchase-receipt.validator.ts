import Joi from 'joi';

// ✅ Fase 2 item 2.2 do cronograma: purchase-receipt.routes.ts nunca teve
// validator - create() e cancel() confiavam inteiramente no que o service
// aceitasse (ou quebrasse tentando processar).

export const createPurchaseReceiptSchema = Joi.object({
  purchaseOrderId: Joi.string().uuid().required().messages({
    'string.uuid': 'ID do pedido de compra inválido',
    'any.required': 'Pedido de compra é obrigatório',
  }),
  receiptDate: Joi.date().iso().required().messages({
    'any.required': 'Data de recebimento é obrigatória',
  }),
  invoiceNumber: Joi.string().trim().max(100).allow('', null),
  notes: Joi.string().trim().allow('', null),
  items: Joi.array()
    .items(
      Joi.object({
        orderItemId: Joi.string().uuid().required(),
        productId: Joi.string().uuid().required(),
        quantityReceived: Joi.number().greater(0).required().messages({
          'number.greater': 'Quantidade recebida deve ser maior que zero',
        }),
        notes: Joi.string().trim().allow('', null),
      })
    )
    .min(1)
    .required()
    .messages({
      'array.min': 'Recebimento precisa de ao menos um item',
      'any.required': 'Itens são obrigatórios',
    }),
});

export const cancelPurchaseReceiptSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(255).required().messages({
    'string.min': 'Motivo do cancelamento deve ter no mínimo 3 caracteres',
    'any.required': 'Motivo do cancelamento é obrigatório',
  }),
});
