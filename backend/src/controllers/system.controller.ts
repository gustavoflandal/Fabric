import { Request, Response, NextFunction } from 'express';
import { listLicensedModules } from '../services/licensed-module.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { listSettings, updateSetting } from '../services/system-setting.service';

/**
 * GET /api/system/licensed-modules
 *
 * F0.8 do plano do WMS. Diz ao frontend QUAIS MÓDULOS EXISTEM NESTA
 * INSTALAÇÃO, para o guard de rota do Vue Router e o menu lateral checarem
 * licença da instalação além da permissão do usuário (hoje só checam a
 * segunda).
 *
 * Exige apenas autenticação, sem `requirePermission`: é informação de
 * navegação ("este sistema tem WMS?"), não dado de negócio sensível — e todo
 * usuário autenticado precisa dela para a tela montar.
 */
export const getLicensedModules = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const modules = await listLicensedModules();

    res.json({
      success: true,
      data: modules,
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * GET /api/v1/system/settings
 * Exige system_settings:read (RBAC, ver system.routes.ts).
 */
export const getSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await listSettings();
    res.json({ status: 'success', data: settings });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/system/settings/:key
 * Exige system_settings:update (RBAC, ver system.routes.ts).
 */
export const updateSystemSetting = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updated = await updateSetting(req.params.key, req.body.value, req.userId);
    res.json({ status: 'success', data: updated });
  } catch (error) {
    next(error);
  }
};
