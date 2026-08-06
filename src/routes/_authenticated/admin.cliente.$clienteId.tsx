import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
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

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cliente", clienteId],
    queryFn: () => fetchCliente({ data: { clienteId } }),
  });

  function recarregar() {
    queryClient.invalidateQueries({ queryKey: ["admin-cliente", clienteId] });
    queryClient.invalidateQueries({ queryKey: ["admin-resumo"] });
  }

  const liberado = (eixoId: string | null, conteudoId: string | null) =>
    (data?.liberacoes ?? []).some(
      (l) =>
        l.status === "liberado" &&
        (conteudoId ? l.conteudo_id === conteudoId : l.eixo_id === eixoId && l.conteudo_id === null),
    );

  async function alternar(
    args: { eixoId?: string | null; conteudoId?: string | null; titulo: string },
    liberar: boolean,
  ) {
    try {
      await definirLiberacao({
        data: {
          clienteId,
          eixoId: args.eixoId ?? null,
          conteudoId: args.conteudoId ?? null,
          liberar,
          titulo: args.titulo,
        },
      });
      recarregar();
      toast.success(liberar ? "Liberado para a cliente" : "Acesso recolhido");
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
                      data: { id: vinculo.id, statusPagamento: valor as "pendente" | "pago" | "cancelado" },
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
              Libere o eixo inteiro ou apenas práticas específicas. A cliente recebe um aviso.
            </p>

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
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-salvia">
                        Eixo completo
                        <Switch
                          checked={liberado(eixo.id, null)}
                          onCheckedChange={(v) =>
                            alternar({ eixoId: eixo.id, titulo: eixo.nome }, v)
                          }
                        />
                      </label>
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
                          <Switch
                            checked={liberado(null, conteudo.id) || liberado(eixo.id, null)}
                            disabled={liberado(eixo.id, null)}
                            onCheckedChange={(v) =>
                              alternar({ conteudoId: conteudo.id, titulo: conteudo.titulo }, v)
                            }
                          />
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
                <article key={entrada.id} className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]">
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
