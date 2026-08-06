# Testes automatizados + CI

Objetivo: ter testes de componentes rodando localmente e um workflow de CI no GitHub que roda lint + testes em cada push/PR.

## Ajustes em relação ao script enviado

Verifiquei o projeto antes de planejar:

- O pacote `@lovable.dev/jest-config` não existe no registro npm (retorna 404), então `npx lovable init:test` não tem preset de Jest para gerar. Vou usar **Vitest + React Testing Library**, que é o runner suportado neste stack (Vite 8 + React 19 + TanStack Start) e roda os mesmos testes com a mesma API (`test`, `expect`, `render`, `screen`).
- O projeto usa **bun** (`bun.lock`, sem `package-lock.json`), então o CI usará `bun install --frozen-lockfile` em vez de `npm ci`.
- O script `test` ficará sem `--watch` (modo watch travaria o CI); watch fica em um script separado.
- Commit e push não são feitos por comando aqui: o código sincroniza com o GitHub pela integração do Lovable. Se o repositório ainda não estiver conectado, conecte em Plus (+) → GitHub → Connect project e o workflow passa a rodar.

## O que será feito

1. Instalar dev dependencies: `vitest`, `@vitejs/plugin-react` (já presente), `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
2. Criar `vitest.config.ts` com ambiente `jsdom`, `globals: true`, alias `@` via `vite-tsconfig-paths` e `setupFiles` apontando para `src/test/setup.ts`.
3. Criar `src/test/setup.ts` importando `@testing-library/jest-dom/vitest`.
4. Adicionar scripts em `package.json`: `test` (`vitest run`) e `test:watch` (`vitest`).
5. Criar `src/components/ui/button.test.tsx` com o teste do Button exatamente como no seu script (label "Teste", `getByRole('button')`, `toHaveTextContent`).
6. Criar `.github/workflows/ci.yml`: em push/PR para `main` e `develop`, checkout, `oven-sh/setup-bun`, `bun install --frozen-lockfile`, `bun run lint`, `bun run test`.
7. Rodar `bunx vitest run` para confirmar que o teste passa antes de encerrar.

## Detalhes técnicos

- Arquivos de teste ficam fora de `src/routes/` (o plugin de rotas trataria qualquer arquivo lá como rota). O teste do Button vive ao lado do componente em `src/components/ui/`.
- `vitest.config.ts` separado do `vite.config.ts` para não misturar o plugin do TanStack Router/MCP com o ambiente de testes.
- O `include` do Vitest cobrirá `src/**/*.{test,spec}.{ts,tsx}`.
