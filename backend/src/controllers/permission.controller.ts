import { Request, Response, NextFunction } from 'express';
import permissionService from '../services/permission.service';

export class PermissionController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const permissions = await permissionService.getAll();

      res.status(200).json({
        status: 'success',
        data: permissions,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const permission = await permissionService.getById(req.params.id);

      res.status(200).json({
        status: 'success',
        data: permission,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const permission = await permissionService.create(req.body);

      res.status(201).json({
        status: 'success',
        data: permission,
        message: 'Permissão criada com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await permissionService.delete(req.params.id);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async seedDefault(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await permissionService.seedDefaultPermissions();

      res.status(200).json({
        status: 'success',
        data: result,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new PermissionController();
