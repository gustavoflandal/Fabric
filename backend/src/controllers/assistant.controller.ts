import { Request, Response, NextFunction } from 'express';
import { answerQuestion, type AssistantHistoryMessage } from '../services/assistant.service';
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

  try {
    await answerQuestion(
      message,
      history ?? [],
      {
        onToken: (text) => send('token', { text }),
        onSources: (sources) => send('fontes', { sources }),
        onDone: () => {
          send('fim', {});
          res.end();
        },
      },
      abortController.signal
    );
  } catch (error) {
    logger.error('Erro no assistente de IA', { error: error instanceof Error ? error.message : error });
    send('erro', { message: 'Falha ao gerar resposta. Tente novamente.' });
    res.end();
  }
};
