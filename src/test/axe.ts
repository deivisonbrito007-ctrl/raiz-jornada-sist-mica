import axe from "axe-core";
import { expect } from "vitest";

/**
 * Executa o axe-core sobre um container renderizado e falha o teste
 * listando cada violação encontrada (id, impacto e elementos).
 */
export async function esperarSemViolacoes(
  container: Element,
  opcoes: { regras?: string[] } = {},
) {
  const resultado = await axe.run(container as HTMLElement, {
    runOnly: opcoes.regras
      ? { type: "rule", values: opcoes.regras }
      : {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
        },
    rules: {
      // O container de teste não é a página inteira: regras de estrutura
      // global não se aplicam a um fragmento renderizado.
      region: { enabled: false },
      "page-has-heading-one": { enabled: false },
      "landmark-one-main": { enabled: false },
      "html-has-lang": { enabled: false },
    },
  });

  const resumo = resultado.violations
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n  ` +
        v.nodes.map((n) => n.target.join(" ")).join("\n  "),
    )
    .join("\n\n");

  expect(resumo, `Violações de acessibilidade encontradas:\n\n${resumo}`).toBe("");
}
