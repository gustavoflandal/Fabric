import { Prisma, WarehouseTaskStatus, WarehouseTaskType } from '@prisma/client';
import { prisma } from '../config/database';
import { REPLENISHMENT_TASK_REFERENCE_TYPE } from './warehouse-task.service';

/**
 * F4.10 do plano do WMS — REPOSIÇÃO: quando o saldo de uma posição de PICKING
 * cai abaixo de um mínimo, gerar tarefa `REPLENISHMENT` a partir do pulmão.
 *
 * DUAS LACUNAS DE SCHEMA que o item deixou explicitamente em aberto, e como
 * cada uma foi resolvida:
 *
 * (a) O QUE É UMA POSIÇÃO "DE PICKING". Não existia esse conceito em
 *     `StoragePosition`. Resolvido com `isPickingArea Boolean @default(false)`,
 *     migration aditiva. Um booleano e não um enum de três valores
 *     (PICKING/PULMAO/AMBOS): a regra só faz duas perguntas — "é destino de
 *     reposição?" e "é origem candidata?" — e um terceiro valor não muda
 *     nenhuma das duas. Também NÃO foi para `WarehouseStructure`: é comum uma
 *     mesma rua ter o nível do chão como picking e os de cima como pulmão, então
 *     herdar da estrutura estaria errado no caso mais comum. Default `false`
 *     significa que uma instalação existente não ganha nenhuma tarefa de
 *     reposição até alguém marcar a primeira posição — silêncio, não ruído.
 *
 * (b) O QUE É O "MÍNIMO". Não foi criado campo novo de mínimo por posição, pelo
 *     motivo que o próprio item aponta: `Product.minStock` e
 *     `Product.safetyStock` já existem, já são mantidos pelo PCP e já
 *     significam exatamente "abaixo disto, falta material". O limiar usado é
 *     `max(minStock, safetyStock)` — o mais conservador dos dois, porque os dois
 *     campos coexistem no cadastro sem nenhuma regra que force um a ser maior
 *     que o outro, e escolher o menor deixaria o estoque de segurança sem
 *     efeito. Produto com os dois zerados nunca dispara reposição (é a
 *     configuração de quem não gerencia mínimo, e inventar um mínimo para ele
 *     seria gerar trabalho que ninguém pediu).
 *
 *     A INTERPRETAÇÃO, registrada porque é uma escolha e não um fato: o mínimo
 *     do PRODUTO passa a valer como mínimo DA POSIÇÃO DE PICKING. Não é a
 *     mesma coisa que o mínimo global (o produto pode ter 10 mil unidades no
 *     pulmão e o mínimo global folgado enquanto a posição de picking está
 *     vazia) — e é justamente por isso que a reposição é um evento separado do
 *     `STOCK_BELOW_SAFETY` que já existe: um diz "falta material na empresa", o
 *     outro diz "falta material NA MÃO DO OPERADOR". Um mínimo por posição
 *     seria mais preciso, mas é um campo novo que ninguém pediu e que a
 *     instalação teria de preencher posição a posição para o recurso funcionar.
 *
 * DIREÇÃO DE IMPORT: este arquivo é consumido por
 * `notification-detector.service.ts` e pelo job. Ele importa `prisma` e a
 * constante de `warehouse-task.service.ts` — e NÃO importa `stock.service.ts`
 * (que importaria o detector de volta e fecharia ciclo). Consequência: a
 * reposição CRIA a tarefa aqui, mas quem a EXECUTA (a transferência pulmão →
 * picking) é `warehouse-task-execution.service.ts`. É a mesma separação
 * "planejar aqui, movimentar lá" de F4.8.
 */

export interface ReplenishmentNeed {
  productId: string;
  productCode: string;
  productName: string;
  pickingPositionId: string;
  pickingPositionCode: string;
  currentQuantity: string;
  threshold: string;
  /** Quantidade da tarefa gerada; `null` quando não há pulmão com saldo. */
  quantity: string | null;
  sourcePositionId: string | null;
  sourcePositionCode: string | null;
  /** `null` quando não foi possível gerar tarefa (sem pulmão) ou já havia uma. */
  taskId: string | null;
  status: 'TASK_CREATED' | 'TASK_ALREADY_OPEN' | 'NO_SOURCE';
}

/**
 * Quanto repor: até `maxStock`, ou até o dobro do limiar quando não há
 * `maxStock` cadastrado.
 *
 * O dobro, e não o próprio limiar: repor exatamente até o mínimo deixa a
 * posição disparando reposição na primeira saída seguinte — o operador faria
 * uma viagem ao pulmão por pedido. O fator 2 é a folga mais simples que quebra
 * esse ciclo, e ele só entra em cena quando `maxStock` (que é a resposta certa
 * e já existe no cadastro) não foi preenchido.
 */
const REPLENISHMENT_FACTOR = 2;

/**
 * Varre as posições de picking e gera as tarefas de reposição necessárias.
 *
 * NÃO checa licença de módulo: quem chama é que decide (o detector de
 * notificação e o job fazem `isModuleEnabled('WMS')` antes, seguindo a seção
 * 3.4 de `04_ARQUITETURA_MODULAR_LICENCIAMENTO.md`). Manter a checagem fora
 * daqui é o que permite testar a regra de reposição sem montar a tabela de
 * licenciamento.
 */
export const detectReplenishmentNeeds = async (): Promise<ReplenishmentNeed[]> => {
  const pickingBalances = await prisma.stockPositionBalance.findMany({
    where: {
      storagePosition: { isPickingArea: true, blocked: false },
      // SEM filtro de quantidade — e é proposital. A posição de picking que
      // ZEROU é o caso mais urgente de todos, e `applyMovement` atualiza a
      // linha para 0 em vez de apagá-la, então ela continua aqui. O que este
      // método não enxerga é a posição de picking que NUNCA teve o produto:
      // nada no schema declara "este SKU mora neste endereço" (era o
      // `ProductLocation` que o plano descartou na seção 6), então a única
      // afirmação honesta sobre um endereço que nunca recebeu o produto é que
      // ele não é área de picking dele.
      product: {
        active: true,
        OR: [{ minStock: { gt: 0 } }, { safetyStock: { gt: 0 } }],
      },
    },
    select: {
      quantity: true,
      storagePositionId: true,
      productId: true,
      storagePosition: { select: { id: true, code: true } },
      product: {
        select: {
          id: true,
          code: true,
          name: true,
          minStock: true,
          safetyStock: true,
          maxStock: true,
        },
      },
    },
  });

  const needs: ReplenishmentNeed[] = [];

  for (const balance of pickingBalances) {
    const threshold = new Prisma.Decimal(
      Math.max(balance.product.minStock, balance.product.safetyStock)
    );

    if (threshold.lessThanOrEqualTo(0)) {
      continue;
    }

    const current = new Prisma.Decimal(balance.quantity);

    if (current.greaterThanOrEqualTo(threshold)) {
      continue;
    }

    const target =
      balance.product.maxStock !== null
        ? new Prisma.Decimal(balance.product.maxStock)
        : threshold.times(REPLENISHMENT_FACTOR);

    const needed = target.minus(current);

    const base = {
      productId: balance.product.id,
      productCode: balance.product.code,
      productName: balance.product.name,
      pickingPositionId: balance.storagePosition.id,
      pickingPositionCode: balance.storagePosition.code,
      currentQuantity: current.toString(),
      threshold: threshold.toString(),
    };

    // DEDUPE — a checagem que impede o job de empilhar uma tarefa nova a cada
    // execução enquanto a anterior não é executada. A chave é (produto,
    // posição de destino) entre as tarefas ABERTAS: é isso que a `reference`
    // apontando para a posição de picking torna consultável.
    const existing = await prisma.warehouseTask.findFirst({
      where: {
        type: WarehouseTaskType.REPLENISHMENT,
        status: { in: [WarehouseTaskStatus.PENDING, WarehouseTaskStatus.IN_PROGRESS] },
        productId: balance.product.id,
        toPositionId: balance.storagePosition.id,
      },
      select: { id: true },
    });

    if (existing) {
      needs.push({
        ...base,
        quantity: null,
        sourcePositionId: null,
        sourcePositionCode: null,
        taskId: existing.id,
        status: 'TASK_ALREADY_OPEN',
      });
      continue;
    }

    // A ORIGEM (pulmão): qualquer posição NÃO marcada como picking, não
    // bloqueada, com saldo do produto. FIFO por `updatedAt`, o mesmo critério
    // de F4.8 e pelo mesmo motivo — consistência entre "de onde sai material"
    // no picking e na reposição; um FIFO no picking alimentado por um LIFO na
    // reposição não seria FIFO nenhum.
    const source = await prisma.stockPositionBalance.findFirst({
      where: {
        productId: balance.product.id,
        quantity: { gt: 0 },
        storagePosition: { isPickingArea: false, blocked: false },
      },
      select: {
        quantity: true,
        storagePosition: { select: { id: true, code: true } },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });

    if (!source) {
      // Sem pulmão: não há tarefa a criar, mas HÁ o que notificar — é o caso em
      // que o material acabou no armazém inteiro, não só na frente de
      // separação. Gerar uma tarefa impossível de executar só entupiria a fila
      // do operador.
      needs.push({
        ...base,
        quantity: null,
        sourcePositionId: null,
        sourcePositionCode: null,
        taskId: null,
        status: 'NO_SOURCE',
      });
      continue;
    }

    // Nunca pedir mais do que o pulmão tem: a tarefa nasce executável ou não
    // nasce. Uma tarefa de 500 sobre um pulmão de 300 falharia na conclusão
    // ("estoque insuficiente na posição") depois de o operador já ter ido até
    // lá — o pior momento possível para descobrir.
    const quantity = Prisma.Decimal.min(needed, source.quantity);

    const task = await prisma.warehouseTask.create({
      data: {
        type: WarehouseTaskType.REPLENISHMENT,
        status: WarehouseTaskStatus.PENDING,
        // `reference` = a posição de picking que disparou (ver
        // REPLENISHMENT_TASK_REFERENCE_TYPE): a reposição é a única tarefa sem
        // documento por trás — nasce de um ESTADO do armazém, e o "documento"
        // dela é o próprio endereço.
        reference: balance.storagePosition.id,
        referenceType: REPLENISHMENT_TASK_REFERENCE_TYPE,
        productId: balance.product.id,
        quantity,
        fromPositionId: source.storagePosition.id,
        toPositionId: balance.storagePosition.id,
        // Posição de picking ZERADA para a produção enquanto a que só está
        // baixa ainda atende. Duas prioridades bastam; uma escala fina aqui
        // seria precisão inventada.
        priority: current.lessThanOrEqualTo(0) ? 3 : 1,
        sequence: null,
      },
      select: { id: true },
    });

    needs.push({
      ...base,
      quantity: quantity.toString(),
      sourcePositionId: source.storagePosition.id,
      sourcePositionCode: source.storagePosition.code,
      taskId: task.id,
      status: 'TASK_CREATED',
    });
  }

  return needs;
};

export default { detectReplenishmentNeeds };
