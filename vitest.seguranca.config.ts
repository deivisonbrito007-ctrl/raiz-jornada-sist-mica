import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Suíte dedicada aos testes de segurança / RLS.
 * Roda no CI a cada PR e falha se a cobertura dos módulos de
 * permissão, liberação e auditoria cair abaixo do mínimo.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    name: "seguranca",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/lib/funcoes-seguranca-rls.test.ts",
      "src/lib/auditoria-acesso.test.ts",
      "src/lib/permissao-guard.test.ts",
      "src/lib/erro-permissao.test.ts",
      "src/lib/admin-permissoes-servidor.test.ts",
      "src/lib/liberacao-escopo.test.ts",
      "src/lib/liberacao-cache-invalidacao.test.ts",
      "src/lib/midia-liberacao-escopo.test.ts",
      "src/lib/supabase-escopo.test.ts",
      "src/lib/player-progresso-escopo.test.ts",
      "src/routes/_authenticated/admin-escopo-cliente.test.tsx",
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage-seguranca",
      reporter: ["text", "json-summary", "lcov"],
      include: [
        "src/lib/permissoes.ts",
        "src/lib/permissao-guard.ts",
        "src/lib/liberacao-guard.ts",
        "src/lib/auditoria-acesso.ts",
        "src/lib/erro-permissao.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
});
