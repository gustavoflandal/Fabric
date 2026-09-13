# 👤 Guia do Usuário - Sistema Fabric

**Versão**: 2.0.0
**Público**: Usuários Finais

Este é o manual completo do sistema Fabric — cobre o núcleo de PCP/produção e todos os módulos licenciáveis (WMS, Compras, Contagem de Inventário, Manutenção e YMS). Dentro do sistema, o botão de **Ajuda** (ícone de interrogação no topo de qualquer tela) mostra este mesmo conteúdo com um sumário de navegação gerado automaticamente — não precisa de um índice manual aqui.

---

## 🎯 Introdução

O **Sistema MES Fabric** é uma ferramenta completa para gerenciar a produção industrial, desde o planejamento até a execução e controle.

### **O que você pode fazer:**
- ✅ Criar e gerenciar produtos
- ✅ Definir estruturas de produto (BOMs)
- ✅ Criar roteiros de produção
- ✅ Gerenciar ordens de produção
- ✅ Registrar apontamentos de produção
- ✅ Acompanhar KPIs em tempo real

---

## 🔐 Acesso ao Sistema

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

## 📊 Dashboard

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
- **Executar MRP**: Calcular necessidades de materiais (veja a seção **MRP** mais abaixo)

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

## 🏷️ Produtos e BOMs

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

## 🔧 Roteiros de Produção

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

## 📋 Ordens de Produção

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

## ⏱️ Apontamentos de Produção

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

## 📐 MRP — Planejamento de Necessidades de Materiais

O MRP calcula, a partir das ordens de produção pendentes e da estrutura de produto (BOM) de cada item, o que falta comprar ou produzir para atender tudo o que está planejado — comparando a necessidade bruta com o que já existe em estoque e o que já está em pedido de compra.

### Executar o MRP

1. Na tela **MRP**, clique em **🔄 Executar MRP Completo** no canto superior direito.
2. O sistema recalcula as necessidades para todas as ordens de produção pendentes. Ao terminar, a aba **Resultados Detalhados** é aberta automaticamente.

Os 4 cards no topo resumem o resultado: quantas ordens estão pendentes, quantos itens diferentes são necessários no total, quantos precisam ser comprados e quantos precisam ser produzidos internamente.

### Aba Sugestões

Mostra duas listas lado a lado:

- **Sugestões de Compra**: itens que faltam e não são fabricados internamente (matéria-prima, por exemplo). Cada sugestão mostra a quantidade necessária, o lead time do fornecedor (em dias) e a data sugerida para disparar a compra, calculada de trás para frente a partir da data de necessidade.
- **Sugestões de Produção**: itens que faltam e são fabricados internamente — mesma lógica, mas sugerindo abrir uma ordem de produção em vez de uma compra.

Cada sugestão tem uma prioridade (**Alta**, **Média** ou **Baixa**) indicando a urgência.

### Aba Resultados Detalhados

Mostra, ordem de produção por ordem de produção, a lista completa de itens necessários (a "explosão" da estrutura de produto), com:

- **Necessário**: quantidade total exigida pela ordem.
- **Disponível**: quanto já existe em estoque.
- **Em Pedido**: quanto já está pedido a fornecedores mas ainda não chegou.
- **Necessidade Líquida**: o que realmente falta (Necessário − Disponível − Em Pedido).
- **Ação**: se o item precisa ser **Comprado**, **Produzido**, ou se já está coberto (sem ação necessária).

## 📊 Estoque

Tela de consulta de saldos e registro de movimentações manuais de estoque (entradas, saídas e ajustes que não vêm automaticamente de um recebimento ou apontamento de produção).

### Consultar saldos

A tabela principal lista o saldo de cada produto, com filtros por **Status** (OK, Baixo, Crítico, Excesso — calculados a partir dos níveis mínimo/máximo cadastrados no produto) e por **Tipo** (Matéria-Prima, Semi-Acabado, Produto Acabado). Os 5 cards no topo resumem quantos produtos estão em cada situação.

### Registrar uma Entrada

Use para lançar estoque que chegou fora do fluxo normal de recebimento de compra (ex: ajuste inicial de estoque, devolução de cliente).

1. Clique em **⬆️ Entrada**.
2. Escolha o Produto, informe a quantidade, o motivo e uma referência (opcional, ex: número de um documento).
3. Confirme.

### Registrar uma Saída

Mesmo fluxo da Entrada, mas para baixar estoque manualmente (ex: perda, amostra, descarte).

1. Clique em **⬇️ Saída**.
2. Escolha o Produto, quantidade, motivo e referência.
3. Confirme. O sistema não permite saída maior que o saldo disponível.

### Registrar um Ajuste

Use quando uma contagem física (veja o módulo de **Contagem de Inventário**) ou uma divergência identificada precisar corrigir o saldo diretamente para um valor específico, em vez de somar/subtrair uma quantidade.

1. Clique em **🔧 Ajuste**.
2. Escolha o Produto, informe o motivo do ajuste.
3. Confirme.

Depois de qualquer uma dessas 3 operações, é possível clicar em **🖨️ Imprimir Último Comprovante** para gerar um recibo da movimentação mais recente.

## 📈 Relatórios

Análises consolidadas de um período escolhido, organizadas em 4 abas.

1. Informe a **Data Inicial** e **Data Final** do período que quer analisar.
2. Clique em **📊 Gerar Relatórios**.
3. Navegue pelas abas:
   - **📊 Consolidado**: visão geral do período.
   - **🏭 Produção**: volume produzido, ordens concluídas.
   - **⚡ Eficiência**: indicadores de produtividade (produzido vs. planejado).
   - **✅ Qualidade**: indicadores de refugo/retrabalho.

## ⚙️ Configurações do Sistema

Parâmetros de instalação que só administradores conseguem editar — diferente dos cadastros do dia a dia, aqui ficam ajustes técnicos que afetam o comportamento geral do sistema.

Os parâmetros são agrupados por categoria (**WMS**, **Auditoria**, **Rate Limiting**). Cada linha mostra o parâmetro, uma descrição do que ele faz, e um campo editável (texto, número, verdadeiro/falso, ou uma lista de opções fixas, dependendo do tipo do parâmetro).

### Alterar um parâmetro

1. Localize o parâmetro dentro da categoria correspondente.
2. Altere o valor no campo.
3. Clique em **Salvar** ao lado daquele parâmetro específico — cada linha salva individualmente, não existe um "Salvar tudo" geral.

Parâmetros da categoria **Rate Limiting** só têm efeito depois que o serviço do backend for reiniciado — uma alteração salva aqui fica pendente até o próximo restart.

## 🏭 Dashboard PCP (detalhado)

Além do Dashboard inicial (acessível ao entrar no sistema, com os cards de módulos), existe um painel mais detalhado dedicado ao PCP, com indicadores do dia: Ordens em Produção (e o total geral), Eficiência do Dia (com a variação em relação a ontem), Taxa de Refugo (com a quantidade de unidades refugadas), e Ordens Atrasadas. Use este painel quando precisar de uma leitura mais aprofundada do desempenho da produção do que os cards genéricos do Dashboard inicial oferecem.

---

## ⚙️ Administração

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
- **ADMIN**: acesso total — todas as permissões do sistema, de todos os módulos licenciados.
- **MANAGER**: gestão e visualização — cria, aprova e acompanha, mas normalmente não executa tarefas operacionais do dia a dia.
- **OPERATOR**: execução — o necessário para operar o sistema no chão de fábrica/armazém/pátio (registrar apontamentos, fazer check-in, contar itens, etc.), sem acesso a configurações administrativas.

O número exato de permissões cresce conforme os módulos são adicionados ao sistema — confira a lista atual em **Perfis → Permissões** para qualquer perfil.

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

## 🏭 WMS — Gestão de Armazém

O módulo **WMS (Warehouse Management System)** controla a estrutura física dos armazéns, o endereçamento de materiais e a execução das tarefas de recebimento — do descarregamento do caminhão até o produto guardado na posição definitiva. Ele também traz um painel de indicadores e um editor de workflows para personalizar as etapas de recebimento por regra de negócio.

**Importante**: o WMS é um módulo licenciável por instalação. Se ele não estiver habilitado na sua empresa, as telas abaixo (Armazéns, Estrutura de Armazenagem, Painel de Operações, Indicadores e Templates de Workflow) simplesmente não existem no sistema — o acesso é bloqueado no nível da API, não só escondido no menu. Fale com o administrador do sistema caso precise dele ativado.

### **O que você pode fazer:**
- ✅ Cadastrar armazéns e suas estruturas de armazenagem (ruas, andares, posições)
- ✅ Gerar e gerenciar posições de endereçamento (bloquear, desbloquear, excluir)
- ✅ Executar, passo a passo, as tarefas de um recebimento (descarga, conferência, etiquetagem, quarentena, segregação, amostragem e alocação)
- ✅ Acompanhar KPIs de volume, tempo de ciclo, produtividade, gargalos e ocupação
- ✅ Configurar workflows personalizados que decidem quais etapas um recebimento deve seguir

---

### Armazéns

Cadastro dos armazéns físicos da empresa (matriz, filiais, centros de distribuição). É o ponto de partida do módulo: toda estrutura de armazenagem pertence a um armazém.

#### **Listar e buscar armazéns**
1. Acesse **Armazéns**
2. A tela mostra todos os armazéns cadastrados, com código, nome, documento, contato (email/telefone), cidade e status
3. Use o campo **Buscar** para filtrar por código, nome ou outros dados — a busca é aplicada automaticamente conforme você digita

#### **Criar novo armazém**
1. Clique em **+ Novo Armazém**
2. Preencha os campos:
   - **Código**: identificador único do armazém (obrigatório)
   - **Nome**: nome do armazém (obrigatório)
   - **Razão Social**: nome jurídico completo, se aplicável
   - **CNPJ/CPF**: documento do armazém/unidade
   - **Telefone** e **Email**: contato do armazém
   - **Endereço**, **Cidade**, **Estado**, **CEP**: localização física
   - **Responsável**: nome do gerente/responsável pelo armazém
   - **Capacidade (m³)**: capacidade volumétrica total, opcional
   - **Descrição**: observações livres, opcional
   - **Ativo**: caixa marcada por padrão — controla se o armazém aparece nas seleções do restante do sistema
3. Clique em **Criar**

#### **Editar armazém**
1. Na lista, clique em **Editar** na linha do armazém desejado
2. Altere os campos necessários
3. Clique em **Salvar**

#### **Ativar/Desativar armazém**
1. Na lista, clique em **Desativar** (ou **Ativar**, se já estiver inativo) na linha do armazém
2. Confirme a ação na caixa de confirmação
3. Um armazém inativo continua no cadastro mas fica marcado com o status "Inativo"

#### **Excluir armazém**
1. Na lista, clique em **Excluir**
2. Confirme a ação
3. **Atenção**: use com cuidado — prefira desativar um armazém que já tem estrutura ou movimentação, em vez de excluí-lo.

---

### Estrutura de Armazenagem

Aqui você define a "planta" de endereçamento de cada armazém: as **ruas** (estruturas), quantos **andares** e **posições** cada rua tem, e as regras físicas (peso, dimensões, tipo de posição). A partir de uma estrutura, o sistema **gera automaticamente** os endereços individuais (posições) que serão usados na alocação de materiais.

#### **Listar e filtrar estruturas**
1. Acesse **Estrutura de Armazenagem**
2. A lista mostra código da rua, armazém, andares, posições, quantas posições já foram geradas, capacidade de peso e se a rua está bloqueada
3. Use **Buscar** (código da rua ou nome do armazém) e o filtro **Bloqueada** (Todas / Sim / Não) para refinar a lista
4. A lista é paginada — use a navegação de páginas ao final da tabela

#### **Criar nova estrutura (rua)**
1. Clique em **+ Nova Estrutura**
2. Preencha:
   - **Código da Rua**: identificador da rua dentro do armazém (obrigatório)
   - **Armazém**: a qual armazém esta rua pertence (obrigatório)
   - **Andares**: quantidade de andares/níveis da rua (obrigatório, número inteiro)
   - **Posições**: quantas posições existem por andar (obrigatório, número inteiro)
   - **Capacidade de Peso (kg)**: peso máximo suportado por posição (obrigatório)
   - **Altura**, **Largura**, **Profundidade (cm)**: dimensões físicas da posição (obrigatórios)
   - **Altura Máxima (cm)**: altura máxima de carga permitida (obrigatório)
   - **Tipo de Posição**: o tipo de estrutura de armazenagem (ex.: Porta-Paletes, Drive-In, Flow Rack, Mezanino, Racks, Estantes Industriais, entre outros) (obrigatório)
   - **Bloqueada**: marque se a rua inteira deve começar bloqueada para uso
3. Clique em **Criar**

**Total de posições da rua** = Andares × Posições. Por exemplo, uma rua com 4 andares e 10 posições por andar terá 40 endereços possíveis quando as posições forem geradas.

#### **Gerar as posições de uma estrutura**
As posições individuais (os endereços de fato) só existem depois de geradas explicitamente — criar a estrutura não cria os endereços sozinha.

1. Na lista, clique em **Editar** na rua desejada (isso só é possível enquanto ela ainda não tem posições geradas)
2. Na seção **Geração de Posições**, confira o resumo (quantos andares × posições serão criados)
3. Clique em **Gerar Posições**
4. Confirme a ação — o sistema cria todos os endereços de uma vez

**Atenção**: enquanto uma rua tiver posições geradas, os botões **Editar** e **Excluir** dela ficam desabilitados na lista principal (com essa dica ao passar o mouse). Para alterar as dimensões da rua ou excluí-la, é preciso excluir as posições geradas primeiro.

#### **Excluir as posições de uma estrutura**
1. Abra a estrutura em modo de edição
2. Na seção **Geração de Posições**, clique em **Excluir Posições**
3. Confirme — esta ação não pode ser desfeita
4. Depois disso a rua volta a poder ser editada ou excluída normalmente

#### **Consultar e gerenciar as posições geradas**
1. Na lista de estruturas, clique em **Pos** (só aparece quando a rua já tem posições geradas)
2. Uma janela lista cada posição com código, andar, posição e status (Disponível/Bloqueada)
3. Em cada posição você pode:
   - **Bloquear**/**Desbloquear**: impede ou libera o uso da posição para novas alocações
   - **Excluir**: remove aquela posição específica
4. No rodapé da janela:
   - **Ver Estrutura**: abre uma grade visual de todas as posições da rua (ver abaixo)
   - **Excluir Todas**: remove todas as posições da rua de uma vez (mesmo efeito de "Excluir Posições" na edição)

#### **Ver o mapa visual da estrutura**
1. Na janela de posições, clique em **Ver Estrutura**
2. O sistema mostra uma grade por andar, com uma célula colorida para cada posição:
   - 🟩 Verde: posição disponível
   - 🟥 Vermelho: posição bloqueada
3. Passe o mouse sobre uma célula para ver o código completo e o status em detalhe

---

### Painel de Operações

O Painel de Operações é a tela de **execução do recebimento**: mostra, para cada recebimento de compra em andamento, a sequência de etapas que ele precisa cumprir e em que etapa ele está agora. As etapas possíveis são: **Descarga**, **Conferência**, **Etiquetagem**, **Quarentena**, **Segregação**, **Amostragem** e **Alocação** — nem todo recebimento passa por todas elas; isso depende do workflow aplicado (veja a seção Templates de Workflow).

As etapas de um recebimento são sempre executadas **em sequência**: só é possível agir na primeira etapa ainda não concluída. As demais aparecem bloqueadas até chegar a sua vez.

#### **Entender as cores das etapas**
Cada etapa aparece como um retângulo colorido:
- **Verde com ✓**: etapa já concluída
- **Azul/destacado (com anel ao redor)**: é a etapa da vez, e ela está livre ou já é sua — você pode agir
- **Amarelo**: é a etapa da vez, mas outro operador já assumiu — você só pode ver o detalhe, não agir
- **Cinza (desabilitado)**: etapa ainda bloqueada, aguardando as anteriores serem concluídas

#### **Alternar entre "Todas" e "Minhas"**
Use os botões **Todas**/**Minhas** no topo da tela para ver todos os recebimentos ativos ou só os que têm alguma etapa atribuída a você.

O painel também se atualiza sozinho a cada ~25 segundos, então não é preciso recarregar a página manualmente para ver o progresso de outros operadores.

#### **Assumir e executar uma etapa (Descarga, Conferência, Etiquetagem, Quarentena, Segregação, Amostragem)**
1. Clique no retângulo azul/destacado da etapa desejada
2. Se a etapa ainda não tiver dono, aparece a confirmação **"Pegar esta tarefa?"** — clique em **Pegar tarefa** para assumi-la
3. Após assumir (ou se a etapa já era sua), abre a janela **"Conduzir etapa"**
4. Opcionalmente, clique em **🖨️ Imprimir documento de apoio** para gerar um PDF com os itens do recebimento
5. Clique em **Concluir etapa** para finalizar — o painel avança automaticamente para a próxima etapa da sequência

#### **Executar a Alocação (endereçamento)**
A etapa de Alocação é diferente das demais: em vez de uma simples confirmação, ela pede que você informe **onde** cada item foi guardado.

1. Clique no retângulo da etapa **Alocação** quando ela estiver liberada para você
2. Confirme "Pegar tarefa" se ainda não tiver dono
3. Na janela **Alocação**:
   - **Item**: selecione o item do recebimento a endereçar
   - **Posição sugerida**: se o sistema encontrar uma posição recomendada (com base nas regras de armazenagem), ela aparece com uma pontuação — clique nela para usá-la
   - **Posição (código)**: digite manualmente o código da posição caso prefira não usar a sugestão; o sistema valida o código ao sair do campo e avisa se a posição não existir
   - **Quantidade**: quantidade a ser endereçada nesta posição (obrigatória)
4. Clique em **Endereçar**
5. Se o item tiver mais quantidade do que a informada, repita o processo para o restante — só quando tudo estiver endereçado o recebimento é dado como concluído
6. Use **🖨️ Imprimir documento de apoio** a qualquer momento para gerar o PDF de apoio da alocação

#### **Ver o detalhe de uma etapa já concluída ou de outro operador**
1. Clique no retângulo verde (concluída) ou amarelo (ativa com outro operador)
2. A janela de detalhe mostra tipo da etapa, status, responsável (quando houver) e data/hora de conclusão (quando concluída)

---

### Indicadores (KPIs)

O Dashboard de KPIs do WMS mostra o desempenho operacional do armazém em cinco abas: **Volume/Status**, **Tempo de Ciclo**, **Produtividade**, **Gargalos** e **Ocupação**.

#### **Navegar pelo dashboard**
1. Acesse **Indicadores (KPIs)** dentro do WMS
2. Use as abas no topo para alternar entre as visões
3. Todas as abas, exceto Ocupação, têm um seletor de período: **7 dias**, **30 dias** ou **90 dias**
4. Clique em **Atualizar** para recarregar os dados a qualquer momento

Se você não tiver permissão para ver os dados de uma aba específica, ela mostra sua própria mensagem de erro sem derrubar as demais — só quando **todas** as fontes de dados falham é que a tela inteira exibe erro com um botão **Tentar Novamente**.

#### **Aba Volume/Status**
- **Recebimentos ativos**: quantos recebimentos estão em andamento agora
- **Recebimentos finalizados**: quantos foram concluídos no período
- Gráfico de barras empilhadas mostrando, por tipo de etapa, quantas tarefas estão Pendentes, Em Progresso, Concluídas ou Canceladas

#### **Aba Tempo de Ciclo**
- **Tempo médio do recebimento completo**: quantas horas, em média, um recebimento leva do início ao fim
- Gráfico com o tempo médio (em horas) de cada tipo de etapa individualmente — útil para identificar qual etapa está consumindo mais tempo

#### **Aba Produtividade**
- Tabela por operador, com o total de tarefas concluídas e o tempo médio de execução de cada um

#### **Aba Gargalos**
- Cartões com a contagem de tarefas "presas" (paradas há muito tempo) por tipo de etapa
- Tabela detalhada com o recebimento, a etapa travada e há quantas horas ela está parada
- Clique em **Ver no painel**, na linha de um recebimento, para ir direto ao Painel de Operações e resolver a pendência

#### **Aba Ocupação**
- **% de ocupação geral**: percentual de posições ocupadas em relação ao total de posições geradas em todos os armazéns
- Gráfico de barras empilhadas por armazém, mostrando posições **Ocupadas**, **Livres** e **Bloqueadas**
- Esta aba não usa o filtro de período — ela reflete a situação atual do estoque

---

### Templates de Workflow

Os workflows definem **quais etapas** um recebimento deve seguir, e em que ordem, de acordo com regras de negócio (por exemplo: recebimentos de um fornecedor específico passam por Quarentena e Amostragem; os demais seguem direto para Alocação). Quando nenhum workflow ativo se aplica a um recebimento, o sistema usa a cadeia padrão do sistema.

#### **Listar workflows**
1. Acesse **Templates de Workflow**
2. A lista mostra nome, prioridade e status (Ativo/Inativo) de cada workflow
3. Quando um recebimento pode se encaixar em mais de um workflow ativo, a **prioridade** (número) decide qual é aplicado — confira a regra de prioridade com o administrador do sistema, pois ela não é exibida diretamente na tela

#### **Criar um novo workflow**
1. Clique em **Novo Workflow**
2. Preencha os dados gerais:
   - **Nome**: identifica o workflow (obrigatório)
   - **Prioridade**: número usado para desempate quando mais de um workflow se aplicaria ao mesmo recebimento
   - **Ativo**: caixa que liga/desliga o workflow sem precisar excluí-lo
   - **Descrição**: texto livre, opcional
3. Em **"Quando este workflow se aplica (condição de gatilho)"**, monte a condição que decide se este workflow deve ser usado (veja "Montar uma condição" abaixo). Se nenhuma condição for definida, ela se aplica sempre que nenhum outro workflow mais específico bater.
4. Monte o fluxo de etapas no quadro (veja "Montar o fluxo de etapas" abaixo)
5. Clique em **Salvar**

#### **Montar o fluxo de etapas**
O quadro de edição funciona por arrastar-e-soltar:
1. À esquerda ficam os tipos de etapa disponíveis: Descarga, Conferência, Etiquetagem, Quarentena, Segregação, Amostragem, Alocação e Decisão
2. Arraste um tipo até o quadro central para criar um nó de etapa
3. O nó **Entrada** já vem fixo no quadro (é o ponto de partida do fluxo) e não pode ser removido
4. Conecte os nós arrastando de um conector até outro, na ordem em que as etapas devem acontecer
5. Um nó do tipo **Decisão** cria uma bifurcação no fluxo: clique nele para configurar sua condição (veja abaixo) — as duas saídas do nó representam os caminhos "SIM" e "NÃO"
6. Clique em um nó para selecioná-lo; no painel à direita você pode configurar a condição (se for um nó de Decisão) ou clicar em **Remover nó** para excluí-lo do fluxo

#### **Montar uma condição**
As condições (tanto o gatilho do workflow quanto as bifurcações de Decisão) usam o mesmo construtor:
1. Escolha o **campo** a comparar — por exemplo peso do produto, volume, tipo de embalagem, grupo de segregação, quantidade máxima de empilhamento, se o produto é controlado por lote, categoria do produto ou fornecedor do pedido
2. Escolha o **operador**: igual, diferente, maior que, maior ou igual, menor que, menor ou igual, ou contém
3. Digite o **valor** de comparação e saia do campo para confirmá-lo
4. Clique em **+ condição** para adicionar mais uma condição solta, ou em **+ subgrupo** para agrupar várias condições com **E** (todas precisam ser verdadeiras) ou **OU** (basta uma)
5. Use o **✕** ao lado de uma condição, ou **Remover grupo**, para excluí-la

#### **Editar, duplicar e excluir um workflow**
1. Na lista, clique em **Editar** para abrir o workflow no editor e alterá-lo
2. Clique em **Duplicar** para criar uma cópia do workflow (útil como ponto de partida para uma variação)
3. Clique em **Excluir** e confirme na janela — a exclusão não afeta os recebimentos que já foram criados com aquele workflow, apenas impede que novos recebimentos passem a usá-lo (eles passam a usar outro template ativo ou a cadeia padrão)

---

## 🛒 Compras

O módulo **Compras** cobre o ciclo completo de aquisição de materiais: pedir orçamento a fornecedores, transformar o orçamento aprovado em pedido de compra e registrar o recebimento físico da mercadoria — inclusive por leitura do XML da Nota Fiscal Eletrônica (NFe).

**Este módulo precisa estar licenciado na sua instalação.** Se os itens **Orçamentos de Compra**, **Pedidos de Compra** e **Recebimentos** não aparecem no menu, fale com o administrador do sistema: eles dependem do módulo **COMPRAS** estar habilitado para o seu ambiente.

> ⚠️ **Observação conhecida**: tanto o orçamento quanto o pedido de compra têm um status **Aprovado** que precisa ser alcançado antes de "Gerar Pedido" (a partir de um orçamento) ou "Confirmar" (um pedido) funcionarem — mas, no momento, a interface não oferece nenhum botão para mover um orçamento ou pedido para esse status a partir do status inicial (Pendente). Se você tentar gerar um pedido ou confirmar algo que ainda não foi aprovado, o sistema recusa a ação. Até essa lacuna ser resolvida, a aprovação precisa ser feita por um administrador diretamente no banco de dados ou por outro meio combinado com a equipe técnica.

### Orçamentos de Compra

Tela onde você registra as cotações pedidas a fornecedores e acompanha o retorno deles antes de fechar um pedido de compra.

#### Consultar orçamentos

1. Acesse **Orçamentos de Compra**
2. Use o campo **Buscar** para filtrar pelo texto digitado
3. Use o filtro **Status** para restringir a um estágio específico:
   - **Pendente**: orçamento criado, ainda não enviado ao fornecedor
   - **Enviado**: já encaminhado ao fornecedor
   - **Recebido**: o fornecedor já retornou com os preços
   - **Aprovado**: orçamento aprovado internamente — é o único status que libera o botão **Gerar Pedido**
   - **Rejeitado**: orçamento descartado
   - **Expirado**: passou da data de validade

#### Criar um novo orçamento

1. Clique em **+ Novo Orçamento**
2. Preencha:
   - **Fornecedor**: selecione na lista de fornecedores cadastrados (obrigatório)
   - **Data de Validade**: até quando o orçamento é válido (obrigatório)
   - **Observações**: texto livre (opcional)
3. Na seção **Itens**, clique em **+ Adicionar Item** para cada material a cotar e preencha:
   - **Produto**: selecione o item (obrigatório)
   - **Qtd**: quantidade desejada (obrigatório)
   - **Preço**: preço unitário informado/estimado (obrigatório)
   - **Desc %**: percentual de desconto sobre o item (opcional)
   - Use o botão **X** ao lado da linha para remover um item adicionado por engano
4. Clique em **Salvar**

#### Ver detalhes de um orçamento

1. Na lista, clique em **Ver**
2. A tela mostra Número, Status, Fornecedor, Data de Solicitação, Data de Validade, Valor Total e, quando aplicável, quem aprovou e as Observações
3. Na parte inferior aparece a tabela de itens, com Produto, Quantidade, Preço Unit., Desconto e Total de cada linha

#### Gerar pedido de compra a partir de um orçamento

Só é possível para orçamentos com status **Aprovado**.

1. Na lista (ou dentro do modal **Ver**), clique em **Gerar Pedido**
2. Confirme a pergunta "Gerar pedido de compra a partir do orçamento [número]?"
3. O sistema cria um **Pedido de Compra** com os mesmos itens, fornecedor e valores do orçamento e leva você automaticamente para a tela de **Pedidos de Compra**

#### Imprimir orçamento em PDF

Disponível apenas para orçamentos **Aprovados**: abra o orçamento em **Ver** e clique em **📄 Imprimir PDF** no rodapé do modal. O PDF traz os dados do fornecedor, datas, valor total e a lista de itens, com um campo de assinatura do fornecedor.

#### Excluir um orçamento

1. Na lista, clique em **Excluir**
2. Confirme a exclusão
3. O orçamento é removido definitivamente da lista

---

### Pedidos de Compra

Tela onde ficam os pedidos formais de compra — criados manualmente ou gerados a partir de um orçamento aprovado — e de onde se acompanha o quanto já foi recebido de cada um.

#### Consultar pedidos

1. Acesse **Pedidos de Compra**
2. Use **Buscar** e o filtro **Status** para localizar um pedido:
   - **Pendente**: pedido criado, aguardando andamento
   - **Confirmado**: pedido confirmado com o fornecedor, aguardando entrega — é este status que faz o pedido aparecer na tela de **Novo Recebimento**
   - **Parcial**: parte da quantidade pedida já foi recebida
   - **Recebido**: toda a quantidade pedida já foi recebida
   - **Cancelado**: pedido cancelado

#### Criar um novo pedido

1. Clique em **+ Novo Pedido**
2. Preencha:
   - **Fornecedor**: selecione o fornecedor (obrigatório)
   - **Data de Entrega Prevista**: quando o material deve chegar (obrigatório)
   - **Forma de Pagamento**: texto livre (opcional)
   - **Frete (R$)**: valor de frete a somar ao total (opcional)
   - **Desconto (R$)**: valor de desconto a subtrair do total (opcional)
   - **Observações**: texto livre (opcional)
3. Na seção **Itens**, clique em **+ Adicionar Item** para cada material e preencha **Produto**, **Qtd** e **Preço** (todos obrigatórios); use **X** para remover uma linha
4. Clique em **Salvar**

#### Ver detalhes de um pedido

1. Na lista, clique em **Ver**
2. A tela mostra Número, Status, Fornecedor, Data do Pedido, Data Esperada, Valor Total e, quando aplicável, quem aprovou e as Observações
3. A tabela de itens traz, por linha, Produto, Quantidade pedida, **Recebido** (quanto já entrou por recebimentos anteriores), Preço Unit. e Total — é a forma mais rápida de ver o que ainda falta chegar de um pedido

#### Confirmar um pedido

1. Na lista, clique em **Confirmar** (disponível para pedidos **Pendentes**) — ou, no modal **Ver**, clique em **Confirmar Pedido**
2. Confirme a pergunta "Confirmar este pedido?"
3. O status muda para **Confirmado**

#### Cancelar um pedido

1. Na lista, clique em **Cancelar** (disponível para qualquer pedido que não esteja **Recebido** ou já **Cancelado**)
2. Confirme a pergunta "Cancelar este pedido?"
3. O status muda para **Cancelado**

#### Imprimir pedido em PDF

Disponível para pedidos **Aprovados** ou **Confirmados**: abra o pedido em **Ver** e clique em **📄 Imprimir PDF**. O PDF traz fornecedor, datas, condições de pagamento, valor total, a lista de itens (com a coluna Recebido) e um campo de assinatura do fornecedor.

---

### Recebimentos

Tela onde se consulta o histórico de recebimentos de mercadoria e a partir da qual se abre o formulário de registro de um novo recebimento.

#### Consultar recebimentos

1. Acesse **Recebimentos**
2. A lista mostra Número do recebimento, Pedido de origem, Data, o Status atual do pedido relacionado e as ações **Imprimir** e **Cancelar**

#### Imprimir comprovante de um recebimento

Clique em **Imprimir** na linha do recebimento. É gerado um PDF "Comprovante de Recebimento" com o pedido, fornecedor, data, observações e a lista de itens recebidos (quantidade, quantidade aceita e lote, quando houver), com campo de assinatura de quem recebeu.

#### Cancelar um recebimento

1. Clique em **Cancelar** na linha do recebimento
2. Confirme o aviso: "Cancelar o recebimento [número]? Esta ação estorna o estoque recebido."
3. O sistema estorna exatamente a quantidade que havia entrado em estoque por aquele recebimento e reabre a pendência correspondente no pedido de compra

**Atenção**: se o material do recebimento já foi endereçado no armazém (ver seção sobre o WMS mais abaixo) e o lote correspondente já está vencido, o cancelamento é recusado — o sistema não permite tirar do estoque, por estorno, um lote vencido. Nesse caso, use um **ajuste de estoque** para dar baixa no material, não o cancelamento do recebimento.

#### Registrar um novo recebimento

1. Na tela de Recebimentos, clique em **+ Novo Recebimento**
2. **Passo 1 — selecione o pedido**: só aparecem aqui pedidos com status **Confirmado** ou **Parcial** (pedidos ainda **Pendentes** não podem ser recebidos). Use o campo de busca para filtrar por número do pedido ou nome do fornecedor e clique no pedido desejado
3. **Passo 2 — confira os itens**: a tela mostra, para cada item do pedido, quanto foi **Pedido**, quanto **Já recebido** em recebimentos anteriores e quanto está **Pendente**
4. Para cada item que está chegando agora, preencha:
   - **Quantidade Recebida**: não pode passar do saldo Pendente do item
   - **Número do Lote** e **Validade**: aparecem apenas para produtos com controle de lote ativado no cadastro — nesse caso o **Número do Lote é obrigatório**, senão o sistema recusa o recebimento
5. Preencha os dados gerais do recebimento:
   - **Data de Recebimento**: obrigatório, já vem preenchido com a data de hoje
   - **Número da Nota Fiscal**: opcional, texto livre
   - **Observações**: opcional
6. Clique em **Registrar Recebimento**. O botão só fica habilitado quando ao menos um item tem quantidade recebida preenchida
7. Ao concluir, a tela mostra a confirmação "Recebimento [número] registrado com sucesso!", com os botões **🖨️ Imprimir Comprovante** e **Voltar para a Lista**

Se quiser trocar o pedido selecionado antes de enviar, clique em **Trocar pedido** no topo do passo 2. Se preferir desistir, use **Cancelar**, que volta para a lista sem registrar nada.

#### Importar o XML da NFe para preencher o recebimento

Em vez de digitar as quantidades item a item, é possível importar o XML da Nota Fiscal Eletrônica do fornecedor e deixar o sistema pré-preencher o recebimento:

1. No Passo 2, no campo **Importar XML de NFe (opcional)**, selecione o arquivo `.xml` da nota
2. O sistema lê a NFe e mostra um painel "NFe [número]/[série] — [fornecedor] (N itens). Associe cada item da nota a um item do pedido"
3. Para cada item da nota (código, descrição e quantidade), escolha na lista suspensa a qual item do pedido ele corresponde — cada linha mostra o produto e a quantidade ainda **pendente** naquele item do pedido
4. Ao associar, o sistema preenche sozinho a **Quantidade Recebida** do item do pedido (e o **Lote**/**Validade**, se a nota trouxer essa informação e o produto controlar lote)
5. Se a quantidade da nota for maior do que o saldo pendente daquele item, aparece o aviso laranja "Quantidade da NFe (X) excede o pendente — revise": o sistema preenche apenas até o limite pendente, e você deve conferir manualmente a diferença
6. Um mesmo item do pedido não pode ser associado a duas linhas da NFe ao mesmo tempo — o sistema bloqueia a segunda tentativa com um aviso
7. Depois da associação, revise as quantidades preenchidas normalmente e clique em **Registrar Recebimento**

Mesmo depois de importar a NFe, você pode ajustar manualmente qualquer quantidade antes de enviar — a importação só agiliza o preenchimento, quem confere e confirma é sempre o usuário.

#### Para onde vai a mercadoria depois do recebimento

O que acontece depois de **Registrar Recebimento** depende de o módulo **WMS** (armazém) estar licenciado na instalação:

- **Sem WMS licenciado**: o recebimento já dá entrada direta no estoque do produto no momento em que é registrado, e o custo médio do produto é recalculado na hora. É o comportamento de sempre — nada de endereçamento a fazer.
- **Com WMS licenciado**: o recebimento nasce com status **Conferido**, mas a mercadoria ainda **não entra no saldo de estoque** — ela está fisicamente na doca, sem endereço. O sistema gera automaticamente uma cadeia de tarefas de armazém (Descarga → Conferência → Etiquetagem → Quarentena → Alocação), que aparecem na tela de **Operações do Armazém** (módulo WMS). Só quando a tarefa de **Alocação** é concluída — ou seja, quando alguém guarda fisicamente o material numa posição do armazém — é que a entrada em estoque é registrada, com produto, quantidade, posição e lote amarrados. O recebimento passa para status **Concluído** quando todo o material dele já foi endereçado; até lá ele permanece **Conferido**.

Na prática: se sua instalação tem WMS, depois de registrar um recebimento aqui em Compras, o próximo passo acontece na tela de operações de armazém, não nesta tela.

---

## 🔢 Contagem de Inventário

O módulo de **Contagem de Inventário** organiza a conferência física do estoque e a compara com o que o sistema registra, apontando divergências para que sejam investigadas e, se necessário, ajustadas. Diferente de módulos como WMS, YMS ou Manutenção, a Contagem de Inventário **não é um módulo licenciável** — ela fica sempre disponível para qualquer usuário autenticado com permissão, independentemente de quais módulos a instalação contratou.

Para entender a tela a tela deste módulo, é essencial primeiro entender a hierarquia entre suas duas peças centrais:

- **Plano de Contagem**: define **O QUE** será contado e **COM QUE REGRAS**. Um plano descreve o tipo de inventário (completo, parcial, cíclico, cego), a frequência com que ele deve se repetir (diária, semanal, mensal...), a prioridade e a lista de produtos que fazem parte dele. O plano em si nunca é "executado" diretamente — ele é o molde.
- **Sessão de Contagem**: é **UMA EXECUÇÃO CONCRETA** desse plano, numa data específica. Quando um plano é ativado, o sistema gera sessões agendadas automaticamente (conforme a frequência definida); cada sessão tem sua própria lista de itens a contar (produto + quantidade que o sistema espera encontrar) e é nela que a contagem física de fato acontece, item por item, até virar um relatório de divergências.

Em resumo: você cria e ativa um **Plano** uma única vez; o sistema cuida de gerar as **Sessões** ao longo do tempo; e é dentro de cada **Sessão** que a equipe de estoque efetivamente conta os produtos.

### Dashboard de Contagem

É a tela inicial do módulo (também chamada de "Inventário" no menu) e reúne uma visão geral de tudo o que está acontecendo nas contagens.

**Indicadores no topo:**
- **Planos Ativos**: quantos planos de contagem estão com status Ativo no momento.
- **Sessões Ativas**: quantas sessões estão em andamento (status Em Progresso).
- **Itens Pendentes**: quantos itens, em todas as sessões, ainda não foram contados.
- **Acurácia Média**: percentual médio de acerto das sessões concluídas nos últimos 30 dias (quanto maior, menos divergência entre o contado e o que o sistema esperava).

**Planos de Inventário**: logo abaixo dos indicadores há uma tabela com os planos cadastrados, com os mesmos filtros e ações descritas na seção "Planos de Contagem" mais abaixo (a tabela e os filtros aqui são um atalho — o cadastro completo de planos fica na tela própria).

**Sessões Agendadas para Hoje**: lista as sessões com data agendada para o dia atual, mostrando o horário, o responsável (se já atribuído) e um botão **Ver Detalhes** que leva direto para a sessão.

**Divergências Recentes**: mostra os últimos itens contados (de qualquer sessão, nos últimos 30 dias) em que a quantidade contada ficou fora da tolerância esperada, com a quantidade do sistema, a quantidade contada, a diferença (em valor e percentual) e a data da contagem. É uma forma rápida de acompanhar problemas sem precisar abrir cada sessão individualmente.

#### Filtrar os planos pelo Dashboard

1. Use os campos **Status**, **Tipo**, **Frequência** e **Buscar** (por nome ou código) no topo da tabela de planos.
2. A lista é atualizada automaticamente a cada mudança de filtro, sem precisar clicar em nenhum botão.

### Planos de Contagem

Esta é a tela de cadastro completo dos planos — a "central de regras" da contagem de inventário.

#### Listar e filtrar planos

1. No menu, acesse **Inventário** e depois **Planos**.
2. Use os filtros **Status**, **Tipo**, **Frequência** e **Buscar** para localizar um plano específico.
3. A tabela mostra código, nome, tipo, frequência e status de cada plano, com as ações disponíveis na última coluna.

#### Criar um novo plano

1. Clique em **+ Novo Plano** (no Dashboard ou na lista de Planos).
2. Preencha as **Informações Básicas**:
   - **Código**: um identificador para o plano. Obrigatório para salvar o formulário, mas serve apenas de referência — ao gravar, o sistema sempre atribui o código definitivo no padrão `CONT-AAAA-NNN` (ano + sequencial), então o texto digitado aqui não é o que aparecerá depois nas listagens.
   - **Nome**: nome descritivo do plano (ex: "Inventário Mensal - Matéria-Prima"). Obrigatório.
3. Preencha as **Configurações**:
   - **Tipo**: obrigatório. Opções: **Inventário Completo** (conta todo o escopo definido), **Inventário Parcial** (um recorte específico), **Inventário Cíclico** (repetido periodicamente, geralmente por categoria ou criticidade) ou **Inventário Cego** (a contagem não mostra a quantidade do sistema para o operador, reduzindo o viés de "contar o que o sistema diz").
   - **Frequência**: obrigatório. Define de quanto em quanto tempo o sistema deve gerar uma nova sessão automaticamente a partir deste plano: Diária, Semanal, Mensal, Trimestral ou Anual.
   - **Prioridade**: obrigatório. 1 = Baixa, 5 = Média, 10 = Alta.
4. Preencha o **Agendamento**:
   - **Data de Início**: obrigatória. A partir de quando o plano passa a gerar sessões.
   - **Data de Término**: opcional. Se preenchida, o plano deixa de gerar novas sessões após essa data.
5. **Descrição**: campo livre opcional para detalhar o objetivo do plano.
6. Na seção **Produtos do Plano**, clique em **+ Adicionar Produtos** para abrir o seletor de produtos:
   - Use o campo de busca para localizar produtos por nome ou código.
   - Clique em **Selecionar** em cada produto desejado (o botão muda para "Selecionado").
   - Clique em **Confirmar** para trazer os produtos escolhidos para o plano.
   - A ordem em que os produtos aparecem na lista reflete a prioridade deles dentro da sessão gerada (os primeiros adicionados têm prioridade maior).
   - Para remover um produto já adicionado, clique em **Remover** ao lado dele.
7. Clique em **Criar Plano** para salvar. O plano é criado com status **Rascunho** — ele só passa a gerar sessões depois de ser ativado (veja abaixo).

#### Editar um plano

1. Na lista de Planos, clique em **Editar** no plano desejado.
2. Altere os campos necessários (os mesmos da criação).
3. Se o plano já estiver **Ativo**, aparece também a seção **Controle de Status**, com a opção **Pausar plano** — marque a caixa para pausar o plano (ele para de gerar novas sessões) ou desmarque para reativá-lo.
4. Clique em **Atualizar** para salvar.

#### Imprimir o plano em PDF

1. Abra um plano existente em modo de edição.
2. Se você tiver a permissão necessária, o botão **Imprimir PDF** aparece no rodapé do formulário.
3. Ao clicar, o sistema gera e baixa um PDF com os dados do plano e uma tabela com todos os produtos vinculados, já formatada com colunas em branco para "Qtd. Contada" e "Responsável" e campos de assinatura — útil como formulário físico de apoio para quem vai contar sem usar a tela de execução digital.

#### Ativar, pausar e retomar um plano

- **Ativar**: na lista de Planos (ou no Dashboard), clique em **Ativar** em um plano com status **Rascunho** ou **Pausado**. O plano passa para **Ativo** e volta a gerar sessões automaticamente conforme a frequência configurada.
- **Pausar**: clique em **Pausar** em um plano **Ativo** para interromper temporariamente a geração de novas sessões, sem perder a configuração do plano.
- **Retomar**: um plano **Pausado** mostra o botão **Retomar**, que tem o mesmo efeito de ativar novamente.

#### Excluir um plano

1. Na lista de Planos, clique em **Excluir**.
2. Confirme a exclusão na caixa de diálogo.
3. Só é possível excluir planos que **não têm nenhuma sessão vinculada** — se o plano já gerou sessões (mesmo que canceladas), a exclusão falha e é preciso pausar/cancelar o plano em vez de excluí-lo.

### Sessões de Contagem

Sessões são as execuções concretas dos planos. Na prática, você raramente cria uma sessão manualmente: elas nascem sozinhas quando um plano ativo atinge sua próxima data de execução, já com a lista de itens a contar montada a partir dos critérios do plano.

#### Listar e filtrar sessões

1. No menu, acesse **Inventário** e depois **Sessões**.
2. Cada sessão aparece como um cartão, mostrando código, nome do plano, status, data agendada, responsável, total de itens e quantos já foram contados.
3. Sessões **Em Progresso** exibem também uma barra de progresso com o percentual de itens já contados.
4. Use os filtros **Status**, **Data Início** e **Data Fim** para localizar sessões específicas.

**Status possíveis de uma sessão:**
- **Agendada**: sessão criada pelo plano, aguardando início.
- **Em Progresso**: a contagem física está em andamento.
- **Concluída**: todos os itens foram contados e a sessão foi finalizada — já tem relatório disponível.
- **Cancelada**: sessão descartada, sem contagem válida.

#### Iniciar uma sessão

1. Localize uma sessão com status **Agendada**.
2. Clique em **Iniciar** no cartão da sessão.
3. O sistema atualiza a quantidade "esperada" de cada item com o saldo mais recente do estoque (garantindo que a comparação use o saldo do momento em que a contagem realmente começa, não do momento em que a sessão foi agendada), muda o status da sessão para **Em Progresso** e leva você direto para a tela de execução da contagem.

Sessões **Em Progresso** mostram o botão **Executar**, que leva para a mesma tela de contagem a qualquer momento (útil para continuar uma contagem interrompida). Sessões **Concluídas** mostram o botão **Relatório**.

### Executar uma Contagem

Esta é a tela operacional usada por quem está fisicamente contando o estoque (chão de fábrica/armazém, geralmente em tablet ou coletor). Ela apresenta os itens da sessão um de cada vez, em sequência.

No topo, uma barra de progresso mostra quantos itens já foram contados em relação ao total da sessão.

#### Registrar a contagem de um item

1. Para cada item, a tela mostra o **código e nome do produto**, a **localização** (quando o item está associado a um endereço de armazém) e a **quantidade que o sistema espera encontrar** ali.
2. Digite a quantidade que você contou fisicamente no campo **Quantidade Contada**.
3. Se a quantidade digitada for diferente da esperada pelo sistema, um aviso de **Divergência** aparece automaticamente, mostrando a diferença em unidades e em percentual (em vermelho quando falta estoque, em amarelo quando sobra).
4. Se quiser, preencha o campo **Observações** com algum comentário sobre a contagem (ex: explicação para a divergência).
5. Clique em **Confirmar** para registrar a contagem e avançar automaticamente para o próximo item pendente.

**Atalhos disponíveis** abaixo do campo de quantidade:
- **Zero**: preenche a quantidade contada com 0 (útil quando a localização está vazia).
- **Sistema**: preenche a quantidade contada com o mesmo valor que o sistema espera (confirma que bateu, sem digitar o número manualmente).
- **Limpar**: apaga o valor digitado.

O botão **Pular** avança para o próximo item sem enviar nenhuma contagem — use com cautela: o item pulado continua **pendente** no sistema (ele não é marcado como contado), então ele precisa ser contado em algum momento antes de a sessão poder ser finalizada.

#### Finalizar a sessão

1. Quando não houver mais itens pendentes à frente na lista, a tela mostra **"Inventário Concluído!"**.
2. Clique em **Finalizar Sessão** para encerrar a contagem.
3. Se ainda restar algum item pendente (por exemplo, um item que foi pulado e não foi contado depois), o sistema recusa a finalização — nesse caso é preciso voltar e contar os itens que faltam antes de tentar novamente.
4. Ao finalizar com sucesso, a sessão passa para status **Concluída** e você é levado automaticamente para o **Relatório de Sessão**.

### Relatório de Sessão

Mostra o resultado consolidado de uma sessão já concluída, com foco nas divergências encontradas.

**Cartões de resumo:**
- **Total de Itens**: quantos itens fizeram parte da sessão.
- **Itens Contados**: quantos foram efetivamente contados.
- **Divergências**: quantos itens tiveram diferença relevante entre o contado e o esperado.
- **Acurácia**: percentual de itens que bateram com o sistema.

**Tabela de Divergências Encontradas**: lista, para cada item divergente, o produto, a localização, a quantidade do sistema, a quantidade contada, a diferença (em unidades e percentual) e o status do item (Pendente, Contado, Recontado, Aceito ou Cancelado). Se não houver nenhuma divergência, a tela mostra uma mensagem de parabéns no lugar da tabela.

#### Ajustar o estoque a partir das divergências

1. Quando a sessão tem divergências, o botão **Ajustar Estoque** aparece no topo da tela.
2. Ao clicar, confirme a ação na caixa de diálogo.
3. O sistema gera movimentações de ajuste de estoque (entrada para sobra, saída para quebra) para cada item divergente já revisado, alinhando o saldo do sistema ao que foi fisicamente contado.

#### Exportar o relatório

O botão **Exportar** está reservado para uma funcionalidade futura — por enquanto ele apenas avisa que a exportação será implementada em breve.

---

## 🔧 Manutenção

O módulo **Manutenção** organiza o cuidado com os equipamentos da fábrica: o cadastro dos ativos, os planos de manutenção preventiva que geram ordens automaticamente, as ordens de manutenção (preventivas e corretivas) que a equipe de manutenção executa, e um dashboard com os principais indicadores de confiabilidade.

**Importante**: este módulo é licenciável por instalação. Se as telas de Manutenção não aparecerem no menu ou o sistema retornar erro de módulo não disponível, é porque o módulo **MANUTENCAO** não está habilitado na sua instalação — fale com o administrador do sistema.

### **Como as telas se relacionam**

```
Equipamento (ativo cadastrado)
   │
   ├─ Plano de Manutenção (preventiva, recorrente)
   │     └─ gera automaticamente ──► Ordem de Manutenção (tipo Preventiva)
   │
   └─ Ordem de Manutenção (tipo Corretiva) ──► aberta manualmente, sem plano
```

- Todo **Equipamento** pode ter um ou mais **Planos de Manutenção** vinculados a ele.
- Um Plano de Manutenção define de quantos em quantos dias a manutenção preventiva deve ocorrer. O sistema verifica os planos diariamente (às 6h) e, quando a data de vencimento chega, **gera automaticamente uma Ordem de Manutenção do tipo Preventiva** para aquele equipamento — você não precisa criar essa ordem manualmente.
- Se já existe uma ordem preventiva pendente ou em execução para um plano, o sistema não gera uma nova ordem duplicada até a anterior ser concluída ou cancelada.
- Uma **Ordem de Manutenção do tipo Corretiva** não vem de nenhum plano: ela é aberta manualmente por qualquer pessoa que identifique um problema em um equipamento (quebra, defeito, mau funcionamento).
- O **Dashboard de Indicadores (KPIs)** consolida os dados de todas as ordens para mostrar o quão bem a manutenção está indo (tempo de reparo, cumprimento dos planos preventivos, frequência de falhas por equipamento).

---

### Equipamentos

A tela de **Equipamentos** é o cadastro dos ativos da fábrica que recebem manutenção (máquinas, ferramentas, veículos, instalações etc.), cada um vinculado a um Centro de Trabalho.

#### **Consultar equipamentos**

1. Acesse **Equipamentos** no menu do módulo.
2. A lista mostra código, nome, Centro de Trabalho, fabricante/modelo e status (Ativo/Inativo) de cada equipamento.
3. Use os filtros no topo da tela para refinar a busca:
   - **Buscar**: filtra por código ou nome do equipamento.
   - **Centro de Trabalho**: mostra apenas os equipamentos daquele centro.
   - **Status**: Todos, Ativos ou Inativos.

#### **Cadastrar um equipamento**

1. Clique em **+ Novo Equipamento**.
2. Preencha os campos:
   - **Código** (obrigatório): identificador único do equipamento.
   - **Nome** (obrigatório): nome descritivo do equipamento.
   - **Centro de Trabalho** (obrigatório): a que centro de trabalho o equipamento pertence.
   - **Fabricante** (opcional): nome do fabricante.
   - **Modelo** (opcional): modelo do equipamento.
   - **Ativo**: marque para indicar que o equipamento está em uso; ao criar, já vem marcado por padrão.
3. Clique em **Criar**.

#### **Editar um equipamento**

1. Na lista, clique em **Editar** na linha do equipamento desejado.
2. Altere os campos necessários.
3. Clique em **Salvar**.

#### **Ativar ou desativar um equipamento**

1. Na lista, clique em **Desativar** (ou **Ativar**, se já estiver inativo) na linha do equipamento.
2. Confirme a ação na caixa de confirmação.
3. Equipamentos inativos continuam no histórico, mas não devem receber novos planos ou ordens.

#### **Excluir um equipamento**

1. Na lista, clique em **Excluir**.
2. Confirme a ação.

**Atenção**: cadastrar, editar, desativar e excluir equipamentos exige permissão de gerenciamento do módulo. Um usuário com permissão apenas de visualização consegue ver a lista, mas não verá as opções de alteração.

---

### Planos de Manutenção

A tela de **Planos de Manutenção** cadastra as recorrências de manutenção preventiva de cada equipamento. É a partir daqui que o sistema passa a gerar Ordens de Manutenção automaticamente.

#### **Consultar planos**

1. Acesse **Planos de Manutenção** no menu do módulo.
2. A lista mostra o equipamento vinculado, o nome do plano, a frequência ("a cada N dia(s)"), a data da próxima execução e o status (Ativo/Inativo).
3. Use os filtros de **Equipamento** e **Status** para refinar a busca.

#### **Criar um plano preventivo**

1. Clique em **+ Novo Plano**.
2. Preencha os campos:
   - **Equipamento** (obrigatório): o equipamento que será mantido por este plano.
   - **Nome** (obrigatório): nome do plano (ex.: "Troca de óleo", "Inspeção elétrica trimestral").
   - **Descrição** (opcional): detalhes do que deve ser feito na manutenção.
   - **Frequência (dias)** (obrigatório): de quantos em quantos dias a manutenção preventiva deve se repetir.
   - **Ativo**: marque para o plano gerar ordens automaticamente; ao criar, já vem marcado por padrão.
3. Clique em **Criar**.

**Como funciona a data da próxima execução**: ao criar o plano, o sistema calcula automaticamente a primeira data de vencimento somando a **Frequência (dias)** à data de hoje. A cada vez que uma ordem preventiva é gerada a partir do plano, o sistema soma novamente a frequência à data de vencimento anterior — ou seja, o calendário é fixo a partir da data original do plano, não conta a partir do dia em que a ordem foi de fato concluída.

#### **Editar um plano**

1. Na lista, clique em **Editar** na linha do plano.
2. Altere os campos necessários (inclusive a frequência).
3. Clique em **Salvar**.

#### **Ativar ou desativar um plano**

1. Na lista, clique em **Desativar** (ou **Ativar**) na linha do plano.
2. Confirme a ação.
3. Planos inativos não geram novas ordens preventivas automaticamente, mas continuam cadastrados.

#### **Excluir um plano**

1. Na lista, clique em **Excluir** na linha do plano.
2. Confirme a ação.

**Atenção**: um plano que já tem Ordens de Manutenção vinculadas ao seu histórico não pode ser excluído — o sistema bloqueia a exclusão para não perder a rastreabilidade das ordens preventivas já geradas. Nesse caso, desative o plano em vez de excluí-lo.

**Atenção**: criar, editar, ativar/desativar e excluir planos exige permissão de gerenciamento do módulo.

---

### Ordens de Manutenção

A tela de **Ordens de Manutenção** é onde a equipe de manutenção acompanha e executa o trabalho — tanto as ordens preventivas geradas automaticamente pelos planos quanto as corretivas abertas manualmente quando algo quebra ou apresenta defeito.

#### **Consultar ordens**

1. Acesse **Ordens de Manutenção** no menu do módulo.
2. A lista mostra o equipamento, o tipo (Preventiva ou Corretiva), a descrição do problema (ou o nome do plano, no caso das preventivas), o responsável e o status.
3. Use os filtros de **Equipamento**, **Tipo** e **Status** para refinar a busca.

#### **Status de uma ordem**

- **Pendente**: ordem aberta (manualmente ou pelo plano), aguardando início da execução.
- **Em execução**: alguém já começou a trabalhar na ordem.
- **Concluída**: o serviço foi realizado e a ordem foi fechada.
- **Cancelada**: a ordem foi cancelada e não será executada.

#### **Abrir uma ordem corretiva**

Use este fluxo sempre que identificar um problema em um equipamento que não está relacionado a um plano preventivo agendado.

1. Clique em **+ Nova Ordem Corretiva**.
2. Preencha os campos:
   - **Equipamento** (obrigatório): o equipamento com o problema.
   - **Descrição do problema** (obrigatório): explique o que está acontecendo.
   - **Responsável** (opcional): a pessoa que vai executar o reparo; pode ficar sem responsável definido e ser atribuída depois.
3. Clique em **Abrir Ordem**.
4. A ordem é criada com status **Pendente** e tipo **Corretiva**.

**Nota**: ordens preventivas não são criadas por este formulário — elas aparecem sozinhas na lista quando o plano de manutenção correspondente vence (veja a seção "Planos de Manutenção" acima). O botão de criação nesta tela serve apenas para ordens corretivas.

#### **Iniciar uma ordem**

1. Na lista, em uma ordem com status **Pendente**, clique em **Iniciar**.
2. Confirme a ação.
3. O status muda para **Em execução** e a data/hora de início é registrada.

#### **Executar/fechar uma ordem**

1. Na lista, em uma ordem com status **Em execução**, clique em **Concluir**.
2. No formulário que abre, preencha:
   - **Solução aplicada** (obrigatório): descreva o que foi feito para resolver o problema ou executar a manutenção.
3. Clique em **Concluir**.
4. O status muda para **Concluída** e a data/hora de conclusão é registrada — é esse intervalo entre o início e a conclusão que alimenta o indicador de MTTR no dashboard.

#### **Reatribuir o responsável**

1. Na lista, em uma ordem **Pendente** ou **Em execução**, clique em **Reatribuir**.
2. Selecione o novo responsável (ou deixe "Sem responsável definido").
3. Clique em **Reatribuir**.

#### **Cancelar uma ordem**

1. Na lista, em uma ordem **Pendente** ou **Em execução**, clique em **Cancelar**.
2. Confirme a ação.
3. O status muda para **Cancelada**. Uma ordem cancelada não conta como manutenção realizada nos indicadores.

**Atenção**: abrir, iniciar e concluir ordens exige permissão de execução do módulo. Reatribuir responsável e cancelar exigem permissão de gerenciamento — por isso um usuário do tipo Operador normalmente consegue abrir, iniciar e concluir ordens, mas não reatribuir ou cancelar.

**Nota**: se o seu usuário não tiver permissão para visualizar a lista de usuários, o campo de seleção de responsável (ao abrir uma ordem corretiva ou reatribuir) aparece vazio — a lista de ordens continua funcionando normalmente, você só não consegue escolher um responsável específico nesse caso.

---

### Indicadores (KPIs)

O **Dashboard de KPIs de Manutenção** reúne os principais indicadores de confiabilidade e desempenho da manutenção, calculados a partir do histórico de ordens.

#### **Consultar o dashboard**

1. Acesse **Indicadores (KPIs)** no menu do módulo.
2. Escolha o período de análise no seletor: **30 dias**, **90 dias** (padrão) ou **180 dias**.
3. Clique em **Atualizar** para recarregar os dados com o período selecionado.

#### **O que cada indicador mostra**

- **MTTR (tempo médio de reparo)**: é o tempo médio, em horas, que a equipe leva entre **iniciar** e **concluir** uma ordem de manutenção (preventiva ou corretiva) dentro do período selecionado. É calculado pela média de "data/hora de conclusão menos data/hora de início" de todas as ordens concluídas no período. Quanto menor o MTTR, mais rápido os problemas estão sendo resolvidos. Se não houver nenhuma ordem concluída no período, o indicador aparece em branco ("-").
- **Cumprimento do preventivo**: percentual dos planos de manutenção ativos cuja próxima data de execução ainda está no futuro (ou seja, não estão vencidos no momento). Um número alto indica que os planos preventivos estão em dia; um número baixo indica planos vencidos aguardando geração ou execução de ordem. Quando não há nenhum plano ativo cadastrado, o indicador mostra 100%.
- **Ordens abertas (pendente + em execução)**: quantas ordens de manutenção estão, neste exato momento, com status Pendente ou Em execução — é uma fotografia do trabalho em aberto agora, não é limitada pelo período selecionado.
- **Ordens por status e tipo**: gráfico de barras empilhadas mostrando quantas ordens existem hoje em cada status (Pendente, Em execução, Concluída, Cancelada), separadas por tipo (Preventiva/Corretiva). Assim como o card de ordens abertas, este gráfico reflete o estado atual das ordens, não é filtrado pelo período selecionado.
- **MTBF por equipamento (horas entre falhas)**: para cada equipamento, é o tempo médio, em horas, entre uma ordem corretiva e a próxima, dentro do período selecionado — ou seja, mede a frequência de quebras/defeitos daquele equipamento. Quanto maior o MTBF, mais tempo o equipamento passa funcionando sem apresentar problemas. Um equipamento precisa ter pelo menos duas ordens corretivas no período para que o MTBF seja calculado; equipamentos com menos de duas ocorrências aparecem como "Dado insuficiente" (não significa que o equipamento não teve nenhuma falha, apenas que não há dados suficientes no período para calcular uma média confiável). A tabela mostra até os 20 equipamentos com pior MTBF (menor tempo entre falhas) primeiro.

**Dica**: use o MTTR para acompanhar a agilidade da equipe de manutenção, o Cumprimento do preventivo para saber se a manutenção preventiva está em dia, e o MTBF por equipamento para identificar quais ativos estão quebrando com mais frequência e podem precisar de atenção especial (troca, revisão mais profunda, ou um plano preventivo mais frequente).

---

## 🚚 YMS — Gestão de Pátio

O **YMS (Yard Management System)** controla a jornada completa de um veículo dentro da planta: desde o agendamento da visita, passando pela chegada na portaria (check-in), pela espera no pátio, até a operação na doca (carga ou descarga) e a liberação final (checkout). Todo esse ciclo fica registrado numa única "visita", que muda de status conforme avança.

Este módulo precisa estar licenciado na instalação (`YMS`) para as telas abaixo funcionarem — se o administrador não licenciou o YMS, essas telas não aparecem no menu e as rotas correspondentes retornam "não encontrado".

O ciclo de vida de uma visita passa pelos seguintes status, nesta ordem:

1. **Agendado** — visita criada, veículo ainda não chegou.
2. **Check-in feito** — veículo chegou na portaria.
3. **No pátio** — veículo alocado numa vaga de espera (só em armazéns que usam pátio).
4. **Na doca** — veículo na doca, carregando ou descarregando.
5. **Concluída** — checkout feito, veículo liberado.

Uma visita também pode ser **Cancelada** a qualquer momento antes de ser concluída.

### Docas

Cadastro das docas de carga e descarga da planta.

- **Código**: identificador da doca (ex: `DOCA-01`), único dentro do armazém.
- **Tipo de Serviço**: `Recebimento`, `Expedição` ou `Multiuso`. Determina quais visitas podem ser direcionadas pra essa doca — uma visita de Recebimento só pode ir para uma doca de Recebimento ou Multiuso (o mesmo vale para Expedição).
- **Posição de Armazenagem** (opcional): vincula a doca a um endereço físico já cadastrado no WMS (só faz sentido se o WMS também estiver licenciado). Não é obrigatório.
- **Ativa**: docas inativas não aparecem como opção para movimentar uma visita.

#### Cadastrar uma nova doca

1. Na tela **Docas**, clique em **+ Nova Doca**.
2. Preencha código, tipo de serviço e, se aplicável, a posição de armazenagem.
3. Clique em **Criar**.

Uma doca com uma visita atualmente estacionada nela (status "Na doca") não pode ser excluída — o sistema recusa a exclusão para não perder o histórico nem deixar a visita "órfã".

### Motoristas

Cadastro de motoristas vinculados a um fornecedor/transportadora já cadastrado.

- **Nome**, **CPF** (único no sistema).
- **Fornecedor**: transportadora à qual o motorista pertence — obrigatório, o motorista sempre representa uma empresa.
- **Bloqueado**: motoristas bloqueados não conseguem ser selecionados num novo check-in ou agendamento (útil para suspender temporariamente alguém sem apagar o cadastro).

### Frotas

Uma frota agrupa um subconjunto de veículos de um mesmo fornecedor (por exemplo, "Frota Refrigerados" de uma transportadora). Bloquear uma frota bloqueia automaticamente todos os veículos vinculados a ela.

- **Nome da frota**, **Fornecedor** (dono da frota).
- **Bloqueada**: ao marcar uma frota como bloqueada, todos os veículos dela ficam indisponíveis para novas visitas, mesmo que o veículo individualmente não esteja marcado como bloqueado.

### Veículos

Cadastro de veículos vinculados a um fornecedor e, opcionalmente, a uma frota.

- **Placa** (única), **Tipo** (ex: caminhão, carreta), **Modelo** (opcional, texto livre).
- **Fornecedor**: obrigatório.
- **Frota** (opcional): se o veículo pertencer a uma frota, vincule aqui — um veículo de frota bloqueada fica indisponível mesmo que o próprio veículo não esteja bloqueado individualmente.
- **Bloqueado**: mesmo efeito do bloqueio de motorista, mas para o veículo.

### Parâmetros de Pátio

Configuração por armazém de como o pátio funciona naquela planta especificamente — cada armazém pode operar de um jeito diferente.

- **Usa Pátio**: se marcado, uma visita precisa passar pelo status "No pátio" (aguardando numa vaga) antes de ir para a doca. Se desmarcado, o veículo vai direto do check-in para a doca, sem passar por nenhuma vaga de pátio.
- **Tolerância de Atraso (minutos)**: quantos minutos de diferença entre o horário agendado e o horário real de chegada ainda contam como "No horário". Passado esse limite, a visita é marcada como "Atrasado" (se chegou depois) ou "Antecipado" (se chegou muito antes) — esse cálculo é automático, nunca precisa ser preenchido manualmente.

Acesse esta tela pelo link **Parâmetros de Pátio** no topo da tela de Docas.

### Agendamento e Check-in

Esta é a tela principal do dia a dia do YMS — é aqui que agendamentos são criados, check-ins são feitos, e o restante do ciclo da visita (alocar vaga, mover pra doca, carga/descarga, checkout) é executado, tudo na mesma listagem.

#### Agendar uma visita com antecedência

1. Clique em **+ Novo Agendamento**.
2. Preencha: Armazém, Tipo de Serviço (Recebimento, Expedição ou Multiuso), Data/Hora Agendada.
3. Se for Recebimento, você pode vincular a um **Pedido de Compra** já existente — nesse caso o Fornecedor é preenchido automaticamente a partir do pedido. Se preferir preencher manualmente (ou se for Expedição, que não tem integração automática com pedido), escolha o Fornecedor diretamente.
4. Opcionalmente, informe Motorista, Veículo e uma Observação (até 70 caracteres).
5. Clique em **Criar**. A visita nasce com status "Agendado".

Um agendamento só pode ser editado ou excluído enquanto ainda estiver com status "Agendado" — depois do check-in, a visita vira histórico e só pode ser cancelada (nunca apagada).

#### Fazer check-in de um veículo já agendado

1. Na lista, localize a visita agendada e clique em **Fazer Check-in**.
2. Informe Motorista e Veículo (se ainda não tinham sido preenchidos no agendamento).
3. Confirme. A visita passa para "Check-in feito".

#### Check-in Direto (walk-in, sem agendamento prévio)

Para um veículo que chega sem agendamento prévio:

1. Clique em **Check-in Direto**.
2. Preencha os mesmos campos do agendamento (Armazém, Tipo de Serviço, Fornecedor/Pedido de Compra, Motorista, Veículo) — a visita nasce e já entra com status "Check-in feito" numa única etapa, sem passar por "Agendado".

#### Alocar uma vaga de pátio

Só aparece para visitas em armazéns com **Usa Pátio** ativado. Depois do check-in:

1. Clique em **Alocar Vaga**.
2. Escolha uma vaga livre entre as sugeridas (só aparecem vagas do mesmo armazém, ativas, não bloqueadas e livres).
3. Confirme. A visita passa para "No pátio" e a vaga fica ocupada por ela até a visita sair dali (mover pra doca ou ser cancelada).

#### Mover para a doca

Disponível para visitas "No pátio" (armazéns com pátio) ou direto após o check-in (armazéns sem pátio, onde "Mover para Doca" já aparece no lugar de "Alocar Vaga").

1. Clique em **Mover para Doca**.
2. Escolha uma doca livre (o sistema já filtra pelo tipo de serviço compatível com a visita, mas não filtra por ocupação — se a doca escolhida já estiver ocupada por outra visita, o sistema recusa e explica o motivo).
3. Confirme. A visita passa para "Na doca", e se ela estava numa vaga de pátio, a vaga é liberada automaticamente.

#### Carga/Descarga e Checkout

Com a visita "Na doca":

1. Clique em **Iniciar Carga/Descarga** quando o processo físico começar.
2. Clique em **Concluir Carga/Descarga** quando terminar.
3. Clique em **Finalizar e Liberar** para fazer o checkout — isso está disponível a qualquer momento com a visita na doca, mesmo que você não tenha marcado início/fim de carga formalmente (o sistema não obriga essa sequência). Ao confirmar, a visita vira "Concluída", a doca é liberada, e o "Tempo Total da Operação" (do check-in até o checkout) fica registrado na visita.

#### Cancelar uma visita

O botão **Cancelar** aparece em qualquer visita que ainda não tenha sido concluída. Uma visita "Concluída" não pode mais ser cancelada — é um estado final.

#### Pontualidade

Cada visita mostra um selo de pontualidade: **No horário**, **Antecipado** ou **Atrasado** — calculado automaticamente comparando o horário agendado com o horário real de chegada (check-in) ou de conclusão (para visitas já finalizadas), usando a tolerância configurada nos Parâmetros de Pátio daquele armazém.

### Áreas e Vagas

Cadastro do espaço físico do pátio — onde os veículos esperam antes de ir para a doca.

#### Áreas

Uma área é um setor do pátio (ex: "Setor A"). Cada área pertence a um armazém.

- **Código**, **Nome**, **Ativa**, **Bloqueada** (com motivo do bloqueio, opcional).
- Bloquear uma área impede que qualquer vaga dela seja usada para alocação, mesmo que a vaga em si não esteja bloqueada individualmente.

#### Vagas

Dentro de cada área, clique em **Ver Vagas** para gerenciar as vagas de estacionamento daquela área.

- Vagas têm um **código** (gerado automaticamente em sequência, ex: `SETOR-A-01`, `SETOR-A-02`...) e podem ser **ativas/inativas** ou **bloqueadas/desbloqueadas** individualmente (com motivo).
- Não existe cadastro de "quantidade de vagas" como número — a capacidade do pátio é sempre a contagem real de vagas cadastradas, ativas e não bloqueadas.

#### Gerar vagas em lote

Em vez de cadastrar vaga por vaga, use a geração em lote:

1. Na tela de Vagas de uma área, clique em **Gerar Vagas em Lote**.
2. Informe a quantidade desejada (entre 1 e 500).
3. Confirme. O sistema cria as vagas numeradas sequencialmente, continuando a partir do maior número já existente naquela área (mesmo que vagas do meio da sequência tenham sido excluídas).

Uma vaga com um veículo atualmente alocado nela (status "No pátio") não pode ser excluída, pelo mesmo motivo das docas.

### Dashboard do Pátio

Painel consolidado com a situação do pátio em tempo real ou por período — acessível pelo card **Dashboard** na aba de Pátio.

1. Escolha o **Armazém** no topo (obrigatório — os números de ocupação dependem de qual armazém está sendo consultado).
2. Escolha o **Período**: "Tempo real" mostra só as visitas atualmente em andamento (check-in feito, no pátio ou na doca); "Últimos 7/30/90 dias" muda para o modo histórico, que também traz visitas já concluídas ou canceladas dentro daquela janela.

O painel mostra:

- **3 cards de totais**: quantos veículos estão na Portaria, no Pátio e na Doca agora.
- **Ocupação % de Pátio e de Doca**: quantas vagas/docas estão ocupadas em relação ao total cadastrado. Se o armazém não tem nenhuma vaga ou doca cadastrada, o indicador mostra "Sem vagas/docas cadastradas" em vez de 0% (para não confundir "não tem dado" com "ocupação zero"). A Portaria não tem indicador de ocupação — não faz sentido, não existe limite de vagas na portaria.
- **Grade detalhada**: uma linha por visita, com placa, motorista, modelo do veículo, tipo de serviço, fornecedor, origem (se veio de um Pedido de Compra ou foi lançamento manual), local atual, pontualidade, quem foi o responsável pela última ação registrada na visita, e o tempo total da operação (só preenchido para visitas já concluídas).

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
- **Documentação Técnica**: `docs/DOCUMENTACAO_TECNICA.md` (arquitetura, API, modelos — para a equipe técnica)
- **Índice completo da documentação**: `docs/INDEX.md`

---

**Guia do Usuário - Sistema Fabric** ✅

*Última atualização: 13 de setembro de 2026*
