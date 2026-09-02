import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import warehouseTaskService from '../services/warehouse-task.service';
import purchaseReceiptService from '../services/purchase-receipt.service';

/**
 * F4.3 / F4.5 do plano do WMS. Controllers finos, sem regra: validação de
 * entrada nos validators (Joi) e regra de negócio no service, que lança
 * `AppError` — aqui só `next(error)`, no padrão do projeto.
 *
 * A conclusão da `ALOCACAO` delega a `purchase-receipt.service`, e não a
 * `warehouse-task.service`: ela é a única com efeito colateral de estoque e
 * precisa de `updateProductCosts()`, que é do domínio do recebimento. Ver a
 * nota de direção de import no topo de `warehouse-task.service.ts`.
 */
export class WarehouseTaskController {
  /** F4.5 — a cadeia de tarefas de um recebimento, na ordem de execução. */
  async getByReceipt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await warehouseTaskService.listByReceipt(req.params.receiptId);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  /** F4.3 — conclusão de DESCARGA/CONFERENCIA/ETIQUETAGEM/QUARENTENA. */
  async complete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await warehouseTaskService.completeTask(req.params.id, req.body.version);

      return res.status(200).json({
        status: 'success',
        message: 'Tarefa concluída com sucesso',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  /** F4.4/F4.5 — conclusão (parcial ou total) da tarefa de ALOCACAO. */
  async putaway(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await purchaseReceiptService.completePutaway(
        req.params.id,
        req.body,
        req.userId!
      );

      return res.status(201).json({
        status: 'success',
        message: data.receiptCompleted
          ? 'Endereçamento registrado - recebimento totalmente endereçado'
          : 'Endereçamento registrado',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }
}

export default new WarehouseTaskController();
