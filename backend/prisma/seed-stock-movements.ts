import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedStockMovements() {
  console.log('📦 Iniciando seed de movimentações de estoque...\n');

  try {
    // Buscar produtos e usuário
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: { code: 'asc' },
    });

    const users = await prisma.user.findMany({ take: 1 });
    
    if (products.length === 0 || users.length === 0) {
      console.log('⚠️  Produtos ou usuários não encontrados.');
      return;
    }

    const userId = users[0].id;
    console.log(`✅ Encontrados ${products.length} produtos`);

    // Deletar movimentações antigas
    await prisma.stockMovement.deleteMany({});
    console.log('🗑️  Movimentações antigas deletadas\n');

    const movements: any[] = [];
    const today = new Date();
    
    // Quantidades iniciais baseadas no tipo de produto
    const getInitialQuantity = (type: string) => {
      switch (type) {
        case 'finished': return 50 + Math.floor(Math.random() * 50); // 50-100
        case 'semi_finished': return 100 + Math.floor(Math.random() * 100); // 100-200
        case 'raw_material': return 500 + Math.floor(Math.random() * 500); // 500-1000
        case 'packaging': return 1000 + Math.floor(Math.random() * 1000); // 1000-2000
        default: return 100;
      }
    };

    // Para cada produto, criar várias movimentações
    for (const product of products) {
      // Entrada inicial (há 60 dias)
      const initialDate = new Date(today);
      initialDate.setDate(initialDate.getDate() - 60);
      
      movements.push({
        productId: product.id,
        type: 'IN',
        quantity: 500 + Math.floor(Math.random() * 500),
        reason: 'Estoque inicial',
        reference: 'EST-INICIAL',
        userId,
        createdAt: initialDate,
      });

      // Compras (há 45, 30, 15 dias)
      for (let i = 0; i < 3; i++) {
        const purchaseDate = new Date(today);
        purchaseDate.setDate(purchaseDate.getDate() - (45 - i * 15));
        
        movements.push({
          productId: product.id,
          type: 'IN',
          quantity: 100 + Math.floor(Math.random() * 200),
          reason: 'Compra de fornecedor',
          reference: `NF-${String(Math.floor(Math.random() * 9000) + 1000)}`,
          userId,
          createdAt: purchaseDate,
        });
      }

      // Saídas para produção (várias datas)
      for (let i = 0; i < 5; i++) {
        const exitDate = new Date(today);
        exitDate.setDate(exitDate.getDate() - Math.floor(Math.random() * 40));
        
        movements.push({
          productId: product.id,
          type: 'OUT',
          quantity: 30 + Math.floor(Math.random() * 70),
          reason: 'Saída para produção',
          reference: `OP-2025-${String(Math.floor(Math.random() * 20) + 1).padStart(3, '0')}`,
          userId,
          createdAt: exitDate,
        });
      }

      // Devoluções (há 20 e 10 dias)
      for (let i = 0; i < 2; i++) {
        const returnDate = new Date(today);
        returnDate.setDate(returnDate.getDate() - (20 - i * 10));
        
        movements.push({
          productId: product.id,
          type: 'IN',
          quantity: 10 + Math.floor(Math.random() * 20),
          reason: 'Devolução de produção',
          reference: `DEV-${String(Math.floor(Math.random() * 900) + 100)}`,
          userId,
          createdAt: returnDate,
        });
      }

      // Ajustes de inventário (há 7 dias)
      const adjustDate = new Date(today);
      adjustDate.setDate(adjustDate.getDate() - 7);
      
      movements.push({
        productId: product.id,
        type: 'ADJUSTMENT',
        quantity: Math.floor(Math.random() * 20) - 10, // -10 a +10
        reason: 'Ajuste de inventário',
        reference: `INV-${String(Math.floor(Math.random() * 900) + 100)}`,
        userId,
        createdAt: adjustDate,
      });
    }

    // Criar movimentações
    console.log('📦 Criando movimentações...');
    for (const movement of movements) {
      await prisma.stockMovement.create({
        data: movement,
      });
    }

    console.log(`✅ ${movements.length} movimentações criadas com sucesso!`);

    // Estatísticas
    const byType = {
      IN: movements.filter(m => m.type === 'IN').length,
      OUT: movements.filter(m => m.type === 'OUT').length,
      ADJUSTMENT: movements.filter(m => m.type === 'ADJUSTMENT').length,
    };

    console.log('\n📊 Resumo:');
    console.log(`   - Entradas: ${byType.IN}`);
    console.log(`   - Saídas: ${byType.OUT}`);
    console.log(`   - Ajustes: ${byType.ADJUSTMENT}`);
    console.log(`   - Total: ${movements.length}`);
    console.log(`   - Produtos: ${products.length}`);

  } catch (error) {
    console.error('❌ Erro ao criar movimentações:', error);
    throw error;
  }
}

seedStockMovements()
  .then(async () => {
    await prisma.$disconnect();
    console.log('\n✅ Seed de movimentações concluído!');
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
