import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { BellRing, Check } from "lucide-react";
import { toast } from "sonner";

import {
  getMinhasPreferenciasLembretes,
  salvarMinhasPreferenciasLembretes,
} from "@/lib/lembretes.functions";
import { DIAS_SEMANA_NOME, PREFERENCIA_PADRAO } from "@/lib/lembretes";
import { usePushLembretes } from "@/hooks/use-push-lembretes";
import { Button } from "@/components/ui/button";

const CHAVE_DISPENSADO = "raiz:convite-lembrete-semanal-dispensado";

/**
 * Convite discreto no Início para ligar o lembrete semanal com um toque.
 *
 * Um toque já grava a preferência (dia e horário suaves) e, quando o
 * navegador permite, inscreve este dispositivo no push. Ajustes finos
 * continuam no Perfil.
 */
export function ConviteLembreteSemanal() {
  const queryClient = useQueryClient();
  const buscar = useServerFn(getMinhasPreferenciasLembretes);
  const salvar = useServerFn(salvarMinhasPreferenciasLembretes);
  const push = usePushLembretes();

  const [dispensado, setDispensado] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(CHAVE_DISPENSADO) === "1",
  );

  const { data } = useQuery({
    queryKey: ["preferencias-lembretes"],
    queryFn: () => buscar(),
    staleTime: 60_000,
  });

  const fuso =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : PREFERENCIA_PADRAO.fuso;

  const ativar = useMutation({
    mutationFn: async () => {
      await salvar({
        data: {
          ativo: true,
          canalPush: true,
          canalEmail: true,
          diaSemana: PREFERENCIA_PADRAO.dia_semana,
          horaLocal: PREFERENCIA_PADRAO.hora_local,
          fuso: fuso || PREFERENCIA_PADRAO.fuso,
          diasInatividade: PREFERENCIA_PADRAO.dias_inatividade,
        },
      });
      if (push.suportado && push.estado !== "ativado" && push.estado !== "bloqueado") {
        await push.ativar();
      }
    },
    onSuccess: () => {
      toast.success("Combinado. Um lembrete suave por semana, no seu ritmo.");
      queryClient.invalidateQueries({ queryKey: ["preferencias-lembretes"] });
    },
    onError: () => toast.error("Não foi possível ativar os lembretes agora."),
  });

  if (!data || data.preferencias?.ativo || dispensado) return null;

  const dia = DIAS_SEMANA_NOME[PREFERENCIA_PADRAO.dia_semana];
  const hora = `${String(PREFERENCIA_PADRAO.hora_local).padStart(2, "0")}:00`;

  return (
    <section
      aria-labelledby="titulo-convite-lembrete"
      className="mt-6 rounded-[2rem] bg-secondary p-6 shadow-[var(--shadow-organico)]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-floresta/10 text-floresta"
        >
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id="titulo-convite-lembrete" className="text-lg text-floresta">
            Quer um toque suave por semana?
          </h2>

          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Um único aviso na {dia?.toLowerCase()} às {hora}, no seu horário, para você voltar à
            prática sem pressa. Nada de cobranças diárias.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          onClick={() => ativar.mutate()}
          disabled={ativar.isPending}
          className="min-h-11 flex-1 rounded-full bg-floresta text-floresta-foreground hover:bg-floresta/90"
        >
          <Check className="mr-2 h-4 w-4" aria-hidden="true" />
          {ativar.isPending ? "Ativando…" : "Ativar lembrete semanal"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            window.localStorage.setItem(CHAVE_DISPENSADO, "1");
            setDispensado(true);
          }}
          className="min-h-11 rounded-full text-muted-foreground"
        >
          Agora não
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Dia, horário e canais podem ser ajustados no{" "}
        <Link to="/app/perfil" className="underline underline-offset-2">
          seu perfil
        </Link>
        .
      </p>
    </section>
  );
}
