import { Link } from "@tanstack/react-router";
import { NotebookPen, TrendingUp, Wind } from "lucide-react";
import type { PraticaBase } from "@/lib/inicio-cliente";

/**
 * Três portas pequenas para quem tem pouco tempo: uma prática curta, o diário
 * e a visão do caminho já percorrido.
 */
export function MomentosRapidos({ curta }: { curta: PraticaBase | null }) {
  return (
    <section aria-labelledby="titulo-momentos" className="mt-10">
      <h2 id="titulo-momentos" className="font-display text-xl text-floresta">
        Momentos rápidos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Para os dias em que só cabe um instante de cuidado.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {curta && (
          <Link
            to="/app/conteudo/$conteudoId"
            params={{ conteudoId: curta.id }}
            className="flex min-h-11 items-center gap-3 rounded-2xl bg-card p-4 shadow-organico transition-transform hover:-translate-y-0.5"
          >
            <Wind className="h-5 w-5 shrink-0 text-salvia" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-floresta">Respirar um pouco</span>
              <span className="block truncate text-xs text-muted-foreground">{curta.titulo}</span>
            </span>
          </Link>
        )}
        <Link
          to="/app/diario"
          className="flex min-h-11 items-center gap-3 rounded-2xl bg-card p-4 shadow-organico transition-transform hover:-translate-y-0.5"
        >
          <NotebookPen className="h-5 w-5 shrink-0 text-salvia" aria-hidden="true" />
          <span>
            <span className="block text-sm font-medium text-floresta">Escrever no diário</span>
            <span className="block text-xs text-muted-foreground">O que se moveu hoje</span>
          </span>
        </Link>
        <Link
          to="/app/progresso"
          className="flex min-h-11 items-center gap-3 rounded-2xl bg-card p-4 shadow-organico transition-transform hover:-translate-y-0.5"
        >
          <TrendingUp className="h-5 w-5 shrink-0 text-salvia" aria-hidden="true" />
          <span>
            <span className="block text-sm font-medium text-floresta">Ver meu caminho</span>
            <span className="block text-xs text-muted-foreground">Sequência e semanas</span>
          </span>
        </Link>
      </div>
    </section>
  );
}
