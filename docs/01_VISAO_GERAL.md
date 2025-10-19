# 🏭 Fabric - Sistema PCP - Visão Geral

## 📋 Introdução

**Fabric** é um sistema completo de Planejamento e Controle da Produção (PCP) desenvolvido com a mesma arquitetura e tecnologias do VagaLume, adaptado para o contexto industrial brasileiro.

## 🎯 Objetivo

Fornecer uma solução integrada para gestão da produção industrial, desde o planejamento de materiais (MRP) até o controle de execução no chão de fábrica, com rastreabilidade completa e indicadores de performance em tempo real.

## ✨ Características Principais

- 🏭 **Gestão Completa de Produção** - Do planejamento à execução
- 📊 **MRP Integrado** - Cálculo automático de necessidades de materiais
- 🔄 **Controle em Tempo Real** - Apontamento de produção e rastreabilidade
- 📦 **Gestão de Estoque** - Controle de matérias-primas e produtos acabados
- 🛠️ **Manutenção de Ativos** - Preventiva e corretiva
- 📈 **Indicadores de Performance** - KPIs industriais e relatórios gerenciais
- 🔒 **Segurança Avançada** - Controle de acesso por perfis e auditoria completa
- 📱 **Interface Responsiva** - Acesso via desktop, tablet e mobile

## 🏗 Arquitetura

### **Stack Tecnológica**

Mesma tecnologia do VagaLume para garantir consistência e manutenibilidade:

**Backend:**
- Node.js 20+
- TypeScript 5.2.2
- Express 4.18.2
- Prisma ORM 5.22.0
- MySQL 8.0.35
- JWT Authentication

**Frontend:**
- Vue 3.4.21 (Composition API)
- Vite 5.4.20
- TypeScript 5.2.2
- Pinia 2.1.7 (State Management)
- TailwindCSS 3.4.1
- Chart.js (Gráficos)

**DevOps:**
- Docker + Docker Compose
- Git + GitHub
- ESLint + Prettier

### **Arquitetura em Camadas**

```
┌─────────────────────────────────────────────┐
│           Frontend (Vue 3 + TS)             │
│  Views → Stores (Pinia) → Services → API   │
└─────────────────────────────────────────────┘
                    ↓ REST API
┌─────────────────────────────────────────────┐
│          Backend (Express + TS)             │
│  Routes → Controllers → Services → Prisma  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│            MySQL Database                   │
└─────────────────────────────────────────────┘
```

### **Padrões de Projeto**

- **Repository Pattern**: Abstração de acesso a dados via Prisma
- **Service Layer**: Lógica de negócio isolada dos controllers
- **DTO Pattern**: Validação e transformação de dados com Joi
- **Middleware Chain**: Autenticação JWT, validação e tratamento de erros
- **Event-Driven**: Notificações e webhooks para eventos do sistema

## 📦 Módulos do Sistema

### **Fase 1: Infraestrutura e Base**
1. **Gestão de Usuários e Permissões** - Controle de acesso e auditoria
2. **Cadastros Básicos** - Master data (centros de trabalho, fornecedores, etc.)

### **Fase 2: Engenharia e Planejamento**
3. **Engenharia de Produtos** - BOM e roteiros de fabricação
4. **MRP** - Planejamento de necessidades de materiais

### **Fase 3: Execução e Controle**
5. **Gestão de Estoque** - Controle de materiais e rastreabilidade
6. **PCP** - Ordens de produção e apontamentos
7. **Gestão de Compras** - Pedidos e recebimentos

### **Fase 4: Apoio e Qualidade**
8. **Manutenção de Ativos** - Preventiva e corretiva
9. **Qualidade** - Inspeções e não-conformidades
10. **Indicadores e Relatórios** - KPIs e dashboards

## 🎯 Diferenciais

### **Compatibilidade com VagaLume**
- Mesma base tecnológica e arquitetural
- Reutilização de componentes e padrões
- Facilidade de manutenção e evolução
- Equipe única pode trabalhar em ambos os sistemas

### **Foco na Indústria Brasileira**
- Interface 100% em português
- Adequação às práticas industriais nacionais
- Suporte a múltiplas unidades de medida
- Rastreabilidade conforme legislação

### **Escalabilidade**
- Arquitetura modular
- Suporte a múltiplas plantas
- Performance otimizada para grandes volumes
- API RESTful para integrações

## 📊 Indicadores Principais (KPIs)

### **Produção**
- OEE (Overall Equipment Effectiveness)
- Eficiência de produção
- Taxa de refugo
- Lead time de produção

### **Estoque**
- Acurácia de estoque
- Giro de estoque
- Ruptura de estoque
- Cobertura de estoque

### **Manutenção**
- MTBF (Mean Time Between Failures)
- MTTR (Mean Time To Repair)
- Disponibilidade de equipamentos
- Custo de manutenção

### **Qualidade**
- Taxa de não-conformidade
- PPM (Partes Por Milhão)
- First Pass Yield
- Custo da qualidade

## 🚀 Próximos Passos

1. **Definir modelo de dados completo** (Prisma Schema)
2. **Especificar APIs e endpoints**
3. **Criar estrutura de pastas do projeto**
4. **Implementar módulos por fase**
5. **Desenvolver testes automatizados**
6. **Documentar APIs com Swagger**

## 📞 Contato

Sistema desenvolvido seguindo os mesmos padrões e qualidade do VagaLume.
