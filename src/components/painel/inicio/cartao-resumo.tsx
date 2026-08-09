import { Link } from "@tanstack/react-router";
import type { CartaoResumo } from "@/lib/inicio-painel";

/** Cartões de resumo: número real e caminho para a área correspondente. */
export function CartoesResumo({ cartoes }: { cartoes: CartaoResumo[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cartoes.map((c) => (
        <li key={c.id}>
          <Link
            to={c.para}
            className="flex min-h-[6.5rem] flex-col justify-between rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-xs uppercase tracking-wider text-salvia">{c.label}</span>
            {c.valor === 0 ? (
              <span className="text-sm text-muted-foreground">{c.vazio}</span>
            ) : (
              <span className="font-display text-4xl leading-none text-floresta">{c.valor}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
