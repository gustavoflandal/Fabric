import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import storageRuleService from '../services/storage-rule.service';

/**
 * F4.6 do plano do WMS. Controllers finos, sem regra: validação de entrada nos
 * validators (Joi) e regra de negócio no service, que lança `AppError` — aqui
 * só `next(error)`, no padrão do projeto.
 */
export class StorageRuleController {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await storageRuleService.createRule(req.body);
      return res.status(201).json({
        status: 'success',
        message: 'Regra de armazenagem criada com sucesso',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await storageRuleService.listRules({
        productId: req.query.productId as string | undefined,
        categoryId: req.query.categoryId as string | undefined,
        active:
          req.query.active === undefined ? undefined : req.query.active === 'true',
      });

      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await storageRuleService.updateRule(req.params.id, req.body);
      return res.status(200).json({
        status: 'success',
        message: 'Regra de armazenagem atualizada com sucesso',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await storageRuleService.deleteRule(req.params.id);
      return res.status(200).json({
        status: 'success',
        message: 'Regra de armazenagem excluída com sucesso',
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * F4.6 — a sugestão de endereço.
   *
   * 200 mesmo quando `suggestion` é `null` (nenhuma posição viável): "não há
   * endereço adequado agora" é uma resposta legítima, e o corpo traz `rejected`
   * com o motivo de cada descarte — que é o que o supervisor precisa para
   * decidir (liberar espaço? rever a regra? aceitar outra posição?). Um 404 aqui
   * sugeriria que o RECURSO não existe, o que não é o caso.
   */
  async suggest(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await storageRuleService.suggestPosition(
        req.query.productId as string,
        Number(req.query.quantity)
      );

      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }
}

export default new StorageRuleController();
