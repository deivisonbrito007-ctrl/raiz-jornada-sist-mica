import { supabase } from "@/integrations/supabase/client";

/** Janela em que a resposta de `pode_administrar` é reaproveitada. */
export const TTL_ADMIN_MS = 30_000;

type Cache = { valor: boolean; em: number } | null;
let cache: Cache = null;
let emVoo: Promise<boolean> | null = null;

/**
 * Checa acesso administrativo reaproveitando a resposta recente. Sem isso, cada
 * clique na barra lateral disparava uma ida ao banco antes de a aba aparecer.
 * Segurança real continua no banco (RLS + funções SECURITY DEFINER); este cache
 * é só de navegação.
 */
export async function podeAdministrarEmCache(): Promise<boolean> {
  const agora = Date.now();
  if (cache && agora - cache.em < TTL_ADMIN_MS) return cache.valor;
  if (emVoo) return emVoo;

  emVoo = (async () => {
    try {
      const { data } = await supabase.rpc("pode_administrar");
      const valor = data === true;
      cache = { valor, em: Date.now() };
      return valor;
    } finally {
      emVoo = null;
    }
  })();

  return emVoo;
}

/** Descarta o cache (usar quando permissões mudam ou no logout). */
export function limparCacheAdmin() {
  cache = null;
}
