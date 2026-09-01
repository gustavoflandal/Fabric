// Script de teste rápido para verificar os relatórios

async function testReports() {
  try {
    console.log('🧪 Testando endpoint de relatórios...\n');
    
    // Primeiro, fazer login
    console.log('1. Fazendo login...');
    const loginResponse = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@fabric.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.data.accessToken;
    console.log('✅ Login bem-sucedido!\n');
    
    // Testar relatório de produção
    console.log('2. Testando relatório de produção...');
    const productionResponse = await fetch(
      'http://localhost:3001/api/v1/reports/production?startDate=2025-01-01&endDate=2025-10-20',
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    const productionData = await productionResponse.json();
    console.log('✅ Relatório de produção:');
    console.log('   - Total de ordens:', productionData.data.summary.total);
    console.log('   - Concluídas:', productionData.data.summary.completed);
    console.log('   - Produtos:', productionData.data.byProduct.length);
    console.log('');
    
    // Testar relatório de eficiência
    console.log('3. Testando relatório de eficiência...');
    const efficiencyResponse = await fetch(
      'http://localhost:3001/api/v1/reports/efficiency?startDate=2025-01-01&endDate=2025-10-20',
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    const efficiencyData = await efficiencyResponse.json();
    console.log('✅ Relatório de eficiência:');
    console.log('   - Total de ordens:', efficiencyData.data.summary.totalOrders);
    console.log('   - Eficiência média:', efficiencyData.data.summary.avgQuantityEfficiency.toFixed(2) + '%');
    console.log('');
    
    // Testar relatório de qualidade
    console.log('4. Testando relatório de qualidade...');
    const qualityResponse = await fetch(
      'http://localhost:3001/api/v1/reports/quality?startDate=2025-01-01&endDate=2025-10-20',
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    const qualityData = await qualityResponse.json();
    console.log('✅ Relatório de qualidade:');
    console.log('   - Total produzido:', qualityData.data.summary.totalProduced);
    console.log('   - Total refugo:', qualityData.data.summary.totalScrap);
    console.log('   - Taxa de qualidade:', qualityData.data.summary.avgQualityRate.toFixed(2) + '%');
    console.log('');
    
    // Testar relatório consolidado
    console.log('5. Testando relatório consolidado...');
    const consolidatedResponse = await fetch(
      'http://localhost:3001/api/v1/reports/consolidated?startDate=2025-01-01&endDate=2025-10-20',
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    const consolidatedData = await consolidatedResponse.json();
    console.log('✅ Relatório consolidado:');
    console.log('   - Ordens totais:', consolidatedData.data.production.total);
    console.log('   - Eficiência:', consolidatedData.data.production.efficiency.toFixed(2) + '%');
    console.log('');
    
    console.log('🎉 Todos os relatórios estão funcionando corretamente!');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  }
}

testReports();
