import request from 'supertest';
import { app } from '../../src/app';
import { testPrisma } from './db';
import { createTestPositionBalance, createUserWithPermissions } from './fixtures';

/**
 * Fase 4b do plano do WMS — helpers COMPARTILHADOS entre os arquivos de teste
 * de separação (F4.8/F4.9/F4.11) e de reposição (F4.10).
 *
 * POR QUE OS DOIS ASSUNTOS ESTÃO EM ARQUIVOS SEPARADOS (e este helper existe
 * para servir aos dois): `rate-limit.middleware.ts` mantém UM store em memória
 * indexado só por IP, compartilhado entre `generalLimiter` e `authLimiter` — ou
 * seja, toda requisição HTTP da suíte conta contra o limite de LOGIN (50 na
 * janela de teste). Como o store é de módulo, ele é recriado por ARQUIVO de
 * teste; dividir a Fase 4b em dois arquivos mantém cada um confortavelmente
 * abaixo do limite. (O acoplamento entre os dois limiters é um defeito real do
 * middleware, mas corrigi-lo é mexer em segurança de produção por causa de
 * teste — fica registrado aqui, não emendado de passagem.)
 */

/**
 * Permissões da superfície de armazém da Fase 4b.
 *
 * `tarefas_armazem` é o recurso NOVO de F4.9 (ver a nota em
 * `warehouse-task.routes.ts` sobre por que ele não reaproveita
 * `recebimentos_compra` como a Fase 4a fez).
 */
export const WAREHOUSE_PERMISSIONS = [
  { resource: 'stock', action: 'update' },
  { resource: 'stock', action: 'read' },
  { resource: 'tarefas_armazem', action: 'visualizar' },
  { resource: 'tarefas_armazem', action: 'executar' },
  { resource: 'tarefas_armazem', action: 'atribuir' },
];

export const setModule = (code: string, enabled: boolean) =>
  testPrisma.licensedModule.create({ data: { code, enabled } });

export const loginWarehouseUser = async (permissions = WAREHOUSE_PERMISSIONS) => {
  const user = await createUserWithPermissions(permissions);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test@Password123' });

  return { user, token: res.body.data.accessToken as string };
};

/**
 * Saldo agregado + saldo endereçado do mesmo produto, coerentes entre si.
 *
 * Escrito direto no banco (e não via `POST /stock/entry`) de propósito: o que
 * estes testes exercitam é a SAÍDA, e montar o estoque inicial pela API
 * acoplaria cada teste ao fluxo de entrada. `stock_balances` precisa existir
 * porque `reserveForOrder` valida o agregado nos DOIS modos (fail-fast).
 */
export const seedStock = async (
  productId: string,
  positions: {
    positionId: string;
    quantity: number;
    updatedAt?: Date;
    /**
     * Fase 5: o lote da LINHA de saldo. Omitido = a linha sem lote de sempre —
     * é o que todo teste anterior a esta fase continua criando.
     */
    lotId?: string | null;
  }[]
) => {
  const total = positions.reduce((sum, p) => sum + p.quantity, 0);

  await testPrisma.stockBalance.upsert({
    where: { productId },
    update: { quantity: total },
    create: { productId, quantity: total },
  });

  for (const position of positions) {
    const balance = await createTestPositionBalance(
      productId,
      position.positionId,
      position.quantity,
      position.lotId ?? null
    );

    // `updatedAt` é `@updatedAt` (o Prisma o sobrescreve em qualquer write) e é
    // ele que define a ordem do FIFO de F4.8. Para testar a ORDEM é preciso
    // forçá-lo, o que só dá para fazer em SQL cru.
    //
    // Fase 5: o `WHERE` passou a ser por `id` da linha — a mesma posição pode
    // ter várias linhas (uma por lote), e filtrar por (produto, posição)
    // carimbaria todas elas com o mesmo `updatedAt`, destruindo justamente a
    // ordem que o teste está montando.
    if (position.updatedAt) {
      await testPrisma.$executeRaw`
        UPDATE stock_position_balances
        SET updatedAt = ${position.updatedAt}
        WHERE id = ${balance.id}
      `;
    }
  }
};

export const reserveForOrder = (token: string, orderId: string) =>
  request(app)
    .post(`/api/v1/stock/reserve/${orderId}`)
    .set('Authorization', `Bearer ${token}`);

export const executeTask = (token: string, taskId: string, body: object = {}) =>
  request(app)
    .post(`/api/v1/warehouse-tasks/${taskId}/execute`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
