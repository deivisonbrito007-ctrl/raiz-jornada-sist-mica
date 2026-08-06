import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { getEixoTrilha } from "@/lib/raiz.functions";
import { TIPO_LABEL, formatarDuracao } from "@/lib/raiz-format";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/eixo/$eixoId")({
  component: Trilha,
});

function Trilha() {
  const { eixoId } = Route.useParams();
  const fetchTrilha = useServerFn(getEixoTrilha);
  const { data, isLoading } = useQuery({
    queryKey: ["trilha", eixoId],
    queryFn: () => fetchTrilha({ data: { eixoId } }),
  });

  return (
    <div>
      <Link
        to="/app"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-floresta"
      >
        <ArrowLeft className="h-4 w-4" /> Biblioteca
      </Link>

      {isLoading && <Skeleton className="mt-6 h-24 rounded-3xl" />}

      {data?.eixo && (
        <>
          <h1 className="mt-5 text-3xl text-floresta">{data.eixo.nome}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {data.eixo.descricao}
          </p>

          <ol className="mt-8 space-y-3">
            {data.conteudos.map((conteudo, indice) => (
              <li key={conteudo.id}>
                <Link
                  to="/app/conteudo/$conteudoId"
                  params={{ conteudoId: conteudo.id }}
                  className="flex items-center gap-4 rounded-3xl bg-card p-4 shadow-[var(--shadow-organico)] transition-transform hover:-translate-y-0.5"
                >
                  <span className="shrink-0">
                    {conteudo.status === "concluido" ? (
                      <CheckCircle2 className="h-6 w-6 text-salvia" />
                    ) : conteudo.status === "em_andamento" ? (
                      <PlayCircle className="h-6 w-6 text-terracota" />
                    ) : (
                      <Circle className="h-6 w-6 text-border" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-salvia">
                      {indice + 1}. {TIPO_LABEL[conteudo.tipo] ?? conteudo.tipo}
                    </span>
                    <span className="mt-0.5 block truncate font-medium text-floresta">
                      {conteudo.titulo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatarDuracao(conteudo.duracao_segundos)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          {data.conteudos.length === 0 && (
            <p className="mt-8 rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nenhuma prática liberada neste eixo ainda.
            </p>
          )}
        </>
      )}
    </div>
  );
}
