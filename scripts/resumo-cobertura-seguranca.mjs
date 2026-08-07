// Resumo em markdown da cobertura da suíte de segurança/RLS para o GitHub Step Summary.
import { readFileSync, existsSync } from "node:fs";

const MINIMOS = { lines: 80, statements: 80, functions: 80, branches: 70 };
const arquivo = "coverage-seguranca/coverage-summary.json";

if (!existsSync(arquivo)) {
  console.log("### Testes de segurança (RLS)\n\nNenhum relatório de cobertura gerado.");
  process.exit(0);
}

const total = JSON.parse(readFileSync(arquivo, "utf8")).total;
const linhas = Object.entries(MINIMOS).map(([chave, minimo]) => {
  const pct = total[chave]?.pct ?? 0;
  return `| ${chave} | ${pct.toFixed(2)}% | ${minimo}% | ${pct >= minimo ? "✅" : "❌"} |`;
});

console.log(
  [
    "### Testes de segurança (RLS)",
    "",
    "| Métrica | Cobertura | Mínimo | Status |",
    "| --- | --- | --- | --- |",
    ...linhas,
    "",
    "Módulos medidos: `permissoes`, `permissao-guard`, `liberacao-guard`, `auditoria-acesso`, `erro-permissao`.",
  ].join("\n"),
);
