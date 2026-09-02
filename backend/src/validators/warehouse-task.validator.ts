import Joi from 'joi';

/**
 * F4.3 / F4.5 do plano do WMS — validação de entrada das rotas de tarefa de
 * armazém. Joi (não Zod): é o validator do backend deste projeto, usado por
 * todas as rotas com validação desde a Fase 2 do cronograma.
 */

/** `POST /warehouse-tasks/:id/complete` — conclusão sem efeito de estoque. */
export const completeWarehouseTaskSchema = Joi.object({
  // Lock otimista OPCIONAL, mesmo contrato de `production-order.service.ts`:
  // um cliente que tem a tarefa em tela manda a versão que leu e recebe 409 se
  // alguém a concluiu antes; um coletor que só leu o código de barras da tarefa
  // omite (o `FOR UPDATE` + checagem de status já impedem dupla conclusão).
  version: Joi.number().integer().min(0).optional(),
});

/** `POST /warehouse-tasks/:id/putaway` — conclusão (parcial ou total) da ALOCACAO. */
export const putawayWarehouseTaskSchema = Joi.object({
  receiptItemId: Joi.string().uuid().required().messages({
    'string.uuid': 'ID do item de recebimento inválido',
    'any.required': 'Item de recebimento é obrigatório',
  }),
  storagePositionId: Joi.string().uuid().required().messages({
    'string.uuid': 'ID da posição de armazenagem inválido',
    'any.required': 'Posição de armazenagem é obrigatória',
  }),
  // `greater(0)`: endereçar zero não é uma operação, e quantidade negativa
  // viraria uma SAÍDA disfarçada de entrada. A validação de teto
  // (soma <= acceptedQty) NÃO mora aqui — depende de estado do banco e precisa
  // do item travado, então é do service (ver `completePutaway`).
  quantity: Joi.number().greater(0).required().messages({
    'number.greater': 'Quantidade a endereçar deve ser maior que zero',
    'any.required': 'Quantidade é obrigatória',
  }),
});
