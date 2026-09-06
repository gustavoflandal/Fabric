import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { chunkText } from '../src/utils/text-chunker.util';
import { embed } from '../src/services/ollama-client.service';
import { resetCollection, upsertChunks, type DocumentChunk } from '../src/services/chroma-client.service';

const DOCS_DIR = path.join(__dirname, '..', '..', 'docs', 'operacao');

/**
 * `pdf-parse` (pdfjs por baixo) insere um separador `-- N of M --` entre
 * páginas no texto concatenado — não é conteúdo do documento, removido antes
 * do chunking para não vazar para uma citação de fonte.
 */
async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text.replace(/-- \d+ of \d+ --/g, '').trim();
  } finally {
    await parser.destroy();
  }
}

export interface IndexSummaryEntry {
  file: string;
  chunks: number;
  /** Presente apenas quando o PROCESSAMENTO do arquivo lançou uma exceção
   * (PDF corrompido, falha de embedding, etc.) — distinto do caso "0 chunks
   * porque o PDF não tem camada de texto", que é um resultado válido. */
  error?: string;
}

/**
 * Processa um único PDF: extrai texto, chunka e embute cada chunk. Não toca
 * no ChromaDB — isso é responsabilidade de `indexDocuments()`, que só reseta
 * a coleção depois que TODOS os arquivos tiverem sido processados (ver nota
 * abaixo).
 */
async function processFile(docsDir: string, file: string): Promise<{ summary: IndexSummaryEntry; chunks: DocumentChunk[] }> {
  const buffer = fs.readFileSync(path.join(docsDir, file));
  const text = await extractText(buffer);

  if (text.length === 0) {
    console.error(`❌ ${file}: sem camada de texto (PDF escaneado?) — não indexado`);
    return { summary: { file, chunks: 0 }, chunks: [] };
  }

  const textChunks = chunkText(text);
  const docChunks: DocumentChunk[] = [];

  for (const chunk of textChunks) {
    const embedding = await embed(chunk.text);
    docChunks.push({
      id: `${file}::${chunk.index}`,
      text: chunk.text,
      embedding,
      metadata: { arquivo: file, indice: chunk.index },
    });
  }

  console.log(`✅ ${file}: ${docChunks.length} trechos indexados`);
  return { summary: { file, chunks: docChunks.length }, chunks: docChunks };
}

/**
 * Reindexa todos os PDFs de `docsDir` no ChromaDB.
 *
 * IMPORTANTE (achado da revisão final de branch inteira): `resetCollection()`
 * só é chamado DEPOIS que todos os arquivos tiverem sido processados (texto
 * extraído, chunkado e embutido) — e só se pelo menos um deles tiver
 * produzido chunks com sucesso. Antes, `resetCollection()` rodava antes do
 * loop: um PDF corrompido no meio do processo (exceção não tratada) ou um
 * `docsDir` vazio/errado apagavam a coleção sem nada para substituí-la,
 * fazendo o assistente responder "não encontrei" para tudo, silenciosamente.
 * Agora um erro em um arquivo é capturado individualmente e não impede os
 * demais de serem indexados nem de irem para o índice final.
 */
export async function indexDocuments(
  docsDir: string = DOCS_DIR
): Promise<IndexSummaryEntry[]> {
  const files = fs.readdirSync(docsDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
  const summary: IndexSummaryEntry[] = [];
  const allChunks: DocumentChunk[] = [];

  for (const file of files) {
    try {
      const { summary: fileSummary, chunks } = await processFile(docsDir, file);
      summary.push(fileSummary);
      allChunks.push(...chunks);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ ${file}: falha ao processar — ${message}`);
      summary.push({ file, chunks: 0, error: message });
    }
  }

  if (allChunks.length > 0) {
    await resetCollection();
    await upsertChunks(allChunks);
  } else {
    console.error('❌ Nenhum trecho gerado a partir de nenhum arquivo — índice existente mantido intacto.');
  }

  return summary;
}

if (require.main === module) {
  indexDocuments()
    .then((summary) => {
      console.log('Indexação concluída:', summary);
      const hasFailure = summary.some((s) => s.error);
      process.exit(hasFailure ? 1 : 0);
    })
    .catch((err) => {
      console.error('Falha na indexação:', err);
      process.exit(1);
    });
}
