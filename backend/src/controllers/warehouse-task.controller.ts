import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import warehouseTaskService from '../services/warehouse-task.service';
import warehouseTaskExecutionService from '../services/warehouse-task-execution.service';
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

  /** Painel de operações — recebimentos ativos com a cadeia completa. */
  async getPanel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const scope = (req.query.scope as 'all' | 'mine' | undefined) ?? 'all';
      const data = await warehouseTaskService.listActiveReceiptOperations(scope, req.userId!);
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

  /** F4.9/F4.11 — a fila do operador logado. */
  async getMyTasks(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await warehouseTaskService.listMyTasks(req.userId!, {
        // `validateQuery` valida mas não converte (não reatribui `req.query`),
        // então a coerção é feita aqui — mesmo padrão dos demais controllers
        // com query string do projeto.
        includeUnassigned:
          req.query.includeUnassigned === undefined
            ? undefined
            : req.query.includeUnassigned === 'true',
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });

      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  /** F4.9 — atribuir/desatribuir uma tarefa a um operador. */
  async assign(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await warehouseTaskService.assignTask(
        req.params.id,
        req.body.assignedTo ?? null,
        req.body.version
      );

      return res.status(200).json({
        status: 'success',
        message: req.body.assignedTo
          ? 'Tarefa atribuída com sucesso'
          : 'Tarefa devolvida à fila',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  /** F4.11 — o operador iniciou a tarefa no coletor. */
  async start(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await warehouseTaskService.startTask(req.params.id, req.userId!);

      return res.status(200).json({
        status: 'success',
        message: 'Tarefa iniciada',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * F4.11 — confirmação de leitura de código de barras.
   *
   * SEMPRE 200 quando a tarefa existe, mesmo com `ok: false` — "bipou o
   * endereço errado" é resposta de negócio, não erro de requisição. Ver a nota
   * completa em `warehouse-task.service.ts::scanTask`.
   */
  async scan(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await warehouseTaskService.scanTask(req.params.id, req.body.code);

      return res.status(200).json({
        status: 'success',
        message: data.message,
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  /** F4.8/F4.10 — conclusão de PICKING/REPLENISHMENT (movimenta estoque). */
  async execute(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await warehouseTaskExecutionService.executeTask(
        req.params.id,
        req.userId!,
        req.body.version
      );

      return res.status(200).json({
        status: 'success',
        message: 'Tarefa executada e estoque movimentado',
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  /** F4.8 — as tarefas de separação de uma ordem de produção. */
  async getByProductionOrder(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await warehouseTaskExecutionService.listByProductionOrder(
        req.params.orderId
      );

      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }
}

export default new WarehouseTaskController();
