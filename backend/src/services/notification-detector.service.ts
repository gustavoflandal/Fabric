import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { config } from '../config/env';
import notificationService from './notification.service';
import { isModuleEnabled } from './licensed-module.service';
import { detectReplenishmentNeeds } from './replenishment.service';

/**
 * Um lote com validade próxima (ou já vencida) e saldo parado em alguma posição.
 * Devolvido por `checkExpiringLots()` para o job poder logar sem reconsultar.
 */
export interface LotExpiryFinding {
  lotId: string;
  lotNumber: string;
  productId: string;
  productCode: string;
  productName: string;
  expiresAt: Date;
  /** Dias INTEIROS até vencer (`EXPIRING_SOON`) ou desde que venceu (`EXPIRED`). */
  days: number;
  /** Soma do saldo do lote em todas as posições, como string (Decimal). */
  totalQuantity: string;
  positions: { positionId: string; positionCode: string; quantity: string }[];
  status: 'EXPIRING_SOON' | 'EXPIRED';
  /** `false` quando o dedupe de 24h barrou a notificação nesta execução. */
  notified: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Janela de dedupe dos dois eventos de validade. Ver a nota extensa em
 * `checkExpiringLots()` sobre por que 24h (e não as 6h da reposição), e sobre a
 * chave ser (eventType, lotId) e não só o lote.
 */
const LOT_EXPIRY_DEDUPE_HOURS = 24;

/** Endereços mostrados na MENSAGEM; a lista completa vai sempre em `data`. */
const MAX_POSITIONS_IN_MESSAGE = 3;

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
   * CAPACITY_LOW — centro de trabalho produzindo MUITO ABAIXO do esperado.
   *
   * É o oposto de `detectBottlenecks()`: lá o sintoma é fila grande, aqui é
   * saída pequena. Até esta implementação o evento `CAPACITY_LOW` estava
   * documentado mas não existia em lugar nenhum do código — o cron de 2h só
   * logava "não implementado ainda".
   *
   * DECISÕES (todas ajustáveis nas constantes abaixo):
   *
   *   * JANELA DE 8 HORAS — um turno. O cron roda de 2 em 2 horas, então as
   *     janelas se sobrepõem: uma parada real continua sendo detectada na
   *     próxima passada, mas um buraco de 30 minutos (troca de ferramenta,
   *     almoço) se dilui em 8h em vez de virar alarme. Janela de 2h, colada no
   *     período do cron, alarmaria a cada intervalo normal de setup.
   *   * LIMIAR DE 50% — só dispara em desvio grande. Capacidade cadastrada é
   *     nominal e quase sempre otimista; alarmar em 80% ou 90% produziria
   *     notificação constante em operação saudável, e uma notificação que toca
   *     sempre é uma que ninguém lê.
   *   * `capacity` NULO NÃO GERA EVENTO — sem expectativa cadastrada não há
   *     contra o que comparar. É o default do schema (`Float?`), então centro
   *     não parametrizado fica silencioso em vez de gerar ruído.
   *   * SÓ CENTRO COM DEMANDA. Exige ao menos uma operação `PENDING`/
   *     `IN_PROGRESS`. Um centro parado por não ter o que fazer não está
   *     "abaixo da capacidade", está ocioso — e avisar o gestor de que um
   *     centro sem trabalho não produziu nada é ruído garantido. Com fila e sem
   *     saída é justamente o caso que interessa (quebra, falta de operador,
   *     falta de material).
   *   * EXPECTATIVA = `capacity × efficiency × horas`. `efficiency` (default
   *     1.0) já existe no schema como fator de rendimento do centro; ignorá-lo
   *     compararia a produção real contra uma meta que o próprio cadastro diz
   *     não ser alcançável. Assume `capacity` em UNIDADES/HORA, que é como
   *     `costPerHour`/`efficiency` tratam o centro no resto do modelo.
   *   * DEDUPE DE 6H, o mesmo de `BOTTLENECK_DETECTED` — são o mesmo público
   *     (gestor de produção) e a mesma natureza de problema (capacidade).
   *
   * Prioridade 2 (média) e categoria `CAPACITY`, como o documento do módulo já
   * previa para este evento. Destinatários: `MANAGER`, o mesmo padrão dos
   * outros detectores de produção.
   */
  async detectLowCapacity() {
    const WINDOW_HOURS = 8;
    const THRESHOLD_RATIO = 0.5;

    const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);

    const workCenters = await prisma.workCenter.findMany({
      where: {
        active: true,
        capacity: { not: null },
        // Só centros COM demanda — ver nota acima.
        productionOperations: {
          some: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        },
      },
      select: { id: true, name: true, capacity: true, efficiency: true },
    });

    if (workCenters.length === 0) {
      return 0;
    }

    // Produção real do período, em UMA consulta agregada (não uma por centro).
    // `endTime` e não `createdAt`: o que importa é o trabalho concluído dentro
    // da janela.
    const produced = await prisma.productionPointing.groupBy({
      by: ['workCenterId'],
      where: {
        workCenterId: { in: workCenters.map((wc) => wc.id) },
        endTime: { gte: since },
      },
      _sum: { quantityGood: true },
    });

    const producedByCenter = new Map(
      produced.map((row) => [row.workCenterId, row._sum.quantityGood || 0])
    );

    let detected = 0;

    for (const wc of workCenters) {
      const expected = (wc.capacity as number) * wc.efficiency * WINDOW_HOURS;

      // Capacidade cadastrada como 0 (ou negativa) não é expectativa válida —
      // qualquer produção seria "acima", e 0 < 0 nunca dispara. Sai fora para
      // não depender de aritmética com zero.
      if (expected <= 0) {
        continue;
      }

      const actual = producedByCenter.get(wc.id) || 0;

      if (actual >= expected * THRESHOLD_RATIO) {
        continue;
      }

      detected += 1;

      const alreadyNotified = await notificationService.checkRecentNotification(
        'CAPACITY_LOW',
        wc.id,
        6
      );

      if (alreadyNotified) {
        continue;
      }

      const recipients = await this.getUsersByRole('MANAGER');

      if (recipients.length === 0) {
        continue;
      }

      const utilization = (actual / expected) * 100;

      await notificationService.createBulk(
        recipients.map((u) => u.id),
        {
          type: 'WARNING',
          category: 'CAPACITY',
          eventType: 'CAPACITY_LOW',
          title: 'Capacidade Ociosa',
          message:
            `Centro de trabalho "${wc.name}" produziu ${actual} nas últimas ${WINDOW_HOURS}h ` +
            `(esperado ~${expected.toFixed(0)}, ${utilization.toFixed(0)}% da capacidade) ` +
            `mesmo com operações na fila`,
          data: {
            workCenterId: wc.id,
            workCenterName: wc.name,
            windowHours: WINDOW_HOURS,
            capacity: wc.capacity,
            efficiency: wc.efficiency,
            expected,
            actual,
            utilizationPercent: Number(utilization.toFixed(2)),
            thresholdPercent: THRESHOLD_RATIO * 100,
          },
          link: `/work-centers/${wc.id}`,
          resourceType: 'WorkCenter',
          resourceId: wc.id,
          priority: 2, // Média
        }
      );
    }

    return detected;
  }

  /**
   * Resumo diário (cron das 8h, que até aqui só logava "não implementado").
   *
   * FORMATO ESCOLHIDO: uma notificação `INFO` por gestor, com a CONTAGEM de
   * notificações de prioridade alta (3) e crítica (4) que ele recebeu no DIA
   * ANTERIOR (dia civil completo, 00:00–23:59) e que continuam NÃO LIDAS.
   *
   *   * Dia civil anterior, e não "desde o último resumo": rodando às 8h, é o
   *     recorte que o gestor consegue interpretar sem pensar ("ontem"), e não
   *     depende de guardar estado de quando o job rodou pela última vez.
   *   * Só NÃO LIDAS: o objetivo é resgatar o que passou batido. Contar o que o
   *     gestor já leu e tratou transformaria o resumo num relatório de volume,
   *     que não é o que ele precisa às 8 da manhã.
   *   * Só prioridade >= 3: mesmo corte de `getCriticalUnread()`, o que o resto
   *     do módulo já trata como "merece atenção".
   *   * SEM PENDÊNCIA, SEM NOTIFICAÇÃO. Zero crítica e zero alta não gera nada
   *     — um resumo diário que chega todo dia dizendo "nada a relatar" treina o
   *     usuário a ignorar a categoria inteira.
   *   * Prioridade 1 e `INFO`: é um dígest, não um alerta; não deve competir no
   *     topo da lista com os eventos que ele resume.
   *   * Categoria `PRODUCTION`: o resumo não tem categoria própria e o conjunto
   *     de categorias é fechado (`CreateNotificationDto`), consumido por
   *     `NotificationPreference`. Inventar `SYSTEM` aqui criaria uma categoria
   *     que nenhuma preferência, seed ou tela conhece; `PRODUCTION` é a
   *     categoria majoritária dos eventos resumidos e a que o público-alvo
   *     (MANAGER) já acompanha.
   *
   * Não é um relatório de BI — é o job deixando de ser no-op.
   */
  async sendDailySummary() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const managers = await this.getUsersByRole('MANAGER');

    if (managers.length === 0) {
      return 0;
    }

    // Uma consulta agregada para todos os gestores, em vez de duas por gestor.
    const grouped = await prisma.notification.groupBy({
      by: ['userId', 'priority'],
      where: {
        userId: { in: managers.map((u) => u.id) },
        read: false,
        archived: false,
        priority: { gte: 3 },
        createdAt: { gte: startOfYesterday, lt: startOfToday },
      },
      _count: { _all: true },
    });

    const dateLabel = startOfYesterday.toLocaleDateString('pt-BR');
    let sent = 0;

    for (const manager of managers) {
      const rows = grouped.filter((row) => row.userId === manager.id);
      const critical = rows.find((r) => r.priority === 4)?._count._all || 0;
      const high = rows.find((r) => r.priority === 3)?._count._all || 0;

      if (critical === 0 && high === 0) {
        continue;
      }

      // Dedupe por usuário: `resourceId` é o id do gestor, então um reinício do
      // processo no mesmo dia não gera um segundo resumo para a mesma pessoa.
      const alreadySent = await notificationService.checkRecentNotification(
        'DAILY_SUMMARY',
        manager.id,
        20
      );

      if (alreadySent) {
        continue;
      }

      const parts: string[] = [];
      if (critical > 0) {
        parts.push(`${critical} ${critical === 1 ? 'crítica' : 'críticas'}`);
      }
      if (high > 0) {
        parts.push(`${high} de prioridade alta`);
      }

      await notificationService.create({
        userId: manager.id,
        type: 'INFO',
        category: 'PRODUCTION',
        eventType: 'DAILY_SUMMARY',
        title: `Resumo de ${dateLabel}`,
        message:
          `Você tem ${parts.join(' e ')} ${critical + high === 1 ? 'notificação não lida' : 'notificações não lidas'} de ${dateLabel}.`,
        data: {
          date: startOfYesterday.toISOString().split('T')[0],
          criticalUnread: critical,
          highUnread: high,
          totalUnread: critical + high,
        },
        link: '/notifications',
        resourceType: 'User',
        resourceId: manager.id,
        priority: 1,
      });

      sent += 1;
    }

    return sent;
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

    // Saldo lido de `stock_balances` (a linha por produto que
    // `stock.service.ts::applyMovement()` mantém dentro da mesma transação da
    // movimentação, desde a Fase 1 do cronograma de modernização) em vez de
    // ressomar `stock_movements` do zero a cada verificação.
    //
    // Por que a leitura é EM LOTE e não `stockService.getBalance()` por item:
    // `getBalance()` faz 3 consultas por produto (produto + saldo + última
    // movimentação), monta limiares/status que este detector não usa, e ainda
    // faz um `upsert` — ou seja, um caminho de LEITURA passaria a ESCREVER
    // linha de saldo para todo componente de BOM que nunca movimentou. Aqui é
    // uma consulta só para a BOM inteira.
    //
    // Produto sem linha em `stock_balances` é lido como 0, exatamente o que a
    // soma anterior produzia para um produto sem nenhuma movimentação — e o
    // mesmo default que `getAllBalances()` já adota no caminho de leitura.
    const componentIds = bom.items.map((item) => item.componentId);
    const balanceRows = await prisma.stockBalance.findMany({
      where: { productId: { in: componentIds } },
      select: { productId: true, quantity: true },
    });
    const balanceByProduct = new Map(balanceRows.map((row) => [row.productId, row.quantity]));

    for (const bomItem of bom.items) {
      const currentStock = balanceByProduct.get(bomItem.componentId) ?? 0;

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

    // Mesma correção de `checkMaterialAvailability()` acima, e aqui ela pesa
    // mais: este método roda no cron de 15 em 15 minutos e ressomava o
    // histórico INTEIRO de `stock_movements` de CADA produto ativo — uma
    // varredura por produto, crescendo sem limite conforme o histórico cresce.
    // Agora é uma consulta só, independentemente do número de produtos.
    const balanceRows = await prisma.stockBalance.findMany({
      where: { productId: { in: products.map((p) => p.id) } },
      select: { productId: true, quantity: true },
    });
    const balanceByProduct = new Map(balanceRows.map((row) => [row.productId, row.quantity]));

    for (const product of products) {
      const currentStock = balanceByProduct.get(product.id) ?? 0;

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
   * FASE 5 (complemento) — VALIDADE DE LOTE. Dois eventos, um detector.
   *
   *   * `LOT_EXPIRING_SOON` — `Lot.expiresAt` dentro da janela de antecedência
   *     (`config.wms.lotExpiryAlertDays`, default 7 dias) e o lote ainda com
   *     saldo em alguma posição. `WARNING`, prioridade 3.
   *   * `LOT_EXPIRED` — `expiresAt` no passado e o lote AINDA com saldo.
   *     `ERROR`, prioridade 4.
   *
   * POR QUE ESTE DETECTOR EXISTE, dado que a Fase 5 já bloqueia a saída de lote
   * vencido (`stock.service.ts::assertLotNotExpiredForOutbound()`): aquele
   * bloqueio é o "depois". Ele impede que material vencido saia, mas não impede
   * que ele CONTINUE ALI — o FEFO deixa de escolhê-lo, o picking recusa, e o
   * lote simplesmente some do fluxo, ocupando um endereço, contando no saldo
   * agregado e sem ninguém ser avisado, até alguém tropeçar nele numa contagem.
   * Só o `ADJUSTMENT` de baixa resolve, e o `ADJUSTMENT` só acontece se alguém
   * souber. Este detector é quem conta.
   *
   * "AINDA COM SALDO" É A CONDIÇÃO QUE DEFINE OS DOIS EVENTOS. Lote sem saldo em
   * posição nenhuma já foi consumido, expedido ou baixado — ele continua na
   * tabela porque é rastreabilidade histórica (`Restrict` nas FKs justamente
   * para isso), e alertar sobre a validade de um lote que não existe mais no
   * armazém é ruído garantido, crescente e permanente: a cada dia que passa a
   * base tem mais lotes vencidos que já foram tratados.
   *
   * PRIORIDADE 3 PARA O "VAI VENCER", e não 2. O critério que o resto do sistema
   * já usa: prioridade 2 é diagnóstico (`CAPACITY_LOW` — nada se perde se ficar
   * dias sem leitura), prioridade 3 é prazo com consequência
   * (`STOCK_BELOW_SAFETY`, `PRODUCTION_DELAYED`, `REPLENISHMENT_NEEDED`). Lote a
   * vencer é a forma mais dura de prazo que existe aqui: a janela é curta, não
   * renovável, e o custo de perdê-la é a perda física do material. Fica no mesmo
   * degrau de `STOCK_BELOW_SAFETY` — os dois dizem "aja nos próximos dias ou vai
   * faltar material", um por falta, outro por vencimento.
   *
   * PRIORIDADE 4 PARA O "JÁ VENCEU": é o mesmo degrau de `MATERIAL_UNAVAILABLE`
   * e do `NO_SOURCE` da reposição, e pelo mesmo motivo — não é mais um aviso
   * sobre o futuro, é um estado errado do armazém agora. O saldo já é
   * inutilizável, já está preso num endereço que outra coisa poderia ocupar, e o
   * agregado (`stock_balances`) ainda o conta como se fosse material disponível
   * para o MRP.
   *
   * DEDUPE DE 24H, POR EVENTO. As 6h de `REPLENISHMENT_NEEDED` existem porque
   * reposição muda dentro de um turno; validade não muda em uma hora nem em
   * seis. 24h é o mesmo intervalo de `STOCK_BELOW_SAFETY` e é o que casa com a
   * periodicidade diária do job: uma execução, uma notificação por lote.
   *
   *   ⚠️ A chave do dedupe é (eventType, lotId), então os DOIS eventos são
   *   deduplicados independentemente. Isso é o que garante que a virada de
   *   `EXPIRING_SOON` para `EXPIRED` seja notificada: o alerta crítico do dia do
   *   vencimento não é suprimido pelo aviso de véspera do dia anterior. Uma
   *   chave só por lote engoliria justamente a notificação que mais importa.
   *
   * SEM SERVICE SEPARADO (diferente de F4.10, que tem
   * `replenishment.service.ts`): a reposição CRIA tarefa — tem regra de negócio,
   * escrita e dedupe próprios, e é chamável de fora da notificação. Isto aqui é
   * leitura pura: uma consulta e duas mensagens. Um service só para embrulhar um
   * `findMany` seria uma camada sem conteúdo.
   *
   * Posição BLOQUEADA não é filtrada, ao contrário de F4.10. Lá o filtro existe
   * porque a tarefa gerada precisa ser executável; aqui não se gera tarefa, e
   * lote vencido numa posição bloqueada continua sendo exatamente o problema que
   * o evento descreve — estoque morto ocupando endereço.
   */
  async checkExpiringLots(): Promise<LotExpiryFinding[]> {
    // Fail-closed ANTES da consulta, como em `checkReplenishmentNeeded()`: sem
    // WMS licenciado não há recebimento endereçado, logo `Lot` não é populado
    // por nenhum caminho real e a varredura só encontraria vazio.
    if (!(await isModuleEnabled('WMS'))) {
      return [];
    }

    const now = new Date();
    const horizon = new Date(
      now.getTime() + config.wms.lotExpiryAlertDays * MS_PER_DAY
    );

    const lots = await prisma.lot.findMany({
      where: {
        // UMA consulta para os dois eventos: tudo que vence antes do horizonte
        // inclui o que já venceu. A separação é feita em memória comparando com
        // `now`, sem uma segunda ida ao banco.
        //
        // Lote SEM validade (`expiresAt: null`) sai por semântica de SQL —
        // NULL não satisfaz `<`. É o comportamento certo e não um efeito
        // colateral: sem data não há vencimento a prever nem a constatar, e o
        // schema deixa a coluna nula de propósito (nem todo lote tem validade).
        expiresAt: { lt: horizon },
        positionBalances: { some: { quantity: { gt: 0 } } },
      },
      select: {
        id: true,
        lotNumber: true,
        expiresAt: true,
        productId: true,
        product: { select: { code: true, name: true } },
        positionBalances: {
          // O MESMO filtro do `some` acima: sem ele, um lote que tem saldo numa
          // posição e linha zerada em outras traria as zeradas junto e a
          // notificação apontaria endereços onde não há nada para tratar.
          where: { quantity: { gt: 0 } },
          select: {
            quantity: true,
            storagePosition: { select: { id: true, code: true } },
          },
        },
      },
      // O mais urgente primeiro — é a ordem em que o log do job sai e em que as
      // notificações são criadas.
      orderBy: { expiresAt: 'asc' },
    });

    if (lots.length === 0) {
      return [];
    }

    const recipients = await this.getUsersByRole('MANAGER');

    const findings: LotExpiryFinding[] = [];

    for (const lot of lots) {
      // Não-nulo garantido pelo filtro `lt` da consulta (NULL não passa por
      // ele); o `as` só informa isso ao TypeScript, que lê a coluna como
      // `Date | null` pelo schema.
      const expiresAt = lot.expiresAt as Date;
      const expired = expiresAt.getTime() < now.getTime();

      const positions = lot.positionBalances.map((balance) => ({
        positionId: balance.storagePosition.id,
        positionCode: balance.storagePosition.code,
        quantity: balance.quantity.toString(),
      }));

      const totalQuantity = lot.positionBalances
        .reduce((sum, balance) => sum.plus(balance.quantity), new Prisma.Decimal(0))
        .toString();

      // Vencido conta dias INTEIROS decorridos (`floor`) — "venceu hoje" é a
      // resposta honesta para o lote que virou há três horas. A vencer arredonda
      // para CIMA (`ceil`): faltando 6 horas, "vence em 1 dia" é o que o
      // supervisor precisa ler, não "em 0 dias".
      const diffMs = expired ? now.getTime() - expiresAt.getTime() : expiresAt.getTime() - now.getTime();
      const days = expired ? Math.floor(diffMs / MS_PER_DAY) : Math.ceil(diffMs / MS_PER_DAY);

      const finding: LotExpiryFinding = {
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        productId: lot.productId,
        productCode: lot.product.code,
        productName: lot.product.name,
        expiresAt,
        days,
        totalQuantity,
        positions,
        status: expired ? 'EXPIRED' : 'EXPIRING_SOON',
        notified: false,
      };

      findings.push(finding);

      if (recipients.length === 0) {
        continue;
      }

      const eventType = expired ? 'LOT_EXPIRED' : 'LOT_EXPIRING_SOON';

      const alreadyNotified = await notificationService.checkRecentNotification(
        eventType,
        lot.id,
        LOT_EXPIRY_DEDUPE_HOURS
      );

      if (alreadyNotified) {
        continue;
      }

      const dateLabel = expiresAt.toLocaleDateString('pt-BR');
      // A lista completa vai em `data.positions`; a MENSAGEM mostra no máximo
      // três endereços. Um lote espalhado por doze posições viraria uma linha
      // ilegível no sino de notificação, e o endereço exato de cada saldo é
      // informação de quem vai executar a baixa — que abre a notificação.
      const positionLabel =
        positions.length <= MAX_POSITIONS_IN_MESSAGE
          ? positions.map((p) => p.positionCode).join(', ')
          : `${positions
              .slice(0, MAX_POSITIONS_IN_MESSAGE)
              .map((p) => p.positionCode)
              .join(', ')} e mais ${positions.length - MAX_POSITIONS_IN_MESSAGE}`;

      const expiredLabel =
        days === 0 ? 'venceu hoje' : `venceu há ${days} ${days === 1 ? 'dia' : 'dias'}`;

      await notificationService.createBulk(
        recipients.map((u) => u.id),
        {
          type: expired ? 'ERROR' : 'WARNING',
          category: 'WAREHOUSE',
          eventType,
          title: expired ? 'Lote Vencido com Saldo' : 'Lote Próximo do Vencimento',
          message: expired
            ? `Lote ${lot.lotNumber} de ${lot.product.name} ${expiredLabel} (${dateLabel}) ` +
              `e ainda tem ${totalQuantity} em ${positionLabel}`
            : `Lote ${lot.lotNumber} de ${lot.product.name} vence em ${days} ` +
              `${days === 1 ? 'dia' : 'dias'} (${dateLabel}): ${totalQuantity} em ${positionLabel}`,
          data: {
            lotNumber: lot.lotNumber,
            productId: lot.productId,
            productCode: lot.product.code,
            productName: lot.product.name,
            expiresAt,
            days,
            totalQuantity,
            positions,
            alertWindowDays: config.wms.lotExpiryAlertDays,
          },
          // Não existe tela de lote no frontend (a Fase 5 foi backend-only), e
          // inventar uma rota morta seria pior que apontar para uma real: o
          // produto é o caminho por onde se chega ao saldo do lote, e é a mesma
          // rota que `STOCK_BELOW_SAFETY` já usa.
          link: `/stock/products/${lot.productId}`,
          resourceType: 'Lot',
          resourceId: lot.id,
          priority: expired ? 4 : 3,
        }
      );

      finding.notified = true;
    }

    return findings;
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
