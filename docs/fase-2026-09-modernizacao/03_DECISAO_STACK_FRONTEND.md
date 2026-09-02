# Decisão: Stack do Frontend — Vue 3 (permanece)

**Data:** 01/09/2026
**Fase:** 5, item 5.4 do cronograma (`02_CRONOGRAMA_IMPLEMENTACOES.md`)
**Decisão:** o frontend do Fabric permanece **100% Vue 3**. Não há migração para React em andamento nem planejada.

## Contexto

Em setembro de 2026, ao iniciar esta fase de modernização, existiam 8 arquivos `.tsx` no repositório (`src/App.tsx`, `src/pages/`, `src/features/counting/`) que pareciam sugerir uma migração para React em andamento, coincidindo com o módulo de contagem de estoque — o mais recente e maduro em Vue.

Uma investigação (Sprint 0, item 0.4, e confirmada de forma independente pelos agentes de arquitetura e frontend na análise inicial desta fase) mostrou que **não era uma migração real**:

- `react`, `react-dom` e `react-router-dom` nunca estiveram em `frontend/package.json` nem em `node_modules`.
- `vite.config.ts` nunca teve o plugin do React.
- O fluxo real de boot (`index.html` → `main.ts`) sempre montou `App.vue`. `App.tsx` nunca foi importado por nada executável.
- `npm run build` estava **quebrado** por causa desses arquivos (`vue-tsc` tentava checá-los como Vue/JSX e falhava com `Cannot find module 'react'`).
- Os componentes React eram stubs vazios (`useState` sem dados, `// TODO: buscar da API`), reimplementando funcionalidade que já existia **completa e em produção** em Vue (o módulo de contagem: 6 views, `counting.store.ts` com 28 endpoints, documentado como 100% entregue em `docs/STATUS_FRONTEND_CONTAGEM.md`).
- Nenhum dos ~70 documentos em `docs/` menciona uma decisão de adotar React.

Conclusão: foi um experimento de sessão isolado que nunca rodou e ficou esquecido no repositório, não uma decisão de produto. Removido no Sprint 0 (commit `ca12cae`).

## Estado atual do frontend

- **Framework:** Vue 3 (Composition API e Options API misturados, conforme a view), Pinia para estado, Vue Router, TailwindCSS, Chart.js.
- **Escala:** 44 views Vue, ~20 stores Pinia, ~29 services de API.
- **Maturidade:** módulos de autenticação, cadastros básicos, produtos/BOMs e contagem de estoque estão completos e em uso. Roteiros, ordens de produção, apontamentos e compras têm cobertura parcial (ver `docs/PLANO_TRABALHO.md` para o roadmap de negócio original).
- **Dois módulos de backend sem nenhuma tela**: apontamentos de produção (`production-pointing`) e recebimentos de compra (`purchase-receipt`) têm API funcional (corrigida na Fase 1) mas zero consumo no frontend — pendência de produto, não técnica.

## Por que não revisitar React agora

- Não há nenhuma limitação técnica do Vue 3 que justifique a troca — a stack atual é madura, com padrões consistentes entre as 44 views.
- O custo de reescrever ~44 views maduras para obter o quê, especificamente, não foi articulado em nenhum momento — não há um driver de negócio ou técnico por trás da ideia original.
- Um projeto com um único desenvolvedor ativo se beneficia mais de consistência (uma stack, um padrão de state management, um conjunto de convenções) do que de manter duas stacks de UI em paralelo.

## Quando reconsiderar

Se React (ou qualquer outra stack) precisar ser adotado no futuro, deve ser uma decisão de arquitetura nova e deliberada, não uma continuação deste experimento abandonado. Recomendação, caso isso aconteça:

1. Registrar a decisão e a motivação de negócio/técnica em um novo documento nesta pasta ou em `docs/`.
2. Instalar as dependências reais desde o primeiro commit (`react`, `react-dom`, plugin do Vite) e configurar o build corretamente antes de escrever qualquer componente.
3. Escolher um módulo pequeno e isolado como piloto (não duplicar um módulo já maduro em Vue, como aconteceu da primeira vez).
4. Adicionar um gate de CI que rode `build`/`type-check` a cada PR (já existe desde a Fase 3, `.github/workflows/ci.yml`) — teria detectado o problema anterior automaticamente antes de chegar ao repositório.
5. Só depois avaliar expansão módulo a módulo, com critério explícito de quando um módulo é considerado "migrado".
