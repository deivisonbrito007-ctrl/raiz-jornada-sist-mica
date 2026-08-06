import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMinhaBiblioteca } from "@/lib/raiz.functions";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/progresso")({
  component: Progresso,
});

function Progresso() {
  const fetchBiblioteca = useServerFn(getMinhaBiblioteca);
  const { data, isLoading } = useQuery({
    queryKey: ["biblioteca"],
    queryFn: () => fetchBiblioteca(),
  });

  const eixos = (data?.eixos ?? []).filter((e) => e.liberado);
  const total = eixos.reduce((soma, e) => soma + e.total, 0);
  const feitos = eixos.reduce((soma, e) => soma + e.concluidos, 0);
  const percentual = total ? Math.round((feitos / total) * 100) : 0;

  return (
    <div>
      <h1 className="text-3xl text-floresta">Seu caminho</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Progresso não é pressa. É o que você já foi capaz de olhar.
      </p>

      {isLoading && <Skeleton className="mt-7 h-40 rounded-3xl" />}

      <div className="mt-7 rounded-3xl bg-floresta p-7 text-floresta-foreground">
        <p className="text-sm text-floresta-foreground/70">Práticas concluídas</p>
        <p className="mt-1 font-display text-5xl">
          {feitos}
          <span className="text-2xl text-floresta-foreground/50">/{total}</span>
        </p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-floresta-foreground/20">
          <div className="h-full rounded-full bg-ocre" style={{ width: `${percentual}%` }} />
        </div>
        <p className="mt-3 text-xs text-floresta-foreground/60">
          {percentual}% do que está liberado para você neste momento.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {eixos.map((eixo) => (
          <div key={eixo.id} className="rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)]">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg text-floresta">{eixo.nome}</h2>
              <span className="shrink-0 text-xs text-salvia">
                {eixo.concluidos}/{eixo.total}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-salvia"
                style={{ width: `${eixo.total ? (eixo.concluidos / eixo.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
        {!isLoading && eixos.length === 0 && (
          <p className="rounded-3xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            Nenhum eixo liberado ainda. Fale com quem acompanha o seu processo.
          </p>
        )}
      </div>
    </div>
  );
}
