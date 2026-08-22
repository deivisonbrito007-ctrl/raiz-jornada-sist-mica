import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CopyPlus, Unlock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadMidia } from "@/components/AdminConteudos/UploadMidia";
import {
  LinhaDoTempoPlano,
  type EventoTimeline,
} from "@/components/painel/monitoramento/linha-do-tempo-plano";
import { useMinhasPermissoes } from "@/hooks/use-minhas-permissoes";
import {
  adminAlterarPrazoRevisao,
  adminEnviarOrientacao,
  adminLiberarProximaEtapa,
  adminMarcarRevisao,
  adminMonitoramentoPlano,
} from "@/lib/monitoramento.functions";
import { STATUS_ATRIBUICAO_LABEL, type StatusAtribuicao } from "@/lib/etapas";
import { statusClasse } from "@/lib/planos";
import { percentualProgresso, situacaoRevisao, textoAutorrelato } from "@/lib/monitoramento";
import { formatarData } from "@/lib/raiz-format";

export const Route = createFileRoute("/_authenticated/admin/monitoramento/$atribuicaoId")({
  head: () => ({
    meta: [
      { title: "Plano em monitoramento — Raiz" },
      {
        name: "description",
        content:
          "Progresso etapa por etapa, registros da pessoa, revisões e ações de acompanhamento do plano.",
      },
      { property: "og:title", content: "Plano em monitoramento — Raiz" },
      {
        property: "og:description",
        content: "Acompanhe um plano liberado e responda com orientação ou devolutiva.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonitoramentoPlano,
});

const STATUS_ACAO: StatusAtribuicao[] = [
  "em_andamento",
  "aguardando_revisao",
  "pausado",
  "concluido",
  "encerrado",
];

function MonitoramentoPlano() {
  const { atribuicaoId } = Route.useParams();
  const queryClient = useQueryClient();
  const { pode } = useMinhasPermissoes();
  const podeAgir = pode("criar_planos");

  const carregar = useServerFn(adminMonitoramentoPlano);
  const enviarOrientacao = useServerFn(adminEnviarOrientacao);
  const alterarPrazo = useServerFn(adminAlterarPrazoRevisao);
  const liberarEtapa = useServerFn(adminLiberarProximaEtapa);
  const marcarRevisao = useServerFn(adminMarcarRevisao);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-monitoramento-plano", atribuicaoId],
    queryFn: () => carregar({ data: { atribuicaoId } }),
  });

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-monitoramento-plano", atribuicaoId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-monitoramento"] });
  };

  const [mensagem, setMensagem] = useState<string | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [prazo, setPrazo] = useState<string | null>(null);
  const [devolutiva, setDevolutiva] = useState("");
  const [proximaRevisao, setProximaRevisao] = useState("");
  const [novoStatus, setNovoStatus] = useState<StatusAtribuicao>("em_andamento");

  const mutOrientacao = useMutation({
    mutationFn: enviarOrientacao,
    onSuccess: () => {
      toast.success("Orientação enviada");
      invalidar();
    },
    onError: () => toast.error("Não foi possível enviar a orientação"),
  });
  const mutPrazo = useMutation({
    mutationFn: alterarPrazo,
    onSuccess: () => {
      toast.success("Prazo de revisão atualizado");
      invalidar();
    },
    onError: () => toast.error("Não foi possível alterar o prazo"),
  });
  const mutEtapa = useMutation({
    mutationFn: liberarEtapa,
    onSuccess: (resultado) => {
      if (resultado.ok) toast.success("Etapa liberada para o cliente");
      else toast.info("Todas as etapas já estão visíveis");
      invalidar();
    },
    onError: () => toast.error("Não foi possível liberar a etapa"),
  });
  const mutRevisao = useMutation({
    mutationFn: marcarRevisao,
    onSuccess: () => {
      toast.success("Revisão registrada");
      setDevolutiva("");
      invalidar();
    },
    onError: () => toast.error("Não foi possível registrar a revisão"),
  });

  const plano = data?.plano;
  const etapas = data?.etapas ?? [];
  const conteudos = data?.conteudos ?? [];
  const visiveis = etapas.filter((e) => e.visivel);
  const concluidas = visiveis.filter((e) => e.concluida_em);
  const percentual = percentualProgresso(concluidas.length, visiveis.length);
  const ocultas = etapas.filter((e) => !e.visivel);

  const tituloEtapa = (etapa: (typeof etapas)[number]) =>
    etapa.titulo_personalizado ||
    (etapa.conteudo_id ? conteudos.find((c) => c.id === etapa.conteudo_id)?.titulo : null) ||
    "Etapa do plano";

  const nomeDe = (id: string | null | undefined) => {
    if (!id) return "—";
    const p = (data?.perfis ?? []).find((x) => x.id === id);
    return p?.nome || p?.email || "—";
  };

  const eventos: EventoTimeline[] = useMemo(() => {
    const lista: EventoTimeline[] = [];
    for (const e of etapas) {
      if (!e.concluida_em) continue;
      lista.push({
        id: `etapa-${e.id}`,
        quando: e.concluida_em,
        tipo: "etapa",
        titulo: tituloEtapa(e),
      });
    }
    for (const c of data?.checkins ?? []) {
      lista.push({
        id: `checkin-${c.id}`,
        quando: c.created_at,
        tipo: "checkin",
        titulo: `${c.momento === "inicial" ? "Check-in" : "Check-out"}: ${
          c.emocao || "sem nome dado"
        }`,
        detalhe: [
          textoAutorrelato(c.intensidade),
          c.local_corpo ? `no corpo: ${c.local_corpo}` : null,
          c.aprendizado ? `aprendizado: ${c.aprendizado}` : null,
          c.precisa_contato ? "pediu contato" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
    for (const r of data?.revisoes ?? []) {
      lista.push({
        id: `revisao-${r.id}`,
        quando: r.created_at,
        tipo: "revisao",
        titulo: r.devolutiva?.trim() ? "Revisão com devolutiva" : "Revisão aguardando devolutiva",
        detalhe: [r.estado_atual, r.aprendizados, r.devolutiva].filter(Boolean).join("\n"),
      });
    }
    for (const s of data?.apoio ?? []) {
      lista.push({
        id: `apoio-${s.id}`,
        quando: s.created_at,
        tipo: "apoio",
        titulo: `Pedido de contato (${s.status})`,
        detalhe: s.mensagem,
      });
    }
    return lista.sort((a, b) => Date.parse(b.quando) - Date.parse(a.quando));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapas, conteudos, data?.checkins, data?.revisoes, data?.apoio]);

  if (isLoading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Carregando o plano...
      </p>
    );
  }
  if (isError || !plano) {
    return (
      <p role="alert" className="text-sm text-terracota">
        Não foi possível abrir este plano agora.
      </p>
    );
  }

  const revisao = situacaoRevisao(plano.data_revisao);
  const mensagemAtual = mensagem ?? plano.mensagem ?? "";
  const audioAtual = audioPath ?? plano.audio_path ?? null;
  const prazoAtual = prazo ?? plano.data_revisao ?? "";

  return (
    <section className="space-y-6">
      <Link
        to="/admin/monitoramento"
        className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
        Voltar ao monitoramento
      </Link>

      <header className="rounded-3xl border border-border bg-card p-5 shadow-organico">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl text-floresta">{nomeDe(plano.cliente_id)}</h1>
            <p className="text-sm text-muted-foreground">
              {plano.trilhas?.nome ?? "Trilha"} · terapeuta {nomeDe(plano.terapeuta_id)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasse(
              plano.status as StatusAtribuicao,
            )}`}
          >
            {STATUS_ATRIBUICAO_LABEL[plano.status as StatusAtribuicao]}
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {concluidas.length} de {visiveis.length} etapas concluídas
            </span>
            <span>{percentual}%</span>
          </div>
          <Progress value={percentual} className="mt-1 h-2" />
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Objetivo combinado</dt>
            <dd className="text-foreground">{plano.objetivo || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Início</dt>
            <dd className="text-foreground">{formatarData(plano.data_inicio)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Próxima revisão</dt>
            <dd className="text-foreground">
              {plano.data_revisao
                ? `${formatarData(plano.data_revisao)}${revisao === "vencida" ? " · vencida" : ""}`
                : "Sem data marcada"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Frequência sugerida</dt>
            <dd className="text-foreground">{plano.frequencia || "—"}</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
            <h2 className="font-display text-lg text-floresta">Etapas do plano</h2>
            <ol className="mt-4 space-y-2">
              {etapas.map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-secondary px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{tituloEtapa(e)}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.obrigatoria ? "Obrigatória" : "Opcional"}
                      {e.visivel ? "" : " · ainda oculta para o cliente"}
                      {e.concluida_em ? ` · concluída em ${formatarData(e.concluida_em)}` : ""}
                    </p>
                  </div>
                  {podeAgir && !e.visivel && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 rounded-full"
                      disabled={mutEtapa.isPending}
                      onClick={() => mutEtapa.mutate({ data: { atribuicaoId, etapaId: e.id } })}
                    >
                      <Unlock className="mr-2 h-4 w-4" aria-hidden />
                      Liberar
                    </Button>
                  )}
                </li>
              ))}
            </ol>
            {podeAgir && ocultas.length > 0 && (
              <Button
                type="button"
                className="mt-4 min-h-11 rounded-full"
                disabled={mutEtapa.isPending}
                onClick={() => mutEtapa.mutate({ data: { atribuicaoId } })}
              >
                Liberar próxima etapa
              </Button>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
            <h2 className="font-display text-lg text-floresta">Linha do tempo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Somente o que a pessoa registrou, com as palavras dela.
            </p>
            <div className="mt-4">
              <LinhaDoTempoPlano eventos={eventos} />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
            <h2 className="font-display text-lg text-floresta">Registros compartilhados</h2>
            {!data?.podeVerDiario ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Você não tem permissão para ver registros do diário.
              </p>
            ) : (data?.registrosCompartilhados ?? []).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nada compartilhado. O diário só aparece aqui quando a pessoa escolhe compartilhar.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {(data?.registrosCompartilhados ?? []).map((r) => (
                  <li key={r.id} className="rounded-2xl bg-secondary p-4">
                    <p className="text-xs text-muted-foreground">{formatarData(r.created_at)}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-foreground">{r.texto}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
            <h2 className="font-display text-lg text-floresta">Enviar orientação</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Um recado em texto e, se quiser, um áudio curto de acolhimento.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(evento) => {
                evento.preventDefault();
                mutOrientacao.mutate({
                  data: {
                    atribuicaoId,
                    mensagem: mensagemAtual,
                    audioPath: audioAtual,
                    avisarCliente: true,
                  },
                });
              }}
            >
              <div>
                <Label htmlFor="orientacao">Mensagem</Label>
                <Textarea
                  id="orientacao"
                  rows={4}
                  value={mensagemAtual}
                  disabled={!podeAgir}
                  onChange={(e) => setMensagem(e.target.value)}
                />
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">Áudio (opcional)</span>
                <div className="mt-2">
                  <UploadMidia
                    eixoId={plano.trilha_id}
                    variante="midia"
                    accept="audio/*"
                    caminhoAtual={audioAtual}
                    onEnviado={(caminho) => setAudioPath(caminho)}
                    onRemover={() => setAudioPath(null)}
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="min-h-11 rounded-full"
                disabled={!podeAgir || mutOrientacao.isPending}
              >
                Enviar orientação
              </Button>
              {!podeAgir && (
                <p className="text-xs text-muted-foreground">
                  Você pode acompanhar, mas não tem permissão para enviar orientações.
                </p>
              )}
            </form>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
            <h2 className="font-display text-lg text-floresta">Prazo de revisão</h2>
            <form
              className="mt-3 flex flex-wrap items-end gap-3"
              onSubmit={(evento) => {
                evento.preventDefault();
                mutPrazo.mutate({
                  data: { atribuicaoId, dataRevisao: prazoAtual ? prazoAtual : null },
                });
              }}
            >
              <div>
                <Label htmlFor="prazo-revisao">Nova data</Label>
                <Input
                  id="prazo-revisao"
                  type="date"
                  className="min-h-11"
                  value={prazoAtual}
                  disabled={!podeAgir}
                  onChange={(e) => setPrazo(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="min-h-11 rounded-full"
                disabled={!podeAgir || mutPrazo.isPending}
              >
                Atualizar prazo
              </Button>
            </form>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
            <h2 className="font-display text-lg text-floresta">Registrar revisão</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Deixe sua devolutiva e defina como o plano segue: continuar, pausar, concluir ou
              encerrar.
            </p>
            <form
              className="mt-4 space-y-3"
              onSubmit={(evento) => {
                evento.preventDefault();
                mutRevisao.mutate({
                  data: {
                    atribuicaoId,
                    devolutiva,
                    proximaRevisao: proximaRevisao || null,
                    status: novoStatus as
                      | "em_andamento"
                      | "aguardando_revisao"
                      | "pausado"
                      | "concluido"
                      | "encerrado",
                  },
                });
              }}
            >
              <div>
                <Label htmlFor="devolutiva">Devolutiva para a pessoa</Label>
                <Textarea
                  id="devolutiva"
                  rows={4}
                  value={devolutiva}
                  disabled={!podeAgir}
                  onChange={(e) => setDevolutiva(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="proxima-revisao">Próxima revisão</Label>
                  <Input
                    id="proxima-revisao"
                    type="date"
                    className="min-h-11"
                    value={proximaRevisao}
                    disabled={!podeAgir}
                    onChange={(e) => setProximaRevisao(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="novo-status">Situação do plano</Label>
                  <Select
                    value={novoStatus}
                    onValueChange={(v) => setNovoStatus(v as StatusAtribuicao)}
                  >
                    <SelectTrigger id="novo-status" className="min-h-11" disabled={!podeAgir}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_ACAO.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_ATRIBUICAO_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="submit"
                className="min-h-11 rounded-full"
                disabled={!podeAgir || mutRevisao.isPending}
              >
                Salvar revisão
              </Button>
            </form>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-organico">
            <h2 className="font-display text-lg text-floresta">Renovar ou continuar</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Para propor um novo ciclo, crie um plano a partir deste em Planos de acompanhamento.
            </p>
            <Link
              to="/admin/clientes"
              className="mt-4 inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-medium text-foreground transition hover:border-floresta/40"
            >
              <CopyPlus className="mr-2 h-4 w-4" aria-hidden />
              Ir para Planos de acompanhamento
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
