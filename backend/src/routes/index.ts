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
import pcpDashboardRoutes from './pcp-dashboard.routes';
import mrpRoutes from './mrp.routes';
import stockRoutes from './stock.routes';
import reportsRoutes from './reports.routes';
import purchaseQuotationRoutes from './purchase-quotation.routes';
import purchaseOrderRoutes from './purchase-order.routes';
import purchaseReceiptRoutes from './purchase-receipt.routes';
import notificationRoutes from './notification.routes';
import countingRoutes from './counting.routes';
import warehouseRoutes from './warehouse.routes';
import warehouseStructureRoutes from './warehouse-structure.routes';
import storagePositionRoutes from './storage-position.routes';
import systemRoutes from './system.routes';
import { requireModule } from '../middleware/module.middleware';

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

// ============================================
// MÓDULO WMS (licenciável por instalação)
// ============================================
// F0.8 do plano do WMS / seção 3.1 de 04_ARQUITETURA_MODULAR_LICENCIAMENTO.md:
// `requireModule('WMS')` no ponto de montagem bloqueia (404) a superfície
// inteira do módulo com uma linha por montagem, em vez de checagem espalhada
// rota a rota - e qualquer rota nova de armazém já nasce protegida.
//
// A ordem efetiva por requisição é: authMiddleware (aplicado DENTRO de cada
// arquivo de rota) -> requireModule -> requirePermission. O middleware de
// módulo não depende do usuário, só da instalação, então rodar antes ou depois
// do auth é indiferente para a decisão; o que importa é ficar antes do RBAC.
//
// `PCP` NÃO recebe requireModule em lugar nenhum: é o núcleo, sempre
// habilitado - checá-lo seria custo por requisição sem benefício e risco de
// travar o sistema inteiro por um erro de configuração.
router.use('/warehouses', requireModule('WMS'), warehouseRoutes);
router.use('/warehouse-structures', requireModule('WMS'), warehouseStructureRoutes);
router.use('/storage-positions', requireModule('WMS'), storagePositionRoutes);

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
router.use('/pcp/dashboard', pcpDashboardRoutes);

// Rotas de MRP, Estoque e Relatórios
router.use('/mrp', mrpRoutes);
router.use('/stock', stockRoutes);
router.use('/reports', reportsRoutes);

// Rotas de compras
router.use('/purchase-quotations', purchaseQuotationRoutes);
router.use('/purchase-orders', purchaseOrderRoutes);
router.use('/purchase-receipts', purchaseReceiptRoutes);

// Rotas de notificações
router.use('/notifications', notificationRoutes);

// Rotas de contagem de estoque
router.use('/counting', countingRoutes);

// Rotas de sistema (F0.8: quais módulos esta instalação tem licenciados)
router.use('/system', systemRoutes);

// Health check
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
