import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PdfOptions {
  title: string;
  subtitle?: string;
  data: Record<string, any>;
  items?: Array<Record<string, any>>;
  itemsColumns?: Array<{ header: string; key: string; align?: 'left' | 'center' | 'right' }>;
  supplierSignature?: boolean;
}

export const generatePDF = (options: PdfOptions) => {
  const { title, subtitle, data, items, itemsColumns, supplierSignature = false } = options;
  
  // Criar documento PDF
  const doc = new jsPDF();
  
  // Configurações
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = 20;
  
  // Cabeçalho
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, yPosition);
  yPosition += 10;
  
  if (subtitle) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(subtitle, margin, yPosition);
    yPosition += 10;
  }
  
  // Linha separadora
  doc.setDrawColor(200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;
  
  // Dados principais (excluindo Observações)
  doc.setFontSize(10);
  doc.setTextColor(0);
  
  const dataEntries = Object.entries(data).filter(([key]) => key !== 'Observações');
  const midPoint = Math.ceil(dataEntries.length / 2);
  const leftColumn = dataEntries.slice(0, midPoint);
  const rightColumn = dataEntries.slice(midPoint);
  
  // Coluna esquerda
  const startY = yPosition;
  leftColumn.forEach(([key, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${key}:`, margin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), margin + 50, yPosition);
    yPosition += 7;
  });
  
  // Coluna direita
  yPosition = startY;
  const rightMargin = pageWidth / 2 + 10;
  rightColumn.forEach(([key, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${key}:`, rightMargin, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(String(value), rightMargin + 50, yPosition);
    yPosition += 7;
  });
  
  // Calcular posição após as colunas
  yPosition = startY + Math.max(leftColumn.length, rightColumn.length) * 7 + 5;
  
  // Tabela de itens (se houver)
  if (items && items.length > 0 && itemsColumns) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Itens', margin, yPosition);
    yPosition += 5;
    
    // Preparar dados da tabela
    const tableHeaders = itemsColumns.map(col => col.header);
    const tableData = items.map(item => 
      itemsColumns.map(col => String(item[col.key] || ''))
    );
    
    // Gerar tabela
    autoTable(doc, {
      startY: yPosition,
      head: [tableHeaders],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontStyle: 'bold',
      },
      columnStyles: itemsColumns.reduce((acc, col, index) => {
        if (col.align) {
          acc[index] = { halign: col.align };
        }
        return acc;
      }, {} as Record<number, any>),
      margin: { left: margin, right: margin },
    });
    
    // Atualizar yPosition após a tabela
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // Observações (se houver) - posicionadas após a tabela
  if (data['Observações'] && data['Observações'] !== 'Nenhuma') {
    // Verificar se precisa de nova página
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Observações:', margin, yPosition);
    yPosition += 6;
    
    doc.setFont('helvetica', 'normal');
    const observacoes = String(data['Observações']);
    const splitObservacoes = doc.splitTextToSize(observacoes, pageWidth - (margin * 2));
    doc.text(splitObservacoes, margin, yPosition);
    yPosition += splitObservacoes.length * 5 + 5;
  }
  
  // Rodapé com assinatura do fornecedor (se solicitado)
  if (supplierSignature) {
    // Garantir espaço no final da página
    const signatureHeight = 40;
    const footerHeight = 15;
    const requiredSpace = signatureHeight + footerHeight;
    
    // Se não houver espaço suficiente, adicionar nova página
    if (yPosition > pageHeight - requiredSpace - 10) {
      doc.addPage();
      yPosition = 20;
    } else {
      // Posicionar no final da página
      yPosition = pageHeight - requiredSpace - 10;
    }
    
    // Linha separadora antes da assinatura
    doc.setDrawColor(200);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
    
    // Seção de assinatura
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Assinatura do Fornecedor:', margin, yPosition);
    yPosition += 15;
    
    // Linha para assinatura
    const signatureLineY = yPosition;
    doc.setDrawColor(0);
    doc.line(margin, signatureLineY, pageWidth / 2 - 10, signatureLineY);
    
    // Data
    doc.text('Data:', pageWidth / 2 + 10, yPosition - 15);
    doc.line(pageWidth / 2 + 25, signatureLineY, pageWidth - margin, signatureLineY);
    
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Assinatura', margin, yPosition);
    doc.text('Data', pageWidth / 2 + 25, yPosition);
  }
  
  // Rodapé com numeração de páginas
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    
    const footerY = pageHeight - 10;
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    doc.text(
      `Gerado em ${new Date().toLocaleString('pt-BR')}`,
      margin,
      footerY
    );
  }
  
  return doc;
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('pt-BR');
};
