import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/env';
import { logger } from '../config/logger';

/**
 * Canal de EMAIL das notificações.
 *
 * Contexto: `NotificationRule.email` e `NotificationPreference.email` existem no
 * schema desde a criação do módulo, mas até aqui NENHUM código enviava email —
 * e, na verdade, nenhum código sequer LIA essas duas tabelas (ver
 * `notification.service.ts::resolveEmailRecipients()`, que é o primeiro
 * consumidor delas). Este serviço é a outra metade que faltava: o transporte.
 *
 * DECISÕES DE ESCOPO (deliberadamente pequeno):
 *
 *   * BEST-EFFORT, FIRE-AND-FORGET. `sendNotificationEmail()` nunca lança. Quem
 *     chama é o caminho de criação da notificação, e o registro in-app é o que
 *     não pode falhar: uma queda do SMTP não pode derrubar a persistência da
 *     notificação nem a resposta HTTP de quem a disparou.
 *   * SEM FILA DE RETRY. Uma falha é logada e descartada. O in-app continua
 *     sendo a entrega confiável; o email é conveniência. Fila/retry persistente
 *     é trabalho separado, com infra própria.
 *   * SEM TEMPLATE ENGINE. Texto puro + um HTML mínimo montado em linha.
 *
 * MODO NO-OP: sem `SMTP_HOST` configurado, o serviço não cria transporte e todo
 * envio vira no-op silencioso (com UM aviso no boot do primeiro envio, não um
 * por email). É o estado de todo ambiente de desenvolvimento e do banco de
 * teste — por isso o sistema precisa funcionar assim, não apenas tolerar.
 */

export interface NotificationEmailPayload {
  title: string;
  message: string;
  link?: string | null;
  priority?: number;
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'Baixa',
  2: 'Média',
  3: 'Alta',
  4: 'Crítica',
};

export class EmailService {
  private transporter: Transporter | null = null;
  private warnedNotConfigured = false;

  /** Sem host, não há canal. Exposto para quem quiser evitar trabalho inútil. */
  isEnabled(): boolean {
    return config.smtp.enabled;
  }

  /**
   * Transporte criado sob demanda e reaproveitado (pool de conexões do próprio
   * nodemailer). Criar no import faria o módulo abrir socket em processo que
   * talvez nunca envie email — incluindo a suíte de testes.
   */
  private getTransporter(): Transporter | null {
    if (!config.smtp.enabled) {
      if (!this.warnedNotConfigured) {
        this.warnedNotConfigured = true;
        logger.warn(
          'SMTP não configurado (SMTP_HOST vazio): notificações por email estão em modo no-op. ' +
            'O canal in-app não é afetado.'
        );
      }
      return null;
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        // Relay interno sem autenticação é cenário real: só manda `auth`
        // quando usuário E senha existem.
        ...(config.smtp.user && config.smtp.password
          ? { auth: { user: config.smtp.user, pass: config.smtp.password } }
          : {}),
      });
    }

    return this.transporter;
  }

  /**
   * Envia UMA notificação por email. Nunca lança — falha vira log.
   *
   * @returns `true` se o email foi entregue ao servidor SMTP; `false` em modo
   *          no-op, destinatário sem email ou falha de envio.
   */
  async sendNotificationEmail(
    to: string,
    notification: NotificationEmailPayload
  ): Promise<boolean> {
    if (!to) {
      return false;
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      return false;
    }

    try {
      await transporter.sendMail({
        from: config.smtp.from,
        to,
        subject: notification.title,
        text: this.buildTextBody(notification),
        html: this.buildHtmlBody(notification),
      });

      return true;
    } catch (error) {
      // Best-effort: log e segue. Ver nota de escopo no topo do arquivo.
      logger.error('Falha ao enviar notificação por email', {
        to,
        title: notification.title,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Corpo em texto puro. Público para permitir teste da formatação sem SMTP.
   */
  buildTextBody(notification: NotificationEmailPayload): string {
    const lines = [notification.message];

    if (notification.priority && PRIORITY_LABELS[notification.priority]) {
      lines.push('', `Prioridade: ${PRIORITY_LABELS[notification.priority]}`);
    }

    if (notification.link) {
      // `link` é uma rota do SPA (ex.: `/production/orders/<id>`), não uma URL
      // absoluta — sem o host do frontend o email chegaria com um link morto.
      lines.push('', `Acesse: ${this.absoluteLink(notification.link)}`);
    }

    return lines.join('\n');
  }

  /** Versão HTML mínima do mesmo conteúdo (sem template engine, por escopo). */
  buildHtmlBody(notification: NotificationEmailPayload): string {
    const parts = [
      `<h2>${escapeHtml(notification.title)}</h2>`,
      `<p>${escapeHtml(notification.message)}</p>`,
    ];

    if (notification.priority && PRIORITY_LABELS[notification.priority]) {
      parts.push(
        `<p><strong>Prioridade:</strong> ${escapeHtml(PRIORITY_LABELS[notification.priority])}</p>`
      );
    }

    if (notification.link) {
      const url = this.absoluteLink(notification.link);
      parts.push(`<p><a href="${escapeHtml(url)}">Abrir no Fabric PCP</a></p>`);
    }

    return parts.join('\n');
  }

  private absoluteLink(link: string): string {
    if (/^https?:\/\//i.test(link)) {
      return link;
    }
    const base = config.frontendUrl.replace(/\/+$/, '');
    return `${base}${link.startsWith('/') ? '' : '/'}${link}`;
  }

  /** Usado só por teste, para não vazar transporte entre casos. */
  resetForTesting(): void {
    this.transporter = null;
    this.warnedNotConfigured = false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default new EmailService();
