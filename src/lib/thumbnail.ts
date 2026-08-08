import { supabase } from "@/integrations/supabase/client";

/**
 * O bucket `midias` é privado: capas precisam de URL assinada para aparecer.
 * Guardamos em cache por caminho para não pedir uma assinatura por render.
 */
const VALIDADE_SEGUNDOS = 60 * 60;
const MARGEM_MS = 60 * 1000;

type Entrada = { url: string; expiraEm: number };

const cache = new Map<string, Entrada>();
const pendentes = new Map<string, Promise<string | null>>();

export function limparCacheThumbnails() {
  cache.clear();
  pendentes.clear();
}

export function urlThumbnailEmCache(caminho: string): string | null {
  const entrada = cache.get(caminho);
  if (!entrada) return null;
  if (entrada.expiraEm - MARGEM_MS < Date.now()) {
    cache.delete(caminho);
    return null;
  }
  return entrada.url;
}

export async function urlThumbnail(caminho: string | null | undefined): Promise<string | null> {
  if (!caminho) return null;
  const emCache = urlThumbnailEmCache(caminho);
  if (emCache) return emCache;

  const pendente = pendentes.get(caminho);
  if (pendente) return pendente;

  const promessa = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from("midias")
        .createSignedUrl(caminho, VALIDADE_SEGUNDOS);
      if (error || !data?.signedUrl) return null;
      cache.set(caminho, {
        url: data.signedUrl,
        expiraEm: Date.now() + VALIDADE_SEGUNDOS * 1000,
      });
      return data.signedUrl;
    } catch {
      return null;
    } finally {
      pendentes.delete(caminho);
    }
  })();

  pendentes.set(caminho, promessa);
  return promessa;
}

/** Caminho determinístico da capa, agrupado por eixo. */
export function caminhoCapa(eixoId: string, nomeArquivo: string) {
  const seguro = nomeArquivo.replace(/[^\w.-]/g, "_");
  return `capas/${eixoId}/${Date.now()}-${seguro}`;
}

export function formatarTamanho(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
