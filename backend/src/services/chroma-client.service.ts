import { ChromaClient } from 'chromadb';
import { config } from '../config/env';

/**
 * Wrapper fino sobre o cliente `chromadb`. Embeddings são SEMPRE
 * pré-computados por `ollama-client.service.ts` (bge-m3) — a coleção nunca
 * recebe `embeddingFunction`, por isso `getOrCreateCollection` passa
 * `embeddingFunction: null` explicitamente.
 */

export interface DocumentChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: { arquivo: string; indice: number };
}

export interface RetrievedChunk {
  document: string;
  metadata: { arquivo: string; indice: number };
  distance: number;
}

const COLLECTION_NAME = 'manuais_operacao';

let client: ChromaClient | null = null;

function getClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient({ host: config.assistant.chroma.host, port: config.assistant.chroma.port });
  }
  return client;
}

async function getCollection() {
  return getClient().getOrCreateCollection({
    name: COLLECTION_NAME,
    embeddingFunction: null,
    // Cosseno em vez do L2 padrão: embeddings de texto (bge-m3) se comparam
    // por direção, não por magnitude — é a métrica recomendada para busca
    // semântica de texto.
    configuration: { hnsw: { space: 'cosine' } },
  });
}

/** Apaga e recria a coleção — reindexação desta fase é sempre full (spec seção 3). */
export async function resetCollection(): Promise<void> {
  const c = getClient();
  try {
    await c.deleteCollection({ name: COLLECTION_NAME });
  } catch {
    // Coleção pode não existir ainda na primeira execução — ignorar.
  }
  await getCollection();
}

export async function upsertChunks(chunks: DocumentChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  const collection = await getCollection();
  await collection.add({
    ids: chunks.map((c) => c.id),
    embeddings: chunks.map((c) => c.embedding),
    documents: chunks.map((c) => c.text),
    metadatas: chunks.map((c) => c.metadata),
  });
}

export async function queryTopChunks(queryEmbedding: number[], topK: number): Promise<RetrievedChunk[]> {
  const collection = await getCollection();
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    include: ['documents', 'metadatas', 'distances'],
  });

  const rows = result.rows()[0] ?? [];
  return rows
    .filter((row) => row.document !== null && row.document !== undefined)
    .map((row) => ({
      document: row.document as string,
      metadata: row.metadata as { arquivo: string; indice: number },
      distance: row.distance ?? Infinity,
    }));
}
