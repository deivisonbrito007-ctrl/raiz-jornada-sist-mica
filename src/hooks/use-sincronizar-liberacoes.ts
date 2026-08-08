import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CANAL_LIBERACOES = "raiz-liberacoes";
export const CANAL_CONTEUDOS = "raiz-conteudos";

/** chaves de cache que dependem de liberações e do acervo de práticas */
const CHAVES_DEPENDENTES = ["biblioteca", "trilha", "conteudo", "contexto", "progresso"];

function invalidarTudo(queryClient: QueryClient) {
  for (const chave of CHAVES_DEPENDENTES) {
    queryClient.invalidateQueries({ queryKey: [chave] });
  }
}

/**
 * Apaga do cache e do armazenamento local qualquer resquício da prática removida.
 *
 * Sem isso, a prática apagada pelo terapeuta poderia reaparecer ao navegar de
 * volta (cache do TanStack Query) ou tentar retomar a posição salva localmente.
 */
export function removerPraticaDoCache(queryClient: QueryClient, conteudoId: string) {
  queryClient.removeQueries({ queryKey: ["conteudo", conteudoId] });
  queryClient.removeQueries({ queryKey: ["progresso", conteudoId] });
  invalidarTudo(queryClient);

  if (typeof window === "undefined") return;
  for (const armazem of [window.localStorage, window.sessionStorage]) {
    try {
      const chaves: string[] = [];
      for (let i = 0; i < armazem.length; i += 1) {
        const chave = armazem.key(i);
        if (chave && chave.includes(conteudoId)) chaves.push(chave);
      }
      for (const chave of chaves) armazem.removeItem(chave);
    } catch {
      // armazenamento indisponível (modo privado): nada a limpar
    }
  }
}

/**
 * Mantém a biblioteca e o player em sincronia com o terapeuta, em tempo real.
 *
 * Duas fontes de mudança chegam pelo banco, sem recarregar a página:
 *   - `liberacoes`: o terapeuta libera ou revoga o acesso da pessoa;
 *   - `conteudos`: uma prática é removida ou editada no acervo — na remoção o
 *     cache dela é descartado na hora, junto de resquícios locais.
 *
 * O `onMudanca` permite que o player reaja no mesmo instante (parar a mídia,
 * mostrar o aviso de bloqueio etc.).
 */
export function useSincronizarLiberacoes(onMudanca?: () => void) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let ativo = true;
    const canais: ReturnType<typeof supabase.channel>[] = [];

    async function assinar() {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || !ativo) return;

      canais.push(
        supabase
          .channel(`${CANAL_LIBERACOES}-${uid}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "liberacoes",
              filter: `cliente_id=eq.${uid}`,
            },
            () => {
              // sequências, metas e heatmap também dependem das liberações
              invalidarTudo(queryClient);
              onMudanca?.();
            },
          )
          .subscribe(),
      );

      canais.push(
        supabase
          .channel(`${CANAL_CONTEUDOS}-${uid}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "conteudos" },
            (evento) => {
              const antigo = evento.old as { id?: string } | null;
              if (evento.eventType === "DELETE" && antigo?.id) {
                removerPraticaDoCache(queryClient, antigo.id);
              } else {
                invalidarTudo(queryClient);
              }
              onMudanca?.();
            },
          )
          .subscribe(),
      );
    }

    void assinar();

    return () => {
      ativo = false;
      for (const canal of canais) void supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);
}
