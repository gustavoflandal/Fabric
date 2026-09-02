import { Prisma } from '@prisma/client';

type TransactionClient = Prisma.TransactionClient;

/**
 * F4.7 do plano do WMS (WMS_IMPLEMENTATION_ANALYSIS.md, seção 5, Fase 4):
 * NUMERAÇÃO ATÔMICA DE DOCUMENTOS.
 *
 * O QUE ESTE ARQUIVO SUBSTITUI. Dois services geravam número assim:
 *
 *     const count = await prisma.purchaseReceipt.count();
 *     const receiptNumber = `REC-${ano}-${String(count + 1).padStart(4, '0')}`;
 *
 * e isso tem TRÊS defeitos, não um:
 *
 *   1. **Não é atômico.** `count()` e o `create()` são duas idas ao banco sem
 *      lock entre elas. Dois recebimentos simultâneos contam a mesma coisa e
 *      geram o MESMO número. Como a coluna não tem unique constraint, o banco
 *      aceita os dois — a divergência só aparece meses depois, na conciliação.
 *   2. **Reaproveita número.** `count()` conta linhas EXISTENTES. Cancelar o
 *      recebimento 7 faz o próximo nascer 7 de novo, agora apontando para outro
 *      material, outro fornecedor e outra nota fiscal.
 *   3. **Não reinicia por ano**, apesar de o formato `REC-AAAA-NNNN` prometer
 *      isso: o `count()` varre o histórico inteiro, então o primeiro documento
 *      de 2027 nasce com o número do último de 2026 + 1.
 *
 * COMO A SEQUÊNCIA RESOLVE (e por que este desenho e não outro):
 *
 *   * `document_sequences` é um contador que só ANDA PARA FRENTE — nunca conta
 *     linhas de outra tabela. Isso mata (2) e é o motivo de a tabela existir em
 *     vez de um `MAX(receiptNumber) + 1`, que teria exatamente o mesmo defeito
 *     do `count()` (deriva o próximo número de um estado que pode encolher).
 *   * O incremento é `UPDATE ... SET nextValue = nextValue + 1 WHERE code = ?`
 *     DENTRO da transação do chamador. O UPDATE adquire lock exclusivo da linha
 *     e o segura até o COMMIT; a segunda transação concorrente fica bloqueada
 *     no próprio UPDATE e, quando passa, já lê o valor incrementado. Não existe
 *     janela de read-then-write, e por isso NÃO é preciso `SELECT ... FOR
 *     UPDATE` antes — o UPDATE já é o lock. Isso mata (1).
 *   * O código da sequência inclui o ANO (`REC-2026`), então a virada de ano
 *     começa uma sequência nova sem nenhuma intervenção. Isso mata (3).
 *
 * ORDEM DE LOCK (regra que vale para quem for usar isto em outro fluxo):
 * a sequência é o lock MAIS EXTERNO da transação que a usa — pegue o número
 * ANTES de travar saldo, item de recebimento ou tarefa. A linha da sequência é
 * disputada por TODOS os documentos do mesmo tipo, então segurá-la enquanto se
 * espera por um lock de saldo transformaria a numeração num gargalo global e,
 * pior, num caminho por onde dois fluxos poderiam travar em ordens opostas.
 * Na prática ela é curta: o UPDATE não depende de mais nada.
 */

/** Sequências conhecidas. Prefixo do documento, sem o ano. */
export const SEQUENCE_PREFIXES = {
  /** `PurchaseReceipt.receiptNumber` → `REC-2026-0001` */
  PURCHASE_RECEIPT: 'REC',
  /** `PurchaseOrder.orderNumber` → `PC-2026-0001` */
  PURCHASE_ORDER: 'PC',
} as const;

export type SequencePrefix =
  (typeof SEQUENCE_PREFIXES)[keyof typeof SEQUENCE_PREFIXES];

/**
 * Reserva e devolve o PRÓXIMO valor da sequência `code`, dentro da transação do
 * chamador. O valor devolvido é exclusivo desta transação: ninguém mais o
 * recebe, mesmo que o COMMIT falhe depois (nesse caso o número é simplesmente
 * QUEIMADO — ver a nota abaixo).
 *
 * BURACO NA NUMERAÇÃO EM CASO DE ROLLBACK: se a transação abortar depois de
 * pegar o número, o incremento também é desfeito? **Não necessariamente** —
 * como o UPDATE participa da transação, um rollback devolve o contador. Isso é
 * o comportamento desejado aqui (não desperdiça número) e é seguro justamente
 * porque o lock só é liberado no fim da transação: nenhuma outra transação
 * chegou a enxergar o valor intermediário. O que NÃO se deve fazer é mover este
 * incremento para fora da transação do documento "para evitar contenção" —
 * seria trocar a garantia forte por buracos na numeração.
 */
export const nextSequenceValue = async (
  tx: TransactionClient,
  code: string
): Promise<number> => {
  // Criação preguiçosa da sequência. `INSERT ... ON DUPLICATE KEY UPDATE` em
  // vez de "SELECT, e se não existir INSERT": a segunda forma tem corrida entre
  // duas transações que criam a MESMA sequência pela primeira vez (as duas
  // veem "não existe" e uma estoura duplicate key). O `code = code` é um
  // no-op deliberado — a linha já existir é sucesso, não conflito.
  await tx.$executeRaw`
    INSERT INTO document_sequences (code, nextValue, updatedAt)
    VALUES (${code}, 1, NOW(3))
    ON DUPLICATE KEY UPDATE code = code
  `;

  // O LOCK. Daqui até o COMMIT do chamador, nenhuma outra transação passa desta
  // linha para esta sequência.
  await tx.$executeRaw`
    UPDATE document_sequences
    SET nextValue = nextValue + 1
    WHERE code = ${code}
  `;

  const rows = await tx.$queryRaw<{ nextValue: number }[]>`
    SELECT nextValue FROM document_sequences WHERE code = ${code}
  `;

  // A leitura é do próprio write desta transação (`nextValue` já incrementado),
  // então o valor RESERVADO é o anterior. Ler antes do UPDATE, em vez de
  // subtrair aqui, exigiria o `SELECT ... FOR UPDATE` que o UPDATE já tornou
  // desnecessário.
  return Number(rows[0].nextValue) - 1;
};

/**
 * Formata o número completo do documento (`REC-2026-0001`), reservando o
 * próximo valor da sequência do prefixo + ano.
 *
 * `padStart(4)` é o mesmo do formato antigo — e NÃO é um limite: o documento
 * 10.000 do ano vira `REC-2026-10000` (cinco dígitos), sem colisão e sem
 * truncamento. Zero à esquerda é formatação, não capacidade.
 */
export const nextDocumentNumber = async (
  tx: TransactionClient,
  prefix: SequencePrefix,
  reference: Date = new Date()
): Promise<string> => {
  const year = reference.getFullYear();
  const value = await nextSequenceValue(tx, `${prefix}-${year}`);

  return `${prefix}-${year}-${String(value).padStart(4, '0')}`;
};

export default {
  SEQUENCE_PREFIXES,
  nextSequenceValue,
  nextDocumentNumber,
};
