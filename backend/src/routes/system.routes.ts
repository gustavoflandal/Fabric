import { Router } from 'express';
import * as systemController from '../controllers/system.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { validate } from '../middleware/validation.middleware';
import { updateSystemSettingSchema } from '../validators/system-setting.validator';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// F0.8: módulos licenciados desta instalação (ver system.controller.ts para o
// motivo de não haver requirePermission aqui).
router.get('/licensed-modules', systemController.getLicensedModules);

// Configurações do Sistema — RBAC porque, diferente de licensed-modules, isto
// é dado de negócio editável, não informação de navegação pública.
router.get('/settings', requirePermission('system_settings', 'read'), systemController.getSettings);
router.patch(
  '/settings/:key',
  requirePermission('system_settings', 'update'),
  validate(updateSystemSettingSchema),
  systemController.updateSystemSetting
);

export default router;
