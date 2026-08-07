import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  adminAtualizarPagamento,
  adminDefinirLiberacao,
  adminGetCliente,
  adminVincularPacote,
} from "@/lib/raiz.functions";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatarData, PAGAMENTO_LABEL, TIPO_LABEL } from "@/lib/raiz-format";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/cliente/$clienteId")({
  component: AdminCliente,
});

function AdminCliente() {
  const { clienteId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchCliente = useServerFn(adminGetCliente);
  const definirLiberacao = useServerFn(adminDefinirLiberacao);
  const vincularPacote = useServerFn(adminVincularPacote);
  const atualizarPagamento = useServerFn(adminAtualizarPagamento);
  const [pacoteSelecionado, setPacoteSelecionado] = useState("");
  const [motivoLiberacao, setMotivoLiberacao] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cliente", clienteId],
    queryFn: () => fetchCliente({ data: { clienteId } }),
  });

  function recarregar() {
    queryClient.invalidateQueries({ queryKey: ["admin-cliente", clienteId] });
    queryClient.invalidateQueries({ queryKey: ["admin-resumo"] });
  }

  const registro = (eixoId: string | null, conteudoId: string | null) =>
    (data?.liberacoes ?? []).find(
      (l) =>
        l.status === "liberado" &&
        (conteudoId
          ? l.conteudo_id === conteudoId
          : l.eixo_id === eixoId && l.conteudo_id === null),
    );

  const agendamento = (eixoId: string | null, conteudoId: string | null) => {
    const reg = registro(eixoId, conteudoId);
    if (!reg?.liberar_em) return null;
    return new Date(reg.liberar_em) > new Date() ? reg.liberar_em : null;
  };

  const liberado = (eixoId: string | null, conteudoId: string | null) => {
    const reg = registro(eixoId, conteudoId);
    return Boolean(reg) && !agendamento(eixoId, conteudoId);
  };

  const marcado = (eixoId: string | null, conteudoId: string | null) =>
    Boolean(registro(eixoId, conteudoId));

  async function alternar(
    args: { eixoId?: string | null; conteudoId?: string | null; titulo: string },
    liberar: boolean,
    liberarEm?: string | null,
  ) {
    try {
      await definirLiberacao({
        data: {
          clienteId,
          eixoId: args.eixoId ?? null,
          conteudoId: args.conteudoId ?? null,
          liberar,
          titulo: args.titulo,
          liberarEm: liberarEm ?? null,
          motivo: motivoLiberacao,
        },
      });
      recarregar();
      toast.success(
        !liberar
          ? "Acesso recolhido"
          : liberarEm
            ? `Agendado para ${formatarData(liberarEm)}`
            : "Liberado para a cliente",
      );
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar");
    }
  }

  const statusProgresso = (conteudoId: string) =>
    (data?.progresso ?? []).find((p) => p.conteudo_id === conteudoId)?.status ?? "nao_iniciado";

  const vinculo = (data?.vinculos ?? [])[0];

  return (
    <div>
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-floresta"
      >
        <ArrowLeft className="h-4 w-4" /> Clientes
      </Link>

      {isLoading && <Skeleton className="mt-6 h-64 rounded-3xl" />}

      {data?.perfil && (
        <>
          <h1 className="mt-4 text-3xl text-floresta">{data.perfil.nome ?? data.perfil.email}</h1>
          <p className="text-sm text-muted-foreground">
            {data.perfil.email} · desde {formatarData(data.perfil.created_at)}
          </p>

          <section className="mt-8 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
            <h2 className="text-xl text-floresta">Pacote e pagamento</h2>
            {vinculo ? (
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <p className="text-sm text-floresta">
                  {(data.pacotes ?? []).find((p) => p.id === vinculo.pacote_id)?.nome ?? "Pacote"}
                </p>
                <Select
                  value={vinculo.status_pagamento}
                  onValueChange={async (valor) => {
                    await atualizarPagamento({
                      data: {
                        id: vinculo.id,
                        statusPagamento: valor as "pendente" | "pago" | "cancelado",
                      },
                    });
                    recarregar();
                  }}
                >
                  <SelectTrigger className="w-56 rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAGAMENTO_LABEL).map(([valor, label]) => (
                      <SelectItem key={valor} value={valor}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Select value={pacoteSelecionado} onValueChange={setPacoteSelecionado}>
                  <SelectTrigger className="w-64 rounded-full">
                    <SelectValue placeholder="Escolher pacote" />
                  </SelectTrigger>
                  <SelectContent>
                    {(data.pacotes ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!pacoteSelecionado}
                  onClick={async () => {
                    await vincularPacote({ data: { clienteId, pacoteId: pacoteSelecionado } });
                    setPacoteSelecionado("");
                    recarregar();
                    toast.success("Pacote vinculado");
                  }}
                  className="rounded-full bg-terracota text-terracota-foreground hover:bg-terracota/90"
                >
                  Vincular
                </Button>
              </div>
            )}
          </section>

          <section className="mt-6">
            <h2 className="text-xl text-floresta">Liberação de conteúdo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Libere o eixo inteiro ou apenas práticas específicas — agora ou em uma data futura. A
              cliente recebe o aviso quando o conteúdo abrir.
            </p>

            <div className="mt-4 max-w-md">
              <label
                htmlFor="motivo-liberacao"
                className="text-xs text-muted-foreground"
              >
                Motivo das mudanças de acesso (registrado no histórico)
              </label>
              <input
                id="motivo-liberacao"
                value={motivoLiberacao}
                onChange={(e) => setMotivoLiberacao(e.target.value)}
                placeholder="Ex.: concluiu o eixo anterior"
                maxLength={300}
                className="mt-1 w-full rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground outline-none focus:border-salvia"
              />
            </div>

            <div className="mt-5 space-y-4">
              {data.eixos.map((eixo) => {
                const conteudos = data.conteudos.filter((c) => c.eixo_id === eixo.id);
                return (
                  <div
                    key={eixo.id}
                    className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg text-floresta">{eixo.nome}</h3>
                        <p className="text-xs text-muted-foreground">
                          {conteudos.length} prática(s)
                          {agendamento(eixo.id, null)
                            ? ` · abre em ${formatarData(agendamento(eixo.id, null))}`
                            : liberado(eixo.id, null)
                              ? " · liberado"
                              : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <label className="flex items-center gap-2 text-xs text-salvia">
                          Eixo completo
                          <Switch
                            checked={marcado(eixo.id, null)}
                            onCheckedChange={(v) =>
                              alternar({ eixoId: eixo.id, titulo: eixo.nome }, v)
                            }
                          />
                        </label>
                        <Agendador
                          agendadoPara={agendamento(eixo.id, null)}
                          onAgendar={(quando) =>
                            alternar({ eixoId: eixo.id, titulo: eixo.nome }, true, quando)
                          }
                        />
                      </div>
                    </div>

                    <ul className="mt-4 space-y-2">
                      {conteudos.map((conteudo) => (
                        <li
                          key={conteudo.id}
                          className="flex items-center justify-between gap-4 rounded-2xl bg-secondary px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-floresta">
                              {conteudo.titulo}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {TIPO_LABEL[conteudo.tipo] ?? conteudo.tipo} ·{" "}
                              {statusProgresso(conteudo.id) === "concluido"
                                ? "concluído"
                                : statusProgresso(conteudo.id) === "em_andamento"
                                  ? "em andamento"
                                  : "não iniciado"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Switch
                              checked={marcado(null, conteudo.id) || marcado(eixo.id, null)}
                              disabled={marcado(eixo.id, null)}
                              onCheckedChange={(v) =>
                                alternar({ conteudoId: conteudo.id, titulo: conteudo.titulo }, v)
                              }
                            />
                            {!marcado(eixo.id, null) && (
                              <Agendador
                                agendadoPara={agendamento(null, conteudo.id)}
                                onAgendar={(quando) =>
                                  alternar(
                                    { conteudoId: conteudo.id, titulo: conteudo.titulo },
                                    true,
                                    quando,
                                  )
                                }
                              />
                            )}
                          </div>
                        </li>
                      ))}
                      {conteudos.length === 0 && (
                        <li className="text-xs text-muted-foreground">
                          Nenhuma prática cadastrada neste eixo.
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xl text-floresta">Diário da cliente</h2>
            <div className="mt-4 space-y-3">
              {data.diario.length === 0 && (
                <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
                  Nenhuma reflexão registrada ainda.
                </p>
              )}
              {data.diario.map((entrada) => (
                <article
                  key={entrada.id}
                  className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]"
                >
                  <p className="text-xs text-salvia">
                    {formatarData(entrada.created_at)}
                    {entrada.conteudos?.titulo ? ` · ${entrada.conteudos.titulo}` : ""}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">
                    {entrada.texto}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Agendador({
  agendadoPara,
  onAgendar,
}: {
  agendadoPara: string | null;
  onAgendar: (quando: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState("");

  if (agendadoPara && !aberto) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-terracota">
        <CalendarClock className="h-3.5 w-3.5" />
        <span>Abre em {formatarData(agendadoPara)}</span>
        <button
          type="button"
          onClick={() => onAgendar(null)}
          className="underline hover:text-floresta"
        >
          liberar agora
        </button>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="underline hover:text-floresta"
        >
          mudar data
        </button>
      </div>
    );
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground underline hover:text-floresta"
      >
        <CalendarClock className="h-3.5 w-3.5" /> Programar data
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="datetime-local"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="rounded-full border border-border bg-card px-3 py-1 text-[11px] text-floresta"
      />
      <Button
        size="sm"
        disabled={!valor}
        onClick={() => {
          const data = new Date(valor);
          if (Number.isNaN(data.getTime())) return;
          onAgendar(data.toISOString());
          setAberto(false);
          setValor("");
        }}
        className="h-7 rounded-full bg-terracota px-3 text-[11px] text-terracota-foreground hover:bg-terracota/90"
      >
        Agendar
      </Button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="text-[11px] text-muted-foreground underline"
      >
        cancelar
      </button>
    </div>
  );
}
