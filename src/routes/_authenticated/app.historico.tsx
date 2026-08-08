import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle, PlayCircle, NotebookPen, ChevronDown } from "lucide-react";
import { getMeuHistorico } from "@/lib/raiz.functions";
import { TIPO_LABEL, formatarDuracao, formatarData } from "@/lib/raiz-format";
import { Skeleton } from "@/components/ui/skeleton";
import { useSincronizarLiberacoes } from "@/hooks/use-sincronizar-liberacoes";

export const Route = createFileRoute("/_authenticated/app/historico")({
  head: () => ({
    meta: [
      { title: "Meu histórico — Raiz" },
      {
        name: "description",
        content:
          "Veja tudo o que já foi liberado para você, o que concluiu e as reflexões que escreveu, trilha por trilha.",
      },
      { property: "og:title", content: "Meu histórico — Raiz" },
      {
        property: "og:description",
        content: "Práticas liberadas, concluídas e reflexões organizadas por trilha.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Historico,
});

type Estado = "todas" | "concluidas" | "pendentes";

const ESTADOS: { valor: Estado; label: string }[] = [
  { valor: "todas", label: "Todas" },
  { valor: "concluidas", label: "Concluídas" },
  { valor: "pendentes", label: "Pendentes" },
];

function Historico() {
  useSincronizarLiberacoes();
  const fetchHistorico = useServerFn(getMeuHistorico);
  const { data, isLoading } = useQuery({
    queryKey: ["historico"],
    queryFn: () => fetchHistorico(),
  });

  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState<Estado>("todas");
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});

  const termo = busca.trim().toLowerCase();

  const trilhas = useMemo(() => {
    return (data?.trilhas ?? [])
      .map((trilha) => ({
        ...trilha,
        praticas: trilha.praticas.filter((pratica) => {
          const combinaEstado =
            estado === "todas" ||
            (estado === "concluidas" && pratica.status === "concluido") ||
            (estado === "pendentes" && pratica.status !== "concluido");
          if (!combinaEstado) return false;
          if (!termo) return true;
          return (
            pratica.titulo.toLowerCase().includes(termo) ||
            trilha.nome.toLowerCase().includes(termo) ||
            pratica.reflexoes.some((r) => r.texto.toLowerCase().includes(termo))
          );
        }),
      }))
      .filter((trilha) => trilha.praticas.length > 0);
  }, [data?.trilhas, estado, termo]);

  const reflexoesGerais = (data?.reflexoesGerais ?? []).filter(
    (r) => !termo || r.texto.toLowerCase().includes(termo),
  );

  const encontradas = trilhas.reduce((soma, t) => soma + t.praticas.length, 0);
  const filtrando = Boolean(termo) || estado !== "todas";

  return (
    <div>
      <h1 className="text-3xl text-floresta">Meu histórico</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Tudo o que já foi liberado para você, o que você concluiu e as reflexões que escreveu ao
        longo do caminho.
      </p>

      <p aria-live="polite" role="status" className="sr-only">
        {filtrando
          ? `${encontradas} prática${encontradas === 1 ? "" : "s"} ${
              encontradas === 1 ? "encontrada" : "encontradas"
            }.`
          : ""}
      </p>

      {isLoading && <Skeleton className="mt-7 h-40 rounded-3xl" />}

      {data && (
        <div className="mt-7 rounded-3xl bg-floresta p-7 text-floresta-foreground">
          <p className="text-sm text-floresta-foreground/70">Práticas concluídas</p>
          <p className="mt-1 font-display text-5xl">
            {data.resumo.totalConcluidos}
            <span className="text-2xl text-floresta-foreground/50">/{data.resumo.totalItens}</span>
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-floresta-foreground/20">
            <div
              className="h-full rounded-full bg-ocre"
              style={{ width: `${data.resumo.percentual}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-floresta-foreground/60">
            {data.resumo.totalReflexoes} reflexão
            {data.resumo.totalReflexoes === 1 ? "" : "ões"} no diário
            {data.resumo.ultimaConclusao
              ? ` · última conclusão em ${formatarData(data.resumo.ultimaConclusao)}`
              : ""}
          </p>
        </div>
      )}

      <section aria-labelledby="titulo-filtros-historico" className="mt-5">
        <h2 id="titulo-filtros-historico" className="sr-only">
          Filtrar histórico
        </h2>
        <label htmlFor="busca-historico" className="sr-only">
          Buscar por prática, trilha ou reflexão
        </label>
        <input
          id="busca-historico"
          type="search"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          placeholder="Buscar prática, trilha ou reflexão"
          className="min-h-11 w-full rounded-full border border-border bg-card px-5 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <div role="group" aria-label="Estado da prática" className="mt-3 flex flex-wrap gap-2">
          {ESTADOS.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              aria-pressed={estado === opcao.valor}
              onClick={() => setEstado(opcao.valor)}
              className={`min-h-11 rounded-full px-5 text-sm transition ${
                estado === opcao.valor
                  ? "bg-floresta text-floresta-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-floresta"
              }`}
            >
              {opcao.label}
            </button>
          ))}
        </div>
      </section>

      {data && trilhas.length === 0 && (
        <p className="mt-7 rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          {filtrando ? (
            "Nenhuma prática encontrada com esses filtros."
          ) : (
            <>
              Ainda não há práticas liberadas no seu histórico.{" "}
              <Link to="/app" className="underline">
                Ver minha biblioteca
              </Link>
              .
            </>
          )}
        </p>
      )}

      {trilhas.map((trilha) => {
        const percentual = trilha.total ? Math.round((trilha.concluidos / trilha.total) * 100) : 0;
        return (
          <section
            key={trilha.id}
            aria-labelledby={`trilha-${trilha.id}`}
            className="mt-7 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]"
          >
            <h2 id={`trilha-${trilha.id}`} className="text-xl text-floresta">
              {trilha.nome}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {trilha.concluidos} de {trilha.total} concluída
              {trilha.total === 1 ? "" : "s"}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-salvia" style={{ width: `${percentual}%` }} />
            </div>

            <ul className="mt-5 space-y-3">
              {trilha.praticas.map((pratica) => {
                const aberta = Boolean(abertas[pratica.id]);
                return (
                  <li key={pratica.id} className="rounded-2xl border border-border p-4">
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 pt-0.5">
                        {pratica.status === "concluido" ? (
                          <CheckCircle2 className="h-5 w-5 text-salvia" aria-hidden="true" />
                        ) : pratica.status === "em_andamento" ? (
                          <PlayCircle className="h-5 w-5 text-terracota" aria-hidden="true" />
                        ) : (
                          <Circle className="h-5 w-5 text-border" aria-hidden="true" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-salvia">
                          {TIPO_LABEL[pratica.tipo] ?? pratica.tipo} ·{" "}
                          {formatarDuracao(pratica.duracaoSegundos)}
                        </p>
                        <p className="mt-0.5 font-medium text-floresta">{pratica.titulo}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pratica.status === "concluido"
                            ? `Concluída em ${formatarData(pratica.concluidoEm)}`
                            : pratica.status === "em_andamento"
                              ? "Em andamento"
                              : "Não iniciada"}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Link
                            to="/app/conteudo/$conteudoId"
                            params={{ conteudoId: pratica.id }}
                            className="inline-flex min-h-11 items-center rounded-full bg-secondary px-4 text-sm text-floresta"
                          >
                            Abrir prática
                          </Link>
                          {pratica.reflexoes.length > 0 && (
                            <button
                              type="button"
                              aria-expanded={aberta}
                              aria-controls={`reflexoes-${pratica.id}`}
                              onClick={() =>
                                setAbertas((atual) => ({ ...atual, [pratica.id]: !aberta }))
                              }
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm text-muted-foreground hover:text-floresta"
                            >
                              <NotebookPen className="h-4 w-4" aria-hidden="true" />
                              {aberta ? "Ocultar" : "Ver"} reflexões ({pratica.reflexoes.length})
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${aberta ? "rotate-180" : ""}`}
                                aria-hidden="true"
                              />
                            </button>
                          )}
                        </div>

                        {pratica.reflexoes.length > 0 && (
                          <ul id={`reflexoes-${pratica.id}`} hidden={!aberta} className="mt-3 space-y-2">
                            {pratica.reflexoes.map((reflexao) => (
                              <li key={reflexao.id} className="rounded-2xl bg-secondary/60 p-3">
                                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                  {formatarData(reflexao.criadoEm)}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                                  {reflexao.texto}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {reflexoesGerais.length > 0 && (
        <section
          aria-labelledby="titulo-reflexoes-gerais"
          className="mt-7 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]"
        >
          <h2 id="titulo-reflexoes-gerais" className="text-xl text-floresta">
            Reflexões gerais
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Registros do diário que não estão ligados a uma prática específica.
          </p>
          <ul className="mt-4 space-y-2">
            {reflexoesGerais.map((reflexao) => (
              <li key={reflexao.id} className="rounded-2xl bg-secondary/60 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {formatarData(reflexao.criadoEm)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {reflexao.texto}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
