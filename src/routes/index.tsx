import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RaizWordmark, RaizLogo } from "@/components/raiz-logo";
import { HeroRaiz } from "@/components/landing/hero-raiz";
import {
  ComoFunciona,
  DoisCaminhos,
  EixosSistemicos,
  FaixaConfianca,
  Fechamento,
  ParaTerapeutas,
  Pilares,
} from "@/components/landing/secoes-raiz";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Raiz — acompanhamento terapêutico entre sessões" },
      {
        name: "description",
        content:
          "Raiz conecta terapeuta e cliente entre as sessões: trilhas guiadas de constelação familiar em vídeo e áudio, liberadas no ritmo de cada processo.",
      },
      { property: "og:title", content: "Raiz — acompanhamento terapêutico entre sessões" },
      {
        property: "og:description",
        content:
          "Trilhas sistêmicas guiadas, diário de reflexão e progresso contínuo entre uma sessão e outra.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function CabecalhoLanding() {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const aoRolar = () => setRolou(window.scrollY > 24);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        rolou ? "border-b border-floresta-foreground/10 bg-floresta/80 backdrop-blur-md" : ""
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <RaizWordmark invert />
        <Link
          to="/auth"
          className="flex min-h-10 items-center rounded-full border border-floresta-foreground/30 px-5 text-sm font-medium text-floresta-foreground transition-colors hover:bg-floresta-foreground/10"
        >
          Entrar
        </Link>
      </div>
    </header>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <CabecalhoLanding />

      <main>
        <HeroRaiz />
        <FaixaConfianca />
        <ComoFunciona />
        <EixosSistemicos />
        <Pilares />
        <DoisCaminhos />
        <ParaTerapeutas />
        <Fechamento />
      </main>

      <footer className="border-t border-border bg-background py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-6 text-center text-xs text-muted-foreground">
          <RaizLogo className="h-8" />
          <p>Raiz · acompanhamento terapêutico sistêmico</p>
          <p className="max-w-md leading-relaxed">
            Seus registros são privados e visíveis apenas para você e a terapeuta que acompanha o seu
            processo. A Raiz apoia o trabalho terapêutico e não substitui atendimento clínico ou
            médico.
          </p>
        </div>
      </footer>
    </div>
  );
}
