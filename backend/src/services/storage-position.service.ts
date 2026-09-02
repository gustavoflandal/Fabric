import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';

/**
 * F0.1 do plano do WMS: formato canônico do endereço de uma posição
 * (`ARM-RUA-AA-PP`). Antes essa concatenação vivia dentro de
 * getPositionsByStructure() e o resultado nunca era persistido — não dava para
 * buscar por código, indexar, nem pendurar saldo/movimento/etiqueta nele.
 *
 * Ponto único de verdade do formato: a coluna `storage_positions.code` é
 * gravada por aqui na criação, e o backfill da migration
 * `20260901230000_fase0_wms_fundacao` reproduz exatamente esta mesma regra em SQL.
 */
export const buildPositionCode = (parts: {
  warehouseCode: string;
  streetCode: string;
  floor: number;
  position: number;
}): string =>
  `${parts.warehouseCode}-${parts.streetCode}-` +
  `${parts.floor.toString().padStart(2, '0')}-` +
  `${parts.position.toString().padStart(2, '0')}`;

// Service para gerenciar posições de armazenagem
export const generatePositions = async (structureId: string) => {
  // Buscar a estrutura
  const structure = await prisma.warehouseStructure.findUnique({
    where: { id: structureId },
    include: { warehouse: true }
  });

  if (!structure) {
    throw new AppError(404, 'Estrutura não encontrada');
  }

  // Verificar se já existem posições
  const existingPositions = await prisma.storagePosition.count({
    where: { structureId }
  });

  if (existingPositions > 0) {
    throw new AppError(409, 'Esta estrutura já possui posições geradas. Exclua as posições existentes antes de gerar novas.');
  }

  // Gerar as posições
  const positions = [];
  
  for (let floor = 1; floor <= structure.floors; floor++) {
    for (let position = 1; position <= structure.positions; position++) {
      positions.push({
        structureId: structure.id,
        code: buildPositionCode({
          warehouseCode: structure.warehouse.code,
          streetCode: structure.streetCode,
          floor,
          position,
        }),
        warehouseCode: structure.warehouse.code,
        streetCode: structure.streetCode,
        floor,
        position,
        positionType: structure.positionType,
        weightCapacity: structure.weightCapacity,
        height: structure.height,
        width: structure.width,
        depth: structure.depth,
        maxHeight: structure.maxHeight,
        blocked: structure.blocked
      });
    }
  }

  // Criar as posições em lote.
  // F0.1: `code` é único GLOBALMENTE (é o endereço que o operador lê na
  // etiqueta), enquanto o banco só garantia unicidade de (estrutura, andar,
  // posição). Duas estruturas do mesmo armazém cadastradas com o mesmo
  // streetCode geram exatamente os mesmos endereços e colidem aqui — o que é a
  // resposta certa (dois lugares físicos não podem ter o mesmo endereço), mas
  // precisa sair como erro de negócio, e não como um P2002 cru do Prisma.
  try {
    await prisma.storagePosition.createMany({
      data: positions
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      throw new AppError(
        409,
        `Já existem posições com estes endereços (${structure.warehouse.code}-${structure.streetCode}-...). ` +
          'Verifique se outra estrutura deste armazém usa o mesmo código de rua.'
      );
    }
    throw error;
  }

  // Retornar as posições criadas
  return await prisma.storagePosition.findMany({
    where: { structureId },
    orderBy: [{ floor: 'asc' }, { position: 'asc' }]
  });
};

// F0.1: `code` agora vem da coluna persistida — não é mais concatenado em
// memória a cada leitura. O contrato de retorno é o mesmo de antes (o objeto
// continua tendo `code`), só a origem do valor mudou.
export const getPositionsByStructure = async (structureId: string) => {
  return await prisma.storagePosition.findMany({
    where: { structureId },
    orderBy: [{ floor: 'asc' }, { position: 'asc' }]
  });
};

/**
 * F0.2 do plano do WMS: busca de posição pelo endereço.
 * Pré-requisito de qualquer operação com coletor/scanner — o operador lê a
 * etiqueta da posição e o sistema precisa resolver isso para uma posição.
 */
export const getPositionByCode = async (code: string) => {
  const position = await prisma.storagePosition.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: {
      structure: {
        include: { warehouse: true }
      }
    }
  });

  if (!position) {
    throw new AppError(404, `Posição de armazenagem não encontrada para o código ${code}`);
  }

  return position;
};

/**
 * F1.1 do plano do WMS: guarda de exclusão de endereço.
 *
 * A partir da Fase 1, `stock_position_balances` e `stock_movements.positionId`
 * apontam para `storage_positions` com FK RESTRICT (nenhuma cascata — perder
 * saldo ou reescrever trilha de auditoria por deleção em cascata seria um bug
 * grave e silencioso). Sem esta checagem, tentar excluir um endereço em uso
 * vazaria um `P2003` cru do Prisma como erro 500.
 *
 * A checagem cobre DUAS coisas diferentes de propósito:
 *   * saldo (`stock_position_balances`): estado atual. É reversível — zere o
 *     saldo movimentando o material para outro endereço e a exclusão passa.
 *   * histórico (`stock_movements`): trilha de auditoria. Não é reversível, e
 *     não deve ser: um endereço por onde passou material não se apaga, se
 *     BLOQUEIA (`blocked = true`, que já existe desde a Fase 0).
 *
 * `deletePositionsByStructure` e `deletePosition` chamam isto ANTES do delete.
 * Isso não é uma garantia transacional (uma movimentação concorrente entre a
 * checagem e o delete ainda cairia na FK), é o que transforma o caso comum em
 * uma mensagem útil; a FK continua sendo a garantia real.
 */
export const assertPositionsDeletable = async (
  where: { structureId: string } | { id: string }
) => {
  const positions = await prisma.storagePosition.findMany({
    where,
    select: { id: true, code: true }
  });

  if (positions.length === 0) {
    return;
  }

  const positionIds = positions.map((p) => p.id);
  const codeById = new Map(positions.map((p) => [p.id, p.code]));

  const withBalance = await prisma.stockPositionBalance.findMany({
    where: { storagePositionId: { in: positionIds } },
    select: { storagePositionId: true },
    distinct: ['storagePositionId'],
    take: 5
  });

  if (withBalance.length > 0) {
    const codes = withBalance.map((b) => codeById.get(b.storagePositionId)).join(', ');
    throw new AppError(
      409,
      `Não é possível excluir: há saldo de estoque registrado nas posições ${codes}. ` +
        'Movimente o material para outro endereço antes de excluir.'
    );
  }

  // F2.1: a movimentação aponta para a posição por DOIS lados desde a Fase 2.
  // A checagem tem que olhar os dois — considerar só a origem deixaria passar a
  // exclusão de um endereço que só apareceu como DESTINO, e o delete então
  // estouraria na FK como 500 em vez de virar o 409 explicativo abaixo.
  const withMovements = await prisma.stockMovement.findMany({
    where: {
      OR: [
        { fromPositionId: { in: positionIds } },
        { toPositionId: { in: positionIds } }
      ]
    },
    select: { fromPositionId: true, toPositionId: true },
    take: 5
  });

  if (withMovements.length > 0) {
    // `distinct` não serve com o OR acima (distinguiria pelo par, não pela
    // posição), então a deduplicação é feita aqui: uma mesma posição pode
    // aparecer como origem numa linha e destino em outra.
    const usedCodes = new Set<string>();
    for (const movement of withMovements) {
      for (const id of [movement.fromPositionId, movement.toPositionId]) {
        const code = id ? codeById.get(id) : undefined;
        if (code) {
          usedCodes.add(code);
        }
      }
    }
    const codes = [...usedCodes].join(', ');
    throw new AppError(
      409,
      `Não é possível excluir: há histórico de movimentação nas posições ${codes}. ` +
        'Para aposentar um endereço que já foi usado, bloqueie-o (blocked) em vez de excluí-lo.'
    );
  }
};

export const deletePositionsByStructure = async (structureId: string) => {
  await assertPositionsDeletable({ structureId });

  const result = await prisma.storagePosition.deleteMany({
    where: { structureId }
  });

  return result.count;
};

export const updatePosition = async (positionId: string, data: any) => {
  return await prisma.storagePosition.update({
    where: { id: positionId },
    data
  });
};

export const deletePosition = async (positionId: string) => {
  await assertPositionsDeletable({ id: positionId });

  return await prisma.storagePosition.delete({
    where: { id: positionId }
  });
};

/**
 * F2.4 do plano do WMS — histórico de movimentação de um ENDEREÇO.
 *
 * A pergunta que este endpoint responde é "o que passou por esta posição?", e
 * a resposta inclui as duas direções: a posição pode ter sido ORIGEM
 * (`fromPositionId`: saída ou perna de saída de uma transferência) ou DESTINO
 * (`toPositionId`: entrada ou perna de chegada). Daí o `OR` — atendido pelos
 * dois índices de coluna única criados na migration da Fase 2.
 *
 * `direction` é derivado e devolvido pronto para o consumidor: sem ele, cada
 * linha exigiria que o cliente comparasse os dois ids com o da posição
 * consultada para saber se aquele movimento tirou ou pôs material ali — que é
 * a única informação que ele realmente quer.
 */
export const getPositionMovements = async (
  positionId: string,
  filters?: { limit?: number; productId?: string }
) => {
  const position = await prisma.storagePosition.findUnique({
    where: { id: positionId },
    select: {
      id: true,
      code: true,
      warehouseCode: true,
      streetCode: true,
      floor: true,
      position: true,
      positionType: true,
      blocked: true
    }
  });

  if (!position) {
    throw new AppError(404, 'Posição de armazenagem não encontrada');
  }

  const movements = await prisma.stockMovement.findMany({
    where: {
      OR: [{ fromPositionId: positionId }, { toPositionId: positionId }],
      ...(filters?.productId ? { productId: filters.productId } : {})
    },
    include: {
      product: { select: { id: true, code: true, name: true } },
      user: { select: { id: true, name: true } },
      fromPosition: { select: { id: true, code: true } },
      toPosition: { select: { id: true, code: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 100
  });

  return {
    position,
    movements: movements.map((movement) => ({
      ...movement,
      // IN  = o material CHEGOU nesta posição (ela é o destino)
      // OUT = o material SAIU desta posição (ela é a origem)
      direction: movement.toPositionId === positionId ? 'IN' : 'OUT'
    }))
  };
};
