import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🛒 Iniciando seed de orçamentos e pedidos de compra...\n');

  try {
    // Buscar matérias-primas e fornecedores
    const rawMaterials = await prisma.product.findMany({
      where: {
        type: { in: ['raw_material', 'packaging'] },
        active: true,
      },
    });

    const suppliers = await prisma.supplier.findMany({
      where: { active: true },
    });

    const users = await prisma.user.findMany();

    if (rawMaterials.length === 0 || suppliers.length === 0 || users.length === 0) {
      console.log('⚠️  Produtos, fornecedores ou usuários não encontrados.');
      return;
    }

    console.log(`✅ Encontrados ${rawMaterials.length} produtos, ${suppliers.length} fornecedores e ${users.length} usuários`);

    // Limpar dados antigos
    console.log('🗑️  Limpando dados antigos...');
    await prisma.purchaseReceiptItem.deleteMany({});
    await prisma.purchaseReceipt.deleteMany({});
    await prisma.purchaseOrderItem.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.purchaseQuotationItem.deleteMany({});
    await prisma.purchaseQuotation.deleteMany({});
    console.log('✅ Dados antigos removidos\n');

    const today = new Date();
    const adminUser = users.find(u => u.email.includes('admin')) || users[0];

    // ========== ORÇAMENTOS DE COMPRA ==========
    console.log('💰 Criando orçamentos de compra...\n');

    const quotations = [];

    // Criar 6 orçamentos em diferentes status
    for (let i = 0; i < 6; i++) {
      const supplier = suppliers[i % suppliers.length];
      const status = i < 2 ? 'PENDING' : i < 4 ? 'APPROVED' : 'REJECTED';
      
      const requestDate = new Date(today);
      requestDate.setDate(requestDate.getDate() - (20 - i * 3));

      const dueDate = new Date(requestDate);
      dueDate.setDate(dueDate.getDate() + 7);

      // Selecionar 2-4 produtos aleatórios
      const numItems = 2 + Math.floor(Math.random() * 3);
      const selectedProducts = [];
      for (let j = 0; j < numItems; j++) {
        const product = rawMaterials[Math.floor(Math.random() * rawMaterials.length)];
        if (!selectedProducts.find(p => p.id === product.id)) {
          selectedProducts.push(product);
        }
      }

      const quotation = await prisma.purchaseQuotation.create({
        data: {
          quotationNumber: `ORC-${today.getFullYear()}-${String(1000 + i).padStart(4, '0')}`,
          supplierId: supplier.id,
          requestDate,
          dueDate,
          status,
          notes: status === 'PENDING' 
            ? 'Aguardando resposta do fornecedor'
            : status === 'APPROVED'
            ? 'Orçamento aprovado - converter em pedido'
            : 'Preço acima do esperado',
          createdBy: adminUser.id,
        },
      });

      // Criar itens do orçamento
      let totalValue = 0;
      for (const product of selectedProducts) {
        const quantity = 100 + Math.floor(Math.random() * 400); // 100-500
        const unitPrice = (product.standardCost || 10) * (0.9 + Math.random() * 0.2); // ±10%
        const itemTotal = quantity * unitPrice;
        totalValue += itemTotal;

        await prisma.purchaseQuotationItem.create({
          data: {
            quotationId: quotation.id,
            productId: product.id,
            quantity,
            unitPrice,
            totalPrice: itemTotal,
            notes: `Cotação para ${product.name}`,
          },
        });
      }

      // Atualizar valor total
      await prisma.purchaseQuotation.update({
        where: { id: quotation.id },
        data: { totalValue },
      });

      quotations.push({ ...quotation, totalValue, itemCount: selectedProducts.length });
      
      const statusEmoji = status === 'PENDING' ? '⏳' : status === 'APPROVED' ? '✅' : '❌';
      console.log(`  ${statusEmoji} ${quotation.quotationNumber} - ${supplier.name} - R$ ${totalValue.toFixed(2)} (${selectedProducts.length} itens) - ${status}`);
    }

    console.log(`\n✅ ${quotations.length} orçamentos criados\n`);

    // ========== PEDIDOS DE COMPRA ==========
    console.log('📦 Criando pedidos de compra...\n');

    const orders = [];

    // Criar 8 pedidos em diferentes status
    const orderStatuses = [
      'PENDING', 'PENDING',
      'APPROVED', 'APPROVED',
      'CONFIRMED', 'CONFIRMED',
      'PARTIALLY_RECEIVED', 'RECEIVED'
    ];

    for (let i = 0; i < 8; i++) {
      const supplier = suppliers[i % suppliers.length];
      const status = orderStatuses[i];
      
      const orderDate = new Date(today);
      orderDate.setDate(orderDate.getDate() - (30 - i * 3));

      const expectedDate = new Date(orderDate);
      expectedDate.setDate(expectedDate.getDate() + supplier.leadTime);

      // Selecionar 2-5 produtos aleatórios
      const numItems = 2 + Math.floor(Math.random() * 4);
      const selectedProducts = [];
      for (let j = 0; j < numItems; j++) {
        const product = rawMaterials[Math.floor(Math.random() * rawMaterials.length)];
        if (!selectedProducts.find(p => p.id === product.id)) {
          selectedProducts.push(product);
        }
      }

      const order = await prisma.purchaseOrder.create({
        data: {
          orderNumber: `PC-${today.getFullYear()}-${String(2000 + i).padStart(4, '0')}`,
          supplierId: supplier.id,
          orderDate,
          expectedDate,
          status,
          paymentTerms: supplier.paymentTerms || '30 dias',
          totalValue: 0,
          notes: status === 'PENDING'
            ? 'Pedido aguardando aprovação'
            : status === 'APPROVED'
            ? 'Pedido aprovado - aguardando confirmação do fornecedor'
            : status === 'CONFIRMED'
            ? 'Pedido confirmado pelo fornecedor'
            : status === 'PARTIALLY_RECEIVED'
            ? 'Recebimento parcial - aguardando saldo'
            : 'Pedido recebido completamente',
          createdBy: adminUser.id,
        },
      });

      // Criar itens do pedido
      let totalValue = 0;
      const orderItems = [];
      
      for (const product of selectedProducts) {
        const quantity = 200 + Math.floor(Math.random() * 800); // 200-1000
        const unitPrice = (product.standardCost || 10) * (0.95 + Math.random() * 0.1); // ±5%
        const itemTotal = quantity * unitPrice;
        totalValue += itemTotal;

        const receivedQty = status === 'RECEIVED' 
          ? quantity 
          : status === 'PARTIALLY_RECEIVED'
          ? Math.floor(quantity * (0.5 + Math.random() * 0.3)) // 50-80%
          : 0;

        const item = await prisma.purchaseOrderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity,
            receivedQty,
            unitPrice,
            totalPrice: itemTotal,
            notes: `Pedido de ${product.name}`,
          },
        });

        orderItems.push(item);
      }

      // Atualizar valor total
      await prisma.purchaseOrder.update({
        where: { id: order.id },
        data: { totalValue },
      });

      // Criar recebimentos se aplicável
      if (status === 'PARTIALLY_RECEIVED' || status === 'RECEIVED') {
        const receiptDate = new Date(expectedDate);
        receiptDate.setDate(receiptDate.getDate() + Math.floor(Math.random() * 3)); // 0-3 dias após data esperada

        const receipt = await prisma.purchaseReceipt.create({
          data: {
            receiptNumber: `REC-${today.getFullYear()}-${String(3000 + i).padStart(4, '0')}`,
            orderId: order.id,
            receiptDate,
            notes: status === 'RECEIVED' 
              ? 'Recebimento completo conforme pedido'
              : 'Recebimento parcial - saldo em trânsito',
            receivedBy: adminUser.id,
          },
        });

        // Criar itens do recebimento
        for (const item of orderItems) {
          if (item.receivedQty > 0) {
            await prisma.purchaseReceiptItem.create({
              data: {
                receiptId: receipt.id,
                orderItemId: item.id,
                productId: item.productId,
                quantity: item.receivedQty,
                acceptedQty: item.receivedQty,
                rejectedQty: 0,
                notes: `Recebido ${item.receivedQty} unidades`,
              },
            });
          }
        }
      }

      orders.push({ ...order, totalValue, itemCount: selectedProducts.length });
      
      const statusEmoji = status === 'PENDING' ? '⏳' 
        : status === 'APPROVED' ? '✅' 
        : status === 'CONFIRMED' ? '📋'
        : status === 'PARTIALLY_RECEIVED' ? '📦'
        : '✔️';
      
      console.log(`  ${statusEmoji} ${order.orderNumber} - ${supplier.name} - R$ ${totalValue.toFixed(2)} (${selectedProducts.length} itens) - ${status}`);
    }

    console.log(`\n✅ ${orders.length} pedidos de compra criados\n`);

    // ========== RESUMO ==========
    console.log('📊 Resumo Geral:\n');
    
    console.log('Orçamentos:');
    console.log(`  - Pendentes: ${quotations.filter(q => q.status === 'PENDING').length}`);
    console.log(`  - Aprovados: ${quotations.filter(q => q.status === 'APPROVED').length}`);
    console.log(`  - Rejeitados: ${quotations.filter(q => q.status === 'REJECTED').length}`);
    console.log(`  - Total: ${quotations.length}`);
    console.log(`  - Valor Total: R$ ${quotations.reduce((sum, q) => sum + q.totalValue, 0).toFixed(2)}`);

    console.log('\nPedidos de Compra:');
    console.log(`  - Pendentes: ${orders.filter(o => o.status === 'PENDING').length}`);
    console.log(`  - Aprovados: ${orders.filter(o => o.status === 'APPROVED').length}`);
    console.log(`  - Confirmados: ${orders.filter(o => o.status === 'CONFIRMED').length}`);
    console.log(`  - Parcialmente Recebidos: ${orders.filter(o => o.status === 'PARTIALLY_RECEIVED').length}`);
    console.log(`  - Recebidos: ${orders.filter(o => o.status === 'RECEIVED').length}`);
    console.log(`  - Total: ${orders.length}`);
    console.log(`  - Valor Total: R$ ${orders.reduce((sum, o) => sum + o.totalValue, 0).toFixed(2)}`);

    console.log('\n✅ Seed de compras concluído!\n');

  } catch (error) {
    console.error('❌ Erro ao criar dados de compras:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
