# Fabric Backend

API RESTful do sistema Fabric PCP desenvolvida com Node.js, TypeScript, Express e Prisma.

## 🚀 Instalação

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp ../.env.example .env

# Gerar Prisma Client
npm run prisma:generate

# Executar migrations
npm run prisma:migrate
```

## 💻 Desenvolvimento

```bash
# Modo desenvolvimento com hot reload
npm run dev

# Build para produção
npm run build

# Executar produção
npm start
```

## 🗄 Prisma

```bash
# Gerar Prisma Client
npm run prisma:generate

# Criar migration
npm run prisma:migrate

# Abrir Prisma Studio
npm run prisma:studio

# Reset database
npm run prisma:reset
```

## 🧪 Testes

```bash
# Executar testes
npm test

# Testes em watch mode
npm run test:watch

# Cobertura de testes
npm run test:coverage
```

## 📝 Scripts

- `dev` - Inicia servidor em modo desenvolvimento
- `build` - Compila TypeScript para JavaScript
- `start` - Inicia servidor em produção
- `lint` - Verifica qualidade do código
- `format` - Formata código com Prettier
- `type-check` - Verifica tipos TypeScript
