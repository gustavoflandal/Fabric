import { prisma } from '../config/database';
import notificationService from './notification.service';
import { AGGREGATE_MOVEMENT_TYPES } from '../utils/stock-movement.util';
import { isModuleEnabled } from './licensed-module.service';
import { detectReplenishmentNeeds } from './replenishment.service';

/**
 * Service responsável por detectar eventos e criar notificações automaticamente
 *
 * F4.10 / seção 3.4 de `04_ARQUITETURA_MODULAR_LICENCIAMENTO.md` — NOTIFICAÇÃO
 * MÓDULO-AWARE. `checkReplenishmentNeeded()` é o PRIMEIRO detector de um evento
 * que só existe com um módulo opcional licenciado, e por isso é ele que
 * estabelece o padrão aqui:
 *
 *   1. categoria dedicada `WAREHOUSE` (nunca `STOCK` — ver a nota no método);
 *   2. `isModuleEnabled('WMS')` ANTES da consulta, não depois de gerar a
 *      notificação e descartar (fail-closed, mesma semântica de
 *      `requireModule`);
 *   3. `NotificationRule`/`NotificationPreference` continuam valendo por cima —
 *      a checagem de módulo é uma camada anterior, não um substituto.
 *
 * Os detectores que já existiam (produção, estoque, qualidade) NÃO ganharam
 * checagem de módulo: todos são do núcleo PCP, que está sempre habilitado, e
 * `requireModule('PCP')` é explicitamente algo que o projeto decidiu não fazer
 * em lugar nenhum.
 */
export class NotificationDetectorService {

  /**
   * Detectar ordens de produção atrasadas
   */
  async detectProductionDelays() {
    const now = new Date();

    const delayedOrders = await prisma.productionOrder.findMany({
      where: {
        status: { in: ['RELEASED', 'IN_PROGRESS'] },
        scheduledEnd: { lt: now },
      },
      include: {
        product: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    });

    for (const order of delayedOrders) {
      const delayDays = Math.ceil(
        (now.getTime() - new Date(order.scheduledEnd).getTime()) / (1000 * 60 * 60 * 24)
      );

      // Verificar se já foi notificado nas últimas 24h
      const alreadyNotified = await notificationService.checkRecentNotification(
        'PRODUCTION_DELAYED',
        order.id,
        24
      );

      if (!alreadyNotified) {
        // Buscar usuários que devem ser notificados (gerentes de produção)
        const recipients = await this.getUsersByRole('MANAGER');

        await notificationService.createBulk(
          recipients.map(u => u.id),
          {
            type: 'WARNING',
            category: 'PRODUCTION',
            eventType: 'PRODUCTION_DELAYED',
            title: 'Ordem de Produção Atrasada',
            message: `OP ${order.orderNumber} (${order.product.name}) está atrasada em ${delayDays} ${delayDays === 1 ? 'dia' : 'dias'}`,
            data: {
              orderNumber: order.orderNumber,
              productName: order.product.name,
              delayDays,
              scheduledEnd: order.scheduledEnd,
            },
            link: `/production/orders/${order.id}`,
            resourceType: 'ProductionOrder',
            resourceId: order.id,
            priority: 3, // Alta
          }
        );
      }
    }

    return delayedOrders.length;
  }

  /**
   * Detectar gargalos em centros de trabalho
   */
  async detectBottlenecks() {
    const threshold = 5; // Número de operações na fila que caracteriza gargalo

    const workCenters = await prisma.workCenter.findMany({
      where: { active: true },
      include: {
        productionOperations: {
          where: {
            status: { in: ['PENDING', 'IN_PROGRESS'] },
          },
          include: {
            productionOrder: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
      },
    });

    for (const wc of workCenters) {
      const queueSize = wc.productionOperations.length;

      if (queueSize >= threshold) {
        const alreadyNotified = await notificationService.checkRecentNotification(
          'BOTTLENECK_DETECTED',
          wc.id,
          6 // Notificar a cada 6 horas
        );

        if (!alreadyNotified) {
          const recipients = await this.getUsersByRole('MANAGER');

          await notificationService.createBulk(
            recipients.map(u => u.id),
            {
              type: 'WARNING',
              category: 'PRODUCTION',
              eventType: 'BOTTLENECK_DETECTED',
              title: 'Gargalo Detectado',
              message: `Centro de trabalho "${wc.name}" possui ${queueSize} operações na fila`,
              data: {
                workCenterId: wc.id,
                workCenterName: wc.name,
                queueSize,
                threshold,
                operations: wc.productionOperations.map(op => op.productionOrder.orderNumber),
              },
              link: `/work-centers/${wc.id}`,
              resourceType: 'WorkCenter',
              resourceId: wc.id,
              priority: 3, // Alta
            }
          );
        }
      }
    }
  }

  /**
   * Verificar disponibilidade de material para uma ordem
   */
  async checkMaterialAvailability(orderId: string) {
    const order = await prisma.productionOrder.findUnique({
      where: { id: orderId },
      include: {
        product: {
          include: {
            boms: {
              where: { active: true },
              include: {
                items: {
                  include: {
                    component: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!order || !order.product.boms[0]) {
      return;
    }

    const bom = order.product.boms[0];

    for (const bomItem of bom.items) {
      // Buscar estoque atual
      // F2.2: `TRANSFER` excluído — transferência interna não altera o saldo
      // do produto, e o reduce abaixo a trataria como saída.
      const stockMovements = await prisma.stockMovement.findMany({
        where: { productId: bomItem.componentId, type: { in: AGGREGATE_MOVEMENT_TYPES } },
        select: { quantity: true, type: true },
      });

      const currentStock = stockMovements.reduce((acc, mov) => {
        return mov.type === 'IN' ? acc + mov.quantity : acc - mov.quantity;
      }, 0);

      const required = bomItem.quantity * order.quantity;

      if (currentStock < required) {
        // Fix (01/09/2026): 'BUYER' nunca existiu como perfil no sistema (só
        // ADMIN/MANAGER/OPERATOR são seedados) - a busca sempre retornava
        // vazio e a notificação não chegava a ninguém além de MANAGER.
        const recipients = await this.getUsersByRole('MANAGER');

        await notificationService.createBulk(
          recipients.map(u => u.id),
          {
            type: 'ERROR',
            category: 'PRODUCTION',
            eventType: 'MATERIAL_UNAVAILABLE',
            title: 'Material Indisponível',
            message: `Material "${bomItem.component.name}" insuficiente para OP ${order.orderNumber}. Necessário: ${required}, Disponível: ${currentStock}`,
            data: {
              orderNumber: order.orderNumber,
              materialCode: bomItem.component.code,
              materialName: bomItem.component.name,
              required,
              available: currentStock,
              shortage: required - currentStock,
            },
            link: `/production/orders/${order.id}`,
            resourceType: 'ProductionOrder',
            resourceId: order.id,
            priority: 4, // Crítica
          }
        );
      }
    }
  }

  /**
   * Monitorar taxa de refugo em apontamento
   */
  async monitorScrapRate(pointingId: string) {
    const pointing = await prisma.productionPointing.findUnique({
      where: { id: pointingId },
      include: {
        operation: {
          include: {
            productionOrder: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!pointing || pointing.quantityGood === 0) {
      return;
    }

    const scrapRate = (pointing.quantityScrap / (pointing.quantityGood + pointing.quantityScrap)) * 100;
    const maxScrapRate = 5; // 5% - Configurável

    if (scrapRate > maxScrapRate) {
      // Fix (01/09/2026): 'QUALITY_MANAGER' nunca existiu como perfil no
      // sistema - a busca sempre retornava vazio. Notifica MANAGER + o
      // operador que registrou o apontamento; dedupe por id caso o operador
      // também tenha o perfil MANAGER.
      const productionManagers = await this.getUsersByRole('MANAGER');
      const recipients = Array.from(
        new Map([...productionManagers, pointing.user].map((u) => [u.id, u])).values()
      );

      await notificationService.createBulk(
        recipients.map(u => u.id),
        {
          type: 'ERROR',
          category: 'QUALITY',
          eventType: 'QUALITY_SCRAP_HIGH',
          title: 'Taxa de Refugo Crítica',
          message: `Apontamento da OP ${pointing.operation.productionOrder.orderNumber} registrou ${scrapRate.toFixed(1)}% de refugo (limite: ${maxScrapRate}%)`,
          data: {
            orderNumber: pointing.operation.productionOrder.orderNumber,
            operationName: pointing.operation.description,
            scrapRate: scrapRate.toFixed(2),
            maxScrapRate,
            scrapQty: pointing.quantityScrap,
            goodQty: pointing.quantityGood,
            operatorName: pointing.user.name,
          },
          link: `/production/orders/${pointing.operation.productionOrderId}`,
          resourceType: 'ProductionPointing',
          resourceId: pointing.id,
          priority: 4, // Crítica
        }
      );
    }
  }

  /**
   * Verificar estoque abaixo do mínimo
   */
  async checkLowStock() {
    const products = await prisma.product.findMany({
      where: {
        active: true,
        minStock: { gt: 0 },
      },
      select: {
        id: true,
        code: true,
        name: true,
        minStock: true,
        unit: {
          select: {
            symbol: true,
          },
        },
      },
    });

    for (const product of products) {
      // Calcular estoque atual
      // F2.2: `TRANSFER` excluído — ver a nota equivalente acima.
      const stockMovements = await prisma.stockMovement.findMany({
        where: { productId: product.id, type: { in: AGGREGATE_MOVEMENT_TYPES } },
        select: { quantity: true, type: true },
      });

      const currentStock = stockMovements.reduce((acc, mov) => {
        return mov.type === 'IN' ? acc + mov.quantity : acc - mov.quantity;
      }, 0);

      if (currentStock <= product.minStock) {
        const alreadyNotified = await notificationService.checkRecentNotification(
          'STOCK_BELOW_SAFETY',
          product.id,
          24
        );

        if (!alreadyNotified) {
          // Fix (01/09/2026): 'BUYER' e 'STOCK_MANAGER' nunca existiram como
          // perfil no sistema - a busca sempre retornava vazio e esta era a
          // única notificação crítica do sistema sem nenhum destinatário real.
          const recipients = await this.getUsersByRole('MANAGER');

          const priority = currentStock === 0 ? 4 : 3; // Crítico se zerado, alto se baixo

          await notificationService.createBulk(
            recipients.map(u => u.id),
            {
              type: currentStock === 0 ? 'ERROR' : 'WARNING',
              category: 'STOCK',
              eventType: 'STOCK_BELOW_SAFETY',
              title: currentStock === 0 ? 'Estoque Zerado' : 'Estoque Abaixo do Mínimo',
              message: `${product.name}: ${currentStock} ${product.unit.symbol} (mínimo: ${product.minStock} ${product.unit.symbol})`,
              data: {
                productCode: product.code,
                productName: product.name,
                currentStock,
                minStock: product.minStock,
                unit: product.unit.symbol,
              },
              link: `/stock/products/${product.id}`,
              resourceType: 'Product',
              resourceId: product.id,
              priority,
            }
          );
        }
      }
    }
  }

  /**
   * F4.10 — REPOSIÇÃO NECESSÁRIA (primeiro detector WMS-only do sistema).
   *
   * `isModuleEnabled('WMS')` é a PRIMEIRA linha, antes de qualquer consulta:
   * uma instalação só-PCP não tem posição de picking, não teria o que
   * encontrar, e não deve gastar uma varredura de `stock_position_balances`
   * para descobrir isso a cada 30 minutos.
   *
   * CATEGORIA `WAREHOUSE`, NÃO `STOCK` — a seção 3.4 do documento de
   * licenciamento pede isso, e o motivo prático aparece do lado do usuário:
   * `NotificationPreference` é POR CATEGORIA. Enfiar reposição em `STOCK`
   * obrigaria o comprador que quer alerta de estoque baixo a receber também
   * tarefa de armazém, e o operador de armazém que só quer reposição a receber
   * o alerta de compras. São públicos diferentes; categoria é justamente o
   * mecanismo que os separa.
   *
   * DEDUPE EM DUAS CAMADAS, uma por natureza de problema:
   *   * a TAREFA é deduplicada em `replenishment.service.ts` (não cria uma nova
   *     enquanto houver reposição aberta para o mesmo produto/posição);
   *   * a NOTIFICAÇÃO é deduplicada por `checkRecentNotification` em 6h, o mesmo
   *     intervalo de `BOTTLENECK_DETECTED` — reposição é operacional e urgente,
   *     as 24h do estoque baixo deixariam o supervisor sem aviso durante um
   *     turno inteiro.
   *
   * Notifica MANAGER: é o mesmo público de todos os outros detectores, e o
   * projeto já registrou (correções de 01/09/2026) que inventar `roleCode` que
   * não existe no seed produz notificação sem nenhum destinatário. Um perfil
   * `WAREHOUSE_SUPERVISOR` seria o alvo certo no dia em que existir — e o
   * operador que vai executar já é alcançado pelo caminho que importa, a
   * própria tarefa aparecendo em `GET /warehouse-tasks/my`.
   */
  async checkReplenishmentNeeded() {
    if (!(await isModuleEnabled('WMS'))) {
      return [];
    }

    const needs = await detectReplenishmentNeeds();

    if (needs.length === 0) {
      return needs;
    }

    const recipients = await this.getUsersByRole('MANAGER');

    if (recipients.length === 0) {
      return needs;
    }

    for (const need of needs) {
      // Reposição já pendente não é notícia nova: a notificação anterior segue
      // válida e o supervisor já sabe.
      if (need.status === 'TASK_ALREADY_OPEN') {
        continue;
      }

      const alreadyNotified = await notificationService.checkRecentNotification(
        'REPLENISHMENT_NEEDED',
        need.pickingPositionId,
        6
      );

      if (alreadyNotified) {
        continue;
      }

      // `NO_SOURCE` é mais grave que a reposição normal: não há material no
      // armazém para repor, então nem tarefa foi gerada. Sai como ERROR e
      // prioridade crítica, com mensagem diferente — é o supervisor que precisa
      // agir (comprar, transferir de outro armazém), não o operador.
      const noSource = need.status === 'NO_SOURCE';

      await notificationService.createBulk(
        recipients.map((u) => u.id),
        {
          type: noSource ? 'ERROR' : 'WARNING',
          category: 'WAREHOUSE',
          eventType: 'REPLENISHMENT_NEEDED',
          title: noSource
            ? 'Reposição sem material no pulmão'
            : 'Reposição de área de picking necessária',
          message: noSource
            ? `${need.productName} na posição ${need.pickingPositionCode}: ` +
              `${need.currentQuantity} (mínimo ${need.threshold}) e nenhum saldo no pulmão para repor`
            : `${need.productName} na posição ${need.pickingPositionCode}: ` +
              `${need.currentQuantity} (mínimo ${need.threshold}). ` +
              `Tarefa de reposição gerada a partir de ${need.sourcePositionCode}`,
          data: {
            productCode: need.productCode,
            productName: need.productName,
            pickingPosition: need.pickingPositionCode,
            currentQuantity: need.currentQuantity,
            threshold: need.threshold,
            sourcePosition: need.sourcePositionCode,
            quantity: need.quantity,
            taskId: need.taskId,
          },
          link: `/wms/storage-positions/${need.pickingPositionId}`,
          resourceType: 'StoragePosition',
          resourceId: need.pickingPositionId,
          priority: noSource ? 4 : 3,
        }
      );
    }

    return needs;
  }

  /**
   * Notificar conclusão de operação
   */
  async notifyOperationCompleted(pointingId: string) {
    const pointing = await prisma.productionPointing.findUnique({
      where: { id: pointingId },
      include: {
        operation: {
          include: {
            productionOrder: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!pointing) {
      return;
    }

    // Notificar gerente de produção
    const managers = await this.getUsersByRole('MANAGER');

    await notificationService.createBulk(
      managers.map(u => u.id),
      {
        type: 'SUCCESS',
        category: 'PRODUCTION',
        eventType: 'OPERATION_COMPLETED',
        title: 'Operação Concluída',
        message: `${pointing.user.name} concluiu operação da OP ${pointing.operation.productionOrder.orderNumber}`,
        data: {
          orderNumber: pointing.operation.productionOrder.orderNumber,
          operationName: pointing.operation.description,
          operatorName: pointing.user.name,
          goodQty: pointing.quantityGood,
          scrapQty: pointing.quantityScrap,
        },
        link: `/production/orders/${pointing.operation.productionOrderId}`,
        resourceType: 'ProductionPointing',
        resourceId: pointing.id,
        priority: 2, // Média
      }
    );
  }

  /**
   * Helper: Buscar usuários por role code
   */
  private async getUsersByRole(roleCode: string) {
    const users = await prisma.user.findMany({
      where: {
        active: true,
        roles: {
          some: {
            role: {
              code: roleCode,
              active: true,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return users;
  }
}

export default new NotificationDetectorService();
