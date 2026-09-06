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

export async function indexDocuments(
  docsDir: string = DOCS_DIR
): Promise<{ file: string; chunks: number }[]> {
  const files = fs.readdirSync(docsDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
  const summary: { file: string; chunks: number }[] = [];

  await resetCollection();

  for (const file of files) {
    const buffer = fs.readFileSync(path.join(docsDir, file));
    const text = await extractText(buffer);

    if (text.length === 0) {
      console.error(`❌ ${file}: sem camada de texto (PDF escaneado?) — não indexado`);
      summary.push({ file, chunks: 0 });
      continue;
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

    await upsertChunks(docChunks);
    summary.push({ file, chunks: docChunks.length });
    console.log(`✅ ${file}: ${docChunks.length} trechos indexados`);
  }

  return summary;
}

if (require.main === module) {
  indexDocuments()
    .then((summary) => {
      console.log('Indexação concluída:', summary);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Falha na indexação:', err);
      process.exit(1);
    });
}
