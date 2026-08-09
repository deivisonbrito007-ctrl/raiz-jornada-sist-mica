import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  adminDefinirStatusAtribuicao,
  adminListarClientes,
  adminListarPlanos,
  adminSalvarPlano,
} from "@/lib/trilhas.functions";
import {
  NIVEL_LABEL,
  STATUS_ATRIBUICAO,
  STATUS_ATRIBUICAO_LABEL,
  type Nivel,
  type StatusAtribuicao,
} from "@/lib/etapas";
import {
  objetivoResumido,
  progressoPlano,
  statusClasse,
  statusEfetivo,
} from "@/lib/planos";
import { formatarData } from "@/lib/raiz-format";
import {
  AssistentePlano,
  type TrilhaDetalhe,
} from "@/components/painel/planos/assistente-plano";
import { planoVazio, type EstadoPlano } from "@/components/painel/planos/tipos";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  head: () => ({
    meta: [
      { title: "Planos de acompanhamento — Raiz" },
      {
        name: "description",
        content:
          "Crie e acompanhe planos personalizados: cliente, trilha, objetivo, frequência, prazo e revisão.",
      },
      { property: "og:title", content: "Planos de acompanhamento — Raiz" },
      {
        property: "og:description",
        content: "Orientação personalizada da terapeuta para cada cliente no Raiz.",
      },
    ],
  }),
  component: AdminPlanos,
});

function AdminPlanos() {
  const queryClient = useQueryClient();
  const carregarPlanos = useServerFn(adminListarPlanos);
  const carregarClientes = useServerFn(adminListarClientes);
  const salvar = useServerFn(adminSalvarPlano);
  const definirStatus = useServerFn(adminDefinirStatusAtribuicao);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-planos"],
    queryFn: () => carregarPlanos(),
  });
  const { data: dadosClientes } = useQuery({
    queryKey: ["admin-clientes"],
    queryFn: () => carregarClientes(),
  });

  const [assistenteAberto, setAssistenteAberto] = useState(false);
  const [inicial, setInicial] = useState<EstadoPlano | null>(null);
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | StatusAtribuicao>("todos");

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin-planos"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-clientes"] });
  };

  const mutSalvar = useMutation({
    mutationFn: salvar,
    onSuccess: () => {
      toast.success("Plano de acompanhamento salvo");
      setAssistenteAberto(false);
      setInicial(null);
      invalidar();
    },
    onError: () => toast.error("Não foi possível salvar o plano"),
  });

  const mutStatus = useMutation({
    mutationFn: definirStatus,
    onSuccess: () => {
      toast.success("Status atualizado");
      invalidar();
    },
    onError: () => toast.error("Não foi possível atualizar o status"),
  });

  const planos = data?.planos ?? [];
  const etapas = data?.etapas ?? [];
  const perfis = data?.perfis ?? [];
  const trilhas = (data?.trilhas ?? []) as TrilhaDetalhe[];
  const conteudos = data?.conteudos ?? [];

  const nomeDe = (id: string | null) => {
    if (!id) return "—";
    const p = perfis.find((x) => x.id === id);
    return p?.nome || p?.email || "—";
  };

  const clientesAssistente = (dadosClientes?.clientes ?? []).map((c) => ({
    id: c.id,
    nome: c.nome ?? "",
    email: c.email ?? "",
  }));

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return planos
      .map((p) => {
        const etapasDoPlano = etapas.filter((e) => e.atribuicao_id === p.id);
        return {
          plano: p,
          status: statusEfetivo(p),
          progresso: progressoPlano(etapasDoPlano),
          cliente: nomeDe(p.cliente_id),
          trilha: p.trilhas?.nome ?? "Trilha",
        };
      })
      .filter((l) => (statusFiltro === "todos" ? true : l.status === statusFiltro))
      .filter((l) =>
        termo ? `${l.cliente} ${l.trilha} ${l.plano.objetivo}`.toLowerCase().includes(termo) : true,
      );
  }, [busca, etapas, planos, statusFiltro, perfis]);

  function editar(planoId: string) {
    const p = planos.find((x) => x.id === planoId);
    if (!p) return;
    const etapasDoPlano = etapas
      .filter((e) => e.atribuicao_id === planoId)
      .sort((a, b) => a.ordem - b.ordem);
    setInicial({
      ...planoVazio(p.cliente_id),
      id: p.id,
      clienteId: p.cliente_id,
      trilhaId: p.trilha_id,
      objetivo: p.objetivo ?? "",
      motivoIndicacao: p.motivo_indicacao ?? "",
      mensagem: p.mensagem ?? "",
      audioPath: p.audio_path ?? null,
      orientacoesEspeciais: p.orientacoes_especiais ?? "",
      frequencia: p.frequencia,
      dataInicio: p.data_inicio,
      dataRevisao: p.data_revisao ?? "",
      lembretesAtivos: Boolean(p.lembretes_ativos),
      nivel: p.nivel as Nivel,
      podeSozinho: p.pode_sozinho,
      exigeAcompanhamento: p.exige_acompanhamento,
      somenteEmSessao: p.somente_em_sessao,
      permiteRepetir: p.permite_repetir,
      observacoes: p.observacoes ?? "",
      etapas: etapasDoPlano.map((e) => {
        const conteudo = conteudos.find((c) => c.id === e.conteudo_id);
        return {
          chave: e.id,
          conteudoId: e.conteudo_id,
          titulo: e.titulo_personalizado || conteudo?.titulo || "",
          descricao: e.descricao_personalizada || conteudo?.descricao || "",
          duracaoSegundos: conteudo?.duracao_segundos ?? 0,
          obrigatoria: e.obrigatoria,
          visivel: e.visivel,
          permiteRepetir: e.permite_repetir,
          prazoDias: e.prazo_dias ?? null,
          personalizada: !e.conteudo_id,
        };
      }),
    });
    setAssistenteAberto(true);
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-floresta">Planos de acompanhamento</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cada plano é a sua orientação para uma pessoa: trilha, objetivo, frequência, prazo e
            revisão. A escolha da trilha é sempre sua.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11 rounded-full"
          onClick={() => {
            setInicial(null);
            setAssistenteAberto(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Criar plano de acompanhamento
        </Button>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label className="text-xs text-muted-foreground" htmlFor="busca-planos">
            Buscar por cliente, trilha ou objetivo
          </label>
          <Input id="busca-planos" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground" htmlFor="filtro-status">
            Status
          </label>
          <select
            id="filtro-status"
            className="min-h-11 rounded-xl border border-border bg-card px-3 text-sm"
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value as "todos" | StatusAtribuicao)}
          >
            <option value="todos">Todos</option>
            {STATUS_ATRIBUICAO.map((s) => (
              <option key={s} value={s}>
                {STATUS_ATRIBUICAO_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <Skeleton className="h-48 rounded-3xl" />}

      {!isLoading && linhas.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border p-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Nenhum plano por aqui</p>
          <p className="mt-1">
            Crie o primeiro plano para combinar trilha, objetivo e ritmo com uma pessoa.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {linhas.map(({ plano, status, progresso, cliente, trilha }) => (
          <li key={plano.id} className="rounded-3xl border border-border bg-card p-5 shadow-organico">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-display text-lg text-floresta">{cliente}</p>
                <p className="text-sm text-foreground">{trilha}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {objetivoResumido(plano.objetivo ?? "")}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className={`rounded-full px-3 py-1 font-medium ${statusClasse(status)}`}>
                    {STATUS_ATRIBUICAO_LABEL[status]}
                  </span>
                  <span>{NIVEL_LABEL[plano.nivel as Nivel]}</span>
                  <span>Início {formatarData(plano.data_inicio)}</span>
                  <span>
                    Revisão {plano.data_revisao ? formatarData(plano.data_revisao) : "sem data"}
                  </span>
                  <span>Terapeuta: {nomeDe(plano.terapeuta_id)}</span>
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <div className="w-36">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>
                      {progresso.concluidas}/{progresso.total}
                    </span>
                    <span>{progresso.percentual}%</span>
                  </div>
                  <div
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-valuenow={progresso.percentual}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progresso do plano de ${cliente}`}
                  >
                    <div
                      className="h-full rounded-full bg-salvia"
                      style={{ width: `${progresso.percentual}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-full"
                    onClick={() => editar(plano.id)}
                  >
                    Editar
                  </Button>
                  <select
                    aria-label={`Ações do plano de ${cliente}`}
                    className="min-h-11 rounded-full border border-border bg-card px-3 text-sm"
                    value={plano.status}
                    onChange={(e) =>
                      mutStatus.mutate({
                        data: {
                          atribuicaoId: plano.id,
                          status: e.target.value as StatusAtribuicao,
                        },
                      })
                    }
                  >
                    {STATUS_ATRIBUICAO.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_ATRIBUICAO_LABEL[s]}
                      </option>
                    ))}
                  </select>
                  <Link
                    to="/admin/cliente/$clienteId"
                    params={{ clienteId: plano.cliente_id }}
                    className="inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm text-floresta hover:bg-secondary"
                  >
                    Ver cliente
                  </Link>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AssistentePlano
        aberto={assistenteAberto}
        aoFechar={() => {
          setAssistenteAberto(false);
          setInicial(null);
        }}
        clientes={clientesAssistente}
        trilhas={trilhas}
        conteudos={conteudos}
        planos={planos.map((p) => ({
          id: p.id,
          cliente_id: p.cliente_id,
          trilha_id: p.trilha_id,
          status: p.status as StatusAtribuicao,
          data_inicio: p.data_inicio,
          data_revisao: p.data_revisao,
          liberar_em: p.liberar_em,
        }))}
        inicial={inicial}
        salvando={mutSalvar.isPending}
        aoSalvar={(envio) => mutSalvar.mutate({ data: envio })}
      />
    </section>
  );
}
