import { Request, Response, NextFunction } from 'express';
import { answerQuestion, type AssistantHistoryMessage, type AssistantSource } from '../services/assistant.service';
import { logger } from '../config/logger';

/**
 * Handler SSE. Após `res.writeHead` (200 já enviado), erros NUNCA vão para
 * `next()`/`errorHandler` — chamar `res.status()` depois de headers enviados
 * lançaria ERR_HTTP_HEADERS_SENT. Em vez disso, o erro vira um evento `erro`
 * e a resposta é encerrada normalmente (contrato da spec, seção 4).
 */
export const chat = async (req: Request, res: Response, _next: NextFunction) => {
  const { message, history } = req.body as { message: string; history?: AssistantHistoryMessage[] };

  // Cancela o streaming do Ollama se o cliente desconectar (fecha o widget,
  // navega para outra tela, cai a conexão) — sem isso, com o modelo rodando
  // CPU-only, o backend continuaria consumindo a resposta até o fim sem
  // ninguém para recebê-la.
  const abortController = new AbortController();
  req.on('close', () => abortController.abort());

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

  try {
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
        onDone: () => {
          res.locals.auditResponseBody = { resposta: respostaCompletaParaAuditoria, fontes: fontesRecebidas };
          send('fim', {});
          res.end();
        },
      },
      abortController.signal
    );
  } catch (error) {
    logger.error('Erro no assistente de IA', { error: error instanceof Error ? error.message : error });
    res.locals.auditResponseBody = { resposta: respostaCompletaParaAuditoria, fontes: fontesRecebidas };
    send('erro', { message: 'Falha ao gerar resposta. Tente novamente.' });
    res.end();
  }
};
