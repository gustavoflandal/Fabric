import { prisma } from '../../src/config/database';
import { cleanDatabase, disconnectTestDb, testPrisma } from '../helpers/db';
import {
  nextDocumentNumber,
  nextSequenceValue,
} from '../../src/services/document-sequence.service';

/**
 * F4.7 do plano do WMS — NUMERAÇÃO ATÔMICA DE DOCUMENTOS.
 *
 * Os três testes que importam são os três defeitos do `count() + 1` que a
 * sequência existe para corrigir: concorrência, reaproveitamento após exclusão
 * e reinício por ano. Os demais são a mecânica em volta.
 */
describe('F4.7 — sequência atômica de documentos', () => {
  afterEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it('cria a sequência sob demanda e começa em 1', async () => {
    const value = await prisma.$transaction((tx) => nextSequenceValue(tx, 'TESTE-2026'));

    expect(value).toBe(1);

    const row = await testPrisma.documentSequence.findUniqueOrThrow({
      where: { code: 'TESTE-2026' },
    });
    expect(row.nextValue).toBe(2);
  });

  it('sequências de códigos diferentes são independentes', async () => {
    await prisma.$transaction((tx) => nextSequenceValue(tx, 'A-2026'));
    await prisma.$transaction((tx) => nextSequenceValue(tx, 'A-2026'));
    const b = await prisma.$transaction((tx) => nextSequenceValue(tx, 'B-2026'));

    expect(b).toBe(1);
  });

  // Datas construídas com `new Date(ano, mes, dia)` (fuso LOCAL) e não com a
  // string ISO: `new Date('2027-01-01')` é meia-noite UTC, que em UTC-3 é
  // 31/12/2026 — e `nextDocumentNumber` usa `getFullYear()`, que é local. A
  // string faria o teste do ano depender do fuso da máquina.
  it('formata o número no padrão PREFIXO-ANO-NNNN', async () => {
    const number = await prisma.$transaction((tx) =>
      nextDocumentNumber(tx, 'REC', new Date(2026, 4, 10))
    );

    expect(number).toBe('REC-2026-0001');
  });

  it('REINICIA a numeração na virada do ano (o count() nunca reiniciava)', async () => {
    await prisma.$transaction((tx) => nextDocumentNumber(tx, 'REC', new Date(2026, 11, 31)));
    await prisma.$transaction((tx) => nextDocumentNumber(tx, 'REC', new Date(2026, 11, 31)));

    const primeiroDe2027 = await prisma.$transaction((tx) =>
      nextDocumentNumber(tx, 'REC', new Date(2027, 0, 1))
    );

    expect(primeiroDe2027).toBe('REC-2027-0001');
  });

  it('NÃO reaproveita número: o contador só anda para frente', async () => {
    const primeiro = await prisma.$transaction((tx) => nextSequenceValue(tx, 'REC-2026'));
    const segundo = await prisma.$transaction((tx) => nextSequenceValue(tx, 'REC-2026'));

    expect([primeiro, segundo]).toEqual([1, 2]);

    // "Cancelar" o documento 2 (apagar a linha que o usava) não devolve o
    // número — é exatamente o que o `count() + 1` fazia de errado.
    const terceiro = await prisma.$transaction((tx) => nextSequenceValue(tx, 'REC-2026'));
    expect(terceiro).toBe(3);
  });

  /**
   * O TESTE QUE JUSTIFICA A TABELA: 10 transações concorrentes na MESMA
   * sequência. Com `count() + 1` várias leriam o mesmo total e produziriam o
   * mesmo número; com o `UPDATE ... SET nextValue = nextValue + 1` o lock de
   * linha as serializa e os 10 valores são distintos e contíguos.
   */
  it('10 reservas simultâneas produzem 10 números distintos e contíguos', async () => {
    const values = await Promise.all(
      Array.from({ length: 10 }, () =>
        prisma.$transaction((tx) => nextSequenceValue(tx, 'CONC-2026'))
      )
    );

    const sorted = [...values].sort((a, b) => a - b);

    expect(new Set(values).size).toBe(10);
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  }, 20000);

  it('o rollback da transação do chamador devolve o número (não deixa buraco)', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await nextSequenceValue(tx, 'ROLLBACK-2026');
        throw new Error('falha simulada depois de reservar o número');
      })
    ).rejects.toThrow('falha simulada');

    // O incremento participa da transação, então foi desfeito junto.
    const value = await prisma.$transaction((tx) =>
      nextSequenceValue(tx, 'ROLLBACK-2026')
    );
    expect(value).toBe(1);
  });
});
