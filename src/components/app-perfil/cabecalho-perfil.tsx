import { Flame, Leaf } from "lucide-react";

import { iniciaisDe } from "@/components/painel/navegacao";
import { formatarData } from "@/lib/raiz-format";

type Props = {
  nome?: string | null | undefined;
  email?: string | null | undefined;
  desde?: string | null | undefined;
  cicloRotulo?: string | null | undefined;
  cicloFrase?: string | null | undefined;
  streakSemanas: number;
};

/** Identidade da pessoa no processo, em tom de acolhimento. */
export function CabecalhoPerfil({
  nome,
  email,
  desde,
  cicloRotulo,
  cicloFrase,
  streakSemanas,
}: Props) {
  return (
    <section
      aria-labelledby="titulo-perfil"
      className="w-full overflow-hidden rounded-[1.75rem] bg-gradient-to-b from-floresta to-floresta/85 p-5 text-floresta-foreground shadow-[var(--shadow-organico)] sm:rounded-[2rem] sm:p-7"
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
        <span
          aria-hidden="true"
          className="grid h-14 w-14 shrink-0 place-items-center rounded-[1.25rem] bg-floresta-foreground/15 font-display text-lg sm:h-16 sm:w-16 sm:rounded-[1.4rem] sm:text-xl"
        >
          {iniciaisDe(nome, email)}
        </span>
        <div className="min-w-0">
          <h1 id="titulo-perfil" className="truncate font-display text-2xl sm:text-3xl">
            {nome || "Seu perfil"}
          </h1>
          {email && <p className="truncate text-sm text-floresta-foreground/70">{email}</p>}
        </div>
      </div>

      <p className="mt-4 perfil-texto text-floresta-foreground/80 sm:mt-5">
        {cicloFrase ??
          "Este é o seu espaço: o que você ajusta aqui muda como o Raiz caminha com você."}
      </p>

      <dl className="mt-4 flex flex-wrap gap-2 text-xs sm:mt-5">
        {cicloRotulo && (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-floresta-foreground/10 px-3 py-1.5">
            <Leaf className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Ciclo</dt>
            <dd className="min-w-0 break-words">{cicloRotulo}</dd>
          </div>
        )}
        <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-floresta-foreground/10 px-3 py-1.5">
          <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <dt className="sr-only">Sequência</dt>
          <dd className="min-w-0 break-words">
            {streakSemanas} semana{streakSemanas === 1 ? "" : "s"} seguida
            {streakSemanas === 1 ? "" : "s"}
          </dd>
        </div>
        {desde && (
          <div className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-floresta-foreground/10 px-3 py-1.5">
            <dt className="sr-only">No Raiz desde</dt>
            <dd className="min-w-0 break-words">desde {formatarData(desde)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
