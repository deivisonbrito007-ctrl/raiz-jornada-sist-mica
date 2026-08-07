import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Suíte de RLS "ao vivo": executa consultas reais contra o banco.
// Roda em ambiente node, sem jsdom, e com timeouts maiores.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.rls.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
