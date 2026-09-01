# Debug: Formato de Datas nos Filtros

## 🔍 Verificação Implementada

Adicionados logs de debug para verificar o formato das datas que estão sendo enviadas e recebidas.

## 📊 O Que Verificar

### Frontend (Console do Navegador)

Quando você selecionar datas e aplicar filtros, verá:

```javascript
🔍 Filtros de data: {
  startDate: "2024-10-19",
  endDate: "2024-10-19",
  startDateType: "string",
  endDateType: "string"
}
```

**Formato esperado**: `YYYY-MM-DD` (ISO 8601)

### Backend (Terminal do Servidor)

No terminal onde o backend está rodando, verá:

```javascript
🔍 Query params: {
  startDate: "2024-10-19",
  endDate: "2024-10-19",
  startDateType: "string",
  endDateType: "string"
}
📅 startDate processada: 2024-10-19T03:00:00.000Z
📅 endDate processada: 2024-10-20T02:59:59.999Z
```

## 🌍 Formato de Data HTML5

### Input type="date"

O elemento `<input type="date">` do HTML5:

```html
<input type="date" v-model="filters.startDate" />
```

**Sempre retorna**: Formato ISO `YYYY-MM-DD`

**Independente de**:
- Localização do navegador (pt-BR, en-US, etc)
- Configuração do sistema operacional
- Timezone

**Exemplos**:
```
Usuário no Brasil: "2024-10-19"
Usuário nos EUA: "2024-10-19"
Usuário no Japão: "2024-10-19"
```

### Exibição vs Valor

**O que o usuário vê** (depende do navegador):
- Brasil: `19/10/2024`
- EUA: `10/19/2024`
- ISO: `2024-10-19`

**O que o JavaScript recebe** (sempre igual):
- `"2024-10-19"`

## 🔧 Como Testar

### 1. Abrir Console do Navegador

```
F12 → Console
```

### 2. Acessar Logs

```
http://localhost:5175/audit-logs
```

### 3. Selecionar Datas

```
Data Início: Qualquer data
Data Fim: Qualquer data
```

### 4. Aplicar Filtro

```
Mudar qualquer outro filtro (Recurso ou Ação)
OU
Clicar em "Limpar Filtros" e selecionar novamente
```

### 5. Verificar Logs

**No Console do Navegador**:
```
🔍 Filtros de data: {
  startDate: "2024-10-19",
  endDate: "2024-10-19",
  ...
}
```

**No Terminal do Backend**:
```
🔍 Query params: {
  startDate: "2024-10-19",
  ...
}
📅 startDate processada: 2024-10-19T03:00:00.000Z
📅 endDate processada: 2024-10-20T02:59:59.999Z
```

## ⚠️ Possíveis Problemas

### 1. Timezone

**Problema**: Data convertida com timezone diferente

```javascript
// Entrada
startDate: "2024-10-19"

// Conversão (depende do servidor)
new Date("2024-10-19")
// Brasil (GMT-3): 2024-10-19T03:00:00.000Z
// UTC: 2024-10-19T00:00:00.000Z
```

**Solução**: Usar `setHours()` para normalizar

```javascript
startDate = new Date("2024-10-19");
startDate.setHours(0, 0, 0, 0); // Força horário local
```

### 2. Formato Inválido

**Problema**: Data em formato diferente

```javascript
// ❌ Formatos que podem dar problema
"19/10/2024"  // pt-BR
"10/19/2024"  // en-US
"19-10-2024"  // Hífen invertido

// ✅ Formato correto
"2024-10-19"  // ISO 8601
```

**Verificação**: Logs mostrarão o formato recebido

### 3. Data Vazia

**Problema**: Filtro aplicado sem data

```javascript
startDate: ""
endDate: ""
```

**Solução**: Verificar se está undefined antes de usar

```javascript
if (req.query.startDate) {
  // Processar apenas se houver valor
}
```

## 📋 Checklist de Verificação

### Frontend

- [ ] Console mostra formato `YYYY-MM-DD`
- [ ] Tipo é `string`
- [ ] Valor não está vazio quando selecionado
- [ ] Valor é `undefined` quando não selecionado

### Backend

- [ ] Query params recebe formato `YYYY-MM-DD`
- [ ] Conversão para Date funciona
- [ ] setHours() aplica horário correto
- [ ] Logs mostram ISO format com timezone

### Banco de Dados

- [ ] Query usa operadores `gte` e `lte`
- [ ] Datas incluem horário completo
- [ ] Resultados incluem todos os logs do período

## 🐛 Troubleshooting

### Problema: Nenhum log aparece

**Verificar**:
1. Console do navegador mostra datas?
2. Backend recebe as datas?
3. Datas são convertidas corretamente?
4. Existem logs no período selecionado?

**Debug**:
```sql
-- Verificar logs no banco
SELECT COUNT(*), DATE(createdAt) 
FROM audit_logs 
GROUP BY DATE(createdAt) 
ORDER BY DATE(createdAt) DESC;
```

### Problema: Formato diferente

**Sintomas**:
```
Console mostra: "19/10/2024"
Backend espera: "2024-10-19"
```

**Causa**: Input não é type="date"

**Solução**: Verificar HTML
```html
<!-- ✅ Correto -->
<input type="date" v-model="filters.startDate" />

<!-- ❌ Errado -->
<input type="text" v-model="filters.startDate" />
```

### Problema: Timezone errado

**Sintomas**:
```
Selecionado: 2024-10-19
Processado: 2024-10-18T21:00:00.000Z (dia anterior!)
```

**Causa**: Conversão com timezone

**Solução**: Já implementada com setHours()

## 🧪 Teste Completo

### Passo a Passo

1. **Abrir Console** (F12)

2. **Acessar Logs**
   ```
   http://localhost:5175/audit-logs
   ```

3. **Selecionar Data Início**
   ```
   Escolher: 19/10/2024 (ou formato do seu navegador)
   ```

4. **Selecionar Data Fim**
   ```
   Escolher: 19/10/2024
   ```

5. **Verificar Console**
   ```javascript
   🔍 Filtros de data: {
     startDate: "2024-10-19", // ✅ Formato correto
     endDate: "2024-10-19",
     startDateType: "string",
     endDateType: "string"
   }
   ```

6. **Verificar Terminal Backend**
   ```
   🔍 Query params: {
     startDate: "2024-10-19", // ✅ Recebido correto
     endDate: "2024-10-19"
   }
   📅 startDate processada: 2024-10-19T03:00:00.000Z
   📅 endDate processada: 2024-10-20T02:59:59.999Z
   ```

7. **Verificar Resultados**
   ```
   Logs do dia 19/10/2024 aparecem na tabela
   ```

## 📚 Referências

### HTML5 Input Date

- [MDN: input type="date"](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date)
- Formato: ISO 8601 (YYYY-MM-DD)
- Valor sempre em inglês
- Exibição localizada

### JavaScript Date

- [MDN: Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)
- Construtor aceita ISO string
- Timezone do sistema
- setHours() para normalizar

### Prisma Date Filters

- [Prisma: Filtering](https://www.prisma.io/docs/concepts/components/prisma-client/filtering-and-sorting)
- `gte`: Greater than or equal
- `lte`: Less than or equal
- Aceita Date objects

## 🔄 Próximos Passos

### Se Logs Mostrarem Formato Correto

✅ Problema não é o formato  
→ Investigar query do Prisma  
→ Verificar dados no banco

### Se Logs Mostrarem Formato Errado

❌ Problema é o formato  
→ Corrigir conversão  
→ Adicionar validação

### Se Logs Não Aparecerem

❓ Problema na comunicação  
→ Verificar network tab  
→ Verificar CORS  
→ Verificar backend rodando

---

**Status**: 🔍 Debug Implementado  
**Data**: 19/10/2024  
**Objetivo**: Identificar formato das datas  
**Ação**: Testar e verificar logs
