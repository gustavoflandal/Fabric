# 🎯 Fabric PCP - Setup para Demonstração

## ✅ Status Atual

O sistema foi configurado com sucesso e está pronto para demonstração!

### Servidores Rodando
- ✅ **Backend**: http://localhost:3001 (API REST)
- ✅ **Frontend**: http://localhost:5174 (Interface Web)

### Banco de Dados Populado
- ✅ **14 Produtos** (acabados, semiacabados, matérias-primas, embalagens)
- ✅ **4 BOMs** completas com estruturas multinível
- ✅ **6 Centros de Trabalho** (montagem, injeção, pintura, qualidade, embalagem)
- ✅ **4 Roteiros de Produção** com operações detalhadas
- ✅ **20 Ordens de Produção** em diferentes status
- ✅ **168 Movimentações de Estoque** (últimos 60 dias)
- ✅ **3 Fornecedores** e **3 Clientes**
- ✅ **4 Usuários** com diferentes perfis

## 🔐 Credenciais de Acesso

### Administrador (Acesso Total)
- **Email**: admin@fabric.com
- **Senha**: admin123
- **Perfil**: Administrador
- **Permissões**: Todas

### Gerente (Gestão e Relatórios)
- **Email**: gerente@fabric.com
- **Senha**: manager123
- **Perfil**: Gerente
- **Permissões**: Visualização e gestão

### Operadores (Apontamentos)
- **Email**: operador1@fabric.com
- **Senha**: operator123
- **Perfil**: Operador
- **Permissões**: Apontamentos de produção

- **Email**: operador2@fabric.com
- **Senha**: operator123
- **Perfil**: Operador
- **Permissões**: Apontamentos de produção

## 📊 Módulos Disponíveis para Demonstração

### 1. Dashboard
- Estatísticas gerais do sistema
- Métricas de produção em tempo real
- Gráficos de performance
- Produtos mais produzidos
- Atividades recentes

### 2. Produtos
- Cadastro completo de produtos
- Categorização (Eletrônicos, Metálicos, Plásticos, etc.)
- Tipos: Acabados, Semiacabados, Matérias-Primas, Embalagens
- Custos e lead times

### 3. BOMs (Estruturas de Produto)
- Estruturas multinível
- Componentes e quantidades
- Fatores de refugo
- Sequenciamento de montagem

### 4. Roteiros de Produção
- Operações por produto
- Centros de trabalho
- Tempos (setup, run, queue, move)
- Sequenciamento de operações

### 5. Ordens de Produção
- **Status Diversos**:
  - Planejadas (5 ordens)
  - Em Andamento (5 ordens)
  - Concluídas (10 ordens)
- Rastreamento de quantidade produzida
- Controle de refugo
- Operações vinculadas

### 6. Estoque
- Saldos em tempo real
- Movimentações históricas (60 dias)
- Entradas, saídas e ajustes
- Status: OK, Baixo, Crítico, Excesso
- Alertas de estoque mínimo

### 7. MRP (Planejamento de Materiais)
- Cálculo de necessidades
- Explosão de BOMs
- Sugestões de compra
- Análise de disponibilidade

### 8. Centros de Trabalho
- 6 centros configurados
- Capacidades e eficiências
- Custos por hora
- Tipos: Montagem, Fabricação, Acabamento, Qualidade, Embalagem

### 9. Fornecedores e Clientes
- 3 fornecedores cadastrados
- 3 clientes cadastrados
- Dados completos (CNPJ, endereço, contato)
- Prazos de pagamento e crédito

### 10. Relatórios
- Relatórios de produção
- Eficiência por centro de trabalho
- Análise de qualidade
- Movimentações de estoque

### 11. Usuários e Permissões
- Gestão de usuários
- Perfis (Admin, Gerente, Operador)
- Controle granular de permissões
- Logs de auditoria

## 🚀 Como Acessar

1. **Abra o navegador**: http://localhost:5174
2. **Faça login** com admin@fabric.com / admin123
3. **Explore os módulos** no menu lateral
4. **Teste as funcionalidades**:
   - Crie uma nova ordem de produção
   - Registre movimentações de estoque
   - Execute o MRP
   - Visualize relatórios

## 🔄 Resetar Dados (Se Necessário)

Se precisar resetar os dados para demonstração:

```bash
cd backend
npm run prisma:seed-all
```

Isso irá:
1. Limpar todos os dados (mantendo usuários)
2. Recriar toda a estrutura
3. Popular com dados consistentes

**Tempo**: ~30 segundos

## 📝 Dados de Exemplo

### Produtos Principais
- **PA-001**: Smartphone XPro (Produto Acabado)
- **PA-002**: Notebook Ultra (Produto Acabado)
- **SA-001**: Placa Mãe Montada (Semiacabado)
- **SA-002**: Display LCD Montado (Semiacabado)
- **SA-003**: Carcaça Plástica (Semiacabado)

### Ordens de Produção Destacadas
- **OP-2025-001**: 50 Smartphones (Planejada)
- **OP-2025-002**: 20 Notebooks (Liberada)
- **OP-2025-003**: 100 Smartphones (Em Progresso - 45% concluída)

### Centros de Trabalho
- **CT-001**: Linha de Montagem 1 (Capacidade: 100/dia)
- **CT-002**: Linha de Montagem 2 (Capacidade: 80/dia)
- **CT-003**: Injeção de Plásticos (Capacidade: 50/dia)
- **CT-004**: Pintura e Acabamento (Capacidade: 60/dia)
- **CT-005**: Controle de Qualidade (Capacidade: 120/dia)
- **CT-006**: Embalagem (Capacidade: 150/dia)

## 🎬 Roteiro de Demonstração Sugerido

### 1. Visão Geral (5 min)
- Mostrar Dashboard
- Explicar métricas principais
- Destacar status do sistema

### 2. Cadastros Básicos (5 min)
- Produtos e categorias
- BOMs (estruturas de produto)
- Roteiros de produção

### 3. Planejamento (10 min)
- Criar nova ordem de produção
- Executar MRP
- Analisar necessidades de materiais
- Verificar disponibilidade de estoque

### 4. Execução (10 min)
- Liberar ordem de produção
- Registrar apontamentos
- Movimentar estoque
- Acompanhar progresso

### 5. Controle (5 min)
- Visualizar relatórios
- Analisar eficiência
- Verificar qualidade
- Logs de auditoria

## 🐛 Troubleshooting

### Backend não está respondendo
```bash
cd backend
npm run dev
```

### Frontend não carrega
```bash
cd frontend
npm run dev
```

### Dados inconsistentes
```bash
cd backend
npm run prisma:seed-all
```

### Erro de autenticação
- Verifique se o backend está rodando
- Limpe o localStorage do navegador (F12 > Application > Local Storage > Clear)
- Faça login novamente

## 📚 Documentação Adicional

- **Backend**: `backend/README.md`
- **Frontend**: `frontend/README.md`
- **Seed**: `backend/SEED_README.md`
- **API**: http://localhost:3001/health

## 🎯 Próximos Passos

1. ✅ Sistema configurado e rodando
2. ✅ Dados de demonstração carregados
3. ✅ Usuários criados
4. 🎬 **Pronto para demonstração!**

---

**Desenvolvido com ❤️ para demonstrar as capacidades do Fabric PCP**
