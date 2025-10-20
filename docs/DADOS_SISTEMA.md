# Dados do Sistema Fabric - Resumo Completo

## 🔐 Usuários e Perfis

### **Usuários Criados**

| Email | Senha | Perfil | Nome |
|-------|-------|--------|------|
| admin@fabric.com | admin123 | ADMIN | Administrador |
| gerente@fabric.com | manager123 | MANAGER | João Gerente |
| operador1@fabric.com | operator123 | OPERATOR | Maria Operadora |
| operador2@fabric.com | operator123 | OPERATOR | Pedro Operador |

### **Perfis (Roles)**

- **ADMIN**: Acesso total ao sistema (22 permissões)
- **MANAGER**: Gerente de produção com acesso a relatórios
- **OPERATOR**: Operador de produção

---

## 📏 Unidades de Medida (9)

| Código | Nome | Tipo | Símbolo |
|--------|------|------|---------|
| UN | Unidade | quantity | un |
| KG | Quilograma | weight | kg |
| G | Grama | weight | g |
| L | Litro | volume | L |
| ML | Mililitro | volume | mL |
| M | Metro | length | m |
| CM | Centímetro | length | cm |
| CX | Caixa | quantity | cx |
| PC | Peça | quantity | pc |

---

## 📦 Categorias de Produto (5)

| Código | Nome | Descrição |
|--------|------|-----------|
| ELETRO | Eletrônicos | Produtos eletrônicos |
| METAL | Metálicos | Componentes metálicos |
| PLAST | Plásticos | Componentes plásticos |
| QUIM | Químicos | Produtos químicos e reagentes |
| EMB | Embalagens | Materiais de embalagem |

---

## 🏭 Centros de Trabalho (6)

| Código | Nome | Tipo | Capacidade | Eficiência | Custo/Hora |
|--------|------|------|------------|------------|------------|
| CT-001 | Linha de Montagem 1 | assembly | 100 | 95% | R$ 150,00 |
| CT-002 | Linha de Montagem 2 | assembly | 80 | 90% | R$ 120,00 |
| CT-003 | Injeção de Plásticos | manufacturing | 50 | 85% | R$ 200,00 |
| CT-004 | Pintura e Acabamento | finishing | 60 | 88% | R$ 100,00 |
| CT-005 | Controle de Qualidade | quality | 120 | 100% | R$ 80,00 |
| CT-006 | Embalagem | packaging | 150 | 98% | R$ 60,00 |

---

## 🚚 Fornecedores (3)

### **FOR-001 - TechComponents Ltda**
- **Razão Social**: TechComponents Componentes Eletrônicos Ltda
- **CNPJ**: 12.345.678/0001-90
- **Email**: vendas@techcomponents.com.br
- **Telefone**: (11) 3456-7890
- **Endereço**: Rua dos Componentes, 123 - São Paulo/SP
- **Prazo de Pagamento**: 30/60 dias
- **Lead Time**: 15 dias
- **Rating**: 4.5/5

### **FOR-002 - PlastiPro Indústria**
- **Razão Social**: PlastiPro Indústria de Plásticos S.A.
- **CNPJ**: 23.456.789/0001-01
- **Email**: comercial@plastipro.com.br
- **Telefone**: (11) 2345-6789
- **Endereço**: Av. Industrial, 456 - Guarulhos/SP
- **Prazo de Pagamento**: 45 dias
- **Lead Time**: 20 dias
- **Rating**: 4.2/5

### **FOR-003 - EmbalaFácil**
- **Razão Social**: EmbalaFácil Embalagens ME
- **CNPJ**: 34.567.890/0001-12
- **Email**: atendimento@embalafacil.com.br
- **Telefone**: (11) 4567-8901
- **Endereço**: Rua das Caixas, 789 - Osasco/SP
- **Prazo de Pagamento**: 30 dias
- **Lead Time**: 7 dias
- **Rating**: 4.8/5

---

## 👥 Clientes (3)

### **CLI-001 - TechStore Varejo**
- **Razão Social**: TechStore Comércio de Eletrônicos Ltda
- **CNPJ**: 45.678.901/0001-23
- **Email**: compras@techstore.com.br
- **Telefone**: (11) 5678-9012
- **Endereço**: Av. Paulista, 1000 - São Paulo/SP
- **Prazo de Pagamento**: 30/60/90 dias
- **Limite de Crédito**: R$ 500.000,00

### **CLI-002 - MegaEletro Distribuidora**
- **Razão Social**: MegaEletro Distribuidora de Eletrônicos S.A.
- **CNPJ**: 56.789.012/0001-34
- **Email**: pedidos@megaeletro.com.br
- **Telefone**: (21) 6789-0123
- **Endereço**: Rua do Comércio, 500 - Rio de Janeiro/RJ
- **Prazo de Pagamento**: 45/60 dias
- **Limite de Crédito**: R$ 1.000.000,00

### **CLI-003 - InfoShop Online**
- **Razão Social**: InfoShop Comércio Eletrônico Ltda
- **CNPJ**: 67.890.123/0001-45
- **Email**: fornecedores@infoshop.com.br
- **Telefone**: (11) 7890-1234
- **Endereço**: Rua Virtual, 100 - São Paulo/SP
- **Prazo de Pagamento**: 30 dias
- **Limite de Crédito**: R$ 300.000,00

---

## 📱 Produtos (14)

### **Produtos Acabados (2)**
- **PA-001**: Smartphone XPro - R$ 1.500,00
- **PA-002**: Notebook Ultra - R$ 3.500,00

### **Semiacabados (3)**
- **SA-001**: Placa Mãe Montada - R$ 800,00
- **SA-002**: Display LCD Montado - R$ 300,00
- **SA-003**: Carcaça Plástica - R$ 50,00

### **Matérias-Primas (7)**
- **MP-001**: Chip Processador A15 - R$ 250,00
- **MP-002**: Memória RAM 8GB - R$ 120,00
- **MP-003**: Bateria Li-Ion 4000mAh - R$ 80,00
- **MP-004**: Parafuso M2x5mm - R$ 0,05
- **MP-005**: Resina ABS Natural - R$ 15,00/kg
- **MP-006**: Tinta Spray Preta - R$ 25,00
- **MP-007**: Cabo USB-C - R$ 12,00

### **Embalagens (2)**
- **EMB-001**: Caixa Papelão 30x20x10 - R$ 3,50
- **EMB-002**: Manual do Usuário - R$ 1,20

---

## 🔧 BOMs (4)

### **BOM 1: SA-001 - Placa Mãe Montada**
- 1x MP-001 (Processador)
- 2x MP-002 (Memória RAM)
- 4x MP-004 (Parafuso)

### **BOM 2: SA-003 - Carcaça Plástica**
- 0.2 kg MP-005 (Resina ABS)
- 1x MP-006 (Tinta Spray)

### **BOM 3: PA-001 - Smartphone XPro** ⭐
- 1x SA-001 (Placa Mãe)
- 1x SA-002 (Display)
- 1x SA-003 (Carcaça)
- 1x MP-003 (Bateria)
- 1x MP-007 (Cabo USB-C)
- 8x MP-004 (Parafuso)
- 1x EMB-001 (Caixa)
- 1x EMB-002 (Manual)

### **BOM 4: PA-002 - Notebook Ultra** ⭐
- 1x SA-001 (Placa Mãe)
- 1x SA-002 (Display)
- 2x MP-002 (Memória RAM adicional)
- 1x MP-003 (Bateria)
- 1x MP-007 (Cabo)
- 16x MP-004 (Parafuso)
- 1x EMB-001 (Caixa)
- 1x EMB-002 (Manual)

---

## 🔧 Roteiros de Produção (4)

### **Roteiro 1: SA-001 - Placa Mãe Montada**
- **Versão**: 1 (Ativo)
- **Operações**: 2
- **Tempo por unidade**: 11 min

### **Roteiro 2: SA-003 - Carcaça Plástica**
- **Versão**: 1 (Ativo)
- **Operações**: 3
- **Tempo por unidade**: 17 min

### **Roteiro 3: PA-001 - Smartphone XPro** ⭐
- **Versão**: 1 (Ativo)
- **Operações**: 5
- **Tempo por unidade**: 50 min

### **Roteiro 4: PA-002 - Notebook Ultra** ⭐
- **Versão**: 1 (Ativo)
- **Operações**: 6
- **Tempo por unidade**: 95 min

---

## 📊 Resumo Geral

| Entidade | Quantidade |
|----------|-----------|
| **Usuários** | 4 |
| **Perfis** | 3 |
| **Permissões** | 22 |
| **Unidades de Medida** | 9 |
| **Categorias de Produto** | 5 |
| **Produtos** | 14 |
| **BOMs** | 4 |
| **Roteiros** | 4 |
| **Centros de Trabalho** | 6 |
| **Fornecedores** | 3 |
| **Clientes** | 3 |

---

## 🧪 Cenários de Teste Disponíveis

### **1. Gestão de Usuários**
- Login com diferentes perfis (admin, gerente, operador)
- Teste de permissões por perfil
- Auditoria de ações

### **2. Cadastros Básicos**
- CRUD de unidades de medida
- CRUD de categorias de produto
- CRUD de fornecedores
- CRUD de clientes
- CRUD de centros de trabalho

### **3. Engenharia de Produtos**
- Visualizar produtos por tipo/categoria
- Criar/editar produtos com dropdowns de unidade e categoria
- Gerenciar BOMs (criar, editar, versionar, ativar/desativar)
- Explodir BOM multinível
- Calcular necessidades de materiais
- Gerenciar Roteiros (criar, editar, versionar, ativar/desativar)
- Calcular tempos de produção

### **4. Fluxos Completos**
- **Explosão de BOM**: PA-001 (10 unidades) → Ver todas as matérias-primas necessárias
- **Estrutura Multinível**: Smartphone → Placa Mãe → Processador/Memória
- **Versionamento de BOM**: Criar versão 2 de uma BOM existente
- **Versionamento de Roteiro**: Criar versão 2 de um roteiro existente
- **Ativação Exclusiva**: Ativar nova versão desativa a anterior (BOM e Roteiro)
- **Cálculo de Tempo**: Calcular tempo total para produzir X unidades

---

## 🚀 Próximos Passos Sugeridos

1. **Testar módulo de Produtos e BOMs** ✅ Pronto
2. **Testar módulo de Roteiros** ✅ Pronto
3. **Implementar módulo de Ordens de Produção**
4. **Implementar apontamentos de produção**
5. **Implementar dashboards e relatórios**

---

**Sistema pronto para testes funcionais completos! 🎉**
