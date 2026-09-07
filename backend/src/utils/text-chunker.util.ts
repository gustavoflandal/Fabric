/**
 * Chunking de texto para indexação RAG — 500 caracteres por chunk, overlap de
 * 50 (mesmo valor da spec original, ver
 * docs/superpowers/specs/2026-09-06-assistente-ia-rag-manuais-design.md).
 * Overlap evita cortar um procedimento no meio de uma instrução.
 */

export interface TextChunk {
  text: string;
  index: number;
}

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

export function chunkText(text: string): TextChunk[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    chunks.push({ text: normalized.slice(start, end), index });
    index += 1;
    if (end === normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}
