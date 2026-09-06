// backend/tests/services/chroma-client.service.test.ts
describe('chroma-client.service', () => {
  let mockCollection: {
    add: jest.Mock;
    query: jest.Mock;
  };

  beforeEach(() => {
    jest.resetModules();
    mockCollection = {
      add: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
    };

    jest.doMock('chromadb', () => ({
      ChromaClient: jest.fn().mockImplementation(() => ({
        getOrCreateCollection: jest.fn().mockResolvedValue(mockCollection),
        deleteCollection: jest.fn().mockResolvedValue(undefined),
      })),
    }));
  });

  it('upsertChunks não chama add() quando a lista está vazia', async () => {
    const { upsertChunks } = await import('../../src/services/chroma-client.service');
    await upsertChunks([]);
    expect(mockCollection.add).not.toHaveBeenCalled();
  });

  it('upsertChunks envia ids, embeddings, documents e metadatas alinhados por índice', async () => {
    const { upsertChunks } = await import('../../src/services/chroma-client.service');

    await upsertChunks([
      { id: 'a.pdf::0', text: 'trecho 1', embedding: [0.1], metadata: { arquivo: 'a.pdf', indice: 0 } },
      { id: 'a.pdf::1', text: 'trecho 2', embedding: [0.2], metadata: { arquivo: 'a.pdf', indice: 1 } },
    ]);

    expect(mockCollection.add).toHaveBeenCalledWith({
      ids: ['a.pdf::0', 'a.pdf::1'],
      embeddings: [[0.1], [0.2]],
      documents: ['trecho 1', 'trecho 2'],
      metadatas: [
        { arquivo: 'a.pdf', indice: 0 },
        { arquivo: 'a.pdf', indice: 1 },
      ],
    });
  });

  it('queryTopChunks retorna document/metadata/distance a partir da primeira linha de rows()', async () => {
    mockCollection.query.mockResolvedValue({
      rows: () => [
        [
          { id: 'a.pdf::0', document: 'trecho 1', metadata: { arquivo: 'a.pdf', indice: 0 }, distance: 0.12 },
          { id: 'a.pdf::1', document: 'trecho 2', metadata: { arquivo: 'a.pdf', indice: 1 }, distance: 0.45 },
        ],
      ],
    });

    const { queryTopChunks } = await import('../../src/services/chroma-client.service');
    const result = await queryTopChunks([0.1, 0.2], 2);

    expect(result).toEqual([
      { document: 'trecho 1', metadata: { arquivo: 'a.pdf', indice: 0 }, distance: 0.12 },
      { document: 'trecho 2', metadata: { arquivo: 'a.pdf', indice: 1 }, distance: 0.45 },
    ]);
    expect(mockCollection.query).toHaveBeenCalledWith(
      expect.objectContaining({ queryEmbeddings: [[0.1, 0.2]], nResults: 2 })
    );
  });

  it('queryTopChunks descarta linhas sem document (chunk deletado/corrompido)', async () => {
    mockCollection.query.mockResolvedValue({
      rows: () => [[{ id: 'x', document: null, metadata: null, distance: 0.9 }]],
    });

    const { queryTopChunks } = await import('../../src/services/chroma-client.service');
    const result = await queryTopChunks([0.1], 1);

    expect(result).toEqual([]);
  });
});
