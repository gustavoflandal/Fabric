import Joi from 'joi';

/**
 * F1.4 do plano do WMS. Joi é a convenção real do projeto para validação de
 * entrada (`middleware/validation.middleware.ts`), apesar de o texto do plano
 * mencionar Zod — seguimos o que o código já usa, para não abrir uma segunda
 * biblioteca de validação no mesmo backend.
 *
 * Só há rota de LEITURA nesta fase, então o que se valida é query string, via
 * `validateQuery()` (ver a nota lá sobre por que `req.query` não é reatribuído).
 */

/**
 * `GET /stock-positions/occupied` — escopo obrigatório.
 *
 * `.or()` em vez de deixar os dois opcionais: sem recorte, a consulta varreria
 * todas as posições com saldo da instalação. Rejeitar na borda dá uma mensagem
 * clara (400) em vez de um timeout numa base grande — a mesma checagem existe
 * no service, que é quem garante a regra para chamadores internos.
 */
export const occupiedPositionsQuerySchema = Joi.object({
  warehouseId: Joi.string().uuid().messages({
    'string.guid': 'warehouseId deve ser um UUID válido',
  }),
  structureId: Joi.string().uuid().messages({
    'string.guid': 'structureId deve ser um UUID válido',
  }),
})
  .or('warehouseId', 'structureId')
  // `unknown(true)`: `validateQuery()` não consegue aplicar `stripUnknown` (não
  // reatribui `req.query`), então rejeitar chave desconhecida transformaria um
  // `?_=timestamp` de cache-busting do cliente em 400. Um nome de filtro
  // digitado errado ainda é pego — cai no `.or()` acima.
  .unknown(true)
  .messages({
    'object.missing': 'Informe warehouseId ou structureId para delimitar a consulta',
  });
