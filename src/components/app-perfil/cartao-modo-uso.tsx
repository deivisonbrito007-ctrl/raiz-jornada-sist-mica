import { Link } from "@tanstack/react-router";
import { HeartHandshake, Compass } from "lucide-react";

import { textoDoModo } from "@/lib/perfil-cliente";
import type { ModoUso } from "@/lib/modo-uso";
import { formatarData } from "@/lib/raiz-format";

type Props = {
  modo: ModoUso;
  temTerapeuta: boolean;
  modoDesde?: string | null;
};

/** Como a pessoa caminha hoje — e o que ela pode pedir a partir daqui. */
export function CartaoModoUso({ modo, temTerapeuta, modoDesde }: Props) {
  const texto = textoDoModo(modo, temTerapeuta);
  const Icone = modo === "acompanhado" ? HeartHandshake : Compass;

  return (
    <section
      aria-labelledby="titulo-modo-uso"
      className="mt-3 w-full rounded-3xl bg-card p-5 shadow-[var(--shadow-organico)] sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-2xl bg-salvia/15 p-3 text-salvia">
          <Icone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="titulo-modo-uso" className="perfil-titulo">
            Meu jeito de caminhar
          </h2>
          <p className="mt-1 break-words text-sm font-medium text-floresta">{texto.titulo}</p>
          <p className="mt-2 perfil-texto break-words text-muted-foreground">
            {texto.descricao}
          </p>
          {modoDesde && (
            <p className="mt-2 text-xs text-muted-foreground">
              Assim desde {formatarData(modoDesde)}.
            </p>
          )}
          {texto.acao === "pedir-apoio" && (
            <Link
              to="/app/jornada"
              className="mt-4 inline-flex min-h-11 max-w-full items-center justify-center rounded-full bg-terracota px-5 py-2 text-center text-sm leading-snug text-terracota-foreground"
            >
              {texto.rotuloAcao}
            </Link>
          )}
          {texto.acao === "pedir-acompanhamento" && (
            <Link
              to="/app"
              className="mt-4 inline-flex min-h-11 max-w-full items-center justify-center rounded-full border border-border bg-secondary px-5 py-2 text-center text-sm leading-snug text-floresta"
            >
              {texto.rotuloAcao}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
