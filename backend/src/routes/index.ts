import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import roleRoutes from './role.routes';
import permissionRoutes from './permission.routes';
import auditLogRoutes from './audit-log.routes';
import unitOfMeasureRoutes from './unit-of-measure.routes';
import supplierRoutes from './supplier.routes';
import customerRoutes from './customer.routes';
import workCenterRoutes from './work-center.routes';
import productRoutes from './product.routes';

const router = Router();

// Rotas de autenticação
router.use('/auth', authRoutes);

// Rotas de gestão de usuários e permissões
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);

// Rotas de audit logs
router.use('/audit-logs', auditLogRoutes);

// Rotas de cadastros básicos
router.use('/units-of-measure', unitOfMeasureRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/customers', customerRoutes);
router.use('/work-centers', workCenterRoutes);

// Rotas de produtos
router.use('/products', productRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
