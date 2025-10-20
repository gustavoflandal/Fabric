# 👤 Guia do Usuário - Sistema MES Fabric

**Versão**: 1.0.0  
**Público**: Usuários Finais

---

## 📋 Índice

1. [Introdução](#introducao)
2. [Acesso ao Sistema](#acesso)
3. [Dashboard](#dashboard)
4. [Produtos e BOMs](#produtos)
5. [Roteiros de Produção](#roteiros)
6. [Ordens de Produção](#ordens)
7. [Apontamentos](#apontamentos)
8. [Administração](#admin)

---

## 🎯 Introdução {#introducao}

O **Sistema MES Fabric** é uma ferramenta completa para gerenciar a produção industrial, desde o planejamento até a execução e controle.

### **O que você pode fazer:**
- ✅ Criar e gerenciar produtos
- ✅ Definir estruturas de produto (BOMs)
- ✅ Criar roteiros de produção
- ✅ Gerenciar ordens de produção
- ✅ Registrar apontamentos de produção
- ✅ Acompanhar KPIs em tempo real

---

## 🔐 Acesso ao Sistema {#acesso}

### **1. Fazer Login**

1. Acesse: `http://localhost:5173`
2. Digite seu email e senha
3. Clique em **Entrar**

**Usuários de Teste:**
- **Administrador**: admin@fabric.com / admin123
- **Gerente**: gerente@fabric.com / manager123
- **Operador**: operador1@fabric.com / operator123

### **2. Esqueci Minha Senha**

Entre em contato com o administrador do sistema.

### **3. Sair do Sistema**

Clique no botão **Sair** no canto superior direito.

---

## 📊 Dashboard {#dashboard}

O Dashboard é a tela inicial do sistema e mostra informações importantes em tempo real.

### **KPIs Principais**

#### **1. Ordens em Progresso**
- Mostra quantas ordens estão sendo executadas no momento
- Clique no card para ver detalhes

#### **2. Produtos Ativos**
- Total de produtos cadastrados no sistema
- Produtos ativos e disponíveis para produção

#### **3. Eficiência**
- Percentual de eficiência da produção
- Calculado como: (Produzido / Planejado) × 100
- Meta: acima de 90%

#### **4. Taxa de Refugo**
- Percentual de produtos com defeito
- Calculado como: (Refugo / Total) × 100
- Meta: abaixo de 5%

### **Ações Rápidas**

- **Nova Ordem de Produção**: Criar uma nova ordem
- **Gerenciar BOMs**: Acessar estruturas de produto
- **Executar MRP**: Calcular necessidades (em breve)

### **Módulos do Sistema**

Clique nos cards para acessar cada módulo:
- 👥 Usuários
- 🔐 Perfis
- 📋 Logs de Auditoria
- 📏 Unidades de Medida
- 🏢 Fornecedores
- 👥 Clientes
- ⚙️ Centros de Trabalho
- 🏷️ Produtos & BOMs

---

## 🏷️ Produtos e BOMs {#produtos}

### **Gerenciar Produtos**

#### **Listar Produtos**
1. No Dashboard, clique em **Produtos & BOMs**
2. Você verá a lista de todos os produtos
3. Use a busca para filtrar por código ou nome

#### **Criar Novo Produto**
1. Clique em **+ Novo Produto**
2. Preencha os campos:
   - **Código**: Identificador único (ex: PA-001)
   - **Nome**: Nome do produto
   - **Tipo**: 
     - Produto Acabado
     - Semi-Acabado
     - Matéria-Prima
     - Embalagem
   - **Categoria**: Selecione a categoria
   - **Unidade**: Unidade de medida (UN, KG, M, etc.)
   - **Descrição**: Opcional
3. Clique em **Salvar**

#### **Editar Produto**
1. Na lista, clique em **Editar**
2. Modifique os campos desejados
3. Clique em **Salvar**

#### **Desativar Produto**
1. Na lista, clique em **Desativar**
2. Confirme a ação
3. O produto não aparecerá mais nas seleções

### **Gerenciar BOMs (Estruturas de Produto)**

#### **O que é uma BOM?**
BOM (Bill of Materials) é a lista de componentes necessários para fabricar um produto.

**Exemplo:**
```
Smartphone (PA-001)
├─ Placa Mãe: 1 unidade
├─ Display: 1 unidade
├─ Bateria: 1 unidade
├─ Carcaça: 1 unidade
├─ Cabo USB: 1 unidade
├─ Parafusos: 8 unidades
├─ Caixa: 1 unidade
└─ Manual: 1 unidade
```

#### **Criar BOM**
1. Na lista de produtos, clique em **BOMs**
2. Clique em **+ Nova BOM**
3. Preencha:
   - **Versão**: Número da versão (ex: 1)
   - **Descrição**: Opcional
   - **Data de Validade**: A partir de quando é válida
4. Clique em **Salvar**

#### **Adicionar Componentes**
1. Na BOM criada, clique em **+ Adicionar Item**
2. Selecione o componente
3. Informe:
   - **Quantidade por Unidade**: Quanto é necessário
   - **Fator de Refugo**: % de perda (ex: 0.05 = 5%)
   - **Sequência**: Ordem de montagem
4. Clique em **Adicionar**

#### **Ativar BOM**
1. Apenas 1 BOM pode estar ativa por produto
2. Clique em **Ativar** na BOM desejada
3. A BOM anterior será desativada automaticamente

#### **Explodir BOM**
1. Clique em **Explodir BOM**
2. Informe a quantidade desejada
3. O sistema mostrará todos os materiais necessários
4. Útil para calcular necessidades de produção

---

## 🔧 Roteiros de Produção {#roteiros}

### **O que é um Roteiro?**
Roteiro é a sequência de operações necessárias para fabricar um produto.

**Exemplo:**
```
Smartphone (PA-001)
Op 10: Montagem da estrutura (15 min)
Op 20: Instalação de display (12 min)
Op 30: Fechamento (8 min)
Op 40: Teste funcional (10 min)
Op 50: Embalagem (5 min)
Total: 50 minutos por unidade
```

### **Criar Roteiro**
1. Na lista de produtos, clique em **Roteiros**
2. Clique em **+ Novo Roteiro**
3. Preencha:
   - **Versão**: Número da versão
   - **Descrição**: Opcional
   - **Data de Validade**: A partir de quando é válido
4. Clique em **Salvar**

### **Adicionar Operações**
1. No roteiro criado, clique em **+ Adicionar Operação**
2. Preencha:
   - **Sequência**: Ordem da operação (10, 20, 30...)
   - **Centro de Trabalho**: Onde será executada
   - **Descrição**: O que será feito
   - **Tempo de Setup**: Preparação (minutos)
   - **Tempo de Execução**: Por unidade (minutos)
3. Clique em **Adicionar**

### **Ativar Roteiro**
1. Apenas 1 roteiro pode estar ativo por produto
2. Clique em **Ativar** no roteiro desejado
3. O roteiro anterior será desativado automaticamente

### **Calcular Tempo Total**
1. Clique em **Calcular Tempo**
2. Informe a quantidade a produzir
3. O sistema mostrará:
   - Tempo de setup total
   - Tempo de execução total
   - Tempo total estimado

---

## 📋 Ordens de Produção {#ordens}

### **O que é uma Ordem de Produção?**
É uma instrução para fabricar uma quantidade específica de um produto.

### **Criar Ordem de Produção**

1. No Dashboard, clique em **Nova Ordem de Produção**
2. Preencha:
   - **Número da Ordem**: Identificador único (ex: OP-2025-001)
   - **Produto**: Selecione o produto a fabricar
   - **Quantidade**: Quantas unidades produzir
   - **Data de Início**: Quando começar
   - **Data de Fim**: Quando terminar
   - **Prioridade**: 1 (baixa) a 10 (urgente)
   - **Observações**: Opcional
3. Clique em **Criar Ordem**

**O sistema calculará automaticamente:**
- ✅ Materiais necessários (via BOM)
- ✅ Operações necessárias (via Roteiro)
- ✅ Tempos de produção

### **Status da Ordem**

#### **PLANEJADA** (Azul)
- Ordem criada mas não liberada
- Materiais e operações calculados
- **Ação**: Liberar para produção

#### **LIBERADA** (Roxo)
- Ordem aprovada para produção
- Aguardando início
- **Ação**: Iniciar produção

#### **EM PROGRESSO** (Amarelo)
- Produção em andamento
- Progresso sendo atualizado
- **Ação**: Atualizar progresso ou concluir

#### **CONCLUÍDA** (Verde)
- Produção finalizada
- 100% produzido
- Ordem fechada

#### **CANCELADA** (Vermelho)
- Ordem cancelada
- Não será produzida

### **Fluxo de Trabalho**

```
1. PLANEJADA
   ↓ (Gerente clica em "Liberar Ordem")
2. LIBERADA
   ↓ (Operador clica em "Iniciar Produção")
3. EM PROGRESSO
   ↓ (Operador atualiza progresso)
   ↓ (Ao atingir 100%)
4. CONCLUÍDA
```

### **Ver Detalhes da Ordem**

1. Na lista de ordens, clique em **Detalhes**
2. Você verá:
   - **Informações Gerais**: Status, quantidade, datas
   - **Materiais Necessários**: Lista completa
   - **Operações**: Sequência de produção
   - **Progresso**: Barra visual

### **Liberar Ordem** (Gerente)
1. Abra os detalhes da ordem PLANEJADA
2. Clique em **Liberar Ordem**
3. Status muda para LIBERADA

### **Iniciar Produção** (Operador)
1. Abra os detalhes da ordem LIBERADA
2. Clique em **Iniciar Produção**
3. Status muda para EM PROGRESSO
4. Data/hora de início é registrada

### **Atualizar Progresso** (Operador)
1. Abra os detalhes da ordem EM PROGRESSO
2. Na seção "Atualizar Progresso":
   - **Quantidade Produzida**: Informe o total produzido
   - **Refugo**: Informe quantidade com defeito
3. Clique em **Atualizar**
4. Barra de progresso é atualizada
5. Ao atingir 100%, ordem é concluída automaticamente

### **Concluir Ordem** (Gerente)
1. Abra os detalhes da ordem EM PROGRESSO
2. Clique em **Concluir Ordem**
3. Status muda para CONCLUÍDA
4. Data/hora de fim é registrada

### **Cancelar Ordem** (Gerente)
1. Abra os detalhes da ordem
2. Clique em **Cancelar Ordem**
3. Confirme a ação
4. Status muda para CANCELADA

---

## ⏱️ Apontamentos de Produção {#apontamentos}

### **O que é um Apontamento?**
É o registro da execução de uma operação, incluindo tempos e quantidades produzidas.

### **Acessar Apontamentos**
1. No menu, clique em **Apontamentos** (ou acesse via URL)
2. Você verá a lista de todos os apontamentos

### **Criar Apontamento** (Operador)

**Nota**: A interface de criação está em desenvolvimento. Por enquanto, os apontamentos são criados automaticamente ao atualizar o progresso das ordens.

**Informações Registradas:**
- Ordem de produção
- Operação executada
- Operador (usuário logado)
- Data/hora de início
- Data/hora de fim
- Quantidade boa produzida
- Quantidade de refugo
- Tempo de setup
- Tempo de execução

### **Consultar Meus Apontamentos**
1. Na tela de apontamentos
2. Os apontamentos do usuário logado são destacados
3. Use os filtros para buscar por período

### **Filtrar Apontamentos**
- **Por Status**: Em progresso ou concluído
- **Por Ordem**: Apontamentos de uma ordem específica
- **Por Operador**: Apontamentos de um operador
- **Por Período**: Data de início e fim

---

## ⚙️ Administração {#admin}

### **Gerenciar Usuários** (Admin)

#### **Criar Usuário**
1. Acesse **Usuários**
2. Clique em **+ Novo Usuário**
3. Preencha:
   - **Nome**: Nome completo
   - **Email**: Email único
   - **Senha**: Senha inicial
   - **Perfis**: Selecione os perfis (ADMIN, MANAGER, OPERATOR)
4. Clique em **Salvar**

#### **Editar Usuário**
1. Na lista, clique em **Editar**
2. Modifique os campos
3. Clique em **Salvar**

#### **Desativar Usuário**
1. Na lista, clique em **Desativar**
2. Usuário não poderá mais fazer login

#### **Resetar Senha**
1. Edite o usuário
2. Informe nova senha
3. Salve

### **Gerenciar Perfis** (Admin)

#### **Perfis Padrão**
- **ADMIN**: Acesso total (47 permissões)
- **MANAGER**: Gestão e visualização (30 permissões)
- **OPERATOR**: Execução (15 permissões)

#### **Criar Perfil Personalizado**
1. Acesse **Perfis**
2. Clique em **+ Novo Perfil**
3. Preencha:
   - **Código**: Identificador único (ex: SUPERVISOR)
   - **Nome**: Nome do perfil
   - **Descrição**: Opcional
4. Clique em **Salvar**

#### **Atribuir Permissões**
1. Na lista de perfis, clique em **Permissões**
2. Marque as permissões desejadas:
   - **Usuários**: create, read, update, delete
   - **Produtos**: create, read, update, delete
   - **BOMs**: create, read, update, delete
   - **Roteiros**: create, read, update, delete
   - **Ordens**: create, read, update, delete, execute
   - **Apontamentos**: create, read, update, delete
   - E mais...
3. Clique em **Salvar Permissões**

### **Logs de Auditoria** (Admin)

#### **Consultar Logs**
1. Acesse **Logs de Auditoria**
2. Você verá todas as ações realizadas no sistema
3. Informações registradas:
   - Usuário que executou
   - Ação realizada (create, update, delete)
   - Recurso afetado (product, order, etc.)
   - Data/hora
   - Detalhes da ação

#### **Filtrar Logs**
- Por usuário
- Por ação
- Por recurso
- Por período

---

## 💡 Dicas e Boas Práticas

### **Planejamento**
✅ Sempre crie BOMs e Roteiros antes de criar ordens  
✅ Mantenha apenas 1 BOM e 1 Roteiro ativos por produto  
✅ Use versionamento para controlar mudanças  
✅ Defina prioridades nas ordens (1-10)  

### **Execução**
✅ Libere ordens apenas quando materiais estiverem disponíveis  
✅ Atualize o progresso regularmente  
✅ Registre refugo para análise de qualidade  
✅ Finalize ordens assim que concluídas  

### **Controle**
✅ Monitore o dashboard diariamente  
✅ Mantenha eficiência acima de 90%  
✅ Mantenha refugo abaixo de 5%  
✅ Analise ordens em atraso  

### **Segurança**
✅ Não compartilhe sua senha  
✅ Faça logout ao sair  
✅ Use senhas fortes  
✅ Reporte problemas ao administrador  

---

## ❓ Perguntas Frequentes

### **1. Esqueci minha senha, o que fazer?**
Entre em contato com o administrador do sistema.

### **2. Não consigo criar uma ordem, por quê?**
Verifique se:
- O produto tem BOM ativa
- O produto tem Roteiro ativo
- Você tem permissão `production_orders.create`

### **3. Como cancelo uma ordem em progresso?**
Apenas usuários com permissão podem cancelar. Abra os detalhes e clique em "Cancelar Ordem".

### **4. Posso editar uma ordem concluída?**
Não. Ordens concluídas são somente leitura para manter a integridade dos dados.

### **5. Como vejo o histórico de uma ordem?**
Acesse os Logs de Auditoria e filtre pela ordem específica.

### **6. Posso ter múltiplas BOMs ativas?**
Não. Apenas 1 BOM pode estar ativa por produto por vez.

### **7. Como calculo as necessidades de material?**
Use a função "Explodir BOM" e informe a quantidade desejada.

### **8. Onde vejo meus apontamentos?**
Acesse "Apontamentos" e use o filtro "Meus Apontamentos".

---

## 📞 Suporte

### **Contato**
- **Email**: suporte@fabric.com (exemplo)
- **Telefone**: (00) 0000-0000 (exemplo)
- **Horário**: Segunda a Sexta, 8h às 18h

### **Documentação Adicional**
- **Relatório Final**: `/docs/RELATORIO_FINAL.md`
- **Documentação Técnica**: `/docs/DOCUMENTACAO_TECNICA.md`
- **Dados do Sistema**: `/docs/DADOS_SISTEMA.md`

---

**Guia do Usuário - Sistema MES Fabric** ✅

*Última atualização: 20 de Outubro de 2025*
