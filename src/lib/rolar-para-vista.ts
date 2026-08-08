/**
 * Rola um elemento até a área visível ao devolver o foco para ele.
 *
 * O foco por si só não garante visibilidade: quando o player estava bloqueado e
 * o acesso volta, o controle que recupera o foco pode estar fora da vista (a
 * página cresceu com o aviso, ou a pessoa rolou enquanto esperava). Sem rolar,
 * quem enxerga fica sem saber onde o teclado está.
 *
 * Respeita `prefers-reduced-motion`: com movimento reduzido a rolagem é
 * instantânea, sem animação.
 */
export function rolarParaVista(
  alvo: HTMLElement | null | undefined,
  bloco: ScrollLogicalPosition = "center",
) {
  if (!alvo?.scrollIntoView) return;
  let suave = true;
  try {
    suave = !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  } catch {
    /* matchMedia indisponível: mantém a rolagem suave */
  }
  try {
    alvo.scrollIntoView({ block: bloco, behavior: suave ? "smooth" : "auto" });
  } catch {
    /* navegadores antigos: assinatura sem opções */
    alvo.scrollIntoView();
  }
}
