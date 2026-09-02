import nodemailer from 'nodemailer';
import emailService from '../../src/services/email.service';
import notificationService from '../../src/services/notification.service';
import { config } from '../../src/config/env';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { createTestUser } from '../helpers/fixtures';

jest.mock('nodemailer');

const mockedNodemailer = nodemailer as jest.Mocked<typeof nodemailer>;

/**
 * Canal de email das notificações.
 *
 * O caso mais importante aqui é o MODO NO-OP: o ambiente de teste (e todo
 * ambiente de desenvolvimento) não tem `SMTP_HOST`, e o sistema precisa
 * funcionar normalmente assim — não apenas "não quebrar", mas nem sequer tentar
 * abrir transporte. Envio real de email não é testado (nem seria desejável);
 * quando o transporte precisa ser exercitado, é via mock.
 */

/** Liga o SMTP só para o caso de teste atual, devolvendo o estado original. */
const withSmtpConfigured = (fn: (sendMail: jest.Mock) => Promise<void>) => async () => {
  const original = { host: config.smtp.host, enabled: config.smtp.enabled };
  config.smtp.host = 'smtp.exemplo.local';
  config.smtp.enabled = true;
  emailService.resetForTesting();

  const sendMail = jest.fn().mockResolvedValue({ messageId: 'abc' });
  mockedNodemailer.createTransport.mockReturnValue({ sendMail } as never);

  try {
    await fn(sendMail);
  } finally {
    config.smtp.host = original.host;
    config.smtp.enabled = original.enabled;
    emailService.resetForTesting();
  }
};

describe('email.service: modo no-op sem SMTP configurado', () => {
  beforeEach(() => {
    emailService.resetForTesting();
  });

  it('o ambiente de teste realmente não tem SMTP configurado', () => {
    expect(config.smtp.enabled).toBe(false);
    expect(emailService.isEnabled()).toBe(false);
  });

  it('sendNotificationEmail não lança e não cria transporte', async () => {
    const result = await emailService.sendNotificationEmail('alguem@exemplo.com', {
      title: 'Material Indisponível',
      message: 'Faltou componente',
    });

    expect(result).toBe(false);
    expect(mockedNodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('avisa uma única vez, não a cada envio', async () => {
    const warn = jest.spyOn(require('../../src/config/logger').logger, 'warn');

    await emailService.sendNotificationEmail('a@exemplo.com', { title: 't', message: 'm' });
    await emailService.sendNotificationEmail('b@exemplo.com', { title: 't', message: 'm' });
    await emailService.sendNotificationEmail('c@exemplo.com', { title: 't', message: 'm' });

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('email.service: formatação', () => {
  it('corpo em texto traz mensagem, prioridade e link absoluto', () => {
    const body = emailService.buildTextBody({
      title: 'Ordem Atrasada',
      message: 'OP-1 está atrasada em 2 dias',
      link: '/production/orders/abc',
      priority: 3,
    });

    expect(body).toContain('OP-1 está atrasada em 2 dias');
    expect(body).toContain('Prioridade: Alta');
    // `link` é rota do SPA: precisa virar URL absoluta com o host do frontend.
    expect(body).toContain(`${config.frontendUrl}/production/orders/abc`);
  });

  it('não inventa link quando a notificação não tem um', () => {
    const body = emailService.buildTextBody({ title: 't', message: 'sem link' });
    expect(body).not.toContain('Acesse:');
  });

  it('escapa HTML da mensagem no corpo HTML', () => {
    const html = emailService.buildHtmlBody({
      title: 'Alerta',
      message: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('email.service: com SMTP configurado (transporte mockado)', () => {
  it(
    'envia com assunto = título e corpo = mensagem',
    withSmtpConfigured(async (sendMail) => {
      const ok = await emailService.sendNotificationEmail('gestor@exemplo.com', {
        title: 'Estoque Zerado',
        message: 'Produto X zerado',
        priority: 4,
      });

      expect(ok).toBe(true);
      expect(sendMail).toHaveBeenCalledTimes(1);

      const payload = sendMail.mock.calls[0][0];
      expect(payload.to).toBe('gestor@exemplo.com');
      expect(payload.subject).toBe('Estoque Zerado');
      expect(payload.text).toContain('Produto X zerado');
      expect(payload.from).toBe(config.smtp.from);
    })
  );

  it(
    'falha de envio é engolida (best-effort), não propaga',
    withSmtpConfigured(async (sendMail) => {
      sendMail.mockRejectedValue(new Error('SMTP fora do ar'));

      await expect(
        emailService.sendNotificationEmail('gestor@exemplo.com', {
          title: 'Teste',
          message: 'Teste',
        })
      ).resolves.toBe(false);
    })
  );
});

describe('notification.service: decisão de quem recebe email', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  /** Usuário com um perfil próprio e uma NotificationRule para o evento. */
  const userWithRule = async (rule: { email: boolean; minPriority?: number; enabled?: boolean }) => {
    const user = await createTestUser();
    const role = await testPrisma.role.create({
      data: { code: `ROLE-MAIL-${Math.random().toString(36).slice(2, 9)}`, name: 'Perfil' },
    });
    await testPrisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await testPrisma.notificationRule.create({
      data: {
        roleId: role.id,
        eventType: 'STOCK_BELOW_SAFETY',
        email: rule.email,
        minPriority: rule.minPriority ?? 1,
        enabled: rule.enabled ?? true,
      },
    });
    return user;
  };

  const resolve = (userIds: string[], priority = 4) =>
    notificationService.resolveEmailRecipients(userIds, {
      category: 'STOCK',
      eventType: 'STOCK_BELOW_SAFETY',
      priority,
    });

  it('regra do perfil com email=true autoriza o envio', async () => {
    const user = await userWithRule({ email: true });
    const recipients = await resolve([user.id]);
    expect(recipients.map((r) => r.id)).toEqual([user.id]);
  });

  it('sem regra e sem preferência, não envia (default é não enviar)', async () => {
    const user = await createTestUser();
    await expect(resolve([user.id])).resolves.toHaveLength(0);
  });

  it('regra com email=false não envia', async () => {
    const user = await userWithRule({ email: false });
    await expect(resolve([user.id])).resolves.toHaveLength(0);
  });

  it('regra desabilitada não envia', async () => {
    const user = await userWithRule({ email: true, enabled: false });
    await expect(resolve([user.id])).resolves.toHaveLength(0);
  });

  it('prioridade abaixo da minPriority da regra não envia', async () => {
    const user = await userWithRule({ email: true, minPriority: 4 });
    await expect(resolve([user.id], 3)).resolves.toHaveLength(0);
    await expect(resolve([user.id], 4)).resolves.toHaveLength(1);
  });

  it('preferência do usuário GANHA da regra do perfil', async () => {
    const user = await userWithRule({ email: true });
    await testPrisma.notificationPreference.create({
      data: { userId: user.id, category: 'STOCK', email: false },
    });

    await expect(resolve([user.id])).resolves.toHaveLength(0);
  });

  it('preferência habilitando email vale mesmo sem regra de perfil', async () => {
    const user = await createTestUser();
    await testPrisma.notificationPreference.create({
      data: { userId: user.id, category: 'STOCK', email: true },
    });

    await expect(resolve([user.id])).resolves.toHaveLength(1);
  });

  it('preferência desabilitada corta o envio', async () => {
    const user = await userWithRule({ email: true });
    await testPrisma.notificationPreference.create({
      data: { userId: user.id, category: 'STOCK', email: true, enabled: false },
    });

    await expect(resolve([user.id])).resolves.toHaveLength(0);
  });

  it('usuário inativo nunca recebe', async () => {
    const user = await userWithRule({ email: true });
    await testPrisma.user.update({ where: { id: user.id }, data: { active: false } });

    await expect(resolve([user.id])).resolves.toHaveLength(0);
  });
});

describe('notification.service: criação de notificação com SMTP ausente', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('create() persiste normalmente e não tenta abrir transporte', async () => {
    const user = await createTestUser();

    const notification = await notificationService.create({
      userId: user.id,
      type: 'ERROR',
      category: 'STOCK',
      eventType: 'STOCK_BELOW_SAFETY',
      title: 'Estoque Zerado',
      message: 'Produto X zerado',
      priority: 4,
    });

    expect(notification.id).toBeDefined();
    await expect(testPrisma.notification.count()).resolves.toBe(1);
    expect(mockedNodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('createBulk() persiste para todos e não tenta abrir transporte', async () => {
    const a = await createTestUser();
    const b = await createTestUser();

    await notificationService.createBulk([a.id, b.id], {
      type: 'WARNING',
      category: 'PRODUCTION',
      eventType: 'PRODUCTION_DELAYED',
      title: 'Atrasada',
      message: 'OP-1 atrasada',
      priority: 3,
    });

    await expect(testPrisma.notification.count()).resolves.toBe(2);
    expect(mockedNodemailer.createTransport).not.toHaveBeenCalled();
  });
});
