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
      className="mt-3 w-full rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)] sm:p-6"
    >
      <h2 id="titulo-retrato" className="perfil-titulo">
        Meu retrato do caminho
      </h2>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-3 sm:gap-3">
        {medidas.map((m) => (
          <li key={m.chave}>
            <Link
              to={DESTINOS[m.chave]}
              className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl bg-secondary p-4 transition-colors hover:bg-secondary/70 sm:flex sm:flex-col sm:items-start sm:gap-0"
            >
              <span className="font-display text-3xl leading-none text-floresta">{m.valor}</span>
              <span className="min-w-0">
                <span className="block break-words perfil-rotulo">
                  {m.rotulo}
                </span>
                <span className="mt-0.5 block break-words perfil-nota text-muted-foreground">
                  {m.detalhe}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
