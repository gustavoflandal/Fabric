import fs from 'fs';
import os from 'os';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { FIXTURES, writeFixturePdf } from '../../scripts/generate-fixture-pdfs';

describe('generate-fixture-pdfs', () => {
  it('gera PDFs cujo texto extraído contém o conteúdo esperado de cada procedimento', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixture-pdfs-'));

    for (const fixture of FIXTURES) {
      await writeFixturePdf(fixture, tmpDir);

      const filePath = path.join(tmpDir, fixture.filename);
      expect(fs.existsSync(filePath)).toBe(true);

      const parser = new PDFParse({ data: fs.readFileSync(filePath) });
      const result = await parser.getText();
      await parser.destroy();

      expect(result.text).toContain(fixture.title);
      fixture.paragraphs.forEach((p) => {
        // Só as primeiras palavras: pdfjs pode quebrar linha no meio do parágrafo.
        expect(result.text).toContain(p.slice(0, 20));
      });
    }

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
