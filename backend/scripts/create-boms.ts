import { prisma } from '../src/config/database';

/**
 * Script para criar BOMs (Listas de Materiais) para produtos acabados
 * 
 * Estrutura de exemplo para indústria têxtil:
 * - Tecidos precisam de fios
 * - Roupas precisam de tecidos e acessórios
 */

async function createBOMs() {
  console.log('🏭 Criando BOMs para produtos acabados...\n');

  try {
    // Buscar produtos e unidades de medida
    const products = await prisma.product.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
      orderBy: { code: 'asc' },
    });

    const units = await prisma.unitOfMeasure.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    console.log(`📦 Produtos encontrados: ${products.length}`);
    console.log(`📏 Unidades de medida: ${units.length}\n`);

    // Mapear unidades
    const unitMap = new Map(units.map(u => [u.code, u.id]));
    const unidadeId = unitMap.get('UN') || units[0]?.id;
    const metroId = unitMap.get('M') || units[0]?.id;
    const kgId = unitMap.get('KG') || units[0]?.id;

    // Mapear produtos por código para facilitar referências
    const productMap = new Map(products.map(p => [p.code, p]));

    // Definir BOMs para produtos acabados
    const bomsToCreate = [
      // Exemplo 1: Tecido de Algodão precisa de fios
      {
        productCode: 'PA001', // Produto Acabado 001
        productName: 'Tecido Algodão 100% Cru',
        components: [
          { code: 'MP001', quantity: 1.2, unit: 'KG', scrapFactor: 0.05 }, // Fio de algodão
        ],
      },
      // Exemplo 2: Tecido Poliéster
      {
        productCode: 'PA002',
        productName: 'Tecido Poliéster Premium',
        components: [
          { code: 'MP002', quantity: 1.1, unit: 'KG', scrapFactor: 0.03 },
        ],
      },
      // Exemplo 3: Tecido Misto (algodão + poliéster)
      {
        productCode: 'PA003',
        productName: 'Tecido Misto 50/50',
        components: [
          { code: 'MP001', quantity: 0.6, unit: 'KG', scrapFactor: 0.04 }, // Fio algodão
          { code: 'MP002', quantity: 0.6, unit: 'KG', scrapFactor: 0.04 }, // Fio poliéster
        ],
      },
    ];

    let bomsCreated = 0;
    let itemsCreated = 0;

    for (const bomDef of bomsToCreate) {
      const product = productMap.get(bomDef.productCode);
      
      if (!product) {
        console.log(`⚠️  Produto ${bomDef.productCode} não encontrado, criando...`);
        
        // Criar produto se não existir
        const newProduct = await prisma.product.create({
          data: {
            code: bomDef.productCode,
            name: bomDef.productName,
            type: 'FINISHED',
            unitId: metroId,
            minStock: 10,
            maxStock: 100,
            active: true,
          },
        });
        
        productMap.set(bomDef.productCode, newProduct);
        console.log(`   ✅ Produto criado: ${bomDef.productCode} - ${bomDef.productName}`);
      }

      const finalProduct = productMap.get(bomDef.productCode)!;

      // Verificar se já existe BOM ativo para este produto
      const existingBom = await prisma.bOM.findFirst({
        where: {
          productId: finalProduct.id,
          active: true,
        },
      });

      if (existingBom) {
        console.log(`⏭️  BOM já existe para ${bomDef.productCode} - ${bomDef.productName}`);
        continue;
      }

      // Criar BOM
      const bom = await prisma.bOM.create({
        data: {
          productId: finalProduct.id,
          version: 1,
          description: `Lista de materiais para ${bomDef.productName}`,
          validFrom: new Date(),
          active: true,
        },
      });

      console.log(`\n📋 BOM criada para: ${bomDef.productCode} - ${bomDef.productName}`);
      bomsCreated++;

      // Criar itens da BOM
      let sequence = 1;
      for (const compDef of bomDef.components) {
        const component = productMap.get(compDef.code);
        
        if (!component) {
          console.log(`   ⚠️  Componente ${compDef.code} não encontrado, criando como matéria-prima...`);
          
          // Criar componente como matéria-prima
          const newComponent = await prisma.product.create({
            data: {
              code: compDef.code,
              name: `Matéria-Prima ${compDef.code}`,
              type: 'RAW_MATERIAL',
              unitId: unitMap.get(compDef.unit) || kgId,
              minStock: 50,
              maxStock: 500,
              active: true,
            },
          });
          
          productMap.set(compDef.code, newComponent);
          console.log(`   ✅ Componente criado: ${compDef.code}`);
        }

        const finalComponent = productMap.get(compDef.code)!;
        const unitForComponent = unitMap.get(compDef.unit) || kgId;

        await prisma.bOMItem.create({
          data: {
            bomId: bom.id,
            componentId: finalComponent.id,
            quantity: compDef.quantity,
            unitId: unitForComponent,
            scrapFactor: compDef.scrapFactor,
            sequence: sequence++,
            notes: `${compDef.quantity} ${compDef.unit} de ${finalComponent.name}`,
          },
        });

        console.log(`   ✅ Item ${sequence - 1}: ${finalComponent.code} - ${compDef.quantity} ${compDef.unit} (refugo: ${compDef.scrapFactor * 100}%)`);
        itemsCreated++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Processo concluído!`);
    console.log(`   📋 BOMs criadas: ${bomsCreated}`);
    console.log(`   📦 Itens criados: ${itemsCreated}`);
    console.log('='.repeat(60) + '\n');

    // Mostrar resumo das BOMs criadas
    console.log('📊 Resumo das BOMs:');
    const allBoms = await prisma.bOM.findMany({
      where: { active: true },
      include: {
        product: {
          select: {
            code: true,
            name: true,
          },
        },
        items: {
          include: {
            component: {
              select: {
                code: true,
                name: true,
              },
            },
            unit: {
              select: {
                code: true,
              },
            },
          },
          orderBy: { sequence: 'asc' },
        },
      },
    });

    for (const bom of allBoms) {
      console.log(`\n📋 ${bom.product.code} - ${bom.product.name} (v${bom.version})`);
      for (const item of bom.items) {
        console.log(`   ${item.sequence}. ${item.component.code} - ${item.component.name}`);
        console.log(`      Qtd: ${item.quantity} ${item.unit.code} | Refugo: ${(item.scrapFactor * 100).toFixed(1)}%`);
      }
    }

  } catch (error) {
    console.error('❌ Erro ao criar BOMs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
createBOMs()
  .then(() => {
    console.log('✅ Script executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
