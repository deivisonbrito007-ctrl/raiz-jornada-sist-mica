import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  adminDefinirLembretesCliente,
  adminGetLembretesCliente,
} from "@/lib/lembretes.functions";
import { DIAS_SEMANA_NOME, PREFERENCIA_PADRAO, TIPO_LEMBRETE_LABEL } from "@/lib/lembretes";
import type { TipoLembrete } from "@/lib/lembretes";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ControlePermitido } from "@/components/permissao-ui";
import { formatarData } from "@/lib/raiz-format";
import { mensagemPainel } from "@/lib/erro-permissao";

/** Bloco "Lembretes" na tela do cliente no painel do terapeuta. */
export function LembretesClienteAdmin({ clienteId }: { clienteId: string }) {
  const queryClient = useQueryClient();
  const buscar = useServerFn(adminGetLembretesCliente);
  const definir = useServerFn(adminDefinirLembretesCliente);

  const { data } = useQuery({
    queryKey: ["admin-lembretes", clienteId],
    queryFn: () => buscar({ data: { clienteId } }),
  });

  const [form, setForm] = useState(PREFERENCIA_PADRAO);

  useEffect(() => {
    if (data?.preferencias) setForm({ ...PREFERENCIA_PADRAO, ...data.preferencias });
  }, [data?.preferencias]);

  const mutation = useMutation({
    mutationFn: (valores: typeof form) =>
      definir({
        data: {
          clienteId,
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
      toast.success("Lembretes atualizados para este cliente.");
      queryClient.invalidateQueries({ queryKey: ["admin-lembretes", clienteId] });
    },
    onError: (e) => toast.error(mensagemPainel(e)),
  });

  function aplicar(parcial: Partial<typeof form>) {
    const proximo = { ...form, ...parcial };
    setForm(proximo);
    mutation.mutate(proximo);
  }

  return (
    <section
      aria-labelledby="titulo-lembretes-cliente"
      className="mt-6 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]"
    >
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-salvia" aria-hidden="true" />
        <div>
          <h2 id="titulo-lembretes-cliente" className="text-lg text-floresta">
            Lembretes
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {data?.preferencias
              ? `Definido por ${data.preferencias.definido_por === "cliente" ? "este cliente" : "a equipe"}. O cliente pode desativar quando quiser.`
              : "O cliente ainda não configurou lembretes. Você pode sugerir um dia e horário."}
            {data ? ` ${data.dispositivosPush} dispositivo(s) com push ativo.` : ""}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        <label className="flex min-h-11 items-center justify-between gap-4 text-sm text-floresta">
          <span>Lembretes ativos</span>
          <ControlePermitido permissao="criar_planos">
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => aplicar({ ativo: v })}
              aria-label="Ativar lembretes para este cliente"
            />
          </ControlePermitido>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="admin-lembrete-dia"
              className="text-xs uppercase tracking-wider text-salvia"
            >
              Dia da semana
            </label>
            <ControlePermitido permissao="criar_planos">
              <Select
                value={String(form.dia_semana)}
                onValueChange={(v) => aplicar({ dia_semana: Number(v) })}
              >
                <SelectTrigger id="admin-lembrete-dia" className="mt-1 min-h-11 rounded-2xl">
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
            </ControlePermitido>
          </div>

          <div>
            <label
              htmlFor="admin-lembrete-hora"
              className="text-xs uppercase tracking-wider text-salvia"
            >
              Horário
            </label>
            <ControlePermitido permissao="criar_planos">
              <Select
                value={String(form.hora_local)}
                onValueChange={(v) => aplicar({ hora_local: Number(v) })}
              >
                <SelectTrigger id="admin-lembrete-hora" className="mt-1 min-h-11 rounded-2xl">
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
            </ControlePermitido>
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-lembrete-inatividade"
            className="text-xs uppercase tracking-wider text-salvia"
          >
            Avisar após dias sem praticar
          </label>
          <ControlePermitido permissao="criar_planos">
            <Select
              value={String(form.dias_inatividade)}
              onValueChange={(v) => aplicar({ dias_inatividade: Number(v) })}
            >
              <SelectTrigger
                id="admin-lembrete-inatividade"
                className="mt-1 min-h-11 rounded-2xl"
              >
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
          </ControlePermitido>
        </div>

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
