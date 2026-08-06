import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame } from "lucide-react";
import { getMinhaBiblioteca } from "@/lib/raiz.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { calcularStreak, linhaDoTempoSemanal } from "@/lib/raiz-format";

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

  const datasConclusao = data?.resumo.datasConclusao ?? [];
  const streak = calcularStreak(datasConclusao);
  const semanas = linhaDoTempoSemanal(datasConclusao, 8);
  const maximoSemana = Math.max(1, ...semanas.map((s) => s.total));


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

      <div className="mt-4 flex items-center gap-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <span className="rounded-2xl bg-terracota/10 p-3 text-terracota">
          <Flame className="h-6 w-6" />
        </span>
        <div>
          <p className="font-display text-3xl text-floresta">
            {streak} <span className="text-base">semana{streak === 1 ? "" : "s"}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {streak === 0
              ? "Sua sequência começa na primeira prática concluída desta semana."
              : "Sequência de semanas seguidas com pelo menos uma prática concluída."}
          </p>
        </div>
      </div>

      <section className="mt-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]">
        <h2 className="text-lg text-floresta">Linha do tempo semanal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Últimas 8 semanas — cada barra mostra quantas práticas você concluiu.
        </p>
        <div className="mt-6 flex items-end justify-between gap-2">
          {semanas.map((semana) => (
            <div key={semana.inicio} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-medium text-salvia">{semana.total || ""}</span>
              <div className="flex h-24 w-full items-end">
                <div
                  className={`w-full rounded-t-xl transition-all ${
                    semana.ativa ? "bg-salvia" : "bg-secondary"
                  } ${semana.atual ? "ring-2 ring-terracota/50" : ""}`}
                  style={{
                    height: semana.total ? `${(semana.total / maximoSemana) * 100}%` : "6px",
                  }}
                />
              </div>
              <span
                className={`text-[10px] ${semana.atual ? "font-semibold text-terracota" : "text-muted-foreground"}`}
              >
                {semana.label}
              </span>
            </div>
          ))}
        </div>
      </section>


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
