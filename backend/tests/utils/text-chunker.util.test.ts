import { chunkText } from '../../src/utils/text-chunker.util';

describe('chunkText', () => {
  it('retorna array vazio para texto vazio ou só espaços', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\n  ')).toEqual([]);
  });

  it('retorna um único chunk quando o texto cabe inteiro (<=500 chars)', () => {
    const text = 'Passo único de um procedimento curto.';
    const chunks = chunkText(text);
    expect(chunks).toEqual([{ text, index: 0 }]);
  });

  it('divide texto longo em múltiplos chunks de até 500 caracteres com overlap de 50', () => {
    const text = 'A'.repeat(1200);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.text.length).toBeLessThanOrEqual(500));
    // índice sequencial começando em 0
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
    // overlap: os últimos 50 caracteres de um chunk são os primeiros 50 do próximo
    expect(chunks[0].text.slice(-50)).toEqual(chunks[1].text.slice(0, 50));
  });

  it('normaliza espaços/quebras de linha múltiplas em um único espaço antes de dividir', () => {
    const text = 'Passo 1.\n\n\nPasso   2.';
    const chunks = chunkText(text);
    expect(chunks).toEqual([{ text: 'Passo 1. Passo 2.', index: 0 }]);
  });
});
