# 📄 Instalação da Biblioteca PDF

## Biblioteca Necessária

Para gerar PDFs nos modais de orçamentos e pedidos de compra, é necessário instalar a biblioteca `jspdf` e `jspdf-autotable`.

## Comando de Instalação

Execute o seguinte comando no diretório `frontend`:

```bash
cd frontend
npm install jspdf jspdf-autotable
```

**Nota:** O pacote `jspdf-autotable` já inclui suas próprias definições de tipos, não é necessário instalar `@types/jspdf-autotable`.

## Funcionalidades Implementadas

### ✅ Orçamentos de Compra
- Botão "📄 Imprimir PDF" aparece quando status = APPROVED
- Gera PDF com:
  - Cabeçalho com número do orçamento
  - Dados do fornecedor e datas
  - Status e valor total
  - Tabela de itens com produtos, quantidades e preços
  - Rodapé com data de geração

### ✅ Pedidos de Compra
- Botão "📄 Imprimir PDF" aparece quando status = APPROVED ou CONFIRMED
- Gera PDF com:
  - Cabeçalho com número do pedido
  - Dados do fornecedor e datas
  - Status, condições de pagamento e valor total
  - Tabela de itens com produtos, quantidades pedidas/recebidas e preços
  - Rodapé com data de geração

## Arquivos Criados/Modificados

1. **`frontend/src/utils/pdf-generator.ts`** (NOVO)
   - Utilitário para gerar PDFs
   - Funções de formatação de moeda e data
   - Geração de tabelas automáticas

2. **`frontend/src/views/purchases/PurchaseQuotationsView.vue`**
   - Adicionado botão de impressão
   - Função `printQuotationPDF()`

3. **`frontend/src/views/purchases/PurchaseOrdersView.vue`**
   - Adicionado botão de impressão
   - Função `printOrderPDF()`

## Como Usar

1. Acesse a tela de Orçamentos ou Pedidos de Compra
2. Clique em "Ver" em um orçamento/pedido APROVADO
3. No modal de detalhes, clique em "📄 Imprimir PDF"
4. O PDF será gerado e baixado automaticamente

## Formato do PDF

- **Tamanho**: A4
- **Fonte**: Helvetica
- **Cores**: Azul para cabeçalhos de tabela
- **Margens**: 15mm
- **Rodapé**: Número de página e data de geração
- **Nome do arquivo**: 
  - Orçamentos: `Orcamento_ORC-2025-XXXX.pdf`
  - Pedidos: `Pedido_PC-2025-XXXX.pdf`

## Exemplo de Uso no Código

```typescript
// Gerar PDF de orçamento
const printQuotationPDF = (quotation: PurchaseQuotation) => {
  const pdf = generatePDF({
    title: 'ORÇAMENTO DE COMPRA',
    subtitle: quotation.quotationNumber,
    data: {
      'Fornecedor': quotation.supplier?.name,
      'Valor Total': formatCurrencyPDF(quotation.totalValue),
      // ... outros campos
    },
    items: quotation.items,
    itemsColumns: [
      { header: 'Produto', key: 'produto', align: 'left' },
      // ... outras colunas
    ],
  });
  
  pdf.save(`Orcamento_${quotation.quotationNumber}.pdf`);
};
```

## Observações

- ✅ PDFs são gerados no lado do cliente (navegador)
- ✅ Não requer servidor ou API adicional
- ✅ Funciona offline
- ✅ Formatação automática de moeda (R$) e datas (DD/MM/AAAA)
- ✅ Tabelas com quebra automática de página
- ✅ Cabeçalhos e rodapés em todas as páginas
