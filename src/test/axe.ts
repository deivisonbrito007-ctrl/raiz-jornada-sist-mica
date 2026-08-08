import axe, { type AxeResults, type RunOptions } from "axe-core";
import { expect } from "vitest";

/**
 * Regras desativadas no ambiente de teste (jsdom):
 * - color-contrast: jsdom não aplica o CSS do Tailwind, então as cores reais não
 *   existem aqui. O contraste é validado nos testes E2E com navegador real.
 */
const REGRAS_DESATIVADAS = ["color-contrast"];

const OPCOES_PADRAO: RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  rules: Object.fromEntries(REGRAS_DESATIVADAS.map((id) => [id, { enabled: false }])),
};

/** Roda o axe em um trecho da tela e devolve o resultado completo. */
export async function auditarAcessibilidade(
  elemento: Element = document.body,
  opcoes: RunOptions = {},
): Promise<AxeResults> {
  return axe.run(elemento, { ...OPCOES_PADRAO, ...opcoes });
}

/** Descreve as violações de forma legível para a mensagem de falha do teste. */
export function descreverViolacoes(resultado: AxeResults): string {
  return resultado.violations
    .map((v) => {
      const alvos = v.nodes.map((n) => `      - ${n.target.join(" ")}`).join("\n");
      return `  [${v.impact ?? "n/a"}] ${v.id}: ${v.help}\n${alvos}`;
    })
    .join("\n");
}

/** Falha o teste se o axe encontrar qualquer violação no elemento. */
export async function esperarSemViolacoes(
  elemento: Element = document.body,
  opcoes: RunOptions = {},
): Promise<void> {
  const resultado = await auditarAcessibilidade(elemento, opcoes);
  expect(
    resultado.violations.length,
    resultado.violations.length
      ? `Violações de acessibilidade encontradas:\n${descreverViolacoes(resultado)}`
      : "",
  ).toBe(0);
}
