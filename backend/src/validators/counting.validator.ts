import Joi from 'joi';

/**
 * F0.7 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md), fechando a
 * pendência da Fase 2 item 2.2 do cronograma: `counting.routes.ts` e seus dois
 * sub-routers eram os últimos endpoints mutantes do backend sem nenhuma
 * validação de entrada — o body ia direto do request para o service e daí para
 * o Prisma.
 *
 * Isso precisa estar fechado ANTES das Fases 3 e 4 do WMS, que alteram o módulo
 * de contagem (contagem por endereço, rota ordenada): entrar num módulo que
 * será modificado sem validação de entrada é reabrir risco já mapeado.
 *
 * Convenção do projeto: Joi + `validate(schema)` de
 * middleware/validation.middleware.ts, que valida `req.body` com
 * `stripUnknown: true` (campos não declarados são descartados, não rejeitados —
 * é o que impede o cliente de injetar colunas que a rota não deveria escrever,
 * como `code`, `status` ou `createdBy`).
 *
 * Enums espelham o schema.prisma. Rotas sem body (start/complete/cancel de
 * sessão, activate/pause/cancel de plano, adjust-stock) não recebem validator:
 * não há nada para validar, e todo o estado vem de params + usuário autenticado.
 */

const COUNTING_TYPES = ['CYCLIC', 'SPOT', 'FULL_INVENTORY', 'BLIND'];

const COUNTING_FREQUENCIES = [
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
  'ON_DEMAND',
];

const COUNTER_ROLES = ['PRIMARY', 'SECONDARY', 'VALIDATOR', 'SUPERVISOR'];

// ============================================
// PLANOS DE CONTAGEM
// ============================================

// `code`, `status`, `nextExecution` e `createdBy` NÃO entram: são gerados pelo
// service (código sequencial, status DRAFT) ou vêm do usuário autenticado.
export const createCountingPlanSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required().messages({
    'string.empty': 'Nome do plano é obrigatório',
    'any.required': 'Nome do plano é obrigatório',
  }),
  description: Joi.string().trim().allow(null, ''),
  type: Joi.string().valid(...COUNTING_TYPES).required().messages({
    'any.only': `Tipo de contagem inválido. Valores aceitos: ${COUNTING_TYPES.join(', ')}`,
    'any.required': 'Tipo de contagem é obrigatório',
  }),
  frequency: Joi.string().valid(...COUNTING_FREQUENCIES).allow(null).messages({
    'any.only': `Frequência inválida. Valores aceitos: ${COUNTING_FREQUENCIES.join(', ')}`,
  }),
  priority: Joi.number().integer().min(1).max(10),
  // `criteria` é Json no schema (critérios de seleção de produto do plano) -
  // objeto livre por desenho, mas ainda assim precisa SER um objeto.
  criteria: Joi.object().unknown(true),
  allowBlindCount: Joi.boolean(),
  requireRecount: Joi.boolean(),
  // Decimal(5,2) no banco: 0..999.99, mas percentual de tolerância acima de
  // 100% não tem significado de negócio.
  tolerancePercent: Joi.number().min(0).max(100).precision(2).allow(null),
  toleranceQty: Joi.number().integer().min(0).allow(null),
  startDate: Joi.date().iso().required().messages({
    'any.required': 'Data de início é obrigatória',
  }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).allow(null).messages({
    'date.min': 'Data de término deve ser posterior à data de início',
  }),
});

export const updateCountingPlanSchema = createCountingPlanSchema
  .fork(['name', 'type', 'startDate'], (schema) => schema.optional())
  .min(1);

// ============================================
// PRODUTOS DO PLANO
// ============================================

export const addCountingPlanProductSchema = Joi.object({
  productId: Joi.string().uuid().required().messages({
    'string.guid': 'Produto inválido',
    'any.required': 'Produto é obrigatório',
  }),
  priority: Joi.number().integer().min(0),
});

export const updateCountingPlanProductSchema = Joi.object({
  priority: Joi.number().integer().min(0).required().messages({
    'any.required': 'Prioridade é obrigatória',
  }),
});

// ============================================
// SESSÕES DE CONTAGEM
// ============================================

export const createCountingSessionSchema = Joi.object({
  planId: Joi.string().uuid().required().messages({
    'string.guid': 'Plano de contagem inválido',
    'any.required': 'Plano de contagem é obrigatório',
  }),
  scheduledDate: Joi.date().iso().required().messages({
    'any.required': 'Data agendada é obrigatória',
  }),
  assignedTo: Joi.string().uuid().allow(null).messages({
    'string.guid': 'Usuário responsável inválido',
  }),
});

// ============================================
// ATRIBUIÇÃO DE CONTADORES
// ============================================

export const assignCounterSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.guid': 'Usuário inválido',
    'any.required': 'Usuário é obrigatório',
  }),
  role: Joi.string().valid(...COUNTER_ROLES).required().messages({
    'any.only': `Papel de contador inválido. Valores aceitos: ${COUNTER_ROLES.join(', ')}`,
    'any.required': 'Papel do contador é obrigatório',
  }),
});

export const updateCounterRoleSchema = Joi.object({
  role: Joi.string().valid(...COUNTER_ROLES).required().messages({
    'any.only': `Papel de contador inválido. Valores aceitos: ${COUNTER_ROLES.join(', ')}`,
    'any.required': 'Papel do contador é obrigatório',
  }),
});

// ============================================
// ITENS DE CONTAGEM
// ============================================

// `countedBy`/`recountedBy` NÃO entram no body: o controller preenche a partir
// do usuário autenticado. Quantidade contada aceita 0 (contar e achar nada é um
// resultado válido, e é justamente o caso que gera a maior divergência) mas
// nunca negativa.
export const countItemSchema = Joi.object({
  countedQty: Joi.number().min(0).required().messages({
    'number.base': 'Quantidade contada deve ser um número',
    'number.min': 'Quantidade contada não pode ser negativa',
    'any.required': 'Quantidade contada é obrigatória',
  }),
  notes: Joi.string().trim().max(1000).allow(null, ''),
});

export const recountItemSchema = Joi.object({
  recountQty: Joi.number().min(0).required().messages({
    'number.base': 'Quantidade recontada deve ser um número',
    'number.min': 'Quantidade recontada não pode ser negativa',
    'any.required': 'Quantidade recontada é obrigatória',
  }),
  notes: Joi.string().trim().max(1000).allow(null, ''),
});

// Aceitar divergência sem recontagem e cancelar item: motivo é opcional no
// service atual, então o validator não o torna obrigatório - só limita o
// tamanho e o tipo.
export const itemReasonSchema = Joi.object({
  reason: Joi.string().trim().max(1000).allow(null, ''),
});
