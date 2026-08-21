import { RaizLogo } from "@/components/raiz-logo";
import { cn } from "@/lib/utils";

/**
 * Abertura do app: fundo em degradê da marca, aura suave e o símbolo Raiz em
 * alta resolução, centralizado com respiro correto. A animação é de respiração
 * lenta (não pisca) e é desligada para quem pede menos movimento.
 */
export function SplashRaiz({
  mensagem = "Preparando o seu espaço…",
  className,
}: {
  mensagem?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-floresta px-6 py-16",
        className,
      )}
    >
      {/* aura de luz atrás do símbolo */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-[58%] rounded-full bg-[radial-gradient(circle,_color-mix(in_oklab,var(--terracota)_28%,transparent)_0%,transparent_65%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[linear-gradient(to_top,_color-mix(in_oklab,black_22%,transparent),transparent)]"
      />

      <div className="relative flex flex-col items-center text-center">
        <RaizLogo className="h-28 w-auto animate-respirar drop-shadow-[0_18px_40px_rgba(0,0,0,0.35)] sm:h-36" />
        <p className="mt-7 font-display text-3xl font-semibold tracking-tight text-floresta-foreground sm:text-4xl">
          Raiz
        </p>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-floresta-foreground/70">
          {mensagem}
        </p>

        {/* barra de progresso indeterminada, discreta */}
        <div
          aria-hidden
          className="mt-8 h-1 w-40 overflow-hidden rounded-full bg-floresta-foreground/15"
        >
          <div className="h-full w-1/2 animate-deslizar rounded-full bg-terracota" />
        </div>
      </div>
    </div>
  );
}
