import axe, { type AxeResults, type ElementContext, type RunOptions, type Result } from "axe-core";
import { expect } from "vitest";

/**
 * Auditoria automática de acessibilidade com axe-core, para rodar no CI.
 *
 * O axe roda sobre o DOM já renderizado pelos testes (jsdom), então ele pega o
 * que de fato chega ao navegador: rótulos ausentes, ARIA inválida, ordem de
 * cabeçalhos, campos sem label, botões sem nome acessível e afins.
 *
 * Regras desligadas por padrão e o motivo:
 *   - color-contrast: o jsdom não calcula cores herdadas nem variáveis CSS, então
 *     a regra dá falso positivo/negativo. Contraste é conferido no E2E, em
 *     navegador real.
 *   - region: fragmentos de componentes são renderizados fora do layout com
 *     <main>, e a regra exigiria a landmark em cada trecho isolado.
 */
const REGRAS_DESLIGADAS = ["color-contrast", "region"] as const;

/** Conjuntos WCAG cobertos: A e AA, mais as boas práticas do próprio axe. */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"];

export interface OpcoesAuditoria {
  /** Regras extras a desligar neste caso específico (com justificativa no teste). */
  desligar?: string[];
  /** Restringe a auditoria a um subconjunto de tags do axe. */
  tags?: string[];
}

function montarOpcoes({ desligar = [], tags = TAGS }: OpcoesAuditoria = {}): RunOptions {
  const rules: RunOptions["rules"] = {};
  for (const id of [...REGRAS_DESLIGADAS, ...desligar]) rules[id] = { enabled: false };
  return { runOnly: { type: "tag", values: tags }, rules, resultTypes: ["violations"] };
}

/** Roda o axe no trecho informado e devolve o resultado bruto. */
export async function auditar(
  alvo: ElementContext = document.body,
  opcoes?: OpcoesAuditoria,
): Promise<AxeResults> {
  return axe.run(alvo, montarOpcoes(opcoes));
}

/** Relatório legível: regra, impacto, ajuda e os elementos culpados. */
export function formatarViolacoes(violacoes: Result[]): string {
  return violacoes
    .map((v) => {
      const nos = v.nodes
        .map((n) => `      · ${n.target.join(" ")}\n        ${n.failureSummary ?? ""}`)
        .join("\n");
      return `  [${v.impact ?? "n/d"}] ${v.id}: ${v.help}\n    ${v.helpUrl}\n${nos}`;
    })
    .join("\n\n");
}

/**
 * Falha o teste (e o CI) quando o axe encontra qualquer violação, mostrando
 * exatamente qual regra quebrou e em qual elemento.
 */
export async function esperarSemViolacoes(
  alvo: ElementContext = document.body,
  opcoes?: OpcoesAuditoria,
): Promise<void> {
  const { violations } = await auditar(alvo, opcoes);
  if (violations.length > 0) {
    const resumo = violations.map((v) => v.id).join(", ");
    throw new Error(
      `axe-core encontrou ${violations.length} violação(ões) de acessibilidade (${resumo}):\n\n` +
        formatarViolacoes(violations),
    );
  }
  expect(violations).toHaveLength(0);
}
