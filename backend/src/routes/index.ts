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
import stockPositionRoutes from './stock-position.routes';
import warehouseTaskRoutes from './warehouse-task.routes';
import storageRuleRoutes from './storage-rule.routes';
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
// F1.3/F1.4: saldo por posição. Montado sob o mesmo requireModule('WMS') que o
// resto do armazém — saber ONDE o material está só faz sentido para quem
// licenciou o WMS. Uma instalação só-PCP continua usando `/stock/*`, que não é
// tocado por esta fase.
router.use('/stock-positions', requireModule('WMS'), stockPositionRoutes);
// F4.3/F4.5: tarefas de armazém. Mesmo requireModule('WMS') — a orientação a
// tarefa É o módulo WMS (seção 3.3 de 04_ARQUITETURA_MODULAR_LICENCIAMENTO.md).
// Sem WMS licenciado estas rotas não existem (404) e o recebimento segue
// linear, sem gerar tarefa nenhuma. Não recebe requireModule('COMPRAS') junto:
// a dependência entre os módulos já é respeitada pela ausência da rota que
// dispararia o processo (seção 3.5), e o resto da superfície de tarefa (PICKING
// na Fase 4b) não depende de compras.
router.use('/warehouse-tasks', requireModule('WMS'), warehouseTaskRoutes);
// F4.6: regras de armazenagem e sugestão de endereço. Mesmo requireModule('WMS')
// — uma regra sobre QUAL endereço usar não significa nada sem endereço.
router.use('/storage-rules', requireModule('WMS'), storageRuleRoutes);

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

// ============================================
// MÓDULO COMPRAS (licenciável por instalação)
// ============================================
// Decisão de 02/09/2026 (04_ARQUITETURA_MODULAR_LICENCIAMENTO.md, seção 3.5):
// compras é módulo próprio, não núcleo PCP — um cliente pode ter produção sem
// gestão formal de compra. Mesmo padrão de requireModule('WMS') acima.
router.use('/purchase-quotations', requireModule('COMPRAS'), purchaseQuotationRoutes);
router.use('/purchase-orders', requireModule('COMPRAS'), purchaseOrderRoutes);
router.use('/purchase-receipts', requireModule('COMPRAS'), purchaseReceiptRoutes);

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
