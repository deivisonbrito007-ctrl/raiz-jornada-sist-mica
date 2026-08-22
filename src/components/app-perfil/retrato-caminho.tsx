import { Link } from "@tanstack/react-router";

import { retratoDoCaminho } from "@/lib/perfil-cliente";

type Props = {
  praticasConcluidas: number;
  streakSemanas: number;
  reflexoes: number;
};

const DESTINOS = {
  praticas: "/app/progresso",
  sequencia: "/app/progresso",
  reflexoes: "/app/diario",
} as const;

/** Três medidas curtas do caminho, cada uma levando à tela correspondente. */
export function RetratoCaminho(props: Props) {
  const medidas = retratoDoCaminho(props);

  return (
    <section
      aria-labelledby="titulo-retrato"
      className="mt-4 rounded-3xl bg-card p-6 shadow-[var(--shadow-organico)]"
    >
      <h2 id="titulo-retrato" className="font-display text-xl text-floresta">
        Meu retrato do caminho
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {medidas.map((m) => (
          <li key={m.chave}>
            <Link
              to={DESTINOS[m.chave]}
              className="flex min-h-11 flex-col rounded-2xl bg-secondary p-4 transition-colors hover:bg-secondary/70"
            >
              <span className="font-display text-3xl text-floresta">{m.valor}</span>
              <span className="mt-0.5 text-xs uppercase tracking-wider text-salvia">
                {m.rotulo}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">{m.detalhe}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
