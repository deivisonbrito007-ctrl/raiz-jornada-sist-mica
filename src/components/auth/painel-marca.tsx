import aura from "@/assets/aura-entrada.jpg";
import { RaizLogo } from "@/components/raiz-logo";

/**
 * Topo imersivo da tela de entrada: gradiente da marca, textura de luz e a
 * logo com halo. No mobile ocupa a faixa superior; no desktop vira a coluna
 * esquerda da composição.
 */
export function PainelMarca({ frase }: { frase: string }) {
  return (
    <section
      className="relative isolate overflow-hidden bg-floresta px-6 pb-14 pt-[calc(env(safe-area-inset-top)+2.5rem)] text-floresta-foreground md:flex md:min-h-screen md:flex-col md:justify-between md:px-12 md:pb-12 md:pt-12"
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

      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <RaizLogo className="h-20 drop-shadow-[0_10px_30px_rgba(0,0,0,0.35)] md:h-24" />
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-floresta-foreground md:mt-8 md:text-5xl">
          Raiz
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-floresta-foreground/80 md:mt-4 md:text-lg">
          {frase}
        </p>
      </div>

      <ul className="mt-9 hidden gap-4 md:flex md:flex-col">
        {[
          "Trilhas guiadas liberadas no seu tempo",
          "Diário privado entre você e quem te acompanha",
          "Sua jornada continua entre as sessões",
        ].map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-floresta-foreground/85">
            <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 rounded-full bg-ocre" />
            {item}
          </li>
        ))}
      </ul>

      {/* Curva orgânica que emenda com o corpo em pergaminho (só no mobile). */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-1 h-10 rounded-t-[2.5rem] bg-background md:hidden"
      />
    </section>
  );
}
