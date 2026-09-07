import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  answerQuestion,
  type AssistantHistoryMessage,
  type AssistantSource,
  type ConsultaInfo,
} from '../services/assistant.service';
import { getUserWithPermissions, userHasPermission } from '../middleware/permission.middleware';
import { logger } from '../config/logger';

/**
 * Verifica se o usuário tem `stock:read` — decide apenas se as tools de
 * consulta de estoque (Fase 2) são oferecidas ao modelo, nunca bloqueia a
 * requisição (a permissão obrigatória do endpoint é `assistente_ia:usar`,
 * já checada por `requirePermission` na rota). Reaproveita as funções
 * extraídas de `permission.middleware.ts` para não duplicar a query.
 */
async function hasStockReadPermission(userId: string): Promise<boolean> {
  const user = await getUserWithPermissions(userId);
  if (!user) return false;
  return userHasPermission(user, 'stock', 'read');
}

/**
 * Handler SSE. Após `res.writeHead` (200 já enviado), erros NUNCA vão para
 * `next()`/`errorHandler` — chamar `res.status()` depois de headers enviados
 * lançaria ERR_HTTP_HEADERS_SENT. Em vez disso, o erro vira um evento `erro`
 * e a resposta é encerrada normalmente (contrato da spec, seção 4).
 */
export const chat = async (req: Request, res: Response, _next: NextFunction) => {
  const { message, history } = req.body as { message: string; history?: AssistantHistoryMessage[] };
  const { userId } = req as AuthRequest;

  // Cancela o streaming do Ollama se o cliente desconectar (fecha o widget,
  // navega para outra tela, cai a conexão) — sem isso, com o modelo rodando
  // CPU-only, o backend continuaria consumindo a resposta até o fim sem
  // ninguém para recebê-la.
  //
  // IMPORTANTE: escuta em `res` ('close' da CONEXÃO/socket), não em `req`.
  // `req` (IncomingMessage) emite 'close' assim que a MENSAGEM DE
  // REQUISIÇÃO termina de ser lida — no Node 22 + Express isso acontece
  // quase imediatamente após `express.json()` consumir o body, bem antes de
  // qualquer desconexão real do cliente. Usar `req.on('close', ...)`
  // abortava o AbortSignal ~1ms depois do handler começar, derrubando TODA
  // pergunta contra um Ollama real com `AbortError` (achado numa revisão
  // posterior). `res.on('close', ...)` só dispara quando o socket é
  // encerrado de fato. O guard `!res.writableEnded` evita abortar
  // desnecessariamente no caminho feliz, quando `res.end()` já foi chamado
  // e a conexão fecha normalmente logo em seguida.
  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Acumula a resposta completa e as fontes recebidas para a spec da
  // feature ("cada pergunta e resposta gera uma entrada no AuditLog") —
  // esta rota é SSE (usa `res.write`, nunca `res.json`), então o
  // `audit.middleware.ts` global não tem como capturar a resposta sozinho.
  // `res.locals.auditResponseBody` é o ponto de extensão que ele lê como
  // alternativa quando não há corpo de `res.json`.
  let respostaCompletaParaAuditoria = '';
  let fontesRecebidas: AssistantSource[] = [];
  let consultasRecebidas: ConsultaInfo[] = [];

  try {
    // Decide apenas se as tools de consulta de estoque (Fase 2) ficam
    // disponíveis para o modelo — nunca bloqueia a requisição, já que a
    // permissão obrigatória do endpoint (`assistente_ia:usar`) já foi checada
    // pelo `requirePermission` na rota. Fica DENTRO do try: essa checagem faz
    // uma query real no Prisma, e headers SSE já foram enviados (writeHead
    // acima) — se essa query falhar aqui fora do try, a rejeição escaparia
    // sem tratamento (Express 4 não encaminha rejeições de handler async
    // para o errorHandler sozinho), virando uma unhandled rejection capaz de
    // derrubar o processo inteiro em vez de só esta requisição.
    const hasStockAccess = await hasStockReadPermission(userId!);

    await answerQuestion(
      message,
      history ?? [],
      {
        onToken: (text) => {
          respostaCompletaParaAuditoria += text;
          send('token', { text });
        },
        onSources: (sources) => {
          fontesRecebidas = sources;
          send('fontes', { sources });
        },
        onConsulta: (info) => {
          consultasRecebidas = [...consultasRecebidas, info];
          send('consulta', info);
        },
        onDone: () => {
          res.locals.auditResponseBody = {
            resposta: respostaCompletaParaAuditoria,
            fontes: fontesRecebidas,
            consultas: consultasRecebidas,
          };
          send('fim', {});
          res.end();
        },
      },
      { signal: abortController.signal, hasStockAccess }
    );
  } catch (error) {
    logger.error('Erro no assistente de IA', { error: error instanceof Error ? error.message : error });
    res.locals.auditResponseBody = {
      resposta: respostaCompletaParaAuditoria,
      fontes: fontesRecebidas,
      consultas: consultasRecebidas,
    };
    send('erro', { message: 'Falha ao gerar resposta. Tente novamente.' });
    res.end();
  }
};
