import Joi from 'joi';
import { CONDITION_FIELDS } from '../services/workflow-condition.service';

/**
 * F-WORKFLOW — validação de entrada do CRUD de WorkflowTemplate. A árvore
 * `ConditionRule` é RECURSIVA (grupo AND/OR contém outras ConditionRule) —
 * usa o idioma padrão do Joi para schemas recursivos: `.id()` no nó raiz e
 * `Joi.link()` nos clauses, resolvido pela própria lib (ver o id escolhido
 * logo abaixo).
 *
 * Nós/arestas chegam com CLIENT IDS (strings arbitrárias geradas no
 * navegador antes de qualquer persistência) — o service resolve esses ids
 * para uuid real ao criar. Por isso `id`/`fromClientId`/`toClientId` aqui são
 * `Joi.string().required()` livre, não `.uuid()`.
 */

const conditionOperators = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains'];

const conditionLeafSchema = Joi.object({
  field: Joi.string().valid(...CONDITION_FIELDS).required(),
  operator: Joi.string().valid(...conditionOperators).required(),
  value: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).required(),
});

/**
 * O id do link precisa ser DIFERENTE do nome de qualquer chave que carregue
 * este schema (aqui, a chave `conditionRule` em `nodeSchema`) — Joi registra
 * chaves de objeto como ids implícitos e colide com um `.id()` explícito de
 * mesmo nome ("Schema key conflicts with existing id"). Por isso o id é
 * `conditionRuleSchema`, não `conditionRule`.
 */
const conditionRuleSchema = Joi.alternatives()
  .id('conditionRuleSchema')
  .try(
    conditionLeafSchema,
    Joi.object({
      op: Joi.string().valid('AND', 'OR').required(),
      clauses: Joi.array().items(Joi.link('#conditionRuleSchema')).min(1).required(),
    })
  );

const NODE_TYPES = ['DESCARGA', 'CONFERENCIA', 'ETIQUETAGEM', 'QUARENTENA', 'SEGREGACAO', 'AMOSTRAGEM', 'ALOCACAO', 'DECISAO'];

const nodeSchema = Joi.object({
  clientId: Joi.string().required(),
  type: Joi.string().valid(...NODE_TYPES).required(),
  label: Joi.string().allow('', null),
  conditionRule: conditionRuleSchema.allow(null),
  positionX: Joi.number().required(),
  positionY: Joi.number().required(),
});

const edgeSchema = Joi.object({
  fromClientId: Joi.string().required(),
  toClientId: Joi.string().required(),
  branch: Joi.string().valid('SIM', 'NAO').allow(null),
});

export const createWorkflowTemplateSchema = Joi.object({
  name: Joi.string().min(1).max(120).required(),
  description: Joi.string().allow('', null),
  priority: Joi.number().integer().min(0).default(0),
  active: Joi.boolean().default(true),
  triggerRule: conditionRuleSchema.allow(null),
  entryClientId: Joi.string().required(),
  nodes: Joi.array().items(nodeSchema).min(1).required(),
  edges: Joi.array().items(edgeSchema).required(),
});

export const updateWorkflowTemplateSchema = createWorkflowTemplateSchema;

export const listWorkflowTemplatesQuerySchema = Joi.object({
  active: Joi.boolean(),
}).unknown(true);
