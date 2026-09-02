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

/**
 * F4.8/F4.10 — `POST /warehouse-tasks/:id/execute` (conclusão de PICKING e
 * REPLENISHMENT).
 *
 * Corpo idêntico ao de `/complete` (só a versão opcional), e isso é o esperado:
 * produto, quantidade e posições já estão gravados NA TAREFA desde a criação —
 * não há o que o dispositivo informe. O schema existe separado mesmo assim para
 * que as duas rotas possam divergir sem que uma mudança numa afete a outra.
 */
export const executeWarehouseTaskSchema = Joi.object({
  version: Joi.number().integer().min(0).optional(),
});

/**
 * F4.9 — `POST /warehouse-tasks/:id/assign`.
 *
 * `assignedTo` aceita `null` EXPLÍCITO para desatribuir (devolver a tarefa ao
 * pool). Por isso `.required()` junto de `.allow(null)`: omitir o campo é
 * ambíguo (não fazer nada? limpar?), mandar `null` não é.
 */
export const assignWarehouseTaskSchema = Joi.object({
  assignedTo: Joi.string().uuid().allow(null).required().messages({
    'string.guid': 'ID do operador inválido',
    'any.required': 'Informe o operador (assignedTo) ou null para desatribuir',
  }),
  version: Joi.number().integer().min(0).optional(),
});

/**
 * F4.11 — `POST /warehouse-tasks/:id/scan`.
 *
 * `code` é texto livre e NÃO um uuid: é o que o leitor de código de barras
 * emite — um endereço (`ARM-RUA-AA-PP`) ou um código de produto. Validar
 * formato aqui seria acoplar a validação de entrada ao padrão de etiqueta, que
 * varia por instalação; a resolução (e a recusa) é do service, que consulta o
 * banco.
 */
export const scanWarehouseTaskSchema = Joi.object({
  code: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Código lido é obrigatório',
    'any.required': 'Código lido é obrigatório',
  }),
});

/**
 * F4.9/F4.11 — `GET /warehouse-tasks/my`.
 *
 * `.unknown(true)` pelo mesmo motivo registrado em
 * `storage-position.validator.ts`: `validateQuery()` não reatribui `req.query`
 * e portanto não aplica `stripUnknown` — sem isso um `?_=timestamp` de
 * cache-busting viraria 400.
 */
export const myWarehouseTasksQuerySchema = Joi.object({
  includeUnassigned: Joi.boolean(),
  limit: Joi.number().integer().min(1).max(200),
}).unknown(true);
