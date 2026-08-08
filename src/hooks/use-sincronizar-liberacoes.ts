import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CANAL_LIBERACOES = "raiz-liberacoes";
export const CANAL_CONTEUDOS = "raiz-conteudos";
export const CANAL_EIXOS = "raiz-eixos";

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
 * Apaga do cache qualquer resquício de uma sequência (eixo) removida.
 */
export function removerSequenciaDoCache(queryClient: QueryClient, eixoId: string) {
  queryClient.removeQueries({ queryKey: ["trilha", eixoId] });
  invalidarTudo(queryClient);
}

/** limite do setTimeout (~24,8 dias): acima disso o navegador dispara na hora */
const TETO_TIMEOUT = 2_147_483_647;

/**
 * Mantém a biblioteca e o player em sincronia com o terapeuta, em tempo real.
 *
 * Três fontes de mudança chegam pelo banco, sem recarregar a página:
 *   - `liberacoes`: o terapeuta libera ou revoga o acesso da pessoa. Quando a
 *     liberação está agendada (`liberar_em` no futuro), um temporizador
 *     revalida exatamente no instante em que ela passa a valer ou expira;
 *   - `conteudos`: uma prática é removida ou editada no acervo — na remoção o
 *     cache dela é descartado na hora, junto de resquícios locais;
 *   - `eixos`: uma sequência inteira é removida ou renomeada.
 *
 * O `onMudanca` permite que o player reaja no mesmo instante (parar a mídia,
 * mostrar o aviso de bloqueio etc.). Quando a mudança é a remoção de uma
 * prática, o aviso chega com `{ tipo: "removido", conteudoId }`, para a tela
 * anunciar o motivo exato a quem usa leitor de tela.
 */
export type MudancaSincronia =
  | { tipo: "removido"; conteudoId: string }
  | { tipo: "liberacao-removida"; liberacaoId?: string }
  | { tipo: "sequencia-removida"; eixoId: string }
  | { tipo: "liberacao" };

export function useSincronizarLiberacoes(onMudanca?: (mudanca?: MudancaSincronia) => void) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let ativo = true;
    const canais: ReturnType<typeof supabase.channel>[] = [];
    const temporizadores: ReturnType<typeof setTimeout>[] = [];

    /** revalida no instante exato em que a liberação agendada entra/sai de vigor */
    function agendarVirada(liberarEm?: string | null) {
      if (!liberarEm) return;
      const alvo = new Date(liberarEm).getTime();
      if (Number.isNaN(alvo)) return;
      const espera = alvo - Date.now();
      if (espera <= 0 || espera > TETO_TIMEOUT) return;
      temporizadores.push(
        setTimeout(() => {
          if (!ativo) return;
          invalidarTudo(queryClient);
          onMudanca?.({ tipo: "liberacao" });
        }, espera + 250),
      );
    }

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
            (evento?: {
              eventType?: string;
              new?: { liberar_em?: string | null } | null;
              old?: { id?: string } | null;
            }) => {
              // sequências, metas e heatmap também dependem das liberações
              invalidarTudo(queryClient);
              agendarVirada(evento?.new?.liberar_em ?? null);
              if (evento?.eventType === "DELETE") {
                onMudanca?.({ tipo: "liberacao-removida", liberacaoId: evento?.old?.id });
                return;
              }
              onMudanca?.({ tipo: "liberacao" });
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
            (evento?: { eventType?: string; old?: { id?: string } | null }) => {
              const antigo = evento?.old ?? null;
              if (evento?.eventType === "DELETE" && antigo?.id) {
                removerPraticaDoCache(queryClient, antigo.id);
                onMudanca?.({ tipo: "removido", conteudoId: antigo.id });
                return;
              }
              invalidarTudo(queryClient);
              onMudanca?.({ tipo: "liberacao" });
            },
          )
          .subscribe(),
      );

      canais.push(
        supabase
          .channel(`${CANAL_EIXOS}-${uid}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "eixos" },
            (evento?: { eventType?: string; old?: { id?: string } | null }) => {
              const antigo = evento?.old ?? null;
              if (evento?.eventType === "DELETE" && antigo?.id) {
                removerSequenciaDoCache(queryClient, antigo.id);
                onMudanca?.({ tipo: "sequencia-removida", eixoId: antigo.id });
                return;
              }
              invalidarTudo(queryClient);
              onMudanca?.({ tipo: "liberacao" });
            },
          )
          .subscribe(),
      );

      // liberações agendadas já existentes: programa a virada de cada uma
      try {
        const { data: agendadas } = await supabase
          .from("liberacoes")
          .select("liberar_em")
          .eq("cliente_id", uid)
          .not("liberar_em", "is", null);
        if (!ativo) return;
        for (const linha of agendadas ?? []) agendarVirada(linha.liberar_em);
      } catch {
        // sem agendamentos legíveis agora: o Realtime ainda cobre as mudanças
      }
    }

    void assinar();

    return () => {
      ativo = false;
      for (const temporizador of temporizadores) clearTimeout(temporizador);
      for (const canal of canais) void supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);
}
