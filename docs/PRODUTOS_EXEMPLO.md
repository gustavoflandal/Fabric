# Produtos Criados no Banco de Dados

## 📱 Produtos Acabados (Finished)

### PA-001 - Smartphone XPro
- **Tipo**: Produto Acabado
- **Unidade**: UN (Unidade)
- **Categoria**: Eletrônicos
- **Custo Padrão**: R$ 1.500,00
- **Lead Time**: 5 dias

### PA-002 - Notebook Ultra
- **Tipo**: Produto Acabado
- **Unidade**: UN (Unidade)
- **Categoria**: Eletrônicos
- **Custo Padrão**: R$ 3.500,00
- **Lead Time**: 7 dias

---

## 🔧 Semiacabados (Semi-Finished)

### SA-001 - Placa Mãe Montada
- **Tipo**: Semiacabado
- **Unidade**: UN (Unidade)
- **Categoria**: Eletrônicos
- **Custo Padrão**: R$ 800,00
- **Lead Time**: 3 dias

### SA-002 - Display LCD Montado
- **Tipo**: Semiacabado
- **Unidade**: UN (Unidade)
- **Categoria**: Eletrônicos
- **Custo Padrão**: R$ 300,00
- **Lead Time**: 2 dias

### SA-003 - Carcaça Plástica
- **Tipo**: Semiacabado
- **Unidade**: UN (Unidade)
- **Categoria**: Plásticos
- **Custo Padrão**: R$ 50,00
- **Lead Time**: 2 dias

---

## 🔩 Matérias-Primas (Raw Material)

### MP-001 - Chip Processador A15
- **Tipo**: Matéria-prima
- **Unidade**: PC (Peça)
- **Categoria**: Eletrônicos
- **Custo Padrão**: R$ 250,00
- **Lead Time**: 15 dias

### MP-002 - Memória RAM 8GB
- **Tipo**: Matéria-prima
- **Unidade**: PC (Peça)
- **Categoria**: Eletrônicos
- **Custo Padrão**: R$ 120,00
- **Lead Time**: 10 dias

### MP-003 - Bateria Li-Ion 4000mAh
- **Tipo**: Matéria-prima
- **Unidade**: UN (Unidade)
- **Categoria**: Eletrônicos
- **Custo Padrão**: R$ 80,00
- **Lead Time**: 12 dias

### MP-004 - Parafuso M2x5mm
- **Tipo**: Matéria-prima
- **Unidade**: PC (Peça)
- **Categoria**: Metálicos
- **Custo Padrão**: R$ 0,05
- **Lead Time**: 5 dias

### MP-005 - Resina ABS Natural
- **Tipo**: Matéria-prima
- **Unidade**: KG (Quilograma)
- **Categoria**: Químicos
- **Custo Padrão**: R$ 15,00
- **Lead Time**: 20 dias

### MP-006 - Tinta Spray Preta
- **Tipo**: Matéria-prima
- **Unidade**: UN (Unidade)
- **Categoria**: Químicos
- **Custo Padrão**: R$ 25,00
- **Lead Time**: 7 dias

### MP-007 - Cabo USB-C
- **Tipo**: Matéria-prima
- **Unidade**: UN (Unidade)
- **Categoria**: Eletrônicos
- **Custo Padrão**: R$ 12,00
- **Lead Time**: 8 dias

---

## 📦 Embalagens (Packaging)

### EMB-001 - Caixa Papelão 30x20x10
- **Tipo**: Embalagem
- **Unidade**: UN (Unidade)
- **Categoria**: Embalagens
- **Custo Padrão**: R$ 3,50
- **Lead Time**: 3 dias

### EMB-002 - Manual do Usuário
- **Tipo**: Embalagem
- **Unidade**: UN (Unidade)
- **Categoria**: Embalagens
- **Custo Padrão**: R$ 1,20
- **Lead Time**: 5 dias

---

## 💡 Sugestões de BOM para Testar

### BOM para PA-001 (Smartphone XPro)
**Componentes sugeridos:**
- 1x SA-001 (Placa Mãe Montada)
- 1x SA-002 (Display LCD Montado)
- 1x SA-003 (Carcaça Plástica)
- 1x MP-003 (Bateria Li-Ion)
- 1x MP-007 (Cabo USB-C)
- 8x MP-004 (Parafuso M2x5mm)
- 1x EMB-001 (Caixa Papelão)
- 1x EMB-002 (Manual do Usuário)

### BOM para SA-001 (Placa Mãe Montada)
**Componentes sugeridos:**
- 1x MP-001 (Chip Processador A15)
- 2x MP-002 (Memória RAM 8GB)
- 4x MP-004 (Parafuso M2x5mm)

### BOM para SA-003 (Carcaça Plástica)
**Componentes sugeridos:**
- 0.2 KG MP-005 (Resina ABS Natural)
- 1x MP-006 (Tinta Spray Preta)

---

---

## ✅ BOMs Criadas Automaticamente

### **BOM 1: SA-001 - Placa Mãe Montada**
| Seq | Componente | Código | Qtd | Unidade | Scrap | Observação |
|-----|-----------|--------|-----|---------|-------|------------|
| 10 | Chip Processador A15 | MP-001 | 1 | PC | 2% | Processador principal |
| 20 | Memória RAM 8GB | MP-002 | 2 | PC | 1% | Módulos de memória |
| 30 | Parafuso M2x5mm | MP-004 | 4 | PC | 5% | Fixação dos componentes |

### **BOM 2: SA-003 - Carcaça Plástica**
| Seq | Componente | Código | Qtd | Unidade | Scrap | Observação |
|-----|-----------|--------|-----|---------|-------|------------|
| 10 | Resina ABS Natural | MP-005 | 0.2 | KG | 10% | Matéria-prima para injeção |
| 20 | Tinta Spray Preta | MP-006 | 1 | UN | 5% | Acabamento superficial |

### **BOM 3: PA-001 - Smartphone XPro** ⭐
| Seq | Componente | Código | Qtd | Unidade | Scrap | Observação |
|-----|-----------|--------|-----|---------|-------|------------|
| 10 | Placa Mãe Montada | SA-001 | 1 | UN | 1% | Placa principal montada |
| 20 | Display LCD Montado | SA-002 | 1 | UN | 2% | Display touch screen |
| 30 | Carcaça Plástica | SA-003 | 1 | UN | 1% | Carcaça externa |
| 40 | Bateria Li-Ion 4000mAh | MP-003 | 1 | UN | 1% | Bateria recarregável |
| 50 | Cabo USB-C | MP-007 | 1 | UN | 1% | Cabo de carregamento |
| 60 | Parafuso M2x5mm | MP-004 | 8 | PC | 10% | Fixação da carcaça |
| 70 | Caixa Papelão 30x20x10 | EMB-001 | 1 | UN | 2% | Embalagem do produto |
| 80 | Manual do Usuário | EMB-002 | 1 | UN | 1% | Manual de instruções |

### **BOM 4: PA-002 - Notebook Ultra** ⭐
| Seq | Componente | Código | Qtd | Unidade | Scrap | Observação |
|-----|-----------|--------|-----|---------|-------|------------|
| 10 | Placa Mãe Montada | SA-001 | 1 | UN | 1% | Placa mãe principal |
| 20 | Display LCD Montado | SA-002 | 1 | UN | 2% | Display LCD 15.6" |
| 30 | Memória RAM 8GB | MP-002 | 2 | PC | 1% | Memória RAM adicional |
| 40 | Bateria Li-Ion 4000mAh | MP-003 | 1 | UN | 1% | Bateria de longa duração |
| 50 | Cabo USB-C | MP-007 | 1 | UN | 1% | Cabo de alimentação |
| 60 | Parafuso M2x5mm | MP-004 | 16 | PC | 10% | Fixação do gabinete |
| 70 | Caixa Papelão 30x20x10 | EMB-001 | 1 | UN | 2% | Embalagem do produto |
| 80 | Manual do Usuário | EMB-002 | 1 | UN | 1% | Manual de instruções |

---

## 🔍 Estrutura Multinível

### **Explosão Completa do Smartphone (PA-001)**

Quando você explodir a BOM do PA-001, verá:

```
PA-001 - Smartphone XPro (1 UN)
├── SA-001 - Placa Mãe Montada (1 UN)
│   ├── MP-001 - Chip Processador A15 (1 PC)
│   ├── MP-002 - Memória RAM 8GB (2 PC)
│   └── MP-004 - Parafuso M2x5mm (4 PC)
├── SA-002 - Display LCD Montado (1 UN)
├── SA-003 - Carcaça Plástica (1 UN)
│   ├── MP-005 - Resina ABS Natural (0.2 KG)
│   └── MP-006 - Tinta Spray Preta (1 UN)
├── MP-003 - Bateria Li-Ion (1 UN)
├── MP-007 - Cabo USB-C (1 UN)
├── MP-004 - Parafuso M2x5mm (8 PC)
├── EMB-001 - Caixa Papelão (1 UN)
└── EMB-002 - Manual do Usuário (1 UN)

TOTAL DE MATÉRIAS-PRIMAS NECESSÁRIAS:
- MP-001: 1 PC (do SA-001)
- MP-002: 2 PC (do SA-001)
- MP-003: 1 UN
- MP-004: 12 PC (4 do SA-001 + 8 direto)
- MP-005: 0.2 KG (do SA-003)
- MP-006: 1 UN (do SA-003)
- MP-007: 1 UN
- SA-002: 1 UN (não tem BOM própria)
- EMB-001: 1 UN
- EMB-002: 1 UN
```

---

## 🧪 Como Testar o BOM

1. **Acesse** a tela de **Produtos** (`http://localhost:5173`)
2. **Localize** o produto **PA-001** (Smartphone XPro)
3. **Clique** em **BOMs** na linha do produto
4. **Visualize** a BOM já criada (versão 1)
5. **Clique** em **"Explodir BOM"** para ver a estrutura completa multinível
6. **Teste** editar a BOM, criar novas versões, ativar/desativar
7. **Repita** para o produto **PA-002** (Notebook Ultra)

### **Testes Recomendados:**

✅ **Visualizar BOM existente** - Veja os 8 componentes do Smartphone  
✅ **Explodir BOM** - Veja a estrutura completa com 3 níveis  
✅ **Criar nova versão** - Altere quantidades e crie versão 2  
✅ **Ativar/Desativar** - Teste a exclusividade de BOM ativa  
✅ **Editar BOM** - Adicione/remova componentes  
✅ **Validar cálculos** - Verifique se as quantidades estão corretas na explosão
