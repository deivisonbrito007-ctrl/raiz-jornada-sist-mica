import { Link } from "@tanstack/react-router";
import { History, Sparkles, TrendingUp, NotebookPen, ChevronRight } from "lucide-react";

const CAMINHOS = [
  {
    to: "/app/progresso",
    titulo: "Meu progresso",
    descricao: "Sequência, mapa de calor e o quanto já caminhou por eixo",
    icone: TrendingUp,
  },
  {
    to: "/app/historico",
    titulo: "Meu histórico",
    descricao: "Práticas liberadas, concluídas e suas reflexões por trilha",
    icone: History,
  },
  {
    to: "/app/diario",
    titulo: "Meu diário",
    descricao: "Suas reflexões, convites de escrita e insights das suas palavras",
    icone: NotebookPen,
  },
  {
    to: "/app/eixos-preferidos",
    titulo: "Meus eixos preferidos",
    descricao: "Escolha seus temas e qual eixo fica em destaque no Início",
    icone: Sparkles,
  },
] as const;

/** Atalhos do perfil para as telas que continuam o processo. */
export function MeusCaminhos() {
  return (
    <section aria-labelledby="titulo-meus-caminhos" className="mt-4">
      <h2 id="titulo-meus-caminhos" className="px-1 font-display text-xl text-floresta">
        Meus caminhos
      </h2>
      <ul className="mt-3 space-y-3">
        {CAMINHOS.map(({ to, titulo, descricao, icone: Icone }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex min-h-11 items-center gap-4 rounded-3xl bg-card px-5 py-4 shadow-[var(--shadow-organico)] transition-colors hover:bg-secondary/40"
            >
              <span className="rounded-2xl bg-secondary p-2.5 text-salvia">
                <Icone className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-floresta">{titulo}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{descricao}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
