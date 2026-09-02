import Joi from 'joi';

/**
 * Query de `GET /notifications/dashboard`.
 *
 * `days` é o período do TOP DE EVENTOS (a série de tendência é fixa em 7 dias,
 * ver `notification.service.ts::getDashboard()`). Limite superior de 365 para
 * que a consulta não vire varredura do histórico inteiro a partir da query
 * string, e mínimo 1 porque período zero/negativo produziria uma janela no
 * futuro e devolveria sempre lista vazia — silenciosamente, que é pior.
 */
export const notificationDashboardQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).messages({
    'number.base': 'days deve ser um número inteiro de dias',
    'number.min': 'days deve ser no mínimo 1',
    'number.max': 'days deve ser no máximo 365',
  }),
});
