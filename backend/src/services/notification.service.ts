import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import emailService from './email.service';
import { logger } from '../config/logger';

export interface CreateNotificationDto {
  userId: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  // F4.10 / seção 3.4 de `04_ARQUITETURA_MODULAR_LICENCIAMENTO.md`: `WAREHOUSE`
  // é a categoria dos eventos que SÓ existem com um módulo opcional licenciado
  // (hoje, WMS) — reposição necessária, tarefa de armazém atrasada, posição sem
  // saldo. Deliberadamente NÃO é `STOCK`: `NotificationPreference` é por
  // categoria, e misturar as duas obrigaria o comprador que quer alerta de
  // estoque baixo a receber tarefa de armazém, e vice-versa. São públicos
  // diferentes; a categoria é o mecanismo que os separa.
  category: 'PRODUCTION' | 'STOCK' | 'PURCHASE' | 'QUALITY' | 'CAPACITY' | 'WAREHOUSE';
  eventType: string;
  title: string;
  message: string;
  data?: any;
  link?: string;
  resourceType?: string;
  resourceId?: string;
  priority?: number;
  expiresAt?: Date;
}

export interface NotificationFilters {
  category?: string;
  priority?: number;
  read?: boolean;
  archived?: boolean;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Chave YYYY-MM-DD no fuso LOCAL. `toISOString()` converteria para UTC e, num
 * fuso negativo como o do Brasil, jogaria as notificações do fim da noite para
 * o dia seguinte — a série diária ficaria deslocada em relação ao que o usuário
 * vê na lista.
 */
function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class NotificationService {
  /**
   * Criar uma nova notificação
   */
  async create(data: CreateNotificationDto) {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        category: data.category,
        eventType: data.eventType,
        title: data.title,
        message: data.message,
        data: data.data || {},
        link: data.link,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        priority: data.priority || 1,
        expiresAt: data.expiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Canal de email: disparado DEPOIS de persistir e sem `await` — ver
    // `dispatchEmails()`.
    this.dispatchEmails([data.userId], data);

    return notification;
  }

  /**
   * Criar notificações em massa para múltiplos usuários
   */
  async createBulk(userIds: string[], notificationData: Omit<CreateNotificationDto, 'userId'>) {
    const notifications = await prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        type: notificationData.type,
        category: notificationData.category,
        eventType: notificationData.eventType,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {},
        link: notificationData.link,
        resourceType: notificationData.resourceType,
        resourceId: notificationData.resourceId,
        priority: notificationData.priority || 1,
        expiresAt: notificationData.expiresAt,
      })),
    });

    this.dispatchEmails(userIds, notificationData);

    return notifications;
  }

  /**
   * Dispara o canal de email para os destinatários que a regra/preferência
   * autoriza. NÃO é aguardado por quem cria a notificação: o in-app é a entrega
   * confiável e já está persistido neste ponto; o email é conveniência e não
   * pode nem atrasar a resposta HTTP nem falhar a criação.
   *
   * Sem SMTP configurado sai imediatamente, ANTES de qualquer consulta — o modo
   * no-op não deve custar três queries de regra/preferência por notificação.
   */
  private dispatchEmails(
    userIds: string[],
    notificationData: Omit<CreateNotificationDto, 'userId'>
  ): void {
    if (!emailService.isEnabled() || userIds.length === 0) {
      return;
    }

    void this.resolveEmailRecipients(userIds, notificationData)
      .then(async (recipients) => {
        for (const recipient of recipients) {
          await emailService.sendNotificationEmail(recipient.email, {
            title: notificationData.title,
            message: notificationData.message,
            link: notificationData.link,
            priority: notificationData.priority || 1,
          });
        }
      })
      .catch((error) => {
        logger.error('Falha ao despachar notificações por email', {
          eventType: notificationData.eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  /**
   * Decide QUEM recebe email, a partir de `NotificationRule` (por perfil) e
   * `NotificationPreference` (por usuário/categoria).
   *
   * ⚠️ Este é o PRIMEIRO consumidor dessas duas tabelas em todo o backend. Elas
   * existiam no schema e eram populadas pelo seed desde a criação do módulo,
   * mas nenhum código as lia — não havia "lógica de decisão de quem recebe o
   * quê" para reaproveitar, então ela é definida aqui:
   *
   *   1. PREFERÊNCIA DO USUÁRIO GANHA DA REGRA DO PERFIL. Se existe
   *      `NotificationPreference` para (usuário, categoria), ela decide
   *      sozinha: `enabled=false` ou `priority < minPriority` cortam, e o valor
   *      de `email` é a resposta final. É uma escolha explícita de quem recebe;
   *      o perfil não deve sobrepô-la.
   *   2. SEM PREFERÊNCIA, VALE A REGRA DO PERFIL. Qualquer `NotificationRule`
   *      habilitada, de qualquer perfil do usuário, para aquele `eventType`,
   *      com `priority >= minPriority` e `email=true`, autoriza o envio (OR
   *      entre perfis — o usuário com dois perfis recebe o superset, mesma
   *      semântica aditiva do RBAC do projeto).
   *   3. DEFAULT É NÃO ENVIAR. Sem preferência e sem regra, não sai email —
   *      igual ao default `email=false` das duas colunas.
   *
   * O canal IN-APP não passa por aqui: continua sendo criado para todo
   * destinatário que o detector escolher, exatamente como antes. Filtrar in-app
   * por essas mesmas tabelas mudaria o comportamento observável de todos os
   * detectores, o que é outra tarefa.
   */
  async resolveEmailRecipients(
    userIds: string[],
    params: { category: string; eventType: string; priority?: number }
  ): Promise<{ id: string; email: string }[]> {
    const priority = params.priority || 1;

    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, active: true },
      select: {
        id: true,
        email: true,
        roles: { select: { roleId: true } },
      },
    });

    if (users.length === 0) {
      return [];
    }

    const [preferences, rules] = await Promise.all([
      prisma.notificationPreference.findMany({
        where: { userId: { in: users.map((u) => u.id) }, category: params.category },
      }),
      prisma.notificationRule.findMany({
        where: {
          roleId: { in: [...new Set(users.flatMap((u) => u.roles.map((r) => r.roleId)))] },
          eventType: params.eventType,
          enabled: true,
        },
      }),
    ]);

    const prefByUser = new Map(preferences.map((p) => [p.userId, p]));
    const rulesByRole = new Map<string, typeof rules>();
    for (const rule of rules) {
      const list = rulesByRole.get(rule.roleId) || [];
      list.push(rule);
      rulesByRole.set(rule.roleId, list);
    }

    return users.filter((user) => {
      if (!user.email) {
        return false;
      }

      const pref = prefByUser.get(user.id);
      if (pref) {
        return pref.enabled && priority >= pref.minPriority && pref.email;
      }

      return user.roles.some((userRole) =>
        (rulesByRole.get(userRole.roleId) || []).some(
          (rule) => rule.email && priority >= rule.minPriority
        )
      );
    });
  }

  /**
   * Buscar notificações de um usuário
   */
  async getByUser(
    userId: string,
    filters?: NotificationFilters,
    page = 1,
    limit = 20
  ) {
    const where: any = {
      userId,
      archived: filters?.archived ?? false,
    };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.priority) {
      where.priority = { gte: filters.priority };
    }

    if (filters?.read !== undefined) {
      where.read = filters.read;
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

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Buscar notificações críticas não lidas
   */
  async getCriticalUnread(userId: string) {
    return prisma.notification.findMany({
      where: {
        userId,
        read: false,
        archived: false,
        priority: { gte: 3 }, // Alta ou Crítica
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 10,
    });
  }

  /**
   * Contar notificações não lidas
   */
  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({
      where: {
        userId,
        read: false,
        archived: false,
      },
    });
  }

  /**
   * Contar por prioridade
   */
  async countByPriority(userId: string) {
    const counts = await prisma.notification.groupBy({
      by: ['priority'],
      where: {
        userId,
        read: false,
        archived: false,
      },
      _count: true,
    });

    return {
      critical: counts.find(c => c.priority === 4)?._count || 0,
      high: counts.find(c => c.priority === 3)?._count || 0,
      medium: counts.find(c => c.priority === 2)?._count || 0,
      low: counts.find(c => c.priority === 1)?._count || 0,
    };
  }

  /**
   * Marcar notificação como lida
   */
  async markAsRead(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new AppError(404, 'Notificação não encontrada');
    }

    return prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marcar todas como lidas
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Arquivar notificação
   */
  async archive(id: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new AppError(404, 'Notificação não encontrada');
    }

    return prisma.notification.update({
      where: { id },
      data: {
        archived: true,
        archivedAt: new Date(),
      },
    });
  }

  /**
   * Verificar se já existe notificação recente do mesmo tipo
   */
  async checkRecentNotification(
    eventType: string,
    resourceId: string,
    hoursAgo: number
  ): Promise<boolean> {
    const since = new Date();
    since.setHours(since.getHours() - hoursAgo);

    const count = await prisma.notification.count({
      where: {
        eventType,
        resourceId,
        createdAt: { gte: since },
      },
    });

    return count > 0;
  }

  /**
   * Limpar notificações expiradas ou antigas
   */
  async cleanupExpired(daysOld = 30) {
    const cutoffDate = new Date();
    // Fix: era `cutoffDate.setDate(cutoffDate.setDate() - daysOld)`.
    // `setDate()` SEM argumento devolve NaN (e já corrompe a data), então o
    // cálculo virava `setDate(NaN)` e `cutoffDate` era `Invalid Date` — que o
    // Prisma rejeita ao montar o filtro. Ou seja: o cron de limpeza (de hora em
    // hora) lançava erro em TODA execução e nunca removeu uma linha sequer. O
    // correto é `getDate()`.
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Deletar notificações lidas e arquivadas antigas
    const deleted = await prisma.notification.deleteMany({
      where: {
        OR: [
          {
            expiresAt: { lte: new Date() },
          },
          {
            archived: true,
            archivedAt: { lte: cutoffDate },
          },
          {
            read: true,
            readAt: { lte: cutoffDate },
          },
        ],
      },
    });

    return deleted.count;
  }

  /**
   * Dashboard de métricas agregadas do usuário logado.
   *
   * ⚠️ NOTA DE VERIFICAÇÃO: ao contrário do que a documentação do módulo
   * registrava ("não verificado, tratar como não confirmado"), JÁ EXISTIA um
   * endpoint de métricas — `GET /notifications/metrics`, servido por
   * `getMetrics()` logo abaixo, e consumido hoje pelo
   * `frontend/src/stores/notification.store.ts`. Este método NÃO o substitui:
   * `getMetrics()` fica intacto para não quebrar esse consumidor.
   *
   * O que este acrescenta sobre `getMetrics()`:
   *
   *   * SEPARA AS DUAS JANELAS. Em `getMetrics()` um único `days` controlava ao
   *     mesmo tempo o top de eventos e a série temporal. São perguntas
   *     diferentes: "o que mais me notifica" quer histórico longo (30 dias por
   *     padrão), "como está a semana" quer 7 dias fixos. Amarrar as duas fazia
   *     o top de eventos ter só 7 dias de amostra.
   *   * SÉRIE CONTÍGUA. `dailyTrend` preenche com zero os dias sem notificação,
   *     em vez de omitir a data. Série com buraco vira gráfico que mente sobre
   *     o intervalo entre os pontos.
   *   * SEPARA ALTA DE CRÍTICA na tendência. `getMetrics()` rotula como
   *     `critical` tudo que é `priority >= 3`, ou seja, alta contada como
   *     crítica.
   *   * SHAPE ESTÁVEL POR CATEGORIA. Toda categoria conhecida vem no objeto,
   *     com zero quando não há nada — incluindo `WAREHOUSE` (Fase 4 do WMS).
   *     Assim o consumidor não precisa conhecer a lista de categorias nem
   *     tratar chave ausente.
   *
   * Escopado ao usuário logado (`userId`), como todo o resto do módulo — não é
   * um dashboard administrativo global.
   */
  async getDashboard(userId: string, days = 30) {
    const TREND_DAYS = 7;

    const topEventsSince = new Date();
    topEventsSince.setDate(topEventsSince.getDate() - days);

    const trendStart = new Date();
    trendStart.setHours(0, 0, 0, 0);
    trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

    const unreadWhere = { userId, read: false, archived: false };

    const [byPriority, byCategoryRows, topEvents, trendRows, totalUnread] = await Promise.all([
      prisma.notification.groupBy({
        by: ['priority'],
        where: unreadWhere,
        _count: { _all: true },
      }),
      prisma.notification.groupBy({
        by: ['category'],
        where: unreadWhere,
        _count: { _all: true },
      }),
      prisma.notification.groupBy({
        by: ['eventType'],
        where: { userId, createdAt: { gte: topEventsSince } },
        _count: { eventType: true },
        orderBy: { _count: { eventType: 'desc' } },
        take: 5,
      }),
      prisma.notification.findMany({
        where: { userId, createdAt: { gte: trendStart } },
        select: { createdAt: true, priority: true },
      }),
      prisma.notification.count({ where: unreadWhere }),
    ]);

    const countForPriority = (priority: number) =>
      byPriority.find((row) => row.priority === priority)?._count._all || 0;

    // Shape estável: toda categoria conhecida presente, zero quando vazia.
    const byCategory: Record<string, number> = {
      PRODUCTION: 0,
      STOCK: 0,
      PURCHASE: 0,
      QUALITY: 0,
      CAPACITY: 0,
      WAREHOUSE: 0,
    };
    for (const row of byCategoryRows) {
      byCategory[row.category] = (byCategory[row.category] || 0) + row._count._all;
    }

    // Série de 7 dias sem buracos: monta as datas primeiro, depois preenche.
    const trendMap = new Map<string, { total: number; critical: number; high: number }>();
    for (let i = 0; i < TREND_DAYS; i += 1) {
      const day = new Date(trendStart);
      day.setDate(day.getDate() + i);
      trendMap.set(toLocalDateKey(day), { total: 0, critical: 0, high: 0 });
    }

    for (const row of trendRows) {
      const bucket = trendMap.get(toLocalDateKey(row.createdAt));
      if (!bucket) {
        continue;
      }
      bucket.total += 1;
      if (row.priority === 4) {
        bucket.critical += 1;
      } else if (row.priority === 3) {
        bucket.high += 1;
      }
    }

    return {
      criticalUnread: countForPriority(4),
      highUnread: countForPriority(3),
      totalUnread,
      byCategory,
      topEvents: topEvents.map((row) => ({
        eventType: row.eventType,
        count: row._count.eventType,
      })),
      dailyTrend: Array.from(trendMap.entries()).map(([date, value]) => ({
        date,
        ...value,
      })),
      period: {
        topEventsDays: days,
        trendDays: TREND_DAYS,
      },
    };
  }

  /**
   * Obter métricas de notificações
   */
  async getMetrics(userId: string, days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Total não lidas
    const totalUnread = await this.countUnread(userId);

    // Por prioridade
    const byPriority = await this.countByPriority(userId);

    // Por categoria
    const byCategory = await prisma.notification.groupBy({
      by: ['category'],
      where: {
        userId,
        read: false,
        archived: false,
      },
      _count: true,
    });

    // Tendência diária - CORRIGIDO: usar agregação do Prisma ao invés de raw SQL
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      select: {
        createdAt: true,
        priority: true,
      },
    });

    // Processar para agrupar por dia
    const dailyTrendMap = new Map<string, { count: number; critical: number }>();
    
    for (const notification of notifications) {
      const date = notification.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
      const existing = dailyTrendMap.get(date) || { count: 0, critical: 0 };
      existing.count += 1;
      // Contar como crítico se prioridade >= 3
      if (notification.priority >= 3) {
        existing.critical += 1;
      }
      dailyTrendMap.set(date, existing);
    }
    
    const dailyTrend = Array.from(dailyTrendMap.entries()).map(([date, data]) => ({
      date,
      count: data.count,
      critical: data.critical
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Top eventos
    const topEvents = await prisma.notification.groupBy({
      by: ['eventType'],
      where: {
        userId,
        createdAt: { gte: since },
      },
      _count: true,
      orderBy: {
        _count: {
          eventType: 'desc',
        },
      },
      take: 5,
    });

    return {
      totalUnread,
      criticalCount: byPriority.critical,
      highCount: byPriority.high,
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.category] = item._count;
        return acc;
      }, {} as Record<string, number>),
      dailyTrend,
      topEvents: topEvents.map(e => ({
        eventType: e.eventType,
        count: e._count,
      })),
    };
  }
}

export default new NotificationService();
