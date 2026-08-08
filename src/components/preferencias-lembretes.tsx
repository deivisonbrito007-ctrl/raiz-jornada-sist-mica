import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, BellOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  getMinhasPreferenciasLembretes,
  salvarMinhasPreferenciasLembretes,
} from "@/lib/lembretes.functions";
import { DIAS_SEMANA_NOME, PREFERENCIA_PADRAO, TIPO_LEMBRETE_LABEL } from "@/lib/lembretes";
import type { TipoLembrete } from "@/lib/lembretes";
import { usePushLembretes } from "@/hooks/use-push-lembretes";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarData } from "@/lib/raiz-format";

/** Seção "Lembretes" do perfil do cliente. */
export function PreferenciasLembretes() {
  const queryClient = useQueryClient();
  const buscar = useServerFn(getMinhasPreferenciasLembretes);
  const salvar = useServerFn(salvarMinhasPreferenciasLembretes);
  const push = usePushLembretes();

  const { data } = useQuery({
    queryKey: ["preferencias-lembretes"],
    queryFn: () => buscar(),
  });

  const [form, setForm] = useState(PREFERENCIA_PADRAO);

  useEffect(() => {
    if (data?.preferencias) setForm({ ...PREFERENCIA_PADRAO, ...data.preferencias });
  }, [data?.preferencias]);

  const mutation = useMutation({
    mutationFn: (valores: typeof form) =>
      salvar({
        data: {
          ativo: valores.ativo,
          canalPush: valores.canal_push,
          canalEmail: valores.canal_email,
          diaSemana: valores.dia_semana,
          horaLocal: valores.hora_local,
          fuso: valores.fuso,
          diasInatividade: valores.dias_inatividade,
        },
      }),
    onSuccess: () => {
      toast.success("Preferências de lembretes salvas.");
      queryClient.invalidateQueries({ queryKey: ["preferencias-lembretes"] });
    },
    onError: () => toast.error("Não foi possível salvar suas preferências."),
  });

  function aplicar(parcial: Partial<typeof form>) {
    const proximo = { ...form, ...parcial };
    setForm(proximo);
    mutation.mutate(proximo);
  }

  const fusoDetectado =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : PREFERENCIA_PADRAO.fuso;

  return (
    <section
      aria-labelledby="titulo-lembretes"
      className="mt-6 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]"
    >
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-salvia" aria-hidden="true" />
        <div>
          <h2 id="titulo-lembretes" className="text-lg text-floresta">
            Lembretes
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Avisos entre as sessões para você praticar e registrar sua reflexão.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <label className="flex min-h-11 items-center justify-between gap-4 text-sm text-floresta">
          <span>
            Receber lembretes
            <span className="mt-0.5 block text-xs text-muted-foreground">
              No máximo um lembrete por dia.
            </span>
          </span>
          <Switch
            checked={form.ativo}
            onCheckedChange={(v) => aplicar({ ativo: v, fuso: form.fuso || fusoDetectado })}
            aria-label="Receber lembretes de prática"
          />
        </label>

        <fieldset disabled={!form.ativo} className="space-y-5 disabled:opacity-60">
          <legend className="sr-only">Configurações dos lembretes</legend>

          <label className="flex min-h-11 items-center justify-between gap-4 text-sm text-floresta">
            <span>Notificação no dispositivo (push)</span>
            <Switch
              checked={form.canal_push}
              onCheckedChange={(v) => aplicar({ canal_push: v })}
              aria-label="Receber lembretes por notificação no dispositivo"
            />
          </label>

          <label className="flex min-h-11 items-center justify-between gap-4 text-sm text-floresta">
            <span>E-mail</span>
            <Switch
              checked={form.canal_email}
              onCheckedChange={(v) => aplicar({ canal_email: v })}
              aria-label="Receber lembretes por e-mail"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="lembrete-dia"
                className="text-xs uppercase tracking-wider text-salvia"
              >
                Dia da semana
              </label>
              <Select
                value={String(form.dia_semana)}
                onValueChange={(v) => aplicar({ dia_semana: Number(v) })}
              >
                <SelectTrigger id="lembrete-dia" className="mt-1 min-h-11 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA_NOME.map((nome, i) => (
                    <SelectItem key={nome} value={String(i)}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="lembrete-hora"
                className="text-xs uppercase tracking-wider text-salvia"
              >
                Horário
              </label>
              <Select
                value={String(form.hora_local)}
                onValueChange={(v) => aplicar({ hora_local: Number(v) })}
              >
                <SelectTrigger id="lembrete-hora" className="mt-1 min-h-11 rounded-2xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label
              htmlFor="lembrete-inatividade"
              className="text-xs uppercase tracking-wider text-salvia"
            >
              Avisar após dias sem praticar
            </label>
            <Select
              value={String(form.dias_inatividade)}
              onValueChange={(v) => aplicar({ dias_inatividade: Number(v) })}
            >
              <SelectTrigger id="lembrete-inatividade" className="mt-1 min-h-11 rounded-2xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5, 7, 10, 14].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} dias
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl bg-secondary p-4">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-salvia" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-sm text-floresta">Notificações neste dispositivo</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {push.estado === "ativado"
                    ? "Este dispositivo receberá os lembretes."
                    : push.estado === "bloqueado"
                      ? "As notificações estão bloqueadas nas configurações do navegador."
                      : push.estado === "indisponivel"
                        ? "Este navegador não suporta notificações. Você ainda recebe por e-mail e no app."
                        : "Ative para receber o aviso mesmo com o app fechado."}
                </p>
                {push.erro ? (
                  <p className="mt-1 text-xs text-destructive">{push.erro}</p>
                ) : null}
              </div>
            </div>
            {push.suportado && push.estado !== "bloqueado" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => (push.estado === "ativado" ? push.desativar() : push.ativar())}
                disabled={push.estado === "processando"}
                className="mt-3 min-h-11 w-full rounded-full border-floresta/20 text-floresta"
              >
                {push.estado === "ativado" ? (
                  <>
                    <BellOff className="mr-2 h-4 w-4" aria-hidden="true" />
                    Desativar neste dispositivo
                  </>
                ) : (
                  <>
                    <BellRing className="mr-2 h-4 w-4" aria-hidden="true" />
                    Ativar notificações neste dispositivo
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </fieldset>

        {(data?.ultimos ?? []).length > 0 ? (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-salvia">Últimos lembretes</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {(data?.ultimos ?? []).map((l, i) => (
                <li key={`${l.created_at}-${i}`}>
                  {TIPO_LEMBRETE_LABEL[l.tipo as TipoLembrete] ?? l.tipo} —{" "}
                  {formatarData(l.created_at)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
