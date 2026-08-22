import { BookHeart, CalendarHeart, Share2 } from "lucide-react";

import textura from "@/assets/textura-hero.jpg";
import { RaizLogo } from "@/components/raiz-logo";
import { tempoRelativo, type ResumoDiario } from "@/lib/diario-cliente";

/**
 * Faixa de abertura do diário: quantas escutas já foram registradas, há quanto
 * tempo foi a última e quantas estão compartilhadas. Sem metas, sem cobrança.
 */
export function CabecalhoDiario({
  primeiroNome,
  resumo,
  mostrarCompartilhadas,
}: {
  primeiroNome: string;
  resumo: ResumoDiario;
  mostrarCompartilhadas: boolean;
}) {
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-floresta px-6 py-8 text-floresta-foreground shadow-organico">
      <img
        src={textura}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ backgroundImage: "var(--gradiente-aura)", opacity: 0.85 }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 animate-respirar"
        style={{ backgroundImage: "var(--halo-entrada)" }}
      />
      <RaizLogo className="pointer-events-none absolute -right-6 -top-8 -z-10 h-32 w-auto opacity-10" />

      <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-ocre">
        Seu espaço de escuta
      </p>
      <h1 className="mt-3 font-display text-3xl leading-tight">
        {primeiroNome ? `Diário de ${primeiroNome}` : "Diário de reflexão"}
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-floresta-foreground/85">
        {resumo.frase}
      </p>

      <dl className="mt-7 flex flex-wrap items-center gap-3">
        <div className="flex min-h-11 items-center gap-3 rounded-2xl bg-floresta-foreground/10 px-4 py-2.5 backdrop-blur">
          <BookHeart className="h-4 w-4 text-ocre" aria-hidden="true" />
          <dt className="text-[0.65rem] uppercase tracking-wider text-floresta-foreground/70">
            Reflexões
          </dt>
          <dd className="text-sm font-medium">{resumo.total}</dd>
        </div>

        <div className="flex min-h-11 items-center gap-3 rounded-2xl bg-floresta-foreground/10 px-4 py-2.5 backdrop-blur">
          <CalendarHeart className="h-4 w-4 text-ocre" aria-hidden="true" />
          <dt className="text-[0.65rem] uppercase tracking-wider text-floresta-foreground/70">
            Dias de escuta
          </dt>
          <dd className="text-sm font-medium">{resumo.diasEscrevendo}</dd>
        </div>

        {mostrarCompartilhadas && (
          <div className="flex min-h-11 items-center gap-3 rounded-2xl bg-floresta-foreground/10 px-4 py-2.5 backdrop-blur">
            <Share2 className="h-4 w-4 text-ocre" aria-hidden="true" />
          <dt className="text-[0.65rem] uppercase tracking-wider text-floresta-foreground/70">
            Compartilhadas
          </dt>
          <dd className="text-sm font-medium">{resumo.compartilhadas}</dd>
          </div>
        )}
      </dl>

      {resumo.ultimaEm && (
        <p className="mt-4 text-xs text-floresta-foreground/70">
          Última reflexão {tempoRelativo(resumo.ultimaEm)}.
        </p>
      )}
    </section>
  );
}
