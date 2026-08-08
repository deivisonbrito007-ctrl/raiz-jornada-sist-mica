import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Suíte dedicada de acessibilidade (axe-core).
 *
 * Roda só os arquivos *.axe.test.tsx, para o CI ter um job curto que falha
 * assim que qualquer violação aparece — sem esperar a suíte completa.
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    name: "a11y",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.axe.test.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**"],
    reporters: ["default"],
  },
});
