# 📋 Ordens de Produção Criadas

## ✅ Resumo Geral

Foram criadas **12 novas ordens de produção** para os 4 produtos que possuem BOM cadastrada:

- **4 Ordens PLANEJADAS** (futuras - início em 5 dias)
- **4 Ordens LIBERADAS** (prontas para iniciar - início em 1 dia)
- **4 Ordens EM PROGRESSO** (já iniciadas - 50-64% concluídas)

---

## 📦 Ordens por Produto

### 1. PA-001 - Smartphone XPro

**BOM:** 8 componentes (Placa Mãe, Display, Carcaça, Bateria, Cabo, Parafusos, Caixa, Manual)  
**Roteiro:** 5 operações (Montagem estrutura, Instalação display/bateria, Fechamento, Teste, Embalagem)

| Ordem | Status | Quantidade | Produzido | Progresso | Início Programado |
|-------|--------|------------|-----------|-----------|-------------------|
| OP-2025-5594 | PLANEJADA | 69 un | 0 | 0% | Daqui 5 dias |
| OP-2025-5219 | LIBERADA | 41 un | 0 | 0% | Daqui 1 dia |
| OP-2025-9129 | EM PROGRESSO | 81 un | 52 | 64% | Há 2 dias |

---

### 2. PA-002 - Notebook Ultra

**BOM:** 8 componentes (Placa Mãe, Display, Memória, Bateria, Cabo, Parafusos, Caixa, Manual)  
**Roteiro:** 6 operações (Montagem base, Instalação memória/bateria, Montagem display, Teclado/touchpad, Teste burn-in, Embalagem)

| Ordem | Status | Quantidade | Produzido | Progresso | Início Programado |
|-------|--------|------------|-----------|-----------|-------------------|
| OP-2025-4939 | PLANEJADA | 99 un | 0 | 0% | Daqui 5 dias |
| OP-2025-8047 | LIBERADA | 41 un | 0 | 0% | Daqui 1 dia |
| OP-2025-1004 | EM PROGRESSO | 96 un | 58 | 60% | Há 2 dias |

---

### 3. SA-001 - Placa Mãe Montada

**BOM:** 3 componentes (Processador, 2x Memória RAM, Parafusos)  
**Roteiro:** 2 operações (Montagem componentes, Teste funcionamento)

| Ordem | Status | Quantidade | Produzido | Progresso | Início Programado |
|-------|--------|------------|-----------|-----------|-------------------|
| OP-2025-5181 | PLANEJADA | 71 un | 0 | 0% | Daqui 5 dias |
| OP-2025-2962 | LIBERADA | 34 un | 0 | 0% | Daqui 1 dia |
| OP-2025-8611 | EM PROGRESSO | 101 un | 65 | 64% | Há 2 dias |

---

### 4. SA-003 - Carcaça Plástica

**BOM:** 2 componentes (Resina ABS, Tinta Spray)  
**Roteiro:** 3 operações (Injeção plástico, Pintura/acabamento, Inspeção qualidade)

| Ordem | Status | Quantidade | Produzido | Progresso | Início Programado |
|-------|--------|------------|-----------|-----------|-------------------|
| OP-2025-8977 | PLANEJADA | 59 un | 0 | 0% | Daqui 5 dias |
| OP-2025-8282 | LIBERADA | 48 un | 0 | 0% | Daqui 1 dia |
| OP-2025-2467 | EM PROGRESSO | 92 un | 46 | 50% | Há 2 dias |

---

## 📊 Estatísticas

### Por Status
- **Planejadas**: 4 ordens (298 unidades totais)
- **Liberadas**: 4 ordens (164 unidades totais)
- **Em Progresso**: 4 ordens (370 unidades totais, 221 já produzidas - 60% média)

### Totais
- **12 ordens** criadas
- **832 unidades** programadas
- **221 unidades** já produzidas
- **611 unidades** pendentes

### Taxa de Refugo (Ordens em Progresso)
- Refugo médio: ~3% (dentro do esperado)

---

## 🔍 Como Visualizar

### No Sistema Web
1. Acesse: http://localhost:5174
2. Login: admin@fabric.com / admin123
3. Menu: **Ordens de Produção**
4. Filtre por status ou produto

### Via Prisma Studio
```bash
cd backend
npm run prisma:studio
```
Navegue até a tabela `ProductionOrder`

### Via API
```bash
# Listar todas as ordens
curl http://localhost:3001/api/v1/production-orders

# Buscar ordem específica
curl http://localhost:3001/api/v1/production-orders/{id}
```

---

## 🎯 Próximos Passos Sugeridos

1. **Liberar ordens planejadas**: Altere status de PLANNED para RELEASED
2. **Iniciar produção**: Mude RELEASED para IN_PROGRESS e registre apontamentos
3. **Registrar apontamentos**: Use o módulo de Apontamentos para registrar produção
4. **Executar MRP**: Verifique necessidades de materiais para as ordens
5. **Reservar estoque**: Reserve materiais para as ordens liberadas

---

## 📝 Observações

- Todas as ordens têm **operações vinculadas** baseadas nos roteiros
- As ordens em progresso têm **50% das operações concluídas**
- Os **tempos de setup e run** foram calculados automaticamente
- As **prioridades** variam de 5 a 10 (10 = mais urgente)
- Todas as ordens foram criadas pelo usuário **admin@fabric.com**

---

## 🔄 Recriar Ordens

Para recriar as ordens (apaga as existentes e cria novas):

```bash
cd backend
npm run prisma:seed-orders-bom
```

**Atenção**: Este comando cria ordens adicionais. Para limpar tudo e recriar:

```bash
npm run prisma:seed-all
```
