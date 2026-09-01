import { Request, Response, NextFunction } from 'express';
import roleService from '../services/role.service';

export class RoleController {
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await roleService.getAll();

      res.status(200).json({
        status: 'success',
        data: roles,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const role = await roleService.getById(req.params.id);

      res.status(200).json({
        status: 'success',
        data: role,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const role = await roleService.create(req.body);

      res.status(201).json({
        status: 'success',
        data: role,
        message: 'Perfil criado com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const role = await roleService.update(req.params.id, req.body);

      res.status(200).json({
        status: 'success',
        data: role,
        message: 'Perfil atualizado com sucesso',
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await roleService.delete(req.params.id);

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }

  async assignPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await roleService.assignPermissions(
        req.params.id,
        req.body.permissionIds
      );

      res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new RoleController();
