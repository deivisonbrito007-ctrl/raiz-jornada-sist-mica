import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import type { Query } from "@tanstack/react-query";

import { CHAVES } from "./cache-chaves";

/** Suba a versão sempre que o formato dos dados em cache mudar. */
export const VERSAO_CACHE = "v1";
export const CHAVE_ARMAZENAMENTO = `raiz-cache-${VERSAO_CACHE}`;
const CHAVE_USUARIO = `raiz-cache-usuario-${VERSAO_CACHE}`;

/** Cache persistido vale por uma sessão de uso; nunca mais que isto. */
export const IDADE_MAXIMA_MS = 12 * 60 * 60_000;

/**
 * Só dados de navegação/listagem são guardados. Ficam de fora, de propósito:
 * `conteudo` (traz URL assinada de mídia, que expira), `progresso`, `diario`,
 * `minha-etapa` (check-ins) e preferências — nada sensível ou de curta validade
 * sobrevive ao recarregamento.
 */
export const RAIZES_PERSISTIDAS: string[] = [
  CHAVES.contexto[0],
  CHAVES.biblioteca[0],
  CHAVES.trilha[0],
  CHAVES.jornada[0],
  CHAVES.historico[0],
  CHAVES.notificacoes[0],
  CHAVES.adminResumo[0],
  CHAVES.adminClientes[0],
  CHAVES.adminTrilhas[0],
  CHAVES.adminConteudos[0],
  CHAVES.adminAcompanhamento[0],
  CHAVES.equipe[0],
];

/** Decide se uma consulta pode ir para o `sessionStorage`. */
export function podePersistir(query: Pick<Query, "queryKey" | "state">): boolean {
  const raiz = Array.isArray(query.queryKey) ? query.queryKey[0] : null;
  if (typeof raiz !== "string") return false;
  if (!RAIZES_PERSISTIDAS.includes(raiz)) return false;
  return query.state.status === "success";
}

function armazem(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Apaga o cache persistido (logout, troca de conta, perda de acesso admin). */
export function limparCachePersistido() {
  try {
    armazem()?.removeItem(CHAVE_ARMAZENAMENTO);
  } catch {
    // armazenamento indisponível (modo privado): nada a limpar
  }
}

/**
 * Amarra o cache persistido a uma conta: se o dono mudou, o que estava guardado
 * é descartado antes de qualquer restauração.
 */
export function definirUsuarioCache(userId: string | null) {
  const store = armazem();
  if (!store) return;
  try {
    const anterior = store.getItem(CHAVE_USUARIO);
    if (anterior === userId) return;
    limparCachePersistido();
    if (userId) store.setItem(CHAVE_USUARIO, userId);
    else store.removeItem(CHAVE_USUARIO);
  } catch {
    // sem armazenamento: segue só com o cache em memória
  }
}

/** Opções do `PersistQueryClientProvider`; `null` no servidor (SSR não persiste). */
export function opcoesPersistencia(): Omit<PersistQueryClientOptions, "queryClient"> | null {
  const store = armazem();
  if (!store) return null;
  return {
    persister: createSyncStoragePersister({ storage: store, key: CHAVE_ARMAZENAMENTO }),
    maxAge: IDADE_MAXIMA_MS,
    buster: VERSAO_CACHE,
    dehydrateOptions: { shouldDehydrateQuery: podePersistir },
  };
}
