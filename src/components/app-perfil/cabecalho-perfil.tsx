import { Flame, Leaf } from "lucide-react";

import { iniciaisDe } from "@/components/painel/navegacao";
import { formatarData } from "@/lib/raiz-format";

type Props = {
  nome?: string | null;
  email?: string | null;
  desde?: string | null;
  cicloRotulo?: string | null;
  cicloFrase?: string | null;
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
      className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-floresta to-floresta/85 p-7 text-floresta-foreground shadow-[var(--shadow-organico)]"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.4rem] bg-floresta-foreground/15 font-display text-xl"
        >
          {iniciaisDe(nome, email)}
        </span>
        <div className="min-w-0">
          <h1 id="titulo-perfil" className="truncate font-display text-3xl">
            {nome || "Seu perfil"}
          </h1>
          {email && (
            <p className="truncate text-sm text-floresta-foreground/70">{email}</p>
          )}
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-floresta-foreground/80">
        {cicloFrase ?? "Este é o seu espaço: o que você ajusta aqui muda como o Raiz caminha com você."}
      </p>

      <dl className="mt-5 flex flex-wrap gap-2 text-xs">
        {cicloRotulo && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-floresta-foreground/10 px-3 py-1.5">
            <Leaf className="h-3.5 w-3.5" aria-hidden="true" />
            <dt className="sr-only">Ciclo</dt>
            <dd>{cicloRotulo}</dd>
          </div>
        )}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-floresta-foreground/10 px-3 py-1.5">
          <Flame className="h-3.5 w-3.5" aria-hidden="true" />
          <dt className="sr-only">Sequência</dt>
          <dd>
            {streakSemanas} semana{streakSemanas === 1 ? "" : "s"} seguida
            {streakSemanas === 1 ? "" : "s"}
          </dd>
        </div>
        {desde && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-floresta-foreground/10 px-3 py-1.5">
            <dt className="sr-only">No Raiz desde</dt>
            <dd>desde {formatarData(desde)}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}
