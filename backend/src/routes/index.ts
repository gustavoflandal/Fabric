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
import productCategoryRoutes from './product-category.routes';
import bomRoutes from './bom.routes';
import routingRoutes from './routing.routes';
import productionOrderRoutes from './production-order.routes';
import productionPointingRoutes from './production-pointing.routes';
import dashboardRoutes from './dashboard.routes';
import mrpRoutes from './mrp.routes';
import stockRoutes from './stock.routes';
import reportsRoutes from './reports.routes';

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
router.use('/product-categories', productCategoryRoutes);
router.use('/boms', bomRoutes);
router.use('/routings', routingRoutes);

// Rotas de produção
router.use('/production-orders', productionOrderRoutes);
router.use('/production-pointings', productionPointingRoutes);

// Rotas de dashboard
router.use('/dashboard', dashboardRoutes);

// Rotas de MRP, Estoque e Relatórios
router.use('/mrp', mrpRoutes);
router.use('/stock', stockRoutes);
router.use('/reports', reportsRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
