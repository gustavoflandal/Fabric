import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import workflowTemplateService from '../services/workflow-template.service';

export class WorkflowTemplateController {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const active = req.query.active === undefined ? undefined : req.query.active === 'true';
      const data = await workflowTemplateService.list(active);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowTemplateService.getById(req.params.id);
      return res.status(200).json({ status: 'success', data });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowTemplateService.create(req.body);
      return res.status(201).json({ status: 'success', message: 'Template de workflow criado com sucesso', data });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowTemplateService.update(req.params.id, req.body);
      return res.status(200).json({ status: 'success', message: 'Template de workflow atualizado com sucesso', data });
    } catch (error) {
      return next(error);
    }
  }

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await workflowTemplateService.remove(req.params.id);
      return res.status(200).json({ status: 'success', message: 'Template de workflow excluído com sucesso' });
    } catch (error) {
      return next(error);
    }
  }

  async duplicate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowTemplateService.duplicate(req.params.id);
      return res.status(201).json({ status: 'success', message: 'Template de workflow duplicado com sucesso', data });
    } catch (error) {
      return next(error);
    }
  }
}

export default new WorkflowTemplateController();
