import { Link } from "@tanstack/react-router";
import {
  Headphones,
  Lock,
  NotebookPen,
  PlayCircle,
  Route as RouteIcon,
  UserRound,
} from "lucide-react";
import { CurvaOrganica } from "./hero-raiz";

const provas = [
  { icone: UserRound, texto: "Processo acompanhado pela sua terapeuta" },
  { icone: Headphones, texto: "Práticas em vídeo e meditações em áudio" },
  { icone: Lock, texto: "Diário privado, só entre vocês" },
];

const passos = [
  {
    titulo: "A terapeuta libera a trilha",
    texto:
      "Ela escolhe as práticas alinhadas ao seu momento e define quando cada etapa se abre para você.",
  },
  {
    titulo: "Você pratica no seu ritmo",
    texto:
      "Assiste, escuta e repete quantas vezes precisar. Nada de prazo apertado — o sistema tem o tempo dele.",
  },
  {
    titulo: "Registra o que se moveu",
    texto:
      "Depois de cada prática, escreve no diário. Sua terapeuta enxerga o percurso e ajusta o caminho.",
  },
];

const eixos = [
  "Pai",
  "Mãe",
  "Filhos",
  "Ancestralidade",
  "Dinheiro",
  "Saúde",
  "Relacionamentos",
  "Propósito",
];

const pilares = [
  {
    icone: RouteIcon,
    titulo: "Trilhas por eixo sistêmico",
    texto:
      "Cada eixo com sua própria sequência de práticas, construída para sustentar o movimento aberto na sessão.",
  },
  {
    icone: PlayCircle,
    titulo: "Práticas guiadas no seu ritmo",
    texto:
      "Vídeos e meditações que abrem dentro do próprio app, retomando exatamente de onde você parou.",
  },
  {
    icone: NotebookPen,
    titulo: "Diário de reflexão",
    texto:
      "Um espaço protegido para nomear o que se moveu — e voltar a ele semanas depois para ver o caminho.",
  },
];

export function FaixaConfianca() {
  return (
    <section className="border-b border-border/70 bg-background">
      <ul className="mx-auto grid max-w-5xl gap-4 px-6 py-10 sm:grid-cols-3 sm:gap-8">
        {provas.map((p) => (
          <li key={p.texto} className="flex items-center gap-3">
            <p.icone className="h-5 w-5 shrink-0 text-ocre-forte" aria-hidden="true" />
            <span className="text-sm leading-relaxed text-muted-foreground">{p.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ComoFunciona() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-32">
      <h2 className="max-w-xl text-[1.6rem] leading-[1.3] text-floresta md:text-[2.6rem] md:leading-[1.2]">
        Uma jornada que respeita o tempo de cada sistema.
      </h2>

      <ol className="relative mt-14 space-y-12 md:mt-20 md:grid md:grid-cols-3 md:gap-14 md:space-y-0">
        <span
          aria-hidden="true"
          className="absolute left-[1.1rem] top-3 bottom-3 w-px bg-gradient-to-b from-ocre/60 via-salvia/40 to-transparent md:hidden"
        />
        {passos.map((passo, i) => (
          <li key={passo.titulo} className="relative flex gap-5 md:block">
            <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ocre/50 bg-secondary font-display text-sm font-semibold text-ocre-forte">
              {i + 1}
            </span>
            <div className="md:mt-6">
              <h3 className="text-[1.1rem] leading-snug text-floresta md:text-xl">{passo.titulo}</h3>
              <p className="mt-3 text-[0.95rem] leading-[1.7] text-muted-foreground">{passo.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function EixosSistemicos() {
  return (
    <section className="bg-secondary/60 py-20 md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-[1.6rem] leading-[1.3] text-floresta md:text-[2.1rem]">Os oito eixos do trabalho</h2>
        <p className="mt-5 max-w-xl text-[0.95rem] leading-[1.75] text-muted-foreground md:text-base">
          Toda prática da Raiz pertence a um eixo. É assim que a trilha ganha direção em vez de virar
          uma pilha de conteúdos soltos.
        </p>
        <ul className="mt-11 flex flex-wrap gap-3">
          {eixos.map((eixo) => (
            <li
              key={eixo}
              className="rounded-full border border-floresta/15 bg-background px-4 py-2 text-sm font-medium text-floresta"
            >
              {eixo}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Pilares() {
  return (
    <section className="relative bg-floresta py-20 text-floresta-foreground md:py-28">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-5 md:grid-cols-3 md:gap-6">
          {pilares.map((p) => (
            <article
              key={p.titulo}
              className="rounded-3xl border border-ocre/20 bg-pergaminho/5 p-7 backdrop-blur-sm"
            >
              <p.icone className="h-6 w-6 text-ocre" aria-hidden="true" />
              <h3 className="mt-5 text-[1.1rem] leading-snug text-floresta-foreground md:text-xl">{p.titulo}</h3>
              <p className="mt-3 text-[0.95rem] leading-[1.75] text-floresta-foreground/75">{p.texto}</p>
            </article>
          ))}
        </div>
      </div>
      <CurvaOrganica className="absolute bottom-0 left-0 h-14 w-full rotate-180 text-background md:h-20" />
    </section>
  );
}

export function DoisCaminhos() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 md:py-28">
      <h2 className="text-[1.6rem] leading-[1.3] text-floresta md:text-[2.6rem] md:leading-[1.2]">Dois jeitos de caminhar</h2>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <article className="flex flex-col rounded-3xl border border-floresta/12 bg-card p-7 shadow-organico md:p-8">
          <h3 className="text-[1.15rem] leading-snug text-floresta md:text-xl">Sou cliente de uma terapeuta</h3>
          <p className="mt-3.5 flex-1 text-[0.95rem] leading-[1.75] text-muted-foreground">
            Sua terapeuta libera as trilhas conforme o processo e acompanha seus registros entre uma
            sessão e outra.
          </p>
          <Link
            to="/auth"
            search={{ modo: "cadastro", caminho: "acompanhado" }}

            className="mt-7 flex min-h-12 items-center justify-center rounded-full bg-terracota px-6 text-sm font-semibold text-terracota-foreground transition-opacity hover:opacity-90"
          >
            Entrar com acompanhamento
          </Link>
        </article>

        <article className="flex flex-col rounded-3xl border border-floresta/12 bg-card p-7 shadow-organico md:p-8">
          <h3 className="text-[1.15rem] leading-snug text-floresta md:text-xl">Quero começar por conta própria</h3>
          <p className="mt-3.5 flex-1 text-[0.95rem] leading-[1.75] text-muted-foreground">
            Acesse trilhas autoguiadas no seu tempo. Se quiser, pode pedir acompanhamento de uma
            terapeuta depois, sem perder nada do caminho.
          </p>
          <Link
            to="/auth"
            search={{ modo: "cadastro", caminho: "autoguiado" }}

            className="mt-7 flex min-h-12 items-center justify-center rounded-full border border-floresta/25 px-6 text-sm font-semibold text-floresta transition-colors hover:bg-secondary"
          >
            Começar autoguiado
          </Link>
        </article>
      </div>
    </section>
  );
}

export function Fechamento() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20 text-center md:py-28">
      <h2 className="text-[1.6rem] leading-[1.35] text-floresta md:text-[2.6rem] md:leading-[1.22]">
        O que foi visto na sessão pede continuidade no dia a dia.
      </h2>
      <Link
        to="/auth"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-terracota px-8 text-sm font-semibold text-terracota-foreground shadow-organico transition-opacity hover:opacity-90"
      >
        Acessar minha jornada
      </Link>
    </section>
  );
}
