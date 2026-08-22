import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellOff, BellRing, History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getHistoricoLembretes,
  getMinhasPreferenciasLembretes,
  pausarLembretes,
  salvarMinhasPreferenciasLembretes,
} from "@/lib/lembretes.functions";
import {
  DIAS_SEMANA_NOME,
  PAUSAS_LEMBRETE,
  PREFERENCIA_PADRAO,
  TIPO_LEMBRETE_LABEL,
  estaSilenciado,
  type TipoLembrete,
} from "@/lib/lembretes";
import { formatarData } from "@/lib/raiz-format";

export const Route = createFileRoute("/_authenticated/app/lembretes")({
  head: () => ({
    meta: [
      { title: "Lembretes e avisos — Raiz" },
      {
        name: "description",
        content:
          "Ajuste o dia e a hora do seu lembrete semanal, pause por um tempo e veja o histórico do que a Raiz já enviou para você.",
      },
      { property: "og:title", content: "Lembretes e avisos — Raiz" },
      {
        property: "og:description",
        content: "Seu ritmo, no seu tempo: lembretes semanais, pausa temporária e histórico.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CentralLembretes,
});

function CentralLembretes() {
  const queryClient = useQueryClient();
  const fetchPrefs = useServerFn(getMinhasPreferenciasLembretes);
  const fetchHistorico = useServerFn(getHistoricoLembretes);
  const salvar = useServerFn(salvarMinhasPreferenciasLembretes);
  const pausar = useServerFn(pausarLembretes);

  const { data } = useQuery({
    queryKey: ["preferencias-lembretes"],
    queryFn: () => fetchPrefs(),
  });
  const { data: historico } = useQuery({
    queryKey: ["historico-lembretes"],
    queryFn: () => fetchHistorico(),
  });

  const prefs = data?.preferencias ?? PREFERENCIA_PADRAO;
  const [form, setForm] = useState({
    ativo: prefs.ativo,
    canalPush: prefs.canal_push,
    canalEmail: prefs.canal_email,
    diaSemana: prefs.dia_semana,
    horaLocal: prefs.hora_local,
    diasInatividade: prefs.dias_inatividade,
  });

  useEffect(() => {
    if (!data?.preferencias) return;
    const p = data.preferencias;
    setForm({
      ativo: p.ativo,
      canalPush: p.canal_push,
      canalEmail: p.canal_email,
      diaSemana: p.dia_semana,
      horaLocal: p.hora_local,
      diasInatividade: p.dias_inatividade,
    });
  }, [data?.preferencias]);

  const silenciado = estaSilenciado(prefs);

  const mutSalvar = useMutation({
    mutationFn: () =>
      salvar({
        data: {
          ...form,
          fuso:
            Intl.DateTimeFormat().resolvedOptions().timeZone || PREFERENCIA_PADRAO.fuso,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["preferencias-lembretes"] });
      toast.success("Seu ritmo de lembretes foi guardado.");
    },
    onError: () => toast.error("Não foi possível salvar seus lembretes."),
  });

  const mutPausar = useMutation({
    mutationFn: (dias: number | null) => pausar({ data: { dias } }),
    onSuccess: async (_r, dias) => {
      await queryClient.invalidateQueries({ queryKey: ["preferencias-lembretes"] });
      toast.success(
        dias === null ? "Lembretes retomados." : `Silenciado por ${dias} dias. Nada será enviado.`,
      );
    },
    onError: () => toast.error("Não foi possível alterar a pausa."),
  });

  return (
    <div>
      <header className="rounded-[2rem] bg-floresta p-7 text-floresta-foreground">
        <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] opacity-80">
          Lembretes e avisos
        </p>
        <h1 className="mt-3 font-display text-3xl leading-tight">Seu ritmo, no seu tempo</h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed opacity-90">
          Um único lembrete por semana, no dia e na hora que você escolher. Pode pausar quando
          precisar — nada aqui cobra nada de você.
        </p>
      </header>

      <section
        aria-labelledby="titulo-pausa"
        className="mt-6 rounded-[2rem] bg-card p-6 shadow-organico"
      >
        <h2
          id="titulo-pausa"
          className="inline-flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia"
        >
          {silenciado ? (
            <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
          )}{" "}
          Pausa temporária
        </h2>
        <p aria-live="polite" className="mt-3 text-sm leading-relaxed text-foreground">
          {silenciado
            ? `Silenciado até ${formatarData(prefs.silenciado_ate ?? "")}.`
            : "Seus lembretes estão ativos conforme as preferências abaixo."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PAUSAS_LEMBRETE.map((dias) => (
            <Button
              key={dias}
              type="button"
              variant="secondary"
              className="min-h-11 rounded-full"
              disabled={mutPausar.isPending}
              onClick={() => mutPausar.mutate(dias)}
            >
              Pausar {dias} dias
            </Button>
          ))}
          {silenciado && (
            <Button
              type="button"
              className="min-h-11 rounded-full"
              disabled={mutPausar.isPending}
              onClick={() => mutPausar.mutate(null)}
            >
              Retomar agora
            </Button>
          )}
        </div>
      </section>

      <section
        aria-labelledby="titulo-ajustes"
        className="mt-6 rounded-[2rem] bg-card p-6 shadow-organico"
      >
        <h2
          id="titulo-ajustes"
          className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia"
        >
          Dia, hora e canais
        </h2>

        <div className="mt-5 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="lembretes-ativo" className="text-sm">
              Receber lembretes
            </Label>
            <Switch
              id="lembretes-ativo"
              checked={form.ativo}
              onCheckedChange={(v) => setForm({ ...form, ativo: v })}
            />
          </div>

          <div>
            <Label htmlFor="lembretes-dia">Dia da semana</Label>
            <select
              id="lembretes-dia"
              value={form.diaSemana}
              onChange={(e) => setForm({ ...form, diaSemana: Number(e.target.value) })}
              className="mt-2 min-h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm"
            >
              {DIAS_SEMANA_NOME.map((nome, indice) => (
                <option key={nome} value={indice}>
                  {nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="lembretes-hora">Hora: {String(form.horaLocal).padStart(2, "0")}h</Label>
            <input
              id="lembretes-hora"
              type="range"
              min={5}
              max={23}
              value={form.horaLocal}
              onChange={(e) => setForm({ ...form, horaLocal: Number(e.target.value) })}
              className="mt-2 h-11 w-full accent-terracota"
            />
          </div>

          <div>
            <Label htmlFor="lembretes-inatividade">
              Avisar depois de {form.diasInatividade} dias sem praticar
            </Label>
            <input
              id="lembretes-inatividade"
              type="range"
              min={2}
              max={14}
              value={form.diasInatividade}
              onChange={(e) => setForm({ ...form, diasInatividade: Number(e.target.value) })}
              className="mt-2 h-11 w-full accent-terracota"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="lembretes-push" className="text-sm">
              No celular (push)
            </Label>
            <Switch
              id="lembretes-push"
              checked={form.canalPush}
              onCheckedChange={(v) => setForm({ ...form, canalPush: v })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="lembretes-email" className="text-sm">
              Por e-mail
            </Label>
            <Switch
              id="lembretes-email"
              checked={form.canalEmail}
              onCheckedChange={(v) => setForm({ ...form, canalEmail: v })}
            />
          </div>
        </div>

        <Button
          className="mt-6 min-h-12 w-full rounded-full bg-terracota text-terracota-foreground hover:bg-terracota/90"
          disabled={mutSalvar.isPending}
          aria-busy={mutSalvar.isPending}
          onClick={() => mutSalvar.mutate()}
        >
          {mutSalvar.isPending ? "Guardando..." : "Guardar meu ritmo"}
        </Button>
      </section>

      <section
        aria-labelledby="titulo-historico"
        className="mt-6 rounded-[2rem] bg-card p-6 shadow-organico"
      >
        <h2
          id="titulo-historico"
          className="inline-flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia"
        >
          <History className="h-3.5 w-3.5" aria-hidden="true" /> Histórico
        </h2>
        {(historico ?? []).length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border p-5 text-sm leading-relaxed text-muted-foreground">
            Nenhum lembrete enviado até agora. Quando houver, tudo fica registrado aqui.
          </p>
        ) : (
          <ul className="mt-4 list-none space-y-3 p-0">
            {(historico ?? []).map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-secondary/50 p-4 text-sm"
              >
                <span className="text-foreground">
                  {TIPO_LEMBRETE_LABEL[item.tipo as TipoLembrete] ?? item.tipo}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatarData(item.created_at)} · {item.canal}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
