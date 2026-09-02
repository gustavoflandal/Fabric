import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { eventBus, SystemEvents } from '../events/event-bus';
import notificationDetector from './notification-detector.service';
import { AppError } from '../middleware/error.middleware';

type TransactionClient = Prisma.TransactionClient;

export interface StockMovementDto {
  productId: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  reference?: string;
  referenceType?: 'PRODUCTION' | 'PURCHASE' | 'ADJUSTMENT' | 'MANUAL' | 'COUNTING';
  countingSessionId?: string;
  userId: string;
  notes?: string;
  /**
   * F1.2 do plano do WMS: posição de armazenagem (`storage_positions.id`)
   * envolvida na movimentação.
   *
   * Semântica NESTA fase (só existem IN/OUT/ADJUSTMENT):
   *   IN         → a posição onde a quantidade ENTROU
   *   OUT        → a posição de onde a quantidade SAIU
   *   ADJUSTMENT → a posição sendo corrigida
   *
   * Omitir (o caso de 100% dos chamadores atuais: recebimento, contagem,
   * reserva de produção, entrada/saída manual) mantém o comportamento
   * exatamente como antes — só o saldo agregado é mexido. Isso é esperado até
   * as fases seguintes conectarem esses fluxos ao endereço.
   *
   * EVOLUÇÃO PLANEJADA (F2.1, Fase 2 — transferência interna): quando o tipo
   * `TRANSFER` entrar, este campo único vira o par
   * `fromPositionId`/`toPositionId`, e a migration deve REAPROVEITAR os valores
   * já gravados (`IN` → `toPositionId`, `OUT` → `fromPositionId`,
   * `ADJUSTMENT` → um dos dois conforme o sinal). O nome e a semântica já
   * nascem alinhados a isso para que a Fase 2 seja rename + backfill, não uma
   * remodelagem.
   */
  positionId?: string;
}

export interface StockBalance {
  productId: string;
  product: any;
  quantity: number;
  minStock: number;
  maxStock: number;
  safetyStock: number;
  status: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
  lastMovement?: Date;
}

export class StockServiceRefactored {
  /**
   * Lê o saldo travando a linha (SELECT ... FOR UPDATE dentro da transação),
   * cria a movimentação e atualiza o saldo - tudo atômico e serializado por
   * produto. Compartilhado por registerMovement (própria transação) e por
   * reserveForOrder (transação do chamador), por isso recebe o `tx`.
   *
   * ✅ CORREÇÃO RACE CONDITION (Fase 1, itens 1.1/1.2 do cronograma):
   * antes, o saldo era somado em memória a partir de stock_movements a cada
   * chamada - não existia linha para travar, então duas movimentações
   * concorrentes do mesmo produto podiam ler o mesmo saldo "fantasma" e
   * ambas decidirem que havia estoque suficiente.
   */
  /**
   * Versão pública de applyMovement para chamadores externos que já têm uma
   * transação própria e precisam que a movimentação de estoque seja
   * atômica junto com outras escritas (ex: purchase-receipt.service.ts::
   * cancel(), onde o estorno de estoque e a exclusão do recebimento
   * precisam ser tudo ou nada).
   */
  async registerMovementInTransaction(tx: TransactionClient, data: StockMovementDto) {
    return this.applyMovement(tx, data);
  }

  /**
   * F1.2 do plano do WMS — ORDEM DETERMINÍSTICA DE LOCK.
   *
   * Quando a movimentação informa posição, DUAS linhas são travadas na mesma
   * transação: `stock_balances` (agregado do produto) e
   * `stock_position_balances` (produto × posição). Se uma transação travasse
   * A→B e outra B→A, elas se bloqueariam mutuamente — deadlock.
   *
   * A ordem escolhida e INVARIANTE é: **`stock_balances` PRIMEIRO, depois
   * `stock_position_balances`**. O motivo é que o agregado é o lock mais
   * grosso e o único sempre presente — toda movimentação o trava,
   * endereçada ou não. Adotá-lo como lock externo significa que qualquer
   * transação que vá mexer numa posição do produto X já está serializada
   * pelo lock de X antes de tocar em qualquer linha de posição. Fosse o
   * contrário, uma movimentação sem posição (que só trava o agregado)
   * poderia entrar no meio de uma endereçada e inverter a ordem.
   *
   * Isso também prepara a Fase 2 (F2.3, `TRANSFER`, duas posições do MESMO
   * produto na mesma transação): o agregado continua sendo travado primeiro, e
   * as DUAS linhas de posição depois, ordenadas entre si por
   * `storagePositionId` — sem essa segunda regra, duas transferências
   * concorrentes A→B e B→A voltariam a poder deadlockar.
   *
   * Regra prática para quem mexer aqui: nunca trave uma linha de
   * `stock_position_balances` sem já segurar o lock do `stock_balances` do
   * mesmo produto.
   */
  private async applyMovement(tx: TransactionClient, data: StockMovementDto) {
    // ---- LOCK 1 (externo): saldo agregado do produto -----------------------
    await tx.stockBalance.upsert({
      where: { productId: data.productId },
      create: { productId: data.productId, quantity: 0 },
      update: {},
    });

    const locked = await tx.$queryRaw<{ quantity: number }[]>`
      SELECT quantity FROM stock_balances WHERE productId = ${data.productId} FOR UPDATE
    `;
    const currentQty = Number(locked[0]?.quantity ?? 0);
    const delta = data.type === 'OUT' ? -data.quantity : data.quantity;

    if (data.type === 'OUT' && currentQty < data.quantity) {
      throw new AppError(
        400,
        `Estoque insuficiente. Disponível: ${currentQty}, Solicitado: ${data.quantity}`
      );
    }

    // ---- LOCK 2 (interno): saldo da posição, só quando endereçada ----------
    // Sem `positionId` este bloco inteiro não roda e o comportamento é
    // byte-a-byte o de antes da Fase 1 (compatibilidade — nenhum chamador de
    // produção passa posição hoje).
    let newPositionQty: Prisma.Decimal | null = null;

    if (data.positionId) {
      const position = await tx.storagePosition.findUnique({
        where: { id: data.positionId },
        select: { id: true, code: true },
      });

      if (!position) {
        throw new AppError(404, 'Posição de armazenagem não encontrada');
      }

      await tx.stockPositionBalance.upsert({
        where: {
          productId_storagePositionId: {
            productId: data.productId,
            storagePositionId: data.positionId,
          },
        },
        create: {
          productId: data.productId,
          storagePositionId: data.positionId,
          quantity: 0,
        },
        update: {},
      });

      const lockedPosition = await tx.$queryRaw<{ quantity: Prisma.Decimal }[]>`
        SELECT quantity FROM stock_position_balances
        WHERE productId = ${data.productId} AND storagePositionId = ${data.positionId}
        FOR UPDATE
      `;

      // Aritmética em Decimal, não em Number: a coluna é DECIMAL(18,4)
      // (decisão D2) e converter para float aqui reintroduziria justamente o
      // erro de arredondamento que o Decimal existe para evitar.
      const currentPositionQty = new Prisma.Decimal(lockedPosition[0]?.quantity ?? 0);
      const positionDelta = new Prisma.Decimal(data.quantity).times(
        data.type === 'OUT' ? -1 : 1
      );

      // Validação de saldo NA POSIÇÃO, além da do agregado: ter 100 no produto
      // não autoriza tirar 100 de um endereço que só tem 3.
      if (data.type === 'OUT' && currentPositionQty.lessThan(data.quantity)) {
        throw new AppError(
          400,
          `Estoque insuficiente na posição ${position.code}. ` +
            `Disponível: ${currentPositionQty.toString()}, Solicitado: ${data.quantity}`
        );
      }

      newPositionQty = currentPositionQty.plus(positionDelta);
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        reason: data.reason,
        reference: data.reference,
        referenceType: data.referenceType,
        countingSessionId: data.countingSessionId,
        userId: data.userId,
        notes: data.notes,
        positionId: data.positionId,
      },
      include: {
        product: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await tx.stockBalance.update({
      where: { productId: data.productId },
      data: { quantity: currentQty + delta, version: { increment: 1 } },
    });

    if (data.positionId && newPositionQty !== null) {
      await tx.stockPositionBalance.update({
        where: {
          productId_storagePositionId: {
            productId: data.productId,
            storagePositionId: data.positionId,
          },
        },
        data: { quantity: newPositionQty, version: { increment: 1 } },
      });
    }

    return movement;
  }

  /**
   * Registra uma movimentação de estoque
   */
  async registerMovement(data: StockMovementDto) {
    // Validar produto
    const product = await prisma.product.findUnique({
      where: { id: data.productId },
    });

    if (!product) {
      throw new AppError(404, 'Produto não encontrado');
    }

    // Validar quantidade
    if (data.quantity <= 0) {
      throw new AppError(400, 'Quantidade deve ser maior que zero');
    }

    const movement = await prisma.$transaction((tx) => this.applyMovement(tx, data));

    // Emitir evento
    await eventBus.emit(SystemEvents.STOCK_MOVEMENT_CREATED, {
      movementId: movement.id,
      productId: movement.productId,
      type: movement.type,
      quantity: movement.quantity,
      reference: movement.reference,
    });

    // Verificar níveis de estoque
    await this.checkStockLevels(data.productId);

    // ✅ NOTIFICAÇÃO: Verificar estoque baixo após movimentação
    const currentBalance = await this.getBalance(data.productId);
    if (currentBalance.quantity <= product.minStock) {
      notificationDetector.checkLowStock().catch(err => {
        console.error('Erro ao verificar estoque baixo:', err);
      });
    }

    return movement;
  }

  /**
   * Obtém saldo REAL de estoque de um produto (lido da tabela de saldo
   * persistida, não mais recalculado somando o histórico inteiro)
   */
  async getBalance(productId: string): Promise<StockBalance> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        unit: true,
      },
    });

    if (!product) {
      throw new AppError(404, 'Produto não encontrado');
    }

    let balanceRow = await prisma.stockBalance.findUnique({ where: { productId } });
    if (!balanceRow) {
      balanceRow = await prisma.stockBalance.upsert({
        where: { productId },
        create: { productId, quantity: 0 },
        update: {},
      });
    }

    const lastMovementRow = await prisma.stockMovement.findFirst({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const quantity = balanceRow.quantity;
    const lastMovement = lastMovementRow?.createdAt;

    return this.toBalance(product, quantity, lastMovement);
  }

  /**
   * Monta o DTO de saldo (limiares + status derivado) a partir do produto e da
   * quantidade já lida. Extraído de getBalance() para ser o ponto único da
   * regra de status, compartilhado com getAllBalances() — que passou a ler
   * produto, saldo e última movimentação em lote (ver F0.5 abaixo) e não pode
   * chamar getBalance() por produto.
   */
  private toBalance(product: any, quantity: number, lastMovement?: Date): StockBalance {
    const minStock = product.minStock || 0;
    const maxStock = product.maxStock || 1000;
    const safetyStock = product.safetyStock || 0;

    // Determinar status
    let status: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS' = 'OK';

    if (quantity < safetyStock) {
      status = 'CRITICAL';
    } else if (quantity < minStock) {
      status = 'LOW';
    } else if (quantity > maxStock) {
      status = 'EXCESS';
    }

    return {
      productId: product.id,
      product,
      quantity,
      minStock,
      maxStock,
      safetyStock,
      status,
      lastMovement,
    };
  }

  /**
   * Lista todos os saldos de estoque
   *
   * ✅ F0.5 do plano do WMS (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md):
   * antes este método iterava os produtos ativos chamando `getBalance()` um a
   * um — 3 queries por produto (produto + saldo + última movimentação), ou seja
   * N+1 clássico, e o produto ainda era buscado duas vezes (aqui e lá dentro).
   * Com uma base de milhares de SKUs isso já é lento; com saldo POR POSIÇÃO
   * (Fase 1) o mesmo padrão viraria N×M queries. Agora são 2 queries fixas,
   * independentemente do número de produtos:
   *   1) produtos + categoria + unidade + saldo (join via include);
   *   2) MAX(createdAt) das movimentações agrupado por produto.
   *
   * O contrato de retorno é idêntico ao anterior (mesmo shape de StockBalance,
   * mesma regra de status via `toBalance`), para não quebrar
   * getSummary/getStockConsolidation/getLowStockProducts/getExcessStockProducts
   * nem os consumidores de `GET /stock/balances`.
   *
   * Única diferença de comportamento, deliberada: este caminho de LEITURA não
   * cria mais linha de `stock_balances` para produto que ainda não tem saldo —
   * produto sem linha é lido como quantidade 0. Quem cria a linha é o caminho
   * de escrita (`applyMovement`, dentro da transação com lock) e `getBalance()`.
   */
  async getAllBalances(filters?: {
    status?: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
    type?: string;
    categoryId?: string;
  }): Promise<StockBalance[]> {
    const where: any = { active: true };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: true,
        unit: true,
        stockBalance: true,
      },
    });

    if (products.length === 0) {
      return [];
    }

    const lastMovements = await prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { productId: { in: products.map((p) => p.id) } },
      _max: { createdAt: true },
    });

    const lastMovementByProduct = new Map(
      lastMovements.map((m) => [m.productId, m._max.createdAt ?? undefined])
    );

    const balances: StockBalance[] = [];

    for (const product of products) {
      // `stockBalance` é detalhe da consulta, não faz parte do contrato de
      // `product` que os consumidores já recebiam - removido do objeto exposto.
      const { stockBalance, ...productData } = product;

      const balance = this.toBalance(
        productData,
        stockBalance?.quantity ?? 0,
        lastMovementByProduct.get(product.id)
      );

      // Filtrar por status se especificado
      if (filters?.status && balance.status !== filters.status) {
        continue;
      }

      balances.push(balance);
    }

    return balances;
  }

  /**
   * Obtém histórico de movimentações de um produto
   */
  async getMovementHistory(
    productId: string,
    filters?: {
      type?: 'IN' | 'OUT' | 'ADJUSTMENT';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ) {
    const where: any = { productId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });

    return movements;
  }

  /**
   * Verifica níveis de estoque e emite alertas
   */
  private async checkStockLevels(productId: string): Promise<void> {
    const balance = await this.getBalance(productId);

    if (balance.status === 'CRITICAL') {
      await eventBus.emit(SystemEvents.STOCK_LEVEL_CRITICAL, {
        productId: balance.productId,
        productCode: balance.product.code,
        productName: balance.product.name,
        currentQty: balance.quantity,
        safetyStock: balance.safetyStock,
        minStock: balance.minStock,
      });
    } else if (balance.status === 'LOW') {
      await eventBus.emit(SystemEvents.STOCK_LEVEL_LOW, {
        productId: balance.productId,
        productCode: balance.product.code,
        productName: balance.product.name,
        currentQty: balance.quantity,
        minStock: balance.minStock,
      });
    } else if (balance.status === 'EXCESS') {
      await eventBus.emit(SystemEvents.STOCK_LEVEL_EXCESS, {
        productId: balance.productId,
        productCode: balance.product.code,
        productName: balance.product.name,
        currentQty: balance.quantity,
        maxStock: balance.maxStock,
      });
    }
  }

  /**
   * Ajuste manual de estoque
   */
  async adjustStock(
    productId: string,
    newQuantity: number,
    reason: string,
    userId: string,
    notes?: string
  ) {
    const currentBalance = await this.getBalance(productId);
    const difference = newQuantity - currentBalance.quantity;

    if (difference === 0) {
      throw new AppError(400, 'Nova quantidade é igual à quantidade atual');
    }

    const type = difference > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(difference);

    return this.registerMovement({
      productId,
      type,
      quantity,
      reason: `Ajuste: ${reason}`,
      referenceType: 'ADJUSTMENT',
      userId,
      notes: `Quantidade anterior: ${currentBalance.quantity}, Nova quantidade: ${newQuantity}. ${notes || ''}`,
    });
  }

  /**
   * Consolidação de estoque (para relatórios)
   */
  async getStockConsolidation(filters?: {
    categoryId?: string;
    type?: string;
    status?: 'OK' | 'LOW' | 'CRITICAL' | 'EXCESS';
  }) {
    const balances = await this.getAllBalances(filters);

    const consolidation = {
      totalProducts: balances.length,
      totalValue: 0,
      byStatus: {
        OK: 0,
        LOW: 0,
        CRITICAL: 0,
        EXCESS: 0,
      },
      byCategory: {} as Record<string, number>,
      products: balances,
    };

    for (const balance of balances) {
      // Contar por status
      consolidation.byStatus[balance.status]++;

      // Calcular valor total
      const cost = balance.product.averageCost || balance.product.lastCost || 0;
      consolidation.totalValue += balance.quantity * cost;

      // Agrupar por categoria
      const categoryName = balance.product.category?.name || 'Sem Categoria';
      if (!consolidation.byCategory[categoryName]) {
        consolidation.byCategory[categoryName] = 0;
      }
      consolidation.byCategory[categoryName]++;
    }

    return consolidation;
  }

  /**
   * Obtém resumo do estoque
   */
  async getSummary() {
    const balances = await this.getAllBalances();
    
    const total = balances.length;
    const ok = balances.filter(b => b.status === 'OK').length;
    const low = balances.filter(b => b.status === 'LOW').length;
    const critical = balances.filter(b => b.status === 'CRITICAL').length;
    const excess = balances.filter(b => b.status === 'EXCESS').length;
    
    const totalValue = balances.reduce((sum, b) => {
      const cost = b.product.averageCost || b.product.lastCost || b.product.standardCost || 0;
      return sum + (b.quantity * cost);
    }, 0);

    return {
      total,
      ok,
      low,
      critical,
      excess,
      totalValue,
      lastUpdate: new Date(),
    };
  }

  /**
   * Obtém produtos com estoque baixo
   */
  async getLowStockProducts(): Promise<StockBalance[]> {
    const balances = await this.getAllBalances();
    return balances.filter(b => b.status === 'LOW' || b.status === 'CRITICAL');
  }

  /**
   * Obtém produtos com estoque em excesso
   */
  async getExcessStockProducts(): Promise<StockBalance[]> {
    const balances = await this.getAllBalances();
    return balances.filter(b => b.status === 'EXCESS');
  }

  /**
   * Obtém movimentações de um produto
   */
  async getMovements(productId: string, limit = 50) {
    return this.getMovementHistory(productId, { limit });
  }

  /**
   * Registra entrada de estoque
   */
  async registerEntry(data: {
    productId: string;
    quantity: number;
    reason: string;
    reference?: string;
    userId: string;
    notes?: string;
  }) {
    return this.registerMovement({
      productId: data.productId,
      type: 'IN',
      quantity: data.quantity,
      reason: data.reason,
      reference: data.reference,
      referenceType: 'MANUAL',
      userId: data.userId,
      notes: data.notes,
    });
  }

  /**
   * Registra saída de estoque
   */
  async registerExit(data: {
    productId: string;
    quantity: number;
    reason: string;
    reference?: string;
    userId: string;
    notes?: string;
  }) {
    return this.registerMovement({
      productId: data.productId,
      type: 'OUT',
      quantity: data.quantity,
      reason: data.reason,
      reference: data.reference,
      referenceType: 'MANUAL',
      userId: data.userId,
      notes: data.notes,
    });
  }

  /**
   * Registra ajuste de estoque
   */
  async registerAdjustment(data: {
    productId: string;
    quantity: number;
    reason: string;
    userId: string;
    notes?: string;
  }) {
    const currentBalance = await this.getBalance(data.productId);
    const difference = data.quantity - currentBalance.quantity;

    if (difference === 0) {
      throw new AppError(400, 'Nova quantidade é igual à quantidade atual');
    }

    const type = difference > 0 ? 'IN' : 'OUT';
    const quantity = Math.abs(difference);

    return this.registerMovement({
      productId: data.productId,
      type,
      quantity,
      reason: `Ajuste: ${data.reason}`,
      referenceType: 'ADJUSTMENT',
      userId: data.userId,
      notes: `Quantidade anterior: ${currentBalance.quantity}, Nova quantidade: ${data.quantity}. ${data.notes || ''}`,
    });
  }

  /**
   * Reserva estoque para uma ordem de produção
   * ✅ CORREÇÃO RACE CONDITION: Usa transação para garantir atomicidade
   */
  async reserveForOrder(orderId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.productionOrder.findUnique({
        where: { id: orderId },
        include: {
          product: true,
        },
      });

      if (!order) {
        throw new AppError(404, 'Ordem de produção não encontrada');
      }

      // Buscar BOM ativa do produto
      const activeBom = await tx.bOM.findFirst({
        where: {
          productId: order.productId,
          active: true,
        },
        include: {
          items: {
            include: {
              component: true,
            },
          },
        },
      });

      if (!activeBom) {
        throw new AppError(404, 'BOM ativa não encontrada para o produto');
      }

      // ✅ FASE 1: Validar TODOS os estoques antes de reservar qualquer um (fail-fast).
      // Trava cada linha de saldo aqui mesmo (a mesma transação/conexão reutiliza o
      // lock em FASE 2) para que nenhuma outra reserva concorrente consiga ler um
      // saldo desatualizado entre a validação e a escrita.
      const requiredItems = activeBom.items.map(bomItem => ({
        componentId: bomItem.componentId,
        componentCode: bomItem.component.code,
        requiredQty: bomItem.quantity * order.quantity * (1 + bomItem.scrapFactor),
      }));

      for (const item of requiredItems) {
        await tx.stockBalance.upsert({
          where: { productId: item.componentId },
          create: { productId: item.componentId, quantity: 0 },
          update: {},
        });

        const locked = await tx.$queryRaw<{ quantity: number }[]>`
          SELECT quantity FROM stock_balances WHERE productId = ${item.componentId} FOR UPDATE
        `;
        const balance = Number(locked[0]?.quantity ?? 0);

        if (balance < item.requiredQty) {
          throw new AppError(400, `Estoque insuficiente para ${item.componentCode}: disponível ${balance}, necessário ${item.requiredQty}`);
        }
      }

      // ✅ FASE 2: Todos os estoques validados e travados, agora registrar TODAS as saídas
      const reservations = [];

      for (const item of requiredItems) {
        const movement = await this.applyMovement(tx, {
          productId: item.componentId,
          type: 'OUT',
          quantity: item.requiredQty,
          reason: 'Reserva para produção',
          reference: order.orderNumber,
          referenceType: 'MANUAL',
          userId,
        });

        reservations.push(movement);
      }

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        reservations,
        totalItems: reservations.length,
      };
    });
  }
}

export default new StockServiceRefactored();
