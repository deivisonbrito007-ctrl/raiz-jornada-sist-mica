import type { ReactNode } from "react";
import aura from "@/assets/aura-entrada.jpg";
import { PainelMarca } from "@/components/auth/painel-marca";

const BENEFICIOS = [
  "Trilhas guiadas liberadas no seu tempo",
  "Diário privado entre você e quem te acompanha",
  "Sua jornada continua entre as sessões",
];

/**
 * Moldura comum das telas de acesso (/auth e /reset-password): fundo imersivo
 * da marca em toda a página e o cartão em pergaminho centralizado — a mesma
 * composição do mobile, apenas maior no desktop.
 */
export function MolduraEntrada({ frase, children }: { frase: string; children: ReactNode }) {
  return (
    <div
      className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden bg-floresta md:px-6 md:py-10"
      style={{ backgroundImage: "var(--gradiente-aura)" }}
    >
      <img
        src={aura}
        alt=""
        aria-hidden="true"
        width={1024}
        height={1024}
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-35 mix-blend-screen md:opacity-25"
      />

      <main className="mx-auto w-full max-w-md overflow-hidden bg-background md:rounded-[2.5rem] md:shadow-organico">
        <PainelMarca frase={frase} />
        <div className="relative z-10 -mt-8 rounded-t-[2.5rem] bg-background px-6 pb-[calc(env(safe-area-inset-bottom)+3rem)] pt-8 md:px-10 md:pb-10">
          {children}
        </div>
      </main>

      <ul className="mx-auto mt-6 hidden w-full max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 text-center text-xs text-floresta-foreground/80 md:flex">
        {BENEFICIOS.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-ocre" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
