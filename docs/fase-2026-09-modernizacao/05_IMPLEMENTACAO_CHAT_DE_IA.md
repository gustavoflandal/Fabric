Implementação de um chat de ia

DOCUMENTO DE ESPECIFICAÇÃO TÉCNICA  Assistente Virtual de Operações e Estoque (Chat IA)STATUS: Especificação Técnica Rígida para Implementação1. Visão Geral e Objetivo do ProjetoImplementar um assistente virtual local de inteligência artificial integrado diretamente à aplicação de gestão de estoque. O assistente atuará como um copiloto para os operadores, fornecendo respostas precisas sobre:Procedimentos Operacionais: Regras e manuais obtidos via busca semântica em documentos PDF locais.Consultas de Estoque: Dados analíticos e transacionais obtidos diretamente do banco de dados relacional.Uso do Sistema: Dúvidas sobre funcionalidades e fluxos do software.Premissa Crítica: A solução deve operar 100% offline e local, sem envio de dados para APIs externas, mantendo isolamento absoluto dentro do ambiente de contêineres e restrição estrita ao escopo do sistema.2. Arquitetura de Infraestrutura e ContêineresA infraestrutura será orquestrada via Docker Compose, isolando os serviços de IA dos ambientes de produção principais.A. Serviços e TecnologiasLLM Engine: Ollama (rodando o modelo qwen2.5:7b ou qwen2.5:3b para ambientes com menor VRAM).Embedding Engine: Model nomic-embed-text gerenciado via Ollama para vetorização.Vector Database: ChromaDB ou extensão pgvector no PostgreSQL local (armazenamento de embeddings dos PDFs).Backend: Node.js com TypeScript (API REST / Server-Sent Events).Frontend: Vue 3 (Composition API com script setup).B. Arquitetura do docker-compose.ymlYAMLversion: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    container_name: estoque_ollama
    volumes:
      - ollama_storage:/root/.ollama
    ports:
      - "11434:11434"
    restart: unless-stopped
    # Habilitar suporte a GPU se disponível na máquina host
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]

  vector_db:
    image: chromadb/chroma:latest
    container_name: estoque_chromadb
    ports:
      - "8000:8000"
    volumes:
      - chroma_storage:/chroma/chroma
    restart: unless-stopped

volumes:
  ollama_storage:
  chroma_storage:
3. Especificação do Backend (TypeScript)3.1. Ingestão de Documentos (RAG em PDFs)Diretório Origem: Os manuais e PDFs operacionais serão depositados na pasta /docs/operacao.Processo de Indexação:Leitura e extração do texto dos PDFs via PDFLoader.Divisão em blocos (chunking) usando RecursiveCharacterTextSplitter:chunkSize: 500 caracteres.chunkOverlap: 50 caracteres.Geração de vetores com nomic-embed-text e persistência no banco vetorial.3.2. Acesso ao Banco de Dados (Consultas de Estoque)Regra de Segurança Estrita: O modelo NUNCA executará INSERT, UPDATE, DELETE ou DROP.Catálogo de Consultas Mapeadas (Parametrizado):Para evitar falhas de interpretação de schemas ou vazamento de Queries (SQL Injection por IA), a IA não gera SQL dinâmico direto. Em vez disso, o backend expõe funções parametrizadas (Tools) registradas para a IA acionar:getSaldoProduto(codigoProduto: string, localizacao?: string)getMovimentacoesRecentes(codigoProduto: string, limite: number)getPosicaoEstoquePorCategoria(categoriaId: number)Acesso Read-Only: A conexão do banco utilizada pela IA deve ser vinculada a um usuário do banco de dados com permissão estrita de SELECT nas visões/tabelas de estoque.3.3. System Prompt & Guardrails (Isolamento de Escopo)O prompt do sistema deve ser prefixado em todas as chamadas ao Ollama para garantir recusa de assuntos genéricos:PlaintextVocê é o Assistente Virtual Oficial do Sistema de Estoque. Sua única função é responder dúvidas operacionais dos operadores, orientar sobre procedimentos internos e informar saldos de produtos.

REGRAS OBRIGATÓRIAS E INEGOCIÁVEIS:
1. Fonte da Verdade: Baseie suas respostas EXCLUSIVAMENTE nos contextos dos manuais internos fornecidos ou no retorno das funções de consulta do banco de dados.
2. Negação de Escopo: Se o usuário fizer perguntas fora do domínio do sistema de estoque (exemplo: assuntos gerais, programação, notícias, culinária, piadas), responda rigorosamente:
   "Desculpe, sou um assistente focado exclusivamente nas operações deste sistema de estoque."
3. Tolerância Zero a Alucinações: Nunca invente ou estimar saldos, códigos de produto ou procedimentos. Se a informação não constar no contexto retornado, declare: "Não encontrei essa informação nos manuais ou registros do sistema."
4. Idioma: Responda sempre em Português do Brasil de forma concisa, objetiva e profissional.
3.4. Rota de Streaming (Server-Sent Events / SSE)Endpoint: POST /api/v1/chat/streamBody da Requisição: { "message": "Qual o procedimento para devolução de mercadoria?" }Response Header: Content-Type: text/event-stream, Cache-Control: no-cacheFluxo Interno:Busca no ChromaDB os 3 trechos mais semelhantes à pergunta.Verifica se a pergunta exige consulta a dados transacionais (chama a Tool correspondente).Monta o contexto final e envia a requisição via Ollama SDK em modo stream: true.Transmite a resposta via chunk SSE ao cliente.4. Especificação do Frontend (Vue 3 - Composition API)Requisitos da Interface (ChatAssistant.vue)Componente de chat em janela flutuante ou painel lateral integrado ao layout do sistema.Consumo em Streaming: Processamento do leitor de fluxo (ReadableStreamDefaultReader) para exibir a resposta palavra por palavra (typing effect natural).Tratamento de Estado:Indicador visual de "Pensando..." / "Consultando manuais...".Desativação do botão de envio enquanto uma resposta estiver sendo gerada.Rolagem automática para o final da conversa (scroll down) à medida que o texto chega.5. Critérios de Aceite e Testes (Definition of Done)ItemCritério de AceiteValidaçãoIsolamentoA aplicação recusa perguntas fora de contexto ("Como fazer bolo?", "Quem venceu o jogo?").Teste de Prompt InjectionPrecisão RAGPerguntas sobre manuais retornam respostas condizentes com os PDFs em /docs/operacao.Matriz de testes de leitura de PDFSegurança SQLNenhuma alteração no banco é possível via chat; consultas usam perfil Read-Only.Auditoria de comandos e permissõesPerformanceO primeiro token da resposta inicia em menos de 3 segundos no hardware local.Benchmark de latência via cURL/OllamaInterfaceAs respostas são renderizadas em tempo real via streaming sem travamento da UI no Vue 3.Teste de estresse visual e consumo de SSE6. Plano de Execução em FasesFase 1 (Infraestrutura & Teste do Modelo): Subir Docker Compose (Ollama + ChromaDB), baixar modelo qwen2.5 e validar tempo de resposta local via CLI.Fase 2 (Backend Core & Ingestão): Implementar script de parsing de PDFs, conexão ao ChromaDB e endpoint SSE em TypeScript.Fase 3 (Integração com Banco de Dados): Configurar usuário Read-Only e mapeamento de Tools para consulta de estoque.Fase 4 (Frontend Vue 3): Construir a interface do chat e integrar ao consumo do stream de dados.Fase 5 (Ajuste Fine-Tuning de Prompt & Homologação): Aplicar a bateria de testes de acurácia, validação dos guardrails e homologação com operadores.