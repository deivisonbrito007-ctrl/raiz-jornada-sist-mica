import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Minus, Plus, Target } from "lucide-react";
import { toast } from "sonner";

import { CHAVES } from "@/lib/cache-chaves";
import { definirMetaSemanal } from "@/lib/raiz.functions";
import { META_MAXIMA, META_MINIMA, limitarMeta, rotuloMeta } from "@/lib/perfil-cliente";

type Props = { meta: number };

/** Ritmo semanal escolhido pela pessoa, com frase de acolhimento. */
export function MetaSemanal({ meta }: Props) {
  const queryClient = useQueryClient();
  const salvar = useServerFn(definirMetaSemanal);

  const mutacao = useMutation({
    mutationFn: (valor: number) => salvar({ data: { meta: valor } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CHAVES.contexto });
    },
    onError: () => toast.error("Não foi possível salvar seu ritmo agora."),
  });

  const atual = limitarMeta(mutacao.variables ?? meta);

  return (
    <section
      aria-labelledby="titulo-meu-ritmo"
      className="mt-3 w-full rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)] sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-2xl bg-ocre/15 p-3 text-ocre">
          <Target className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="titulo-meu-ritmo" className="font-display text-xl text-floresta">
            Meu ritmo
          </h2>
          <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
            Quantas práticas por semana fazem sentido para você agora.
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Diminuir meta semanal"
          disabled={atual <= META_MINIMA || mutacao.isPending}
          onClick={() => mutacao.mutate(limitarMeta(atual - 1))}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-floresta disabled:opacity-40"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <p
          aria-live="polite"
          className="min-w-0 flex-1 text-center font-display text-3xl leading-none text-floresta"
        >
          {atual}
          <span className="mt-1 block font-sans text-xs text-muted-foreground">
            prática{atual === 1 ? "" : "s"} / semana
          </span>
        </p>
        <button
          type="button"
          aria-label="Aumentar meta semanal"
          disabled={atual >= META_MAXIMA || mutacao.isPending}
          onClick={() => mutacao.mutate(limitarMeta(atual + 1))}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border text-floresta disabled:opacity-40"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="mt-4 break-words text-sm leading-relaxed text-muted-foreground">
        {rotuloMeta(atual)}
      </p>
    </section>
  );
}
