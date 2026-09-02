import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import stockPositionService from '../services/stock-position.service';

/**
 * F1.3 / F1.4 do plano do WMS. Controllers finos, sem regra: validação de
 * entrada nos validators (Joi) e regra de negócio no service, que lança
 * `AppError` — aqui só `next(error)`, no padrão do projeto (convenção 2.7,
 * "Fase 4 item 4.4").
 */
export class StockPositionController {
  /** F1.4 — saldo de um produto detalhado por posição. */
  async getBalancesByProduct(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { productId } = req.params;
      const data = await stockPositionService.getBalancesByProduct(productId);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  /** F1.4 — todos os produtos com saldo em uma posição específica. */
  async getBalancesByPosition(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { positionId } = req.params;
      const data = await stockPositionService.getBalancesByPosition(positionId);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  /** F1.4 — posições ocupadas (saldo > 0) de um armazém ou estrutura. */
  async getOccupiedPositions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await stockPositionService.getOccupiedPositions({
        warehouseId: req.query.warehouseId as string | undefined,
        structureId: req.query.structureId as string | undefined,
      });
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * F1.3 — leitura sob demanda do relatório de divergência, o mesmo que o job
   * diário de reconciliação executa. Existe para inspeção manual sem precisar
   * esperar a janela do job.
   */
  async getDivergences(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const divergences = await stockPositionService.getDivergences();
      return res.status(200).json({
        status: 'success',
        data: {
          consistent: divergences.length === 0,
          total: divergences.length,
          divergences,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new StockPositionController();
