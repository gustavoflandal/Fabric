/**
 * F3.1/F3.3 do plano do WMS
 * (docs/fase-2026-09-modernizacao/WMS_IMPLEMENTATION_ANALYSIS.md, seção 5,
 * Fase 3).
 *
 * Projeção do endereço embutida em toda leitura de item de contagem, e a
 * ordenação de rota que a acompanha.
 *
 * Mora em `utils/` pelo mesmo motivo de `stock-movement.util.ts`: é consumida
 * por `counting-item.service.ts` E por `counting-session.service.ts`, e nenhum
 * dos dois importa o outro hoje — criar essa dependência só para compartilhar
 * uma constante acoplaria os dois services sem necessidade.
 */

/**
 * Enxuta de propósito, no mesmo padrão de `MOVEMENT_POSITION_SELECT`
 * (stock.service.ts): quem lê um item de contagem precisa IDENTIFICAR e EXIBIR
 * o endereço — `code` é o que está na etiqueta que o contador escaneia —, além
 * dos quatro campos que definem a rota (F3.3). Não precisa do registro inteiro
 * da posição (capacidade de peso, dimensões, tipo de estrutura).
 */
export const COUNTING_POSITION_SELECT = {
  id: true,
  code: true,
  warehouseCode: true,
  streetCode: true,
  floor: true,
  position: true,
} as const;

/** O subconjunto de `StoragePosition` que define a rota de contagem. */
export interface CountingRoutePosition {
  warehouseCode: string;
  streetCode: string;
  floor: number;
  position: number;
}

/**
 * F3.3 — ROTA SERPENTINA.
 *
 * A ordenação pedida pelo plano é `warehouseCode -> streetCode -> floor ->
 * position`. Crescente nos quatro cumpriria o requisito, mas produziria uma
 * rota fisicamente ruim: ao terminar o andar 1 da rua R01 na posição 40, o
 * contador teria que voltar andando a rua inteira para começar o andar 2 na
 * posição 1.
 *
 * A serpentina inverte o sentido de leitura das POSIÇÕES a cada andar dentro da
 * mesma rua: andar 1 varre 1→N, andar 2 varre N→1, andar 3 volta a 1→N. O
 * contador sobe e desce no lugar onde já está. Armazém e rua nunca invertem —
 * são a "linha" da varredura, não a direção dela.
 *
 * A paridade usa o VALOR de `floor` (e não o índice do andar na lista): dois
 * itens do mesmo andar precisam ter a mesma direção independentemente de quais
 * outros andares a sessão sorteou — uma contagem cíclica pode gerar itens só
 * dos andares 2 e 4, e ainda assim o andar 2 tem que ser lido no mesmo sentido
 * em que seria numa contagem completa.
 */
export function compareCountingRoute(a: CountingRoutePosition, b: CountingRoutePosition): number {
  if (a.warehouseCode !== b.warehouseCode) {
    return a.warehouseCode < b.warehouseCode ? -1 : 1;
  }

  if (a.streetCode !== b.streetCode) {
    return a.streetCode < b.streetCode ? -1 : 1;
  }

  if (a.floor !== b.floor) {
    return a.floor - b.floor;
  }

  // Andar ímpar (1, 3, 5...) = ida; andar par (2, 4...) = volta.
  return a.floor % 2 === 0 ? b.position - a.position : a.position - b.position;
}
