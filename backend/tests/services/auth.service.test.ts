import authService from '../../src/services/auth.service';
import { testPrisma, cleanDatabase, disconnectTestDb } from '../helpers/db';
import { PasswordUtil } from '../../src/utils/password.util';
import { JwtUtil } from '../../src/utils/jwt.util';

// Fase 3 do cronograma, item 3.4: auth.service.ts foi bastante alterado na
// Fase 2 (docs/fase-2026-09-modernizacao/02_CRONOGRAMA_IMPLEMENTACOES.md,
// itens 2.3/2.4) - bloqueio de conta por tentativas falhas e refresh tokens
// persistidos/rotacionados/revogáveis (antes eram puramente stateless). Este
// teste cobre esse comportamento de segurança diretamente contra o banco de
// teste real, sem mocks.

describe('auth.service (Fase 3, item 3.4)', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  let userCounter = 0;

  const KNOWN_PASSWORD = 'Test@Password123';

  async function createLoginableUser(overrides: Partial<{ password: string; active: boolean }> = {}) {
    userCounter += 1;
    const password = overrides.password ?? KNOWN_PASSWORD;
    const hashed = await PasswordUtil.hash(password);
    const user = await testPrisma.user.create({
      data: {
        email: `auth-test-${userCounter}@fabric.local`,
        name: `Usuário Auth Teste ${userCounter}`,
        password: hashed,
        active: overrides.active ?? true,
      },
    });
    return { user, password };
  }

  describe('login()', () => {
    it('com credenciais corretas retorna accessToken e refreshToken', async () => {
      const { user, password } = await createLoginableUser();

      const result = await authService.login({ email: user.email, password });

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.user).toEqual({ id: user.id, email: user.email, name: user.name });
    });

    it('com senha errada lança erro (credenciais inválidas)', async () => {
      const { user } = await createLoginableUser();

      await expect(
        authService.login({ email: user.email, password: 'SenhaErrada!23' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('rejeita usuário inativo mesmo com a senha correta', async () => {
      const { user, password } = await createLoginableUser({ active: false });

      await expect(
        authService.login({ email: user.email, password })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('login() - bloqueio de conta', () => {
    it('bloqueia a conta após 5 tentativas seguidas com senha errada; a 6ª falha mesmo com senha correta', async () => {
      const { user, password } = await createLoginableUser();

      for (let i = 0; i < 5; i += 1) {
        await expect(
          authService.login({ email: user.email, password: 'SenhaErrada!23' })
        ).rejects.toMatchObject({ statusCode: 401 });
      }

      // 6ª tentativa, com a senha CORRETA - a conta já deve estar bloqueada
      await expect(authService.login({ email: user.email, password })).rejects.toMatchObject({
        statusCode: 423,
        message: expect.stringMatching(/bloquead/i),
      });

      const dbUser = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(dbUser.lockedUntil).not.toBeNull();
      expect(dbUser.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it('login bem-sucedido zera failedLoginAttempts e lockedUntil', async () => {
      const { user, password } = await createLoginableUser();

      // Duas tentativas erradas primeiro (não o suficiente para bloquear)
      await expect(
        authService.login({ email: user.email, password: 'SenhaErrada!23' })
      ).rejects.toMatchObject({ statusCode: 401 });
      await expect(
        authService.login({ email: user.email, password: 'SenhaErrada!23' })
      ).rejects.toMatchObject({ statusCode: 401 });

      let dbUser = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(dbUser.failedLoginAttempts).toBe(2);

      await authService.login({ email: user.email, password });

      dbUser = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(dbUser.failedLoginAttempts).toBe(0);
      expect(dbUser.lockedUntil).toBeNull();
    });
  });

  describe('refreshToken()', () => {
    it('com token válido gera novo par accessToken+refreshToken e revoga o token antigo', async () => {
      const { user, password } = await createLoginableUser();
      const loginResult = await authService.login({ email: user.email, password });
      const oldRefreshToken = loginResult.refreshToken;

      const refreshed = await authService.refreshToken(oldRefreshToken);

      expect(refreshed.accessToken).toEqual(expect.any(String));
      expect(refreshed.refreshToken).toEqual(expect.any(String));
      expect(refreshed.refreshToken).not.toBe(oldRefreshToken);

      const oldPayload = JwtUtil.verifyRefreshToken(oldRefreshToken);
      const oldStored = await testPrisma.refreshToken.findUnique({ where: { jti: oldPayload.jti } });
      expect(oldStored?.revokedAt).not.toBeNull();

      // Reapresentar o token antigo (já revogado) deve falhar
      await expect(authService.refreshToken(oldRefreshToken)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('o novo refreshToken emitido continua utilizável (rotação em cadeia)', async () => {
      const { user, password } = await createLoginableUser();
      const loginResult = await authService.login({ email: user.email, password });

      const first = await authService.refreshToken(loginResult.refreshToken);
      const second = await authService.refreshToken(first.refreshToken);

      expect(second.accessToken).toEqual(expect.any(String));
      expect(second.refreshToken).not.toBe(first.refreshToken);
    });

    it('rejeita token com jti inexistente (nunca persistido)', async () => {
      const { user } = await createLoginableUser();

      // Gera um JWT de refresh válido do ponto de vista de assinatura/expiração,
      // mas nunca criado via login()/register() - portanto seu jti não existe
      // na tabela refresh_tokens.
      const neverPersisted = JwtUtil.generateRefreshToken({ userId: user.id, email: user.email });

      await expect(authService.refreshToken(neverPersisted.token)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('rejeita token já revogado (reuso após rotação)', async () => {
      const { user, password } = await createLoginableUser();
      const loginResult = await authService.login({ email: user.email, password });

      // Primeira rotação: revoga o token original
      await authService.refreshToken(loginResult.refreshToken);

      // Tentar usar o mesmo token original de novo deve falhar
      await expect(authService.refreshToken(loginResult.refreshToken)).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('rejeita token malformado/assinatura inválida', async () => {
      await expect(authService.refreshToken('token-invalido-qualquer')).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('logout()', () => {
    it('revoga todos os refresh tokens ativos do usuário', async () => {
      const { user, password } = await createLoginableUser();
      const loginResult = await authService.login({ email: user.email, password });

      await authService.logout(user.id);

      await expect(authService.refreshToken(loginResult.refreshToken)).rejects.toMatchObject({
        statusCode: 401,
      });

      const tokens = await testPrisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.every((t) => t.revokedAt !== null)).toBe(true);
    });

    it('revoga múltiplas sessões ativas (múltiplos refresh tokens do mesmo usuário)', async () => {
      const { user, password } = await createLoginableUser();
      const session1 = await authService.login({ email: user.email, password });
      const session2 = await authService.login({ email: user.email, password });

      await authService.logout(user.id);

      await expect(authService.refreshToken(session1.refreshToken)).rejects.toMatchObject({
        statusCode: 401,
      });
      await expect(authService.refreshToken(session2.refreshToken)).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe('register()', () => {
    it('cria usuário com a senha hasheada (não em texto puro) e emite tokens', async () => {
      const result = await authService.register({
        name: 'Novo Usuário',
        email: 'novo-usuario@fabric.local',
        password: KNOWN_PASSWORD,
      });

      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));

      const dbUser = await testPrisma.user.findUniqueOrThrow({ where: { id: result.user.id } });
      expect(dbUser.password).not.toBe(KNOWN_PASSWORD);
      expect(dbUser.password.startsWith('$2')).toBe(true); // hash bcrypt

      const isValid = await PasswordUtil.compare(KNOWN_PASSWORD, dbUser.password);
      expect(isValid).toBe(true);
    });

    it('persiste o refresh token emitido (utilizável em seguida via refreshToken())', async () => {
      const result = await authService.register({
        name: 'Outro Novo Usuário',
        email: 'outro-novo-usuario@fabric.local',
        password: KNOWN_PASSWORD,
      });

      const refreshed = await authService.refreshToken(result.refreshToken);
      expect(refreshed.accessToken).toEqual(expect.any(String));
    });

    it('rejeita e-mail já cadastrado', async () => {
      const { user } = await createLoginableUser();

      await expect(
        authService.register({ name: 'Outro', email: user.email, password: KNOWN_PASSWORD })
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});
