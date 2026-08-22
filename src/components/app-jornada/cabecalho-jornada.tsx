import { Footprints, Sprout } from "lucide-react";
import textura from "@/assets/textura-hero.jpg";
import { RaizLogo } from "@/components/raiz-logo";
import type { ResumoJornada } from "@/lib/jornada-cliente";

/**
 * Faixa de abertura da jornada: quantos caminhos estão abertos, quantas etapas
 * já foram percorridas e uma frase de ritmo — sem cobrança.
 */
export function CabecalhoJornada({
  primeiroNome,
  resumo,
  acao,
}: {
  primeiroNome: string;
  resumo: ResumoJornada;
  acao?: React.ReactNode;
}) {
  const perimetro = 2 * Math.PI * 20;
  const proporcao = Math.min(1, resumo.percentual / 100);

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
        Seu caminho
      </p>
      <h1 className="mt-3 font-display text-3xl leading-tight">
        {primeiroNome ? `Sua jornada, ${primeiroNome}` : "Minha jornada"}
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-floresta-foreground/85">
        {resumo.frase}
      </p>

      <dl className="mt-7 flex flex-wrap items-center gap-3">
        <div className="flex min-h-11 items-center gap-3 rounded-2xl bg-floresta-foreground/10 px-4 py-2.5 backdrop-blur">
          <Sprout className="h-4 w-4 text-ocre" aria-hidden="true" />
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wider text-floresta-foreground/70">
              Caminhos abertos
            </dt>
            <dd className="text-sm font-medium">{resumo.ativos}</dd>
          </div>
        </div>

        <div className="flex min-h-11 items-center gap-3 rounded-2xl bg-floresta-foreground/10 px-4 py-2.5 backdrop-blur">
          <svg viewBox="0 0 48 48" className="h-10 w-10 -rotate-90" aria-hidden="true">
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              strokeWidth="4"
              className="stroke-floresta-foreground/25"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              className="stroke-ocre transition-all"
              strokeDasharray={perimetro}
              strokeDashoffset={perimetro * (1 - proporcao)}
            />
          </svg>
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wider text-floresta-foreground/70">
              Etapas percorridas
            </dt>
            <dd className="text-sm font-medium">
              {resumo.etapasFeitas} de {resumo.etapasTotais}
            </dd>
          </div>
        </div>

        {resumo.fechados > 0 && (
          <div className="flex min-h-11 items-center gap-3 rounded-2xl bg-floresta-foreground/10 px-4 py-2.5 backdrop-blur">
            <Footprints className="h-4 w-4 text-ocre" aria-hidden="true" />
            <div>
              <dt className="text-[0.65rem] uppercase tracking-wider text-floresta-foreground/70">
                Ciclos fechados
              </dt>
              <dd className="text-sm font-medium">{resumo.fechados}</dd>
            </div>
          </div>
        )}
      </dl>

      {acao && <div className="mt-6">{acao}</div>}
    </section>
  );
}
