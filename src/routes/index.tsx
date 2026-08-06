import { createFileRoute, Link } from "@tanstack/react-router";
import { Sprout, PlayCircle, NotebookPen, Route as RouteIcon } from "lucide-react";
import { RaizLogo, RaizWordmark } from "@/components/raiz-logo";

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
    ],
  }),
  component: Landing,
});

const pilares = [
  {
    icone: RouteIcon,
    titulo: "Trilhas por eixo sistêmico",
    texto:
      "Pai, Mãe, Filhos, Ancestralidade, Dinheiro, Saúde, Relacionamentos e Propósito — cada eixo com sua própria sequência de práticas.",
  },
  {
    icone: PlayCircle,
    titulo: "Práticas guiadas no seu ritmo",
    texto:
      "Vídeos e meditações em áudio que abrem dentro do próprio app, liberados pela sua terapeuta conforme o momento do processo.",
  },
  {
    icone: NotebookPen,
    titulo: "Diário de reflexão",
    texto:
      "Depois de cada prática, um espaço para registrar o que se moveu. Privado entre você e quem acompanha o seu processo.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <RaizWordmark />
        <Link
          to="/auth"
          className="rounded-full border border-floresta/20 px-5 py-2 text-sm font-medium text-floresta transition-colors hover:bg-floresta hover:text-floresta-foreground"
        >
          Entrar
        </Link>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-20 pt-10 md:pt-16">
          <div className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-salvia">
                <Sprout className="h-4 w-4" /> constelação familiar
              </p>
              <h1 className="mt-5 text-4xl leading-[1.08] text-floresta md:text-6xl">
                O trabalho continua
                <br />
                entre as sessões.
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
                Raiz é a extensão digital do seu processo terapêutico. Sua terapeuta libera práticas
                guiadas alinhadas ao seu momento, e você caminha no seu ritmo — registrando o que se
                move a cada passo.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  to="/auth"
                  className="rounded-full bg-terracota px-7 py-3.5 text-sm font-semibold text-terracota-foreground shadow-[var(--shadow-organico)] transition-opacity hover:opacity-90"
                >
                  Acessar minha jornada
                </Link>
                <Link
                  to="/auth"
                  search={{ modo: "cadastro" }}
                  className="rounded-full border border-floresta/20 px-7 py-3.5 text-sm font-semibold text-floresta transition-colors hover:bg-secondary"
                >
                  Criar conta
                </Link>
              </div>
            </div>

            <div className="relative flex justify-center">
              <div className="absolute inset-0 -z-10 rounded-[3rem] bg-secondary/70" />
              <RaizLogo className="h-64 w-auto py-10 md:h-80" />
            </div>
          </div>
        </section>

        <section className="bg-floresta py-20 text-floresta-foreground">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="max-w-xl text-3xl text-floresta-foreground md:text-4xl">
              Uma jornada que respeita o tempo de cada sistema.
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {pilares.map((p) => (
                <div key={p.titulo} className="border-t border-ocre/40 pt-6">
                  <p.icone className="h-6 w-6 text-ocre" />
                  <h3 className="mt-4 text-xl text-floresta-foreground">{p.titulo}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-floresta-foreground/75">
                    {p.texto}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl text-floresta">Para terapeutas sistêmicos</h2>
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground">
            Organize sua biblioteca de práticas, libere conteúdo cliente por cliente e acompanhe o
            progresso de cada processo em um só lugar.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex rounded-full bg-floresta px-7 py-3.5 text-sm font-semibold text-floresta-foreground transition-opacity hover:opacity-90"
          >
            Entrar no painel
          </Link>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-6 text-sm text-muted-foreground">
          <RaizLogo className="h-8" />
          <p>Raiz · acompanhamento terapêutico sistêmico</p>
        </div>
      </footer>
    </div>
  );
}
