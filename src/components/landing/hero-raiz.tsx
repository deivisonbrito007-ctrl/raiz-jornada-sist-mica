import { Link } from "@tanstack/react-router";
import { Sprout } from "lucide-react";
import { RaizLogo } from "@/components/raiz-logo";
import texturaHero from "@/assets/textura-hero.jpg";

export function CurvaOrganica({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      className={className}
    >
      <path
        d="M0 120C240 40 480 0 720 0s480 40 720 120H0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function HeroRaiz() {
  return (
    <section className="relative isolate overflow-hidden bg-floresta text-floresta-foreground">
      <img
        src={texturaHero}
        alt=""
        aria-hidden="true"
        width={1536}
        height={1024}
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-45"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ backgroundImage: "var(--gradiente-aura)", opacity: 0.82 }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ backgroundImage: "var(--halo-entrada)" }}
      />

      <div className="mx-auto max-w-5xl px-6 pb-32 pt-28 md:pb-40 md:pt-36">
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <RaizLogo className="h-20 w-auto md:h-24" />

          <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-ocre/35 bg-floresta/40 px-4 py-2 text-[0.68rem] font-medium uppercase tracking-[0.24em] text-ocre">
            <Sprout className="h-3.5 w-3.5" aria-hidden="true" />
            constelação familiar
          </p>

          <h1 className="mt-7 max-w-2xl text-[2rem] font-normal leading-[1.22] tracking-[-0.005em] text-floresta-foreground md:text-[3.4rem] md:leading-[1.14]">
            O trabalho continua
            <br />
            entre as sessões.
          </h1>

          <p className="mt-6 max-w-md text-[1.02rem] leading-[1.75] text-floresta-foreground/80 md:max-w-lg md:text-lg md:leading-[1.7]">
            Práticas guiadas de constelação em vídeo e áudio, liberadas no ritmo do seu processo — com
            um diário privado para registrar o que se move.
          </p>

          <div className="mt-10 flex w-full flex-col gap-3.5 sm:w-auto sm:flex-row sm:items-center">
            <Link
              to="/auth"
              className="flex min-h-12 items-center justify-center rounded-full bg-terracota px-8 text-sm font-semibold text-terracota-foreground shadow-organico transition-opacity hover:opacity-90"
            >
              Acessar minha jornada
            </Link>
            <Link
              to="/auth"
              search={{ modo: "cadastro" }}
              className="flex min-h-12 items-center justify-center rounded-full border border-floresta-foreground/30 px-8 text-sm font-semibold text-floresta-foreground transition-colors hover:bg-floresta-foreground/10"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </div>

      <CurvaOrganica className="absolute bottom-0 left-0 h-16 w-full text-background md:h-24" />
    </section>
  );
}
