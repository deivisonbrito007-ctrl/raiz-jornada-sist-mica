import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { tempoRelativo } from "@/lib/diario-cliente";

/**
 * Fio de continuidade: a prática concluída que ainda não ganhou palavras. Um
 * convite, nunca uma pendência.
 */
export function FioContinuidade({
  pratica,
}: {
  pratica: { conteudoId: string; titulo: string; eixoNome: string; concluidoEm: string | null };
}) {
  return (
    <aside className="mt-5 rounded-[1.75rem] bg-secondary p-5">
      <p className="inline-flex items-center gap-2 text-[0.68rem] font-medium uppercase tracking-[0.2em] text-salvia">
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Ficou uma prática sem palavras
      </p>
      <p className="mt-2 text-sm leading-relaxed text-foreground">
        Você concluiu <strong className="font-medium">{pratica.titulo}</strong>
        {pratica.concluidoEm ? ` ${tempoRelativo(pratica.concluidoEm)}` : ""}
        {pratica.eixoNome ? `, no eixo ${pratica.eixoNome}` : ""}. Se quiser, registre agora o que
        ficou.
      </p>
      <Link
        to="/app/diario"
        search={{ conteudoId: pratica.conteudoId }}
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-floresta px-5 text-sm text-floresta-foreground transition hover:bg-floresta/90"
      >
        Escrever sobre esta prática
      </Link>
    </aside>
  );
}
