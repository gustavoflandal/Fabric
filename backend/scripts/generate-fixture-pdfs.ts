import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

/**
 * Gera os 2 PDFs sintéticos usados para validar o pipeline de RAG fim a fim
 * (Task 4) e o golden set (Task 9) antes de existirem manuais reais — ver
 * docs/superpowers/specs/2026-09-06-assistente-ia-rag-manuais-design.md,
 * seção 1. Serão substituídos por manuais reais quando existirem.
 */

const DOCS_DIR = path.join(__dirname, '..', '..', 'docs', 'operacao');

export interface FixtureDoc {
  filename: string;
  title: string;
  paragraphs: string[];
}

export const FIXTURES: FixtureDoc[] = [
  {
    filename: 'procedimento-contagem-inventario.pdf',
    title: 'Procedimento de Contagem de Inventário',
    paragraphs: [
      'Este procedimento descreve como realizar a contagem cíclica de inventário no armazém.',
      'Passo 1: o operador acessa o Plano de Contagem atribuído a ele no sistema WMS e confirma o início da sessão de contagem.',
      'Passo 2: para cada posição de armazenagem listada, o operador lê o código de barras do endereço com o coletor e confirma que está na posição correta.',
      'Passo 3: o operador informa a quantidade física encontrada no endereço. Se a quantidade divergir do saldo do sistema, a divergência é registrada automaticamente para aprovação do gerente.',
      'Passo 4: divergências acima de 5% do saldo registrado exigem recontagem obrigatória antes de seguir para o próximo endereço.',
      'Passo 5: ao final da sessão, o gerente responsável revisa as divergências pendentes e aprova ou rejeita cada ajuste de estoque.',
    ],
  },
  {
    filename: 'procedimento-recebimento-nfe.pdf',
    title: 'Procedimento de Recebimento com NFe',
    paragraphs: [
      'Este procedimento descreve como registrar o recebimento de mercadorias acompanhadas de Nota Fiscal Eletrônica (NFe).',
      'Passo 1: o operador de recebimento importa o arquivo XML da NFe na tela de Recebimento do sistema, que extrai automaticamente os itens e quantidades do pedido de compra vinculado.',
      'Passo 2: o operador confere fisicamente cada item recebido contra a lista extraída da NFe, registrando a quantidade efetivamente conferida.',
      'Passo 3: itens com validade controlada exigem o registro do número do lote e da data de validade impressa na embalagem antes de prosseguir.',
      'Passo 4: após a conferência de todos os itens, o sistema gera automaticamente as tarefas de armazenagem (ALOCACAO) para que o operador de armazém guarde cada item em uma posição de armazenagem.',
      'Passo 5: divergências entre a quantidade da NFe e a quantidade conferida fisicamente devem ser registradas como ocorrência de recebimento antes de finalizar o processo.',
    ],
  },
];

export function writeFixturePdf(doc: FixtureDoc, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(outDir, { recursive: true });
    const pdfDoc = new PDFDocument({ margin: 50 });
    const filePath = path.join(outDir, doc.filename);
    const stream = fs.createWriteStream(filePath);

    pdfDoc.pipe(stream);
    pdfDoc.fontSize(18).text(doc.title, { align: 'left' });
    pdfDoc.moveDown();
    doc.paragraphs.forEach((paragraph) => {
      pdfDoc.fontSize(12).text(paragraph);
      pdfDoc.moveDown();
    });
    pdfDoc.end();

    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

async function main() {
  for (const fixture of FIXTURES) {
    await writeFixturePdf(fixture, DOCS_DIR);
    console.log(`✅ Gerado: ${fixture.filename}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Falha ao gerar PDFs de exemplo:', err);
    process.exit(1);
  });
}
