import { Router } from 'express';
import storageRuleController from '../controllers/storage-rule.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate, validateQuery } from '../middleware/validation.middleware';
import {
  createStorageRuleSchema,
  listStorageRulesQuerySchema,
  suggestPositionQuerySchema,
  updateStorageRuleSchema,
} from '../validators/storage-rule.validator';

/**
 * F4.6 do plano do WMS — regras de armazenagem e sugestão de endereço.
 *
 * MONTADO SOB `requireModule('WMS')` em `routes/index.ts`, como todo o resto do
 * armazém: uma regra de endereçamento não significa nada numa instalação que
 * não tem endereço.
 *
 * RBAC — recurso REAPROVEITADO, nenhum recurso novo: `estruturas_armazem`.
 * Regra de armazenagem é configuração do armazém, do mesmo nível de quem
 * desenha ruas, andares e posições — não é operação de armazém (que é
 * `tarefas_armazem`, criado em F4.9) nem cadastro de produto. Quem já pode
 * criar a estrutura física é exatamente quem deve poder dizer o que vai onde;
 * inventar um recurso `regras_armazenagem` separado obrigaria toda instalação a
 * atribuir mais uma permissão para um caso de uso que tem o mesmo público.
 *
 * A LEITURA da sugestão fica em `visualizar` (o coletor e a tela de
 * endereçamento a consultam o tempo todo, e ela não muda nada); a ESCRITA de
 * regra fica em `criar`/`editar`/`excluir`.
 */
const router = Router();

router.use(authMiddleware);

// Segmento fixo antes da paramétrica (mesma disciplina de
// `storage-position.routes.ts`).
router.get(
  '/suggest',
  requirePermission('estruturas_armazem', 'visualizar'),
  validateQuery(suggestPositionQuerySchema),
  storageRuleController.suggest
);

router.get(
  '/',
  requirePermission('estruturas_armazem', 'visualizar'),
  validateQuery(listStorageRulesQuerySchema),
  storageRuleController.list
);

router.post(
  '/',
  requirePermission('estruturas_armazem', 'criar'),
  validate(createStorageRuleSchema),
  storageRuleController.create
);

router.put(
  '/:id',
  requirePermission('estruturas_armazem', 'editar'),
  validate(updateStorageRuleSchema),
  storageRuleController.update
);

router.delete(
  '/:id',
  requirePermission('estruturas_armazem', 'excluir'),
  storageRuleController.remove
);

export default router;
