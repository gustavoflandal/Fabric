# 🌱 Guia de Seed do Banco de Dados

Este guia explica como popular o banco de dados do Fabric com dados de demonstração consistentes e bem referenciados.

## 📋 Pré-requisitos

- Banco de dados MySQL configurado e rodando
- Variáveis de ambiente configuradas (`.env`)
- Dependências instaladas (`npm install`)

## 🚀 Opção 1: Seed Completo Automático (Recomendado)

Execute um único comando que limpa e popula todo o banco de dados:

```bash
cd backend
npm run prisma:seed-all
```

Este comando irá:
1. ✅ Limpar todos os dados (mantendo usuários)
2. ✅ Criar estrutura básica (produtos, BOMs, roteiros, etc.)
3. ✅ Criar movimentações de estoque
4. ✅ Criar ordens de produção
5. ✅ Criar apontamentos de produção

**Tempo estimado:** 30-60 segundos

## 🔧 Opção 2: Seed Manual (Passo a Passo)

Se preferir executar cada etapa manualmente:

### 1. Limpar banco de dados (mantém usuários)
```bash
npm run prisma:seed-reset
```

### 2. Criar estrutura básica
```bash
npm run prisma:seed
```

### 3. Criar movimentações de estoque
```bash
npm run prisma:seed-stock
```

### 4. Criar ordens de produção adicionais
```bash
npm run prisma:seed-production
```

### 5. Criar apontamentos de produção
```bash
npm run prisma:seed-pointings
```

## 📊 Dados Criados

### Cadastros Básicos
- **8 Unidades de Medida**: UN, KG, G, L, ML, M, CM, PC
- **5 Categorias**: Eletrônicos, Metálicos, Plásticos, Químicos, Embalagens
- **3 Fornecedores**: TechComponents, PlastiPro, EmbalaFácil
- **3 Clientes**: TechStore, MegaEletro, InfoShop
- **6 Centros de Trabalho**: 2 linhas de montagem, injeção, pintura, qualidade, embalagem

### Produtos (14 itens)
- **2 Produtos Acabados**: Smartphone XPro, Notebook Ultra
- **3 Semiacabados**: Placa Mãe, Display LCD, Carcaça Plástica
- **7 Matérias-Primas**: Processador, Memória, Bateria, Parafusos, Resina, Tinta, Cabo
- **2 Embalagens**: Caixa, Manual

### Estruturas
- **4 BOMs Completas**: Estruturas de produto multinível
- **4 Roteiros de Produção**: Com 2-6 operações cada

### Produção
- **5+ Ordens de Produção**: Em diferentes status (Planejada, Liberada, Em Progresso, Concluída, Cancelada)
- **Operações de Produção**: Vinculadas às ordens
- **Apontamentos**: Registros de produção com tempos reais

### Estoque
- **Movimentações Diversas**: Entradas, saídas, ajustes, devoluções
- **Histórico de 60 dias**: Movimentações distribuídas ao longo do tempo
- **Saldos Realistas**: Baseados no tipo de produto

## 👥 Usuários Padrão

Os usuários são mantidos após o seed. Se precisar recriá-los:

```bash
npm run prisma:reset  # ⚠️ CUIDADO: Apaga TUDO incluindo usuários
npm run prisma:seed
```

**Usuários padrão:**
- **Admin**: admin@fabric.com / admin123
- **Gerente**: gerente@fabric.com / manager123
- **Operador 1**: operador1@fabric.com / operator123
- **Operador 2**: operador2@fabric.com / operator123

## 🔍 Verificar Dados

Após o seed, você pode verificar os dados:

```bash
npm run prisma:studio
```

Ou conecte-se ao banco e execute:

```sql
SELECT 'Produtos' as Tabela, COUNT(*) as Total FROM products
UNION ALL
SELECT 'BOMs', COUNT(*) FROM b_o_ms
UNION ALL
SELECT 'Ordens', COUNT(*) FROM production_orders
UNION ALL
SELECT 'Movimentações', COUNT(*) FROM stock_movements;
```

## ⚠️ Avisos Importantes

1. **Backup**: Sempre faça backup antes de executar seed em produção
2. **Usuários**: O seed mantém os usuários existentes
3. **IDs**: Os IDs serão diferentes a cada execução
4. **Tempo**: O seed completo pode levar até 1 minuto

## 🐛 Troubleshooting

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "Database connection failed"
Verifique o arquivo `.env` e se o MySQL está rodando.

### Erro: "Foreign key constraint"
Execute o seed-reset primeiro:
```bash
npm run prisma:seed-reset
```

### Dados inconsistentes
Limpe e execute novamente:
```bash
npm run prisma:seed-all
```

## 📝 Notas

- Os dados são gerados com valores aleatórios controlados para realismo
- As datas são relativas à data de execução
- Os saldos de estoque são calculados automaticamente
- As referências entre tabelas são mantidas consistentes

## 🎯 Próximos Passos

Após popular o banco:

1. Inicie o backend: `npm run dev`
2. Inicie o frontend: `cd ../frontend && npm run dev`
3. Acesse: http://localhost:5173
4. Login: admin@fabric.com / admin123
5. Explore todos os módulos! 🚀
