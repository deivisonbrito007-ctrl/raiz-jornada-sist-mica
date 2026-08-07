/**
 * Fila local de progresso.
 *
 * Quando o link seguro da mídia vence (ou a prática é revogada), o backend
 * recusa gravar o progresso. Em vez de perder o que a pessoa fez, guardamos
 * localmente o ponto onde ela parou e a intenção de concluir. Assim que o
 * acesso é renovado, o player reenvia tudo automaticamente.
 */

export type ProgressoPendente = {
  conteudoId: string;
  posicaoSegundos?: number;
  tocando?: boolean;
  status?: "em_andamento" | "concluido";
  atualizadoEm: number;
};

const CHAVE = "raiz:progresso-pendente";
/** entradas mais antigas que isso são descartadas (7 dias) */
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

function armazenamento(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function ler(): Record<string, ProgressoPendente> {
  const store = armazenamento();
  if (!store) return {};
  try {
    const bruto = store.getItem(CHAVE);
    if (!bruto) return {};
    const dados = JSON.parse(bruto) as Record<string, ProgressoPendente>;
    if (!dados || typeof dados !== "object") return {};
    const agora = Date.now();
    const limpo: Record<string, ProgressoPendente> = {};
    for (const [id, item] of Object.entries(dados)) {
      if (item && typeof item === "object" && agora - (item.atualizadoEm || 0) < VALIDADE_MS) {
        limpo[id] = item;
      }
    }
    return limpo;
  } catch {
    return {};
  }
}

function gravar(dados: Record<string, ProgressoPendente>) {
  const store = armazenamento();
  if (!store) return;
  try {
    if (Object.keys(dados).length === 0) store.removeItem(CHAVE);
    else store.setItem(CHAVE, JSON.stringify(dados));
  } catch {
    /* armazenamento cheio ou bloqueado: seguimos sem fila local */
  }
}

/**
 * Guarda (ou atualiza) o progresso pendente de uma prática. Um pedido de
 * conclusão nunca é rebaixado para "em andamento" por uma gravação posterior.
 */
export function guardarPendente(
  entrada: Omit<ProgressoPendente, "atualizadoEm"> & { atualizadoEm?: number },
): ProgressoPendente {
  const dados = ler();
  const anterior = dados[entrada.conteudoId];
  const status =
    anterior?.status === "concluido" ? "concluido" : (entrada.status ?? anterior?.status);
  const item: ProgressoPendente = {
    conteudoId: entrada.conteudoId,
    posicaoSegundos: entrada.posicaoSegundos ?? anterior?.posicaoSegundos,
    tocando: entrada.tocando ?? anterior?.tocando,
    ...(status ? { status } : {}),
    atualizadoEm: entrada.atualizadoEm ?? Date.now(),
  };
  dados[entrada.conteudoId] = item;
  gravar(dados);
  return item;
}

/** Progresso pendente de uma prática, se houver. */
export function lerPendente(conteudoId: string): ProgressoPendente | null {
  return ler()[conteudoId] ?? null;
}

/** Existe algo pendente para esta prática? */
export function temPendente(conteudoId: string): boolean {
  return Boolean(ler()[conteudoId]);
}

/** Remove o pendente (usar somente após reenviar com sucesso). */
export function limparPendente(conteudoId: string) {
  const dados = ler();
  if (!(conteudoId in dados)) return;
  delete dados[conteudoId];
  gravar(dados);
}

/**
 * Reenvia o progresso guardado localmente. Só limpa a fila quando o envio
 * termina bem — uma falha mantém o registro para a próxima tentativa.
 */
export async function reenviarPendente(
  conteudoId: string,
  envio: {
    salvarPosicao: (entrada: {
      data: { conteudoId: string; posicaoSegundos: number; tocando: boolean };
    }) => unknown;
    marcarProgresso: (entrada: {
      data: { conteudoId: string; status: "em_andamento" | "concluido" };
    }) => unknown;
  },
): Promise<ProgressoPendente | null> {
  const pendente = lerPendente(conteudoId);
  if (!pendente) return null;
  try {
    if (typeof pendente.posicaoSegundos === "number") {
      await envio.salvarPosicao({
        data: {
          conteudoId,
          posicaoSegundos: Math.floor(pendente.posicaoSegundos),
          tocando: Boolean(pendente.tocando),
        },
      });
    }
    if (pendente.status) {
      await envio.marcarProgresso({ data: { conteudoId, status: pendente.status } });
    }
    limparPendente(conteudoId);
    return pendente;
  } catch {
    return null;
  }
}
