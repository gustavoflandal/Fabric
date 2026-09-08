import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/config/database';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import { createTestWorkCenter, createUserWithPermissions } from '../helpers/fixtures';
import equipmentService from '../../src/services/equipment.service';
import { clearLicensedModuleCache } from '../../src/services/licensed-module.service';

/**
 * Fix 2b da revisão final (pós Task 4): `POST /maintenance-orders` (abrir
 * corretiva) exigia `manutencao:gerenciar`, contrariando a Global Constraint
 * do plano e a descrição gravada no seed para `executar` ("Iniciar/concluir
 * ordens de manutenção e abrir corretivas"). Corrigido para exigir
 * `manutencao:executar`. Este teste prova o contrato HTTP correto: quem só
 * tem `executar` consegue abrir corretiva; quem só tem `visualizar` recebe
 * 403.
 */

const login = async (permissions: { resource: string; action: string }[]) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return res.body.data.accessToken as string;
};

const EXECUTAR = { resource: 'manutencao', action: 'executar' };
const VISUALIZAR = { resource: 'manutencao', action: 'visualizar' };
const GERENCIAR = { resource: 'manutencao', action: 'gerenciar' };

describe('Integração: RBAC de POST /maintenance-orders (Fix 2b)', () => {
  beforeEach(async () => {
    clearLicensedModuleCache();
    await testPrisma.licensedModule.create({ data: { code: 'MANUTENCAO', enabled: true } });
  });

  afterEach(async () => {
    await cleanDatabase();
    clearLicensedModuleCache();
  });

  afterAll(async () => {
    await disconnectTestDb();
    await prisma.$disconnect();
  });

  const seedEquipment = async () => {
    const workCenter = await createTestWorkCenter();
    return equipmentService.create({
      code: 'EQP-RBAC',
      name: 'Equipamento RBAC',
      workCenterId: workCenter.id,
    });
  };

  it('permite abrir corretiva para usuário com apenas manutencao:executar', async () => {
    const equipment = await seedEquipment();
    const token = await login([EXECUTAR]);

    const res = await request(app)
      .post('/api/v1/maintenance-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipmentId: equipment.id, problemDescription: 'Ruído anormal' });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('CORRECTIVE');
  });

  it('rejeita abrir corretiva para usuário com apenas manutencao:visualizar', async () => {
    const equipment = await seedEquipment();
    const token = await login([VISUALIZAR]);

    const res = await request(app)
      .post('/api/v1/maintenance-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipmentId: equipment.id, problemDescription: 'Ruído anormal' });

    expect(res.status).toBe(403);
  });

  it('rejeita abrir corretiva para usuário com apenas manutencao:gerenciar (checagem é exata, sem hierarquia)', async () => {
    const equipment = await seedEquipment();
    const token = await login([GERENCIAR]);

    const res = await request(app)
      .post('/api/v1/maintenance-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipmentId: equipment.id, problemDescription: 'Ruído anormal' });

    expect(res.status).toBe(403);
  });

  it('permite abrir corretiva para o perfil MANAGER do seed (tem executar e gerenciar)', async () => {
    const equipment = await seedEquipment();
    const token = await login([EXECUTAR, GERENCIAR]);

    const res = await request(app)
      .post('/api/v1/maintenance-orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ equipmentId: equipment.id, problemDescription: 'Ruído anormal' });

    expect(res.status).toBe(201);
  });
});
