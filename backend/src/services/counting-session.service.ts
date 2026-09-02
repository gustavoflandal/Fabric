import { Prisma, PrismaClient, CountingSession, SessionStatus } from '@prisma/client';
import countingPlanService from './counting-plan.service';
import stockService from './stock.service';
import { isModuleEnabled } from './licensed-module.service';
import { AppError } from '../middleware/error.middleware';
import { AGGREGATE_MOVEMENT_TYPES } from '../utils/stock-movement.util';
import {
  COUNTING_POSITION_SELECT,
  compareCountingRoute,
  CountingRoutePosition,
} from '../utils/counting-position.util';

const prisma = new PrismaClient();

export interface CreateSessionDTO {
  planId: string;
  scheduledDate: Date;
  assignedTo?: string;
}

/**
 * F3.2 — um item de contagem antes de existir no banco. `storagePositionId`
 * nulo é o item NÃO endereçado (caminho só-PCP, ou produto sem nenhum saldo
 * endereçado); `route` só existe quando há endereço, e é o que a F3.3 usa para
 * numerar `sequence`.
 */
interface PlannedCountingItem {
  productId: string;
  storagePositionId: string | null;
  systemQty: Prisma.Decimal;
  route: CountingRoutePosition | null;
}

export interface SessionFilters {
  status?: SessionStatus;
  planId?: string;
  assignedTo?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

class CountingSessionService {
  /**
   * Listar todas as sessões
   */
  async findAll(filters?: SessionFilters) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.planId) {
      where.planId = filters.planId;
    }

    if (filters?.assignedTo) {
      where.assignedTo = filters.assignedTo;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.scheduledDate = {};
      if (filters.dateFrom) {
        where.scheduledDate.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.scheduledDate.lte = filters.dateTo;
      }
    }

    return await prisma.countingSession.findMany({
      where,
      include: {
        plan: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        completedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        scheduledDate: 'desc',
      },
    });
  }

  /**
   * Buscar sessão por ID
   */
  async findById(id: string) {
    return await prisma.countingSession.findUnique({
      where: { id },
      include: {
        plan: true,
        assignedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        completedUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                unitId: true,
              },
            },
            storagePosition: { select: COUNTING_POSITION_SELECT },
            counter: {
              select: {
                id: true,
                name: true,
              },
            },
            recounter: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          // F3.3: ordem da ROTA de contagem. Itens não endereçados ficam com
          // `sequence = 0` e caem no desempate por `createdAt` — a ordem que
          // este método devolvia antes da Fase 3.
          orderBy: [{ sequence: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  /**
   * Criar nova sessão de contagem
   */
  async create(data: CreateSessionDTO): Promise<CountingSession> {
    const plan = await countingPlanService.findById(data.planId);
    if (!plan) {
      throw new AppError(404, 'Plano de contagem não encontrado');
    }

    if (plan.status !== 'ACTIVE') {
      throw new AppError(400, 'Plano de contagem não está ativo');
    }

    // Gerar código único
    const count = await prisma.countingSession.count();
    const code = `SESS-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    // Selecionar produtos baseado nos critérios do plano
    const products = await countingPlanService.selectProducts(data.planId);

    // F3.2/F3.3: a dimensão de endereço entra aqui. `totalItems` passa a contar
    // ITENS, não produtos — com WMS licenciado, um produto espalhado por 3
    // posições vira 3 itens de contagem.
    const planned = await this.buildSessionItems(products.map((product) => product.id));

    // Criar sessão
    const session = await prisma.countingSession.create({
      data: {
        code,
        planId: data.planId,
        scheduledDate: data.scheduledDate,
        assignedTo: data.assignedTo,
        status: 'SCHEDULED',
        totalItems: planned.length,
      },
    });

    // Criar itens de contagem
    await prisma.countingItem.createMany({
      data: planned.map((item, index) => ({
        sessionId: session.id,
        productId: item.productId,
        storagePositionId: item.storagePositionId,
        systemQty: item.systemQty,
        // F3.3: `planned` já vem ordenado pela rota, então a sequência é o
        // índice + 1. Item não endereçado fica com 0 (default histórico) —
        // ver `buildSessionItems()`.
        sequence: item.route ? index + 1 : 0,
        status: 'PENDING',
      })),
    });

    return session;
  }

  /**
   * F3.2 — geração dos itens de uma sessão, ramificada por licenciamento.
   *
   * A ramificação é o ponto central desta fase. O plano do WMS descreve "um item
   * de contagem por posição com saldo", mas isso só faz sentido numa instalação
   * que tem WMS: numa instalação só-PCP não existe `StoragePosition` relevante, e
   * a contagem precisa continuar funcionando exatamente como sempre funcionou.
   *
   *   WMS NÃO licenciado → um item por PRODUTO, `storagePositionId = null`,
   *     `systemQty = 0` (placeholder recalculado em `start()`). Byte a byte o
   *     comportamento anterior à Fase 3.
   *
   *   WMS licenciado → um item por (PRODUTO × POSIÇÃO com saldo > 0), com
   *     `systemQty` vindo direto de `StockPositionBalance` — que é a razão de
   *     `start()` não precisar mais somar `stock_movements` para esses itens.
   *
   * PRODUTO SEM NENHUM SALDO ENDEREÇADO (com WMS licenciado) — decisão de
   * desenho que o plano não fixava: ele ainda gera UM item, com
   * `storagePositionId = null`. Não gerar nada faria o produto sumir
   * silenciosamente da contagem, que é o oposto do objetivo de um inventário —
   * e o caso mais provável (produto que o sistema acha que tem saldo mas que
   * nunca foi endereçado) é justamente o que mais precisa ser conferido. Esse
   * item cai no mesmo caminho do só-PCP: `systemQty` placeholder, recalculado a
   * partir do saldo agregado em `start()`.
   */
  private async buildSessionItems(productIds: string[]): Promise<PlannedCountingItem[]> {
    const zero = new Prisma.Decimal(0);

    if (productIds.length === 0) {
      return [];
    }

    const wmsEnabled = await isModuleEnabled('WMS');

    if (!wmsEnabled) {
      return productIds.map((productId) => ({
        productId,
        storagePositionId: null,
        systemQty: zero,
        route: null,
      }));
    }

    // UMA query para todos os produtos do plano, não uma por produto: o plano
    // pode selecionar centenas de produtos, e o N+1 aqui seria o mesmo problema
    // que a F0.5 corrigiu em `getAllBalances()`.
    const balances = await prisma.stockPositionBalance.findMany({
      where: {
        productId: { in: productIds },
        quantity: { gt: 0 },
      },
      select: {
        productId: true,
        storagePositionId: true,
        quantity: true,
        storagePosition: { select: COUNTING_POSITION_SELECT },
      },
    });

    const addressed: PlannedCountingItem[] = balances.map((balance) => ({
      productId: balance.productId,
      storagePositionId: balance.storagePositionId,
      systemQty: balance.quantity,
      route: {
        warehouseCode: balance.storagePosition.warehouseCode,
        streetCode: balance.storagePosition.streetCode,
        floor: balance.storagePosition.floor,
        position: balance.storagePosition.position,
      },
    }));

    // F3.3 — ordena a rota ANTES de numerar (a numeração acontece em `create()`,
    // que já recebe esta lista ordenada).
    addressed.sort((a, b) => compareCountingRoute(a.route!, b.route!));

    const productsWithBalance = new Set(balances.map((balance) => balance.productId));
    const unaddressed: PlannedCountingItem[] = productIds
      .filter((productId) => !productsWithBalance.has(productId))
      .map((productId) => ({
        productId,
        storagePositionId: null,
        systemQty: zero,
        route: null,
      }));

    // Endereçados primeiro: eles têm rota, e o contador percorre o armazém antes
    // de resolver a lista de exceções (produtos sem endereço conhecido).
    return [...addressed, ...unaddressed];
  }

  /**
   * Iniciar sessão de contagem
   */
  async start(id: string, userId: string): Promise<CountingSession> {
    const session = await this.findById(id);
    if (!session) {
      throw new AppError(404, 'Sessão não encontrada');
    }

    if (session.status !== 'SCHEDULED') {
      throw new AppError(400, 'Sessão não pode ser iniciada');
    }

    // ---- Itens ENDEREÇADOS (F3.2) ------------------------------------------
    // `systemQty` é relido de `StockPositionBalance` no MOMENTO DA PARTIDA, e
    // não só no `create()`: uma sessão é agendada e pode ser iniciada dias
    // depois, com movimentação no meio. O valor gravado no `create()` é o que
    // permite ver a sessão já dimensionada antes de começar; este re-leitura é o
    // que garante que o contador compare contra o saldo vigente.
    //
    // Uma query só para a sessão inteira (não uma por item): é o mesmo N+1 que
    // a F0.5 corrigiu em `getAllBalances()`, e aqui ele seria produto × posição.
    const addressedItems = session.items.filter((item) => item.storagePositionId);

    if (addressedItems.length > 0) {
      const balances = await prisma.stockPositionBalance.findMany({
        where: {
          OR: addressedItems.map((item) => ({
            productId: item.productId,
            storagePositionId: item.storagePositionId as string,
          })),
        },
        select: { productId: true, storagePositionId: true, quantity: true },
      });

      const balanceByKey = new Map(
        balances.map((balance) => [
          `${balance.productId}|${balance.storagePositionId}`,
          balance.quantity,
        ])
      );

      for (const item of addressedItems) {
        // Sem linha de saldo = a posição foi esvaziada entre a criação e a
        // partida da sessão. `0` é a leitura correta (e continua sendo contado:
        // achar material onde o sistema diz que não há é uma divergência tão
        // relevante quanto o contrário).
        const quantity =
          balanceByKey.get(`${item.productId}|${item.storagePositionId}`) ?? new Prisma.Decimal(0);

        await prisma.countingItem.update({
          where: { id: item.id },
          data: { systemQty: quantity },
        });
      }
    }

    // ---- Itens NÃO endereçados ---------------------------------------------
    // Caminho só-PCP (e o produto sem nenhum saldo endereçado, ver
    // `buildSessionItems()`): continua derivando o saldo do histórico agregado,
    // exatamente como antes da Fase 3.
    for (const item of session.items) {
      if (item.storagePositionId) {
        continue;
      }

      // Buscar estoque atual do produto
      // F2.2: `TRANSFER` excluído — transferência interna não altera o saldo
      // do produto (só o endereço), e o laço abaixo a somaria como saída,
      // fazendo a contagem nascer com `systemQty` menor que o real.
      const movements = await prisma.stockMovement.findMany({
        where: { productId: item.productId, type: { in: AGGREGATE_MOVEMENT_TYPES } },
        select: {
          type: true,
          quantity: true,
        },
      });

      // Calcular estoque atual
      let currentStock = 0;
      for (const movement of movements) {
        if (movement.type === 'IN' || movement.type === 'ADJUSTMENT') {
          currentStock += movement.quantity;
        } else if (movement.type === 'OUT') {
          currentStock -= movement.quantity;
        }
      }

      // Atualizar item
      await prisma.countingItem.update({
        where: { id: item.id },
        data: { systemQty: currentStock },
      });
    }

    return await prisma.countingSession.update({
      where: { id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        assignedTo: userId,
      },
    });
  }

  /**
   * Completar sessão de contagem
   */
  async complete(id: string, userId: string): Promise<CountingSession> {
    const session = await this.findById(id);
    if (!session) {
      throw new AppError(404, 'Sessão não encontrada');
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'Sessão não está em andamento');
    }

    // Verificar se todos os itens foram contados
    const pendingItems = session.items.filter((item) => item.status === 'PENDING');
    if (pendingItems.length > 0) {
      throw new AppError(400, `Ainda há ${pendingItems.length} itens pendentes de contagem`);
    }

    // Calcular estatísticas
    const countedItems = session.items.length;
    const itemsWithDiff = session.items.filter((item) => item.hasDifference).length;
    const accuracyPercent = ((countedItems - itemsWithDiff) / countedItems) * 100;

    return await prisma.countingSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        completedBy: userId,
        countedItems,
        itemsWithDiff,
        accuracyPercent,
      },
    });
  }

  /**
   * Cancelar sessão de contagem
   */
  async cancel(id: string): Promise<CountingSession> {
    return await prisma.countingSession.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  /**
   * Gerar relatório de divergências
   */
  async generateReport(id: string) {
    const session = await this.findById(id);
    if (!session) {
      throw new AppError(404, 'Sessão não encontrada');
    }

    const itemsWithDiff = session.items.filter((item) => item.hasDifference);

    // Calcular totais
    const totalDifferenceValue = itemsWithDiff.reduce((sum, item) => {
      const product = item.product as any;
      const diffValue = Math.abs(Number(item.difference)) * (product.standardCost || 0);
      return sum + diffValue;
    }, 0);

    // Agrupar por tipo de divergência
    const shortages = itemsWithDiff.filter((item) => Number(item.difference) < 0);
    const surpluses = itemsWithDiff.filter((item) => Number(item.difference) > 0);

    return {
      session: {
        code: session.code,
        planName: session.plan.name,
        scheduledDate: session.scheduledDate,
        completedAt: session.completedAt,
        assignedUser: session.assignedUser?.name,
        completedUser: session.completedUser?.name,
      },
      summary: {
        totalItems: session.totalItems,
        countedItems: session.countedItems,
        itemsWithDiff: session.itemsWithDiff,
        accuracyPercent: session.accuracyPercent,
        totalDifferenceValue,
      },
      divergences: itemsWithDiff.map((item) => ({
        product: {
          code: item.product.code,
          name: item.product.name,
          type: item.product.type,
        },
        // F3.1/F3.2: `null` numa instalação só-PCP (e no produto sem saldo
        // endereçado). Com WMS, é O dado que torna o relatório acionável —
        // "faltam 3 unidades" sem dizer em qual endereço não se investiga.
        storagePosition: item.storagePosition ?? null,
        systemQty: item.systemQty,
        countedQty: item.countedQty,
        finalQty: item.finalQty,
        difference: item.difference,
        differencePercent: item.differencePercent,
        status: item.status,
        notes: item.notes,
        reason: item.reason,
      })),
      analysis: {
        shortages: {
          count: shortages.length,
          items: shortages.map((item) => ({
            product: item.product.name,
            difference: item.difference,
          })),
        },
        surpluses: {
          count: surpluses.length,
          items: surpluses.map((item) => ({
            product: item.product.name,
            difference: item.difference,
          })),
        },
      },
    };
  }

  /**
   * Ajustar estoque baseado na sessão
   */
  async adjustStock(id: string, userId: string) {
    const session = await this.findById(id);
    if (!session) {
      throw new AppError(404, 'Sessão não encontrada');
    }

    if (session.status !== 'COMPLETED') {
      throw new AppError(400, 'Sessão não está completa');
    }

    const itemsToAdjust = session.items.filter(
      (item) => item.hasDifference && item.status === 'RECOUNTED'
    );

    const adjustments = [];

    for (const item of itemsToAdjust) {
      const difference = Number(item.difference);
      if (difference === 0) continue;

      // Criar movimentação de ajuste via stockService: mantém o saldo persistido
      // (stock_balances) sincronizado e usa o sinal correto do tipo.
      // ✅ CORREÇÃO: antes gravava sempre type 'ADJUSTMENT' com Math.abs(difference),
      // e o cálculo de saldo somava QUALQUER movimentação ADJUSTMENT - ou seja, uma
      // contagem que encontrasse MENOS estoque físico (difference negativo, quebra)
      // aumentava o saldo em vez de diminuir. difference = countedQty - systemQty,
      // então difference > 0 é sobra (IN) e difference < 0 é quebra (OUT).
      //
      // F3.4: o ajuste passa a ser ENDEREÇADO quando o item tem posição. O par
      // origem/destino segue a semântica validada em
      // `stock.service.ts::assertPositionsMatchType()`:
      //   sobra  (difference > 0, IN)  → `toPositionId`   (entrou NAQUELE endereço)
      //   quebra (difference < 0, OUT) → `fromPositionId` (saiu DAQUELE endereço)
      // Item sem posição (só-PCP, ou produto sem saldo endereçado) continua
      // chamando sem nenhuma das duas — a dimensão de endereço é aditiva.
      //
      // Consequência intencional: com posição, `applyMovement()` valida o saldo
      // NA POSIÇÃO antes de debitar. Uma quebra maior que o saldo endereçado
      // falha com AppError em vez de deixar `stock_position_balances` negativo.
      const type = difference > 0 ? 'IN' : 'OUT';
      const positionId = item.storagePositionId ?? undefined;

      const movement = await stockService.registerMovement({
        productId: item.productId,
        type,
        quantity: Math.abs(difference),
        reason: `Ajuste por contagem - Sessão ${session.code}`,
        reference: session.id,
        referenceType: 'COUNTING',
        countingSessionId: session.id,
        userId,
        notes: item.reason || undefined,
        fromPositionId: type === 'OUT' ? positionId : undefined,
        toPositionId: type === 'IN' ? positionId : undefined,
      });

      // Marcar item como ajustado
      await prisma.countingItem.update({
        where: { id: item.id },
        data: { status: 'ADJUSTED' },
      });

      adjustments.push(movement);
    }

    return {
      adjustmentsCreated: adjustments.length,
      adjustments,
    };
  }

  /**
   * Dashboard de contagens
   */
  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Planos ativos
    const activePlans = await prisma.countingPlan.count({
      where: { status: 'ACTIVE' },
    });

    // Sessões em andamento
    const activeSessions = await prisma.countingSession.count({
      where: { status: 'IN_PROGRESS' },
    });

    // Itens pendentes
    const pendingItems = await prisma.countingItem.count({
      where: { status: 'PENDING' },
    });

    // Acurácia média (últimos 30 dias)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const completedSessions = await prisma.countingSession.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: thirtyDaysAgo },
      },
      select: { accuracyPercent: true },
    });

    const avgAccuracy =
      completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + Number(s.accuracyPercent || 0), 0) /
          completedSessions.length
        : 0;

    // Sessões agendadas para hoje
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const scheduledToday = await prisma.countingSession.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        plan: {
          select: {
            name: true,
          },
        },
        assignedUser: {
          select: {
            name: true,
          },
        },
      },
    });

    // Divergências recentes
    const recentDivergences = await prisma.countingItem.findMany({
      where: {
        hasDifference: true,
        countedAt: { gte: thirtyDaysAgo },
      },
      include: {
        product: {
          select: {
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        countedAt: 'desc',
      },
      take: 10,
    });

    return {
      stats: {
        activePlans,
        activeSessions,
        pendingItems,
        avgAccuracy: avgAccuracy.toFixed(2),
      },
      scheduledToday,
      recentDivergences,
    };
  }
}

export default new CountingSessionService();
