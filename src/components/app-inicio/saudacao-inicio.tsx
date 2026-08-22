import { Flame, Target } from "lucide-react";
import textura from "@/assets/textura-hero.jpg";
import { RaizLogo } from "@/components/raiz-logo";
import { dataLonga, saudacaoDoDia } from "@/lib/inicio-cliente";

/**
 * Faixa de boas-vindas: saudação pela hora, data e dois sinais de ritmo
 * (sequência em semanas e práticas da semana em relação à meta).
 */
export function SaudacaoInicio({
  primeiroNome,
  streakSemanas,
  feitasNaSemana,
  metaSemanal,
  ciclo,
  eixoFoco,
  agora = new Date(),
}: {
  primeiroNome: string;
  streakSemanas: number;
  feitasNaSemana: number;
  metaSemanal: number;
  ciclo?: { rotulo: string; frase: string } | null;
  eixoFoco?: string | null;
  agora?: Date;
}) {
  const { titulo, frase } = saudacaoDoDia(agora, primeiroNome);
  const meta = Math.max(1, metaSemanal);
  const proporcao = Math.min(1, feitasNaSemana / meta);
  const perimetro = 2 * Math.PI * 20;


  return (
    <section className="relative isolate overflow-hidden rounded-[2.25rem] bg-capa px-6 py-10 text-floresta-foreground shadow-capa sm:px-8 sm:py-12">
      <img
        src={textura}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-30"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ backgroundImage: "var(--gradiente-capa)", opacity: 0.92 }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 animate-respirar"
        style={{ backgroundImage: "var(--halo-capa)" }}
      />
      <RaizLogo className="pointer-events-none absolute -right-6 -top-6 -z-10 h-32 w-auto opacity-10" />

      <p className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-ocre">
        {dataLonga(agora)}
      </p>
      <h1 className="mt-4 font-display text-[2.5rem] leading-[1.05] sm:text-5xl">{titulo}</h1>
      <p className="mt-4 max-w-sm text-[0.95rem] leading-[1.75] text-floresta-foreground/85">{frase}</p>

      {(ciclo || eixoFoco) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {ciclo && (
            <span className="rounded-full border border-ocre/40 px-3 py-1 text-xs font-medium text-ocre">
              {ciclo.rotulo}
            </span>
          )}
          {eixoFoco && (
            <span className="rounded-full bg-floresta-foreground/10 px-3 py-1 text-xs text-floresta-foreground/85 backdrop-blur">
              Seu foco: {eixoFoco}
            </span>
          )}
        </div>
      )}
      {ciclo && (
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-floresta-foreground/70">
          {ciclo.frase}
        </p>
      )}


      <dl className="mt-7 flex flex-wrap items-center gap-3">
        <div className="flex min-h-11 items-center gap-3 rounded-2xl bg-floresta-foreground/10 px-4 py-2.5 backdrop-blur">
          <Flame className="h-4 w-4 text-ocre" aria-hidden="true" />
          <div>
            <dt className="text-[0.65rem] uppercase tracking-wider text-floresta-foreground/70">
              Sequência
            </dt>
            <dd className="text-sm font-medium">
              {streakSemanas} {streakSemanas === 1 ? "semana" : "semanas"}
            </dd>
          </div>
        </div>

        <div className="flex min-h-11 items-center gap-3 rounded-2xl bg-floresta-foreground/10 px-4 py-2.5 backdrop-blur">
          <svg viewBox="0 0 48 48" className="h-10 w-10 -rotate-90" aria-hidden="true">
            <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4" className="stroke-floresta-foreground/25" />
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
              Esta semana
            </dt>
            <dd className="text-sm font-medium">
              {feitasNaSemana} de {meta}
              <span className="sr-only"> práticas concluídas na meta semanal</span>
            </dd>
          </div>
        </div>
      </dl>
    </section>
  );
}
