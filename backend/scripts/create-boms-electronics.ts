import { prisma } from '../src/config/database';

/**
 * Script para criar BOMs para produtos eletrônicos (PA-001 e PA-002)
 */

async function createElectronicsBOMs() {
  console.log('🏭 Criando BOMs para produtos eletrônicos...\n');

  try {
    // Buscar produtos existentes
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

    // Mapear produtos por código
    const productMap = new Map(products.map(p => [p.code, p]));

    // Definir BOMs para produtos eletrônicos
    const bomsToCreate = [
      // PA-001: Smartphone XPro
      {
        productCode: 'PA-001',
        productName: 'Smartphone XPro',
        components: [
          { code: 'SA-001', quantity: 1, unit: 'UN', scrapFactor: 0.02 }, // Placa Mãe Montada
          { code: 'SA-003', quantity: 1, unit: 'UN', scrapFactor: 0.01 }, // Carcaça Plástica
          { code: 'MP-TELA-5', quantity: 1, unit: 'UN', scrapFactor: 0.03 }, // Tela 5"
          { code: 'MP-BAT-3000', quantity: 1, unit: 'UN', scrapFactor: 0.01 }, // Bateria 3000mAh
          { code: 'MP-CAM-12MP', quantity: 1, unit: 'UN', scrapFactor: 0.02 }, // Câmera 12MP
        ],
      },
      // PA-002: Notebook Ultra
      {
        productCode: 'PA-002',
        productName: 'Notebook Ultra',
        components: [
          { code: 'SA-MAIN-NB', quantity: 1, unit: 'UN', scrapFactor: 0.02 }, // Placa Mãe Notebook
          { code: 'SA-TECLADO', quantity: 1, unit: 'UN', scrapFactor: 0.01 }, // Teclado Montado
          { code: 'MP-TELA-15', quantity: 1, unit: 'UN', scrapFactor: 0.03 }, // Tela 15.6"
          { code: 'MP-HD-SSD', quantity: 1, unit: 'UN', scrapFactor: 0.01 }, // SSD 512GB
          { code: 'MP-MEM-16GB', quantity: 2, unit: 'UN', scrapFactor: 0.01 }, // Memória RAM 16GB (2x8GB)
          { code: 'MP-BAT-NB', quantity: 1, unit: 'UN', scrapFactor: 0.01 }, // Bateria Notebook
          { code: 'MP-CASE-NB', quantity: 1, unit: 'UN', scrapFactor: 0.02 }, // Carcaça Notebook
        ],
      },
    ];

    let bomsCreated = 0;
    let itemsCreated = 0;
    let componentsCreated = 0;

    for (const bomDef of bomsToCreate) {
      const product = productMap.get(bomDef.productCode);
      
      if (!product) {
        console.log(`❌ Produto ${bomDef.productCode} não encontrado no banco de dados!`);
        continue;
      }

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📱 Processando: ${bomDef.productCode} - ${product.name}`);
      console.log('='.repeat(60));

      // Verificar se já existe BOM ativo para este produto
      const existingBom = await prisma.bOM.findFirst({
        where: {
          productId: product.id,
          active: true,
        },
      });

      if (existingBom) {
        console.log(`⚠️  BOM já existe para ${bomDef.productCode}, removendo para recriar...`);
        
        // Desativar BOM antiga
        await prisma.bOM.update({
          where: { id: existingBom.id },
          data: { active: false },
        });
      }

      // Criar BOM
      const bom = await prisma.bOM.create({
        data: {
          productId: product.id,
          version: existingBom ? existingBom.version + 1 : 1,
          description: `Lista de materiais para ${product.name}`,
          validFrom: new Date(),
          active: true,
        },
      });

      console.log(`\n✅ BOM criada (v${bom.version})`);
      bomsCreated++;

      // Criar itens da BOM
      let sequence = 1;
      for (const compDef of bomDef.components) {
        let component = productMap.get(compDef.code);
        
        if (!component) {
          console.log(`   ⚠️  Componente ${compDef.code} não encontrado, criando...`);
          
          // Determinar tipo de componente
          const componentType = compDef.code.startsWith('SA-') ? 'SEMI_FINISHED' : 'RAW_MATERIAL';
          const componentName = compDef.code
            .replace('MP-', '')
            .replace('SA-', '')
            .replace(/-/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');

          // Criar componente
          component = await prisma.product.create({
            data: {
              code: compDef.code,
              name: componentName,
              type: componentType,
              unitId: unitMap.get(compDef.unit) || unidadeId,
              minStock: componentType === 'RAW_MATERIAL' ? 20 : 10,
              maxStock: componentType === 'RAW_MATERIAL' ? 200 : 50,
              active: true,
            },
          });
          
          productMap.set(compDef.code, component);
          componentsCreated++;
          console.log(`   ✅ Componente criado: ${compDef.code} - ${component.name} (${componentType})`);
        }

        const unitForComponent = unitMap.get(compDef.unit) || unidadeId;

        await prisma.bOMItem.create({
          data: {
            bomId: bom.id,
            componentId: component.id,
            quantity: compDef.quantity,
            unitId: unitForComponent,
            scrapFactor: compDef.scrapFactor,
            sequence: sequence++,
            notes: `${compDef.quantity} ${compDef.unit} de ${component.name}`,
          },
        });

        console.log(`   ${sequence - 1}. ${component.code} - ${component.name}`);
        console.log(`      Qtd: ${compDef.quantity} ${compDef.unit} | Refugo: ${(compDef.scrapFactor * 100).toFixed(1)}%`);
        itemsCreated++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Processo concluído!`);
    console.log(`   📋 BOMs criadas: ${bomsCreated}`);
    console.log(`   📦 Itens de BOM criados: ${itemsCreated}`);
    console.log(`   🆕 Componentes novos criados: ${componentsCreated}`);
    console.log('='.repeat(60) + '\n');

    // Mostrar resumo detalhado das BOMs criadas
    console.log('📊 Resumo Detalhado das BOMs:\n');
    
    const createdBoms = await prisma.bOM.findMany({
      where: {
        product: {
          code: { in: ['PA-001', 'PA-002'] },
        },
        active: true,
      },
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
                type: true,
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
      orderBy: {
        product: {
          code: 'asc',
        },
      },
    });

    for (const bom of createdBoms) {
      console.log(`${'='.repeat(60)}`);
      console.log(`📋 ${bom.product.code} - ${bom.product.name} (v${bom.version})`);
      console.log(`   Descrição: ${bom.description}`);
      console.log(`   Total de componentes: ${bom.items.length}`);
      console.log(`\n   Componentes:`);
      
      let totalScrap = 0;
      for (const item of bom.items) {
        const typeIcon = item.component.type === 'SEMI_FINISHED' ? '🔧' : '📦';
        console.log(`\n   ${item.sequence}. ${typeIcon} ${item.component.code} - ${item.component.name}`);
        console.log(`      Tipo: ${item.component.type}`);
        console.log(`      Quantidade: ${item.quantity} ${item.unit.code}`);
        console.log(`      Fator de Refugo: ${(item.scrapFactor * 100).toFixed(1)}%`);
        console.log(`      Qtd. com Refugo: ${(item.quantity * (1 + item.scrapFactor)).toFixed(2)} ${item.unit.code}`);
        totalScrap += item.scrapFactor;
      }
      
      const avgScrap = totalScrap / bom.items.length;
      console.log(`\n   📊 Taxa média de refugo: ${(avgScrap * 100).toFixed(2)}%`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Erro ao criar BOMs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar script
createElectronicsBOMs()
  .then(() => {
    console.log('✅ Script executado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
