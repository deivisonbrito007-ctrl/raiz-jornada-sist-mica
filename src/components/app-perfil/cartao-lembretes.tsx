import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import {
  getMinhasPreferenciasLembretes,
  salvarMinhasPreferenciasLembretes,
} from "@/lib/lembretes.functions";
import { DIAS_SEMANA_NOME, PREFERENCIA_PADRAO, estaSilenciado } from "@/lib/lembretes";
import { formatarData } from "@/lib/raiz-format";

/**
 * Resumo dos lembretes no Perfil: uma frase de estado, o interruptor de
 * ligar/desligar e um único caminho para a Central, onde vivem os ajustes finos.
 */
export function CartaoLembretes() {
  const queryClient = useQueryClient();
  const buscar = useServerFn(getMinhasPreferenciasLembretes);
  const salvar = useServerFn(salvarMinhasPreferenciasLembretes);

  const { data } = useQuery({
    queryKey: ["preferencias-lembretes"],
    queryFn: () => buscar(),
  });

  const prefs = { ...PREFERENCIA_PADRAO, ...(data?.preferencias ?? {}) };
  const silenciado = estaSilenciado(prefs);

  const mutacao = useMutation({
    mutationFn: (ativo: boolean) =>
      salvar({
        data: {
          ativo,
          canalPush: prefs.canal_push,
          canalEmail: prefs.canal_email,
          diaSemana: prefs.dia_semana,
          horaLocal: prefs.hora_local,
          fuso:
            prefs.fuso ||
            (typeof Intl !== "undefined"
              ? Intl.DateTimeFormat().resolvedOptions().timeZone
              : PREFERENCIA_PADRAO.fuso),
          diasInatividade: prefs.dias_inatividade,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["preferencias-lembretes"] }),
    onError: () => toast.error("Não foi possível salvar seus lembretes agora."),
  });

  const ativo = mutacao.variables ?? prefs.ativo;

  const canais = [prefs.canal_push ? "no celular" : null, prefs.canal_email ? "por e-mail" : null]
    .filter(Boolean)
    .join(" e ");

  const frase = !ativo
    ? "Lembretes desligados. Você pratica no seu tempo."
    : silenciado
      ? `Em pausa até ${formatarData(prefs.silenciado_ate ?? "")}.`
      : `${DIAS_SEMANA_NOME[prefs.dia_semana] ?? ""}, ${String(prefs.hora_local).padStart(2, "0")}:00${canais ? ` — ${canais}` : ""}.`;

  return (
    <section
      aria-labelledby="titulo-lembretes"
      className="mt-3 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="shrink-0 rounded-2xl bg-salvia/15 p-3 text-salvia">
            <BellRing className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="titulo-lembretes" className="font-display text-xl text-floresta">
              Lembretes
            </h2>
            <p aria-live="polite" className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {frase}
            </p>
          </div>
        </div>
        <Switch
          checked={ativo}
          disabled={mutacao.isPending}
          onCheckedChange={(v) => mutacao.mutate(v)}
          aria-label="Receber lembretes de prática"
          className="mt-1 shrink-0"
        />
      </div>

      <Link
        to="/app/lembretes"
        className="mt-5 flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3 text-sm text-floresta transition-colors hover:bg-secondary/70"
      >
        <span className="min-w-0">
          Ajustar lembretes
          <span className="mt-0.5 block text-xs text-muted-foreground">
            dia, hora, canais, pausa e histórico
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </section>
  );
}
