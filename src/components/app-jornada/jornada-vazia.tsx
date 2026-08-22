import { Link } from "@tanstack/react-router";
import { ArrowRight, Compass, Sprout } from "lucide-react";

/**
 * Estado vazio por modo de uso: quem é acompanhada aguarda a terapeuta;
 * quem caminha por conta própria já pode escolher um eixo e começar.
 */
export function JornadaVazia({ autoguiado }: { autoguiado: boolean }) {
  return (
    <section className="rounded-[2rem] border border-dashed border-salvia/50 bg-secondary/40 p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-card text-salvia">
        {autoguiado ? (
          <Compass className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Sprout className="h-6 w-6" aria-hidden="true" />
        )}
      </span>
      <h2 className="mt-4 font-display text-xl text-floresta">
        {autoguiado ? "Seu caminho começa por você" : "Sua terapeuta está preparando seu caminho"}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {autoguiado
          ? "Escolha um eixo que fale com o seu momento e comece por uma prática curta. Você pode mudar de caminho quando quiser."
          : "Quando um plano for combinado, ele aparece aqui com o objetivo, os cuidados e as etapas. Até então, você pode praticar livremente pelas suas trilhas."}
      </p>
      <Link
        to="/app"
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-terracota px-5 text-sm font-medium text-terracota-foreground"
      >
        {autoguiado ? "Escolher por onde começar" : "Ver práticas disponíveis"}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
