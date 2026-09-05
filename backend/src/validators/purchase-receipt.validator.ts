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

        // --- Lote lido na conferência (Fase 5 do plano do WMS) --------------
        // Os três são OPCIONAIS AQUI, e isso é deliberado: a obrigatoriedade de
        // `lotNumber` depende de `Product.lotTracked`, uma flag do banco que o
        // Joi não enxerga. Quem exige é `purchase-receipt.service.ts::create()`,
        // com `AppError` 400 — a mesma divisão de trabalho já registrada em
        // `stock.validator.ts` ("este schema cobre só o que é verificável a
        // partir do próprio payload").
        //
        // `expiresAt` NÃO é comparado com "hoje": receber material já vencido é
        // um fato do mundo (aconteceu, está na doca), e o sistema precisa
        // conseguir registrá-lo para depois dar baixa. Quem recusa a SAÍDA de
        // lote vencido é `applyMovement`, no momento certo.
        lotNumber: Joi.string().trim().max(100).allow('', null).messages({
          'string.max': 'Número do lote deve ter no máximo 100 caracteres',
        }),
        manufacturedAt: Joi.date().iso().allow(null).messages({
          'date.format': 'Data de fabricação inválida',
        }),
        // O `when` guarda a referência cruzada: sem `manufacturedAt` no payload,
        // um `min(ref)` solto resolveria para `undefined` e o Joi rejeitaria a
        // própria regra, transformando "só informei a validade" num 400.
        expiresAt: Joi.date()
          .iso()
          .allow(null)
          .when('manufacturedAt', {
            is: Joi.date().iso().required(),
            then: Joi.date().iso().allow(null).min(Joi.ref('manufacturedAt')),
          })
          .messages({
            'date.format': 'Data de validade inválida',
            'date.min': 'Validade não pode ser anterior à fabricação',
          }),
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

export const parseNfeSchema = Joi.object({
  xml: Joi.string().trim().min(1).required().messages({
    'any.required': 'Conteúdo do XML é obrigatório',
    'string.empty': 'Conteúdo do XML é obrigatório',
  }),
});
