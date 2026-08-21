/**
 * Intenção guardada antes de sair para o Google: para onde a pessoa queria ir
 * e qual jeito de caminhar ela escolheu. Só é aplicada depois que a sessão
 * existe de verdade — o destino nunca é usado como redirect_uri do OAuth.
 */

export const CHAVE_DESTINO = "raiz:destino-pos-login";
export const CHAVE_CAMINHO = "raiz:caminho-entrada";

export type CaminhoUrl = "acompanhado" | "autoguiado";

/** Aceita apenas caminhos internos, evitando redirecionamento para fora. */
export function destinoSeguro(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return /^\/[^/\\]/.test(valor) ? valor : null;
}

export function lerIntencaoLogin() {
  if (typeof sessionStorage === "undefined") return { destino: null, caminho: null };
  const destino = destinoSeguro(sessionStorage.getItem(CHAVE_DESTINO));
  const bruto = sessionStorage.getItem(CHAVE_CAMINHO);
  const caminho: CaminhoUrl | null =
    bruto === "acompanhado" || bruto === "autoguiado" ? bruto : null;
  return { destino, caminho };
}

export function limparIntencaoLogin() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(CHAVE_DESTINO);
  sessionStorage.removeItem(CHAVE_CAMINHO);
}
