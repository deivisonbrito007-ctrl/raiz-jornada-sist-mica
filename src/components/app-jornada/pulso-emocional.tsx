import { Link } from "@tanstack/react-router";
import { ArrowRight, HeartPulse } from "lucide-react";
import { formatarData } from "@/lib/raiz-format";

export type CheckinResumo = {
  id: string;
  emocao: string | null;
  intensidade: number | null;
  created_at: string;
};

/** Leitura suave dos últimos check-ins: como a pessoa tem chegado às práticas. */
export function PulsoEmocional({ checkins }: { checkins: CheckinResumo[] }) {
  const ultimos = checkins.filter((c) => c.emocao).slice(0, 6);
  if (ultimos.length === 0) return null;

  return (
    <section
      aria-labelledby="titulo-pulso"
      className="rounded-[2rem] border border-border bg-card p-5"
    >
      <h2
        id="titulo-pulso"
        className="flex items-center gap-2 font-display text-lg text-floresta"
      >
        <HeartPulse className="h-4 w-4 text-terracota" aria-hidden="true" />
        Como você tem chegado
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        O que você registrou antes e depois das últimas práticas.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {ultimos.map((c) => (
          <li
            key={c.id}
            className="rounded-2xl bg-secondary px-3.5 py-2"
            style={{ opacity: 0.55 + 0.045 * Math.min(10, c.intensidade ?? 5) }}
          >
            <p className="text-sm font-medium text-foreground">{c.emocao}</p>
            <p className="text-[0.68rem] text-muted-foreground">
              {formatarData(c.created_at)}
              {c.intensidade ? ` · intensidade ${c.intensidade}` : ""}
            </p>
          </li>
        ))}
      </ul>

      <Link
        to="/app/diario"
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-medium text-floresta"
      >
        Escrever no diário
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
