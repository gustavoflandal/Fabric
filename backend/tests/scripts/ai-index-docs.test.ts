import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import { embed } from '../../src/services/ollama-client.service';
import { resetCollection, upsertChunks } from '../../src/services/chroma-client.service';

jest.mock('fs');
jest.mock('pdf-parse');
jest.mock('../../src/services/ollama-client.service');
jest.mock('../../src/services/chroma-client.service');

const mockedFs = fs as jest.Mocked<typeof fs>;
const MockedPDFParse = PDFParse as jest.MockedClass<typeof PDFParse>;
const mockedEmbed = embed as jest.MockedFunction<typeof embed>;
const mockedResetCollection = resetCollection as jest.MockedFunction<typeof resetCollection>;
const mockedUpsertChunks = upsertChunks as jest.MockedFunction<typeof upsertChunks>;

describe('ai-index-docs.indexDocuments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.readdirSync.mockReturnValue(['manual-a.pdf', 'manual-escaneado.pdf', 'nota.txt'] as any);
    mockedFs.readFileSync.mockReturnValue(Buffer.from('fake-pdf-bytes'));
    mockedEmbed.mockResolvedValue([0.1, 0.2]);
    mockedResetCollection.mockResolvedValue(undefined);
    mockedUpsertChunks.mockResolvedValue(undefined);
  });

  it('ignora arquivos que não são .pdf', async () => {
    MockedPDFParse.mockImplementation(
      () =>
        ({
          getText: jest.fn().mockResolvedValue({ text: 'Passo 1: faça isso. Passo 2: faça aquilo.' }),
          destroy: jest.fn().mockResolvedValue(undefined),
        }) as any
    );

    const { indexDocuments } = await import('../../src/../scripts/ai-index-docs');
    const summary = await indexDocuments('/fake/docs');

    expect(summary.map((s) => s.file)).toEqual(['manual-a.pdf', 'manual-escaneado.pdf']);
  });

  it('indexa um PDF com texto: extrai, faz chunk, embute cada chunk e envia ao ChromaDB', async () => {
    MockedPDFParse.mockImplementation(
      () =>
        ({
          getText: jest.fn().mockResolvedValue({ text: 'Passo 1: faça isso.' }),
          destroy: jest.fn().mockResolvedValue(undefined),
        }) as any
    );

    const { indexDocuments } = await import('../../src/../scripts/ai-index-docs');
    const summary = await indexDocuments('/fake/docs');

    // resetCollection/upsertChunks só rodam UMA vez, no final, com os chunks
    // acumulados de TODOS os arquivos processados com sucesso (achado 3 da
    // revisão final: nunca resetar a coleção antes de ter tudo pronto).
    expect(mockedResetCollection).toHaveBeenCalledTimes(1);
    expect(mockedUpsertChunks).toHaveBeenCalledTimes(1);
    const manualA = summary.find((s) => s.file === 'manual-a.pdf');
    expect(manualA?.chunks).toBe(1);
    expect(mockedEmbed).toHaveBeenCalledWith('Passo 1: faça isso.');
    expect(mockedUpsertChunks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'manual-a.pdf::0',
          text: 'Passo 1: faça isso.',
          embedding: [0.1, 0.2],
          metadata: { arquivo: 'manual-a.pdf', indice: 0 },
        }),
      ])
    );
  });

  it('remove o separador de página "-- N of M --" inserido pelo pdf-parse antes do chunking', async () => {
    MockedPDFParse.mockImplementation(
      () =>
        ({
          getText: jest
            .fn()
            .mockResolvedValue({ text: 'Passo 1: faça isso.\n\n-- 1 of 2 --\n\nPasso 2: faça aquilo.' }),
          destroy: jest.fn().mockResolvedValue(undefined),
        }) as any
    );

    const { indexDocuments } = await import('../../src/../scripts/ai-index-docs');
    await indexDocuments('/fake/docs');

    mockedEmbed.mock.calls.forEach(([text]) => {
      expect(text).not.toContain('-- 1 of 2 --');
    });
    mockedUpsertChunks.mock.calls.forEach(([chunks]) => {
      chunks.forEach((chunk) => {
        expect(chunk.text).not.toContain('-- 1 of 2 --');
      });
    });
  });

  it('não indexa PDF sem camada de texto (escaneado) e registra 0 chunks', async () => {
    MockedPDFParse.mockImplementation(
      () =>
        ({
          getText: jest.fn().mockResolvedValue({ text: '   ' }),
          destroy: jest.fn().mockResolvedValue(undefined),
        }) as any
    );

    const { indexDocuments } = await import('../../src/../scripts/ai-index-docs');
    const summary = await indexDocuments('/fake/docs');

    summary.forEach((s) => expect(s.chunks).toBe(0));
    expect(mockedUpsertChunks).not.toHaveBeenCalled();
  });

  it('um arquivo que lança exceção durante extração/chunking/embedding não impede os demais de serem indexados', async () => {
    mockedFs.readdirSync.mockReturnValue(['manual-bom.pdf', 'manual-quebrado.pdf'] as any);
    MockedPDFParse.mockImplementationOnce(
      () =>
        ({
          getText: jest.fn().mockResolvedValue({ text: 'Passo 1: faça isso.' }),
          destroy: jest.fn().mockResolvedValue(undefined),
        }) as any
    ).mockImplementationOnce(
      () =>
        ({
          getText: jest.fn().mockRejectedValue(new Error('PDF corrompido')),
          destroy: jest.fn().mockResolvedValue(undefined),
        }) as any
    );

    const { indexDocuments } = await import('../../src/../scripts/ai-index-docs');
    const summary = await indexDocuments('/fake/docs');

    const bom = summary.find((s) => s.file === 'manual-bom.pdf');
    const quebrado = summary.find((s) => s.file === 'manual-quebrado.pdf');

    expect(bom?.chunks).toBe(1);
    expect(bom?.error).toBeUndefined();
    expect(quebrado?.chunks).toBe(0);
    expect(quebrado?.error).toContain('PDF corrompido');

    // O arquivo bom ainda deve ter sido indexado, mesmo com a falha do outro.
    expect(mockedResetCollection).toHaveBeenCalledTimes(1);
    expect(mockedUpsertChunks).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'manual-bom.pdf::0' }),
    ]);
  });

  it('NÃO chama resetCollection quando docsDir não tem nenhum PDF', async () => {
    mockedFs.readdirSync.mockReturnValue(['nota.txt', 'imagem.png'] as any);

    const { indexDocuments } = await import('../../src/../scripts/ai-index-docs');
    const summary = await indexDocuments('/fake/docs');

    expect(summary).toEqual([]);
    expect(mockedResetCollection).not.toHaveBeenCalled();
    expect(mockedUpsertChunks).not.toHaveBeenCalled();
  });

  it('NÃO chama resetCollection quando todos os PDFs falham ao processar', async () => {
    mockedFs.readdirSync.mockReturnValue(['a.pdf', 'b.pdf'] as any);
    MockedPDFParse.mockImplementation(
      () =>
        ({
          getText: jest.fn().mockRejectedValue(new Error('falha geral')),
          destroy: jest.fn().mockResolvedValue(undefined),
        }) as any
    );

    const { indexDocuments } = await import('../../src/../scripts/ai-index-docs');
    const summary = await indexDocuments('/fake/docs');

    summary.forEach((s) => {
      expect(s.chunks).toBe(0);
      expect(s.error).toContain('falha geral');
    });
    expect(mockedResetCollection).not.toHaveBeenCalled();
    expect(mockedUpsertChunks).not.toHaveBeenCalled();
  });
});
