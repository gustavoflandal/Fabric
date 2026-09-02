import Joi from 'joi';

export const createProductSchema = Joi.object({
  code: Joi.string().trim().max(50).required().messages({
    'string.empty': 'Código é obrigatório',
    'string.max': 'Código deve ter no máximo 50 caracteres',
    'any.required': 'Código é obrigatório',
  }),
  name: Joi.string().trim().max(120).required().messages({
    'string.empty': 'Nome é obrigatório',
    'string.max': 'Nome deve ter no máximo 120 caracteres',
    'any.required': 'Nome é obrigatório',
  }),
  description: Joi.string().trim().allow(null, ''),
  type: Joi.string().trim().max(50).required().messages({
    'string.empty': 'Tipo é obrigatório',
    'string.max': 'Tipo deve ter no máximo 50 caracteres',
    'any.required': 'Tipo é obrigatório',
  }),
  unitId: Joi.string().uuid().required().messages({
    'string.guid': 'Unidade inválida',
    'any.required': 'Unidade é obrigatória',
  }),
  categoryId: Joi.string().uuid().allow(null),
  leadTime: Joi.number().integer().min(0).default(0),
  lotSize: Joi.number().positive().precision(4).allow(null),
  minStock: Joi.number().min(0).default(0),
  maxStock: Joi.number().greater(Joi.ref('minStock')).allow(null),
  safetyStock: Joi.number().min(0).default(0),
  reorderPoint: Joi.number().min(0).allow(null),
  standardCost: Joi.number().min(0).precision(2).allow(null),
  lastCost: Joi.number().min(0).precision(2).allow(null),
  averageCost: Joi.number().min(0).precision(2).allow(null),

  // --- Dados para Armazenagem (WMS) ---------------------------------------
  // F0.9 do plano do WMS + seção 3.2 de 04_ARQUITETURA_MODULAR_LICENCIAMENTO.md.
  // TODOS opcionais: um cliente só-PCP nunca preenche nada disto e não pode ser
  // obrigado a preencher. Não há checagem de módulo licenciado aqui — a seção
  // "Dados para Armazenagem" simplesmente não aparece no formulário quando o
  // WMS não está licenciado (guard de UI, tarefa de frontend separada), e
  // aceitar os campos no backend independentemente mantém o validator simples
  // e a API idempotente entre instalações.
  // Unidades: weight em kg; width/height/depth em metros; volume em m³.
  weight: Joi.number().positive().allow(null).messages({
    'number.positive': 'Peso deve ser maior que zero',
  }),
  width: Joi.number().positive().allow(null),
  height: Joi.number().positive().allow(null),
  depth: Joi.number().positive().allow(null),
  // Pode ser informado explicitamente (embalagem irregular) ou omitido — nesse
  // caso product.service deriva de width × height × depth quando as três
  // dimensões existirem.
  volume: Joi.number().positive().allow(null),
  packagingType: Joi.string().trim().max(50).allow(null, ''),
  maxStackQty: Joi.number().integer().greater(0).allow(null).messages({
    'number.greater': 'Empilhamento máximo deve ser de pelo menos 1 unidade',
  }),
  segregationGroup: Joi.string().trim().max(50).allow(null, ''),

  active: Joi.boolean().default(true),
}).with('maxStock', 'minStock');

export const updateProductSchema = createProductSchema.fork(
  [
    'code',
    'name',
    'type',
    'unitId',
  ],
  (schema) => schema.optional()
).optional();
