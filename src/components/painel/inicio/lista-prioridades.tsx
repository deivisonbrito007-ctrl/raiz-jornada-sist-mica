import { Link } from "@tanstack/react-router";
import { LifeBuoy, CalendarClock, MessageSquareReply, PauseCircle, MailQuestion } from "lucide-react";
import type { Prioridade, TipoPrioridade } from "@/lib/inicio-painel";
import { ROTULO_PRIORIDADE } from "@/lib/inicio-painel";

const ICONE: Record<TipoPrioridade, typeof LifeBuoy> = {
  apoio: LifeBuoy,
  revisao: CalendarClock,
  devolutiva: MessageSquareReply,
  plano: PauseCircle,
  convite: MailQuestion,
};

/**
 * Prioridades do dia. Cada item diz o que aconteceu, nunca o que a pessoa
 * "é" ou sente: "solicitou contato", "precisa de acompanhamento".
 */
export function ListaPrioridades({ itens }: { itens: Prioridade[] }) {
  if (itens.length === 0) {
    return (
      <p role="status" className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
        Nada aguardando você agora. Bom momento para revisar uma trilha ou preparar um novo
        conteúdo.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {itens.map((p) => {
        const Icone = ICONE[p.tipo];
        return (
          <li key={p.id}>
            <Link
              to={p.para}
              className="grid min-h-11 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-3 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-salvia">
                <Icone className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-floresta">{p.titulo}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  <span className="sr-only">{ROTULO_PRIORIDADE[p.tipo]}: </span>
                  {p.detalhe}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{p.quando}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
