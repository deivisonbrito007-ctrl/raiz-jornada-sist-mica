import aura from "@/assets/aura-entrada.jpg";
import { RaizLogo } from "@/components/raiz-logo";

/**
 * Topo do cartão de entrada: faixa verde com halo, logo e frase de acolhimento.
 * A mesma composição vertical em qualquer largura — no desktop apenas cresce.
 */
export function PainelMarca({ frase }: { frase: string }) {
  return (
    <section
      className="relative isolate overflow-hidden bg-floresta px-6 pb-14 pt-[calc(env(safe-area-inset-top)+2.5rem)] text-center text-floresta-foreground md:px-12 md:pb-12 md:pt-10"
      style={{ backgroundImage: "var(--gradiente-aura)" }}
    >
      <img
        src={aura}
        alt=""
        aria-hidden="true"
        width={1024}
        height={1024}
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-35 mix-blend-screen"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: "var(--halo-entrada)" }}
      />

      <div className="flex flex-col items-center">
        <RaizLogo className="h-20 drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)] md:h-24" />
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-floresta-foreground md:mt-6 md:text-4xl">
          Raiz
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-floresta-foreground/80 md:mt-3 md:text-base">
          {frase}
        </p>
      </div>

      {/* Curva orgânica que emenda com o corpo em pergaminho. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-1 h-10 rounded-t-[2.5rem] bg-background"
      />
    </section>
  );
}
