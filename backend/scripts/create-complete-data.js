const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Criando dados completos...\n');

  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@fabric.com' }
  });

  if (!adminUser) {
    console.log('❌ Usuário admin não encontrado!');
    return;
  }

  // 1. Criar fornecedores
  console.log('📦 Criando fornecedores...');
  const suppliers = [];
  for (let i = 1; i <= 5; i++) {
    const supplier = await prisma.supplier.upsert({
      where: { code: `FORN-${String(i).padStart(3, '0')}` },
      update: {},
      create: {
        code: `FORN-${String(i).padStart(3, '0')}`,
        name: `Fornecedor ${i}`,
        email: `fornecedor${i}@email.com`,
        phone: `(11) 9999-${String(i).padStart(4, '0')}`,
        active: true
      }
    });
    suppliers.push(supplier);
  }
  console.log(`✅ ${suppliers.length} fornecedores criados`);

  // 2. Criar clientes
  console.log('\n👥 Criando clientes...');
  const customers = [];
  for (let i = 1; i <= 5; i++) {
    const customer = await prisma.customer.upsert({
      where: { code: `CLI-${String(i).padStart(3, '0')}` },
      update: {},
      create: {
        code: `CLI-${String(i).padStart(3, '0')}`,
        name: `Cliente ${i}`,
        email: `cliente${i}@email.com`,
        phone: `(11) 8888-${String(i).padStart(4, '0')}`,
        active: true
      }
    });
    customers.push(customer);
  }
  console.log(`✅ ${customers.length} clientes criados`);

  // 3. Buscar produtos
  console.log('\n📦 Buscando produtos...');
  const products = await prisma.product.findMany({ take: 10 });
  console.log(`✅ ${products.length} produtos encontrados`);

  // 4. Criar orçamentos de compra
  console.log('\n💰 Criando orçamentos de compra...');
  for (let i = 1; i <= 3; i++) {
    const quotation = await prisma.purchaseQuotation.upsert({
      where: { quotationNumber: `ORC-${String(i).padStart(4, '0')}` },
      update: {},
      create: {
        quotationNumber: `ORC-${String(i).padStart(4, '0')}`,
        supplierId: suppliers[i % suppliers.length].id,
        requestDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: i === 1 ? 'PENDING' : i === 2 ? 'APPROVED' : 'REJECTED',
        totalValue: 1000 + (i * 500),
        createdBy: adminUser.id
      }
    });

    // Adicionar itens ao orçamento
    for (let j = 0; j < 2; j++) {
      const product = products[j];
      if (product) {
        await prisma.purchaseQuotationItem.create({
          data: {
            quotationId: quotation.id,
            productId: product.id,
            quantity: 10 + (j * 5),
            unitPrice: 50 + (j * 10),
            totalPrice: (10 + (j * 5)) * (50 + (j * 10))
          }
        });
      }
    }
  }
  console.log('✅ Orçamentos criados');

  // 5. Criar pedidos de compra
  console.log('\n📋 Criando pedidos de compra...');
  for (let i = 1; i <= 3; i++) {
    const order = await prisma.purchaseOrder.upsert({
      where: { orderNumber: `PED-${String(i).padStart(4, '0')}` },
      update: {},
      create: {
        orderNumber: `PED-${String(i).padStart(4, '0')}`,
        supplierId: suppliers[i % suppliers.length].id,
        orderDate: new Date(),
        expectedDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: i === 1 ? 'PENDING' : i === 2 ? 'CONFIRMED' : 'RECEIVED',
        totalValue: 2000 + (i * 1000),
        createdBy: adminUser.id
      }
    });

    // Adicionar itens ao pedido
    for (let j = 0; j < 3; j++) {
      const product = products[j];
      if (product) {
        await prisma.purchaseOrderItem.create({
          data: {
            orderId: order.id,
            productId: product.id,
            quantity: 20 + (j * 10),
            unitPrice: 60 + (j * 15),
            totalPrice: (20 + (j * 10)) * (60 + (j * 15))
          }
        });
      }
    }
  }
  console.log('✅ Pedidos de compra criados');

  console.log('\n✅ Todos os dados foram criados!');

  // Resumo final
  console.log('\n📊 RESUMO FINAL:');
  const counts = {
    fornecedores: await prisma.supplier.count(),
    clientes: await prisma.customer.count(),
    orcamentosCompra: await prisma.purchaseQuotation.count(),
    pedidosCompra: await prisma.purchaseOrder.count(),
    produtos: await prisma.product.count(),
    notificacoes: await prisma.notification.count(),
    movimentacoes: await prisma.stockMovement.count(),
    planosContagem: await prisma.countingPlan.count(),
    sessoesContagem: await prisma.countingSession.count()
  };
  console.log(JSON.stringify(counts, null, 2));
  console.log('\n✅ Dados completos criados!');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
