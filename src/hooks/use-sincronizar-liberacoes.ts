import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CANAL_LIBERACOES = "raiz-liberacoes";

/**
 * Mantém a biblioteca e o player em sincronia com as liberações do terapeuta.
 *
 * Quando o terapeuta libera ou revoga um conteúdo, o banco emite o evento em
 * tempo real e a interface do cliente se atualiza sozinha — sem recarregar a
 * página. O `onMudanca` permite que o player reaja no mesmo instante (parar a
 * mídia, mostrar o aviso de revogação etc.).
 */
export function useSincronizarLiberacoes(onMudanca?: () => void) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let ativo = true;
    let canal: ReturnType<typeof supabase.channel> | null = null;

    async function assinar() {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || !ativo) return;

      canal = supabase
        .channel(`${CANAL_LIBERACOES}-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "liberacoes",
            filter: `cliente_id=eq.${uid}`,
          },
          (payload) => {
            console.log("[raiz] mudanca liberacao:", payload.eventType);
            queryClient.invalidateQueries({ queryKey: ["biblioteca"] });
            queryClient.invalidateQueries({ queryKey: ["trilha"] });
            queryClient.invalidateQueries({ queryKey: ["conteudo"] });
            onMudanca?.();
          },
        )
        .subscribe((status) => console.log("[raiz] canal liberacoes:", status));
    }

    void assinar();

    return () => {
      ativo = false;
      if (canal) void supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);
}
