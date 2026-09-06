import { answerQuestion, NAO_ENCONTREI, FORA_ESCOPO } from '../../src/services/assistant.service';
import * as ollamaClient from '../../src/services/ollama-client.service';
import * as chromaClient from '../../src/services/chroma-client.service';
import { config } from '../../src/config/env';

jest.mock('../../src/services/ollama-client.service');
jest.mock('../../src/services/chroma-client.service');

const mockedOllama = ollamaClient as jest.Mocked<typeof ollamaClient>;
const mockedChroma = chromaClient as jest.Mocked<typeof chromaClient>;

describe('assistant.service.answerQuestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('responde com o texto fixo e NÃO chama o modelo quando nenhum chunk cruza o limiar', async () => {
    mockedOllama.embed.mockResolvedValue([0.1, 0.2]);
    mockedChroma.queryTopChunks.mockResolvedValue([
      { document: 'irrelevante', metadata: { arquivo: 'x.pdf', indice: 0 }, distance: config.assistant.maxCosineDistance + 0.1 },
    ]);

    const onToken = jest.fn();
    const onSources = jest.fn();
    const onDone = jest.fn();

    await answerQuestion('como fazer bolo?', [], { onToken, onSources, onDone });

    expect(onToken).toHaveBeenCalledWith('Não encontrei essa informação nos manuais do sistema.');
    expect(onSources).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
    expect(mockedOllama.chatStream).not.toHaveBeenCalled();
  });

  it('gera resposta via chatStream e cita as fontes quando há chunk relevante', async () => {
    mockedOllama.embed.mockResolvedValue([0.1, 0.2]);
    mockedChroma.queryTopChunks.mockResolvedValue([
      { document: 'Passo 1: confirme a contagem.', metadata: { arquivo: 'contagem.pdf', indice: 0 }, distance: 0.1 },
    ]);
    mockedOllama.chatStream.mockImplementation(async function* () {
      yield 'Primeiro ';
      yield 'passo.';
    });

    const onToken = jest.fn();
    const onSources = jest.fn();
    const onDone = jest.fn();

    await answerQuestion('qual o primeiro passo da contagem?', [], { onToken, onSources, onDone });

    expect(onToken).toHaveBeenNthCalledWith(1, 'Primeiro ');
    expect(onToken).toHaveBeenNthCalledWith(2, 'passo.');
    expect(onSources).toHaveBeenCalledWith([{ arquivo: 'contagem.pdf', trecho: 'Passo 1: confirme a contagem.' }]);
    expect(onDone).toHaveBeenCalled();
  });

  it('descarta chunks acima do limiar mesmo quando outros abaixo existem, mantendo só os relevantes na fonte', async () => {
    mockedOllama.embed.mockResolvedValue([0.1]);
    mockedChroma.queryTopChunks.mockResolvedValue([
      { document: 'relevante', metadata: { arquivo: 'a.pdf', indice: 0 }, distance: 0.1 },
      { document: 'irrelevante', metadata: { arquivo: 'b.pdf', indice: 0 }, distance: config.assistant.maxCosineDistance + 0.5 },
    ]);
    mockedOllama.chatStream.mockImplementation(async function* () {
      yield 'ok';
    });

    const onSources = jest.fn();
    await answerQuestion('pergunta', [], { onToken: jest.fn(), onSources, onDone: jest.fn() });

    expect(onSources).toHaveBeenCalledWith([{ arquivo: 'a.pdf', trecho: 'relevante' }]);
  });

  it('limita o histórico enviado ao modelo às últimas 6 mensagens e mantém a ordem', async () => {
    mockedOllama.embed.mockResolvedValue([0.1]);
    mockedChroma.queryTopChunks.mockResolvedValue([
      { document: 'doc', metadata: { arquivo: 'a.pdf', indice: 0 }, distance: 0.1 },
    ]);
    mockedOllama.chatStream.mockImplementation(async function* () {
      yield 'ok';
    });

    const history = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as const,
      content: `msg${i}`,
    }));

    await answerQuestion('pergunta atual', history, { onToken: jest.fn(), onSources: jest.fn(), onDone: jest.fn() });

    const sentMessages = mockedOllama.chatStream.mock.calls[0][0];
    // system + últimas 6 do histórico (msg4..msg9) + pergunta atual = 8
    expect(sentMessages).toHaveLength(8);
    expect(sentMessages[1]).toEqual({ role: 'user', content: 'msg4' });
    expect(sentMessages[7]).toEqual({ role: 'user', content: 'pergunta atual' });
  });

  it('inclui o system prompt com as regras de guardrail e o contexto recuperado na primeira mensagem', async () => {
    mockedOllama.embed.mockResolvedValue([0.1]);
    mockedChroma.queryTopChunks.mockResolvedValue([
      { document: 'conteúdo do manual', metadata: { arquivo: 'manual.pdf', indice: 0 }, distance: 0.1 },
    ]);
    mockedOllama.chatStream.mockImplementation(async function* () {
      yield 'ok';
    });

    await answerQuestion('pergunta', [], { onToken: jest.fn(), onSources: jest.fn(), onDone: jest.fn() });

    const sentMessages = mockedOllama.chatStream.mock.calls[0][0];
    expect(sentMessages[0].role).toBe('system');
    expect(sentMessages[0].content).toContain('Não encontrei essa informação nos manuais do sistema.');
    expect(sentMessages[0].content).toContain('conteúdo do manual');
    expect(sentMessages[0].content).toContain('manual.pdf');
  });

  it('trata um chunk com distance exatamente igual ao limiar como relevante (limiar é inclusivo)', async () => {
    mockedOllama.embed.mockResolvedValue([0.1]);
    mockedChroma.queryTopChunks.mockResolvedValue([
      { document: 'no limite', metadata: { arquivo: 'limite.pdf', indice: 0 }, distance: config.assistant.maxCosineDistance },
    ]);
    mockedOllama.chatStream.mockImplementation(async function* () {
      yield 'ok';
    });

    const onToken = jest.fn();
    const onSources = jest.fn();
    const onDone = jest.fn();

    await answerQuestion('pergunta', [], { onToken, onSources, onDone });

    expect(mockedOllama.chatStream).toHaveBeenCalled();
    expect(onSources).toHaveBeenCalledWith([{ arquivo: 'limite.pdf', trecho: 'no limite' }]);
    expect(onToken).not.toHaveBeenCalledWith('Não encontrei essa informação nos manuais do sistema.');
  });

  it('NÃO chama onSources quando o chunk passa o limiar mas o MODELO decide recusar (não encontrei)', async () => {
    mockedOllama.embed.mockResolvedValue([0.1]);
    mockedChroma.queryTopChunks.mockResolvedValue([
      { document: 'conteúdo relevante', metadata: { arquivo: 'manual.pdf', indice: 0 }, distance: 0.1 },
    ]);
    // Chunk passou o corte determinístico, mas o modelo (mockado) decide que
    // não sabe responder e gera a frase fixa via streaming, token a token.
    mockedOllama.chatStream.mockImplementation(async function* () {
      yield 'Não encontrei essa informação ';
      yield 'nos manuais do sistema.';
    });

    const onSources = jest.fn();
    const onDone = jest.fn();

    await answerQuestion('pergunta ambígua', [], { onToken: jest.fn(), onSources, onDone });

    expect(mockedOllama.chatStream).toHaveBeenCalled();
    expect(onSources).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('NÃO chama onSources quando o chunk passa o limiar mas o MODELO decide recusar (fora de escopo)', async () => {
    mockedOllama.embed.mockResolvedValue([0.1]);
    mockedChroma.queryTopChunks.mockResolvedValue([
      { document: 'conteúdo relevante', metadata: { arquivo: 'manual.pdf', indice: 0 }, distance: 0.1 },
    ]);
    mockedOllama.chatStream.mockImplementation(async function* () {
      yield 'Desculpe, sou um assistente focado ';
      yield 'exclusivamente nas operações deste sistema.';
    });

    const onSources = jest.fn();
    const onDone = jest.fn();

    await answerQuestion('qual a previsão do tempo?', [], { onToken: jest.fn(), onSources, onDone });

    expect(mockedOllama.chatStream).toHaveBeenCalled();
    expect(onSources).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalled();
  });

  it('exporta NAO_ENCONTREI e FORA_ESCOPO com os textos fixos usados no guardrail', () => {
    expect(NAO_ENCONTREI).toBe('Não encontrei essa informação nos manuais do sistema.');
    expect(FORA_ESCOPO).toBe('Desculpe, sou um assistente focado exclusivamente nas operações deste sistema.');
  });
});
