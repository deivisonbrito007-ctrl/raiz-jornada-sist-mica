/**
 * Intenção guardada antes de sair para o Google: para onde a pessoa queria ir,
 * qual jeito de caminhar ela escolheu e qual papel ela pediu. Só é aplicada
 * depois que a sessão existe de verdade — o destino nunca é usado como
 * redirect_uri do OAuth.
 */

export const CHAVE_DESTINO = "raiz:destino-pos-login";
export const CHAVE_CAMINHO = "raiz:caminho-entrada";
export const CHAVE_PAPEL = "raiz:papel-entrada";
export const CHAVE_CARIMBO = "raiz:intencao-carimbo";

/** Uma volta pelo Google leva minutos; passado isto a intenção é descartada. */
export const VALIDADE_INTENCAO_MS = 30 * 60_000;

export type CaminhoUrl = "acompanhado" | "autoguiado";
export type PapelEntrada = "cliente" | "terapeuta";

/** Rotas que nunca fazem sentido como destino pós-login (voltaria ao começo). */
const DESTINOS_PROIBIDOS = ["/auth", "/reset-password"];

/**
 * Aceita apenas caminhos internos simples: começa com "/", sem "//" nem "\"
 * (evita `//site.com`), sem voltar para as próprias telas de entrada e sem
 * tamanho absurdo.
 */
export function destinoSeguro(valor: string | null | undefined): string | null {
  if (!valor || valor.length > 512) return null;
  if (!/^\/[^/\\]/.test(valor)) return null;
  if (valor.includes("\\") || valor.includes("://")) return null;
  const base = valor.split(/[?#]/)[0] ?? valor;
  if (DESTINOS_PROIBIDOS.some((p) => base === p || base.startsWith(`${p}/`))) return null;
  return valor;
}

export function caminhoSeguro(valor: string | null | undefined): CaminhoUrl | null {
  return valor === "acompanhado" || valor === "autoguiado" ? valor : null;
}

export function papelSeguro(valor: string | null | undefined): PapelEntrada | null {
  return valor === "cliente" || valor === "terapeuta" ? valor : null;
}

function armazem(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

/** Guarda a intenção antes de sair para o Google, já validada e com carimbo. */
export function gravarIntencaoLogin(intencao: {
  destino?: string | null;
  caminho?: string | null;
  papel?: string | null;
}) {
  const store = armazem();
  if (!store) return;
  const destino = destinoSeguro(intencao.destino);
  const caminho = caminhoSeguro(intencao.caminho);
  const papel = papelSeguro(intencao.papel);
  try {
    // Reescreve sempre: a última escolha na tela é a que vale.
    if (destino) store.setItem(CHAVE_DESTINO, destino);
    else store.removeItem(CHAVE_DESTINO);
    if (caminho) store.setItem(CHAVE_CAMINHO, caminho);
    else store.removeItem(CHAVE_CAMINHO);
    // Terapeuta nunca vira pedido de acompanhamento.
    if (papel) store.setItem(CHAVE_PAPEL, papel);
    else store.removeItem(CHAVE_PAPEL);
    if (destino || caminho || papel) store.setItem(CHAVE_CARIMBO, String(Date.now()));
    else store.removeItem(CHAVE_CARIMBO);
  } catch {
    // Sem armazenamento (modo privado): o login segue, só sem a intenção.
  }
}

export function lerIntencaoLogin(): {
  destino: string | null;
  caminho: CaminhoUrl | null;
  papel: PapelEntrada | null;
} {
  const store = armazem();
  if (!store) return { destino: null, caminho: null, papel: null };

  let carimbo: number | null = null;
  try {
    const bruto = Number(store.getItem(CHAVE_CARIMBO));
    carimbo = Number.isFinite(bruto) && bruto > 0 ? bruto : null;
  } catch {
    carimbo = null;
  }

  // Sem carimbo válido ou vencida: descarta para não redirecionar por engano.
  if (carimbo === null || Date.now() - carimbo > VALIDADE_INTENCAO_MS) {
    limparIntencaoLogin();
    return { destino: null, caminho: null, papel: null };
  }

  const papel = papelSeguro(store.getItem(CHAVE_PAPEL));
  const caminho = caminhoSeguro(store.getItem(CHAVE_CAMINHO));
  return {
    destino: destinoSeguro(store.getItem(CHAVE_DESTINO)),
    // Quem entrou como terapeuta não pede acompanhamento.
    caminho: papel === "terapeuta" ? null : caminho,
    papel,
  };
}

export function limparIntencaoLogin() {
  const store = armazem();
  if (!store) return;
  try {
    for (const chave of [CHAVE_DESTINO, CHAVE_CAMINHO, CHAVE_PAPEL, CHAVE_CARIMBO]) {
      store.removeItem(chave);
    }
  } catch {
    // nada a limpar
  }
}
